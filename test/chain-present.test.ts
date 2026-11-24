import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { renderCardShell, renderLeadShell } from '../src/face.ts';
import { CHAIN_TOKENS } from '../src/ledgers/registry.ts';
import { presentFromChain, type ChainPresented } from '../src/ledgers/present.ts';
import type { ChainReading } from '../src/ledgers/read.ts';
import { itemsOf } from '../src/presentation.ts';
import { app } from '../src/server.ts';

function reading(over: Partial<ChainReading> & Pick<ChainReading, 'id' | 'ledger'>): ChainReading {
  return {
    name: 'Sample', project: 'Sample project', displayCode: 'S', metal: 'gold', gramsPerToken: 31.1034768,
    bridged: false, address: 'Addr111', kind: over.ledger === 'stellar' ? 'classic' : 'mint',
    explorerUrl: 'https://example.test/explorer', website: 'https://example.test',
    supply: 10, holders: null, holdersNote: 'Not available.', mintAuthority: null, freezeAuthority: null,
    authRequired: null, revocable: null, clawback: null, controls: null, spotUsd: 4000,
    spotSource: 'https://api.gold-api.com/price/XAU', priceUsd: null, pricePerOz: null, liquidityUsd: null,
    pegNote: 'Price vs spot is not available.', checks: [], updatedAt: '2026-11-23T00:00:00.000Z',
    notes: [], countInTotal: true, ...over,
  };
}

const codes = (view: ChainPresented) => itemsOf(view.presentation).map(item => item.code);

test('chain adapter uses the comparison model and does not invent a legacy grade', () => {
  const thin = presentFromChain(reading({
    id: 'solana-paxg', ledger: 'solana', name: 'PAX Gold (PAXG)', displayCode: 'PAXG',
    mintAuthority: 'mint-key', supply: 1_234_567, priceUsd: 3900, pricePerOz: 3900, liquidityUsd: 100, spotUsd: 4000,
    pegNote: 'About 3,900 USD per troy oz. Thin market, not graded.',
    checks: [
      { key: 'mint', result: 'feature', message: 'Mint authority is set. The controller can create more tokens. That is an issuer control, not an event.' },
      { key: 'freeze', result: 'na', message: 'Freeze authority was not returned.' },
      { key: 'peg', result: 'na', message: 'About 3,900 USD per troy oz. Thin market, not graded.' },
    ],
  }));
  assert.equal(thin.presentation.model, 'categories-v1');
  assert.equal(thin.presentation.legacyOverall, null);
  assert.match(thin.presentation.legacyNote, /Not available on this ledger/);
  assert.equal(thin.supplyPrimary, '1,234,567');
  assert.ok(codes(thin).includes('chain-mint'));
  assert.ok(codes(thin).includes('chain-price-thin'));
  assert.ok(codes(thin).includes('chain-domain-na'));
  assert.equal(codes(thin).includes('identity-confirmed'), false);
  assert.match(thin.presentation.marketFigures, /not available on this ledger/i);
  assert.match(thin.presentation.marketFigures, /AMM pools are not available/);
  const face = renderCardShell({
    tokenHref: '/token/solana-paxg', name: 'PAX Gold (PAXG)', project: 'Paxos',
    subHref: '/gold', subName: 'Gold', supplyPrimary: thin.supplyPrimary, supplyUnit: thin.supplyUnit,
    search: 'PAX Gold PAXG gold solana', presentation: thin.presentation, facts: thin.facts, meterVoice: 'quote',
  });
  assert.match(face, /<h3>Market<\/h3>/);
  assert.match(face, /<h3>Controls<\/h3>/);
  assert.match(face, /<h3>Identity<\/h3>/);
  assert.match(face, /Mint authority/);
  assert.match(face, /Thin-market price/);
  assert.match(face, /No domain check on this ledger/);
  assert.match(face, /Legacy overall not available on this ledger/);
  assert.equal(face.includes('peg-mark'), false);
  assert.equal(face.includes('legacy-warn'), false);
  assert.equal(face.includes('Legacy WARN'), false);
  const lead = renderLeadShell({ presentation: thin.presentation, facts: thin.facts, meterVoice: 'quote' });
  assert.match(lead, /class="panels"/);
  assert.match(lead, /<h2>Market<\/h2>/);
  assert.match(lead, /<h2>Controls<\/h2>/);
  assert.match(lead, /<h2>Identity<\/h2>/);
  assert.equal(lead.includes('<th>Pair</th>'), false);
});

