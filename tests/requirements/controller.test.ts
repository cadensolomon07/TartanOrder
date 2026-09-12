import { describe, expect, it } from 'vitest';
import { API_VERSION, type ParseRequest, type ParseResponse, type RequirementChange } from '@/contracts';
import { CATALOG, MENU, MENU_VERSION } from '../helpers/catalog';
import { createOrderController } from '@/controller/controller';
import { replayLog } from '@/core/engine';

const setup = (interpret?: (req: ParseRequest) => Promise<ParseResponse>) => createOrderController({catalog:CATALOG,sessionId:()=> 'requirements-controller',locationId:'demo',allowedLocationIds:MENU.publicLocationIds, ...(interpret ? {interpret} : {})});
function deferred<T>() { let resolve!: (value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve}; }
const changes=(store:ReturnType<typeof setup>, values:RequirementChange[])=>store.getSnapshot().act({type:'REQUIREMENTS',locationId:store.getSnapshot().locationId,changes:values});
const meal=(store:ReturnType<typeof setup>)=>changes(store,[{type:'SET_BUDGET',budgetCents:1200},{type:'SELECT_ITEM',itemId:'fries',modifiers:[],locked:true},{type:'SELECT_ITEM',itemId:'lemonade',modifiers:[],locked:true}]);
const response=(req:ParseRequest,result:ParseResponse['result']):ParseResponse=>({v:API_VERSION,menuVersion:MENU_VERSION,requestId:req.requestId,baseRevision:req.baseRevision,parser:'fixture',fallbackReason:null,result});

