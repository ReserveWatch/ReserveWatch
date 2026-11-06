import { dropsToXrp } from 'xrpl';
import { req, isTransient } from './xrplClient.js';
import { getSpot, type SpotQuote } from './spot.js';
import { TOKENS, RLUSD, USDV, QUOTE_ASSETS, type QuoteAsset, GRAMS_PER_TROY_OZ, commodityMeta, type TokenDef, type Commodity } from './config/tokens.js';

export type Severity = 'ok' | 'warn' | 'critical';
export interface Check { key: string; severity: Severity; message: string }

export interface PoolInfo {
  pair: string; exists: boolean; error?: string;
  tokenAmount?: number; counterAmount?: number; counterAsset?: string;
  tradingFeePct?: number; tvlUsd?: number | null;
  impliedUsdPerToken?: number | null;
  account?: string;
}
export interface BookInfo { pair: string; bestBidUsd: number | null; bestAskUsd: number | null; bidCount: number; askCount: number; fundedBids: number; fundedAsks: number; spreadPct: number | null }

export interface TokenReport {
  id: string; name: string; project: string; issuer: string; currency: string; displayCode: string;
  /** Commodity class code (XAU, XAG, XPT, XPD, OIL, DIAMOND, ENERGY, …). Field name kept for API stability. */
  metal: Commodity; gramsPerToken: number; website?: string; notes: string[]; label?: string;
  /** Slug of the /commodities/:slug hub and plain unit description. */
  commodityClass: string; unitText?: string; tokenization?: 'distributed' | 'represented'; knownStatus?: TokenDef['knownStatus'];
  ledgerIndex?: number;
  issuerExists: boolean;
  domain?: string;
  /** Two-way check: issuer listed in https://{domain}/.well-known/xrp-ledger.toml. null = no domain set / not checked. */
  domainVerified: boolean | null;
  domainNote?: string;
  flags: Record<string, boolean>;
  transferFeePct: number;
  supply: { rawObligations: number | null; treasury: number; circulating: number | null };
  holders: { trustlines: number; nonZero: number; frozenLines: number; frozenBalance: number; deepFrozenLines: number; topHolders: { account: string; balance: number; pct: number; label?: string }[] };
  pools: PoolInfo[];
  books: BookInfo[];
  spot: SpotQuote & { usdPerToken: number | null };
  /** reliable=false when the reference price comes from a pool/book too thin to arbitrage — deviation is shown but must not be read as a peg break. */
  peg: { referenceUsd: number | null; source: string | null; deviationPct: number | null; liquidityUsd: number | null; reliable: boolean; note?: string };
  /** AMM liquidity aggregated across every quote-asset pool (XRP, RLUSD, USDV); quoteAssets = which pools contributed. */
  liquidity: { totalUsd: number; quoteAssets: string[]; pools: number };
  checks: Check[];
  status: Severity;
  updatedAt: string;
  errors: string[];
}

export interface Snapshot { updatedAt: string; xrpUsd: number | null; xrpUsdSource: string; tokens: TokenReport[]; durationMs: number }

export const LOW_LIQ_USD = Number(process.env.LOW_LIQUIDITY_USD || 10000);
export const PEG_WARN_PCT = Number(process.env.PEG_WARN_PCT || 3);
export const PEG_CRIT_PCT = Number(process.env.PEG_CRIT_PCT || 10);
export const CONC_WARN_PCT = Number(process.env.CONCENTRATION_WARN_PCT || 50);
/** DEX mid is only used as a price if bid/ask spread is at most this wide. */
export const MAX_SPREAD_PCT = Number(process.env.MAX_DEX_SPREAD_PCT || 20);
const TOML_CACHE = new Map<string, { at: number; text: string | null; err?: string }>();

