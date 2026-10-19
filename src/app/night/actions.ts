'use server';
import { revalidatePath } from 'next/cache';
import { serverSupabase } from '@/lib/supabase/server';
import { loadCommunity, practiceState, readPractice, savePractice } from '@/lib/night/server';
import { practiceNight } from '@/lib/night/practice';
import { newYorkDay, normalizeAnswer, validStory } from '@/lib/night/rules';
import { fallbackStoryDraft, generateStoryDraft } from '@/lib/night/story-generator';
import { fallbackStoryCase, generateStoryCase } from '@/lib/night/story-case-generator';
import { generateFreshEpisode } from '@/lib/night/generator.mjs';
import type { GameResult, GuessAttempt, NightState, StoryCaseResult } from '@/lib/night/types';

const practiceDraftLimit = 10;

export async function playNight(action: 'state' | 'reveal' | 'guess' | 'giveup' | 'restart', guess: string, mode: 'live' | 'practice', day: string): Promise<GameResult> {
  if (!['state', 'reveal', 'guess', 'giveup', 'restart'].includes(action) || !['live', 'practice'].includes(mode)) return { error: 'That move is unavailable.' };
  if (day !== newYorkDay()) return { error: 'A new night has started. Refresh to play today’s case.' };
  if (typeof guess !== 'string' || guess.length > 120 || (action === 'guess' && !guess.trim())) return { error: 'Enter a place name (up to 120 characters).' };
  try {
    if (mode === 'live') {
      if (action === 'restart') return { error: 'Ranked nights cannot be restarted.' };
      const supabase = await serverSupabase();
      const { data, error } = await supabase.rpc('night_play', { action_name: action, guess_text: guess });
      if (error) return { error: 'Couldn’t save that move. Please try again.' };
      if (data?.error) return { error: data.error };
      return { state: data, message: action === 'guess' && !data.finished ? 'Not quite. Follow the evidence. −100 points.' : undefined };
    }
    const savedProgress = await readPractice();
    const progress = action === 'restart' ? { guesses: [] as GuessAttempt[], day: newYorkDay(), revealed: 1, wrong: 0, finished: false, solved: false, storyGenerations: savedProgress.storyGenerations, storyGenerationVersion: savedProgress.storyGenerationVersion, recentAnswers: savedProgress.recentAnswers, episode: savedProgress.episode } : savedProgress;
    if (!progress.finished) {
      if (action === 'reveal') progress.revealed = Math.min(4, progress.revealed + 1);
      if (action === 'giveup') progress.finished = true;
      if (action === 'guess') {
        const aliases = progress.episode?.aliases || practiceNight.aliases;
        progress.solved = aliases.some(alias => normalizeAnswer(alias) === normalizeAnswer(guess));
        progress.guesses.push({ place: guess.trim(), clueCount: progress.revealed, correct: progress.solved });
        if (progress.solved) progress.finished = true;
        else { progress.wrong += 1; if (progress.wrong >= 3) progress.finished = true; }
      }
    }
    await savePractice(progress);
    return { state: practiceState(progress), message: action === 'guess' && !progress.finished ? 'Not quite. Follow the evidence. −100 points.' : undefined };
  } catch { return { error: 'Connection interrupted. Your last saved move is safe; please retry.' }; }
}
export async function generateNewPracticeCase(): Promise<GameResult> {
  try {
    const current = await readPractice();
    const currentAnswer = current.episode?.answer || practiceNight.answer;
    const recentAnswers = Array.from(new Set([...(current.recentAnswers || []), currentAnswer])).slice(-8);
    const generated = await generateFreshEpisode(newYorkDay(), globalThis.crypto.randomUUID(), recentAnswers);
    const episode = { title: generated.title, brief: generated.brief, answer: generated.answer, aliases: generated.aliases, explanation: generated.explanation, source: generated.source, clues: generated.clues };
    const progress = { guesses: [] as GuessAttempt[], day: newYorkDay(), revealed: 1, wrong: 0, finished: false, solved: false, storyGenerations: 0, storyGenerationVersion: current.storyGenerationVersion, recentAnswers: [...recentAnswers, generated.answer].slice(-8), episode };
    await savePractice(progress);
    return { state: practiceState(progress), message: 'New NYC case generated. Start with the first clue.' };
  } catch { return { error: 'Gemini could not create a new NYC case. Please try again.' }; }
}
export async function submitNightStory(day: string, title: string, body: string, alias: string, mode: 'live' | 'practice') {
  const input = validStory(title, body, alias);
  if (!input) return { error: 'Use a 3–80 character title, an 80–1,200 character story, and a 3–20 character handle (letters, numbers, underscores).' };
  if (!['live', 'practice'].includes(mode)) return { error: 'That story cannot be posted.' };
  if (day !== newYorkDay()) return { error: 'This night has closed. Refresh for the new case.' };
  try {
    if (mode === 'practice') {
      const generatedRun = await readPractice();
      if (!generatedRun.finished) return { error: 'Finish the case before posting its story.' };
    }
    const supabase = await serverSupabase();
    const rpc = mode === 'practice' ? 'night_submit_generated_story' : 'night_submit_story';
    const { data, error } = await supabase.rpc(rpc, { story_title: input.title, story_body: input.body, player_alias: input.alias });
    if (error) return { error: 'Your story couldn’t be published. Please retry.' };
    if (data?.error) return { error: data.error };
    revalidatePath('/');
    return { success: true };
  } catch { return { error: 'Your story couldn’t be published. Your draft is still here.' }; }
}
export async function voteNightStory(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'This story is unavailable.' };
  try {
    const supabase = await serverSupabase();
    const { data, error } = await supabase.rpc('night_vote', { story_id: id });
    if (error) return { error: 'Couldn’t save your vote. Please retry.' };
    if (data?.error) return { error: data.error };
    revalidatePath('/');
    return { success: true };
  } catch { return { error: 'Connection interrupted. Please retry your vote.' }; }
}
export async function refreshCommunity(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { stories: [], leaders: [], available: false };
  return loadCommunity(day);
}

