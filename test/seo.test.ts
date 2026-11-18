import assert from 'node:assert/strict';
import test from 'node:test';
import { XMLParser } from './xml-parser.ts';
import { classPublicPath, llmsTxt, sitemapXml, tokenThingLd } from '../src/seo.ts';
import { badgeEmbed, badgeSvg } from '../src/badge.ts';
import { stateAnswer, summarizeState } from '../src/state.ts';

test('the sitemap is well-formed, dated, and lists short class URLs once', () => {
  const xml = sitemapXml('2026-11-18', '2026-10-31');
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  const doc = new XMLParser().parse(xml);
  const urls = doc.urlset.url as { loc: string; lastmod: string }[];
  const locs = urls.map(u => u.loc);
  assert.equal(new Set(locs).size, locs.length);
  for (const u of urls) {
    assert.match(u.loc, /^https:\/\/thereservewatch\.com\//);
    assert.match(u.lastmod, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.ok(locs.includes('https://thereservewatch.com/gold'));
  assert.ok(locs.includes('https://thereservewatch.com/state'));
  assert.equal(locs.includes('https://thereservewatch.com/commodities/gold'), false);
  assert.ok(locs.includes('https://thereservewatch.com/commodities/palladium'));
  assert.equal(classPublicPath('gold'), '/gold');
  assert.equal(classPublicPath('palladium'), '/commodities/palladium');
});

test('a token is a Thing with measured properties and no offer', () => {
  const ld = tokenThingLd({
    id: 'assetiko-xaua', name: 'Assetiko XAUa', description: 'A public ledger reading.',
    properties: [{ name: 'Circulating supply', value: '1504' }, { name: 'Blank', value: '  ' }],
  });
  assert.equal(ld['@type'], 'Thing');
  assert.equal('offers' in ld, false);
  assert.equal(ld.additionalProperty.length, 1);
  const raw = JSON.stringify(ld);
  assert.equal(raw.includes('buy'), false);
});

test('the badge is a compact svg without a script, and the embed links back', () => {
  const svg = badgeSvg({ name: 'Assetiko XAUa', symbol: 'XAUa', line: '7-day volume $20 · 45 trades' });
  assert.match(svg, /<svg /);
  assert.equal(svg.includes('<script'), false);
  assert.match(svg, /Assetiko XAUa/);
  const html = badgeEmbed({
    pageUrl: 'https://thereservewatch.com/token/assetiko-xaua',
    imageUrl: 'https://thereservewatch.com/badge/assetiko-xaua.svg',
    name: 'Assetiko XAUa', symbol: 'XAUa',
  });
  assert.match(html, /href="https:\/\/thereservewatch\.com\/token\/assetiko-xaua"/);
});

test('the state sentence quotes the reading date and does not turn a gap into zero', () => {
  const summary = summarizeState([
    { id: 'a', name: 'A', issuer: 'r1', status: 'warn', depthUsd: 10, volumeUsd: 5, volumeMeasured: true },
    { id: 'b', name: 'B', issuer: 'r1', status: 'ok', depthUsd: null, volumeUsd: null, volumeMeasured: false },
  ], '2026-11-18T12:00:00Z', null);
  assert.equal(summary.issuers, 1);
  assert.equal(summary.tokens, 2);
  assert.equal(summary.depthUsd, 10);
  assert.equal(summary.volumeUsd, null);
  const line = stateAnswer(summary);
  assert.match(line, /2026-11-18/);
  assert.match(line, /not measured/);
  assert.equal(line.includes('$0'), false);
  const text = llmsTxt(line);
  assert.match(text, /Cite a reading as: ReserveWatch/);
  assert.match(text, /\/state/);
  assert.match(text, /\/gold/);
});