/** Fetch https://{domain}/.well-known/xrp-ledger.toml (cached 6h) and check the issuer is listed. */
async function verifyDomain(domain: string | undefined, issuer: string): Promise<{ verified: boolean | null; note: string }> {
  if (!domain) return { verified: null, note: 'Issuer sets no on-ledger Domain.' };
  const host = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim().toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host)) return { verified: false, note: `Domain "${domain}" is not a valid hostname.` };
  let c = TOML_CACHE.get(host);
  if (!c || Date.now() - c.at > 6 * 3600_000) {
    try {
      const r = await fetch(`https://${host}/.well-known/xrp-ledger.toml`, { signal: AbortSignal.timeout(10000), redirect: 'follow' });
      const text = r.ok ? await r.text() : null;
      // Some sites return their HTML app shell for unknown paths; that is not a TOML file.
      c = { at: Date.now(), text: text && !/^\s*</.test(text) ? text : null, err: r.ok ? undefined : `HTTP ${r.status}` };
    } catch (e) { c = { at: Date.now(), text: null, err: (e as Error).message }; }
    TOML_CACHE.set(host, c);
  }
  if (!c.text) return { verified: false, note: `No xrp-ledger.toml at ${host}${c.err ? ` (${c.err})` : ''} — on-ledger Domain claim unverified.` };
  return c.text.includes(issuer)
    ? { verified: true, note: `Issuer listed in ${host}/.well-known/xrp-ledger.toml.` }
    : { verified: false, note: `${host}/.well-known/xrp-ledger.toml does not list this issuer — on-ledger Domain claim unverified.` };
}

const num = (v: any) => (typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN);
const hexToAscii = (h?: string) => { try { return h ? Buffer.from(h, 'hex').toString('utf8') : undefined; } catch { return undefined; } };
const amountValue = (a: any): { value: number; asset: string } =>
  typeof a === 'string' ? { value: Number(dropsToXrp(a)), asset: 'XRP' }
    : { value: num(a.value), asset: a.currency === RLUSD.currency && a.issuer === RLUSD.issuer ? 'RLUSD' : a.currency === USDV.currency && a.issuer === USDV.issuer ? 'USDV' : a.currency };
const quoteIssue = (q: QuoteAsset) => (q === 'XRP' ? { currency: 'XRP' } : q === 'RLUSD' ? RLUSD : USDV);
/** USD per unit of quote asset. RLUSD and USDV are valued at a nominal $1 (issuer-stated peg, not verified here). */
const quoteUsd = (q: QuoteAsset, xrpUsd: number | null) => (q === 'XRP' ? xrpUsd : 1);

/** XRP/USD from the on-ledger XRP/RLUSD AMM (fully on-ledger, no external API). */
export async function getXrpUsd(): Promise<{ price: number | null; source: string }> {
  const r = await req<any>({ command: 'amm_info', asset: { currency: 'XRP' }, asset2: RLUSD, ledger_index: 'validated' });
  if (!r.result) return { price: null, source: `XRP/RLUSD AMM error: ${r.error}` };
  const x = amountValue(r.result.amm.amount).value, u = amountValue(r.result.amm.amount2).value;
  return { price: u / x, source: `XRP/RLUSD AMM ${r.result.amm.account}` };
}

// Per-snapshot cache: issuers with many tokens (e.g. one account issuing several collections) are paged once per run.
let LINES_CACHE = new Map<string, Promise<{ lines: any[]; truncated: boolean }>>();
let GB_CACHE = new Map<string, Promise<{ result?: any; error?: string }>>();

async function fetchIssuerLines(account: string) {
  const out: any[] = []; let marker: unknown; let pages = 0;
  do {
    const r = await req<any>({ command: 'account_lines', account, ledger_index: 'validated', limit: 400, marker });
    if (!r.result) throw new Error(`account_lines: ${r.error}`);
    out.push(...r.result.lines);
    marker = r.result.marker; pages++;
  } while (marker && pages < 100);
  return { lines: out, truncated: !!marker };
}

async function fetchAllLines(account: string, currency: string) {
  if (!LINES_CACHE.has(account)) LINES_CACHE.set(account, fetchIssuerLines(account));
  const all = await LINES_CACHE.get(account)!.catch(e => { LINES_CACHE.delete(account); throw e; });
  return { lines: all.lines.filter((l: any) => l.currency === currency), truncated: all.truncated };
}

