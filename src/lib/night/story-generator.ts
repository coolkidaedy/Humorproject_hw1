import type { NightState } from './types';
import { generateGeminiJson } from './gemini-client.mjs';

export type StoryDraft = { title: string; body: string };
const cleanSentence = (value: string) => value.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
export function storyPrompt(night: NightState, writerName: string) {
  if (!night.finished || !night.answer) throw new Error('Finish the case before generating its story.');
  const clues = night.clues.slice(0, Math.max(1, night.revealed)).map(clue => clue.text);
  return `Write a funny first-person story from these NYC game clues. The narrator is named ${writerName}; include that exact name naturally in the story. End at ${night.answer}. Return only JSON with a "title" under 80 characters and a "body" between 80 and 1,200 characters. Keep the story fictional and use concrete details from at least two clues.\n\nCLUES:\n${JSON.stringify(clues)}\n\nPLAYER GUESSES:\n${JSON.stringify(night.guesses || [])}`;
}
export function validateStoryDraft(value: unknown): StoryDraft {
  if (!value || typeof value !== 'object' || !('title' in value) || !('body' in value) || typeof value.title !== 'string' || typeof value.body !== 'string') throw new Error('The AI returned an incomplete story. Your current draft is unchanged.');
  const title = value.title.trim(), body = value.body.trim();
  if (title.length < 3 || title.length > 80 || body.length < 80 || body.length > 1200) throw new Error('The AI story did not fit the editor. Your current draft is unchanged; please try again.');
  return { title, body };
}
export function fallbackStoryDraft(night: NightState, variant = Date.now()): StoryDraft {
  if (!night.finished || !night.answer) throw new Error('Finish the case before generating its story.');
  const guesses = night.guesses || [];
  const wrong = guesses.filter(guess => !guess.correct).map(guess => guess.place);
  const clueText = night.clues.slice(0, Math.max(1, night.revealed)).map(clue => cleanSentence(clue.text));
  const titles = ['The Night the Clues Started Talking', 'Four Clues and Absolutely No Plan', 'A Very Public Wrong Turn', 'The City Made Us Explain Ourselves'];
  const wrongTurn = wrong.length
    ? `Our theory started at ${wrong.join(', then ')}, each guess delivered with the confidence of people who had misunderstood almost everything.`
    : guesses.some(guess => guess.correct)
      ? `Our first real theory was ${night.answer}, delivered with suspicious confidence before anyone could talk us out of it.`
      : 'We skipped the confident guesses and asked for directions, which somehow became the most dramatic decision of the night.';
  const evidence = clueText.length
    ? `The evidence was not subtle in hindsight: ${clueText.slice(0, 2).join('; ')}.`
    : 'The evidence arrived as a collection of details that only looked obvious after the fact.';
  const ending = night.solved
    ? `By clue ${night.revealed}, the pieces finally pointed to ${night.answer}. We called it deduction; everyone else called it finally paying attention.`
    : `Eventually the city gave up on our detective work and revealed ${night.answer}. We accepted the answer with the dignity of people who had been confidently lost.`;
  return validateStoryDraft({ title: titles[Math.abs(variant) % titles.length], body: `We said this would be one quick stop. ${wrongTurn} ${evidence} ${ending} Nobody agreed on the exact sequence afterward, but we all agreed the clues made a better narrator than we did.` });
}
export async function generateStoryDraft(night: NightState, writerName: string): Promise<StoryDraft> {
  const name = writerName.replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}][\p{L}' -]{0,38}[\p{L}]$/u.test(name)) throw new Error('Add your name (2–40 letters) before generating the story.');
  const value = await generateGeminiJson(`${storyPrompt(night, name)}\n\nMake this version unique: ${globalThis.crypto.randomUUID()}`, { maxOutputTokens: 1600, temperature: 1 });
  console.info('[night-ai:story] Gemini output', JSON.stringify(value));
  const draft = validateStoryDraft(value);
  return draft.body.toLocaleLowerCase().includes(name.toLocaleLowerCase()) ? draft : validateStoryDraft({ ...draft, body: `I’m ${name}, and this is how it happened. ${draft.body}` });
}
