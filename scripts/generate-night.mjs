import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dateInNewYork, generateEpisode, validDay, validateGenerated, destinationFor } from '../src/lib/night/generator.mjs';

const args = process.argv.slice(2);
const day = args.find(arg => arg.startsWith('--day='))?.slice(6) || dateInNewYork();
const publish = args.includes('--publish');
const fromFile = args.find(arg => arg.startsWith('--from='))?.slice(7);
if (!validDay(day)) throw new Error('Use --day=YYYY-MM-DD with a real calendar date.');
let supabase;
if (publish) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Publishing needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.from('night_episodes').select('day').eq('day', day).maybeSingle();
  if (error) throw new Error('Episode storage is unavailable. Apply supabase/night-game.sql first.');
  if (data) { console.log(`An episode already exists for ${day}; no changes made.`); process.exit(0); }
}
let episode;
if (fromFile) {
  episode = JSON.parse(await readFile(fromFile, 'utf8'));
  const destination = destinationFor(day);
  // Reviewed drafts are still constrained to this day's trusted destination and clue shape.
  validateGenerated({ ...episode, clues: episode.clues?.map(clue => ({ ...clue, fact_ids: destination.facts.map(fact => fact.id) })) }, destination);
  episode = { ...episode, day, answer: destination.answer, aliases: destination.aliases, explanation: destination.explanation, source: destination.source };
} else episode = await generateEpisode(day);
if (publish) {
  const { error } = await supabase.from('night_episodes').insert(episode);
  if (error) throw new Error('Publishing failed. Existing episodes are never overwritten.');
  console.log(`Published shared daily episode for ${day}.`);
} else {
  await mkdir('.night-drafts', { recursive: true });
  const path = `.night-drafts/${day}.json`;
  await writeFile(path, `${JSON.stringify(episode, null, 2)}\n`);
  console.log(`Draft saved to ${path}. Review the clues before publishing with --from=${path} --publish.`);
}
