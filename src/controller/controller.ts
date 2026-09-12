import { API_VERSION, MENU_VERSION, ParseRequestSchema, ParseResponseSchema, type OrderController, type ParseRequest, type InterpretOptions, type ParseResponse, type UiAction } from "@/contracts";
import { createEngine, reduceEngine, getView, exportLog } from "@/core/engine";
import { interpret } from "@/parser/client";

type Dependencies = {
  interpret?: (request:ParseRequest, options:InterpretOptions)=>Promise<ParseResponse>;
  sessionId?: ()=>string;
};
const messages:Record<string,string> = {
  INVALID_SCHEMA:"That edit did not match the order format. Your cart was not changed.",
  INVALID_MODIFIER:"That modifier is available for burgers only.",
  QUANTITY_LIMIT:"Choose a quantity from 1 to 5.",
  CART_LIMIT:"An order can hold 5 lines and 10 total items.",
  UNKNOWN_REFERENCE:"That item is not in your cart. Select a cart row or add it first.",
  AMBIGUOUS_REFERENCE:"Choose the cart item you meant.",
  STALE_RESPONSE:"An outdated response was ignored.",
  REVIEW_REQUIRED:"Review the current order before confirming it.",
  EMPTY_CART:"Add something to your cart first.",
  NO_UNDO:"There are no earlier cart edits to restore.",
  NO_PENDING:"That choice is no longer active.",
  SESSION_COMMITTED:"This simulated order is complete. Start a new order to edit.",
  UNSUPPORTED:"Try a menu item or a simple edit.",
};

/** Request lifecycle stays here; the engine never performs I/O. */
export function createOrderController(deps:Dependencies = {}) {
  const makeSession = deps.sessionId ?? (()=>crypto.randomUUID());
  const parse = deps.interpret ?? interpret;
  let engine = createEngine(makeSession());
  let capture = false;
  let localOnly = true;
  let parser:OrderController["parser"] = "none";
  let notice:string|null = null;
  let counter = 0;
  type Ticket = { abort:AbortController; request:ParseRequest; session:string };
  let active:Ticket|null = null;
  const listeners = new Set<()=>void>();
  let snapshot:OrderController;
  const cancel = ()=>{ const old=active; active=null; old?.abort.abort(); };
  const publish = ()=>{
    snapshot = {state:getView(engine),busy:capture||active!==null,parser,notice,startInput,endInput,submit,act,setLocalOnly,reset,exportLog:()=>exportLog(engine)};
    for (const listener of listeners) listener();
  };
  const dispatch = (event:Parameters<typeof reduceEngine>[1])=>{
    engine=reduceEngine(engine,event);
    notice=engine.lastCode ? messages[engine.lastCode] ?? engine.lastCode : null;
  };
  function startInput() {
    if (getView(engine).phase==="committed") { notice=messages.SESSION_COMMITTED;publish();return; }
    cancel();capture=true;dispatch({type:"INPUT_STARTED"});publish();
  }
  function endInput() { capture=false;publish(); }
  async function submit(text:string,source:ParseRequest["source"],asrConfidence:number|null) {
    if (getView(engine).phase==="committed") {notice=messages.SESSION_COMMITTED;publish();return;}
    cancel();capture=false;dispatch({type:"INPUT_STARTED"});
    const state=getView(engine);
    const candidate=ParseRequestSchema.safeParse({v:API_VERSION,menuVersion:MENU_VERSION,requestId:`r${++counter}`,baseRevision:state.revision,text:text.trim(),source,asrConfidence});
    if (!candidate.success) {notice=messages.INVALID_SCHEMA;publish();return;}
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
      if(response.result.kind==="reject")notice=response.result.message;
      else if(response.fallbackReason&&!notice)notice=`Using local rules (${response.fallbackReason}).`;
    } catch(error) {
      if(active===ticket&&!ticket.abort.signal.aborted)notice=error instanceof Error && error.name==="AbortError" ? null : "Parsing is unavailable. Try Local only or use the menu buttons.";
    } finally {
      if(active===ticket){active=null;publish();}
    }
  }
  function act(action:UiAction) {
    if((action.type==="REVIEW"||action.type==="CONFIRM")&&(capture||active)){
      notice="Finish or cancel the current input before reviewing or confirming.";publish();return;
    }
    if(action.type!=="REVIEW"&&action.type!=="CONFIRM"){cancel();capture=false;}
    dispatch({type:"UI",action});publish();
  }
  function setLocalOnly(value:boolean) {
    if(localOnly===value)return;
    localOnly=value;cancel();capture=false;
    if(getView(engine).phase!=="committed")dispatch({type:"INPUT_STARTED"});
    notice=value?"Local rules selected. Typed ordering works without internet.":"Parser connection enabled; availability depends on the parser handoff.";
    publish();
  }
  function reset() {
    cancel();capture=false;engine=createEngine(makeSession());parser="none";notice=null;publish();
  }
  publish();
  return {
    getSnapshot:()=>snapshot,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},
    dispose:()=>{cancel();capture=false;},
  };
}
