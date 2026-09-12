import { API_VERSION, MENU_VERSION, ParseRequestSchema, ParseResponseSchema, LocationIdSchema, type LocationId, type OrderController, type ParseRequest, type InterpretOptions, type ParseResponse, type UiAction, type ConversationTurn, type OrderView, type Line, type OrderNotice } from "@/contracts";
import { createEngine, reduceEngine, getView, exportLog } from "@/core/engine";
import { interpret } from "@/parser/client";
import { MENU, MODIFIERS, fullItemLabel, locationName, itemsForLocation } from "@/contracts/menu";
import type { WaitEngineConfig } from "@/contracts";

type Dependencies = {
  interpret?: (request:ParseRequest, options:InterpretOptions)=>Promise<ParseResponse>;
  sessionId?: ()=>string;
  locationId?: LocationId;
  waitConfig?: WaitEngineConfig;
  allowedLocationIds?: readonly LocationId[];
};
const messages:Record<string,string> = {
  INVALID_SCHEMA:"That edit did not match the order format. Your cart was not changed.",
  INVALID_MODIFIER:"That option is not available for that item. Your cart was not changed.",
  QUANTITY_LIMIT:"Choose a quantity from 1 to 5.",
  CART_LIMIT:"An order can hold 5 lines and 10 total items.",
  UNKNOWN_REFERENCE:"That item is not in your cart. Select a cart row or add it first.",
  AMBIGUOUS_REFERENCE:"Choose the cart item you meant.",
  STALE_RESPONSE:"An outdated response was ignored.",
  STALE_OFFER:"That alternative is no longer active. Your cart was not changed.",
  REVIEW_REQUIRED:"Review the current order before confirming it.",
  EMPTY_CART:"Add something to your cart first.",
  NO_UNDO:"There are no earlier cart edits to restore.",
  NO_PENDING:"That choice is no longer active.",
  SESSION_COMMITTED:"This simulated order is complete. Start a new order to edit.",
  UNSUPPORTED:"Try a menu item or a simple edit.",
  OFF_MENU:"That item isn't on our demo menu. What would you like from the menu instead?",
};

