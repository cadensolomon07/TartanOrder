import { API_VERSION, ParseRequestSchema, ParseResponseSchema, LocationIdSchema, type Catalog, type LocationId, type OrderController, type ParseRequest, type InterpretOptions, type ParseResponse, type PersistenceStatus, type UiAction, type ConversationTurn, type OrderView, type Line, type OrderNotice, type WaitEngineConfig } from "@/contracts";
import { createEngine, reduceEngine, getView, exportLog } from "@/core/engine";
import { interpret } from "@/parser/client";
import { indexCatalog, type CatalogIndex } from "@/catalog/lookup";
import type { PersistOutcome, PersistPort } from "@/persistence/port";
import { LanguageSchema } from "@/contracts";
import { translate, type Language } from "@/contracts/languages";

export type Dependencies = {
  /** The loaded, validated catalog this session prices and parses against. Required. */
  catalog: Catalog;
  interpret?: (request:ParseRequest, options:InterpretOptions)=>Promise<ParseResponse>;
  sessionId?: ()=>string;
  locationId?: LocationId;
  waitConfig?: WaitEngineConfig;
  allowedLocationIds?: readonly LocationId[];
  /** Write-behind server saving. Absent, or persistenceMode "off", means the kiosk reports saving as off and never calls it. */
  persist?: PersistPort;
  persistenceMode?: "supabase" | "off";
};
/** No port, or ORDER_PERSISTENCE=off: nothing is ever sent, and the kiosk says so. */
const PERSISTENCE_OFF: PersistenceStatus = Object.freeze({ state: "off", savedSeq: 0, pendingCount: 0, message: "Server saving is off" });
/** One appendEvents call carries at most this many audit entries (the route's cap). */
const PERSIST_BATCH = 200;
/** Per-session write-behind bookkeeping; replaced wholesale on reset so late results cannot touch a newer session. */
type PersistRun = { sessionId: string; created: boolean; savedSeq: number; receiptSaved: boolean; failed: string | null; inFlight: boolean };
const messages:Record<string,string> = {
  INVALID_SCHEMA:"That edit did not match the order format. Your cart was not changed.",
  INVALID_MODIFIER:"That option is not available for that item. Your cart was not changed.",
  QUANTITY_LIMIT:"Choose a quantity from 1 to 5.",
  CART_LIMIT:"An order can hold 5 lines and 10 total items.",
  UNKNOWN_REFERENCE:"That item is not in your cart. Select a cart row or add it first.",
  AMBIGUOUS_REFERENCE:"Choose the cart item you meant.",
  STALE_RESPONSE:"An outdated response was ignored.",
  STALE_OFFER:"That alternative is no longer active. Your cart was not changed.",
  STALE_DECISION:"That decision is no longer active. Your requirements and cart were not changed.",
  REQUIREMENT_CONFLICT:"That change conflicts with your active requirements. Your cart was not changed.",
  STAFF_REVIEW_REQUIRED:"Ingredient or preparation information needs staff review before this order can be confirmed.",
  REVIEW_REQUIRED:"Review the current order before confirming it.",
  EMPTY_CART:"Add something to your cart first.",
  NO_UNDO:"There are no earlier cart edits to restore.",
  NO_PENDING:"That choice is no longer active.",
  SESSION_COMMITTED:"This simulated order is complete. Start a new order to edit.",
  UNSUPPORTED:"Try a menu item or a simple edit.",
  OFF_MENU:"That item isn't on our demo menu. What would you like from the menu instead?",
};

