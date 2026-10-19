import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile=text=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const load=async path=>import(compile(readFileSync(new URL(path,import.meta.url),'utf8')));
const rules=await load('../src/lib/night/rules.ts');
const {geminiError}=await load('../src/lib/gemini-error.ts');
const {generateGeminiJson,resetGeminiModelCache}=await import('../src/lib/night/gemini-client.mjs');
const storyGeneratorSource=readFileSync(new URL('../src/lib/night/story-generator.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
globalThis.generateGeminiJsonTest=generateGeminiJson;
const {storyPrompt,validateStoryDraft,fallbackStoryDraft,generateStoryDraft}=await import(compile(`const geminiError=${geminiError.toString()};\nconst generateGeminiJson=globalThis.generateGeminiJsonTest;\n${storyGeneratorSource}`));
const finished=()=>({day:rules.newYorkDay(),mode:'live',number:1,title:'One quick stop',brief:'A very questionable night.',clues:[{kind:'message',text:'A confession in opposite corners.'},{kind:'receipt',text:'Meet us by the four-faced clock.'}],revealed:2,wrong:1,finished:true,solved:true,score:700,answer:'Grand Central Terminal',explanation:'A whispering gallery and a four-faced clock.',guesses:[{place:'Times Square',clueCount:1,correct:false},{place:'Grand Central',clueCount:2,correct:true}]});
const draft={title:'The wall knew first',body:'We were convinced we had reached Times Square. Then the wall started carrying our secrets. By the second clue, Grand Central was the only explanation for both the clock and our remarkably public confession.'};
test('story prompt uses actual guesses in order and does not invent guesses for a skipped case',()=>{
  const prompt=storyPrompt(finished());
  const context=JSON.parse(prompt.split('GAME CONTEXT:\n')[1]);
  assert.deepEqual(context.guesses_in_order,finished().guesses);
  assert.equal(context.clues_used_to_solve,2);
  assert.equal(context.final_location,'Grand Central Terminal');
  assert.throws(()=>storyPrompt({...finished(),finished:false}));
  const noGuesses=JSON.parse(storyPrompt({...finished(),guesses:[],solved:false}).split('GAME CONTEXT:\n')[1]);
  assert.deepEqual(noGuesses.guesses_in_order,[]);
  assert.equal(noGuesses.outcome,'revealed after getting lost');
});
test('story draft validation enforces editor limits and exposes only title and body',()=>{
  assert.deepEqual(validateStoryDraft({...draft,extra:'ignore'}),draft);
  for(const value of [null,{}, {...draft,title:'x'}, {...draft,body:'short'}, {...draft,body:'x'.repeat(1201)}]) assert.throws(()=>validateStoryDraft(value));
});
test('story fallback produces an editable reconstruction from guesses and clues',()=>{
  const value=fallbackStoryDraft(finished(),1);
  assert.match(value.body,/Times Square/);
  assert.match(value.body,/Grand Central Terminal/);
  assert.ok(value.body.length>=80&&value.body.length<=1200);
});
test('AI reconstruction strips thought content, validates JSON, and keeps provider errors private',async()=>{
  const originalFetch=globalThis.fetch,originalKey=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='test-only';let sent;
  try {
    resetGeminiModelCache();
    globalThis.fetch=async(url,options)=>{if(String(url).includes('?pageSize='))return new Response(JSON.stringify({models:[{name:'models/gemini-test-flash',supportedGenerationMethods:['generateContent']}]}));sent=JSON.parse(options.body);return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(draft)}]}}]}));};
    assert.deepEqual(await generateStoryDraft(finished()),draft);
    assert.match(sent.contents[0].parts[0].text,/Times Square/);
    globalThis.fetch=async()=>new Response('private provider details',{status:403});
    await assert.rejects(generateStoryDraft(finished()),error=>!error.message.includes('private provider details')&&/denied access/.test(error.message));
    globalThis.fetch=async()=>new Response(JSON.stringify({status:'incomplete'}));
    await assert.rejects(generateStoryDraft(finished()),/could not finish/);
  } finally {globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;}
});
let user={id:'verified-user'}, current=finished(), calls=0, budgetCalls=0, savedPractice=null, caseSource={ready:false,id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',alias:'nightowl',title:'A night',body:'We ended at Grand Central Terminal after the apology crossed the whispering gallery.'}, savedCase=null;
globalThis.nightActionTest={
  ...rules,revalidatePath:()=>{},loadCommunity:async()=>({}),practiceState:value=>value,readPractice:async()=>current,savePractice:async value=>{savedPractice=value;},practiceNight:{aliases:['Grand Central']},
  fallbackStoryDraft:()=>draft,
  fallbackStoryCase:()=>({title:'Fallback case',brief:'Four details survived the night and point to one last stop.',answer:'Grand Central Terminal',aliases:['Grand Central Terminal','Grand Central'],explanation:'The clues point to Grand Central Terminal.',clues:[]}),
  nextDay:day=>new Date(Date.parse(`${day}T12:00:00Z`)+86400000).toISOString().slice(0,10),
  destinationFor:()=>({answer:'Washington Square Park'}),
  generateEpisode:async day=>({day,title:'The arch after midnight',brief:'Four details from a very questionable walk through downtown.',answer:'Washington Square Park',aliases:['Washington Square Park','Washington Square'],explanation:'The arch, fountain, and chess tables identify Washington Square Park.',source:'https://nycgovparks.org/parks/washington-square-park',clues:[{kind:'message',time:'10:00 PM',label:'TEXT',text:'Meet by the marble arch after the fountain.'}]}),
  generateStoryDraft:async night=>{calls++;assert.deepEqual(night.guesses,finished().guesses);return draft;},
  generateStoryCase:async source=>{assert.deepEqual(source,{id:caseSource.id,alias:caseSource.alias,title:caseSource.title,body:caseSource.body});return {title:'Echo case',brief:'A missed train carried one apology too far.',answer:'Grand Central Terminal',aliases:['Grand Central Terminal','Grand Central'],explanation:'The clock and whispering corners point to Grand Central Terminal.',clues:[]};},
  serverSupabase:async()=>({auth:{getUser:async()=>({data:{user}})},rpc:async(name,args)=>{
    if(name==='night_reserve_story_generation'){budgetCalls++;return {data:{remaining:4}};}
    if(name==='night_story_case_source')return {data:caseSource};
    if(name==='night_reserve_case_generation')return {data:{remaining:2}};
    if(name==='night_save_story_case'){savedCase=args;return {data:{success:true}};}
    if(name==='night_story_case_play')return {data:{storyId:args.source_story_id,finished:false,revealed:1,clues:[]}};
    return {data:current};
  }}),
};
const actionSource=readFileSync(new URL('../src/app/night/actions.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const {generateNewPracticeCase,generateNightReconstruction,prepareStoryCase,playStoryCase}=await import(compile(`const {newYorkDay,normalizeAnswer,validStory,revalidatePath,loadCommunity,practiceState,readPractice,savePractice,practiceNight,fallbackStoryDraft,generateStoryDraft,fallbackStoryCase,generateStoryCase,nextDay,destinationFor,generateEpisode,serverSupabase}=globalThis.nightActionTest;\n${actionSource}`));
test('reconstruction action requires identity, a finished run and server-fetched guess history before calling AI',async()=>{
  const key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
  try{
    user=null;assert.match((await generateNightReconstruction(rules.newYorkDay(),'live')).error,/Sign in/);assert.equal(calls,0);
    user={id:'verified-user'};current={...finished(),finished:false};assert.match((await generateNightReconstruction(rules.newYorkDay(),'live')).error,/Finish/);assert.equal(budgetCalls,0);
    current=finished();assert.deepEqual((await generateNightReconstruction(rules.newYorkDay(),'live')).draft,draft);assert.equal(calls,1);assert.equal(budgetCalls,1);
    assert.match((await generateNightReconstruction('2000-01-01','live')).error,/closed/);assert.equal(calls,1);
  }finally{if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
test('finished practice players can generate from their hints without an account',async()=>{
  const key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
  try{
    user=null;savedPractice=null;current={...finished(),mode:'practice',storyGenerations:1};
    const result=await generateNightReconstruction(rules.newYorkDay(),'practice');
    assert.deepEqual(result.draft,draft);assert.equal(result.remaining,1);assert.equal(savedPractice.storyGenerations,2);
    current={...current,storyGenerations:3};
    assert.match((await generateNightReconstruction(rules.newYorkDay(),'practice')).error,/three practice drafts/);
  }finally{if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
test('a new practice case resets play and keeps a real NYC answer with its clues',async()=>{
  savedPractice=null;current={...finished(),mode:'practice',storyGenerations:1,storyGenerationVersion:2};
  const result=await generateNewPracticeCase();
  assert.equal(savedPractice.episode.answer,'Washington Square Park');
  assert.equal(savedPractice.finished,false);
  assert.equal(savedPractice.revealed,1);
  assert.equal(savedPractice.episode.title,'The arch after midnight');
  assert.equal(result.message,'New NYC case generated. Start with the first clue.');
});
test('community case generation reads the published story on the server and saves only validated AI output',async()=>{
  const key=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
  try{
    user={id:'verified-user'};savedCase=null;
    assert.deepEqual(await prepareStoryCase(caseSource.id),{href:`/night/story/${caseSource.id}`,remaining:2});
    assert.equal(savedCase.source_story_id,caseSource.id);
    assert.equal(savedCase.case_payload.answer,'Grand Central Terminal');
    caseSource={...caseSource,ready:true};savedCase=null;
    assert.deepEqual(await prepareStoryCase(caseSource.id),{href:`/night/story/${caseSource.id}`});
    assert.equal(savedCase,null);
    assert.match((await prepareStoryCase('forged')).error,/unavailable/);
    assert.equal((await playStoryCase(caseSource.id,'state')).state.storyId,caseSource.id);
  }finally{if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;}
});
