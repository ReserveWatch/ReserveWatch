import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { dayNeighbors, describeHeadlines, loadNews, newsDayTitle, newsDays, newsTagTitle, newsWeekTitle, resetNewsCacheForTests, validateNews, type NewsFile } from '../src/content/news.ts';
import { SNAPSHOTS } from '../src/content/snapshots.ts';
import { llmsTxt, sitemapXml } from '../src/seo.ts';
import { app } from '../src/server.ts';
import { XMLParser } from './xml-parser.ts';

const seed = (): NewsFile => JSON.parse(fs.readFileSync(new URL('../src/content/news-seed.json', import.meta.url), 'utf8'));
const today = '2026-11-22';

function jsonLd(html: string): unknown[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
}

test('the validator rejects HTML, an unknown tag, a missing source, a long summary, and a future date', () => {
  const ok = validateNews(seed(), today);
  assert.equal(ok.version, 1);
  assert.equal(ok.items.length, 3);
  assert.equal(ok.weeks[0].week, '2026-W47');
  const html = seed();
  html.items[0].summary = '<b>nope</b>';
  assert.throws(() => validateNews(html, today), /HTML/);
  const tag = seed();
  tag.items[0].tags = ['bitcoin'];
  assert.throws(() => validateNews(tag, today), /unknown tag/);
  const source = seed();
  delete (source.items[0] as { source?: unknown }).source;
  assert.throws(() => validateNews(source, today), /source/);
  const long = seed();
  long.items[0].summary = 'x'.repeat(421);
  assert.throws(() => validateNews(long, today), /420/);
  const future = seed();
  future.items[0].date = '2099-01-01';
  future.items[0].id = '2099-01-01-ecb-appia-call';
  future.items[0].publishedAt = '2099-01-01T12:00:00.000Z';
  assert.throws(() => validateNews(future, today), /future/);
  const description = describeHeadlines('Nov 20: ', ok.items.map(item => item.headline));
  assert.ok(description.length <= 155, description);
  assert.equal(newsDayTitle('2026-11-20'), 'Tokenized commodities news, Nov 20, 2026 · ReserveWatch');
  assert.equal(newsWeekTitle('2026-W47'), 'Week 47 tokenized commodities roundup · ReserveWatch');
  assert.equal(newsTagTitle('gold'), 'Tokenized gold news · ReserveWatch');
  assert.equal(newsTagTitle('xrpl'), 'XRPL news for tokenized commodities · ReserveWatch');
  assert.equal(newsTagTitle('other-chains'), 'Other chains: tokenized commodities news · ReserveWatch');
  assert.ok(newsDayTitle('2026-11-20').length <= 60);
});

test('neighbors point at the older and newer published days', () => {
  const days = [{ date: '2026-11-20', items: [] }, { date: '2026-11-18', items: [] }];
  assert.deepEqual(dayNeighbors(days, '2026-11-20'), { prev: '2026-11-18', next: null });
  assert.deepEqual(dayNeighbors(days, '2026-11-18'), { prev: null, next: '2026-11-20' });
});