export async function generateNightReconstruction(day: string, mode: 'live' | 'practice') {
  if (day !== newYorkDay() || !['live', 'practice'].includes(mode)) return { error: 'This night has closed. Refresh for today’s case.' };
  try {
    let supabase: Awaited<ReturnType<typeof serverSupabase>> | null = null;
    let signedIn = false;
    try {
      supabase = await serverSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      signedIn = Boolean(user);
    } catch { /* Practice generation remains available without the community connection. */ }
    if (mode === 'live' && (!supabase || !signedIn)) return { error: 'Sign in to let AI reconstruct your ranked night.' };
    let night: NightState;
    let practiceProgress: Awaited<ReturnType<typeof readPractice>> | null = null;
    if (mode === 'practice') { practiceProgress = await readPractice(); night = practiceState(practiceProgress); }
    else {
      const { data, error } = await supabase!.rpc('night_play', { action_name: 'state', guess_text: '' });
      if (error || !data || data.error) return { error: 'Couldn’t retrieve your guess trail. Please retry.' };
      night = data;
    }
    if (!night.finished || !night.answer) return { error: 'Finish the mystery to unlock your AI reconstruction.' };
    if (!process.env.GEMINI_API_KEY?.trim()) return { error: 'AI story generation is not configured on this deployment yet. Your draft is safe.' };
    // Read context from the server, never accept forged guesses or clue counts from the client.
    let remaining: number;
    let commitPracticeGeneration = false;
    if (signedIn && supabase) {
      const { data: budget, error: budgetError } = await supabase.rpc('night_reserve_story_generation');
      if (budgetError) return { error: 'The story writer is not ready on this deployment yet. Your draft is safe.' };
      if (budget?.error) return { error: budget.error as string };
      remaining = budget.remaining as number;
    } else {
      if (!practiceProgress) return { error: 'Sign in to generate a story for this case.' };
      if (practiceProgress.storyGenerations >= practiceDraftLimit) return { error: 'You’ve used this case’s ten practice drafts. You can still edit your current story or generate a new case.' };
      remaining = practiceDraftLimit - practiceProgress.storyGenerations - 1;
      commitPracticeGeneration = true;
    }
    let fallback = false;
    let draft;
    try { draft = await generateStoryDraft(night); }
    catch { draft = fallbackStoryDraft(night); fallback = true; }
    if (commitPracticeGeneration && practiceProgress) {
      practiceProgress.storyGenerations += 1;
      await savePractice(practiceProgress);
    }
    return { draft, remaining, fallback };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return { error: /^(Gemini |The configured Gemini |The AI |The story writer )/.test(message) ? message : 'Story generation was interrupted. Your current draft is unchanged; please retry.' };
  }
}

const validUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function prepareStoryCase(storyId: string) {
  if (!validUuid(storyId)) return { error: 'This story is unavailable.' };
  try {
    const supabase = await serverSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: 'Sign in to turn community stories into playable cases.' };
    const { data: source, error: sourceError } = await supabase.rpc('night_story_case_source', { source_story_id: storyId });
    if (sourceError) return { error: 'Community cases are not ready on this deployment yet.' };
    if (source?.error) return { error: source.error as string };
    if (source?.ready) return { href: `/night/story/${storyId}` };
    if (!process.env.GEMINI_API_KEY?.trim()) return { error: 'AI case generation is not configured on this deployment yet.' };
    const { data: budget, error: budgetError } = await supabase.rpc('night_reserve_case_generation');
    if (budgetError) return { error: 'Community case generation is not ready on this deployment yet.' };
    if (budget?.error) return { error: budget.error as string };
    let generated;
    try { generated = await generateStoryCase({ id: storyId, alias: source.alias, title: source.title, body: source.body }); }
    catch { generated = fallbackStoryCase({ id: storyId, alias: source.alias, title: source.title, body: source.body }); }
    const { data: saved, error: saveError } = await supabase.rpc('night_save_story_case', { source_story_id: storyId, case_payload: generated });
    if (saveError) return { error: 'The generated case could not be saved. Please try again.' };
    if (saved?.error) return { error: saved.error as string };
    revalidatePath('/');
    return { href: `/night/story/${storyId}`, remaining: budget.remaining as number };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return { error: /^(The AI |The case writer |This story )/.test(message) ? message : 'Case generation was interrupted. Please try again.' };
  }
}

export async function playStoryCase(storyId: string, action: 'state' | 'reveal' | 'guess' | 'giveup', guess = ''): Promise<StoryCaseResult> {
  if (!validUuid(storyId) || !['state', 'reveal', 'guess', 'giveup'].includes(action)) return { error: 'That community case is unavailable.' };
  if (typeof guess !== 'string' || guess.length > 120 || (action === 'guess' && !guess.trim())) return { error: 'Enter a place name (up to 120 characters).' };
  try {
    const supabase = await serverSupabase();
    const { data, error } = await supabase.rpc('night_story_case_play', { source_story_id: storyId, action_name: action, guess_text: guess });
    if (error) return { error: 'Couldn’t save that move. Please try again.' };
    if (data?.error) return { error: data.error as string };
    return { state: data, message: action === 'guess' && !data.finished ? 'Not this stop. The story has another turn. −100 points.' : undefined };
  } catch { return { error: 'Connection interrupted. Your last saved move is safe; please retry.' }; }
}
