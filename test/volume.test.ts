import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activityFromTrades, activityPlain, compareWindows, industryTotal, isDollarStable, isoWeek, pctLabel, rememberWeek, unknownActivity,
  type ExchangeTrade, type LedgerClock,
} from '../src/volume.ts';
import { RLUSD, USDV } from '../src/config/tokens.ts';

const clock: LedgerClock = { ledgerIndex: 1_000_000, secPerLedger: 4 };
// 7 days of ledgers = 7*86400/4 = 151200
const recentStart = 1_000_000 - 151_200;
const priorStart = 1_000_000 - 302_400;

function trade(seq: number, quoteVolume: number, quotePerBase: number, hash = `h${seq}-${quoteVolume}`): ExchangeTrade {
  return { txHash: hash, ledgerSequence: seq, quote: 'XRP', quoteVolume, quotePerBase };
}
const priced = { pageCap: 100, xrpUsd: 1 };

test('dollar stables are quote assets, not commodity volume', () => {
  assert.equal(isDollarStable(RLUSD.currency), true);
  assert.equal(isDollarStable(USDV.currency), true);
  assert.equal(isDollarStable('USDC'), true);
  assert.equal(isDollarStable('USDT'), true);
  assert.equal(isDollarStable('5841556100000000000000000000000000000000'), false);
});

test('a complete page prices USD from the quote leg, not quote times quote-per-token', () => {
  const trades = [
    trade(recentStart + 10, 10, 4000),
    trade(recentStart + 20, 5, 2000),
    trade(priorStart + 5, 4, 4000),
    trade(priorStart - 10, 9, 4000),
  ];
  const a = activityFromTrades(trades, 'XAUa', clock, { pageCap: 100, xrpUsd: 2 });
  assert.equal(a.measured, true);
  assert.equal(a.usdPriced, true);
  assert.equal(a.recent.trades, 2);
  assert.equal(a.recent.baseVolume, 0.005);
  assert.equal(a.recent.usdVolume, 30);
  assert.equal(a.prior.trades, 1);
  assert.equal(a.prior.usdVolume, 8);
  assert.notEqual(a.recent.usdVolume, 10 * 4000 + 5 * 2000);
  assert.equal(a.direction, 'up');
  assert.equal(a.changePct, 275);
  assert.match(activityPlain(a), /\$30/);
  assert.doesNotMatch(activityPlain(a), /not measured/);
});

test('a capped page that never reaches the prior week does not invent that week', () => {
  const trades = [
    trade(priorStart + 10, 1, 10, 'boundary'),
    ...Array.from({ length: 99 }, (_, i) => trade(recentStart + i, 1, 10, `n${i}`)),
  ];
  const a = activityFromTrades(trades, 'XAUa', clock, priced);
  assert.equal(a.measured, true);
  assert.equal(a.recent.complete, true);
  assert.equal(a.prior.complete, false);
  assert.equal(a.direction, 'unknown');
  assert.match(activityPlain(a), /prior 7 days not measured/);
});

test('a capped page still inside the latest week is not measured, and is not zero', () => {
  const trades = Array.from({ length: 100 }, (_, i) => trade(recentStart + 50 + i, 1, 10, `r${i}`));
  const a = activityFromTrades(trades, 'XAUa', clock, priced);
  assert.equal(a.measured, false);
  assert.equal(activityPlain(a), '7-day volume not measured');
  assert.equal(a.recent.usdVolume, null);
});

test('an empty page is a measured zero, not an unknown', () => {
  const a = activityFromTrades([], 'GLD', clock, 100);
  assert.equal(a.measured, true);
  assert.equal(a.recent.trades, 0);
  assert.equal(a.recent.usdVolume, 0);
  assert.equal(a.direction, 'flat');
  assert.match(activityPlain(a), /\$0/);
  assert.match(activityPlain(a), /0 trades/);
});

test('fills with no XRP/USD rate stay in native token units', () => {
  const a = activityFromTrades([trade(recentStart + 5, 4, 10), trade(priorStart + 5, 2, 10)], 'JMWH', clock, { pageCap: 100 });
  assert.equal(a.measured, true);
  assert.equal(a.usdPriced, false);
  assert.equal(a.recent.usdVolume, null);
  assert.equal(a.recent.baseVolume, 0.4);
  assert.match(activityPlain(a), /0.4 JMWH/);
  assert.doesNotMatch(activityPlain(a), /\$/);
});

test('a fill with no quote price is not measured, and is not zero', () => {
  const a = activityFromTrades([trade(recentStart + 5, 4, 0)], 'JMWH', clock, priced);
  assert.equal(a.measured, false);
  assert.equal(a.recent.usdVolume, null);
  assert.equal(activityPlain(a), '7-day volume not measured');
});

