import assert from 'node:assert/strict';
import test from 'node:test';
import { renderDetailLead, renderHomeCard, type CardNav } from '../src/face.ts';
import type { TokenReport } from '../src/monitor.ts';
import type { Thresholds } from '../src/presentation.ts';

const TH: Thresholds = {
  lowLiqUsd: 10_000, pegWarnPct: 3, pegCritPct: 10, concWarnPct: 50,
  frozenCritSharePct: 50, frozenDustSharePct: 0.05,
};
const NAV: CardNav = { href: '/commodities/gold', name: 'Gold' };

function report(over: Record<string, unknown>): TokenReport {
  const base = {
    id: 'sample', name: 'Sample', project: 'Sample project', displayCode: 'S',
    label: undefined, status: 'warn', knownStatus: 'active', tokenization: 'distributed',
    domainVerified: null,
    flags: {},
    peg: { referenceUsd: null, deviationPct: null, reliable: false },
    liquidity: { totalUsd: 0, quoteAssets: [], pools: 0 },
    pools: [],
    spot: { unsupported: false },
    holders: { frozenLines: 0, frozenBalance: 0, trustlines: 1, nonZero: 1, deepFrozenLines: 0, topHolders: [] },
    supply: { circulating: 1000, rawObligations: 1000, treasury: 0 },
    transferFeePct: 0,
    checks: [],
  };
  return { ...base, ...over } as unknown as TokenReport;
}

const beforeDetails = (html: string) => {
  const i = html.indexOf('<details');
  return i === -1 ? html : html.slice(0, i);
};

test('measured card is scannable, keeps the USDV caveat visible, and does not say safe', () => {
  const html = renderHomeCard(report({
    id: 'assetiko-xaua', name: 'Assetiko XAUa', project: 'Assetiko (BVI)', displayCode: 'XAUa',
    status: 'warn', domainVerified: true,
    flags: { allowTrustLineClawback: true, noFreeze: false, globalFreeze: false },
    liquidity: { totalUsd: 2_100_858, quoteAssets: ['USDV'], pools: 1 },
    pools: [{ exists: true, tvlUsd: 2_100_858, counterAsset: 'USDV' }],
    peg: { referenceUsd: 4100, deviationPct: -0.08, reliable: true },
    holders: { frozenLines: 2, frozenBalance: 0.00002, trustlines: 100, nonZero: 91, deepFrozenLines: 0, topHolders: [{ account: 'r', balance: 1, pct: 66.8 }] },
    supply: { circulating: 1504, rawObligations: 1504, treasury: 0 },
  }), NAV, TH);
  const face = beforeDetails(html);
  assert.equal(face.includes('alert-banner'), false);
  assert.match(face, /Near spot -0\.08%/);
  assert.match(face, /\$2,100,858 pool/);
  assert.match(face, /nominal \$1/);
  assert.match(face, /depth gate/);
  assert.match(face, /class="peg-mark"/);
  assert.match(face, /Clawback/);
  assert.match(face, /Concentrated 66\.8%/);
  assert.match(face, /Identity confirmed/);
  assert.match(face, /Legacy WARN/);
  assert.equal(/\bsafe\b/i.test(face), false);
  assert.match(html, /<details/);
  assert.match(html, /do not have final control/i);
  const meter = face.match(/class="meter" role="img"[^>]*>\s*<span style="width:([^"%]+)%"/);
  assert.ok(meter);
  assert.equal(Number(meter[1]), 100);
});

test('a missing pool is not drawn as a peg chart', () => {
  const html = renderHomeCard(report({
    id: 'meld-gld', name: 'Meld Gold GLD', displayCode: 'GLD',
    pools: [], liquidity: { totalUsd: 0, quoteAssets: [], pools: 0 },
    peg: { referenceUsd: null, deviationPct: null, reliable: false },
    holders: { frozenLines: 0, frozenBalance: 0, trustlines: 2, nonZero: 1, deepFrozenLines: 0, topHolders: [{ account: 'r', balance: 1000, pct: 100 }] },
  }), NAV, TH);
  const face = beforeDetails(html);
  assert.match(face, /No pool/);
  assert.match(face, /No on-ledger price/);
  assert.equal(face.includes('peg-mark'), false);
  assert.equal(face.includes('class="meter"'), false);
  assert.match(face, /Concentrated 100%/);
});

