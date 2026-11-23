import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import zlib from 'node:zlib';
import {
  eventsRss, futureKitNotifier, historySection, readEvents, readingFromChain, readingFromXrpl,
  recordHistory, setAlertNotifier, supplyThreshold, tokenHistory, type HistoryReading,
} from '../src/history.ts';
import { XMLParser } from './xml-parser.ts';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rw-history-'));
}

function row(over: Partial<HistoryReading> = {}): HistoryReading {
  return {
    at: '2026-11-01T12:00:00.000Z',
    ledger: 'solana',
    tokenId: 'solana-paxg',
    supply: 100,
    supplyOz: 100,
    holders: 10,
    trustlines: null,
    flags: { mintAuthority: false, freeze: false, permanentDelegate: false, pause: false, paused: false },
    pegPct: 1,
    liquidityUsd: 100_000,
    pegGrade: 'ok',
    checks: [{ key: 'supply', result: 'ok' }, { key: 'peg', result: 'ok' }],
    ...over,
  };
}

test('polls append to the day file and roll up to one point per day', () => {
  const dir = tmp();
  const now = '2026-11-01T20:00:00.000Z';
  const first = recordHistory([row({ holders: 10 })], { dir, now });
  const second = recordHistory([row({ at: '2026-11-01T18:00:00.000Z', holders: 12, supply: 101, supplyOz: 101 })], { dir, now });
  const lines = fs.readFileSync(path.join(dir, 'history', '2026-11-01.ndjson'), 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[1]).holders, 12);
  assert.equal(JSON.parse(lines[1]).checks[0].result, 'ok');
  const history = tokenHistory('solana-paxg', dir);
  assert.equal(history.days.length, 1);
  assert.equal(history.days[0].holders, 12);
  assert.equal(history.days[0].supply, 101);
  assert.equal(history.firstSeen, '2026-11-01');
  assert.equal(history.lastChange, null);
  assert.equal(first.some(event => event.kind === 'appeared'), true);
  assert.equal(second.some(event => event.kind === 'supply'), false);
});

test('the daily series keeps 90 days', () => {
  const dir = tmp();
  for (let i = 0; i < 95; i++) {
    const at = new Date(Date.UTC(2026, 0, 1 + i, 12)).toISOString();
    recordHistory([row({ at, supply: 100 + i, supplyOz: 100 + i, holders: i })], { dir, threshold: 100 });
  }
  const history = tokenHistory('solana-paxg', dir);
  assert.equal(history.days.length, 90);
  assert.equal(history.days[0].day, '2026-01-06');
  assert.equal(history.days.at(-1)?.day, '2026-04-05');
  assert.equal(history.firstSeen, '2026-01-06');
  assert.equal(history.lastChange, '2026-04-05');
});

test('supply notes use the previous day and a 5 percent threshold', () => {
  const dir = tmp();
  recordHistory([row({ supply: 100, supplyOz: 4400 })], { dir, threshold: 5 });
  const small = recordHistory([row({ at: '2026-11-02T12:00:00.000Z', supply: 104, supplyOz: 4576 })], { dir, threshold: 5 });
  assert.equal(small.some(event => event.kind === 'supply'), false);
  const big = recordHistory([row({ at: '2026-11-03T12:00:00.000Z', supply: 110.24, supplyOz: 4671 })], { dir, threshold: 5 });
  const note = big.find(event => event.kind === 'supply');
  assert.equal(note?.text, 'Supply rose 6% to 4,671 oz.');
  const again = recordHistory([row({ at: '2026-11-03T18:00:00.000Z', supply: 110.24, supplyOz: 4671 })], { dir, threshold: 5 });
  assert.equal(again.some(event => event.kind === 'supply'), false);
  const example = recordHistory([
    row({ tokenId: 'example', at: '2026-11-01T00:00:00.000Z', supply: 100, supplyOz: 4400 }),
  ], { dir, threshold: 5 });
  assert.equal(example[0].kind, 'appeared');
  const rose = recordHistory([
    row({ tokenId: 'example', at: '2026-11-02T00:00:00.000Z', supply: 106.2, supplyOz: 4671 }),
  ], { dir, threshold: 5 });
  assert.equal(rose.find(event => event.kind === 'supply')?.text, 'Supply rose 6.2% to 4,671 oz.');
});

