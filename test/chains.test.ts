import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHAIN_LISTINGS, buildChainGrowth, priceFarFromSpot, rememberChainWeek, splitSevenDayVolume,
  type OffchainReading, type XrplChainToken,
} from '../src/chains.ts';
import { RLUSD } from '../src/config/tokens.ts';

const spots = { XAU: 3700, XAG: 45 };

function xrpl(partial: Partial<XrplChainToken> & Pick<XrplChainToken, 'id' | 'currency'>): XrplChainToken {
  return {
    issuer: 'rIssuer', symbol: partial.id, name: partial.id, holders: 10, circulating: 2,
    usdPerToken: 100, noSpot: false, volumeUsd: 5, priorVolumeUsd: 4, volumeMeasured: true, ...partial,
  };
}

test('dollar stables are not XRPL commodity tokens, and a chain with no reading is not zero', () => {
  const growth = buildChainGrowth({
    asOf: '2026-11-18T00:00:00Z', week: '2026-W47', spots, trend: [],
    xrpl: [
      xrpl({ id: 'xaua', currency: 'XAUa', issuer: 'rA', circulating: 2, usdPerToken: 100, holders: 3 }),
      xrpl({ id: 'usdv', currency: 'USDV', circulating: 1_000_000, usdPerToken: 1 }),
      xrpl({ id: 'rlusd', currency: RLUSD.currency, circulating: 9, usdPerToken: 1 }),
    ],
    offchain: [],
  });
  const xrplChain = growth.chains.find(c => c.id === 'xrpl')!;
  assert.equal(xrplChain.tokens, 1);
  assert.equal(xrplChain.marketValueUsd, 200);
  assert.equal(xrplChain.holders, 3);
  const stellar = growth.chains.find(c => c.id === 'stellar')!;
  assert.equal(stellar.enumerated, false);
  assert.equal(stellar.tokens, null);
  assert.equal(stellar.marketValueUsd, null);
  assert.equal(stellar.volume7dUsd, null);
  const solana = growth.chains.find(c => c.id === 'solana')!;
  assert.equal(solana.marketValueUsd, null);
});

test('market value is this chain’s supply times price, and a price far from spot is not measured', () => {
  const listing = CHAIN_LISTINGS.find(l => l.id === 'kau')!;
  const sane: OffchainReading = { listing, supply: 396748, priceUsd: 120, volume7dUsd: 10, priorVolume7dUsd: 8, note: '' };
  const wild = { ...sane, priceUsd: 120 * 20 };
  const growth = buildChainGrowth({
    asOf: '2026-11-18T00:00:00Z', week: '2026-W47', spots, trend: [], xrpl: [], offchain: [sane],
  });
  const row = growth.chains.find(c => c.id === 'ethereum')!.rows.find(r => r.id === 'kau')!;
  assert.equal(row.marketValueUsd, 396748 * 120);
  assert.notEqual(row.marketValueUsd, 326_000_000);
  assert.equal(priceFarFromSpot(120, 'gram', 'XAU', spots), false);
  assert.equal(priceFarFromSpot(120 * 20, 'gram', 'XAU', spots), true);
  const rejected = buildChainGrowth({
    asOf: '2026-11-18T00:00:00Z', week: '2026-W47', spots, trend: [], xrpl: [], offchain: [wild],
  });
  const bad = rejected.chains.find(c => c.id === 'ethereum')!.rows.find(r => r.id === 'kau')!;
  assert.equal(bad.marketValueUsd, null);
  assert.equal(bad.volume7dUsd, null);
  const eth = rejected.chains.find(c => c.id === 'ethereum')!;
  assert.equal(eth.marketValueUsd, null);
  assert.ok(eth.marketGaps > 0);
});

