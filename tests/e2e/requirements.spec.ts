import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { API_VERSION, type ParseRequest, type ParseResult } from '../../src/contracts/index';
import { BUNDLED_VERSION_ID as MENU_VERSION } from '../../src/catalog/bundled';

async function fixtureParser(page:Page, result:(req:ParseRequest)=>ParseResult){
 await page.route('**/api/interpret',async route=>{const req=route.request().postDataJSON() as ParseRequest;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({v:API_VERSION,menuVersion:MENU_VERSION,requestId:req.requestId,baseRevision:req.baseRevision,parser:'fixture',fallbackReason:null,result:result(req)})});});
}
async function openDemo(page:Page){await page.goto('/');await page.getByTestId('dining-location').selectOption('demo');await page.getByRole('checkbox',{name:'Read replies aloud'}).uncheck();}
async function submit(page:Page,text:string){await page.getByTestId('text-input').fill(text);await page.getByTestId('submit').click();await expect(page.getByTestId('badge-busy')).toHaveCount(0);}
const exactMeal:ParseResult={kind:'requirements',locationId:'demo',changes:[{type:'SET_BUDGET',budgetCents:1200},{type:'SET_COMPONENTS',components:['mains','sides','drinks']},{type:'SELECT_ITEM',itemId:'fries',modifiers:[],locked:true},{type:'SELECT_ITEM',itemId:'lemonade',modifiers:[],locked:true}]};

test('fixture interpretation: meal, over-budget correction, explicit decision, undo and receipt',async({page})=>{
 await fixtureParser(page,req=>req.text==='meal' ? exactMeal : req.text==='chicken' ? {kind:'requirements',locationId:'demo',changes:[{type:'SELECT_ITEM',itemId:'chicken_sandwich',modifiers:[],locked:false}]} : {kind:'decide_requirements',pendingId:req.context!.requirements!.decision!.id,choiceId:'raise_budget'});
 await openDemo(page);await submit(page,'meal');await expect(page.getByTestId('total')).toHaveText('$12.00');await expect(page.getByTestId('cart')).toContainText('Grilled Cheese');
 await submit(page,'chicken');await expect(page.getByTestId('total')).toHaveText('$12.00');await expect(page.getByTestId('requirements-decision')).toContainText('$14.00');await expect(page.getByTestId('cart')).toContainText('Grilled Cheese');
 await submit(page,'yes increase the budget');await expect(page.getByTestId('total')).toHaveText('$14.00');await expect(page.getByTestId('cart')).toContainText('Chicken Sandwich');
 await page.getByTestId('undo').click();await expect(page.getByTestId('total')).toHaveText('$12.00');await expect(page.getByTestId('requirements-panel')).toContainText('$12.00');
 await page.getByTestId('review').click();await page.getByTestId('confirm').click();await expect(page.getByTestId('ticket')).toContainText('$12.00');
});

test('fixture declarations: a known allergen is blocked and unknown campus evidence stays inspectable',async({page})=>{
 await fixtureParser(page,()=>({kind:'requirements',locationId:'demo',changes:[{type:'ADD_ALLERGY',allergen:'sesame'}],ops:[{type:'ADD',itemId:'burger',qty:1,modifiers:[]}]}));
 await openDemo(page);await submit(page,'I have a sesame allergy, add a burger');await expect(page.getByTestId('total')).toHaveText('$0.00');await expect(page.getByTestId('requirements-panel')).toContainText('sesame');await expect(page.getByTestId('staff-summary')).toBeVisible();
 await page.getByTestId('dining-location').selectOption('188');await expect(page.getByTestId('requirements-panel')).toContainText('sesame');await expect(page.getByTestId('staff-summary')).toContainText(/ingredient|preparation|staff/i);await expect(page.getByTestId('total')).toHaveText('$0.00');
});

test('manual declaration rechecks an existing cart and blocks review',async({page})=>{
 await openDemo(page);await page.getByTestId('menu-grilled_cheese').click();await expect(page.getByTestId('total')).toHaveText('$6.50');
 await page.getByTestId('dietary-preference').selectOption('vegan');await expect(page.getByTestId('total')).toHaveText('$6.50');await expect(page.getByTestId('requirements-panel')).toContainText(/cheese|dairy|vegan/i);
 // A visible cart is preserved; an unresolved conflict cannot create a review.
 if(await page.getByTestId('review').isEnabled())await page.getByTestId('review').click();
 await expect(page.getByTestId('confirm')).toHaveCount(0);
});

test('a current decision button is invalidated by a new text draft',async({page})=>{
 await fixtureParser(page,req=>req.text==='meal'?exactMeal:{kind:'requirements',locationId:'demo',changes:[{type:'SELECT_ITEM',itemId:'chicken_sandwich',modifiers:[],locked:false}]});
 await openDemo(page);await submit(page,'meal');await submit(page,'chicken');await expect(page.getByTestId('requirement-choice-raise_budget')).toBeVisible();
 await page.getByTestId('text-input').fill('new request');await expect(page.getByTestId('requirement-choice-raise_budget')).toHaveCount(0);await expect(page.getByTestId('total')).toHaveText('$12.00');
});

test('manual meal and dietary controls produce an offline reviewed receipt without interpret requests',async({page,context})=>{
 const requests:string[]=[];page.on('request',req=>{if(req.url().includes('/api/interpret'))requests.push(req.url());});
 await openDemo(page);await context.setOffline(true);
 await page.getByTestId('dietary-preference').selectOption('vegan');await page.getByTestId('meal-mode').check();
 await expect(page.getByTestId('cart')).toContainText('Veggie Wrap');await expect(page.getByTestId('total')).toHaveText('$12.00');
 await page.getByTestId('meal-budget').fill('12');await page.getByTestId('apply-budget').click();
 await expect(page.getByTestId('meal-remaining')).toContainText('$0.00');await page.getByTestId('review').click();await page.getByTestId('confirm').click();
 await expect(page.getByTestId('ticket')).toContainText('$12.00');expect(requests).toEqual([]);
});
