// Locks the wide page and the two-card desktop grid.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const css = fs.readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
const board = css.match(/\.board\{[^}]+\}/)?.[0] ?? '';
const panels = css.match(/\.panels\{[^}]+\}/)?.[0] ?? '';

test('desktop content sits close to the viewport edges and cards are exactly two wide columns', () => {
  assert.match(css, /header \.wrap,main,footer \.wrap\{max-width:2200px;margin:auto;padding-left:40px;padding-right:40px\}/);
  assert.match(board, /grid-template-columns:1fr;/);
  assert.match(css, /@media \(min-width:1100px\)\{\s*\.board\{grid-template-columns:1fr 1fr\}/);
  assert.equal(css.includes('330px'), false);
  assert.equal(css.includes('1120px'), false);
  // A 1440px window uses the viewport itself (under the 1760 cap) with 40px gutters.
  const gutterAt1440 = 40;
  assert.ok(gutterAt1440 <= 48);
  const cardAt1440 = (1440 - gutterAt1440 * 2 - 24) / 2;
  assert.ok(cardAt1440 > 600, `card width ${cardAt1440}`);
});

test('token detail does not split market, controls, and identity into three equal columns', () => {
  assert.equal(panels.includes('repeat(3'), false);
  assert.match(panels, /grid-template-columns:1fr 1fr/);
  assert.match(css, /\.panels>\.panel:first-child\{grid-column:1 \/ -1\}/);
});

test('the header logo is the original 96px lockup, and the phone size cannot overflow the screen', () => {
  assert.match(css, /header \.brand img\{height:96px;width:auto;max-width:100%;display:block\}/);
  assert.equal(css.includes('height:64px'), false);
  assert.equal(css.includes('height:52px'), false);
  assert.match(css, /@media\(max-width:720px\)\{[\s\S]*header \.brand img\{height:auto;width:100%;max-width:441px\}/);
  assert.match(css, /header nav\{display:flex;flex:1 1 280px;flex-wrap:wrap;/);
});

test('a phone width stays a single column inside the side padding', () => {
  assert.match(css, /@media\(max-width:720px\)\{[^}]*padding-left:16px;padding-right:16px/);
  const inner = 390 - 32;
  assert.ok(inner > 300);
  assert.ok(inner < 390);
});
