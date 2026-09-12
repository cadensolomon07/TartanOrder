"use client";
// BOOTSTRAP STUB — B owns this component after starter handoff.
import { useState } from "react";
import { type OrderController, type ItemId } from "@/contracts";
import { MENU, MODIFIERS } from "@/contracts/menu";
const money = (cents:number) => `$${(cents/100).toFixed(2)}`;
export function Kiosk({controller:c}:{controller:OrderController}) {
  const [text,setText] = useState("");
  const [local,setLocal] = useState(true);
  const s = c.state;
  return <main>
    <div className="eyebrow">HackCMU 2026 / TartanOrder</div>
    <h1>Your order.<br/>Your final say.</h1>
    <p>TartanOrder Demo Counter · Seeded menu · No real purchase.</p>
    <div className="grid"><section>
      <div className="panel"><h2>What sounds good?</h2><p className="muted">Illustrative prices. Add separate items, make edits, then review before confirming.</p>
        {(Object.keys(MENU) as ItemId[]).map(id=><div className="row" key={id}><span>{MENU[id].label} · {money(MENU[id].priceCents)}</span><button disabled={s.phase==="committed"} onClick={()=>c.act({type:"MANUAL",ops:[{type:"ADD",itemId:id,qty:1,modifiers:[]}]})}>Add {MENU[id].label}</button></div>)}
      </div>
      <div className="panel"><h2>Tell us your order</h2><p className="muted">Starter uses local rules. Voice and the full parser are teammate handoffs.</p>
        <form onSubmit={e=>{e.preventDefault();void c.submit(text,"text",null);setText("");}}>
          <input aria-label="Your order" maxLength={500} placeholder="a burger, fries and lemonade" value={text} disabled={s.phase==="committed"} onChange={e=>{if (!text || s.review) c.startInput();setText(e.target.value);if(!e.target.value)c.endInput();}}/>
          <button className="primary" disabled={!text.trim()||s.phase==="committed"}>Apply</button>
        </form>
        <div className="row"><button onClick={()=>{setText("");c.endInput();}}>Cancel input</button><label><input type="checkbox" checked={local} onChange={e=>{setLocal(e.target.checked);c.setLocalOnly(e.target.checked);}}/> Local only</label></div>
        {c.busy && <p role="status">Input in progress…</p>}
        {c.notice && <p className="notice" role="status">{c.notice}</p>}
      </div>
    </section><section className="panel"><div className="row"><h2>{s.receipt ? "Simulated receipt" : s.review ? "Review your order" : "Your cart"}</h2><span className="eyebrow">{s.phase}</span></div>
      {s.lines.length===0 && <p className="muted">Start with something from the menu.</p>}
      {(s.review?.lines ?? s.lines).map(line=><div className="row" key={line.lineId}><div><strong>{line.qty} × {MENU[line.itemId].label}</strong><div className="muted">{line.modifiers.map(id=>MODIFIERS[id].label).join(", ") || "No modifiers"}</div></div>{s.phase!=="committed"&&<button onClick={()=>c.act({type:"MANUAL",ops:[{type:"REMOVE",ref:{by:"line",lineId:line.lineId}}]})}>Remove {MENU[line.itemId].label}</button>}</div>)}
      <div className="row total"><span>Total</span><span>{money(s.review?.totalCents ?? s.totalCents)}</span></div>
      {s.pending && <div className="notice"><p>{s.pending.question}</p>{s.pending.choices.map(choice=><button key={choice.id} onClick={()=>c.act({type:"CHOOSE",pendingId:s.pending!.id,choiceId:choice.id})}>{choice.label}</button>)}</div>}
      <div className="row"><button disabled={s.phase==="committed"} onClick={()=>c.act({type:"UNDO"})}>Undo</button><button disabled={s.phase==="committed"} onClick={()=>c.act({type:"CLEAR"})}>Clear</button><button className="primary" disabled={c.busy||!s.lines.length||!!s.pending||s.phase==="committed"} onClick={()=>c.act({type:"REVIEW"})}>Review order</button></div>
      {s.review&&s.phase==="reviewing"&&<><p>Check every item, quantity, modifier and total above.</p><button className="primary" disabled={c.busy} onClick={()=>c.act({type:"CONFIRM",reviewId:s.review!.id,revision:s.review!.revision})}>Confirm simulated order</button></>}
      {s.receipt&&<p role="status">Confirmed · {s.receipt.id}<br/>Simulated only. Nothing was purchased or sent to a kitchen.</p>}
      <button onClick={()=>{c.reset();setText("");}}>New order</button>
    </section></div>
    <details className="panel"><summary>Engineering panel</summary><p>Parser: {c.parser} · Revision: {s.revision} · Input: text</p><p>ASR confidence: not available for typed input.</p><button onClick={()=>{const url=URL.createObjectURL(new Blob([c.exportLog()],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="tartanorder-audit.json";a.click();URL.revokeObjectURL(url);}}>Export audit</button><pre>{JSON.stringify(s.audit,null,2)}</pre></details>
  </main>;
}
