-- Run this file once in Supabase Dashboard > SQL Editor for an existing Clerkly project.
-- It adds the structured fields required by the multi-system review and printed clerking sheet.

alter table public.clinical_cases
  add column if not exists ward text,
  add column if not exists hopi_site text,
  add column if not exists hopi_onset text,
  add column if not exists hopi_character text,
  add column if not exists hopi_radiation text,
  add column if not exists hopi_associations text,
  add column if not exists hopi_timing text,
  add column if not exists hopi_aggravating_relief text,
  add column if not exists hopi_severity text,
  add column if not exists systemic_review_selections text,
  add column if not exists past_blood_transfusion text,
  add column if not exists menstrual_history text,
  add column if not exists family_similar_problem text,
  add column if not exists familial_disease text,
  add column if not exists occupation text,
  add column if not exists marital_status text,
  add column if not exists smoking_history text,
  add column if not exists alcohol_history text,
  add column if not exists promiscuity_history text,
  add column if not exists recreational_drug_history text,
  add column if not exists travel_history text,
  add column if not exists social_other text;
