// Rolling 7-day trading activity for tracked commodity tokens.
//
// Method (checked 18 Nov 2026):
// XRPL Meta (https://s1.xrplmeta.org) follows public rippled nodes, backfills
// ledger history, and records DEX offer fills and AMM swaps as "exchanges".
// rippled itself has no "volume for this currency" command. account_tx on the
// issuer misses holder-to-holder trades. Walking every ledger for 14 days is
// not practical on a public node. The exchange list is the ledger-derived
// record we can actually read.
//
// For each tracked token we request exchanges against XRP, RLUSD, and USDV
// (quote assets only — those dollar tokens are never themselves commodities).
// Checked against the ledger transactions themselves: `volume` is the quote
// amount (XRP received by the maker, or RLUSD/USDV at a nominal $1) and
// `price` is quote per token, not USD. Token size is volume ÷ price. Dollars
// are the quote amount times the quote's USD price (current XRP/USD for an
// XRP leg). Multiplying volume by price counts the quote twice and inflates
// a small fill into a six-figure print. It is not a vault value.
//
// The public exchanges endpoint, as observed, returns one page of the newest
// 100 fills and ignores limit, offset, and newest_first. A window is complete
// only when that page reaches past the start of the window (or the page is
// shorter than 100, meaning it was not cut off). A cut-off window is
// "not measured", not zero. A complete page of no trades is a measured zero.
// Older weekly snapshots are not backfilled: this page cannot see October's
// fills once newer trades occupy the 100-row cap.

import { RLUSD, USDV } from './config/tokens.js';

export const VOLUME_SOURCE = 'xrplmeta-exchanges' as const;
export const WINDOW_DAYS = 7;
export const PAGE_CAP = 100;
export const FLAT_PCT = 1;
/** A fill this many times above or below spot, where a spot price per token exists, is not used. */
export const OUTLIER_FACTOR = 5;
export const VOLUME_METHOD =
  '7-day volume counts XRPL DEX fills and AMM swaps against XRP, RLUSD, and USDV, from XRPL Meta\'s exchange index of public ledger history. The index row\'s size is the quote amount and its price is quote per token, so token size is quote ÷ price. Dollars are that quote amount times the quote\'s USD price: the current XRP/USD for an XRP leg, and a nominal $1 for RLUSD and USDV. Those stables are quote assets, not commodity tokens. Where a spot price per token exists, a fill more than 5× away from it is left out; if the left-out fills are larger than the fills kept, that week is not measured. The week-over-week change adds only tokens with a dollar figure for both weeks. A cut-off page is not measured, not zero. Zero fills is a measured zero, not a warning.';

const STABLE_CURRENCIES = new Set([
  RLUSD.currency,
  USDV.currency,
  'USD', 'USDC', 'USDT', 'RLUSD', 'USDV',
  // Common hex forms of USDC / USDT (40-char currency codes).
  '5553444300000000000000000000000000000000',
  '5553445400000000000000000000000000000000',
]);

/** Dollar stables are quote legs only. They are not part of the commodity total. */
export function isDollarStable(currency: string): boolean {
  return STABLE_CURRENCIES.has(currency.trim().toUpperCase());
}

export type QuoteKind = 'XRP' | 'USD';

export interface ExchangeTrade {
  txHash: string;
  ledgerSequence: number;
  /** XRP, or a dollar stable valued at a nominal $1. */
  quote: QuoteKind;
  /** Quote units that moved. Not the commodity-token amount. */
  quoteVolume: number;
  /** Quote units per one commodity token. 0 when the indexer did not price the fill. */
  quotePerBase: number;
}

export interface LedgerClock {
  ledgerIndex: number;
  /** Seconds of ledger time per ledger index, from the indexer's available range. */
  secPerLedger: number;
}

export interface TradeWindow {
  complete: boolean;
  trades: number;
  baseVolume: number;
  /** Null when the window is incomplete or a fill had no USD price. */
  usdVolume: number | null;
}

export type VolumeDirection = 'up' | 'down' | 'flat' | 'unknown';

export interface TokenActivity {
  measured: boolean;
  windowDays: number;
  source: typeof VOLUME_SOURCE;
  unit: string;
  /** True when every fill in the measured window had a positive USD price. */
  usdPriced: boolean;
  recent: TradeWindow;
  prior: TradeWindow;
  changePct: number | null;
  direction: VolumeDirection;
  note: string;
}

