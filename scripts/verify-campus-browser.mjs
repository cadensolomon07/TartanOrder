import { chromium } from '@playwright/test';
import { CAMPUS_ITEMS } from '../src/contracts/campus.ts';
import { writeFile, mkdir } from 'node:fs/promises';
const base=process.env.CAMPUS_APP_URL || 'http://127.0.0.1:3000';
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const reportPath=`evals/runs/campus-browser-gemini-${stamp}.json`;
await mkdir('test-results/campus-live',{recursive:true});
await mkdir('evals/runs',{recursive:true});
const report={kind:'real-browser-campus-gemini',appUrl:base,recordedAt:new Date().toISOString(),voice:'Typed browser input; no new microphone trial.',retries:'None',cases:[],pageErrors:[]};
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const page=await context.newPage();
page.on('pageerror',error=>report.pageErrors.push(String(error)));
async function submit(text){
  const wait=page.waitForResponse(r=>r.url().endsWith('/api/interpret'),{timeout:22000});
  await page.getByTestId('text-input').fill(text);
  await page.getByTestId('submit').click();
  const http=await wait,body=await http.json();
  await page.getByTestId('badge-busy').waitFor({state:'detached',timeout:22000});
  if(http.status()!==200||body.parser!=='gemini'||body.fallbackReason!==null)throw new Error(`Real Gemini required: ${http.status()} ${JSON.stringify(body)}`);
  return body;
}
try{
  for(const locationId of [...new Set(CAMPUS_ITEMS.map(x=>x.locationId))]){
    const item=CAMPUS_ITEMS.find(x=>x.locationId===locationId);
    const record={locationId,itemId:item.id,text:`I'd like one ${item.label}, please.`,expectedCents:item.priceCents};report.cases.push(record);
    await page.goto(base);
    await page.getByTestId('dining-location').selectOption(locationId);
    await page.getByRole('checkbox',{name:'Read replies aloud'}).uncheck();
    record.response=await submit(record.text);
    record.total=await page.getByTestId('total').innerText();
    const ops=record.response.result.ops;
    if(record.response.result.kind!=='proposal'||ops.length!==1||ops[0].itemId!==item.id||ops[0].qty!==1||record.total!==`$${(item.priceCents/100).toFixed(2)}`)throw new Error(`Wrong campus item: ${JSON.stringify(record)}`);
    record.passed=true;
    console.log(`Verified ${locationId}: ${item.label}, ${record.total}, real Gemini`);
  }
  await page.goto(base);
  await page.getByRole('checkbox',{name:'Read replies aloud'}).uncheck();
  const journey={name:'Stackd combined order and across-turn edit',steps:[]};report.cases.push(journey);
  journey.steps.push(await submit("I'd like a Smash'd Burger and fresh cut fries, please."));
  if(await page.getByTestId('total').innerText()!=='$12.65')throw new Error('Wrong combined total');
  journey.steps.push(await submit('Make the fresh cut fries two.'));
  if(await page.getByTestId('total').innerText()!=='$16.10')throw new Error('Wrong edited total');
  await page.getByTestId('undo').click();
  if(await page.getByTestId('total').innerText()!=='$12.65')throw new Error('Undo failed');
  await page.getByTestId('review').click();
  await page.getByTestId('confirm').click();
  journey.receipt=await page.getByTestId('ticket').innerText();
  if(!journey.receipt.includes('$12.65')||!journey.receipt.includes("Stack'd Underground"))throw new Error('Receipt mismatch');
  journey.passed=true;
  await page.screenshot({path:'test-results/campus-live/receipt.png',fullPage:true});
  await page.goto(base);
  await page.screenshot({path:'test-results/campus-live/kiosk.png',fullPage:false});
  if(report.pageErrors.length)throw new Error('Page errors');
  report.passed=true;
}catch(error){report.passed=false;report.error=String(error);console.error(String(error));process.exitCode=1;}
finally{await writeFile(reportPath,JSON.stringify(report,null,2));console.log(reportPath);await browser.close();}
