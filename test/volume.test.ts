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

function trade(seq: number, volume: number, price: number, hash = `h${seq}-${volume}`): ExchangeTrade {
  return { txHash: hash, ledgerSequence: seq, volume, price };
}

test('dollar stables are quote assets, not commodity volume', () => {
  assert.equal(isDollarStable(RLUSD.currency), true);
  assert.equal(isDollarStable(USDV.currency), true);
  assert.equal(isDollarStable('USDC'), true);
  assert.equal(isDollarStable('USDT'), true);
  assert.equal(isDollarStable('5841556100000000000000000000000000000000'), false);
});

test('a complete page prices USD from each fill and compares with the prior 7 days', () => {
  const trades = [
    trade(recentStart + 10, 2, 100),
    trade(recentStart + 20, 1, 50),
    trade(priorStart + 5, 1, 100),
    trade(priorStart - 10, 9, 100),
  ];
  const a = activityFromTrades(trades, 'XAUa', clock, 100);
  assert.equal(a.measured, true);
  assert.equal(a.usdPriced, true);
  assert.equal(a.recent.trades, 2);
  assert.equal(a.recent.baseVolume, 3);
  assert.equal(a.recent.usdVolume, 250);
  assert.equal(a.prior.trades, 1);
  assert.equal(a.prior.usdVolume, 100);
  assert.equal(a.direction, 'up');
  assert.equal(a.changePct, 150);
  assert.match(activityPlain(a), /\$250/);
  assert.doesNotMatch(activityPlain(a), /not measured/);
});

test('a capped page that never reaches the prior week does not invent that week', () => {
  const trades = [
    trade(priorStart + 10, 1, 10, 'boundary'),
    ...Array.from({ length: 99 }, (_, i) => trade(recentStart + i, 1, 10, `n${i}`)),
  ];
  const a = activityFromTrades(trades, 'XAUa', clock, 100);
  assert.equal(a.measured, true);
  assert.equal(a.recent.complete, true);
  assert.equal(a.prior.complete, false);
  assert.equal(a.direction, 'unknown');
  assert.match(activityPlain(a), /prior 7 days not measured/);
});

test('a capped page still inside the latest week is not measured, and is not zero', () => {
  const trades = Array.from({ length: 100 }, (_, i) => trade(recentStart + 50 + i, 1, 10, `r${i}`));
  const a = activityFromTrades(trades, 'XAUa', clock, 100);
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

test('fills with no USD price stay in native units', () => {
  const a = activityFromTrades([trade(recentStart + 5, 4, 0), trade(priorStart + 5, 2, 0)], 'JMWH', clock, 100);
  assert.equal(a.measured, true);
  assert.equal(a.usdPriced, false);
  assert.equal(a.recent.usdVolume, null);
  assert.equal(a.recent.baseVolume, 4);
  assert.match(activityPlain(a), /4 JMWH/);
  assert.doesNotMatch(activityPlain(a), /\$/);
});

test('duplicate fills across quote pairs are counted once', () => {
  const a = activityFromTrades([
    trade(recentStart + 1, 5, 10, 'same'),
    trade(recentStart + 1, 5, 10, 'same'),
  ], 'XAUa', clock, 100);
  assert.equal(a.recent.trades, 1);
  assert.equal(a.recent.usdVolume, 50);
});

test('the industry dollar total skips unknown tokens and dollar stables', () => {
  const priced = activityFromTrades([trade(recentStart + 1, 2, 100), trade(priorStart + 1, 1, 100)], 'XAUa', clock, 100);
  const zero = activityFromTrades([], 'GLD', clock, 100);
  const missing = unknownActivity('SLV', 'unavailable');
  const stable = activityFromTrades([trade(recentStart + 1, 1_000_000, 1)], 'USDV', clock, 100);
  const industry = industryTotal([
    { currency: 'XAUa', activity: priced },
    { currency: 'GLD', activity: zero },
    { currency: 'SLV', activity: missing },
    { currency: USDV.currency, activity: stable },
  ], [], '2026-11-18T00:00:00Z');
  assert.equal(industry.usdTotal, 200);
  assert.equal(industry.tokensUnknown, 1);
  assert.equal(industry.complete, false);
  assert.equal(industry.direction, 'unknown');
  assert.equal(industry.priorUsdTotal, null);
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
