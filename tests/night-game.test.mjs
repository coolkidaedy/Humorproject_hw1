import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { dateInNewYork, nextDay, validDay, destinationFor, validateGenerated, generateEpisode } from '../src/lib/night/generator.mjs';
const source = readFileSync(new URL('../src/lib/night/rules.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { newYorkDay, normalizeAnswer, deductionScore, validStory } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('daily keys change at New York midnight across standard time, DST, and year boundaries', () => {
  for (const [date, expected] of [['2026-10-14T03:59:59Z','2026-10-13'],['2026-10-14T04:00:00Z','2026-10-14'],['2026-01-02T04:59:59Z','2026-01-01'],['2026-01-02T05:00:00Z','2026-01-02'],['2026-03-08T07:30:00Z','2026-03-08']]) {
    assert.equal(newYorkDay(new Date(date)), expected); assert.equal(dateInNewYork(new Date(date)), expected);
  }
  assert.equal(nextDay('2026-12-31'), '2027-01-01');
  assert.equal(validDay('2026-02-30'), false);
  assert.equal(validDay('2026-13-01'), false);
});
test('deduction scoring penalizes clues and wrong guesses without awarding failed runs', () => {
  assert.equal(deductionScore(1,0,true),1000);
  assert.equal(deductionScore(2,1,true),700);
  assert.equal(deductionScore(4,2,true),200);
  assert.equal(deductionScore(4,3,false),0);
  assert.equal(deductionScore(1,0,false),0);
  assert.equal(normalizeAnswer('Grand CENTRAL!!!'),normalizeAnswer('Grand Central'));
});
test('story validation trims text and rejects invalid public handles and lengths', () => {
  assert.equal(validStory('Title','short','okay'),null);
  assert.equal(validStory('Title','x'.repeat(80),'bad name'),null);
  assert.equal(validStory('Title','x'.repeat(1201),'okay'),null);
  assert.equal(validStory(null,'x'.repeat(80),'okay'),null);
  assert.equal(validStory('  Title  ',' '+ 'x'.repeat(80)+' ','player_1').title,'Title');
});
const fixture = () => ({ title: 'The unplanned detour', brief: 'Nobody remembers agreeing to this plan. Four clues survived the night.', clues: ['message','receipt','note','dispatch'].map((kind,i) => ({ kind, time:'11:42 PM', label:'RECOVERED EVIDENCE', text: `A fictional incident with enough detail to be a useful hint number ${i}.`, fact_ids:[destinationFor('2026-10-13').facts[0].id] })) });
test('AI output rejects leaked answers, missing clues, unsupported facts and malformed artifacts', () => {
  const destination = destinationFor('2026-10-13');
  const good=fixture(); assert.equal(validateGenerated(good,destination).clues.length,4);
  for (const change of [x=>x.clues.pop(),x=>x.clues[0].fact_ids=['invented'],x=>x.clues[1].kind='message',x=>x.clues[0].time='yesterday',x=>x.title=destination.answer,x=>x.clues[3].text=`We were definitely at ${destination.answer} all along.`]) { const invalid=fixture();change(invalid);assert.throws(()=>validateGenerated(invalid,destination)); }
});
test('generator uses one daily destination, keeps thought text out, and fails closed on provider errors', async () => {
  const originalFetch=globalThis.fetch,originalKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='test-only';
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify({status:'completed',steps:[{type:'model_output',content:[{type:'thought',text:'not valid json'},{type:'text',text:JSON.stringify(fixture())}]}]}));
    const generated=await generateEpisode('2026-10-13');
    assert.equal(generated.answer,destinationFor('2026-10-13').answer);
    assert.equal(generated.day,'2026-10-13');
    globalThis.fetch=async()=>new Response('{}',{status:429});
    await assert.rejects(generateEpisode('2026-10-13'),/HTTP 429/);
    globalThis.fetch=async()=>new Response(JSON.stringify({status:'incomplete'}));
    await assert.rejects(generateEpisode('2026-10-13'),/incomplete/);
  } finally { globalThis.fetch=originalFetch; if(originalKey===undefined) delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey; }
});
