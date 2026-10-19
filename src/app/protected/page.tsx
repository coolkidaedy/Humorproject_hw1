import Link from 'next/link';
import { requireUser } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export default async function Protected() {
  const { profile } = await requireUser(true);
  return <main className="members-page">
    <span className="eyebrow"><span className="live-dot"/> THE NIGHT SHIFT / MEMBERS ONLY</span>
    <h1>You’re on<br/><em>the inside.</em></h1>
    <p>Welcome back, {profile!.first_name}. Your next questionable night starts here.</p>
    <div className="members-actions"><Link href="/" className="primary-button">Play the daily mystery →</Link><Link href="/profile" className="text-button">Edit your profile ↗</Link></div>
    <div className="member-pass"><span>AFTER-HOURS ACCESS</span><strong>{profile!.first_name} {profile!.last_name}</strong><p>Members-only area · Signed in</p><span>NEW YORK. YOUR SIDE OF THE STORY.</span></div>
  </main>;
}
