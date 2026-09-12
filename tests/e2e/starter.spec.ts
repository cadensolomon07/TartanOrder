// BOOTSTRAP TEST — B owns tests/e2e after starter handoff.
import { test, expect } from "@playwright/test";
test("real local rules reach a reviewed simulated receipt", async ({page})=>{
  await page.goto("/");
  await expect(page.getByText("TartanOrder Demo Counter · Seeded menu · No real purchase.")).toBeVisible();
  await page.getByLabel("Your order",{exact:true}).fill("a burger, fries and lemonade");
  await page.getByRole("button",{name:"Apply",exact:true}).click();
  await expect(page.getByText("$13.50",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Review order",exact:true}).click();
  await page.getByRole("button",{name:"Confirm simulated order",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Simulated receipt",exact:true})).toBeVisible();
});
