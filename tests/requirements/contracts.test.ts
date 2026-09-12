import { describe, expect, it, vi, afterEach } from 'vitest';
vi.mock("server-only", () => ({}));
// The route reads the catalog through the config loader; tests serve the bundled release, never the database.
vi.mock("@/catalog/config.server", async () => {
  const { bundledCatalog } = await import("@/catalog/bundled");
  return {
    loadCatalogConfig: vi.fn(async () => {
      const catalog = bundledCatalog();
      return { catalog, source: "bundled", versionId: catalog.versionId, unavailableReason: null };
    }),
  };
});
import { DietaryProfileSchema, RequirementsResultSchema, MealRequirementsSchema, UiActionSchema, API_VERSION } from '@/contracts';
import { catalogGuard } from '@/catalog/lookup';
import { POST } from '@/app/api/interpret/route';
import { CATALOG, MENU_VERSION } from '../helpers/catalog';

const PublicParseRequestSchema = catalogGuard(CATALOG).publicParseRequestSchema;
const profile={preference:'vegan',allergies:['kiwi'],dislikes:[],exceptions:[]};
const meal={locationId:'demo',budgetCents:1200,components:['mains','sides','drinks'],selections:[],lockedItemIds:[]};
afterEach(()=>vi.restoreAllMocks());
describe('strict persistent requirement boundaries',()=>{
 it('retains an explicitly named additional allergen and separates it from a dietary preference',()=>{
  expect(DietaryProfileSchema.parse(profile)).toEqual(profile);
  expect(DietaryProfileSchema.safeParse({...profile,allergySafe:true}).success).toBe(false);
  expect(DietaryProfileSchema.safeParse({...profile,preference:'peanut-free'}).success).toBe(false);
 });
 it('allows declared changes but never model prices or a receipt',()=>{
  const result={kind:'requirements',locationId:'demo',changes:[{type:'SET_BUDGET',budgetCents:1200}]};
  expect(RequirementsResultSchema.safeParse(result).success).toBe(true);
  expect(RequirementsResultSchema.safeParse({...result,totalCents:500}).success).toBe(false);
  expect(RequirementsResultSchema.safeParse({...result,changes:[{type:'SET_PRICE',itemId:'burger',priceCents:1}]}).success).toBe(false);
  expect(RequirementsResultSchema.safeParse({...result,ops:[{type:'CONFIRM'}]}).success).toBe(false);
 });
 it('requires integer cents, distinct bounded components, and revision-bound decision clicks',()=>{
  expect(MealRequirementsSchema.safeParse(meal).success).toBe(true);
  expect(MealRequirementsSchema.safeParse({...meal,budgetCents:12.5}).success).toBe(false);
  expect(MealRequirementsSchema.safeParse({...meal,components:['mains','mains']}).success).toBe(false);
  expect(UiActionSchema.safeParse({type:'DECIDE_REQUIREMENTS',pendingId:'pending',choiceId:'raise_budget'}).success).toBe(false);
  expect(UiActionSchema.safeParse({type:'DECIDE_REQUIREMENTS',pendingId:'pending',revision:8,choiceId:'raise_budget'}).success).toBe(true);
 });
 it('keeps fictional Demo separate from retired public restaurants',()=>{
  const req={v:API_VERSION,menuVersion:MENU_VERSION,requestId:'r1',baseRevision:1,text:'I am vegan',source:'text',asrConfidence:null};
  expect(PublicParseRequestSchema.safeParse({...req,locationId:'demo'}).success).toBe(true);
  expect(PublicParseRequestSchema.safeParse({...req,locationId:'115'}).success).toBe(false);
 });
 it('keeps caller identifiers and raw dietary text out of error telemetry',async()=>{
  const logger=vi.spyOn(console,'info').mockImplementation(()=>{});
  const identifier='person-with-a-peanut-allergy';
  const result=await POST(new Request('http://localhost/api/interpret',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({v:API_VERSION,menuVersion:MENU_VERSION,requestId:identifier,baseRevision:1,text:'I have a peanut allergy',source:'text',asrConfidence:null,locationId:'115'})}));
  expect(result.status).toBe(400);
  const logs=JSON.stringify(logger.mock.calls);expect(logs).not.toContain(identifier);expect(logs).not.toContain('peanut');expect(logs).not.toContain('allergy');
 });
});
