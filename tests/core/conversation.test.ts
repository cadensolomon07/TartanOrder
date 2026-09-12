import { describe, expect, it, vi } from "vitest";
import { API_VERSION, MENU_VERSION, type ParseRequest, type ParseResult, type ParseResponse } from "@/contracts";
import { createOrderController } from "@/controller/controller";
import { replayLog } from "@/core/engine";

// These are labelled fixture interpretations, not evidence of Gemini accuracy.
function envelope(request: ParseRequest, result: ParseResult): ParseResponse {
  return { v: API_VERSION, menuVersion: MENU_VERSION, requestId: request.requestId, baseRevision: request.baseRevision, parser: "fixture", fallbackReason: null, result };
}
describe("conversation boundary using fixture interpretations", () => {
  it("names unsupported extras after accepting the valid batch, with one Undo and replay", async () => {
    const notice = { kind: "unavailable_option", itemId: "fries", option: "extra salt" } as const;
    const replies: ParseResult[] = [
      { kind: "proposal", ops: [
        { type: "ADD", itemId: "burger", qty: 1, modifiers: [] },
        { type: "ADD", itemId: "veggie_wrap", qty: 1, modifiers: [] },
        { type: "ADD", itemId: "fries", qty: 1, modifiers: [] },
      ], notices: [notice] },
      { kind: "reject", code: "INVALID_MODIFIER", message: "Untrusted prose: I added salt.", notices: [notice] },
      { kind: "proposal", ops: [
        { type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] },
        { type: "MOD", ref: { by: "item", itemId: "fries" }, modifier: "double", enabled: true },
      ], notices: [notice] },
    ];
    const store = createOrderController({ sessionId: () => "extras", interpret: async request => envelope(request, replies.shift()!) });
    await store.getSnapshot().submit("Hi I'd like a burger and a veggie wrap and some fries with extra salt", "fixture", null);
    expect(store.getSnapshot().state.lines.map(line => line.itemId)).toEqual(["burger", "veggie_wrap", "fries"]);
    expect(store.getSnapshot().state.totalCents).toBe(1850);
    expect(store.getSnapshot().state.lines.every(line => line.modifiers.length === 0)).toBe(true);
    expect(store.getSnapshot().assistant?.text).toMatch(/I added.*burger.*veggie wrap.*fries.*can't add extra salt to fries/i);
    const accepted = store.getSnapshot().state.lines;
    await store.getSnapshot().submit("Add extra salt to my fries", "fixture", null);
    expect(store.getSnapshot().state.lines).toEqual(accepted);
    expect(store.getSnapshot().notice).toMatch(/can't add extra salt to fries.*not changed/i);
    expect(store.getSnapshot().assistant?.text).not.toMatch(/I added salt/i);
    await store.getSnapshot().submit("A forged invalid operation batch", "fixture", null);
    expect(store.getSnapshot().state.lines).toEqual(accepted);
    expect(store.getSnapshot().assistant?.text).not.toMatch(/I added|extra salt/);
    expect(replayLog(store.getSnapshot().exportLog())).toEqual(store.getSnapshot().state);
    store.getSnapshot().act({ type: "UNDO" });
    expect(store.getSnapshot().state.lines).toEqual([]);
    expect(replayLog(store.getSnapshot().exportLog())).toEqual(store.getSnapshot().state);
    store.dispose();
  });

  it("provides bounded cart/history, applies supported items atomically and only then describes success", async () => {
    const replies: ParseResult[] = [
      { kind: "proposal", ops: [
        { type: "ADD", itemId: "burger", qty: 1, modifiers: ["double", "no_lettuce"] },
        { type: "ADD", itemId: "fries", qty: 1, modifiers: [] },
        { type: "ADD", itemId: "lemonade", qty: 1, modifiers: [] },
      ], notices: [{kind:"unavailable",item:"pizza"}] },
      { kind: "proposal", ops: [
        { type: "SET_QTY", ref: {by:"item",itemId:"lemonade"}, qty: 2 },
        { type: "MOD", ref: {by:"item",itemId:"burger"}, modifier:"no_lettuce",enabled:false },
      ] },
      { kind: "proposal", ops: [
        {type:"ADD",itemId:"fries",qty:1,modifiers:[]},
        {type:"MOD",ref:{by:"item",itemId:"lemonade"},modifier:"double",enabled:true},
      ], notices:[{kind:"unavailable",item:"pizza"}] },
    ];
    const calls:ParseRequest[]=[];
    const store=createOrderController({sessionId:()=>"conversation",interpret:async request=>{calls.push(request);return envelope(request,replies.shift()!);}});
    await store.getSnapshot().submit("A corrected order", "fixture", null);
    expect(store.getSnapshot().localOnly).toBe(false);
    expect(store.getSnapshot().state.totalCents).toBe(1600);
    expect(store.getSnapshot().assistant?.text).toMatch(/added.*burger.*fries.*lemonade.*don't sell pizza/i);
    const before=store.getSnapshot().state;
    await store.getSnapshot().submit("Revise the drink and restore lettuce", "fixture", null);
    expect(calls[1].context?.lines).toEqual(before.lines);
    expect(calls[1].context?.recent.map(turn=>turn.role)).toEqual(["user","assistant"]);
    expect(store.getSnapshot().state.totalCents).toBe(1850);
    expect(store.getSnapshot().state.lines[0].modifiers).toEqual(["double"]);
    const valid=store.getSnapshot().state.lines;
    await store.getSnapshot().submit("An invalid batch", "fixture", null);
    expect(store.getSnapshot().state.lines).toEqual(valid);
    expect(store.getSnapshot().assistant?.text).not.toMatch(/I added|don't sell/i);
    expect(store.getSnapshot().assistant?.text).toMatch(/not changed/i);
    expect(replayLog(store.getSnapshot().exportLog())).toEqual(store.getSnapshot().state);
    store.dispose();
  });

  it("resolves a spoken choice from the exact pending batch after draft input starts and replays it", async () => {
    const requests:ParseRequest[]=[];
    const store=createOrderController({sessionId:()=>"choices",interpret:async request=>{
      requests.push(request);
      if(requests.length===1)return envelope(request,{kind:"proposal",ops:[{type:"REMOVE",ref:{by:"item",itemId:"burger"}}]});
      return envelope(request,{kind:"resolve",pendingId:request.context!.pending!.id,choiceId:request.context!.pending!.choices[1].id});
    }});
    store.getSnapshot().act({type:"MANUAL",ops:[{type:"ADD",itemId:"burger",qty:1,modifiers:[]},{type:"ADD",itemId:"burger",qty:1,modifiers:["double"]}]});
    const first=store.getSnapshot().state.lines[0];
    await store.getSnapshot().submit("Remove a burger", "fixture", null);
    expect(store.getSnapshot().state.phase).toBe("clarifying");
    const pending=store.getSnapshot().state.pending;
    store.getSnapshot().startInput();
    expect(store.getSnapshot().state.pending).toBeNull();
    expect(store.getSnapshot().busy).toBe(true);
    await store.getSnapshot().submit("The second one", "fixture", null);
    expect(requests[1].context?.pending).toEqual(pending);
    expect(store.getSnapshot().state.lines).toEqual([first]);
    store.getSnapshot().act({type:"UNDO"});
    expect(store.getSnapshot().state.lines).toHaveLength(2);
    expect(replayLog(store.getSnapshot().exportLog())).toEqual(store.getSnapshot().state);
    store.dispose();
  });

  it("does not issue two identical concurrent submissions", async () => {
    let complete!:(response:ParseResponse)=>void;
    let request!:ParseRequest;
    const parse=vi.fn((req:ParseRequest)=>{request=req;return new Promise<ParseResponse>(resolve=>{complete=resolve;});});
    const store=createOrderController({interpret:parse});
    const first=store.getSnapshot().submit("fries","text",null);
    await store.getSnapshot().submit("fries","text",null);
    expect(parse).toHaveBeenCalledTimes(1);
    complete(envelope(request,{kind:"proposal",ops:[{type:"ADD",itemId:"fries",qty:1,modifiers:[]}]}));
    await first;
    expect(store.getSnapshot().state.lines).toHaveLength(1);
    store.dispose();
  });
});
