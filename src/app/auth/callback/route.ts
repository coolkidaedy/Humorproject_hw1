import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { profileComplete, readProfile } from "@/lib/profile";
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login?error=callback", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || request.nextUrl.searchParams.has("error")) return response;
  try {
    const { url, key } = supabaseConfig();
    const supabase = createServerClient(url, key, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value, options }) => { request.cookies.set(name, value); response.cookies.set(name, value, options); });
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    }});
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return response;
    // Missing rows are completed via the profile form, without overwriting trigger data.
    let destination = "/profile";
    try { if (profileComplete(await readProfile(supabase, data.user.id))) destination = "/protected"; } catch { /* Profile page offers retry. */ }
    response.headers.set("Location", new URL(destination, request.url).toString());
  } catch { /* Do not log authorization codes, tokens, or provider errors. */ }
  return response;
}
