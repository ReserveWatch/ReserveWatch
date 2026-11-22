import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { dayNeighbors, latestNews, loadNewsSeed, newsDays, newsItemPath, newsMonths, parseNews } from '../src/content/news.ts';
import { app } from '../src/server.ts';

test('news days stay newest first and no item is dropped', () => {
  const items = loadNewsSeed();
  assert.ok(items.length >= 3);
  const days = newsDays(items);
  for (let i = 1; i < days.length; i++) assert.ok(days[i - 1].date > days[i].date);
  const months = newsMonths(days);
  for (let i = 1; i < months.length; i++) assert.ok(months[i - 1].key > months[i].key);
  const listed = months.flatMap(m => m.days).reduce((n, d) => n + d.items.length, 0);
  assert.equal(listed, items.length);
  const newest = latestNews(items, 3);
  assert.equal(newest.length, 3);
  assert.equal(newest[0].date >= newest[1].date, true);
  assert.match(newsItemPath(newest[0]), /^\/news\/\d{4}-\d{2}-\d{2}#/);
  const mid = days[1];
  const neighbors = dayNeighbors(days, mid.date);
  assert.equal(neighbors.next, days[0].date);
  assert.equal(neighbors.prev, days[2]?.date ?? null);
});

test('a bad news row is rejected instead of being stored as a blank', () => {
  assert.throws(() => parseNews([{ id: 'ok', date: '2026-11-01', headline: 'H', source: 'S', url: 'http://x', summary: 'Sum' }]));
});

test('the homepage lists three stories, the signup stays hidden, and IndexNow serves its key', async () => {
  const previousKey = process.env.INDEXNOW_KEY;
  const previousKit = process.env.KIT_API_KEY;
  const previousForm = process.env.KIT_FORM_ID;
  delete process.env.KIT_API_KEY;
  delete process.env.KIT_FORM_ID;
  process.env.INDEXNOW_KEY = 'indexnowtestkey1';
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  try {
    const home = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.match(home, /Latest news/);
    assert.match(home, /All news/);
    assert.equal((home.match(/class="news-latest"[\s\S]*?<\/ul>/)?.[0].match(/<li>/g) ?? []).length, 3);
    const news = await (await fetch(`http://127.0.0.1:${port}/news`)).text();
    assert.equal(news.includes('Weekly, free.'), false);
    assert.match(news, /href="\/news\/archive"/);
    process.env.KIT_API_KEY = 'kit-test';
    process.env.KIT_FORM_ID = 'form123';
    const signed = await (await fetch(`http://127.0.0.1:${port}/news`)).text();
    assert.match(signed, /Weekly, free\. Unsubscribe anytime\. We'll ask you to confirm\./);
    const day = newsDays(loadNewsSeed())[0];
    const page = await (await fetch(`http://127.0.0.1:${port}/news/${day.date}`)).text();
    assert.match(page, /Previous day|Next day/);
    assert.match(page, new RegExp(`id="${day.items[0].id}"`));
    const key = await fetch(`http://127.0.0.1:${port}/indexnowtestkey1.txt`);
    assert.equal(key.status, 200);
    assert.match(key.headers.get('content-type') ?? '', /text\/plain/);
    assert.equal(await key.text(), 'indexnowtestkey1');
  } finally {
    if (previousKey == null) delete process.env.INDEXNOW_KEY; else process.env.INDEXNOW_KEY = previousKey;
    if (previousKit == null) delete process.env.KIT_API_KEY; else process.env.KIT_API_KEY = previousKit;
    if (previousForm == null) delete process.env.KIT_FORM_ID; else process.env.KIT_FORM_ID = previousForm;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
