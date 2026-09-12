-- Food evidence and modifier effects become catalog data (2026-09-12).
-- Nullable so earlier published versions stay valid; the loader treats a null
-- food_evidence as "unverified campus item" and a null effect as "no ingredient effect".
alter table public.items add column food_evidence jsonb;
comment on column public.items.food_evidence is 'FoodEvidence JSON: fictional Demo Counter recipes, or ingredients inferred from the published name and description (provenance inferred_campus). Inference only adds ingredients; absence is never certified.';
alter table public.modifiers add column effect jsonb;
comment on column public.modifiers.effect is 'ModifierEffect JSON { remove: ingredient ids, add: ingredients } applied to an item''s evidence when the modifier is selected.';
