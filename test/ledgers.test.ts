import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { validateNews } from '../src/content/news.ts';
import { readChainLedgers } from '../src/ledgers/read.ts';
import { parseHorizonAsset, parseSolanaSupply } from '../src/ledgers/parse.ts';
import { app } from '../src/server.ts';

test('solana and stellar parsers read supply without a network call', () => {
  const supply = parseSolanaSupply({ result: { value: { amount: '4385010000', decimals: 6, uiAmountString: '4385.01' } } });
  assert.equal(supply.supply, 4385.01);
  const asset = parseHorizonAsset({ _embedded: { records: [{ amount: '10', num_accounts: 4, flags: { auth_required: false, auth_revocable: true, auth_clawback_enabled: true } }] } });
  assert.equal(asset.supply, 10);
  assert.equal(asset.clawback, true);
  assert.equal(asset.holders, 4);
});

test('a ledger RPC error does not throw and does not blank the other ledger', async () => {
  const fetchImpl = async (url: string) => {
    if (url.includes('solana')) throw new Error('rpc down');
    if (url.includes('horizon')) {
      return new Response(JSON.stringify({ _embedded: { records: [{ amount: '12.5', num_accounts: 3, flags: { auth_required: true, auth_revocable: false, auth_clawback_enabled: false } }] } }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: { supply: 9 } }), { status: 200 });
  };
  const rows = await readChainLedgers({
    fetchImpl: fetchImpl as typeof fetch,
    env: { SOLANA_RPC_URL: 'https://solana.example', STELLAR_HORIZON_URL: 'https://horizon.example', STELLAR_SOROBAN_RPC_URL: 'https://soroban.example' },
    spotUsd: null,
  });
  assert.ok(rows.some(row => row.ledger === 'solana' && row.supply == null && row.error));
  const vnx = rows.find(row => row.id === 'stellar-vnxau');
  assert.equal(vnx?.supply, 12.5);
  assert.equal(vnx?.holders, 3);
  assert.match(rows.find(row => row.id === 'solana-paxg')?.holdersNote ?? '', /not available/i);
  const xaut = rows.find(row => row.id === 'solana-xaut0');
  assert.equal(xaut?.bridged, true);
});

test('news ledgers are optional and reject an unknown ledger', () => {
  const doc = { version: 1, updatedAt: '2026-11-22T00:00:00.000Z', weeks: [], items: [] as unknown[] };
  assert.throws(() => validateNews({ ...doc, items: [{ id: '2026-11-01-bad-ledger-item', date: '2026-11-01', publishedAt: '2026-11-01T00:00:00.000Z', headline: 'Headline', summary: 'Summary', whyItMatters: 'Because', tags: ['gold'], source: { name: 'Source', url: 'https://example.com/a' }, confirmedBy: [{ url: 'https://example.com/b' }], ledgerLinks: [], correction: null, ledgers: ['bitcoin'] }] }, '2026-11-22'), /ledger/);
});

test('ledger tabs, routes, and the news ledger filter render', async () => {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = async (path: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: res.status, html: await res.text(), type: res.headers.get('content-type') ?? '', robots: res.headers.get('x-robots-tag') ?? '' };
  };
  try {
    const home = await get('/');
    assert.match(home.html, /role="tablist"/);
    assert.match(home.html, /class="ledger-tab"/);
    assert.match(home.html, /min-height:44px/);
    assert.match(home.html, /aria-current="page"/);
    const solana = await get('/ledger/solana');
    assert.equal(solana.status, 200);
    assert.match(solana.html, /Solana commodity tokens/);
    assert.match(solana.html, /data-ledger="solana"[^>]*aria-current="page"/);
    assert.match(solana.html, /5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW|PAX Gold/);
    assert.match(solana.html, /"@type":"Dataset"/);
    assert.match(solana.html, /"@type":"Organization"/);
    const news = await get('/news/ledger/xrpl');
    assert.equal(news.status, 200);
    assert.match(news.html, /class="ledger-tab"/);
    assert.match(news.html, /aria-current="page"/);
    const api = await get('/api/tokens?ledger=solana');
    assert.equal(api.robots, 'noindex');
    assert.equal(JSON.parse(api.html).ledger, 'solana');
    assert.equal((await get('/ledger/nope')).status, 404);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
