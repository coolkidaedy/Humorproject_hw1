"use client";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/client";
export function LoginButton() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function login() {
    setPending(true); setError("");
    try {
      const { error } = await browserSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
    } catch { setError("Unable to start Google login. Please try again."); setPending(false); }
  }
  return <><button onClick={login} disabled={pending} className="rounded-full bg-emerald-700 px-6 py-3 font-semibold text-white disabled:opacity-50">{pending ? "Opening Google…" : "Continue with Google"}</button>{error && <p role="alert" className="mt-4">{error}</p>}</>;
}
