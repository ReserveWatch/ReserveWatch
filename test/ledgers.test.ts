import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { validateNews } from '../src/content/news.ts';
import { parseHorizonAsset, parseSolanaMintAccount, sorobanSupply } from '../src/ledgers/parse.ts';
import { supplyLabel } from '../src/ledgers/read.ts';
import { readChainLedgers, resetLedgerMemoryForTests } from '../src/ledgers/read.ts';
import { app } from '../src/server.ts';

const horizonShape = {
  _embedded: {
    records: [{
      balances: { authorized: '0.0000000', authorized_to_maintain_liabilities: '0.0000000' },
      claimable_balances_amount: '0.0000000',
      liquidity_pools_amount: '0.0000000',
      contracts_amount: '0.0000000',
      accounts: { authorized: 65, authorized_to_maintain_liabilities: 0 },
      flags: { auth_required: false, auth_revocable: true, auth_clawback_enabled: true },
    }],
  },
};

test('horizon supply sums the current balance fields and soroban supply uses decimals', () => {
  const asset = parseHorizonAsset(horizonShape);
  assert.equal(asset.supply, 0);
  assert.equal(asset.holders, 65);
  assert.equal(asset.revocable, true);
  assert.equal(asset.clawback, true);
  assert.equal(sorobanSupply(13823640000n, 7), 1382.364);
  const controls = parseSolanaMintAccount({
    result: {
      value: {
        owner: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
        data: {
          parsed: {
            info: {
              mintAuthority: 'mint',
              freezeAuthority: null,
              extensions: [
                { extension: 'permanentDelegate', state: { delegate: 'd' } },
                { extension: 'pausableConfig', state: { paused: false } },
              ],
            },
          },
        },
      },
    },
  });
  assert.equal(controls.program, 'token-2022');
  assert.equal(controls.permanentDelegate, true);
  assert.equal(controls.pausable, true);
  assert.equal(controls.paused, false);
  assert.equal(supplyLabel(36948706, 'xrpl', 0, 'MWh'), '36,948,706 MWh');
  assert.equal(supplyLabel(230900, 'xrpl', 0, 'tokens'), '230,900 tokens');
});

test('a ledger RPC error does not throw, keeps a later failure on the last good reading, and treats result.error as failure', async () => {
  resetLedgerMemoryForTests();
  const fetchImpl = async (url: string) => {
    if (url.includes('jup.ag')) throw new Error('fetch failed');
    if (url.includes('solana')) return new Response(JSON.stringify({ result: { error: 'Could not unmarshal transaction' } }), { status: 200 });
    if (url.includes('horizon') && url.includes('/assets')) return new Response(JSON.stringify(horizonShape), { status: 200 });
    if (url.includes('paths/strict-send') || url.includes('aqua.network')) return new Response('{}', { status: 503 });
    return new Response(JSON.stringify({ result: { error: 'Could not unmarshal transaction' } }), { status: 200 });
  };
  const env = { SOLANA_RPC_URL: 'https://solana.example', STELLAR_HORIZON_URL: 'https://horizon.example', STELLAR_SOROBAN_RPC_URL: 'https://soroban.example' };
  const call = async (_rpc: string, _id: string, fn: string) => fn === 'decimals' ? 7 : 13823640000n;
  const rows = await readChainLedgers({ fetchImpl: fetchImpl as typeof fetch, env, spotUsd: 4000, sorobanCall: call });
  const paxg = rows.find(row => row.id === 'solana-paxg');
  assert.equal(paxg?.supply, null);
  assert.match(paxg?.error ?? '', /unreachable|Could not unmarshal/);
  const vnx = rows.find(row => row.id === 'stellar-vnxau');
  assert.equal(vnx?.supply, 0);
  assert.equal(vnx?.holders, 65);
  assert.equal(vnx?.countInTotal, false);
  assert.match(vnx?.checks.map(c => c.message).join(' ') ?? '', /0 issued on Stellar/);
  assert.ok(vnx?.checks.some(c => c.key === 'revocable' && c.result === 'feature'));
  const xaum = rows.find(row => row.id === 'stellar-xaum');
  assert.equal(xaum?.supply, 1382.364);
  assert.ok(xaum?.checks.some(c => c.key === 'forced-transfer'));
  const again = await readChainLedgers({
    fetchImpl: (async () => { throw new Error('fetch failed'); }) as typeof fetch,
    env, spotUsd: 4000,
    sorobanCall: async () => { throw new Error('fetch failed'); },
  });
  const kept = again.find(row => row.id === 'stellar-xaum');
  assert.equal(kept?.supply, 1382.364);
  assert.match(kept?.notes.join(' ') ?? '', /as of/);
  assert.equal(kept?.error, 'endpoint unreachable at last check');
  resetLedgerMemoryForTests();
  const priced = await readChainLedgers({
    fetchImpl: (async (url: string) => {
      if (url.includes('jup.ag')) return new Response(JSON.stringify({ '5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW': { usdPrice: 4000, liquidity: 100000 } }), { status: 200 });
      if (url.includes('solana')) return new Response(JSON.stringify({ result: { value: { uiAmountString: '1', decimals: 6 } } }), { status: 200 });
      return new Response('{}', { status: 503 });
    }) as typeof fetch,
    env, spotUsd: 4008.8, sorobanCall: async () => { throw new Error('fetch failed'); },
  });
  const graded = priced.find(row => row.id === 'solana-paxg');
  assert.equal(graded?.checks.find(c => c.key === 'peg')?.result, 'ok');
});

