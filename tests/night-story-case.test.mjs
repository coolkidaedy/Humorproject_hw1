import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const errorSource = readFileSync(new URL('../src/lib/gemini-error.ts', import.meta.url), 'utf8');
const { geminiError } = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(errorSource,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`);
const source = readFileSync(new URL('../src/lib/night/story-case-generator.ts', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(`const geminiError=${geminiError.toString()};\n${ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText}`).toString('base64')}`;
const { storyCasePrompt, validateStoryCase, generateStoryCase } = await import(moduleUrl);
const story = { id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', alias:'nightowl', title:'The clock made us confess', body:'We mistook Times Square for Grand Central Terminal, where the whispering wall carried the apology to the other corner.' };
const generated = { title:'The apology had an echo', brief:'A confession crossed the room before anyone found the train.', answer:'Grand Central Terminal', aliases:['Grand Central','GCT'], explanation:'The train reference, opposite corners, and a message that travels across the room point to the whispering gallery at Grand Central.', clues:[
  {kind:'message',time:'11:41 PM',label:'GROUP CHAT',text:'The apology somehow reached the opposite corner.'},
  {kind:'receipt',time:'11:52 PM',label:'POCKET RECEIPT',text:'One missed train and a coffee nobody remembers ordering.'},
  {kind:'note',time:'12:03 AM',label:'UNSENT NOTE',text:'Meet under the clock before the last departure.'},
  {kind:'dispatch',time:'12:09 AM',label:'SIGNAL REPORT',text:'Forty-second Street. Voices travel strangely near the dining concourse.'},
]};

test('story case prompt treats the post as source material and requires a named NYC place', () => {
  const prompt = storyCasePrompt(story);
  assert.match(prompt,/explicitly named/);
  assert.match(prompt,/Grand Central Terminal/);
  assert.match(prompt,/untrusted content/);
});

test('story case validation enforces four ordered artifacts and prevents answer leaks', () => {
  assert.deepEqual(validateStoryCase(generated), {...generated,aliases:['Grand Central Terminal','Grand Central','GCT']});
  assert.throws(()=>validateStoryCase({...generated,clues:generated.clues.slice(0,3)}),/four clues/);
  assert.throws(()=>validateStoryCase({...generated,clues:generated.clues.map((clue,i)=>i===0?{...clue,text:'Meet at Grand Central'}:clue)}),/gave away/);
  assert.throws(()=>validateStoryCase({...generated,clues:generated.clues.map((clue,i)=>i===1?{...clue,kind:'message'}:clue)}),/malformed/);
  assert.throws(()=>validateStoryCase({error:'no place'}),/specific NYC place/);
});

test('case generation strips thought content and keeps provider failures private', async () => {
  const originalFetch=globalThis.fetch, originalKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='test-only';
  try {
    globalThis.fetch=async()=>new Response(JSON.stringify({status:'completed',steps:[{type:'model_output',content:[{type:'thought',text:'private reasoning'},{type:'text',text:JSON.stringify(generated)}]}]}));
    assert.deepEqual((await generateStoryCase(story)).answer,'Grand Central Terminal');
    globalThis.fetch=async()=>new Response('private provider detail',{status:403});
    await assert.rejects(generateStoryCase(story),error=>/denied access/.test(error.message)&&!error.message.includes('private provider detail'));
  } finally { globalThis.fetch=originalFetch; if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey; }
});
