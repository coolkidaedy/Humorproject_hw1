import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function source(path) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { validateNames, photoExtension } = await source('../src/lib/profile-validation.ts');
const { profileComplete } = await source('../src/lib/profile.ts');
test('names reject whitespace, missing values, and excessive length', () => {
  for (const pair of [[' ', 'Last'], ['First', '\t'], [null, 'Last'], ['a'.repeat(101), 'Last']]) assert.equal(validateNames(...pair), null);
  assert.deepEqual(validateNames('  Éva ', ' O’Brien  '), { first_name: 'Éva', last_name: 'O’Brien' });
});
test('missing rows and blank names require onboarding', () => {
  for (const profile of [null, {}, { first_name: 'A', last_name: ' ' }, { first_name: null, last_name: 'B' }]) assert.equal(profileComplete(profile), false);
  assert.equal(profileComplete({ first_name: 'A', last_name: 'B' }), true);
});
test('photo signatures must match allowed MIME types', () => {
  assert.equal(photoExtension(Uint8Array.from([137,80,78,71,13,10,26,10]), 'image/png'), 'png');
  assert.equal(photoExtension(Uint8Array.from([255,216,255]), 'image/jpeg'), 'jpg');
  assert.equal(photoExtension(Buffer.from('RIFFxxxxWEBP'), 'image/webp'), 'webp');
  assert.equal(photoExtension(Buffer.from('<svg></svg>'), 'image/png'), null);
  assert.equal(photoExtension(Uint8Array.from([255,216,255]), 'image/png'), null);
  assert.equal(photoExtension(new Uint8Array(), 'image/jpeg'), null);
});
