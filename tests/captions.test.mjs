import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = text => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`;
const validation = await import(compile(readFileSync(new URL('../src/lib/caption-validation.ts', import.meta.url), 'utf8')));
const { generationInput, voteInput, buildPrompt, dailyPrompt } = validation;
const { geminiError } = await import(compile(readFileSync(new URL('../src/lib/gemini-error.ts', import.meta.url), 'utf8')));
test('provider errors distinguish configuration, access, quota and outages without leaking responses', () => {
  for (const [status, pattern] of [[400, /configuration/], [401, /API key/], [403, /denied access/], [404, /model is unavailable/], [429, /quota/], [503, /temporarily unavailable/]]) {
    const result = geminiError(status, { error: { message: 'secret-test-key' } });
    assert.match(result, pattern);
    assert.ok(!result.includes('secret-test-key'));
  }
  assert.match(geminiError(400, { error: { message: 'API key not valid' } }), /rejected the API key/);
  assert.match(geminiError(400, { error: { message: 'Free tier is not available in your country' } }), /billing setup/);
  assert.match(geminiError(404, null), /model is unavailable/);
});
test('generation rejects malformed, short, oversized inputs and unknown tones', () => {
  for (const input of [[null, 'Dry humor'], ['tiny', 'Dry humor'], ['a'.repeat(601), 'Dry humor'], ['A valid situation', 'evil']]) assert.equal(generationInput(...input), null);
  assert.deepEqual(generationInput('  A valid situation  ', 'Dry humor'), { prompt: 'A valid situation', tone: 'Dry humor' });
  assert.ok(buildPrompt('My situation', 'Dry humor').endsWith('Situation: My situation'));
  assert.equal(dailyPrompt(new Date('2026-10-06T01:00:00Z')), dailyPrompt(new Date('2026-10-06T23:59:00Z')));
});
test('vote rejects forged values and invalid IDs', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  for (const value of ['0', '2', '1.0', null, 1]) assert.equal(voteInput(id, value), null);
  assert.equal(voteInput('not-an-id', '1'), null);
  assert.deepEqual(voteInput(id, '-1'), { id, value: -1 });
});
// Load the actual Server Actions with only their framework/network boundaries mocked.
let actionSource = readFileSync(new URL('../src/app/captions/actions.ts', import.meta.url), 'utf8');
actionSource = actionSource.replace(/import .* from .*;\n/g, '');
actionSource = `const { revalidatePath, serverSupabase, buildPrompt, generationInput, voteInput, geminiError } = globalThis.captionTest;\n${actionSource}`;
let client;
const refreshed = [];
globalThis.captionTest = { ...validation, geminiError, revalidatePath: path => refreshed.push(path), serverSupabase: async () => client };
const { generateCaption, voteCaption } = await import(compile(actionSource));
const form = values => { const f = new FormData(); for (const [key, value] of Object.entries(values)) f.set(key, value); return f; };
test('actions enforce authentication and save only verified user identity', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'A funny caption.' }] } }] })); };
  process.env.GEMINI_API_KEY = 'test-only';
  try {
    client = { auth: { getUser: async () => ({ data: { user: null } }) } };
    const input = form({ prompt: 'Taking the subway for cheap dinner', tone: 'Dry humor', user_id: 'forged' });
    assert.match((await generateCaption({}, input)).error, /Log in/);
    assert.match((await voteCaption({}, form({ caption_id: '11111111-1111-4111-8111-111111111111', value: '1' }))).error, /Log in/);
    assert.equal(calls, 0);
    let saved;
    client = { auth: { getUser: async () => ({ data: { user: { id: 'verified' } } }) }, rpc: async () => ({ data: false }) };
    assert.match((await generateCaption({}, input)).error, /10 generation attempts/);
    assert.equal(calls, 0);
    client.rpc = async () => ({ data: true });
    client.from = () => ({ insert: row => { saved = row; return { select: () => ({ single: async () => ({ data: { id: 'saved-id' } }) }) }; } });
    assert.equal((await generateCaption({}, input)).captionId, 'saved-id');
    assert.equal(saved.user_id, 'verified');
    assert.equal(saved.prompt, buildPrompt('Taking the subway for cheap dinner', 'Dry humor'));
    assert.equal(saved.content, 'A funny caption.');
    client.from = () => ({ insert: () => ({ select: () => ({ single: async () => ({ error: { message: 'denied' } }) }) }) });
    assert.match((await generateCaption({}, input)).error, /could not be saved/);
    client.from = () => ({ upsert: async row => { saved = row; return {}; } });
    assert.equal((await voteCaption({}, form({ caption_id: '11111111-1111-4111-8111-111111111111', value: '-1', user_id: 'forged' }))).success, 'Vote saved.');
    assert.equal(saved.user_id, 'verified');
    assert.equal(saved.value, -1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
    delete globalThis.captionTest;
  }
});