test('news ledgers are optional and reject an unknown ledger', () => {
  const doc = { version: 1, updatedAt: '2026-11-22T00:00:00.000Z', weeks: [], items: [] as unknown[] };
  assert.throws(() => validateNews({ ...doc, items: [{ id: '2026-11-01-bad-ledger-item', date: '2026-11-01', publishedAt: '2026-11-01T00:00:00.000Z', headline: 'Headline', summary: 'Summary', whyItMatters: 'Because', tags: ['gold'], source: { name: 'Source', url: 'https://example.com/a' }, confirmedBy: [{ url: 'https://example.com/b' }], ledgerLinks: [], correction: null, ledgers: ['bitcoin'] }] }, '2026-11-22'), /ledger/);
});

test('ledger tabs, routes, search text, and the news ledger filter render', async () => {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = async (path: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location'), html: await res.text(), robots: res.headers.get('x-robots-tag') ?? '' };
  };
  try {
    const home = await get('/');
    assert.match(home.html, /<h1>On-chain reserve health for tokenized assets<\/h1>[\s\S]*class="ledger-tab"/);
    assert.ok(home.html.indexOf('class="ledger-tab"') < home.html.indexOf('aria-label="Commodities"'));
    assert.match(home.html, /"metal":"gold"/);
    assert.match(home.html, /Supply \(troy oz\)/);
    assert.match(home.html, /toLocaleString\('en-US',\{maximumFractionDigits:2\}\)/);
    const solana = await get('/ledger/solana');
    assert.equal(solana.status, 200);
    assert.match(solana.html, /PAX Gold/);
    assert.equal(solana.html.includes('No tokens in this view.'), false);
    const totals = (html: string) => html.match(/id="ledger-totals">([^<]*)/)?.[1] ?? '';
    assert.equal(totals(solana.html).includes('0 issued on Stellar'), false);
    const stellar = await get('/ledger/stellar');
    assert.match(stellar.html, /Matrixdock Gold/);
    assert.equal(stellar.html.includes('No tokens in this view.'), false);
    assert.match(totals(stellar.html), /0 issued on Stellar/);
    assert.equal(totals(home.html).includes('0 issued on Stellar'), false);
    const moved = await get('/ledger/xrpl');
    assert.equal(moved.status, 301);
    assert.equal(moved.location, '/');
    const news = await get('/news');
    assert.match(news.html, /XRPL/);
    assert.match(news.html, />All</);
    assert.match(news.html, /href="\/news"/);
    const api = await get('/api/tokens?ledger=nope');
    assert.equal(api.status, 400);
    assert.equal((await get('/api/tokens?ledger=solana')).robots, 'noindex');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