export interface VolumeWeek {
  /** ISO week YYYY-Www of the day the reading was saved. */
  week: string;
  asOf: string;
  usdTotal: number | null;
  complete: boolean;
}

export interface IndustryActivity {
  windowDays: number;
  asOf: string;
  source: typeof VOLUME_SOURCE;
  method: string;
  /** Null when no token's dollar volume was measured. Not zero when the pass failed. */
  usdTotal: number | null;
  priorUsdTotal: number | null;
  changePct: number | null;
  direction: VolumeDirection;
  /** Dollar total includes every measured, priced token, including measured zeros. */
  tokensPriced: number;
  /** Measured trades that could not be priced in USD. Left out of the dollar total. */
  tokensUnpriced: number;
  tokensUnknown: number;
  /** Priced tokens whose prior 7 days were fully on the exchange page. */
  changeCovered: number;
  /** Priced tokens left out of the week-over-week figure because the prior window was cut off. */
  changeExcluded: number;
  /** True only when every commodity token was measured and the prior window is complete. */
  complete: boolean;
  trend: VolumeWeek[];
  historyNote: string;
}

export function ledgerDaysBack(clock: LedgerClock, days: number): number {
  const step = clock.secPerLedger > 0 ? clock.secPerLedger : 4;
  return clock.ledgerIndex - Math.round((days * 86400) / step);
}

export function clockFromRange(range: { sequence: { start: number; end: number }; time: { start: number; end: number } }): LedgerClock | null {
  const ledgers = range.sequence.end - range.sequence.start;
  const seconds = range.time.end - range.time.start;
  if (!(ledgers > 0) || !(seconds > 0) || !(range.sequence.end > 0)) return null;
  return { ledgerIndex: range.sequence.end, secPerLedger: seconds / ledgers };
}

function emptyWindow(complete: boolean): TradeWindow {
  return { complete, trades: 0, baseVolume: 0, usdVolume: complete ? 0 : null };
}

export interface ActivityOptions {
  pageCap?: number;
  /** Current XRP/USD. XRP-quoted fills have no dollar size without it. */
  xrpUsd?: number | null;
  /** Spot USD per token. Used only to reject a print more than OUTLIER_FACTOR away. */
  referenceUsdPerToken?: number | null;
}

function quoteUsdRate(quote: QuoteKind, xrpUsd: number | null | undefined): number | null {
  if (quote === 'USD') return 1;
  return xrpUsd != null && xrpUsd > 0 ? xrpUsd : null;
}

/** True when the implied USD price per token is more than OUTLIER_FACTOR away from spot. */
export function isOutlierFill(trade: ExchangeTrade, xrpUsd: number | null | undefined, referenceUsdPerToken: number | null | undefined): boolean {
  if (!(referenceUsdPerToken != null && referenceUsdPerToken > 0) || !(trade.quotePerBase > 0)) return false;
  const rate = quoteUsdRate(trade.quote, xrpUsd);
  if (rate == null) return false;
  const implied = trade.quotePerBase * rate;
  return implied > referenceUsdPerToken * OUTLIER_FACTOR || implied < referenceUsdPerToken / OUTLIER_FACTOR;
}

interface WindowDraft { complete: boolean; trades: number; base: number; usd: number | null; priced: boolean }

function sumWindow(trades: ExchangeTrade[], xrpUsd: number | null | undefined, referenceUsdPerToken: number | null | undefined): WindowDraft {
  if (trades.length === 0) return { complete: true, trades: 0, base: 0, usd: 0, priced: true };
  let keptBase = 0;
  let keptUsd = 0;
  let kept = 0;
  let excludedUsd = 0;
  let unpriced = false;
  for (const t of trades) {
    if (!(t.quotePerBase > 0) || !(t.quoteVolume >= 0) || !Number.isFinite(t.quoteVolume)) {
      return { complete: false, trades: 0, base: 0, usd: null, priced: false };
    }
    const rate = quoteUsdRate(t.quote, xrpUsd);
    const usd = rate == null ? null : t.quoteVolume * rate;
    if (isOutlierFill(t, xrpUsd, referenceUsdPerToken)) {
      excludedUsd += usd ?? 0;
      continue;
    }
    if (usd == null) unpriced = true;
    else keptUsd += usd;
    keptBase += t.quoteVolume / t.quotePerBase;
    kept += 1;
  }
  // A rejected print larger than everything kept would still set the total. Leave the week unmeasured.
  if (excludedUsd > keptUsd && excludedUsd > 0) return { complete: false, trades: 0, base: 0, usd: null, priced: false };
  return { complete: true, trades: kept, base: keptBase, usd: unpriced ? null : keptUsd, priced: !unpriced };
}