/** Request lifecycle stays here; the engine never performs I/O. */
export function createOrderController(deps:Dependencies) {
  if(!deps?.catalog)throw new Error("createOrderController requires a loaded catalog.");
  const catalog = deps.catalog;
  const menu = indexCatalog(catalog);
  const menuVersion = catalog.versionId;
  const makeSession = deps.sessionId ?? (()=>crypto.randomUUID());
  const parse = deps.interpret ?? interpret;
  const engineOptions = { catalog, waitConfig: deps.waitConfig, allowedLocationIds: deps.allowedLocationIds };
  let engine = createEngine(makeSession(), engineOptions);
  const port = deps.persistenceMode === "off" ? undefined : deps.persist;
  const newRun = (): PersistRun => ({ sessionId: getView(engine).sessionId, created: false, savedSeq: 0, receiptSaved: false, failed: null, inFlight: false });
  let run: PersistRun = newRun();
  let persistence: PersistenceStatus = PERSISTENCE_OFF;
  let capture = false;
  let language: Language = "en-US";
  let localOnly = false;
  let locationId = LocationIdSchema.parse(deps.locationId ?? "demo");
  if (!menu.location(locationId))throw new Error("The selected location is not in the loaded catalog.");
  if (deps.allowedLocationIds && !deps.allowedLocationIds.includes(locationId))throw new Error("The selected location is outside this kiosk's catalog.");
  let assistant: OrderController["assistant"] = null;
  let conversation: ConversationTurn[] = [];
  let assistantCounter = 0;
  const remember = (role: ConversationTurn["role"], text: string) => { conversation = [...conversation, { role, text: text.slice(0, 1000) }].slice(-8); };
  const answer = (text: string) => { assistant = { id: `answer-${++assistantCounter}`, text }; remember("assistant", text); };
  let parser:OrderController["parser"] = "none";
  let notice:string|null = null;
  let counter = 0;
  type Ticket = { abort:AbortController; request:ParseRequest; session:string };
  let active:Ticket|null = null;
  const listeners = new Set<()=>void>();
  let snapshot:OrderController;
  const cancel = ()=>{ const old=active; active=null; old?.abort.abort(); if(old)remember("assistant", "The previous request was cancelled without applying its edits."); };
  const publish = ()=>{
    snapshot = {state:getView(engine),language,setLanguage,busy:capture||active!==null,parser,notice:notice ? translate(notice,language) : null,assistant,localOnly,locationId,startInput,endInput,submit,act,setLocalOnly,setLocation,reset,exportLog:()=>exportLog(engine),persistence,retryPersistence};
    for (const listener of listeners) listener();
  };
  // ---- write-behind persistence -------------------------------------------
  // Ordering never awaits the port. One operation is in flight per session; the
  // loop re-reads the live view after every acknowledgement, so edits made while a
  // call is pending coalesce into the next batch. A failure stops the chain and
  // keeps everything pending until retryPersistence().
  const updatePersistence = ()=>{
    if(!port){persistence=PERSISTENCE_OFF;return;}
    const view=getView(engine);
    const pendingCount=Math.max(0,view.audit.length-run.savedSeq);
    const pending=!run.created||pendingCount>0||(view.receipt!==null&&!run.receiptSaved);
    const state:PersistenceStatus["state"]=run.failed!==null?"failed":pending||run.inFlight?"saving":"saved";
    persistence={state,savedSeq:run.savedSeq,pendingCount,message:run.failed};
  };
  const flush = async (current:PersistRun)=>{
    if(!port)return;
    current.inFlight=true;
    try {
      while(current.failed===null) {
        if(run!==current)return;
        const view=getView(engine);
        let outcome:PersistOutcome;
        if(!current.created) {
          outcome=await port.createSession({sessionId:current.sessionId,menuVersion,...(deps.waitConfig?{waitConfig:deps.waitConfig}:{}),...(deps.allowedLocationIds?{allowedLocationIds:[...deps.allowedLocationIds]}:{})});
          if(run!==current)return;
          if(outcome.ok){current.created=true;current.savedSeq=Math.max(current.savedSeq,outcome.savedSeq);}
        } else if(view.audit.length>current.savedSeq) {
          outcome=await port.appendEvents(current.sessionId,view.audit.slice(current.savedSeq,current.savedSeq+PERSIST_BATCH));
          if(run!==current)return;
          if(outcome.ok)current.savedSeq=Math.max(current.savedSeq,outcome.savedSeq);
        } else if(view.receipt!==null&&!current.receiptSaved) {
          outcome=await port.saveReceipt(current.sessionId,view.receipt);
          if(run!==current)return;
          if(outcome.ok)current.receiptSaved=true;
        } else break;
        if(!outcome.ok){current.failed=outcome.message;break;}
        updatePersistence();publish();
      }
    } catch(error) {
      if(run!==current)return;
      current.failed=error instanceof Error&&error.message?error.message:"Saving to the server failed.";
    } finally {
      current.inFlight=false;
      if(run===current){updatePersistence();publish();}
    }
  };
  const schedulePersist = ()=>{
    if(!port)return;
    updatePersistence();
    if(run.failed!==null||run.inFlight)return;
    void flush(run);
  };
  function retryPersistence() {
    if(!port||run.failed===null)return;
    run.failed=null;
    schedulePersist();publish();
  }
  const dispatch = (event:Parameters<typeof reduceEngine>[1])=>{
    const before=engine.view.audit.length;
    const previousRequirementMessage = engine.view.requirements?.message;
    engine=reduceEngine(engine,event);
    if(engine.view.audit.length>before)schedulePersist();
    notice=engine.lastCode ? messages[engine.lastCode] ?? engine.lastCode : null;
    const requirements = engine.view.requirements;
    if (requirements && requirements.locationId !== locationId) {
      locationId = requirements.locationId;
      conversation = [];
    }
    if (requirements && ["REQUIREMENT_CONFLICT", "STAFF_REVIEW_REQUIRED"].includes(engine.lastCode ?? ""))notice=requirements.decision?.message ?? (requirements.message !== previousRequirementMessage ? requirements.message : null) ?? notice;
    if (requirements?.meal && engine.lastCode === "QUANTITY_LIMIT")notice="Build my meal supports one item per selected component. Leave meal mode to order additional quantities.";
    if(engine.lastCode === "OFF_MENU" && locationId !== "demo")notice=menu.itemsForLocation(locationId).length
      ? `That item isn't in ${menu.locationName(locationId)}'s published menu. Choose an item shown below.`
      : `We don't have verified item prices for ${menu.locationName(locationId)}. Choose another location to order.`;
    if(engine.lastCode === "UNSUPPORTED" && locationId !== "demo" && parser === "rules")notice="Local rules accept one exact menu item and quantity at a time, remove, quantity edits and undo. Use the menu buttons or enable Gemini for other wording.";
    if(engine.lastCode==="AMBIGUOUS_REFERENCE"&&engine.lastOutcome==="rejected")notice="Select a cart row or split the request into one edit at a time.";
  };
  function startInput() {
    if (getView(engine).phase==="committed") { notice=messages.SESSION_COMMITTED;publish();return; }
    cancel();assistant=null;parser="none";capture=true;dispatch({type:"INPUT_STARTED"});publish();
  }
  function endInput() {
    const wasCapture = capture;
    capture=false;
    if (wasCapture && !active && engine.requirementsContinuation)dispatch({type:"UI",action:{type:"RESUME_REQUIREMENTS_DECISION"}});
    publish();
  }
  async function submit(text:string,source:ParseRequest["source"],asrConfidence:number|null) {
    if (getView(engine).phase==="committed") {notice=messages.SESSION_COMMITTED;publish();return;}
    if(active && active.request.text === text.trim() && active.request.source === source)return;
    cancel();assistant=null;parser="none";capture=false;dispatch({type:"INPUT_STARTED"});
    const state=getView(engine);
    const context={lines:state.lines,lastLineId:state.lastLineId,pending:state.pending ?? engine.continuation?.pending ?? null,recent:structuredClone(conversation),
      ...(state.requirements ? {requirements:{...state.requirements, decision:state.requirements.decision ?? engine.requirementsContinuation ?? null}} : {})};
    const candidate=ParseRequestSchema.safeParse({v:API_VERSION,menuVersion,requestId:`r${++counter}`,baseRevision:state.revision,text:text.trim(),source,asrConfidence,context,locationId,...(language!=="en-US"?{language}:{})});
    if (!candidate.success) {notice=messages.INVALID_SCHEMA;publish();return;}
    remember("user", candidate.data.text);
    const before=state;
    const ticket:Ticket={abort:new AbortController(),request:candidate.data,session:state.sessionId};
    active=ticket;publish();
    try {
      const raw=await parse(ticket.request,{localOnly,signal:ticket.abort.signal,catalog});
      // Cancellation is checked before validation and never triggers a fallback here.
      if(active!==ticket||ticket.abort.signal.aborted||getView(engine).sessionId!==ticket.session)return;
      const checked=ParseResponseSchema.safeParse(raw);
      if(!checked.success){notice=messages.INVALID_SCHEMA;return;}
      const response=checked.data;
      if(response.requestId!==ticket.request.requestId||response.baseRevision!==ticket.request.baseRevision||response.menuVersion!==menuVersion){notice=messages.STALE_RESPONSE;return;}
      if (response.result.kind === "requirements" && response.result.locationId !== ticket.request.locationId) {notice=messages.INVALID_SCHEMA;return;}
      parser=response.parser;
      dispatch({type:"PARSE_RECEIVED",response});
      if(engine.lastOutcome === "clarify") {
        answer(getView(engine).requirements?.decision?.message ?? getView(engine).requirements?.message ?? getView(engine).pending?.question ?? "Which item did you mean?");
      } else if(engine.lastOutcome === "applied") {
        const notices=response.result.kind === "proposal" ? response.result.notices ?? [] : [];
        answer(localReply(before, getView(engine), notices, language, menu));
      } else {
        if(engine.lastOutcome === "rejected" && response.result.kind === "reject" && response.result.code === "INVALID_MODIFIER") {
          const options=response.result.notices?.filter(item=>item.kind === "unavailable_option") ?? [];
          if(options.length)notice=`${describeNotices(options, menu)} Your cart was not changed.`;
        }
        if(language!=="en-US" && response.result.kind==="reject")notice=response.result.message;
        answer(translate(notice ?? "I couldn't apply that request. Your cart was not changed.",language));
      }
      if(response.fallbackReason) {
        notice=language==="en-US" ? `Using local rules (${response.fallbackReason}). Try a simple item or use the menu.` : translate("Local rules understand simple English orders. Use the menu buttons offline.",language);
      }
    } catch(error) {
      if(active===ticket&&!ticket.abort.signal.aborted) {
        notice=error instanceof Error && error.name==="AbortError" ? null : "Understanding is unavailable. Choose Local only for simple typed orders, or use the menu.";
        if(notice)answer(notice);
      }
    } finally {
      if(active===ticket){active=null;publish();}
    }
  }
  function act(action:UiAction) {
    if(action.type === "DECIDE_REQUIREMENTS" && (capture || active)) {
      notice=messages.STALE_DECISION;publish();return;
    }
    if(action.type === "ACCEPT_SWAP" && (capture || active)) {
      notice=messages.STALE_OFFER;publish();return;
    }
    if((action.type==="REVIEW"||action.type==="CONFIRM")&&(capture||active)){
      notice="Finish or cancel the current input before reviewing or confirming.";publish();return;
    }
    // A menu edit cancels parsing; an existing microphone/text draft remains
    // active until its owner explicitly ends or submits it.
    if(action.type!=="REVIEW"&&action.type!=="CONFIRM")cancel();
    const before=getView(engine);
    dispatch({type:"UI",action});
    if(engine.lastOutcome === "clarify")answer(getView(engine).requirements?.decision?.message ?? getView(engine).requirements?.message ?? getView(engine).pending?.question ?? "Which item did you mean?");
    else if(engine.lastOutcome === "applied" && action.type === "DECLINE_SWAP")answer("Keeping your current item. Is there anything else I can get you?");
    else if(engine.lastOutcome === "applied" && action.type !== "REVIEW" && action.type !== "CONFIRM") {
      // Wait recommendations stay out of the model's conversation context.
      // Only the accepted food/vendor change is remembered.
      if(action.type === "ACCEPT_SWAP" && before.swapOffer)locationId=before.swapOffer.alternative.vendorId;
      answer(localReply(before,getView(engine),[],language,menu));
    }
    else if(engine.lastOutcome === "rejected" && notice)answer(notice);
    publish();
  }
  function setLocalOnly(value:boolean) {
    if(localOnly===value)return;
    localOnly=value;cancel();
    if(getView(engine).phase!=="committed")dispatch({type:"INPUT_STARTED"});
    notice=value?"Local rules selected. Typed ordering works without internet.":"Parser connection enabled. Local rules remain available if the server is unavailable.";
    publish();
  }
  function reset() {
    cancel();capture=false;engine=createEngine(makeSession(), engineOptions);parser="none";notice=null;assistant=null;conversation=[];
    run=newRun();schedulePersist();publish();
  }
  function setLanguage(value: Language) {
    const checked=LanguageSchema.safeParse(value);
    if(!checked.success || checked.data===language)return;
    cancel(); capture=false; assistant=null; conversation=[]; language=checked.data;
    if(getView(engine).phase!=="committed")dispatch({type:"INPUT_STARTED",discardContinuation:true});
    notice=translate("Language changed. Review your order again before confirming.",language);publish();
  }
  function setLocation(value: LocationId) {
    if(value === locationId)return;
    if(getView(engine).phase === "committed"){notice=messages.SESSION_COMMITTED;publish();return;}
    const checked=LocationIdSchema.safeParse(value);
    if(!checked.success||!menu.location(checked.data)){notice=messages.INVALID_SCHEMA;publish();return;}
    if(deps.allowedLocationIds && !deps.allowedLocationIds.includes(checked.data)) {
      cancel();capture=false;assistant=null;dispatch({type:"INPUT_STARTED",discardContinuation:true});
      notice="That restaurant is not in this kiosk's selected campus menu.";publish();return;
    }
    if (getView(engine).requirements) {
      cancel();capture=false;assistant=null;parser="none";
      dispatch({type:"UI",action:{type:"REQUIREMENTS",locationId,changes:[{type:"SWITCH_LOCATION",locationId:checked.data}]}});
      const next = getView(engine);
      answer(next.requirements?.decision?.message ?? next.requirements?.message ?? notice ?? `Ordering from ${menu.locationName(locationId)}.`);
      publish();return;
    }
    cancel();capture=false;locationId=checked.data;parser="none";assistant=null;conversation=[];
    dispatch({type:"INPUT_STARTED",discardContinuation:true});
    notice=`Ordering from ${menu.locationName(locationId)}. Items already in your cart are kept.`;
    publish();
  }
  schedulePersist();
  publish();
  return {
    getSnapshot:()=>snapshot,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},
    dispose:()=>{cancel();capture=false;},
  };
}