test('issuer control, peg grade, first seen, and a zero supply are separate notes', () => {
  const dir = tmp();
  const seen = recordHistory([row()], { dir });
  assert.deepEqual(seen.map(event => event.kind), ['appeared']);
  const control = recordHistory([row({ at: '2026-11-01T13:00:00.000Z', flags: { mintAuthority: true, freeze: false, permanentDelegate: false, pause: false, paused: false } })], { dir });
  assert.equal(control[0].text, 'Mint authority is set. That is an issuer control, not an event.');
  const peg = recordHistory([row({ at: '2026-11-01T14:00:00.000Z', pegGrade: 'critical', pegPct: 12, flags: { mintAuthority: true, freeze: false, permanentDelegate: false, pause: false, paused: false } })], { dir });
  assert.equal(peg.find(event => event.kind === 'peg')?.text, 'Peg grade moved from ok to critical.');
  const paused = recordHistory([row({
    at: '2026-11-01T15:00:00.000Z', pegGrade: 'critical',
    flags: { mintAuthority: true, freeze: false, permanentDelegate: false, pause: true, paused: true },
  })], { dir });
  assert.equal(paused.find(event => event.text.startsWith('Transfers are paused'))?.text, 'Transfers are paused. That is an issuer control, not an event.');
  const born = recordHistory([row({ tokenId: 'born-zero', supply: 0, supplyOz: 0 })], { dir });
  assert.equal(born[0].kind, 'appeared');
  assert.equal(born.some(event => event.kind === 'zero'), false);
  recordHistory([row({ tokenId: 'gone', supply: 80, supplyOz: 80 })], { dir });
  const toZero = recordHistory([row({ tokenId: 'gone', at: '2026-11-02T12:00:00.000Z', supply: 0, supplyOz: 0 })], { dir });
  assert.equal(toZero.some(event => event.kind === 'zero'), true);
  assert.equal(toZero.some(event => event.kind === 'supply'), false);
});

test('a throwing notifier is ignored and the default Kit hook does not send', async () => {
  const dir = tmp();
  const called: string[] = [];
  const events = recordHistory([row({ tokenId: 'kit' })], {
    dir,
    notify: { async notify() { throw new Error('no credentials'); } },
  });
  assert.equal(events[0].kind, 'appeared');
  await futureKitNotifier.notify(events[0]);
  setAlertNotifier({ async notify(event) { called.push(event.tokenId); } });
  try {
    recordHistory([row({ tokenId: 'kit-2' })], { dir });
  } finally {
    setAlertNotifier(futureKitNotifier);
  }
  assert.deepEqual(called, ['kit-2']);
});

test('missing or corrupt history does not throw and the next poll still records', () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'history'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'history', 'daily.json'), '{');
  fs.writeFileSync(path.join(dir, 'events.json'), 'not-json');
  assert.deepEqual(tokenHistory('solana-paxg', dir).days, []);
  assert.equal(readEvents(dir).length, 0);
  assert.match(historySection('solana-paxg', dir), /No daily history yet/);
  const blocked = path.join(dir, 'blocked');
  fs.writeFileSync(blocked, 'not a directory');
  assert.deepEqual(recordHistory([row()], { dir: blocked }), []);
  const saved = recordHistory([row({ holders: 4 })], { dir });
  assert.equal(saved[0].kind, 'appeared');
  assert.equal(tokenHistory('solana-paxg', dir).days[0].holders, 4);
  const html = historySection('solana-paxg', dir);
  assert.match(html, /First seen 2026-11-01/);
  assert.match(html, /<svg/);
  assert.match(html, /<table>/);
});