export function compareWindows(current: number, prior: number | null, priorComplete: boolean): { changePct: number | null; direction: VolumeDirection } {
  if (!priorComplete || prior == null) return { changePct: null, direction: 'unknown' };
  if (prior === 0 && current === 0) return { changePct: 0, direction: 'flat' };
  if (prior === 0) return { changePct: null, direction: 'up' };
  const changePct = ((current - prior) / prior) * 100;
  if (Math.abs(changePct) < FLAT_PCT) return { changePct, direction: 'flat' };
  return { changePct, direction: changePct > 0 ? 'up' : 'down' };
}

/** Split one fetched page into the last 7 days and the 7 days before that. */
export function activityFromTrades(trades: ExchangeTrade[], unit: string, clock: LedgerClock, pageCapOrOpts: number | ActivityOptions = PAGE_CAP): TokenActivity {
  const opts: ActivityOptions = typeof pageCapOrOpts === 'number' ? { pageCap: pageCapOrOpts } : pageCapOrOpts;
  const pageCap = opts.pageCap ?? PAGE_CAP;
  const byHash = new Map<string, ExchangeTrade>();
  for (const t of trades) if (t.txHash && t.quoteVolume >= 0 && Number.isFinite(t.ledgerSequence)) byHash.set(t.txHash, t);
  const unique = [...byHash.values()];
  const recentStart = ledgerDaysBack(clock, WINDOW_DAYS);
  const priorStart = ledgerDaysBack(clock, WINDOW_DAYS * 2);
  const oldest = unique.reduce((m, t) => Math.min(m, t.ledgerSequence), Infinity);
  const capped = unique.length >= pageCap;
  const pageRecent = unique.length === 0 || !capped || oldest < recentStart;
  const pagePrior = unique.length === 0 || !capped || oldest < priorStart;
  const recentTrades = unique.filter(t => t.ledgerSequence >= recentStart);
  const priorTrades = unique.filter(t => t.ledgerSequence >= priorStart && t.ledgerSequence < recentStart);
  const recentSum = sumWindow(pageRecent ? recentTrades : [], opts.xrpUsd, opts.referenceUsdPerToken);
  const priorSum = sumWindow(pagePrior ? priorTrades : [], opts.xrpUsd, opts.referenceUsdPerToken);
  const recentComplete = pageRecent && recentSum.complete;
  const priorComplete = pagePrior && priorSum.complete;
  const measured = recentComplete;
  const usdPriced = measured && recentSum.priced && (!priorComplete || priorSum.priced);
  const recent: TradeWindow = recentComplete
    ? { complete: true, trades: recentSum.trades, baseVolume: recentSum.base, usdVolume: usdPriced ? recentSum.usd : null }
    : { complete: false, trades: 0, baseVolume: 0, usdVolume: null };
  const prior: TradeWindow = priorComplete
    ? { complete: true, trades: priorSum.trades, baseVolume: priorSum.base, usdVolume: usdPriced ? priorSum.usd : null }
    : { complete: false, trades: 0, baseVolume: 0, usdVolume: null };
  const basisCurrent = usdPriced ? (recent.usdVolume ?? 0) : recent.baseVolume;
  const basisPrior = !prior.complete ? null : usdPriced ? prior.usdVolume : prior.baseVolume;
  const cmp = measured ? compareWindows(basisCurrent, basisPrior, prior.complete) : { changePct: null, direction: 'unknown' as const };
  const pricedNote = opts.referenceUsdPerToken != null && opts.referenceUsdPerToken > 0
    ? ` A fill more than ${OUTLIER_FACTOR}× from spot is left out, and a week those fills dominate is not measured.`
    : '';
  return {
    measured, windowDays: WINDOW_DAYS, source: VOLUME_SOURCE, unit, usdPriced: measured && usdPriced,
    recent, prior, changePct: cmp.changePct, direction: cmp.direction,
    note: measured
      ? `Fills against XRP, RLUSD, and USDV. Token size is the quote amount divided by quote-per-token. Dollars use the current XRP/USD for XRP legs and a nominal $1 for RLUSD and USDV.${pricedNote} Not a reserve figure.`
      : 'This 7-day total is not measured. The exchange page was cut off, a fill had no price, or the priced fills were smaller than fills left out as far from spot. That is not a zero.',
  };
}

