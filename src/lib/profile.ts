import type { SupabaseClient } from "@supabase/supabase-js";
export type Profile = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null };
export const profileComplete = (p: Profile | null) => Boolean(p?.first_name?.trim() && p?.last_name?.trim());
export async function readProfile(client: SupabaseClient, id: string): Promise<Profile | null> {
  const { data, error } = await client.from("profiles").select("id,first_name,last_name,avatar_url").eq("id", id).maybeSingle();
  if (error) throw new Error("Your profile could not be loaded. Please try again.");
  return data;
}
