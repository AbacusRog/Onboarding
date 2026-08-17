# Email Notifications on New Submissions

This sends you an email every time a client submits the onboarding form. The form
itself calls a Supabase Edge Function right after a successful submission, which sends
the email via Resend (free for up to 3,000 emails/month).

(Note: an earlier version of this guide used a Supabase Database Webhook to trigger the
function instead. If your project hits `supabase_functions.http_request() does not
exist` when creating that webhook, that's a gap in the project's internal setup —
the direct-invoke approach below sidesteps it entirely and is what the shipped code
uses.)

## 1. Get a Resend API key

1. Sign up free at https://resend.com
2. Go to **API Keys** → create a new key → **copy it immediately** — Resend only shows
   the full value once, right when it's created.
3. For a quick start, send from `onboarding@resend.dev` (Resend's shared test domain) —
   no extra setup needed. To send from your own domain later, add and verify it under
   **Domains** in Resend.

## 2. Create the Edge Function in Supabase

1. Supabase dashboard → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it `notify-new-submission`.
3. Paste in the contents of `supabase/functions/notify-new-submission/index.ts` from
   this project, replacing the template code entirely.
4. Deploy it.
5. Open the function's settings and make sure **"Enforce JWT Verification" is ON**
   (the default). The form calls this function using its normal Supabase credentials,
   so this check is what confirms the call is legitimate — no extra secret needed.

## 3. Set the function's secrets

Edge Functions → **Manage secrets**, add:

| Secret            | Value                                                              |
|--------------------|---------------------------------------------------------------------|
| `RESEND_API_KEY`   | the API key from step 1                                            |
| `NOTIFY_EMAIL_TO`  | the email address you want notifications sent to                   |
| `NOTIFY_EMAIL_FROM`| `onboarding@resend.dev` (or your own verified address)             |
| `ADMIN_URL`        | your onboarding form's `/admin` URL (optional — adds a link in the email) |

`WEBHOOK_SECRET` isn't needed for this setup — it only matters if you're also using a
Database Webhook (see the note at the top).

## 4. Test it

Submit the onboarding form once yourself with test data. You should get an email
within a few seconds. If not, check:

- **Supabase → Edge Functions → notify-new-submission → Logs** for errors
- Resend's dashboard has a log of every email it's tried to send, including failures
- Browser dev tools (F12) → Console, on the form page — a failed notification call
  logs there without blocking the client's submission