export function unknownActivity(unit: string, reason: string): TokenActivity {
  const blank: TradeWindow = { complete: false, trades: 0, baseVolume: 0, usdVolume: null };
  return {
    measured: false, windowDays: WINDOW_DAYS, source: VOLUME_SOURCE, unit, usdPriced: false,
    recent: blank, prior: { ...blank }, changePct: null, direction: 'unknown', note: reason,
  };
}

export function industryTotal(rows: { currency: string; activity: TokenActivity }[], trend: VolumeWeek[], asOf: string): IndustryActivity {
  const commodity = rows.filter(r => !isDollarStable(r.currency));
  const unknown = commodity.filter(r => !r.activity.measured);
  const priced = commodity.filter(r => r.activity.measured && r.activity.usdPriced && r.activity.recent.complete);
  const unpriced = commodity.filter(r => r.activity.measured && !r.activity.usdPriced && r.activity.recent.baseVolume > 0);
  const usdValues = priced.map(r => r.activity.recent.usdVolume).filter((n): n is number => n != null);
  const usdTotal = priced.length === 0 ? null : usdValues.reduce((s, n) => s + n, 0);
  // Change uses tokens with a dollar figure for both weeks. An unpriced book has
  // real size we could not value, so it blocks the change. A token that is not
  // measured is left out of both sides instead.
  const comparable = unpriced.length === 0
    ? priced.filter(r => r.activity.prior.complete && r.activity.prior.usdVolume != null)
    : [];
  const priorUsdTotal = comparable.length ? comparable.reduce((s, r) => s + (r.activity.prior.usdVolume ?? 0), 0) : null;
  const comparableRecent = comparable.reduce((s, r) => s + (r.activity.recent.usdVolume ?? 0), 0);
  const cmp = priorUsdTotal != null
    ? compareWindows(comparableRecent, priorUsdTotal, true)
    : { changePct: null, direction: 'unknown' as const };
  return {
    windowDays: WINDOW_DAYS, asOf, source: VOLUME_SOURCE, method: VOLUME_METHOD,
    usdTotal, priorUsdTotal, changePct: cmp.changePct, direction: cmp.direction,
    tokensPriced: priced.length, tokensUnpriced: unpriced.length, tokensUnknown: unknown.length,
    changeCovered: comparable.length, changeExcluded: priced.length - comparable.length,
    complete: unknown.length === 0 && unpriced.length === 0 && comparable.length === priced.length && priced.length > 0,
    trend, historyNote: 'Weekly snapshots saved before this volume reading do not include it. The public exchange list only returns the newest fills, so those older weeks were not reconstructed. The trend is the rolling 7-day dollar total saved with each new week.',
  };
}

const usd = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 0 : 2 });
const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: n >= 100 ? 2 : 4 });

