import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { readProfile, profileComplete } from "@/lib/profile";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  const { url, key } = supabaseConfig();
  const supabase = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values, headers) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      const previous = response;
      response = NextResponse.next({ request });
      previous.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      response.headers.set("Cache-Control", "private, no-store");
    },
  }});
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  let destination: string | undefined;
  if (!user && (path === "/profile" || path === "/protected")) destination = "/login";
  if (user && (path === "/" || path === "/login" || path === "/protected")) {
    try {
      if (!profileComplete(await readProfile(supabase, user.id))) destination = "/profile";
      else if (path === "/login") destination = "/protected";
    } catch { destination = "/profile"; }
  }
  if (destination) {
    const next = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.getAll().forEach(cookie => next.cookies.set(cookie));
    next.headers.set("Cache-Control", "private, no-store");
    return next;
  }
  return response;
}
export const config = { matcher: ["/", "/login", "/profile", "/protected", "/auth/:path*"] };
