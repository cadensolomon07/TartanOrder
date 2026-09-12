// One source of truth: strict schemas and inferred types are defined in index.ts.
export {
  MealComponentSchema, MealRequirementsSchema, DietaryProfileSchema,
  CompatibilityResultSchema, RequirementsStateSchema, RequirementChangeSchema,
  RequirementChangesSchema, RequirementDecisionSchema, RequirementsResultSchema,
  DecideRequirementsResultSchema, SolverSummarySchema,
} from "./index";
export type {
  MealComponent, MealRequirements, DietaryProfile, CompatibilityResult,
  RequirementsState, RequirementChange, RequirementDecision, SolverSummary,
  CartCompatibilityCheck,
} from "./index";
