import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { dateInNewYork, generateEpisode, nextDay } from '@/lib/night/generator.mjs';
export const runtime = 'nodejs';
export const maxDuration = 60;
// Suitable for a protected daily scheduler. Generates tomorrow, so midnight has no cold start.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization') || '';
  if (!secret) return Response.json({ error: 'Daily generation is not configured.' }, { status: 503 });
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.GEMINI_API_KEY) return Response.json({ error: 'Daily generation requires database and AI configuration.' }, { status: 503 });
  const day = nextDay(dateInNewYork());
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.from('night_episodes').select('day').eq('day', day).maybeSingle();
    if (error) return Response.json({ error: 'Episode storage is unavailable.' }, { status: 503 });
    if (data) return Response.json({ day, status: 'already-published' });
    const episode = await generateEpisode(day);
    const { error: saveError } = await supabase.from('night_episodes').insert(episode);
    if (saveError?.code === '23505') return Response.json({ day, status: 'already-published' });
    if (saveError) return Response.json({ error: 'Episode could not be published.' }, { status: 503 });
    return Response.json({ day, status: 'published' });
  } catch { return Response.json({ error: 'Generation failed validation or the provider is unavailable. No episode was changed.' }, { status: 502 }); }
}
