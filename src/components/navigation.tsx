import Link from "next/link";
import { serverSupabase } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
export async function Navigation() {
  const supabase = await serverSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return <nav aria-label="Main navigation" className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-6 border-b border-current/15 px-6 py-5 text-sm font-semibold"><Link href="/">Restaurants</Link><Link href="/captions">Campus captions</Link>{user ? <><Link href="/protected">Members</Link><Link href="/profile">Profile</Link><form action={logout} className="ml-auto"><button className="cursor-pointer underline underline-offset-4">Log out</button></form></> : <Link href="/login" className="ml-auto">Log in</Link>}</nav>;
}