test('a graded quote can be near spot, and an active pause stays critical', () => {
  const near = presentFromChain(reading({
    id: 'solana-xaum', ledger: 'solana', priceUsd: 4010, pricePerOz: 4010, liquidityUsd: 100_000, spotUsd: 4000,
    pegNote: 'About 4,010 USD per troy oz, within 0.25% of spot.',
    checks: [{ key: 'peg', result: 'ok', message: 'within spot' }],
  }));
  assert.equal(near.facts.pegReliable, true);
  assert.ok(codes(near).includes('chain-price-near'));
  const card = renderCardShell({
    tokenHref: '/token/solana-xaum', name: 'XAUm', project: 'Matrixdock', subHref: '/gold', subName: 'Gold',
    supplyPrimary: near.supplyPrimary, supplyUnit: near.supplyUnit, search: 'xaum',
    presentation: near.presentation, facts: near.facts, meterVoice: 'quote',
  });
  assert.match(card, /peg-mark/);
  assert.match(card, /not an AMM pool/i);

  const paused = presentFromChain(reading({
    id: 'solana-dgld', ledger: 'solana',
    checks: [{ key: 'paused', result: 'critical', message: 'Transfers are paused. That is an active control, not a vault finding.' }],
  }));
  const pause = itemsOf(paused.presentation).find(item => item.code === 'chain-paused');
  assert.equal(pause?.tone, 'critical');
  assert.match(renderLeadShell({ presentation: paused.presentation, facts: paused.facts, meterVoice: 'quote' }), /alert-banner/);
});

test('Stellar VNXAU stays 0 issued on Stellar and XAUm controls are features', () => {
  const vnx = presentFromChain(reading({
    id: 'stellar-vnxau', ledger: 'stellar', kind: 'classic', displayCode: 'VNXAU', name: 'VNX Gold (VNXAU)',
    gramsPerToken: 1, supply: 0, holders: 65, holdersNote: 'Trustlines reported by Horizon. A trustline is not a holder of metal.',
    countInTotal: false, authRequired: false, revocable: true, clawback: true, issuer: 'GISSUER',
    checks: [
      { key: 'supply', result: 'ok', message: '0 issued on Stellar. The token stays listed. It is left out of totals.' },
      { key: 'auth', result: 'feature', message: 'AUTH_REQUIRED is off.' },
      { key: 'revocable', result: 'feature', message: 'Authorization is revocable. The issuer can freeze a trustline. That is an issuer control, not an event.' },
      { key: 'clawback', result: 'feature', message: 'Clawback is enabled on the issuer account. That is an issuer control, not an event.' },
      { key: 'peg', result: 'na', message: 'Price vs spot is not available.' },
    ],
  }));
  assert.equal(vnx.supplyPrimary, '0 issued on Stellar');
  assert.equal(vnx.presentation.legacyOverall, null);
  assert.ok(itemsOf(vnx.presentation).some(item => item.label === '0 issued on Stellar'));
  assert.ok(itemsOf(vnx.presentation).some(item => item.label === 'Clawback' && item.tone === 'feature'));
  assert.equal(itemsOf(vnx.presentation).some(item => /NoFreeze|xrp-ledger\.toml confirms/i.test(item.label)), false);

  const xaum = presentFromChain(reading({
    id: 'stellar-xaum', ledger: 'stellar', kind: 'sep41', displayCode: 'XAUm',
    checks: [
      { key: 'forced-transfer', result: 'feature', message: 'The published XAUm contract includes forced transfer. That is an issuer control, not an event.' },
      { key: 'blocklist', result: 'feature', message: 'The published XAUm contract includes a blocklist. That is an issuer control, not an event.' },
      { key: 'peg', result: 'na', message: 'Price vs spot is not available.' },
    ],
  }));
  assert.ok(itemsOf(xaum.presentation).some(item => item.label === 'Forced transfer' && item.tone === 'feature'));
  assert.ok(itemsOf(xaum.presentation).some(item => item.label === 'Blocklist'));
  assert.equal(xaum.presentation.legacyOverall, null);
});

function order(html: string, marks: string[]) {
  let at = -1;
  for (const mark of marks) {
    const i = html.indexOf(mark);
    assert.ok(i > at, `missing or out of order: ${mark}`);
    at = i;
  }
}

const SHARED = [
  '<h1>',
  'class="lede"',
  'class="ledger-tabs"',
  'id="ledger-search"',
  'id="ledger-totals"',
  'id="ledger-view"',
  'class="board"',
  'class="legend-row"',
  'What the labels mean',
  'aria-label="Commodities"',
  'aria-label="Market activity"',
  'aria-label="Latest news"',
];

