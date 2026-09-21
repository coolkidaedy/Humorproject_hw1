import { createClient } from "@supabase/supabase-js";

// This public client only has the access permitted by the database's RLS policies.
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) throw new Error("Missing Supabase environment variables.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
