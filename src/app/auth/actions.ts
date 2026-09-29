"use server";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
export async function logout() {
  const supabase = await serverSupabase();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) redirect("/profile?error=logout");
  redirect("/login");
}
