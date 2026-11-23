// Append-only poll history and day-over-day change notes. A bad file never throws to the caller.
import fs from 'node:fs';
import path from 'node:path';
import { troyOz } from './ledgers/parse.js';

export type HistoryLedger = 'xrpl' | 'solana' | 'stellar';
export type PegGrade = 'ok' | 'warn' | 'critical' | 'na';

export interface HistoryReading {
  at: string;
  ledger: HistoryLedger;
  tokenId: string;
  supply: number | null;
  supplyOz: number | null;
  holders: number | null;
  trustlines: number | null;
  flags: Record<string, boolean>;
  pegPct: number | null;
  liquidityUsd: number | null;
  pegGrade: PegGrade;
  checks: { key: string; result: string }[];
}

export interface DailyPoint {
  day: string;
  at: string;
  supply: number | null;
  supplyOz: number | null;
  holders: number | null;
  trustlines: number | null;
  flags: Record<string, boolean>;
  pegPct: number | null;
  liquidityUsd: number | null;
  pegGrade: PegGrade;
}

export interface ChangeEvent {
  at: string;
  ledger: HistoryLedger;
  tokenId: string;
  kind: 'supply' | 'control' | 'peg' | 'appeared' | 'zero';
  text: string;
}

export interface AlertNotifier { notify(event: ChangeEvent): Promise<void> }

/** Future Kit (ConvertKit) mail. No credentials and no send. */
export const futureKitNotifier: AlertNotifier = { async notify() { /* not wired */ } };

let notifier: AlertNotifier = futureKitNotifier;
export function setAlertNotifier(next: AlertNotifier): void { notifier = next; }

const DAY_KEEP = 90;

function dirOf(dir?: string): string {
  return dir || process.env.DATA_DIR || path.resolve('data');
}
function historyDir(dir?: string): string { return path.join(dirOf(dir), 'history'); }
function dayFile(dir: string | undefined, day: string): string { return path.join(historyDir(dir), `${day}.ndjson`); }
function rollupFile(dir?: string): string { return path.join(historyDir(dir), 'daily.json'); }
function eventsFile(dir?: string): string { return path.join(dirOf(dir), 'events.json'); }

export function dayOf(at: string): string { return at.slice(0, 10); }

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function fmt(n: number): string { return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}

type Rollup = { tokens: Record<string, DailyPoint[]> };

function loadRollup(dir?: string): Rollup {
  const raw = readJson<Rollup>(rollupFile(dir), { tokens: {} });
  if (!raw || typeof raw !== 'object' || !raw.tokens || typeof raw.tokens !== 'object') return { tokens: {} };
  return raw;
}

function toPoint(row: HistoryReading): DailyPoint {
  return {
    day: dayOf(row.at), at: row.at, supply: row.supply, supplyOz: row.supplyOz, holders: row.holders, trustlines: row.trustlines,
    flags: row.flags, pegPct: row.pegPct, liquidityUsd: row.liquidityUsd, pegGrade: row.pegGrade,
  };
}

function pctOf(base: number, next: number): number { return ((next - base) / base) * 100; }
function moved(base: number | null, next: number | null, threshold: number): number | null {
  if (base == null || base <= 0 || next == null || next <= 0) return null;
  const pct = pctOf(base, next);
  return Math.abs(pct) >= threshold ? pct : null;
}

