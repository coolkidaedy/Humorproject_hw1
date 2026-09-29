import "server-only";
import { redirect } from "next/navigation";
import { serverSupabase } from "./supabase/server";
import { profileComplete, readProfile } from "./profile";
export async function requireUser(complete = false) {
  const supabase = await serverSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const profile = await readProfile(supabase, user.id);
  if (complete && !profileComplete(profile)) redirect("/profile");
  return { supabase, user, profile };
}
