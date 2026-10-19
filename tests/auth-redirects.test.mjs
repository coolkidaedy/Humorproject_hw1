import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = text => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`;
const urls = await import(compile(readFileSync(new URL('../src/lib/auth-urls.ts', import.meta.url), 'utf8')));
const { oauthCallbackUrl, requestOrigin, PRODUCTION_ORIGIN } = urls;
test('OAuth begins and returns on the same host, including Vercel previews and local development', () => {
  assert.equal(oauthCallbackUrl(PRODUCTION_ORIGIN), `${PRODUCTION_ORIGIN}/auth/callback`);
  assert.equal(oauthCallbackUrl('https://preview-123.vercel.app'), 'https://preview-123.vercel.app/auth/callback');
  assert.equal(oauthCallbackUrl('http://localhost:3000'), 'http://localhost:3000/auth/callback');
  assert.throws(() => oauthCallbackUrl('http://untrusted.example'));
  assert.throws(() => oauthCallbackUrl('https://user:password@example.com'));
});
test('deployed callback never falls back to localhost and rejects untrusted forwarded hosts', () => {
  assert.equal(requestOrigin('http://localhost:3000/auth/callback', null, { deployed: true }), PRODUCTION_ORIGIN);
  assert.equal(requestOrigin('http://localhost:3000/auth/callback', 'humorprojecthw1.vercel.app', { deployed: true }), PRODUCTION_ORIGIN);
  assert.equal(requestOrigin('http://localhost:3000/auth/callback', 'attacker.example', { deployed: true }), PRODUCTION_ORIGIN);
  assert.equal(requestOrigin('http://localhost:3000/auth/callback', 'humorprojecthw1.vercel.app@attacker.example', { deployed: true }), PRODUCTION_ORIGIN);
  assert.equal(requestOrigin('http://localhost:3000/auth/callback', null, { deployed: true, siteUrl: 'http://localhost:3000' }), PRODUCTION_ORIGIN);
  assert.equal(requestOrigin('https://preview-123.vercel.app/auth/callback', null, { deployed: true }), 'https://preview-123.vercel.app');
  assert.equal(requestOrigin('http://localhost:3000/auth/callback', 'preview-123.vercel.app', { deployed: true, deploymentUrl: 'preview-123.vercel.app' }), 'https://preview-123.vercel.app');
  assert.equal(requestOrigin('http://127.0.0.1:3000/auth/callback', null), 'http://127.0.0.1:3000');
});

let complete = true, validCode = true;
class FakeResponse {
  headers = new Headers();
  cookies = { values: [], set: (name, value, options) => this.cookies.values.push({name, value, ...options}), getAll: () => this.cookies.values };
  static redirect(url) { const response=new FakeResponse(); response.headers.set('Location',String(url)); return response; }
}
globalThis.authCallbackTest = {
  NextResponse: FakeResponse,
  authOrigin: request => requestOrigin(request.url, request.headers.get('x-forwarded-host'), { deployed: true }),
  supabaseConfig: () => ({url:'https://test.supabase.co',key:'public-test-key'}),
  profileComplete: () => complete,
  readProfile: async () => ({first_name:'Test',last_name:'Player'}),
  createServerClient: (_url,_key,{cookies}) => ({auth:{exchangeCodeForSession:async()=>{
    if(!validCode)return {data:{user:null},error:{message:'expired'}};
    cookies.setAll([{name:'session',value:'fake-test-session',options:{httpOnly:true}}],{'Cache-Control':'private, no-store'});
    return {data:{user:{id:'verified-test-user'}},error:null};
  }}}),
};
const source = readFileSync(new URL('../src/app/auth/callback/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const {GET} = await import(compile(`const {NextResponse,authOrigin,supabaseConfig,profileComplete,readProfile,createServerClient}=globalThis.authCallbackTest;\n${source}`));
const request = path => ({url:`http://localhost:3000${path}`,nextUrl:new URL(`http://localhost:3000${path}`),headers:new Headers({'x-forwarded-host':'humorprojecthw1.vercel.app'}),cookies:{getAll:()=>[],set:()=>{}}});
test('successful deployed callback keeps session cookies and lands on the gated members route', async()=>{
  complete=true;validCode=true;
  const response=await GET(request('/auth/callback?code=test-code'));
  assert.equal(response.headers.get('Location'),`${PRODUCTION_ORIGIN}/protected`);
  assert.equal(response.cookies.values[0].name,'session');
  assert.match(response.headers.get('Cache-Control'),/no-store/);
});
test('onboarding and rejected callbacks stay on the deployed domain',async()=>{
  complete=false;validCode=true;
  assert.equal((await GET(request('/auth/callback?code=test-code'))).headers.get('Location'),`${PRODUCTION_ORIGIN}/profile`);
  validCode=false;
  assert.equal((await GET(request('/auth/callback?code=expired'))).headers.get('Location'),`${PRODUCTION_ORIGIN}/login?error=callback`);
  assert.equal((await GET(request('/auth/callback'))).headers.get('Location'),`${PRODUCTION_ORIGIN}/login?error=callback`);
});