/** Request lifecycle stays here; the engine never performs I/O. */
export function createOrderController(deps:Dependencies = {}) {
  const makeSession = deps.sessionId ?? (()=>crypto.randomUUID());
  const parse = deps.interpret ?? interpret;
  let engine = createEngine(makeSession(), deps.waitConfig, deps.allowedLocationIds);
  let capture = false;
  let localOnly = false;
  let locationId = LocationIdSchema.parse(deps.locationId ?? "demo");
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
    snapshot = {state:getView(engine),busy:capture||active!==null,parser,notice,assistant,localOnly,locationId,startInput,endInput,submit,act,setLocalOnly,setLocation,reset,exportLog:()=>exportLog(engine)};
    for (const listener of listeners) listener();
  };
  const dispatch = (event:Parameters<typeof reduceEngine>[1])=>{
    engine=reduceEngine(engine,event);
    notice=engine.lastCode ? messages[engine.lastCode] ?? engine.lastCode : null;
    if(engine.lastCode === "OFF_MENU" && locationId !== "demo")notice=itemsForLocation(locationId).length
      ? `That item isn't in ${locationName(locationId)}'s published menu. Choose an item shown below.`
      : `We don't have verified item prices for ${locationName(locationId)}. Choose another location to order.`;
    if(engine.lastCode === "UNSUPPORTED" && locationId !== "demo" && parser === "rules")notice="Local rules accept one exact menu item and quantity at a time, remove, quantity edits and undo. Use the menu buttons or enable Gemini for other wording.";
    if(engine.lastCode==="AMBIGUOUS_REFERENCE"&&engine.lastOutcome==="rejected")notice="Select a cart row or split the request into one edit at a time.";
  };
  function startInput() {
    if (getView(engine).phase==="committed") { notice=messages.SESSION_COMMITTED;publish();return; }
    cancel();assistant=null;parser="none";capture=true;dispatch({type:"INPUT_STARTED"});publish();
  }
  function endInput() { capture=false;publish(); }
  async function submit(text:string,source:ParseRequest["source"],asrConfidence:number|null) {
    if (getView(engine).phase==="committed") {notice=messages.SESSION_COMMITTED;publish();return;}
    if(active && active.request.text === text.trim() && active.request.source === source)return;
    cancel();assistant=null;parser="none";capture=false;dispatch({type:"INPUT_STARTED"});
    const state=getView(engine);
    const context={lines:state.lines,lastLineId:state.lastLineId,pending:state.pending ?? engine.continuation?.pending ?? null,recent:structuredClone(conversation)};
    const candidate=ParseRequestSchema.safeParse({v:API_VERSION,menuVersion:MENU_VERSION,requestId:`r${++counter}`,baseRevision:state.revision,text:text.trim(),source,asrConfidence,context,locationId});
    if (!candidate.success) {notice=messages.INVALID_SCHEMA;publish();return;}
    remember("user", candidate.data.text);
    const before=state;
    const ticket:Ticket={abort:new AbortController(),request:candidate.data,session:state.sessionId};
    active=ticket;publish();
    try {
      const raw=await parse(ticket.request,{localOnly,signal:ticket.abort.signal});
      // Cancellation is checked before validation and never triggers a fallback here.
      if(active!==ticket||ticket.abort.signal.aborted||getView(engine).sessionId!==ticket.session)return;
      const checked=ParseResponseSchema.safeParse(raw);
      if(!checked.success){notice=messages.INVALID_SCHEMA;return;}
      const response=checked.data;
      if(response.requestId!==ticket.request.requestId||response.baseRevision!==ticket.request.baseRevision||response.menuVersion!==MENU_VERSION){notice=messages.STALE_RESPONSE;return;}
      parser=response.parser;
      dispatch({type:"PARSE_RECEIVED",response});
      if(engine.lastOutcome === "clarify") {
        answer(getView(engine).pending?.question ?? "Which item did you mean?");
      } else if(engine.lastOutcome === "applied") {
        const notices=response.result.kind === "proposal" ? response.result.notices ?? [] : [];
        answer(describeChanges(before, getView(engine), notices));
      } else {
        if(engine.lastOutcome === "rejected" && response.result.kind === "reject" && response.result.code === "INVALID_MODIFIER") {
          const options=response.result.notices?.filter(item=>item.kind === "unavailable_option") ?? [];
          if(options.length)notice=`${describeNotices(options)} Your cart was not changed.`;
        }
        answer(notice ?? "I couldn't apply that request. Your cart was not changed.");
      }
      if(response.fallbackReason) {
        notice=`Using local rules (${response.fallbackReason}). Try a simple item or use the menu.`;
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
    if(engine.lastOutcome === "clarify")answer(getView(engine).pending?.question ?? "Which item did you mean?");
    else if(engine.lastOutcome === "applied" && action.type === "DECLINE_SWAP")answer("Keeping your current item. Is there anything else I can get you?");
    else if(engine.lastOutcome === "applied" && action.type !== "REVIEW" && action.type !== "CONFIRM") {
      // Wait recommendations stay out of the model's conversation context.
      // Only the accepted food/vendor change is remembered.
      if(action.type === "ACCEPT_SWAP" && before.swapOffer)locationId=before.swapOffer.alternative.vendorId;
      answer(describeChanges(before,getView(engine),[]));
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
    cancel();capture=false;engine=createEngine(makeSession(), deps.waitConfig, deps.allowedLocationIds);parser="none";notice=null;assistant=null;conversation=[];publish();
  }
  function setLocation(value: LocationId) {
    if(value === locationId)return;
    if(getView(engine).phase === "committed"){notice=messages.SESSION_COMMITTED;publish();return;}
    const checked=LocationIdSchema.safeParse(value);
    if(!checked.success){notice=messages.INVALID_SCHEMA;publish();return;}
    if(deps.allowedLocationIds && !deps.allowedLocationIds.includes(checked.data)) {
      cancel();capture=false;assistant=null;dispatch({type:"INPUT_STARTED",discardContinuation:true});
      notice="That restaurant is not in this kiosk's selected campus menu.";publish();return;
    }
    cancel();capture=false;locationId=checked.data;parser="none";assistant=null;conversation=[];
    dispatch({type:"INPUT_STARTED",discardContinuation:true});
    notice=`Ordering from ${locationName(locationId)}. Items already in your cart are kept.`;
    publish();
  }
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

function describeLine(line: Line): string {
  const options=line.modifiers.map(modifier=>MODIFIERS[modifier].label.toLowerCase());
  return `${line.qty} ${fullItemLabel(line.itemId).toLowerCase()}${options.length ? ` (${options.join(", ")})` : ""}`;
}

/** Only accepted engine snapshots can generate claims about cart changes. */
export function describeChanges(before: OrderView, after: OrderView, notices: OrderNotice[]): string {
  const added=after.lines.filter(line=>!before.lines.some(old=>old.lineId===line.lineId));
  const removed=before.lines.filter(line=>!after.lines.some(next=>next.lineId===line.lineId));
  const changed=after.lines.filter(line=>{
    const old=before.lines.find(old=>old.lineId===line.lineId);
    return old && (old.itemId!==line.itemId || old.qty!==line.qty || [...old.modifiers].sort().join()!==[...line.modifiers].sort().join());
  });
  const parts:string[]=[];
  if(added.length)parts.push(`I added ${joinWords(added.map(describeLine))}.`);
  if(removed.length)parts.push(`I removed ${joinWords(removed.map(describeLine))}.`);
  if(changed.length)parts.push(`Updated to ${joinWords(changed.map(describeLine))}.`);
  if(!parts.length)parts.push("Your order is already set that way.");
  if(notices.length)parts.push(describeNotices(notices));
  parts.push("Is there anything else I can get you?");
  return parts.join(" ");
}

function describeNotices(notices: OrderNotice[]): string {
  return notices.map(notice=>notice.kind === "unavailable"
    ? `We don't sell ${notice.item}.`
    : `We can't add ${notice.option} to ${MENU[notice.itemId].label.toLowerCase()}; that option isn't on our ${MENU[notice.itemId].locationId === "demo" ? "demo" : "published"} menu.`
  ).join(" ");
}
