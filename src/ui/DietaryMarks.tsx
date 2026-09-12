// Dietary marks derived from an item's stored food evidence. Marks only ever
// report what the evidence lists: a detected meat, fish or allergen, or a
// published vegetarian/vegan claim. Missing ingredients are never certified.
import type { DietaryClaim, FoodEvidence } from "@/contracts";
import styles from "./Kiosk.module.css";

export type DietaryMarkSummary = {
  contains: string[];
  meat: boolean;
  fish: boolean;
  claims: DietaryClaim[];
  inferred: boolean;
  unknown: boolean;
};

const SEA = new Set(["fish", "shellfish"]);

export function dietaryMarks(evidence: FoodEvidence): DietaryMarkSummary {
  const animal = evidence.ingredients.filter((entry) => entry.vegetarian === false);
  const fish = animal.some((entry) => entry.allergens.some((allergen) => SEA.has(allergen.toLowerCase())));
  const meat = animal.some((entry) => !entry.allergens.some((allergen) => SEA.has(allergen.toLowerCase())));
  const contains = [...new Set(evidence.ingredients.flatMap((entry) => entry.allergens.map((allergen) => allergen.toLowerCase())))].sort();
  const claims: DietaryClaim[] = evidence.dietaryClaims.includes("vegan") ? ["vegan"] : evidence.dietaryClaims.includes("vegetarian") ? ["vegetarian"] : [];
  return {
    contains, meat, fish, claims,
    inferred: evidence.provenance.kind === "inferred_campus",
    unknown: evidence.completeness === "unknown" && evidence.ingredients.length === 0,
  };
}

const CLAIM_LABEL: Record<DietaryClaim, string> = { vegan: "Vegan", vegetarian: "Vegetarian" };

export function DietaryMarks({ evidence, compact = false, testId = "dietary-marks" }: { evidence: FoodEvidence; compact?: boolean; testId?: string }) {
  const marks = dietaryMarks(evidence);
  const listed = marks.contains.filter((allergen) => !(marks.fish && SEA.has(allergen)));
  const suffix = marks.inferred ? " · from menu wording" : "";
  if (marks.unknown && !marks.claims.length) {
    return <span className={`${styles.marks} ${compact ? styles.marksCompact : ""}`} data-testid={testId}>
      <span className={`${styles.mark} ${styles.markMuted}`} data-testid="dietary-mark" data-kind="unknown">Ingredients not listed</span>
    </span>;
  }
  return <span className={`${styles.marks} ${compact ? styles.marksCompact : ""}`} data-testid={testId}>
    {marks.claims.map((claim) => <span key={claim} className={`${styles.mark} ${styles.markClaim}`} data-testid="dietary-mark" data-kind={`claim-${claim}`}>{CLAIM_LABEL[claim]}{suffix}</span>)}
    {marks.meat && <span className={`${styles.mark} ${styles.markWarn}`} data-testid="dietary-mark" data-kind="meat">Contains meat</span>}
    {marks.fish && <span className={`${styles.mark} ${styles.markWarn}`} data-testid="dietary-mark" data-kind="fish">Contains fish or shellfish</span>}
    {listed.length > 0 && <span className={`${styles.mark} ${styles.markWarn}`} data-testid="dietary-mark" data-kind="contains">Contains: {listed.join(", ")}</span>}
    {marks.unknown && <span className={`${styles.mark} ${styles.markMuted}`} data-testid="dietary-mark" data-kind="unknown">Ingredients not listed</span>}
  </span>;
}
