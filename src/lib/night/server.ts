import 'server-only';
import { cookies } from 'next/headers';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { serverSupabase } from '@/lib/supabase/server';
import { practiceNight } from './practice';
import { deductionScore, newYorkDay } from './rules';
import type { Community, NightState, GuessAttempt } from './types';

type PracticeEpisode = { title: string; brief: string; answer: string; aliases: string[]; explanation: string; source: string; clues: NightState['clues'] };

// Practice has no ranked rewards. Derive a stable fallback on multi-instance deployments.
const processState = globalThis as typeof globalThis & { nightPracticeSecret?: string };
const configuredPracticeSecret = process.env.GAME_SESSION_SECRET || (process.env.GEMINI_API_KEY ? createHash('sha256').update(`wth-practice:${process.env.GEMINI_API_KEY}`).digest('hex') : '');
const practiceSecret = configuredPracticeSecret || (processState.nightPracticeSecret ??= randomBytes(32).toString('hex'));
const cookieName = 'wth-practice-v1';
export type PracticeProgress = { guesses: GuessAttempt[]; day: string; revealed: number; wrong: number; finished: boolean; solved: boolean; storyGenerations: number; storyGenerationVersion: number; recentAnswers?: string[]; episode?: PracticeEpisode };
export async function readPractice(): Promise<PracticeProgress> {
  const initial: PracticeProgress = { guesses: [], day: newYorkDay(), revealed: 1, wrong: 0, finished: false, solved: false, storyGenerations: 0, storyGenerationVersion: 2 };
  try {
    const token = (await cookies()).get(cookieName)?.value || '';
    const [body, signature] = token.split('.');
    const expected = createHmac('sha256', practiceSecret).update(body || '').digest('hex');
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return initial;
    const value = JSON.parse(Buffer.from(body, 'base64url').toString());
    return value.day === initial.day ? { ...value, guesses: Array.isArray(value.guesses) ? value.guesses : [], recentAnswers: Array.isArray(value.recentAnswers) ? value.recentAnswers.filter((answer: unknown) => typeof answer === 'string').slice(-8) : [], storyGenerations: value.storyGenerationVersion === 2 && Number.isInteger(value.storyGenerations) ? Math.max(0, Math.min(10, value.storyGenerations)) : 0, storyGenerationVersion: 2 } : initial;
  } catch { return initial; }
}
export async function savePractice(progress: PracticeProgress) {
  const body = Buffer.from(JSON.stringify(progress)).toString('base64url');
  const signature = createHmac('sha256', practiceSecret).update(body).digest('hex');
  (await cookies()).set(cookieName, `${body}.${signature}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 86400 });
}
export function practiceState(progress: PracticeProgress): NightState {
  const episode = progress.episode || practiceNight;
  const { storyGenerations: _storyGenerations, storyGenerationVersion: _storyGenerationVersion, recentAnswers: _recentAnswers, episode: _episode, ...publicProgress } = progress;
  void _storyGenerations; void _storyGenerationVersion; void _recentAnswers; void _episode;
  return { ...publicProgress, mode: 'practice', number: 0, title: episode.title, brief: episode.brief,
    clues: episode.clues.slice(0, progress.finished ? 4 : progress.revealed), score: deductionScore(progress.revealed, progress.wrong, progress.solved),
    ...(progress.finished ? { answer: episode.answer, explanation: episode.explanation, source: episode.source } : {}),
  };
}
export async function loadNight(): Promise<{ state: NightState; loggedIn: boolean; playerId: string | null }> {
  let loggedIn = false;
  let playerId: string | null = null;
  try {
    const supabase = await serverSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    loggedIn = Boolean(user);
    playerId = user?.id || null;
    if (user) {
      const { data, error } = await supabase.rpc('night_play', { action_name: 'state', guess_text: '' });
      if (!error && data && !data.error) return { state: data as NightState, loggedIn, playerId };
    }
  } catch { /* A playable, explicitly unranked episode remains available. */ }
  return { state: practiceState(await readPractice()), loggedIn, playerId };
}
export async function loadCommunity(day: string): Promise<Community> {
  try {
    const supabase = await serverSupabase();
    const { data, error } = await supabase.rpc('night_community', { requested_day: day });
    if (!error && data) return { ...data, available: true };
  } catch { /* No invented users, votes or rankings in the fallback. */ }
  return { stories: [], leaders: [], available: false, error: 'The live community is not connected yet. Your practice story can still be saved on this device.' };
}
