-- Run this in the Supabase SQL editor for the already-deployed project (the shared
-- "Carglass" project). Adds the fields added after the form first went live:
-- mobile number, email, previous accountant details, and two new document uploads.
-- Safe to run even if some columns already exist (IF NOT EXISTS on each one).

alter table public.client_onboarding_submissions
  add column if not exists mobile_number text,
  add column if not exists email text,
  add column if not exists is_moving_accountant boolean not null default false,
  add column if not exists previous_accountant_name text,
  add column if not exists previous_accountant_email text,
  add column if not exists tax_return_accounts_file_path text,
  add column if not exists latest_filed_accounts_file_path text;