async function pool(t: TokenDef, counter: QuoteAsset, xrpUsd: number | null): Promise<PoolInfo> {
  const asset2 = quoteIssue(counter);
  const pair = `${t.displayCode}/${counter}`;
  const r = await req<any>({ command: 'amm_info', asset: { currency: t.currency, issuer: t.issuer }, asset2, ledger_index: 'validated' });
  if (!r.result) return { pair, exists: false, error: r.error };
  const a = r.result.amm;
  const v1 = amountValue(a.amount), v2 = amountValue(a.amount2);
  const tok = v1.asset === counter ? v2 : v1;
  const ctr = tok === v1 ? v2 : v1;
  const ctrUsd = quoteUsd(counter, xrpUsd);
  const ctrValUsd = ctrUsd == null ? null : ctr.value * ctrUsd;
  return {
    pair, exists: true, account: a.account,
    tokenAmount: tok.value, counterAmount: ctr.value, counterAsset: counter,
    tradingFeePct: a.trading_fee / 1000,
    tvlUsd: ctrValUsd == null ? null : ctrValUsd * 2,
    impliedUsdPerToken: ctrValUsd == null || !tok.value ? null : ctrValUsd / tok.value,
  };
}

async function book(t: TokenDef, counter: QuoteAsset, xrpUsd: number | null): Promise<BookInfo> {
  const tok = { currency: t.currency, issuer: t.issuer };
  const ctr = quoteIssue(counter);
  const ctrUsd = quoteUsd(counter, xrpUsd);
  // asks: offers selling token for counter (taker_gets=token, taker_pays=counter)
  const asks = await req<any>({ command: 'book_offers', taker_gets: tok, taker_pays: ctr, limit: 10, ledger_index: 'validated' });
  const bids = await req<any>({ command: 'book_offers', taker_gets: ctr, taker_pays: tok, limit: 10, ledger_index: 'validated' });
  const px = (o: any, side: 'ask' | 'bid') => {
    const g = amountValue(o.taker_gets_funded ?? o.TakerGets).value, p = amountValue(o.taker_pays_funded ?? o.TakerPays).value;
    if (!g || !p || ctrUsd == null) return null;
    return side === 'ask' ? (p / g) * ctrUsd : (g / p) * ctrUsd;
  };
  const askOffers: any[] = asks.result?.offers ?? [], bidOffers: any[] = bids.result?.offers ?? [];
  // Skip unfunded offers (e.g. owner frozen or empty) — they cannot fill.
  const askPx = askOffers.map(o => px(o, 'ask')).filter((v): v is number => v != null && Number.isFinite(v));
  const bidPx = bidOffers.map(o => px(o, 'bid')).filter((v): v is number => v != null && Number.isFinite(v));
  const bestAskUsd = askPx[0] ?? null, bestBidUsd = bidPx[0] ?? null;
  const spreadPct = bestAskUsd != null && bestBidUsd != null && bestAskUsd > 0 ? ((bestAskUsd - bestBidUsd) / ((bestAskUsd + bestBidUsd) / 2)) * 100 : null;
  return {
    pair: `${t.displayCode}/${counter}`,
    bestAskUsd, bestBidUsd, spreadPct,
    askCount: askOffers.length, bidCount: bidOffers.length, fundedAsks: askPx.length, fundedBids: bidPx.length,
  };
}