test('duplicate fills across quote pairs are counted once', () => {
  const a = activityFromTrades([
    trade(recentStart + 1, 5, 10, 'same'),
    trade(recentStart + 1, 5, 10, 'same'),
  ], 'XAUa', clock, priced);
  assert.equal(a.recent.trades, 1);
  assert.equal(a.recent.baseVolume, 0.5);
  assert.equal(a.recent.usdVolume, 5);
});

test('the industry dollar total skips unknown tokens and dollar stables', () => {
  const pricedTok = activityFromTrades([trade(recentStart + 1, 200, 100), trade(priorStart + 1, 100, 100)], 'XAUa', clock, priced);
  const zero = activityFromTrades([], 'GLD', clock, priced);
  const missing = unknownActivity('SLV', 'unavailable');
  const stable = activityFromTrades([trade(recentStart + 1, 1_000_000, 1)], 'USDV', clock, priced);
  const industry = industryTotal([
    { currency: 'XAUa', activity: pricedTok },
    { currency: 'GLD', activity: zero },
    { currency: 'SLV', activity: missing },
    { currency: USDV.currency, activity: stable },
  ], [], '2026-11-18T00:00:00Z');
  assert.equal(industry.usdTotal, 200);
  assert.equal(industry.tokensUnknown, 1);
  assert.equal(industry.complete, false);
  assert.equal(industry.direction, 'up');
  assert.equal(industry.priorUsdTotal, 100);
  assert.equal(industry.changeCovered, 2);
});

test('week-over-week percent and the saved trend ignore an incomplete pass', () => {
  assert.deepEqual(compareWindows(50, 100, true), { changePct: -50, direction: 'down' });
  assert.equal(compareWindows(0, 0, true).direction, 'flat');
  assert.equal(compareWindows(5, 0, true).changePct, null);
  const kept = rememberWeek(
    [{ week: '2026-W45', asOf: 'a', usdTotal: 10, complete: true }],
    { week: '2026-W46', asOf: 'b', usdTotal: null, complete: false },
  );
  assert.equal(kept.length, 1);
  const next = rememberWeek(kept, { week: '2026-W46', asOf: 'c', usdTotal: 12, complete: true });
  assert.deepEqual(next.map(p => p.week), ['2026-W45', '2026-W46']);
  assert.equal(isoWeek(new Date('2026-11-18T12:00:00Z')), '2026-W47');
  assert.equal(pctLabel(89.64), '90');
  assert.equal(pctLabel(99.88), '99.9');
});

test('a quote-sized fill is the XRP leg, so it is not priced as ounces times XRP-per-ounce', () => {
  const a = activityFromTrades([
    trade(recentStart + 5, 122.208307, 1465.365219, 'xpta'),
    trade(priorStart + 5, 1, 1465, 'dust'),
  ], 'XPTa', clock, { ...priced, referenceUsdPerToken: 1465 });
  assert.ok(Math.abs(a.recent.baseVolume - 122.208307 / 1465.365219) < 1e-9);
  assert.ok(Math.abs((a.recent.usdVolume ?? 0) - 122.208307) < 1e-6);
  assert.ok((a.recent.usdVolume ?? 0) < 200);
});

test('a print more than 5× from spot is dropped, and a larger one leaves the week unmeasured', () => {
  const small = activityFromTrades([
    trade(recentStart + 1, 100, 100, 'kept'),
    trade(recentStart + 2, 1, 10_000, 'dust'),
    trade(priorStart + 1, 100, 100, 'prior'),
  ], 'XAUa', clock, { ...priced, referenceUsdPerToken: 100 });
  assert.equal(small.measured, true);
  assert.equal(small.recent.trades, 1);
  assert.equal(small.recent.usdVolume, 100);

  const dominant = activityFromTrades([
    trade(recentStart + 1, 1, 100, 'kept'),
    trade(recentStart + 2, 1000, 10_000, 'wild'),
  ], 'XPTa', clock, { ...priced, referenceUsdPerToken: 100 });
  assert.equal(dominant.measured, false);
  assert.equal(dominant.recent.usdVolume, null);
  assert.equal(activityPlain(dominant), '7-day volume not measured');

  const industry = industryTotal([
    { currency: 'XAUa', activity: small },
    { currency: 'XPTa', activity: dominant },
  ], [], '2026-11-18T00:00:00Z');
  assert.equal(industry.usdTotal, 100);
  assert.equal(industry.tokensUnknown, 1);
  assert.equal(industry.direction, 'flat');
  assert.equal(industry.priorUsdTotal, 100);
  assert.equal(industry.changeCovered, 1);
});