export function supplyThreshold(): number {
  const n = Number(process.env.HISTORY_SUPPLY_PCT ?? 5);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

const FLAG_LABEL: Record<string, string> = {
  freeze: 'Freeze',
  clawback: 'Clawback',
  pause: 'Pause',
  paused: 'Paused',
  mintAuthority: 'Mint authority',
  freezeable: 'Freeze ability',
  permanentDelegate: 'Permanent delegate',
};

export function detectChanges(current: HistoryReading, priorPoints: DailyPoint[], threshold = supplyThreshold()): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  const prior = priorPoints[priorPoints.length - 1];
  if (!prior) {
    events.push({ at: current.at, ledger: current.ledger, tokenId: current.tokenId, kind: 'appeared', text: 'Token first seen in this history.' });
    return events;
  }
  const today = dayOf(current.at);
  const yesterday = [...priorPoints].reverse().find(point => point.day < today);
  const where = current.supplyOz != null ? `${fmt(current.supplyOz)} oz` : current.supply != null ? `${fmt(current.supply)} tokens` : 'an unmeasured supply';
  if (current.supply === 0 && prior.supply != null && prior.supply > 0) {
    events.push({ at: current.at, ledger: current.ledger, tokenId: current.tokenId, kind: 'zero', text: 'Supply is zero.' });
  } else if (prior.supply === 0 && current.supply != null && current.supply > 0) {
    events.push({ at: current.at, ledger: current.ledger, tokenId: current.tokenId, kind: 'supply', text: `Supply is above zero at ${where}.` });
  } else if (yesterday) {
    const pct = moved(yesterday.supply, current.supply, threshold);
    const priorPct = prior.day === today ? moved(yesterday.supply, prior.supply, threshold) : null;
    const sameWay = priorPct != null && pct != null && Math.sign(priorPct) === Math.sign(pct);
    if (pct != null && !sameWay) {
      events.push({
        at: current.at, ledger: current.ledger, tokenId: current.tokenId, kind: 'supply',
        text: `Supply ${pct >= 0 ? 'rose' : 'fell'} ${fmt(Math.abs(pct))}% to ${where}.`,
      });
    }
  }
  const priorFlags = prior.flags && typeof prior.flags === 'object' ? prior.flags : {};
  for (const [key, value] of Object.entries(current.flags)) {
    if (!(key in priorFlags) || priorFlags[key] === value) continue;
    const label = FLAG_LABEL[key] ?? key;
    const text = key === 'paused'
      ? (value ? 'Transfers are paused. That is an issuer control, not an event.' : 'Transfers are not paused. That is an issuer control, not an event.')
      : (value ? `${label} is set. That is an issuer control, not an event.` : `${label} was removed. That is an issuer control, not an event.`);
    events.push({ at: current.at, ledger: current.ledger, tokenId: current.tokenId, kind: 'control', text });
  }
  if (prior.pegGrade === 'ok' && (current.pegGrade === 'warn' || current.pegGrade === 'critical')) {
    events.push({
      at: current.at, ledger: current.ledger, tokenId: current.tokenId, kind: 'peg',
      text: `Peg grade moved from ok to ${current.pegGrade}.`,
    });
  }
  return events;
}

function remember(dir: string | undefined, events: ChangeEvent[], notify: AlertNotifier): void {
  if (!events.length) return;
  const file = eventsFile(dir);
  const prev = readJson<{ events?: ChangeEvent[] }>(file, { events: [] });
  const list = Array.isArray(prev.events) ? prev.events : [];
  const next = [...list, ...events].slice(-500);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ events: next }));
  for (const event of events) {
    try { void Promise.resolve(notify.notify(event)).catch(() => undefined); } catch { /* a notifier must not break the poll */ }
  }
}

/** Append this poll and fold it into the daily series. Returns the new change notes. */
export function recordHistory(readings: HistoryReading[], opts: { dir?: string; threshold?: number; notify?: AlertNotifier } = {}): ChangeEvent[] {
  try {
    const dir = opts.dir;
    fs.mkdirSync(historyDir(dir), { recursive: true });
    const roll = loadRollup(dir);
    const events: ChangeEvent[] = [];
    const byDay = new Map<string, string[]>();
    for (const row of readings) {
      if (!row?.tokenId || !row.at) continue;
      const day = dayOf(row.at);
      const line = JSON.stringify(row);
      const bucket = byDay.get(day) ?? [];
      bucket.push(line);
      byDay.set(day, bucket);
      const prior = Array.isArray(roll.tokens[row.tokenId]) ? roll.tokens[row.tokenId] : [];
      events.push(...detectChanges(row, prior, opts.threshold));
      const point = toPoint(row);
      const series = prior.filter(item => item && typeof item.day === 'string');
      const last = series[series.length - 1];
      const next = !last || last.day !== point.day ? [...series, point] : [...series.slice(0, -1), point];
      roll.tokens[row.tokenId] = next.slice(-DAY_KEEP);
    }
    for (const [day, lines] of byDay) fs.appendFileSync(dayFile(dir, day), lines.join('\n') + '\n');
    fs.writeFileSync(rollupFile(dir), JSON.stringify(roll));
    remember(dir, events, opts.notify ?? notifier);
    return events;
  } catch (err) {
    console.warn(`[history] record skipped: ${(err as Error).message}`);
    return [];
  }
}