test('a late reading for an earlier day replaces that day', () => {
  const dir = tmp();
  const now = '2026-11-03T12:00:00.000Z';
  recordHistory([row({ at: '2026-11-03T12:00:00.000Z', supply: 50, holders: 5 })], { dir, now, threshold: 100 });
  const late = recordHistory([row({ at: '2026-11-01T12:00:00.000Z', supply: 40, holders: 4 })], { dir, now, threshold: 100 });
  assert.equal(late.some(event => event.kind === 'appeared'), false);
  const days = tokenHistory('solana-paxg', dir).days;
  assert.deepEqual(days.map(point => [point.day, point.supply]), [['2026-11-01', 40], ['2026-11-03', 50]]);
  recordHistory([row({ at: '2026-11-01T18:00:00.000Z', supply: 41, holders: 4 })], { dir, now, threshold: 100 });
  const again = tokenHistory('solana-paxg', dir).days;
  assert.equal(again.length, 2);
  assert.equal(again[0].day, '2026-11-01');
  assert.equal(again[0].supply, 41);
});

test('two control notes at one time get different RSS guids', () => {
  const dir = tmp();
  const at = '2026-11-01T12:00:00.000Z';
  const flags = { mintAuthority: false, freeze: false, permanentDelegate: false, pause: false, paused: false };
  recordHistory([row({ at, flags })], { dir, now: at, threshold: 100 });
  recordHistory([row({ at, flags: { ...flags, mintAuthority: true, freeze: true } })], { dir, now: at, threshold: 100 });
  const items = new XMLParser().parse(eventsRss(readEvents(dir), 'https://thereservewatch.com')).rss?.channel.item ?? [];
  const controls = items.filter(item => /issuer control/.test(item.title));
  assert.equal(controls.length, 2);
  assert.equal(new Set(controls.map(item => item.guid)).size, 2);
  assert.equal(new Set(items.map(item => item.guid)).size, items.length);
});

test('poll logs older than two days are gzipped and older logs are deleted', () => {
  const dir = tmp();
  const today = '2026-11-23';
  const root = path.join(dir, 'history');
  fs.mkdirSync(root);
  const shift = (delta: number) => new Date(Date.UTC(2026, 10, 23 + delta)).toISOString().slice(0, 10);
  const write = (delta: number, gz = false) => {
    const day = shift(delta);
    const body = `{"day":"${day}"}\n`;
    fs.writeFileSync(path.join(root, `${day}.ndjson${gz ? '.gz' : ''}`), gz ? zlib.gzipSync(body) : body);
  };
  write(0);
  write(-1);
  write(-2);
  write(-3);
  write(-90);
  write(-91);
  write(-100, true);
  fs.writeFileSync(path.join(root, 'daily.json'), '{"tokens":{"keep":[]}}');
  recordHistory([row({ at: `${today}T12:00:00.000Z`, supply: 5 })], { dir, now: `${today}T12:00:00.000Z`, threshold: 100 });
  assert.equal(fs.existsSync(path.join(root, `${shift(0)}.ndjson`)), true);
  assert.equal(fs.existsSync(path.join(root, `${shift(-1)}.ndjson`)), true);
  assert.equal(fs.existsSync(path.join(root, `${shift(-2)}.ndjson`)), true);
  assert.equal(fs.existsSync(path.join(root, `${shift(-3)}.ndjson`)), false);
  assert.equal(zlib.gunzipSync(fs.readFileSync(path.join(root, `${shift(-3)}.ndjson.gz`))).toString(), `{"day":"${shift(-3)}"}\n`);
  assert.equal(fs.existsSync(path.join(root, `${shift(-90)}.ndjson.gz`)), true);
  assert.equal(fs.existsSync(path.join(root, `${shift(-91)}.ndjson`)), false);
  assert.equal(fs.existsSync(path.join(root, `${shift(-91)}.ndjson.gz`)), false);
  assert.equal(fs.existsSync(path.join(root, `${shift(-100)}.ndjson.gz`)), false);
  const roll = JSON.parse(fs.readFileSync(path.join(root, 'daily.json'), 'utf8')) as { tokens: { keep: unknown[]; 'solana-paxg': { supply: number }[] } };
  assert.equal(roll.tokens['solana-paxg'][0].supply, 5);
  assert.ok(roll.tokens.keep);
  const prev = process.env.HISTORY_RAW_DAYS;
  process.env.HISTORY_RAW_DAYS = '10';
  try {
    const short = tmp();
    const shortRoot = path.join(short, 'history');
    fs.mkdirSync(shortRoot);
    fs.writeFileSync(path.join(shortRoot, `${shift(-10)}.ndjson`), '{"ok":1}\n');
    fs.writeFileSync(path.join(shortRoot, `${shift(-11)}.ndjson`), '{"old":1}\n');
    recordHistory([row({ at: `${today}T12:00:00.000Z` })], { dir: short, now: `${today}T12:00:00.000Z`, threshold: 100 });
    assert.equal(fs.existsSync(path.join(shortRoot, `${shift(-10)}.ndjson.gz`)), true);
    assert.equal(fs.existsSync(path.join(shortRoot, `${shift(-11)}.ndjson`)), false);
    assert.equal(fs.existsSync(path.join(shortRoot, `${shift(-11)}.ndjson.gz`)), false);
  } finally {
    if (prev == null) delete process.env.HISTORY_RAW_DAYS;
    else process.env.HISTORY_RAW_DAYS = prev;
  }
});

