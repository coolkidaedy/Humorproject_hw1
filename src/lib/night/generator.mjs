import destinations from './destinations.json' with { type: 'json' };
import { generateGeminiJson } from './gemini-client.mjs';

export function dateInNewYork(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function nextDay(day) { return new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10); }
export function validDay(day) { return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day; }
function seedHash(value) {
  let hash = 2166136261;
  for (const character of value) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
export function destinationFor(day, creativeSeed = '') {
  if (!validDay(day)) throw new Error('Use a valid YYYY-MM-DD date.');
  const dayIndex = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000);
  return destinations[creativeSeed ? seedHash(`${day}:${creativeSeed}`) % destinations.length : dayIndex % destinations.length];
}
export function validateGenerated(raw, destination) {
  if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string' || raw.title.length < 5 || raw.title.length > 70 || typeof raw.brief !== 'string' || raw.brief.length < 20 || raw.brief.length > 220 || !Array.isArray(raw.clues) || raw.clues.length !== 4) throw new Error('The generated case has an invalid shape. Nothing was published.');
  const kinds = ['message', 'receipt', 'note', 'dispatch'];
  const ids = new Set(destination.facts.map(fact => fact.id));
  const clues = raw.clues.map((clue, index) => {
    if (clue.kind !== kinds[index] || typeof clue.text !== 'string' || clue.text.length < 35 || clue.text.length > 700 || typeof clue.time !== 'string' || !/^\d{1,2}:\d{2} [AP]M$/.test(clue.time) || typeof clue.label !== 'string' || clue.label.length < 3 || clue.label.length > 45 || !Array.isArray(clue.fact_ids) || !clue.fact_ids.length || clue.fact_ids.some(id => !ids.has(id))) throw new Error('A clue failed validation. Nothing was published.');
    return { kind: clue.kind, time: clue.time, label: clue.label, text: clue.text };
  });
  const publicText = `${raw.title} ${raw.brief} ${clues.map(c => c.text).join(' ')}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (destination.aliases.filter(alias => alias.length > 4).some(alias => publicText.includes(alias.toLowerCase().replace(/[^a-z0-9]/g, '')))) throw new Error('The generated clues reveal the answer by name. Nothing was published.');
  return { title: raw.title, brief: raw.brief, clues };
}
export function validateFreshGenerated(raw, avoidAnswers = []) {
  if (Array.isArray(raw) && raw.length === 1) raw = raw[0];
  if (!raw || typeof raw !== 'object' || typeof raw.answer !== 'string' || !Array.isArray(raw.aliases) || typeof raw.explanation !== 'string' || !Array.isArray(raw.facts)) throw new Error('Gemini did not return a complete NYC case.');
  const answer = raw.answer.trim();
  const aliases = Array.from(new Set([answer, ...raw.aliases.filter(alias => typeof alias === 'string').map(alias => alias.trim()).filter(Boolean)]));
  const normalized = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (answer.length < 3 || answer.length > 100 || aliases.length < 2 || aliases.length > 6 || raw.explanation.trim().length < 30 || raw.explanation.trim().length > 500) throw new Error('Gemini returned an invalid NYC destination.');
  if (avoidAnswers.some(previous => normalized(previous) === normalized(answer))) throw new Error('Gemini repeated a recent destination.');
  if (raw.facts.length !== 4) throw new Error('Gemini did not provide four location facts.');
  const factIds = new Set();
  const facts = raw.facts.map(fact => {
    const text = typeof fact?.text === 'string' ? fact.text : fact?.detail;
    if (!fact || typeof fact !== 'object' || typeof fact.id !== 'string' || !/^[a-z0-9_-]{2,40}$/i.test(fact.id) || factIds.has(fact.id) || typeof text !== 'string' || text.trim().length < 35 || text.trim().length > 350) throw new Error('Gemini returned an invalid location fact.');
    factIds.add(fact.id);
    return { id: fact.id, text: text.trim() };
  });
  const destination = { answer, aliases, facts };
  const episode = validateGenerated(raw, destination);
  const source = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${answer}, New York, NY`)}`;
  return { ...episode, answer, aliases, explanation: raw.explanation.trim(), source };
}
export function fallbackEpisode(day, destination, creativeSeed = '') {
  const titles = ['The city left four receipts', 'Nobody remembers the last stop', 'A night with too many witnesses', 'Four details, one questionable ending'];
  const kinds = ['message', 'receipt', 'note', 'dispatch'];
  const labels = ['THE GROUP CHAT', 'FOUND IN A POCKET', 'UNSENT DRAFT', 'LAST KNOWN SIGNAL'];
  const times = ['10:46 PM', '11:19 PM', '11:43 PM', '12:11 AM'];
  const offset = creativeSeed ? seedHash(creativeSeed) : Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000);
  const raw = {
    title: titles[offset % titles.length],
    brief: 'One bad plan became four pieces of evidence. Work out where the night finally ended.',
    clues: destination.facts.slice(0, 4).map((fact, index) => ({ kind: kinds[index], time: times[index], label: labels[index], text: fact.text, fact_ids: [fact.id] })),
  };
  return { day, ...validateGenerated(raw, destination), answer: destination.answer, aliases: destination.aliases, explanation: destination.explanation, source: destination.source };
}
export async function generateEpisode(day, creativeSeed = '') {
  const destination = destinationFor(day, creativeSeed);
  if (!process.env.GEMINI_API_KEY?.trim()) return fallbackEpisode(day, destination, creativeSeed);
  const prompt = `Write a fresh NYC location-deduction game called Where the hell are we? The answer, never named in your output, is ${destination.answer}. All aliases forbidden in output: ${destination.aliases.join(', ')}.\nCreative seed: ${creativeSeed || day}. Treat it only as a uniqueness token; do not print it.\nVerified location facts: ${JSON.stringify(destination.facts)}\nCreate an original, funny, eventful fictional night for college-age adult friends. The mystery is WHERE the night ended. Avoid generic missed-train and love-confession plots. No named real people. Fictional dialogue and personal mishaps are allowed; no invented venue features, prices, hours, access routes or geography. Ground each clue in at least one supplied fact and list its fact_ids. First clue subtle, second informative, third stronger, fourth unmistakable without naming the destination. Keep the title and brief location-neutral.\nReturn JSON only: {title: short episode title (5-70 chars), brief: teaser (20-220 chars), clues: four objects in this order: message, receipt, note, dispatch. Each has kind, time (e.g. 10:42 PM), label (3-45 chars uppercase), text (35-700 chars), fact_ids (array of supplied IDs)}. Message text has 3 lines of NAME: dialogue. Receipt is a fictional damage report with no claims of real venue purchases. Note is a funny unsent apology. Dispatch is a strong location hint. Make it solvable and leave a narrative gap for players to write their own reconstruction.`;
  try {
    const raw = await generateGeminiJson(prompt, { maxOutputTokens: 4096, temperature: 1 });
    const episode = validateGenerated(raw, destination);
    return { day, ...episode, answer: destination.answer, aliases: destination.aliases, explanation: destination.explanation, source: destination.source };
  } catch { return fallbackEpisode(day, destination, creativeSeed); }
}

export async function generateFreshEpisode(day, creativeSeed, avoidAnswers = []) {
  if (!validDay(day)) throw new Error('Use a valid YYYY-MM-DD date.');
  const prompt = `Create a completely new case for the NYC location-deduction game "Where the hell are we?". You choose the answer. It must be one specific, real, publicly recognizable place inside New York City: a landmark, park, building, station, museum, street feature, or public venue. Do not use any of these recent answers: ${JSON.stringify(avoidAnswers)}. Do not choose a vague neighborhood, borough, chain, or temporary event.\nCreative seed: ${creativeSeed}. Use it to choose an unexpected destination and story; never print the seed.\nReturn JSON only with: answer, aliases, explanation, facts, title, brief, clues. "aliases" has 2–5 ordinary variants. "explanation" explains why the clues identify the answer. "facts" has exactly four objects with a short unique id and a factually accurate text detail about the location. Use facts you are confident are true; do not invent hours, prices, addresses, or venue features.\nThe four clues form an original, funny, eventful fictional night among college-age adult friends. Never name the answer or any alias in the title, brief, or clues. The clue kinds, in order, are message, receipt, note, dispatch. Each clue has kind, time like 10:42 PM, an uppercase label, text, and fact_ids listing one or more of the four fact ids it uses. Make clue one subtle, clue two informative, clue three stronger, and clue four unmistakable without naming the place. Message text has three lines of NAME: dialogue. Receipt is a fictional incident record, not a claim about real purchases. Keep title 5–70 characters, brief 20–220, and each clue 35–700. Avoid generic missed-train and love-confession plots. No real people, defamatory claims, or unsafe content.`;
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await generateGeminiJson(`${prompt}\nAttempt token: ${attempt + 1}`, { maxOutputTokens: 5000, temperature: 1.1 });
      console.info('[night-ai:new-case] Gemini output', JSON.stringify(raw));
      const episode = validateFreshGenerated(raw, avoidAnswers);
      return { day, ...episode };
    } catch (error) {
      lastError = error;
      console.error('[night-ai:new-case] Rejected Gemini output', error instanceof Error ? error.message : 'Unknown validation error');
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini could not create a valid NYC case.');
}