export function readEvents(dir?: string): ChangeEvent[] {
  try {
    const raw = readJson<{ events?: ChangeEvent[] }>(eventsFile(dir), { events: [] });
    return Array.isArray(raw.events) ? raw.events.filter(event => event && event.tokenId && event.text) : [];
  } catch { return []; }
}

export interface TokenHistory { tokenId: string; firstSeen: string | null; lastChange: string | null; days: DailyPoint[] }

function changed(a: DailyPoint, b: DailyPoint): boolean {
  return a.supply !== b.supply || a.holders !== b.holders || JSON.stringify(a.flags) !== JSON.stringify(b.flags) || a.pegGrade !== b.pegGrade;
}

export function tokenHistory(tokenId: string, dir?: string): TokenHistory {
  try {
    const series = loadRollup(dir).tokens[tokenId];
    const days = Array.isArray(series) ? series.filter(point => point && typeof point.day === 'string').slice(-DAY_KEEP) : [];
    let lastChange: string | null = null;
    for (let i = days.length - 1; i > 0; i--) {
      if (changed(days[i], days[i - 1])) { lastChange = days[i].day; break; }
    }
    return { tokenId, firstSeen: days[0]?.day ?? null, lastChange, days };
  } catch { return { tokenId, firstSeen: null, lastChange: null, days: [] }; }
}

export function historySection(tokenId: string, dir?: string): string {
  try {
    const history = tokenHistory(tokenId, dir);
    if (!history.days.length) return '<section class="history" aria-label="Reading history"><h2>History</h2><p class="muted">No daily history yet. A reading is kept after each poll.</p></section>';
    const values = history.days.map(point => point.supplyOz ?? point.supply ?? 0);
    const max = Math.max(...values, 1);
    const w = Math.max(history.days.length * 8, 40);
    const bars = history.days.map((point, i) => {
      const h = Math.max(2, Math.round(((point.supplyOz ?? point.supply ?? 0) / max) * 32));
      return `<rect x="${i * 8 + 1}" y="${34 - h}" width="5" height="${h}" rx="1"><title>${esc(point.day)}</title></rect>`;
    }).join('');
    const rows = history.days.map(point => `<tr><td>${esc(point.day)}</td><td>${point.supply == null ? 'not available' : esc(fmt(point.supply))}</td><td>${point.supplyOz == null ? '—' : esc(fmt(point.supplyOz))}</td><td>${point.holders == null ? 'not available' : esc(fmt(point.holders))}</td></tr>`).join('');
    return `<section class="history" aria-label="Reading history"><h2>History</h2>
<p class="muted">First seen ${esc(history.firstSeen)}. ${history.lastChange ? `Last change ${esc(history.lastChange)}.` : 'No day-to-day change in this series yet.'}</p>
<svg class="spark" role="img" aria-label="Daily supply" viewBox="0 0 ${w} 36" width="${w}" height="36">${bars}</svg>
<div class="table-wrap"><table><tr><th>Day</th><th>Supply</th><th>Troy oz</th><th>Holders</th></tr>${rows}</table></div>
<p class="muted">JSON: <a href="/api/history/${esc(tokenId)}">/api/history/${esc(tokenId)}</a>. Not a vault check.</p></section>`;
  } catch { return ''; }
}

function xml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
}