test('tag and ledger filters stay out of the sitemap even with five items', () => {
  const doc = seed();
  const add = (index: number, slug: string, dates: string[]) => {
    for (const date of dates) {
      const copy = structuredClone(doc.items[index]);
      copy.id = `${date}-${slug}-extra`;
      copy.date = date;
      copy.publishedAt = `${date}T12:00:00.000Z`;
      doc.items.push(copy);
    }
  };
  add(2, 'gold', ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']);
  add(0, 'regulation', ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  const valid = validateNews(doc, today);
  assert.ok(valid.items.filter(item => item.tags.includes('gold')).length >= 5);
  assert.ok(valid.items.filter(item => item.tags.includes('regulation')).length >= 5);
  assert.ok(valid.items.filter(item => item.ledgers.includes('other')).length >= 5);
  const xml = sitemapXml('2026-11-22', '2026-11-22', valid);
  assert.match(xml, /\/news</);
  assert.match(xml, /\/news\/2026-11-20/);
  assert.match(xml, /\/news\/week\/2026-W47/);
  assert.match(xml, /\/news\/archive/);
  assert.equal(xml.includes('/news/tag/'), false);
  assert.equal(xml.includes('/news/ledger/'), false);
  assert.match(llmsTxt(), /News: \/news \(daily summaries with sources\), RSS \/news\/feed\.xml, JSON \/api\/news/);
});

test('thick regulation and other filters are noindex and omitted from the sitemap', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-news-filters-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  resetNewsCacheForTests();
  const doc = seed();
  for (let n = 0; n < 4; n++) {
    const copy = structuredClone(doc.items[0]);
    const date = `2026-11-1${n}`;
    copy.id = `${date}-regulation-extra`;
    copy.date = date;
    copy.publishedAt = `${date}T12:00:00.000Z`;
    doc.items.push(copy);
  }
  const valid = validateNews(doc, today);
  assert.ok(valid.items.filter(item => item.tags.includes('regulation')).length >= 5);
  assert.ok(valid.items.filter(item => item.ledgers.includes('other')).length >= 5);
  fs.writeFileSync(path.join(dir, 'news.json'), JSON.stringify(valid));
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = async (urlPath: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${urlPath}`);
    return { status: res.status, html: await res.text() };
  };
  try {
    const regulation = await get('/news/tag/regulation');
    const other = await get('/news/ledger/other');
    const sitemap = await get('/sitemap.xml');
    assert.equal(regulation.status, 200);
    assert.equal(other.status, 200);
    assert.match(regulation.html, /<meta name="robots" content="noindex,follow">/);
    assert.match(other.html, /<meta name="robots" content="noindex,follow">/);
    assert.equal(regulation.html.includes('index,follow,max-image-preview:large'), false);
    assert.equal(other.html.includes('index,follow,max-image-preview:large'), false);
    assert.match(sitemap.html, /\/news</);
    assert.match(sitemap.html, /\/news\/2026-11-20/);
    assert.equal(sitemap.html.includes('/news/tag/regulation'), false);
    assert.equal(sitemap.html.includes('/news/ledger/other'), false);
    assert.equal(sitemap.html.includes('/news/tag/'), false);
    assert.equal(sitemap.html.includes('/news/ledger/'), false);
  } finally {
    if (previous == null) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    resetNewsCacheForTests();
    fs.rmSync(dir, { recursive: true, force: true });
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('an invalid news.json keeps the last good copy', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rw-news-'));
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  resetNewsCacheForTests();
  try {
    const t0 = Date.UTC(2026, 10, 22, 18);
    const first = loadNews(t0);
    assert.equal(first.items.length, 3);
    fs.writeFileSync(path.join(dir, 'news.json'), JSON.stringify(first));
    const loaded = loadNews(t0 + 61_000);
    assert.equal(loaded.items[0].id, '2026-11-20-ecb-appia-call');
    fs.writeFileSync(path.join(dir, 'news.json'), '{"version":1');
    const kept = loadNews(t0 + 122_000);
    assert.equal(kept.items.length, 3);
    assert.equal(kept.items[0].headline, first.items[0].headline);
    assert.equal(loadNews(t0 + 123_000).items.length, 3);
  } finally {
    if (previous == null) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previous;
    resetNewsCacheForTests();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('news pages, the feed, the archive, the homepage, and IndexNow', async () => {
  resetNewsCacheForTests();
  const previousKey = process.env.INDEXNOW_KEY;
  const previousAction = process.env.NEWSLETTER_FORM_ACTION;
  const previousName = process.env.NEWSLETTER_NAME;
  delete process.env.NEWSLETTER_FORM_ACTION;
  delete process.env.NEWSLETTER_NAME;
  process.env.INDEXNOW_KEY = 'indexnowtestkey1';
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = async (urlPath: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${urlPath}`);
    return { status: res.status, type: res.headers.get('content-type') ?? '', robots: res.headers.get('x-robots-tag') ?? '', html: await res.text() };
  };
  try {
    const home = await get('/');
    assert.match(home.html, /Latest news/);
    assert.match(home.html, /href="\/news\/2026-11-20#ecb-appia-call"/);
    assert.match(home.html, /European Central Bank/);
    assert.match(home.html, /All news/);
    assert.equal((home.html.match(/class="news-latest"[\s\S]*?<\/ul>/)?.[0].match(/<li>/g) ?? []).length, 3);
    assert.match(home.html, /href="\/snapshots">Snapshots<\/a><a href="\/news">News<\/a>/);
    assert.match(home.html, /Weekly snapshots<\/a><a href="\/news">News<\/a>/);

    const index = await get('/news');
    assert.equal(index.status, 200);
    assert.match(index.html, /<title>Tokenized commodities news · ReserveWatch<\/title>/);
    assert.match(index.html, /Short summaries of tokenized-commodity news, written by ReserveWatch/);
    assert.match(index.html, /href="\/news\/tag\/gold"/);
    assert.match(index.html, /Weekly roundups/);
    assert.match(index.html, /href="\/news\/archive"/);
    assert.match(index.html, /rel="alternate" type="application\/rss\+xml"/);
    assert.equal(index.html.includes('<form'), false);
    assert.match(index.html, /Why it matters:/);
    assert.match(index.html, /id="ecb-appia-call"/);
    const indexLd = jsonLd(index.html);
    assert.ok(indexLd.some(block => JSON.stringify(block).includes('CollectionPage')));

    const day = await get('/news/2026-11-20');
    assert.match(day.html, /<title>Tokenized commodities news, Nov 20, 2026 · ReserveWatch<\/title>/);
    assert.match(day.html, /rel="canonical" href="https:\/\/thereservewatch\.com\/news\/2026-11-20"/);
    assert.match(day.html, /<h2>ECB opens its Appia tokenization tests to industry groups<\/h2>/);
    assert.match(day.html, /rel="noopener" href="https:\/\/www\.ecb\.europa\.eu\//);
    assert.match(day.html, /See: <a href="\/token\/assetiko-xaua">XAUa<\/a>/);
    assert.match(day.html, /href="\/disclaimer"/);
    const dayLd = jsonLd(day.html);
    const articles = JSON.stringify(dayLd);
    assert.match(articles, /NewsArticle/);
    assert.match(articles, /ItemList/);
    assert.match(articles, /2026-11-20T12:00:00.000Z/);
    assert.equal(dayLd.every(block => JSON.parse(JSON.stringify(block))), true);

    const week = await get('/news/week/2026-W47');
    assert.match(week.html, /<title>Week 47 tokenized commodities roundup · ReserveWatch<\/title>/);
    assert.match(week.html, /On the ledger this week/);
    const weekBlocks = jsonLd(week.html);
    const weekLd = JSON.stringify(weekBlocks);
    assert.match(weekLd, /hasPart/);
    const snapshotListed = SNAPSHOTS.some(s => s.week === '2026-11-19');
    if (snapshotListed) {
      assert.match(week.html, /href="\/snapshots\/2026-11-19"/);
      const article = weekBlocks.find(block => (block as { '@type'?: string })['@type'] === 'NewsArticle') as { isBasedOn?: string };
      assert.equal(article.isBasedOn, 'https://thereservewatch.com/snapshots/2026-11-19');
    } else {
      assert.equal(week.html.includes('/snapshots/2026-11-19'), false);
      assert.equal(weekLd.includes('/snapshots/2026-11-19'), false);
    }

    const tag = await get('/news/tag/gold');
    assert.match(tag.html, /<title>Tokenized gold news · ReserveWatch<\/title>/);
    assert.match(tag.html, /<meta name="robots" content="noindex,follow">/);
    assert.match(tag.html, /rel="canonical" href="https:\/\/thereservewatch\.com\/news\/tag\/gold"/);
    jsonLd(tag.html);
    const regulation = await get('/news/tag/regulation');
    assert.equal(regulation.status, 200);
    assert.match(regulation.html, /<meta name="robots" content="noindex,follow">/);
    const other = await get('/news/ledger/other');
    assert.equal(other.status, 200);
    assert.match(other.html, /<meta name="robots" content="noindex,follow">/);
    for (const filterPath of ['/news/ledger/xrpl', '/news/ledger/solana', '/news/ledger/stellar']) {
      const filter = await get(filterPath);
      assert.equal(filter.status, 200, filterPath);
      assert.match(filter.html, /<meta name="robots" content="noindex,follow">/);
    }
    const sitemap = await get('/sitemap.xml');
    assert.equal(sitemap.status, 200);
    assert.match(sitemap.html, /\/news</);
    assert.equal(sitemap.html.includes('/news/tag/'), false);
    assert.equal(sitemap.html.includes('/news/ledger/'), false);
    const xrpl = await get('/news/tag/xrpl');
    assert.match(xrpl.html, /XRPL news for tokenized commodities · ReserveWatch/);
    assert.equal((await get('/news/tag/gold?page=2')).status, 404);

    const archive = await get('/news/archive');
    assert.match(archive.html, /<title>Tokenized commodities news archive · ReserveWatch<\/title>/);
    assert.match(archive.html, /November 2026/);
    assert.match(archive.html, /href="\/news\/2026-11-20"/);
    assert.equal(newsDays(loadNews()).flatMap(d => d.items).length, 3);

    const feed = await get('/news/feed.xml');
    assert.equal(feed.status, 200);
    assert.match(feed.type, /application\/rss\+xml/);
    const parsed = new XMLParser().parse(feed.html);
    const items = parsed.rss?.channel.item ?? [];
    assert.ok(items.length > 0 && items.length <= 50);
    assert.equal(new Set(items.map(item => item.guid)).size, items.length);
    assert.match(items[0].guid, /\/news\/2026-11-20#ecb-appia-call$/);
    assert.equal(items[0].link.endsWith('/news/2026-11-20'), true);
    assert.match(feed.html, /Why it matters:/);
    assert.match(feed.html, /<source url="https:\/\/www\.ecb\.europa\.eu\/[^"]+">European Central Bank<\/source>/);

    const missing = await get('/news/2020-01-01');
    assert.equal(missing.status, 404);
    assert.match(missing.html, /noindex,follow/);
    assert.match(missing.html, /Not found/);
    assert.equal((await get('/news/week/1999-W01')).status, 404);
    assert.equal((await get('/news/tag/nope')).status, 404);

    const api = await get('/api/news');
    assert.equal(api.status, 200);
    assert.equal(api.robots, 'noindex');
    assert.equal(JSON.parse(api.html).items.length, 3);

    const key = await get('/indexnowtestkey1.txt');
    assert.equal(key.status, 200);
    assert.match(key.type, /text\/plain/);
    assert.equal(key.html, 'indexnowtestkey1');

    const privacy = await get('/privacy');
    assert.match(privacy.html, /November 22, 2026/);
    assert.match(privacy.html, /Weekly email \(optional\)/);
    assert.match(privacy.html, /josh@thereservewatch\.com/);
    assert.equal(privacy.html.includes('no sign-up'), false);

    process.env.NEWSLETTER_FORM_ACTION = 'https://example.test/subscribe';
    process.env.NEWSLETTER_NAME = 'friday';
    const signed = await get('/news');
    assert.match(signed.html, /method="post" action="https:\/\/example\.test\/subscribe"/);
    assert.match(signed.html, /name="email_address"/);
    assert.match(signed.html, /Get the Friday email/);
    assert.match(signed.html, /Weekly, free\. Unsubscribe anytime\. We'll ask you to confirm\./);
    assert.match((await get('/news/2026-11-20')).html, /Get the Friday email/);
    assert.match((await get('/news/week/2026-W47')).html, /Get the Friday email/);
    assert.equal((await get('/news/archive')).html.includes('Get the Friday email'), false);
    assert.equal((await get('/news/tag/gold')).html.includes('<form'), false);
    assert.equal(signed.html.includes('KIT_API_KEY'), false);
  } finally {
    if (previousKey == null) delete process.env.INDEXNOW_KEY;
    else process.env.INDEXNOW_KEY = previousKey;
    if (previousAction == null) delete process.env.NEWSLETTER_FORM_ACTION;
    else process.env.NEWSLETTER_FORM_ACTION = previousAction;
    if (previousName == null) delete process.env.NEWSLETTER_NAME;
    else process.env.NEWSLETTER_NAME = previousName;
    resetNewsCacheForTests();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