test('a failed rollup write keeps the previous daily.json', () => {
  const dir = tmp();
  const now = '2026-11-01T12:00:00.000Z';
  recordHistory([row({ holders: 3, supply: 10 })], { dir, now, threshold: 100 });
  const root = path.join(dir, 'history');
  const file = path.join(root, 'daily.json');
  const before = fs.readFileSync(file, 'utf8');
  fs.chmodSync(root, 0o555);
  try {
    const again = recordHistory([row({ at: '2026-11-01T18:00:00.000Z', holders: 9, supply: 99 })], { dir, now, threshold: 100 });
    assert.deepEqual(again, []);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.equal(tokenHistory('solana-paxg', dir).days[0].holders, 3);
    assert.equal(fs.readdirSync(root).some(name => name.endsWith('.tmp')), false);
  } finally {
    fs.chmodSync(root, 0o755);
  }
});

test('RSS is well formed, guids are unique, and a ledger query filters items', () => {
  const dir = tmp();
  recordHistory([
    row({ tokenId: 'sol', ledger: 'solana' }),
    row({ tokenId: 'xrp', ledger: 'xrpl', at: '2026-11-01T12:00:01.000Z' }),
  ], { dir });
  const events = readEvents(dir);
  const xml = eventsRss(events, 'https://thereservewatch.com');
  const parsed = new XMLParser().parse(xml);
  const items = parsed.rss?.channel.item ?? [];
  assert.equal(items.length, 2);
  assert.equal(new Set(items.map(item => item.guid)).size, 2);
  assert.match(xml, /<rss version="2\.0">/);
  assert.match(items[0].title, /first seen/i);
  const solana = new XMLParser().parse(eventsRss(events.filter(event => event.ledger === 'solana'), 'https://thereservewatch.com', 'solana'));
  assert.equal(solana.rss?.channel.item.length, 1);
  assert.match(solana.rss?.channel.item[0].link ?? '', /\/token\/sol$/);
  const empty = new XMLParser().parse(eventsRss([], 'https://thereservewatch.com', 'stellar'));
  assert.equal(empty.rss?.channel.item.length, 0);
});

