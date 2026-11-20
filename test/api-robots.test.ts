import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { CLASS_PAGES } from '../src/content/commodities.ts';
import { robotsTxt, sitemapXml } from '../src/seo.ts';
import { app } from '../src/server.ts';

const diamonds = CLASS_PAGES.find(c => c.slug === 'diamonds')!;

test('diamond title and description match the search and stay within the length limits', () => {
  assert.ok(diamonds.title.length <= 60, diamonds.title);
  assert.ok(diamonds.description.length <= 155, diamonds.description);
  assert.match(diamonds.title.toLowerCase(), /diamond/);
  assert.match(diamonds.description.toLowerCase(), /diamond token/);
  assert.match(diamonds.description.toLowerCase(), /how diamond tokenization works/);
  assert.equal(/vitta/i.test(diamonds.title + diamonds.description), false);
});

test('api responses are noindex, robots.txt still allows them, and pages do not canonicalize to /api', async () => {
  const robots = robotsTxt();
  const blocked = robots.split('\n').some(line => /^disallow:\s*\/api\/?\s*$/i.test(line.trim()));
  assert.equal(blocked, false);
  assert.match(robots, /Sitemap:/);
  const sitemap = sitemapXml('2026-11-20', '2026-10-31');
  assert.equal(sitemap.includes('/api/'), false);

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`);
  try {
    const json = await get('/api/tokens');
    assert.equal(json.headers.get('x-robots-tag'), 'noindex');
    assert.match(json.headers.get('content-type') ?? '', /json/);
    const csv = await get('/api/tokens.csv');
    assert.equal(csv.headers.get('x-robots-tag'), 'noindex');
    const missing = await get('/api/commodities/no-such-class');
    assert.equal(missing.headers.get('x-robots-tag'), 'noindex');
    const page = await get('/diamonds');
    const html = await page.text();
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? '';
    const ogDescription = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ?? '';
    assert.equal(title, diamonds.title);
    assert.equal(description, diamonds.description);
    assert.equal(ogTitle, title);
    assert.equal(ogDescription, description);
    assert.match(html, /<h2>How does diamond tokenization work\?<\/h2>/);
    assert.match(html, /"@type":"Question","name":"How does diamond tokenization work\?"/);
    assert.equal(/rel="canonical" href="[^"]*\/api\//.test(html), false);
    assert.match(html, /rel="canonical" href="https:\/\/thereservewatch\.com\/diamonds"/);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
