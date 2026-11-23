import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { XMLParser } from './xml-parser.ts';
import { classPublicPath, datasetLd, llmsTxt, sitemapXml, snapshotsDatasetLd, tokenThingLd } from '../src/seo.ts';
import { SNAPSHOTS } from '../src/content/snapshots.ts';
import { app } from '../src/server.ts';
import { badgeEmbed, badgeSvg } from '../src/badge.ts';
import { stateAnswer, summarizeState } from '../src/state.ts';

function assertOrg(node: unknown, where: string) {
  const org = node as { '@type'?: string; '@id'?: string; name?: string; url?: string; logo?: { '@type'?: string; url?: string } };
  assert.equal(org?.['@type'], 'Organization', where);
  assert.equal(org.name, 'ReserveWatch', where);
  assert.equal(org.url, 'https://thereservewatch.com/', where);
  assert.equal(org['@id'], 'https://thereservewatch.com/#organization', where);
  assert.equal(org.logo?.['@type'], 'ImageObject', where);
  assert.equal(org.logo?.url, 'https://thereservewatch.com/logo.png', where);
}

test('Dataset creator and publisher are a typed Organization', async () => {
  for (const built of [datasetLd(), snapshotsDatasetLd()]) {
    assertOrg(built.creator, 'builder creator');
    assertOrg(built.publisher, 'builder publisher');
    assert.equal(built.license, 'https://thereservewatch.com/license');
  }
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const required = new Set(['/', '/state', '/snapshots']);
  const paths = ['/', '/state', '/snapshots', `/snapshots/${SNAPSHOTS[0].week}`, '/diamonds', '/commodities', '/news/2026-11-20'];
  try {
    for (const path of paths) {
      const html = await (await fetch(`http://127.0.0.1:${port}${path}`)).text();
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
      let datasets = 0;
      const walk = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        const record = node as Record<string, unknown>;
        const type = record['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes('Dataset')) {
          datasets += 1;
          assertOrg(record.creator, `${path} creator`);
          assertOrg(record.publisher, `${path} publisher`);
        }
        if ('publisher' in record && !types.includes('Organization')) assertOrg(record.publisher, `${path} publisher`);
        if ('creator' in record) assertOrg(record.creator, `${path} creator`);
        for (const value of Object.values(record)) walk(value);
      };
      blocks.forEach(walk);
      if (required.has(path)) assert.ok(datasets > 0, `${path} has a Dataset`);
    }
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('Dataset JSON-LD names the public reuse page as its license', () => {
  assert.equal(datasetLd().license, 'https://thereservewatch.com/license');
  assert.equal(snapshotsDatasetLd().license, 'https://thereservewatch.com/license');
  assert.ok(sitemapXml('2026-11-20', '2026-10-31').includes('https://thereservewatch.com/license'));
});

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