test('XRPL and chain readings keep troy ounces, controls, and a graded peg', () => {
  const xrpl = readingFromXrpl({
    id: 'paxg', updatedAt: '2026-11-01T00:00:00.000Z', gramsPerToken: 31.1034768,
    flags: { globalFreeze: false, noFreeze: false, allowTrustLineClawback: true },
    supply: { circulating: 2 }, holders: { nonZero: 9, trustlines: 11 },
    peg: { deviationPct: 1.2, reliable: true, liquidityUsd: 50_000 },
    checks: [{ key: 'peg', severity: 'ok' }],
  });
  assert.equal(xrpl.ledger, 'xrpl');
  assert.equal(xrpl.supplyOz, 2);
  assert.equal(xrpl.trustlines, 11);
  assert.equal(xrpl.flags.clawback, true);
  assert.equal(xrpl.flags.freezeable, true);
  assert.equal(xrpl.pegGrade, 'ok');
  const chain = readingFromChain({
    id: 'solana-paxg', ledger: 'solana', updatedAt: '2026-11-01T00:00:00.000Z', gramsPerToken: 31.1034768,
    supply: 10, holders: 3, mintAuthority: 'mint', freezeAuthority: null,
    revocable: null, clawback: null,
    controls: { permanentDelegate: true, pausable: false, paused: false },
    pricePerOz: 110, spotUsd: 100, liquidityUsd: 30_000,
    checks: [{ key: 'peg', result: 'warn' }],
  });
  assert.equal(chain.flags.mintAuthority, true);
  assert.equal(chain.flags.permanentDelegate, true);
  assert.equal(chain.pegGrade, 'warn');
  assert.ok(chain.pegPct != null && Math.abs(chain.pegPct - 10) < 0.001);
  assert.equal(chain.supplyOz, 10);
});

test('history pages and the feed stay up when the history file is missing or corrupt', async () => {
  const dir = tmp();
  const previous = process.env.DATA_DIR;
  process.env.DATA_DIR = dir;
  const { app } = await import('../src/server.ts');
  fs.mkdirSync(path.join(dir, 'history'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'history', 'daily.json'), '{');
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`);
  try {
    const page = await get('/token/solana-paxg');
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /History/);
    assert.equal(html.includes('location.reload'), false);
    const alerts = await get('/alerts');
    const alertsHtml = await alerts.text();
    assert.match(alertsHtml, /Legacy XRPL status log/);
    assert.match(alertsHtml, /\/alerts\/feed\.xml\?ledger=solana/);
    assert.match(alertsHtml, new RegExp(`at least ${supplyThreshold()}% from the previous day`));
    const description = alertsHtml.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    assert.ok(description.length <= 155, description);
    const api = await get('/api/history/solana-paxg');
    assert.equal(api.status, 200);
    assert.equal(api.headers.get('x-robots-tag'), 'noindex');
    const body = await api.json() as { days: unknown[] };
    assert.deepEqual(body.days, []);
    recordHistory([row()], { dir });
    const after = await (await get('/api/history/solana-paxg')).json() as { firstSeen: string; days: { supply: number }[] };
    assert.equal(after.firstSeen, '2026-11-01');
    assert.equal(after.days[0].supply, 100);
    const feed = await get('/alerts/feed.xml?ledger=solana');
    assert.match(feed.headers.get('content-type') ?? '', /rss|xml/);
    const parsed = new XMLParser().parse(await feed.text());
    assert.equal(parsed.rss?.channel.item.length, 1);
    const other = new XMLParser().parse(await (await get('/alerts/feed.xml?ledger=stellar')).text());
    assert.equal(other.rss?.channel.item.length, 0);
    const unknown = new XMLParser().parse(await (await get('/alerts/feed.xml?ledger=nope')).text());
    assert.equal(unknown.rss?.channel.item.length, 0);
  } finally {
    if (previous == null) delete process.env.DATA_DIR; else process.env.DATA_DIR = previous;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
