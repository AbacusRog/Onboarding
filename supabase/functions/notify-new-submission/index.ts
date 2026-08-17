// Supabase Edge Function: notify-new-submission
//
// Called directly by the onboarding form right after a successful submission
// (via supabase.functions.invoke, authenticated with the app's normal anon key —
// this is why "Enforce JWT Verification" should be turned back ON for this function).
// Sends an email notification via Resend (https://resend.com).
//
// Required secrets (set in Supabase Dashboard -> Edge Functions -> Manage secrets):
//   RESEND_API_KEY     - your Resend API key
//   NOTIFY_EMAIL_TO    - the email address that should receive notifications
//   NOTIFY_EMAIL_FROM  - the "from" address (e.g. "onboarding@resend.dev" for quick setup,
//                         or an address on your own verified domain)
//   WEBHOOK_SECRET      - optional extra check, only used if you're also calling this via
//                         a Database Webhook with an x-webhook-secret header. Not required
//                         for calls made through supabase.functions.invoke.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_EMAIL_TO = Deno.env.get("NOTIFY_EMAIL_TO") ?? "";
const NOTIFY_EMAIL_FROM = Deno.env.get("NOTIFY_EMAIL_FROM") ?? "onboarding@resend.dev";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const ADMIN_URL = Deno.env.get("ADMIN_URL") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Only enforced if the caller actually sends this header (i.e. a Database Webhook).
  // Calls from the app itself (via supabase.functions.invoke) are authenticated by
  // Supabase's own JWT check instead, so they won't send this header and skip this check.
  const providedSecret = req.headers.get("x-webhook-secret");
  if (WEBHOOK_SECRET && providedSecret && providedSecret !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json();
    const record = payload.record ?? {};

    const name = record.full_name || "Unknown";
    const isCompany = Boolean(record.is_limited_company);
    const companyName = record.company_name;
    const submittedAt = record.created_at ? new Date(record.created_at).toLocaleString("en-GB") : "just now";

    const subject = `New client onboarding submission: ${name}`;
    const html = `
      <h2>New onboarding submission received</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Type:</strong> ${isCompany ? `Limited company${companyName ? ` (${escapeHtml(companyName)})` : ""}` : "Individual"}</p>
      <p><strong>Submitted:</strong> ${escapeHtml(submittedAt)}</p>
      ${ADMIN_URL ? `<p><a href="${escapeHtml(ADMIN_URL)}">View in dashboard</a></p>` : ""}
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_EMAIL_FROM,
        to: NOTIFY_EMAIL_TO,
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend error:", errText);
      return new Response(JSON.stringify({ error: errText }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