test('a token with no public spot is left out of the dollar figure and is not a failed read', () => {
  const growth = buildChainGrowth({
    asOf: '2026-11-18T00:00:00Z', week: '2026-W47', spots, trend: [], offchain: [],
    xrpl: [
      xrpl({ id: 'xaua', currency: 'XAUa', circulating: 1, usdPerToken: 50 }),
      xrpl({ id: 'dia', currency: 'DIA', noSpot: true, usdPerToken: null, circulating: 100, volumeUsd: 0, priorVolumeUsd: 0 }),
      xrpl({ id: 'rmeld', currency: 'GOLD', unitUnconfirmed: true, circulating: 2_000_000, usdPerToken: 120, volumeUsd: 0, priorVolumeUsd: 0 }),
    ],
  });
  const chain = growth.chains.find(c => c.id === 'xrpl')!;
  assert.equal(chain.marketValueUsd, 50);
  assert.equal(chain.marketGaps, 0);
  assert.equal(chain.noSpot, 2);
  assert.ok(!chain.rows.some(r => r.id === 'rmeld' && r.marketValueUsd != null));
  assert.equal(chain.marketDirection, 'unknown');
});

test('seven midnight volumes make a week, and the intraday point is not added again', () => {
  const day = 86_400_000;
  const start = Date.UTC(2026, 10, 1);
  const points: [number, number][] = [];
  for (let i = 0; i < 14; i++) points.push([start + i * day, 10]);
  points.push([start + 14 * day + 3_600_000, 999]);
  const split = splitSevenDayVolume(points);
  assert.equal(split.prior, 70);
  assert.equal(split.recent, 70);
  assert.equal(splitSevenDayVolume(points.slice(0, 5)).recent, null);
});

test('week-over-week uses a saved complete market value, and an incomplete pass is not stored as zero', () => {
  const listing = CHAIN_LISTINGS.find(l => l.id === 'paxg')!;
  const reading: OffchainReading = { listing, supply: 2, priceUsd: 3700, volume7dUsd: 30, priorVolume7dUsd: 10, note: '' };
  const first = buildChainGrowth({
    asOf: '2026-11-11T00:00:00Z', week: '2026-W46', spots, trend: [], xrpl: [],
    offchain: [reading],
  });
  const point = {
    week: '2026-W46', asOf: first.asOf,
    chains: first.chains.map(c => ({
      id: c.id,
      marketValueUsd: c.marketGaps === 0 ? c.marketValueUsd : null,
      volume7dUsd: c.volumeGaps === 0 ? c.volume7dUsd : null,
      marketComplete: c.enumerated && c.marketGaps === 0 && c.marketValueUsd != null,
      volumeComplete: c.enumerated && c.volumeGaps === 0 && c.volume7dUsd != null,
    })),
  };
  const kept = rememberChainWeek([], { ...point, chains: point.chains.map(c => ({ ...c, marketComplete: false, volumeComplete: false, marketValueUsd: null, volume7dUsd: null })) });
  assert.equal(kept.length, 0);
  const trend = rememberChainWeek([], point);
  const next = buildChainGrowth({
    asOf: '2026-11-18T00:00:00Z', week: '2026-W47', spots, trend, xrpl: [],
    offchain: [{ ...reading, supply: 3, volume7dUsd: 20, priorVolume7dUsd: 30 }],
  });
  const eth = next.chains.find(c => c.id === 'ethereum')!;
  assert.equal(eth.priorMarketValueUsd, 2 * 3700);
  assert.equal(eth.marketValueUsd, 3 * 3700);
  assert.equal(eth.marketDirection, 'up');
  assert.equal(eth.volumeDirection, 'down');
});

test('the same primary token is not also listed on a second chain', () => {
  const paxg = CHAIN_LISTINGS.filter(l => l.coingeckoId === 'pax-gold');
  assert.equal(paxg.length, 1);
  assert.equal(paxg[0].chain, 'ethereum');
  assert.equal(CHAIN_LISTINGS.some(l => l.chain === 'solana'), false);
  assert.equal(new Set(CHAIN_LISTINGS.map(l => l.id)).size, CHAIN_LISTINGS.length);
});
