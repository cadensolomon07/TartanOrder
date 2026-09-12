import type { CompatibilityResult, DietaryProfile, ModifierId } from "@/contracts";
import { foodEvidenceFor, normalizeFoodName } from "@/contracts/food";
import type { CatalogIndex } from "@/catalog/lookup";

/** Pure and shared by browsing, edits, suggestions, swaps, review and confirmation. Reads only the loaded catalog. */
export function checkCompatibility(menu: CatalogIndex, itemId: string, modifiers: readonly ModifierId[], profile: DietaryProfile): CompatibilityResult {
  const item = menu.item(itemId);
  if (!item) return { status: "conflict", reasons: ["This item is not in the current catalog."], staffReview: false, source: "No catalog entry for this item." };
  const evidence = foodEvidenceFor(itemId, modifiers, item.allowedModifiers);
  const reasons: string[] = [];
  let conflict = false;
  let unknown = false;
  let staffReview = false;
  const problem = (message: string, status: "conflict" | "unknown", staff = false) => {
    if (status === "conflict") conflict = true; else unknown = true;
    staffReview ||= staff;
    if (!reasons.includes(message)) reasons.push(message);
  };
  const declared = new Set(evidence.ingredients.flatMap(entry => entry.allergens.map(normalizeFoodName)));
  const ingredientMatches = (name: string) => evidence.ingredients.filter(entry => [entry.id, entry.label, ...entry.aliases].some(value => normalizeFoodName(value) === name));
  const exactException = profile.exceptions.find(exception => exception.itemId === itemId && [...exception.modifiers].sort().join("|") === [...new Set(modifiers)].sort().join("|"));
  if (modifiers.some(modifier => !item.allowedModifiers.includes(modifier))) problem("This customization is not supported by the selected item.", "conflict");

  // Exceptions are explicit preference decisions. They never waive an allergy.
  if (profile.preference !== "none" && exactException?.preference !== profile.preference) {
    const field = profile.preference === "vegan" ? "vegan" : "vegetarian";
    const incompatible = evidence.ingredients.filter(entry => entry[field] === false);
    if (incompatible.length) problem(`${incompatible.map(entry => entry.label).join(", ")} conflicts with your ${profile.preference} preference.`, "conflict");
    if (evidence.completeness !== "complete" || evidence.ingredients.some(entry => entry[field] === null)) problem(`Complete ${profile.preference} ingredient evidence is unavailable.`, "unknown");
  }
  for (const value of profile.dislikes) {
    const name = normalizeFoodName(value);
    if (exactException?.dislikes.some(dislike => normalizeFoodName(dislike) === name)) continue;
    if (name === "nuts" || name === "nut") {
      problem("Your nut dislike needs clarification: peanuts, tree nuts, or both. It remains an unresolved ingredient exclusion.", "unknown");
      continue;
    }
    const matches = ingredientMatches(name);
    if (matches.length || declared.has(name)) problem(`Contains ${value}, which you asked to avoid as a dislike.`, "conflict");
    else if (evidence.completeness !== "complete") problem(`Ingredients are incomplete; the absence of ${value} is unverified.`, "unknown");
  }
  for (const value of profile.allergies) {
    const name = normalizeFoodName(value);
    if (name === "nuts" || name === "nut") {
      problem("“Nuts” needs clarification: peanuts, tree nuts, or both. Your restriction remains active while unresolved.", "unknown", true);
      continue;
    }
    if (declared.has(name) || ingredientMatches(name).length) problem(`Declared ingredient contains ${value}. Ask dining staff about an alternative.`, "conflict", true);
    else if (evidence.completeness !== "complete" || !evidence.allergenCoverage.map(normalizeFoodName).includes(name)) problem(`The absence of ${value} is not verified by the ingredient evidence.`, "unknown", true);
    if (evidence.preparation.status === "unknown") problem(`Preparation and cross-contact for ${value} are unknown. Verify with dining staff.`, "unknown", true);
    else if (evidence.preparation.status === "possible_cross_contact" && (!evidence.preparation.allergens.length || evidence.preparation.allergens.map(normalizeFoodName).includes(name))) problem(`Possible cross-contact with ${value} is declared. Verify with dining staff.`, "conflict", true);
  }
  if (exactException) reasons.push("An explicit exception applies only to this configuration's previously approved preference/dislikes. Allergies and new restrictions still apply.");
  if (!reasons.length) reasons.push(profile.preference !== "none" || profile.allergies.length || profile.dislikes.length ? "The recorded requirements match the available evidence." : "No dietary restrictions were requested.");
  return {
    status: conflict ? "conflict" : unknown ? "unknown" : "match",
    reasons: reasons.slice(0, 30).map(reason => reason.slice(0, 300)), staffReview,
    source: evidence.provenance.explanation,
  };
}
