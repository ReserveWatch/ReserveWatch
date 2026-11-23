import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { BRIEFS } from '../src/content/briefs.ts';
import { CLASS_PAGES } from '../src/content/commodities.ts';
import { LEARN_GUIDES } from '../src/content/learn.ts';
import { SNAPSHOTS } from '../src/content/snapshots.ts';
import { TOKENS } from '../src/config/tokens.ts';
import { loadNews, NEWS_LEDGERS, NEWS_TAGS, newsByTag, newsDays } from '../src/content/news.ts';
import { CHAIN_TOKENS } from '../src/ledgers/registry.ts';
import { app } from '../src/server.ts';

const decode = (s: string) => s
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function meta(html: string) {
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const description = decode(html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
  const ogTitle = decode(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? '');
  const ogDescription = decode(html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ?? '');
  return { title, description, ogTitle, ogDescription };
}

const paths = [
  '/', '/commodities', '/state', '/alerts', '/methodology', '/faq', '/about', '/independent',
  '/news', '/news/archive', '/ledger/xrpl', '/ledger/solana', '/ledger/stellar', '/ledger/all',
  ...newsDays(loadNews()).map(d => `/news/${d.date}`),
  ...NEWS_LEDGERS.map(name => `/news/ledger/${name}`),
  ...CHAIN_TOKENS.map(t => `/token/${t.id}`),
  ...loadNews().weeks.map(w => `/news/week/${w.week}`),
  ...NEWS_TAGS.filter(tag => newsByTag(tag).length > 0).map(tag => `/news/tag/${tag}`),
  '/disclaimer', '/terms', '/contact', '/privacy', '/license', '/snapshots', '/briefs', '/learn',
  '/learn/clawback-freeze-trust-lines',
  ...['gold', 'silver', 'platinum', 'energy', 'diamonds', 'palladium', 'oil', 'natural-gas', 'uranium', 'copper', 'timber', 'wheat', 'soybeans', 'corn', 'cotton', 'agriculture', 'other'].map(slug => {
    const tracked = CLASS_PAGES.some(c => c.slug === slug && TOKENS.some(t => c.codes.includes(t.metal)));
    return tracked ? `/${slug}` : `/commodities/${slug}`;
  }),
  ...TOKENS.map(t => `/token/${t.id}`),
  ...SNAPSHOTS.map(s => `/snapshots/${s.week}`),
  ...BRIEFS.map(b => `/briefs/${b.slug}`),
  ...LEARN_GUIDES.map(g => `/learn/${g.slug}`),
];

const live = new Set(['/', '/state', '/alerts', '/gold', '/silver', '/platinum', '/energy', '/diamonds', ...TOKENS.map(t => `/token/${t.id}`)]);

test('rendered titles and descriptions stay within search limits and stay unique', async () => {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const titles = new Map<string, string>();
  try {
    for (const path of paths) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.ok(res.status === 200 || res.status === 503, `${path} ${res.status}`);
      const html = await res.text();
      const m = meta(html);
      assert.ok(m.title.length > 0 && m.title.length <= 60, `${path} title ${m.title.length}: ${m.title}`);
      assert.ok(m.description.length > 0 && m.description.length <= 155, `${path} description ${m.description.length}: ${m.description}`);
      assert.equal(m.ogTitle, m.title, path);
      assert.equal(m.ogDescription, m.description, path);
      assert.equal(html.includes('http-equiv="refresh"'), false, path);
      if (live.has(path)) assert.match(html, /setTimeout\(function\(\)\{location\.reload\(\)\},60000\)/, path);
      else assert.equal(html.includes('location.reload'), false, path);
      const prev = titles.get(m.title);
      assert.equal(prev, undefined, `duplicate title "${m.title}" on ${path} and ${prev}`);
      titles.set(m.title, path);
      if (path === '/' || path === '/state' || path === '/snapshots') {
        assert.match(html, /"@type":"Dataset"/);
        assert.match(html, /"license":"https:\/\/thereservewatch\.com\/license"/);
      }
    }
    const license = await (await fetch(`http://127.0.0.1:${port}/license`)).text();
    assert.match(license, /https:\/\/thereservewatch\.com/);
    assert.match(license, /not investment advice/i);
    assert.equal(/creative commons/i.test(license), false);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
