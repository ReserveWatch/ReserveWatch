import assert from 'node:assert/strict';
import test from 'node:test';
import { classify, itemsOf, presentFromReport, type PresentInput, type PresentItem, type Thresholds } from '../src/presentation.ts';
import type { TokenReport } from '../src/monitor.ts';

const TH: Thresholds = {
  lowLiqUsd: 10_000,
  pegWarnPct: 3,
  pegCritPct: 10,
  concWarnPct: 50,
  frozenCritSharePct: 50,
  frozenDustSharePct: 0.05,
};

const base = (over: Partial<PresentInput> = {}): PresentInput => ({
  status: 'warn',
  ledgerRead: 'ok',
  knownStatus: 'active',
  tokenization: 'distributed',
  domainVerified: null,
  flags: {},
  peg: { referenceUsd: null, deviationPct: null, reliable: false },
  liquidityUsd: 0,
  quoteAssets: [],
  hasPool: false,
  spotUnsupported: false,
  frozenLines: 0,
  frozenBalance: 0,
  circulating: 1000,
  transferFeePct: 0,
  topHolderPct: null,
  ...over,
});

const codes = (items: PresentItem[]) => items.map(i => i.code);
const byCode = (items: PresentItem[], code: string) => {
  const hit = items.find(i => i.code === code);
  assert.ok(hit, `missing item ${code}`);
  return hit;
};
const banned = (text: string) => {
  assert.equal(/\b(shady|scam|fake|wrongdoing)\b/i.test(text), false, text);
};

test('enabled control: clawback, concentration, and restricted access stay neutral features', () => {
  const p = classify(base({
    status: 'warn',
    domainVerified: true,
    flags: { allowTrustLineClawback: true, requireAuthorization: true, noFreeze: false, globalFreeze: false },
    hasPool: true,
    liquidityUsd: 2_100_858,
    quoteAssets: ['USDV'],
    peg: { referenceUsd: 4100, deviationPct: 0.015, reliable: true },
    topHolderPct: 66.8,
    frozenLines: 2,
    frozenBalance: 0.00002,
    circulating: 1504,
  }), TH);
  const all = itemsOf(p);
  assert.equal(p.legacyOverall, 'warn');
  assert.equal(p.model, 'categories-v1');
  assert.deepEqual(codes(p.categories.market.items), ['liquidity-measured', 'peg-near']);
  assert.equal(p.categories.market.items.every(i => i.tone === 'measured'), true);
  for (const code of ['clawback', 'require-auth', 'concentration', 'frozen-dust', 'can-freeze']) {
    const item = byCode(p.categories.controls.items, code);
    assert.equal(item.tone, 'feature', code);
  }
  assert.equal(p.categories.controls.items.some(i => i.tone === 'warn' || i.tone === 'critical'), false);
  assert.equal(byCode(p.categories.identity.items, 'identity-confirmed').tone, 'measured');
  assert.match(byCode(all, 'clawback').detail, /do not have final control/i);
  assert.match(byCode(all, 'require-auth').detail, /authorized accounts/i);
  assert.match(byCode(all, 'concentration').detail, /66\.8%/);
  assert.match(p.marketFigures, /nominal \$1/);
  assert.match(byCode(all, 'liquidity-measured').detail, /nominal \$1/);
  assert.match(byCode(all, 'peg-near').detail, /not proof of backing/i);
  for (const item of all) { banned(item.label); banned(item.detail); }
});

test('unknown data: no pool and an unconfirmed issuer are gaps, not a peg break or a fraud tone', () => {
  const p = classify(base({
    status: 'warn',
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    domainVerified: null,
    flags: { allowTrustLineClawback: true, requireAuthorization: true },
    spotUnsupported: true,
    hasPool: false,
    topHolderPct: 100,
  }), TH);
  const all = itemsOf(p);
  assert.equal(byCode(all, 'liquidity-none').tone, 'gap');
  assert.equal(byCode(all, 'liquidity-none').gapKind, 'not-measurable');
  assert.match(byCode(all, 'liquidity-none').detail, /not a broken peg/i);
  assert.equal(byCode(all, 'price-not-measured').tone, 'gap');
  assert.equal(all.some(i => i.code === 'peg-critical' || i.code === 'peg-warn'), false);
  const link = byCode(all, 'identity-unconfirmed');
  assert.equal(link.tone, 'gap');
  assert.equal(link.gapKind, 'not-confirmed');
  assert.match(link.detail, /not a fraud finding/i);
  assert.equal(all.some(i => i.tone === 'critical'), false);
  assert.equal(p.categories.identity.tone, 'gap');
  banned(link.detail);
});