/** Whole percents, except a move that rounds to 100% while volume is still above zero. */
export function pctLabel(n: number): string {
  const abs = Math.abs(n);
  if (Math.round(abs) === 100 && abs < 100) return abs.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (abs >= 10) return Math.round(abs).toLocaleString('en-US');
  return abs.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

export function activityPlain(a: TokenActivity | undefined): string {
  if (!a || !a.measured || !a.recent.complete) return '7-day volume not measured';
  const amount = a.usdPriced && a.recent.usdVolume != null ? usd(a.recent.usdVolume) : `${num(a.recent.baseVolume)} ${a.unit}`;
  let change = '';
  if (a.direction === 'unknown' || !a.prior.complete) change = ' · change vs the prior 7 days not measured';
  else if (a.changePct == null && a.direction === 'up') change = ' · up from no measured trades in the prior 7 days';
  else if (a.direction === 'flat') change = ' · about the same as the prior 7 days';
  else if (a.changePct != null && a.direction === 'up') change = ` · up ${pctLabel(a.changePct)}% vs the prior 7 days`;
  else if (a.changePct != null && a.direction === 'down') change = ` · down ${pctLabel(a.changePct)}% vs the prior 7 days`;
  return `7-day volume ${amount} · ${a.recent.trades.toLocaleString('en-US')} trades${change}`;
}

export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Remember a complete industry total under its ISO week. Incomplete passes are not stored as zero. */
export function rememberWeek(points: VolumeWeek[], point: VolumeWeek): VolumeWeek[] {
  if (!point.complete || point.usdTotal == null) return points.slice();
  const next = points.filter(p => p.week !== point.week);
  next.push(point);
  next.sort((a, b) => a.week < b.week ? -1 : 1);
  return next.slice(-12);
}

interface TokenRef { id: string; currency: string; issuer: string; displayCode: string; referenceUsdPerToken?: number | null }

const META = () => (process.env.XRPLMETA_URL || 'https://s1.xrplmeta.org').replace(/\/+$/, '');

async function getJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { accept: 'application/json', 'user-agent': 'ReserveWatch' } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function parseTrades(body: any, quote: QuoteKind): ExchangeTrade[] | null {
  if (!body || !Array.isArray(body.exchanges)) return null;
  const out: ExchangeTrade[] = [];
  for (const row of body.exchanges) {
    const quoteVolume = Number(row?.volume);
    const quotePerBase = Number(row?.price);
    const ledgerSequence = Number(row?.ledgerSequence);
    const txHash = String(row?.txHash ?? '');
    if (!txHash || !Number.isFinite(quoteVolume) || quoteVolume < 0 || !Number.isFinite(ledgerSequence)) continue;
    out.push({ txHash, ledgerSequence, quote, quoteVolume, quotePerBase: Number.isFinite(quotePerBase) && quotePerBase > 0 ? quotePerBase : 0 });
  }
  return out;
}

async function fetchQuote(base: string, quote: string, kind: QuoteKind): Promise<ExchangeTrade[] | null> {
  const url = `${META()}/v2/tokens/exchanges/${encodeURIComponent(base)}/${encodeURIComponent(quote)}?newest_first=true`;
  const body = await getJson(url);
  return parseTrades(body, kind);
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    for (;;) {
      const n = i++;
      if (n >= items.length) return;
      out[n] = await fn(items[n]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function loadActivities(tokens: TokenRef[], xrpUsd: number | null = null): Promise<{ byId: Record<string, TokenActivity>; clock: LedgerClock | null }> {
  const server = await getJson(`${META()}/v2/server`);
  const clock = server?.available_range ? clockFromRange(server.available_range) : null;
  const quotes: { id: string; kind: QuoteKind }[] = [
    { id: 'XRP', kind: 'XRP' },
    { id: `${RLUSD.currency}:${RLUSD.issuer}`, kind: 'USD' },
    { id: `${USDV.currency}:${USDV.issuer}`, kind: 'USD' },
  ];
  const byId: Record<string, TokenActivity> = {};
  await mapPool(tokens, 4, async (token) => {
    if (isDollarStable(token.currency)) {
      byId[token.id] = unknownActivity(token.displayCode, 'Dollar stables are quote assets and are not counted as commodity volume.');
      return;
    }
    if (!clock) {
      byId[token.id] = unknownActivity(token.displayCode, 'The ledger clock for the volume index was not available.');
      return;
    }
    const base = `${token.currency}:${token.issuer}`;
    const pages = await Promise.all(quotes.map(q => fetchQuote(base, q.id, q.kind)));
    if (pages.some(p => p == null)) {
      byId[token.id] = unknownActivity(token.displayCode, 'The exchange list could not be read, so 7-day volume is not measured.');
      return;
    }
    const trades = pages.flatMap(p => p ?? []);
    byId[token.id] = activityFromTrades(trades, token.displayCode, clock, { xrpUsd, referenceUsdPerToken: token.referenceUsdPerToken ?? null });
  });
  return { byId, clock };
}