test('ledger pages match the home section order and chain token pages use the detail panels', async () => {
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = async (path: string) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: res.status, type: res.headers.get('content-type') ?? '', html: await res.text() };
  };
  try {
    const home = await get('/');
    const solana = await get('/ledger/solana');
    const stellar = await get('/ledger/stellar');
    const all = await get('/ledger/all');
    for (const page of [home, solana, stellar, all]) order(page.html, SHARED);
    assert.match(solana.html, /data-ledger="solana"[^>]*aria-current="page"/);
    assert.match(stellar.html, /data-ledger="stellar"[^>]*aria-current="page"/);
    assert.match(all.html, /data-ledger="all"[^>]*aria-current="page"/);
    assert.match(solana.html, /<h1>On-chain reserve health for Solana commodity tokens<\/h1>/);
    assert.match(solana.html, /<title>Solana commodity token reserve health · ReserveWatch<\/title>/);
    assert.match(solana.html, /class="asof"/);
    assert.match(solana.html, /Gold spot/);
    assert.match(solana.html, /Not available on this ledger/);
    assert.match(solana.html, /No domain check on this ledger/);
    assert.equal(solana.html.includes('SOLANA_INDEXER_URL'), false);
    const solanaStrip = solana.html.match(/<nav class="commodities"[\s\S]*?<\/nav>/)?.[0] ?? '';
    assert.equal(solanaStrip.includes('href='), false);
    assert.match(solanaStrip, /Gold/);
    const homeStrip = home.html.match(/<nav class="commodities"[\s\S]*?<\/nav>/)?.[0] ?? '';
    assert.match(homeStrip, /href="\/gold"|href="\/commodities\/gold"|href="\/commodities"/);
    assert.match(solana.html, /data-name="[^"]*gold/);
    assert.equal(solana.html.includes('preventDefault'), false);
    assert.equal(solana.html.includes('pushState'), false);
    assert.equal(solana.html.includes('class="ledger-table"'), false);
    assert.equal(solana.html.includes('legacy-mark legacy-'), false);
    assert.ok(solana.html.indexOf('<h3>Market</h3>') > solana.html.indexOf('class="board"'));
    assert.ok(solana.html.indexOf('class="token-card"') < solana.html.indexOf('class="legend-row"'));
    assert.match(solana.html, /<h3>Controls<\/h3>/);
    assert.match(solana.html, /<h3>Identity<\/h3>/);
    const badges = all.html.match(/class="pill ledger-badge"/g) ?? [];
    assert.ok(badges.length >= CHAIN_TOKENS.length, `badges ${badges.length}`);
    assert.match(all.html, /ledger-badge">Solana/);
    assert.match(all.html, /ledger-badge">Stellar/);
    assert.match(stellar.html, /0 issued on Stellar/);
    assert.equal(CHAIN_TOKENS.filter(token => token.ledger === 'solana').every(token => solana.html.includes(token.name)), true);

    const pax = await get('/token/solana-paxg');
    assert.equal(pax.status, 200);
    assert.match(pax.html, /class="panels"/);
    assert.match(pax.html, /class="card stats grid"/);
    assert.match(pax.html, /<h2>Market<\/h2>/);
    assert.match(pax.html, /<h2>Controls<\/h2>/);
    assert.match(pax.html, /<h2>Identity<\/h2>/);
    assert.match(pax.html, /Not available on this ledger/);
    assert.match(pax.html, /solscan\.io/);
    assert.match(pax.html, /Embed this reading/);
    assert.equal(pax.html.includes('legacy-mark legacy-'), false);
    assert.equal(pax.html.includes('<th>Pair</th>'), false);
    assert.match(pax.html, /rel="canonical" href="https:\/\/thereservewatch\.com\/token\/solana-paxg"/);
    assert.match(pax.html, /commodity/);

    const vnx = await get('/token/stellar-vnxau');
    assert.match(vnx.html, /class="panels"/);
    assert.match(vnx.html, /Not available on this ledger/);
    assert.equal(/Legacy (OK|WARN|CRITICAL)/.test(vnx.html), false);

    const badge = await get('/badge/solana-paxg.svg');
    assert.equal(badge.status, 200);
    assert.match(badge.type, /image\/svg\+xml/);
    assert.match(badge.html, /PAXG/);
    assert.equal(/OK|WARN|CRITICAL/.test(badge.html), false);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
