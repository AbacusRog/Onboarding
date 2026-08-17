-- Run this in the Supabase SQL editor for the already-deployed project.
-- Splits the single "address" field into structured columns and adds postcode-lookup
-- support. Safe to run even if some columns already exist.

alter table public.client_onboarding_submissions
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists town_city text,
  add column if not exists county text,
  add column if not exists postcode text;

-- The old "address" column is no longer written to by the form, but is left in place
-- (and made optional) so any existing test/real submissions keep their data.
alter table public.client_onboarding_submissions
  alter column address drop not null;
