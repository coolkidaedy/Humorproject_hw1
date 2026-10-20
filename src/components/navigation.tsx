import Link from 'next/link';
import { serverSupabase } from '@/lib/supabase/server';
import { logout } from '@/app/auth/actions';
export async function Navigation() {
  let loggedIn = false;
  try { const supabase = await serverSupabase(); const { data: { user } } = await supabase.auth.getUser(); loggedIn = Boolean(user); } catch { /* Public game remains playable. */ }
  return <header className="site-header"><Link href="/" className="wordmark" aria-label="Where the hell are we home"><span className="brand-cross">✳</span> WHERE THE<br /><span className="wordmark-bottom">HELL ARE WE?</span></Link><nav aria-label="Main navigation" className="site-nav"><Link href="/" className="nav-play">Play</Link><Link href="/#stories">Stories</Link>{loggedIn ? <><Link href="/protected" className="account-link">Account ↗</Link><form action={logout}><button className="signout">Log out</button></form></> : <Link href="/protected" className="account-link">Sign in ↗</Link>}</nav></header>;
}