test('critical and caution copy stays outside the expandable readings', () => {
  const bpg = renderHomeCard(report({
    id: 'bpg-xau', name: 'BPG XAU (GateHub)', displayCode: 'XAU', status: 'critical',
    knownStatus: 'discontinued',
    flags: { globalFreeze: true },
    liquidity: { totalUsd: 17, quoteAssets: ['XRP', 'RLUSD'], pools: 2 },
    pools: [{ exists: true, tvlUsd: 17, counterAsset: 'XRP' }],
    peg: { referenceUsd: 2, deviationPct: -98.8, reliable: false },
  }), NAV, TH);
  const face = beforeDetails(bpg);
  assert.match(face, /class="alert-banner"/);
  assert.match(face, /cannot move/);
  assert.match(face, /not redeemable/);
  assert.match(face, /Peg not measurable/);
  assert.match(face, /nominal \$1/);
  assert.equal(face.includes('peg-mark'), false);
  assert.equal(face.includes('<details'), false);
  const lead = renderDetailLead(report({
    id: 'bpg-xau', name: 'BPG XAU', displayCode: 'XAU', status: 'critical',
    knownStatus: 'discontinued', flags: { globalFreeze: true },
    liquidity: { totalUsd: 17, quoteAssets: ['XRP'], pools: 1 },
    pools: [{ exists: true, tvlUsd: 17, counterAsset: 'XRP' }],
    peg: { referenceUsd: 2, deviationPct: -98.8, reliable: false },
  }), TH);
  const leadFace = beforeDetails(lead);
  assert.match(leadFace, /alert-banner/);
  assert.match(leadFace, /cannot move/);
  assert.equal(leadFace.includes('<details'), false);

  const conflict = renderHomeCard(report({
    id: 'unlisted-gold-rmeld', name: 'Unverified GOLD', displayCode: 'GOLD', status: 'critical',
    knownStatus: 'unverified', domainVerified: false, label: 'Unverified listing',
    liquidity: { totalUsd: 95, quoteAssets: ['XRP'], pools: 1 },
    pools: [{ exists: true, tvlUsd: 95, counterAsset: 'XRP' }],
    peg: { referenceUsd: 0.2, deviationPct: -99.95, reliable: false },
    holders: { frozenLines: 3, frozenBalance: 0, trustlines: 10, nonZero: 90, deepFrozenLines: 0, topHolders: [{ account: 'r', balance: 1, pct: 93.8 }] },
  }), NAV, TH);
  const conflictFace = beforeDetails(conflict);
  assert.match(conflictFace, /Records conflict/);
  assert.match(conflictFace, /disagree/);
  assert.match(conflictFace, /Peg not measurable/);
  assert.equal(conflictFace.includes('peg-mark'), false);
  assert.match(conflict, /Unverified listing/);
});

test('a reliable large peg gap is a visible critical banner, not only a chart', () => {
  const html = renderDetailLead(report({
    id: 'wide', name: 'Wide', displayCode: 'W', status: 'critical', domainVerified: true,
    liquidity: { totalUsd: 80_000, quoteAssets: ['XRP'], pools: 1 },
    pools: [{ exists: true, tvlUsd: 80_000, counterAsset: 'XRP' }],
    peg: { referenceUsd: 50, deviationPct: -12.4, reliable: true },
  }), TH);
  const face = beforeDetails(html);
  assert.match(face, /Critical/);
  assert.match(face, /Large peg gap -12\.4%/);
  assert.match(face, /peg-mark/);
  assert.match(face, /Not a safety rating/);
});