function joinWords(parts: string[]): string {
  if(parts.length < 2)return parts[0] ?? "";
  return `${parts.slice(0,-1).join(", ")} and ${parts.at(-1)}`;
}

function describeLine(line: Line, menu: CatalogIndex): string {
  const options=line.modifiers.map(modifier=>(menu.modifier(modifier)?.label ?? modifier).toLowerCase());
  return `${line.qty} ${menu.fullItemLabel(line.itemId).toLowerCase()}${options.length ? ` (${options.join(", ")})` : ""}${line.note ? ` with the special request “${line.note}”` : ""}`;
}

/** Only accepted engine snapshots can generate claims about cart changes. */
export function describeChanges(before: OrderView, after: OrderView, notices: OrderNotice[], menu: CatalogIndex): string {
  const added=after.lines.filter(line=>!before.lines.some(old=>old.lineId===line.lineId));
  const removed=before.lines.filter(line=>!after.lines.some(next=>next.lineId===line.lineId));
  const changed=after.lines.filter(line=>{
    const old=before.lines.find(old=>old.lineId===line.lineId);
    return old && (old.itemId!==line.itemId || old.qty!==line.qty || [...old.modifiers].sort().join()!==[...line.modifiers].sort().join() || old.note!==line.note);
  });
  const parts:string[]=[];
  const describe=(line: Line)=>describeLine(line, menu);
  if(added.length)parts.push(`I added ${joinWords(added.map(describe))}.`);
  if(removed.length)parts.push(`I removed ${joinWords(removed.map(describe))}.`);
  if(changed.length)parts.push(`Updated to ${joinWords(changed.map(describe))}.`);
  const clearedNotes=changed.filter(line=>!line.note && before.lines.find(old=>old.lineId===line.lineId)?.note);
  if(clearedNotes.length)parts.push(`Removed the special request from ${joinWords(clearedNotes.map(line=>menu.fullItemLabel(line.itemId).toLowerCase()))}.`);
  if([...added,...changed].some(line=>line.note))parts.push("Special requests and any extra charge need counter confirmation.");
  if(!parts.length)parts.push("Your order is already set that way.");
  if(notices.length)parts.push(describeNotices(notices, menu));
  parts.push("Is there anything else I can get you?");
  return parts.join(" ");
}