export function eventsRss(events: ChangeEvent[], siteUrl: string, ledger?: string): string {
  const items = events.slice(-50).reverse().map(event => {
    const link = `${siteUrl}/token/${event.tokenId}`;
    const guid = `${siteUrl}/alerts#${event.tokenId}-${event.at}-${event.kind}`;
    const when = Number.isNaN(Date.parse(event.at)) ? event.at : new Date(event.at).toUTCString();
    return `<item><title>${xml(event.text)}</title><link>${xml(link)}</link><guid isPermaLink="false">${xml(guid)}</guid><pubDate>${xml(when)}</pubDate><description>${xml(event.text)}</description></item>`;
  }).join('');
  const title = ledger ? `ReserveWatch alerts (${ledger})` : 'ReserveWatch alerts';
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(title)}</title><link>${xml(siteUrl)}/alerts</link><description>Supply, issuer-control, and peg-grade changes. Not investment advice.</description>${items}</channel></rss>`;
}

function pegFromGap(reliable: boolean, gap: number | null): PegGrade {
  if (!reliable || gap == null || !Number.isFinite(gap)) return 'na';
  const abs = Math.abs(gap);
  if (abs >= 10) return 'critical';
  if (abs >= 3) return 'warn';
  return 'ok';
}

/** One XRPL token from a poll, in the shape stored on disk. */
export function readingFromXrpl(t: {
  id: string; updatedAt: string; gramsPerToken: number;
  flags: Record<string, boolean | undefined>;
  supply: { circulating: number | null };
  holders: { nonZero: number; trustlines: number };
  peg: { deviationPct: number | null; reliable: boolean; liquidityUsd: number | null };
  checks: { key: string; severity: string }[];
}): HistoryReading {
  const supply = t.supply.circulating;
  return {
    at: t.updatedAt, ledger: 'xrpl', tokenId: t.id,
    supply, supplyOz: supply != null && t.gramsPerToken > 0 ? troyOz(supply, t.gramsPerToken) : null,
    holders: t.holders.nonZero, trustlines: t.holders.trustlines,
    flags: {
      freeze: !!t.flags.globalFreeze,
      freezeable: t.flags.noFreeze === false,
      clawback: !!t.flags.allowTrustLineClawback,
    },
    pegPct: t.peg.reliable ? t.peg.deviationPct : null,
    liquidityUsd: t.peg.liquidityUsd,
    pegGrade: pegFromGap(t.peg.reliable, t.peg.deviationPct),
    checks: t.checks.map(c => ({ key: c.key, result: c.severity })),
  };
}

/** One Solana or Stellar token from a poll. */
export function readingFromChain(row: {
  id: string; ledger: 'solana' | 'stellar'; updatedAt: string; gramsPerToken: number;
  supply: number | null; holders: number | null;
  mintAuthority: string | null; freezeAuthority: string | null;
  revocable: boolean | null; clawback: boolean | null;
  controls: { permanentDelegate: boolean; pausable: boolean; paused: boolean } | null;
  pricePerOz: number | null; spotUsd: number | null; liquidityUsd: number | null;
  checks: { key: string; result: string }[];
}): HistoryReading {
  const peg = row.checks.find(c => c.key === 'peg')?.result;
  const pegGrade: PegGrade = peg === 'ok' || peg === 'warn' || peg === 'critical' || peg === 'na' ? peg : 'na';
  const graded = pegGrade !== 'na' && row.pricePerOz != null && row.spotUsd != null && row.spotUsd !== 0;
  const flags: Record<string, boolean> = {};
  if (row.ledger === 'solana') {
    flags.mintAuthority = row.mintAuthority != null;
    flags.freeze = row.freezeAuthority != null;
    flags.permanentDelegate = !!row.controls?.permanentDelegate;
    flags.pause = !!row.controls?.pausable;
    flags.paused = !!row.controls?.paused;
  } else {
    if (row.revocable != null) flags.freeze = row.revocable;
    if (row.clawback != null) flags.clawback = row.clawback;
  }
  return {
    at: row.updatedAt, ledger: row.ledger, tokenId: row.id,
    supply: row.supply, supplyOz: row.supply != null && row.gramsPerToken > 0 ? troyOz(row.supply, row.gramsPerToken) : null,
    holders: row.holders, trustlines: null, flags,
    pegPct: graded ? ((row.pricePerOz! - row.spotUsd!) / row.spotUsd!) * 100 : null,
    liquidityUsd: row.liquidityUsd, pegGrade,
    checks: row.checks.map(c => ({ key: c.key, result: c.result })),
  };
}
