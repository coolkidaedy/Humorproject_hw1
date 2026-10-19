import Link from 'next/link';
import { serverSupabase } from '@/lib/supabase/server';
import type { StoryCaseState } from '@/lib/night/types';
import { StoryCaseGame } from './story-case-game';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function StoryCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return <CaseUnavailable message="That case file does not exist."/>;
  let state: StoryCaseState | null = null;
  let failure = '';
  let signIn = false;
  try {
    const supabase = await serverSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { failure = 'Sign in to play cases made from community stories.'; signIn = true; }
    else {
      const { data, error } = await supabase.rpc('night_story_case_play', { source_story_id: id, action_name: 'state', guess_text: '' });
      if (error) failure = 'Community cases are not ready on this deployment yet.';
      else if (data?.error) failure = data.error;
      else state = data as StoryCaseState;
    }
  } catch { failure = 'The case file could not be opened. Please try again.'; }
  return state ? <StoryCaseGame initial={state}/> : <CaseUnavailable message={failure} signIn={signIn}/>;
}

function CaseUnavailable({ message, signIn = false }: { message: string; signIn?: boolean }) {
  return <main className="afterstory-unavailable"><span className="case-file-mark">CASE FILE / UNAVAILABLE</span><h1>This trail<br/><em>went cold.</em></h1><p>{message}</p><div><Link className="primary-button" href={signIn ? '/login' : '/'}>{signIn ? 'Sign in to continue' : 'Back to tonight'} <span>→</span></Link><Link className="text-button" href="/#stories">Browse the stories</Link></div></main>;
}
