import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase env vars are missing. Copy .env.example to .env and fill in your project URL and anon key."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const DOCUMENTS_BUCKET = "client-documents";
export const SUBMISSIONS_TABLE = "client_onboarding_submissions";
