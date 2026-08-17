-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

-- 1. Table to hold form submissions
create table if not exists public.client_onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  full_name text not null,
  mobile_number text,
  email text,
  address_line_1 text not null,
  address_line_2 text,
  town_city text not null,
  county text,
  postcode text not null,
  date_moved date,
  property_status text,          -- 'renting' | 'owned'
  date_of_birth date,
  nationality text,
  ni_number text,                -- format: LLNNNNNNL
  personal_utr text,             -- 10 digits
  business_description text,

  bank_account_name text,
  bank_sort_code text,
  bank_account_number text,

  is_moving_accountant boolean not null default false,
  previous_accountant_name text,
  previous_accountant_email text,

  is_limited_company boolean not null default false,
  company_name text,
  company_number text,
  company_auth_code text,
  company_utr text,              -- 10 digits

  passport_file_path text,
  driving_licence_file_path text,
  address_proof_file_path text,
  tax_return_accounts_file_path text,
  latest_filed_accounts_file_path text
);

alter table public.client_onboarding_submissions enable row level security;

-- Anyone (including anonymous clients filling in the public form) can insert a submission.
create policy "Public can submit"
  on public.client_onboarding_submissions
  for insert
  to anon
  with check (true);

-- Only signed-in users (you, via the /admin dashboard) can read submissions.
create policy "Authenticated can read"
  on public.client_onboarding_submissions
  for select
  to authenticated
  using (true);

-- 2. Storage bucket for uploaded documents (kept private — not publicly listable/downloadable)
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

-- Anonymous clients can upload (but not list or read back) files into the bucket.
create policy "Public can upload documents"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'client-documents');

-- Only signed-in users can read/download files (used to generate signed URLs in the admin view).
create policy "Authenticated can read documents"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'client-documents');

-- Optional: only needed if you ever re-enable upsert-style uploads (overwriting a path
-- that already exists). Not required for normal use, since each submission gets a unique ID.
-- create policy "Public can overwrite own uploads"
--   on storage.objects
--   for update
--   to anon
--   using (bucket_id = 'client-documents')
--   with check (bucket_id = 'client-documents');

-- 3. Create at least one admin user to sign in to /admin with:
--    Supabase dashboard -> Authentication -> Users -> Add user (set an email + password)