test('adverse state: Global Freeze, discontinued, records conflict, and a majority freeze are critical', () => {
  const p = classify(base({
    status: 'critical',
    knownStatus: 'unverified',
    domainVerified: false,
    flags: { globalFreeze: true, noFreeze: false },
    hasPool: true,
    liquidityUsd: 50_000,
    quoteAssets: ['XRP'],
    peg: { referenceUsd: 100, deviationPct: -12.4, reliable: true },
    frozenLines: 4,
    frozenBalance: 800,
    circulating: 1000,
  }), TH);
  // discontinued is its own case below; this input is unverified + freeze + large reliable peg
  const all = itemsOf(p);
  for (const code of ['global-freeze', 'identity-conflict', 'peg-critical', 'frozen-majority']) {
    assert.equal(byCode(all, code).tone, 'critical', code);
  }
  assert.match(byCode(all, 'global-freeze').detail, /cannot move/i);
  assert.match(byCode(all, 'identity-conflict').detail, /disagree/i);
  assert.match(byCode(all, 'identity-conflict').detail, /not a fraud finding/i);
  assert.equal(byCode(all, 'identity-domain-gap').tone, 'gap');
  assert.equal(p.legacyOverall, 'critical');
  for (const item of all) banned(item.label + ' ' + item.detail);

  const stopped = classify(base({
    status: 'critical',
    knownStatus: 'discontinued',
    flags: { globalFreeze: true },
    hasPool: true,
    liquidityUsd: 17,
    quoteAssets: ['XRP', 'RLUSD'],
    peg: { referenceUsd: 2, deviationPct: -98.8, reliable: false },
  }), TH);
  assert.equal(byCode(itemsOf(stopped), 'discontinued').tone, 'critical');
  assert.equal(byCode(itemsOf(stopped), 'global-freeze').tone, 'critical');
  // Thin pool and an unreliable raw print stay gaps even when other categories are critical.
  assert.equal(byCode(itemsOf(stopped), 'liquidity-thin').tone, 'gap');
  assert.equal(byCode(itemsOf(stopped), 'peg-not-measurable').tone, 'gap');
  assert.match(stopped.marketFigures, /not graded/);
  assert.match(stopped.marketFigures, /nominal \$1/);
});

test('peg reliability: a large raw deviation is critical only when the AMM reading is reliable', () => {
  const unreliable = classify(base({
    status: 'warn',
    hasPool: true,
    liquidityUsd: 95,
    quoteAssets: ['XRP'],
    peg: { referenceUsd: 0.2, deviationPct: -99.95, reliable: false },
  }), TH);
  const raw = byCode(itemsOf(unreliable), 'peg-not-measurable');
  assert.equal(raw.tone, 'gap');
  assert.match(raw.detail, /not a broken peg/i);
  assert.match(unreliable.marketFigures, /raw reading -99\.95%/);
  assert.equal(itemsOf(unreliable).some(i => i.tone === 'warn' || i.tone === 'critical'), false);

  const graded = (deviationPct: number) => classify(base({
    status: 'ok',
    hasPool: true,
    liquidityUsd: 80_000,
    quoteAssets: ['XRP'],
    peg: { referenceUsd: 100, deviationPct, reliable: true },
    domainVerified: true,
  }), TH);

  assert.equal(byCode(itemsOf(graded(0.4)), 'peg-near').tone, 'measured');
  assert.equal(byCode(itemsOf(graded(-2.99)), 'peg-near').tone, 'measured');
  assert.equal(byCode(itemsOf(graded(3)), 'peg-warn').tone, 'warn');
  assert.equal(byCode(itemsOf(graded(-9.9)), 'peg-warn').tone, 'warn');
  assert.equal(byCode(itemsOf(graded(10)), 'peg-critical').tone, 'critical');
  assert.equal(byCode(itemsOf(graded(-40)), 'peg-critical').tone, 'critical');

  // No spot reference is a gap even if a caller also passes a wild "reliable" deviation.
  const noSpot = classify(base({
    spotUnsupported: true,
    hasPool: false,
    peg: { referenceUsd: 10, deviationPct: -80, reliable: true },
  }), TH);
  assert.equal(byCode(itemsOf(noSpot), 'price-not-measured').tone, 'gap');
  assert.equal(itemsOf(noSpot).some(i => i.code.startsWith('peg-')), false);

  const noBook = classify(base({ hasPool: false, peg: { referenceUsd: null, deviationPct: null, reliable: false } }), TH);
  assert.equal(byCode(itemsOf(noBook), 'liquidity-none').gapKind, 'not-measurable');
  assert.equal(byCode(itemsOf(noBook), 'peg-no-price').tone, 'gap');
  assert.match(byCode(itemsOf(noBook), 'peg-no-price').detail, /not a peg break/i);
});

