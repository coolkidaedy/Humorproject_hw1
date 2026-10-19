import destinations from './destinations.json' with { type: 'json' };

export function dateInNewYork(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function nextDay(day) { return new Date(Date.parse(`${day}T12:00:00Z`) + 86400000).toISOString().slice(0, 10); }
export function validDay(day) { return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day; }
export function destinationFor(day) {
  if (!validDay(day)) throw new Error('Use a valid YYYY-MM-DD date.');
  return destinations[Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000) % destinations.length];
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
export async function generateEpisode(day) {
  const destination = destinationFor(day);
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL?.replace(/^models\//, '') || 'gemini-3.8-flash';
  if (!apiKey) throw new Error('GEMINI_API_KEY is required to generate a daily episode.');
  const prompt = `Write a daily NYC location-deduction game called Where the hell are we? for ${day}. The answer, never named in your output, is ${destination.answer}. All aliases forbidden in output: ${destination.aliases.join(', ')}.\nVerified location facts: ${JSON.stringify(destination.facts)}\nCreate an original, funny, eventful fictional night for college-age adult friends. The mystery is WHERE the night ended. Do not reuse a missed train/love-confession scenario. No named real people. Fictional dialogue and personal mishaps are allowed; no invented venue features, prices, hours, access routes or geography. Ground each clue in at least one supplied fact and list its fact_ids. First clue subtle, second informative, third stronger, fourth unmistakable without naming the destination. Keep the title and brief location-neutral.\nReturn JSON only: {title: short episode title (5-70 chars), brief: teaser (20-220 chars), clues: four objects in this order: message, receipt, note, dispatch. Each has kind, time (e.g. 10:42 PM), label (3-45 chars uppercase), text (35-700 chars), fact_ids (array of supplied IDs)}. Message text has 3 lines of NAME: dialogue. Receipt is a fictional damage report with no claims of real venue purchases. Note is a funny unsent apology. Dispatch is a strong location hint. Make it solvable and leave a narrative gap for players to write their own reconstruction.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 } }), signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`AI generation failed (HTTP ${response.status}). Nothing was published.`);
  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') throw new Error('Generation was incomplete. Nothing was published.');
  const text = candidate.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('');
  let raw; try { raw = JSON.parse(text); } catch { throw new Error('AI returned invalid JSON. Nothing was published.'); }
  const episode = validateGenerated(raw, destination);
  return { day, ...episode, answer: destination.answer, aliases: destination.aliases, explanation: destination.explanation, source: destination.source };
}