describe('requirement controller lifecycle',()=>{
 it('passes accepted profile/meal and calculated pending choices into the bounded parser context',async()=>{
  let seen:ParseRequest|undefined;
  const store=setup(async req=>{seen=req;return response(req,{kind:'reject',code:'UNSUPPORTED',message:'Fixture capture only.'});});
  meal(store);expect(store.getSnapshot().state.totalCents).toBe(1200);
  changes(store,[{type:'SELECT_ITEM',itemId:'chicken_sandwich',modifiers:[],locked:false}]);
  const pending=store.getSnapshot().state.requirements?.decision;expect(pending?.minimumCents).toBe(1400);
  await store.getSnapshot().submit('keep my current meal','text',null);
  expect(seen?.context?.requirements?.meal?.budgetCents).toBe(1200);
  expect(seen?.context?.requirements?.decision?.id).toBe(pending?.id);
  expect(store.getSnapshot().state.totalCents).toBe(1200);store.dispose();
 });
 it('cancels a late ordinary addition when a dietary requirement is declared',async()=>{
  const delayed=deferred<ParseResponse>();let req!:ParseRequest;
  const store=setup(async request=>{req=request;return delayed.promise;});
  const task=store.getSnapshot().submit('a burger','text',null);
  changes(store,[{type:'SET_DIETARY',preference:'vegan'}]);
  delayed.resolve(response(req,{kind:'proposal',ops:[{type:'ADD',itemId:'burger',qty:1,modifiers:[]}]}));await task;
  expect(store.getSnapshot().state.lines).toEqual([]);expect(store.getSnapshot().state.requirements?.profile.preference).toBe('vegan');
  expect(store.getSnapshot().busy).toBe(false);store.dispose();
 });
 it('rejects the previous decision after new input begins',()=>{
  const store=setup();meal(store);changes(store,[{type:'SELECT_ITEM',itemId:'chicken_sandwich',modifiers:[],locked:false}]);
  const decision=store.getSnapshot().state.requirements!.decision!;
  const raise=decision.choices.find(choice=>choice.id==='raise_budget')!;expect(raise).toBeDefined();
  store.getSnapshot().startInput();
  store.getSnapshot().act({type:'DECIDE_REQUIREMENTS',pendingId:decision.id,revision:decision.revision,choiceId:raise.id});
  expect(store.getSnapshot().state.requirements?.meal?.budgetCents).toBe(1200);expect(store.getSnapshot().state.totalCents).toBe(1200);
  store.getSnapshot().endInput();store.dispose();
 });
 it('reissues a fresh decision after an abandoned draft without reviving stale buttons',()=>{
  const store=setup();meal(store);changes(store,[{type:'SELECT_ITEM',itemId:'chicken_sandwich',modifiers:[],locked:false}]);
  const old=store.getSnapshot().state.requirements!.decision!;
  store.getSnapshot().startInput();store.getSnapshot().endInput();
  const current=store.getSnapshot().state.requirements!.decision!;
  expect(current).toBeDefined();expect(current.id).not.toBe(old.id);expect(current.revision).toBeGreaterThan(old.revision);
  store.getSnapshot().act({type:'DECIDE_REQUIREMENTS',pendingId:old.id,revision:old.revision,choiceId:'raise_budget'});
  expect(store.getSnapshot().state.totalCents).toBe(1200);
  store.getSnapshot().act({type:'DECIDE_REQUIREMENTS',pendingId:current.id,revision:current.revision,choiceId:'raise_budget'});
  expect(store.getSnapshot().state.totalCents).toBe(1400);expect(replayLog(store.getSnapshot().exportLog(), CATALOG)).toEqual(store.getSnapshot().state);store.dispose();
 });
 it('accepts a spoken choice through the original pending decision without authorizing arbitrary totals',async()=>{
  const store=setup(async req=>response(req,{kind:'decide_requirements',pendingId:req.context!.requirements!.decision!.id,choiceId:'raise_budget'}));
  meal(store);changes(store,[{type:'SELECT_ITEM',itemId:'chicken_sandwich',modifiers:[],locked:false}]);
  await store.getSnapshot().submit('Yes, increase it to fourteen dollars','voice',null);
  expect(store.getSnapshot().state.requirements?.meal?.budgetCents).toBe(1400);expect(store.getSnapshot().state.totalCents).toBe(1400);
  expect(store.getSnapshot().parser).toBe('fixture');expect(replayLog(store.getSnapshot().exportLog(), CATALOG)).toEqual(store.getSnapshot().state);store.dispose();
 });
 it('keeps the selected counter until the explicit switch decision is accepted',()=>{
  const store=setup();meal(store);changes(store,[{type:'ADD_ALLERGY',allergen:'sesame'}]);
  store.getSnapshot().setLocation('188');expect(store.getSnapshot().locationId).toBe('demo');
  const decision=store.getSnapshot().state.requirements!.decision!;
  expect(decision.kind).toBe('switch_counter');
  store.getSnapshot().act({type:'DECIDE_REQUIREMENTS',pendingId:decision.id,revision:decision.revision,choiceId:'switch_counter'});
  expect(store.getSnapshot().locationId).toBe('188');expect(store.getSnapshot().state.requirements?.meal).toBeNull();expect(store.getSnapshot().state.requirements?.profile.allergies).toContain('sesame');
  store.getSnapshot().reset();expect(store.getSnapshot().state.requirements).toBeUndefined();store.dispose();
 });
 it('does not reuse a previous success message when the parser rejects a requirement change',async()=>{
  const store=setup(async req=>response(req,{kind:'reject',code:'REQUIREMENT_CONFLICT',message:'Synthetic rejected requirement.'}));
  meal(store);await store.getSnapshot().submit('a conflicting requirement','text',null);
  expect(store.getSnapshot().notice).toContain('conflicts');expect(store.getSnapshot().assistant?.text).not.toContain('Your meal includes');expect(store.getSnapshot().state.totalCents).toBe(1200);store.dispose();
 });
 it('new order cancels a late profile declaration and clears the previous conversation',async()=>{
  const delayed=deferred<ParseResponse>();let req!:ParseRequest;let followup:ParseRequest|undefined;let calls=0;
  const store=setup(async request=>{if(++calls===1){req=request;return delayed.promise;}followup=request;return response(request,{kind:'reject',code:'UNSUPPORTED',message:'Fixture capture.'});});
  const task=store.getSnapshot().submit('I have a peanut allergy','text',null);store.getSnapshot().reset();
  delayed.resolve(response(req,{kind:'requirements',locationId:'demo',changes:[{type:'ADD_ALLERGY',allergen:'peanut'}]}));await task;
  expect(store.getSnapshot().state.requirements).toBeUndefined();
  await store.getSnapshot().submit('hello','text',null);expect(followup?.context?.recent).toEqual([]);store.dispose();
 });
});