test('material freezes are cautions; empty frozen lines stay noted; legacy status is not rewritten', () => {
  const dust = classify(base({ frozenLines: 3, frozenBalance: 0, circulating: 2_000_000, status: 'warn' }), TH);
  assert.equal(byCode(itemsOf(dust), 'frozen-dust').tone, 'feature');
  assert.equal(dust.legacyOverall, 'warn');

  const some = classify(base({ frozenLines: 2, frozenBalance: 100, circulating: 1000, status: 'warn' }), TH);
  assert.equal(byCode(itemsOf(some), 'frozen-supply').tone, 'warn');

  const most = classify(base({ frozenLines: 2, frozenBalance: 600, circulating: 1000, status: 'critical' }), TH);
  assert.equal(byCode(itemsOf(most), 'frozen-majority').tone, 'critical');

  const clean = classify(base({
    status: 'ok',
    domainVerified: true,
    flags: { noFreeze: true },
    hasPool: true,
    liquidityUsd: 20_000,
    peg: { referenceUsd: 100, deviationPct: 0.2, reliable: true },
  }), TH);
  assert.equal(clean.legacyOverall, 'ok');
  assert.equal(itemsOf(clean).some(i => i.tone === 'warn' || i.tone === 'critical'), false);
  assert.equal(byCode(itemsOf(clean), 'nofreeze').tone, 'measured');
});

test('a failed issuer read is not presented as a confirmed adverse market', () => {
  const unread = classify(base({ ledgerRead: 'unread', status: 'warn', hasPool: false, peg: { referenceUsd: null, deviationPct: -100, reliable: false } }), TH);
  assert.equal(byCode(itemsOf(unread), 'issuer-unread').tone, 'gap');
  assert.equal(itemsOf(unread).some(i => i.code === 'peg-critical' || i.code === 'liquidity-none'), false);

  const missing = classify(base({ ledgerRead: 'missing', status: 'critical' }), TH);
  assert.equal(byCode(itemsOf(missing), 'issuer-missing').tone, 'critical');
  assert.equal(missing.legacyOverall, 'critical');
});

test('presentFromReport maps a live-shaped report without mutating checks or status', () => {
  const report = {
    status: 'warn',
    knownStatus: 'active',
    tokenization: 'distributed',
    domainVerified: true,
    flags: { allowTrustLineClawback: true, globalFreeze: false, noFreeze: false, requireAuthorization: false },
    peg: { referenceUsd: 4000, deviationPct: 0.02, reliable: true, source: 'AMM', liquidityUsd: 2_000_000 },
    liquidity: { totalUsd: 2_000_000, quoteAssets: ['USDV'], pools: 1 },
    pools: [{ pair: 'XAUa/USDV', exists: true, tvlUsd: 2_000_000, counterAsset: 'USDV' }],
    spot: { unsupported: false },
    holders: {
      frozenLines: 2, frozenBalance: 0.00002, trustlines: 100, nonZero: 90, deepFrozenLines: 0,
      topHolders: [{ account: 'rTest', balance: 1, pct: 66.8 }],
    },
    supply: { circulating: 1500, rawObligations: 1500, treasury: 0 },
    transferFeePct: 0,
    checks: [
      { key: 'clawback', severity: 'warn', message: 'Issuer can claw back tokens from holders (allowTrustLineClawback).' },
      { key: 'liquidity', severity: 'ok', message: 'AMM liquidity.' },
      { key: 'peg', severity: 'ok', message: 'Price within 0.02% of spot.' },
      { key: 'domain', severity: 'ok', message: 'listed' },
    ],
  } as unknown as TokenReport;
  const before = JSON.stringify(report.checks) + report.status;
  const p = presentFromReport(report, TH);
  assert.equal(JSON.stringify(report.checks) + report.status, before);
  assert.equal(p.legacyOverall, 'warn');
  assert.equal(byCode(itemsOf(p), 'clawback').tone, 'feature');
  assert.equal(byCode(itemsOf(p), 'peg-near').tone, 'measured');
  assert.equal(byCode(itemsOf(p), 'liquidity-measured').tone, 'measured');
  assert.match(p.marketFigures, /USDV/);
  assert.match(p.marketFigures, /nominal \$1/);
});