function describeNotices(notices: OrderNotice[], menu: CatalogIndex): string {
  return notices.map(notice=>{
    if(notice.kind === "unavailable")return `We don't sell ${notice.item}.`;
    const item=menu.item(notice.itemId);
    return `We can't add ${notice.option} to ${(item?.label ?? notice.itemId).toLowerCase()}; that option isn't on our ${item?.locationId === "demo" ? "demo" : "published"} menu.`;
  }).join(" ");
}


/** All budgets, conflicts and compatibility explanations come from the deterministic state. */
function requirementReply(before: OrderView, after: OrderView, notices: OrderNotice[], menu: CatalogIndex): string {
  const requirements = after.requirements;
  if (!requirements)return describeChanges(before, after, notices, menu);
  if (requirements.decision)return requirements.decision.message;
  const changed = JSON.stringify(before.lines) !== JSON.stringify(after.lines);
  if (!changed && requirements.message)return requirements.message;
  const edits = describeChanges(before, after, notices, menu).replace(/ Is there anything else I can get you\?$/, "");
  return [edits, requirements.message].filter(Boolean).join(" ");
}

function localReply(before: OrderView, after: OrderView, notices: OrderNotice[], language: Language, menu: CatalogIndex): string {
  if(language==="en-US")return requirementReply(before,after,notices,menu);
  const format=(line:Line)=>`${line.qty} × ${translate(menu.fullItemLabel(line.itemId),language)}${line.modifiers.length?` (${line.modifiers.map(mod=>translate(menu.modifier(mod)?.label ?? mod,language)).join(", ")})`:""}${line.note?` — ${translate("Special request:",language)} ${line.note}`:""}`;
  const added=after.lines.filter(line=>!before.lines.some(old=>old.lineId===line.lineId));
  const changed=after.lines.filter(line=>before.lines.some(old=>old.lineId===line.lineId&&JSON.stringify(old)!==JSON.stringify(line)));
  const removed=before.lines.filter(line=>!after.lines.some(next=>next.lineId===line.lineId));
  const parts=([["Added",added],["Updated",changed],["Removed",removed]] as const).filter(([,lines])=>lines.length).map(([label,lines])=>`${translate(label,language)}: ${lines.map(format).join("; ")}.`);
  if(!parts.length)parts.push(translate("Order updated.",language));
  if(notices.length)parts.push(describeNotices(notices,menu));
  if(after.requirements?.message)parts.push(translate("Please check the details below.",language),after.requirements.message);
  return parts.join(" ");
}
