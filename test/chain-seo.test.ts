import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { CHAIN_TOKENS } from '../src/ledgers/registry.ts';
import { llmsTxt, sitemapXml } from '../src/seo.ts';
import { app } from '../src/server.ts';

const MINT = '5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW';

function jsonLd(html: string): Record<string, unknown>[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
}

function typesOf(html: string): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const record = node as Record<string, unknown>;
    const type = record['@type'];
    if (typeof type === 'string') found.push(type);
    if (Array.isArray(type)) type.forEach(item => { if (typeof item === 'string') found.push(item); });
    for (const value of Object.values(record)) walk(value);
  };
  jsonLd(html).forEach(walk);
  return found;
}

test('chain pages match the XRPL metadata, FAQ, and cross-link standard', async () => {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = async (path: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: res.status, type: res.headers.get('content-type') ?? '', html: await res.text() };
  };
  try {
    const solana = await get('/ledger/solana');
    const stellar = await get('/ledger/stellar');
    const all = await get('/ledger/all');
    for (const page of [solana, stellar, all]) {
      assert.equal(page.status, 200);
      assert.match(page.html, /rel="canonical" href="https:\/\/thereservewatch\.com\/ledger\//);
      assert.match(page.html, /property="og:title"/);
      assert.match(page.html, /name="twitter:card" content="summary_large_image"/);
      assert.match(page.html, /name="description" content="[^"]*commodity/);
      const kinds = typesOf(page.html);
      for (const kind of ['Organization', 'BreadcrumbList', 'Dataset', 'FAQPage']) {
        assert.ok(kinds.includes(kind), kind);
      }
      assert.match(page.html, /"license":"https:\/\/thereservewatch\.com\/license"/);
      assert.match(page.html, /"creator":\{"@type":"Organization"/);
      assert.match(page.html, /"publisher":\{"@type":"Organization"/);
      assert.match(page.html, /<h2>Short answers<\/h2>/);
      assert.match(page.html, /Not available on this ledger/);
      assert.equal(/vault was verified|reserves were verified|audit was verified/i.test(page.html), false);
    }
    assert.match(solana.html, /href="\/gold"/);
    assert.match(solana.html, /href="\/token\/solana-paxg"/);
    assert.match(solana.html, /Does a Solana commodity-token reading prove gold is in a vault\?/);
    assert.match(solana.html, /"@type":"DataDownload"/);
    assert.match(solana.html, /\/api\/tokens\?ledger=solana/);
    assert.equal(solana.html.includes('"sameAs"'), false);

    const pax = await get('/token/solana-paxg');
    assert.match(pax.html, /<title>PAXG gold commodity token on Solana · ReserveWatch<\/title>/);
    assert.match(pax.html, /rel="canonical" href="https:\/\/thereservewatch\.com\/token\/solana-paxg"/);
    assert.match(pax.html, /Is PAXG on Solana backed\?/);
    assert.match(pax.html, /has not checked any vault/);
    assert.match(pax.html, /href="\/gold"/);
    assert.match(pax.html, /href="\/ledger\/solana"/);
    assert.match(pax.html, /href="\/token\/solana-xaut0"/);
    assert.equal(pax.html.includes('/token/stellar-paxg'), false);
    const paxTypes = typesOf(pax.html);
    assert.ok(paxTypes.includes('FAQPage'));
    assert.ok(paxTypes.includes('BreadcrumbList'));
    assert.ok(paxTypes.includes('Thing'));
    assert.equal(/vault was verified|reserves were verified|audit was verified/i.test(pax.html), false);

    const xaut = await get('/token/solana-xaut0');
    assert.match(xaut.html, /bridged commodity token/);
    const xaum = await get('/token/stellar-xaum');
    assert.match(xaum.html, /href="\/token\/solana-xaum"/);
    const solXaum = await get('/token/solana-xaum');
    assert.match(solXaum.html, /href="\/token\/stellar-xaum"/);

    const gold = await get('/gold');
    assert.match(gold.html, /<title>Gold commodity tokens · ReserveWatch<\/title>/);
    assert.match(gold.html, /commodity/);
    for (const token of CHAIN_TOKENS) assert.match(gold.html, new RegExp(`href="/token/${token.id}"`));
    assert.match(gold.html, /Which gold commodity tokens does ReserveWatch track on Solana and Stellar\?/);
    assert.equal(gold.html.includes('covers XRPL only'), false);
    assert.equal(/vault was verified|reserves were verified/i.test(gold.html), false);

    const silver = await get('/silver');
    assert.match(silver.html, /<title>Silver commodity tokens · ReserveWatch<\/title>/);
    assert.match(silver.html, /No Solana or Stellar silver commodity token is tracked/);
    assert.equal(silver.html.includes('/token/solana-'), false);
    assert.match(silver.html, /href="\/ledger\/solana"/);
    assert.match(silver.html, /href="\/ledger\/stellar"/);

    const faq = await get('/faq');
    assert.match(faq.html, /Is PAXG on Solana backed\?/);
    assert.match(faq.html, /\/api\/tokens\?ledger=solana/);
    assert.ok(typesOf(faq.html).includes('FAQPage'));

    const commodities = await get('/api/commodities/gold');
    const body = await commodities.html;
    const parsed = JSON.parse(body) as { otherLedgers: { id: string; ledger: string }[] };
    assert.ok(parsed.otherLedgers.some(row => row.id === 'solana-paxg' && row.ledger === 'solana'));
    assert.ok(parsed.otherLedgers.some(row => row.id === 'stellar-vnxau' && row.ledger === 'stellar'));
    const silverApi = JSON.parse((await get('/api/commodities/silver')).html) as { otherLedgers: unknown[] };
    assert.equal(silverApi.otherLedgers.length, 0);

    const llms = await (await get('/llms.txt')).html;
    assert.match(llms, /\/api\/tokens\?ledger=solana/);
    assert.match(llms, /\/api\/tokens\?ledger=stellar/);
    assert.match(llms, /\/api\/tokens\?ledger=all/);
    assert.match(llms, /\/token\/solana-paxg/);
    assert.match(llms, /\/token\/stellar-xaum/);
    assert.match(llms, /\/news\/feed\.xml\?ledger=solana/);
    assert.equal(llms.includes(MINT), false);
    assert.equal(llmsTxt().includes(MINT), false);

    const xml = sitemapXml('2026-11-24', '2026-11-22');
    assert.match(xml, /<loc>https:\/\/thereservewatch\.com\/ledger\/solana<\/loc><lastmod>2026-11-24<\/lastmod>/);
    assert.match(xml, /<loc>https:\/\/thereservewatch\.com\/token\/solana-paxg<\/loc><lastmod>2026-11-24<\/lastmod><changefreq>hourly<\/changefreq><priority>0\.8<\/priority>/);
    assert.match(xml, /<loc>https:\/\/thereservewatch\.com\/llms\.txt<\/loc><lastmod>2026-11-24<\/lastmod>/);
    assert.match(xml, /<loc>https:\/\/thereservewatch\.com\/faq<\/loc><lastmod>2026-11-24<\/lastmod>/);

    const solanaNews = await get('/news/ledger/solana');
    assert.match(solanaNews.html, /rel="canonical" href="https:\/\/thereservewatch\.com\/news\/ledger\/solana"/);
    assert.match(solanaNews.html, /application\/rss\+xml" title="ReserveWatch news" href="\/news\/feed\.xml\?ledger=solana"/);
    assert.match(solanaNews.html, /no items for this ledger yet/);
    const solanaFeed = await get('/news/feed.xml?ledger=solana');
    assert.match(solanaFeed.type, /application\/rss\+xml/);
    assert.match(solanaFeed.html, /ReserveWatch solana commodity news/);
    assert.equal(solanaFeed.html.includes('<item>'), false);
    const xrplFeed = await get('/news/feed.xml?ledger=xrpl');
    assert.match(xrplFeed.html, /XRPL lending upgrades/);
    const unknownFeed = await get('/news/feed.xml?ledger=nope');
    assert.equal(unknownFeed.html.includes('<item>'), false);

    const badge = await get('/badge/stellar-xaum.svg');
    assert.equal(badge.status, 200);
    assert.match(badge.type, /image\/svg\+xml/);
    assert.match(badge.html, /XAUm/);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