export async function checkToken(t: TokenDef, xrpUsd: number | null, spotCache: Map<Commodity, SpotQuote>): Promise<TokenReport> {
  const errors: string[] = []; const checks: Check[] = [];
  const add = (key: string, severity: Severity, message: string) => checks.push({ key, severity, message });

  const info = await req<any>({ command: 'account_info', account: t.issuer, ledger_index: 'validated' });
  const issuerExists = !!info.result;
  const ad = info.result?.account_data ?? {};
  const flags: Record<string, boolean> = info.result?.account_flags ?? {};
  const transferFeePct = ad.TransferRate ? (ad.TransferRate / 1e9 - 1) * 100 : 0;
  if (!issuerExists) {
    errors.push(`account_info: ${info.error}`);
    if (isTransient(info.error)) add('issuer', 'warn', `Ledger query failed (${info.error}); issuer could not be read this run.`);
    else add('issuer', 'critical', `Issuer account not found (${info.error})`);
  }

  // Supply
  let rawObligations: number | null = null, treasury = 0;
  let gb: { result?: any; error?: string };
  if (t.treasuryWallets.length) gb = await req<any>({ command: 'gateway_balances', account: t.issuer, hotwallet: t.treasuryWallets, ledger_index: 'validated', strict: true });
  else {
    if (!GB_CACHE.has(t.issuer)) GB_CACHE.set(t.issuer, req<any>({ command: 'gateway_balances', account: t.issuer, ledger_index: 'validated', strict: true }));
    gb = await GB_CACHE.get(t.issuer)!;
  }
  if (gb.result) {
    rawObligations = num(gb.result.obligations?.[t.currency] ?? 0);
    for (const bal of Object.values<any>(gb.result.balances ?? {})) for (const b of bal) if (b.currency === t.currency) treasury += num(b.value);
    // When hotwallet is given, `obligations` already excludes those balances.
    if (t.treasuryWallets.length) rawObligations += treasury;
  } else errors.push(`gateway_balances: ${gb.error}`);
  const circulating = rawObligations == null ? null : rawObligations - treasury;

  // Holders / freezes
  const holders = { trustlines: 0, nonZero: 0, frozenLines: 0, frozenBalance: 0, deepFrozenLines: 0, topHolders: [] as TokenReport['holders']['topHolders'] };
  try {
    const { lines, truncated } = await fetchAllLines(t.issuer, t.currency);
    if (truncated) errors.push('account_lines truncated at 100 pages');
    holders.trustlines = lines.length;
    const held = lines.map(l => ({ account: l.account as string, balance: -num(l.balance), freeze: !!l.freeze, deep: !!l.deep_freeze }))
      .filter(h => !t.treasuryWallets.includes(h.account));
    const pos = held.filter(h => h.balance > 0);
    holders.nonZero = pos.length;
    holders.frozenLines = held.filter(h => h.freeze).length;
    holders.deepFrozenLines = held.filter(h => h.deep).length;
    holders.frozenBalance = held.filter(h => h.freeze).reduce((s, h) => s + Math.max(h.balance, 0), 0);
    const circ = pos.reduce((s, h) => s + h.balance, 0) || 1;
    holders.topHolders = pos.sort((a, b) => b.balance - a.balance).slice(0, 5).map(h => ({ account: h.account, balance: h.balance, pct: (h.balance / circ) * 100 }));
    for (const h of holders.topHolders) {
      const ai = await req<any>({ command: 'account_info', account: h.account, ledger_index: 'validated' });
      if (ai.result?.account_data?.AMMID) h.label = 'AMM pool';
    }
  } catch (e) { errors.push((e as Error).message); }

  // Liquidity
  // Liquidity: AMM pools + DEX books against every quote asset (XRP, RLUSD, USDV), aggregated below.
  const pools: PoolInfo[] = [], books: BookInfo[] = [];
  for (const q of QUOTE_ASSETS) { pools.push(await pool(t, q, xrpUsd)); books.push(await book(t, q, xrpUsd)); }

  // Spot & peg
  if (!spotCache.has(t.metal)) spotCache.set(t.metal, await getSpot(t.metal));
  const sq = spotCache.get(t.metal)!;
  const cm = commodityMeta(t.metal);
  // Only metals priced per troy oz can be converted via grams; other classes have no per-token spot value.
  const usdPerToken = sq.usdPerOz == null || !(t.gramsPerToken > 0) || cm.unitLabel !== 'troy oz' ? null : sq.usdPerOz * (t.gramsPerToken / GRAMS_PER_TROY_OZ);
  const livePools = pools.filter(p => p.exists && p.impliedUsdPerToken != null && (p.tvlUsd ?? 0) > 0)
    .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
  let referenceUsd: number | null = null, refSource: string | null = null, liquidityUsd: number | null = null, pegNote: string | undefined;
  if (livePools.length) {
    // TVL-weighted implied price across all live pools; deeper pools dominate, thin pools barely move it.
    const w = livePools.reduce((s, p) => s + p.tvlUsd!, 0);
    referenceUsd = livePools.reduce((s, p) => s + p.impliedUsdPerToken! * p.tvlUsd!, 0) / w;
    refSource = `AMM ${livePools.map(p => p.pair).join(' + ')}${livePools.length > 1 ? ' (TVL-weighted)' : ''}`;
    liquidityUsd = w;
  }
  else {
    const two = books.filter(b => b.bestBidUsd != null && b.bestAskUsd != null);
    const b = two.find(b => (b.spreadPct ?? Infinity) <= MAX_SPREAD_PCT);
    if (b) { referenceUsd = (b.bestBidUsd! + b.bestAskUsd!) / 2; refSource = `DEX mid ${b.pair}`; }
    else if (two.length) pegNote = `DEX book ${two[0].pair} too wide to price (bid ${two[0].bestBidUsd!.toFixed(2)} / ask ${two[0].bestAskUsd!.toFixed(2)} USD, spread ${two[0].spreadPct!.toFixed(0)}%).`;
  }
  const deviationPct = referenceUsd != null && usdPerToken ? ((referenceUsd - usdPerToken) / usdPerToken) * 100 : null;
  // AMM: reliable only with TVL >= threshold. DEX mid: never treated as reliable (no depth measured).
  const pegReliable = referenceUsd != null && refSource?.startsWith('AMM') === true && (liquidityUsd ?? 0) >= LOW_LIQ_USD;
  if (referenceUsd != null && !pegReliable) pegNote = refSource?.startsWith('AMM')
    ? `Pool TVL ~$${(liquidityUsd ?? 0).toFixed(0)} is below $${LOW_LIQ_USD}; implied price is not a meaningful peg reading.`
    : 'Thin DEX book with no AMM; mid price is not a meaningful peg reading.';
  const domainChk = issuerExists ? await verifyDomain(hexToAscii(ad.Domain), t.issuer) : { verified: null, note: '' };
  const totalLiq = pools.reduce((s, p) => s + (p.tvlUsd ?? 0), 0);
  const liqQuotes = pools.filter(p => p.exists && (p.tvlUsd ?? 0) > 0).sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0)).map(p => p.counterAsset!);
  const liqLabel = liqQuotes.length ? ` across ${liqQuotes.map(q => `${t.displayCode}/${q}`).join(', ')}${(() => { const st = liqQuotes.filter(q => q !== 'XRP'); return st.length ? ` (${st.join(' and ')} valued at $1 nominal)` : ''; })()}` : '';

  // ---- Health rules ----
  if (t.knownStatus === 'discontinued') add('status', 'critical', 'Issuer has publicly discontinued this token (not redeemable).');
  if (t.knownStatus === 'unconfirmed') add('status', 'warn', `Issuer link unconfirmed: third-party registries attribute this account to ${t.project.replace(/ — .*$/, '')}, but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation.`);
  if (t.tokenization === 'represented') add('tokenization', 'ok', 'Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected.');
  if (t.knownStatus === 'unverified') add('status', 'critical', 'Unverified listing: this issuer does not appear on the published token list of the project its Domain field references, so its identity and backing could not be confirmed. Shown for transparency; not an endorsement or an allegation.');
  if (domainChk.verified === true) add('domain', 'ok', domainChk.note);
  else if (domainChk.verified === false) add('domain', 'warn', domainChk.note);
  if (flags.globalFreeze) add('globalFreeze', 'critical', 'Issuer has Global Freeze enabled — token cannot move.');
  if (holders.frozenLines > 0) {
    const share = circulating ? (holders.frozenBalance / circulating) * 100 : 0;
    add('frozenLines', share > 50 ? 'critical' : 'warn', `${holders.frozenLines} trust line(s) individually frozen (${share.toFixed(1)}% of circulating)${holders.deepFrozenLines ? `, ${holders.deepFrozenLines} deep-frozen` : ''}.`);
  }
  if (flags.allowTrustLineClawback) add('clawback', 'warn', 'Issuer can claw back tokens from holders (allowTrustLineClawback).');
  if (!flags.noFreeze && !flags.globalFreeze) add('freezeable', 'ok', 'Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers.');
  if (flags.requireAuthorization) add('requireAuth', 'ok', 'RequireAuth: holders must be authorized by issuer.');
  if (flags.disableMasterKey) add('masterKey', 'ok', 'Issuer master key disabled (multisig/regular key in use).');
  if (transferFeePct > 1) add('transferFee', 'warn', `High transfer fee ${transferFeePct.toFixed(3)}%.`);
  else if (transferFeePct > 0) add('transferFee', 'ok', `Transfer fee ${transferFeePct.toFixed(3)}%.`);
  if (circulating != null && circulating <= 0) add('supply', 'warn', 'No circulating supply outside issuer/treasury wallets.');
  if (!pools.some(p => p.exists)) add('liquidity', 'warn', `No AMM pool vs ${QUOTE_ASSETS.slice(0, -1).join(', ')} or ${QUOTE_ASSETS.at(-1)}.`);
  else if (totalLiq < LOW_LIQ_USD) add('liquidity', 'warn', `AMM liquidity only ~$${totalLiq.toFixed(0)} (< $${LOW_LIQ_USD})${liqLabel}.`);
  else add('liquidity', 'ok', `AMM liquidity ~$${totalLiq.toFixed(0)}${liqLabel}.`);
  if (sq.unsupported) { /* reported once, in the peg check below */ }
  else if (usdPerToken == null) add('spot', 'warn', `Spot price unavailable (${sq.error}).`);
  if (deviationPct != null && pegReliable) {
    const abs = Math.abs(deviationPct);
    if (abs >= PEG_CRIT_PCT) add('peg', 'critical', `Price ${deviationPct.toFixed(1)}% vs spot via ${refSource} (TVL ~$${(liquidityUsd ?? 0).toFixed(0)}).`);
    else if (abs >= PEG_WARN_PCT) add('peg', 'warn', `Price ${deviationPct.toFixed(1)}% vs spot via ${refSource}.`);
    else add('peg', 'ok', `Price within ${abs.toFixed(2)}% of spot via ${refSource}.`);
  } else if (deviationPct != null) {
    // Thin liquidity: do not headline the raw % — it reflects an un-arbitraged pool, not a peg break.
    add('peg', 'warn', `Peg not measurable: ${pegNote} (raw ${refSource} reading ${deviationPct.toFixed(1)}% vs spot.)`);
  } else if (sq.unsupported) add('peg', 'warn', `Price vs spot not measured: ReserveWatch has no public spot reference for ${cm.name}${referenceUsd != null ? ` (on-ledger reference ${referenceUsd.toFixed(4)} USD via ${refSource})` : ''}.`);
  else add('peg', 'warn', pegNote ? `Peg not measurable: ${pegNote}` : 'No on-ledger price (no AMM pool and no two-sided DEX book) — peg cannot be verified.');
  const topReal = holders.topHolders.find(h => h.label !== 'AMM pool');
  if (topReal && topReal.pct >= CONC_WARN_PCT) add('concentration', 'warn', `Top holder ${topReal.account} holds ${topReal.pct.toFixed(1)}% of non-treasury supply${holders.nonZero <= 1 ? ' (only holder)' : ''}.`);

  // Legacy overall: the worst raw check. The public comparison menu does not use
  // this aggregate — see presentation.ts. Do not retune these severities to recolor
  // the site; alerts, /api/tokens status, and historical snapshots depend on them.
  const rank: Record<Severity, number> = { ok: 0, warn: 1, critical: 2 };
  const status = checks.reduce<Severity>((m, c) => (rank[c.severity] > rank[m] ? c.severity : m), 'ok');

  return {
    id: t.id, name: t.name, project: t.project, issuer: t.issuer, currency: t.currency, displayCode: t.displayCode,
    metal: t.metal, gramsPerToken: t.gramsPerToken, website: t.website, notes: t.notes, label: t.label,
    commodityClass: cm.slug, unitText: t.unitText, tokenization: t.tokenization, knownStatus: t.knownStatus,
    ledgerIndex: info.result?.ledger_index, issuerExists, domain: hexToAscii(ad.Domain), domainVerified: domainChk.verified, domainNote: domainChk.note || undefined, flags, transferFeePct,
    supply: { rawObligations, treasury, circulating }, holders, pools, books,
    spot: { ...sq, usdPerToken },
    peg: { referenceUsd, source: refSource, deviationPct, liquidityUsd, reliable: pegReliable, note: pegNote },
    liquidity: { totalUsd: totalLiq, quoteAssets: liqQuotes, pools: liqQuotes.length },
    checks, status, updatedAt: new Date().toISOString(), errors,
  };
}

export async function runSnapshot(): Promise<Snapshot> {
  const t0 = Date.now();
  const xrp = await getXrpUsd();
  const spotCache = new Map<Commodity, SpotQuote>();
  LINES_CACHE = new Map(); GB_CACHE = new Map();
  const tokens: TokenReport[] = [];
  for (const t of TOKENS) {
    try { tokens.push(await checkToken(t, xrp.price, spotCache)); }
    catch (e) { console.error(`[monitor] ${t.id} failed`, e); }
  }
  return { updatedAt: new Date().toISOString(), xrpUsd: xrp.price, xrpUsdSource: xrp.source, tokens, durationMs: Date.now() - t0 };
}
