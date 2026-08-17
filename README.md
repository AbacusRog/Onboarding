# Client Onboarding Form

A public form for new accountancy clients to submit their details and upload ID/address
documents, plus a simple login-gated dashboard for you to review submissions.

- `/` — the public form clients fill in and upload documents to
- `/admin` — list of submissions (requires sign-in)
- `/admin/:id` — full detail view for one submission, with links to their uploaded documents

## Stack

React + Vite, [Supabase](https://supabase.com) for the database, file storage, and auth,
deployable to Cloudflare Pages — same stack as the other apps in this account.

## Setup

1. **Create a Supabase project** (or use an existing one).
2. **Run the SQL** in `sql/schema.sql` via the Supabase SQL Editor. This creates:
   - the `client_onboarding_submissions` table
   - the `client-documents` storage bucket (private)
   - row-level security policies: anyone can *submit*, only signed-in users can *read*

   If you already ran `schema.sql` before (i.e. the table already exists), instead run
   `sql/migration_002_add_fields.sql` and `sql/migration_003_split_address.sql`, which add
   the newer fields without touching existing data.
5. **Optional: postcode lookup** — sign up free at [ideal-postcodes.co.uk](https://ideal-postcodes.co.uk)
   (50 free credits, no card required) and add `VITE_IDEAL_POSTCODES_API_KEY` to `.env`.
   Without it, the postcode lookup box just doesn't appear — clients can still type their
   address manually. Since this key runs in the browser, go to your key's **Manage → Key
   Restrictions** on the Ideal Postcodes dashboard and add your site's URL under **Allowed
   URLs** (e.g. `your-site.pages.dev`) plus a sensible daily lookup cap, so the key can't be
   copied off your site and used elsewhere.
3. **Create yourself a login** — Supabase dashboard → Authentication → Users → Add user
   (email + password). This is what you'll use to sign in at `/admin`.
4. **Set environment variables** — copy `.env.example` to `.env` and fill in your project's
   URL and anon key (Supabase dashboard → Project Settings → API):
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
5. **Install and run locally**:
   ```
   npm install
   npm run dev
   ```
6. **Deploy** — `npm run build` produces a `dist/` folder; deploy it to Cloudflare Pages
   (or wherever you're hosting the other apps). Set the same two environment variables
   in the Cloudflare Pages project settings.

## Notes

- Uploaded files are capped at 10MB each and accepted as images or PDFs.
- Clients must provide at least one photo ID (passport or driving licence) and a proof of
  address before the form will submit.
- Document links on the admin detail page are signed URLs that expire after 10 minutes —
  refresh the page to get new links.
- There's currently no email notification when a new submission arrives — check `/admin`
  periodically. If you want a notification later, a Supabase Edge Function triggered on
  insert (via a database webhook) is the natural way to add one.
- The anon key is safe to expose in the frontend — it can only do what the RLS policies in
  `schema.sql` allow (insert submissions/documents, nothing else) as long as those policies
  stay in place.
