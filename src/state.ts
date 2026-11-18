// Quotable counts for the State page and answer blocks. Facts from the current snapshot only.
import type { IndustryActivity } from './volume.js';

export interface StateToken {
  id: string;
  name: string;
  issuer: string;
  status: 'ok' | 'warn' | 'critical' | string;
  depthUsd: number | null;
  volumeUsd: number | null;
  volumeMeasured: boolean;
}

export interface StateSummary {
  asOf: string;
  tokens: number;
  issuers: number;
  ok: number;
  warn: number;
  critical: number;
  /** Sum of AMM depth for tokens whose depth was read. */
  depthUsd: number | null;
  depthGaps: number;
  volumeUsd: number | null;
  volumeGaps: number;
}

export function summarizeState(rows: StateToken[], asOf: string, market?: IndustryActivity | null): StateSummary {
  const issuers = new Set(rows.map(r => r.issuer)).size;
  const depthKnown = rows.filter(r => r.depthUsd != null);
  const depthGaps = rows.length - depthKnown.length;
  const volumeGaps = market
    ? market.tokensUnknown + market.tokensUnpriced
    : rows.filter(r => !r.volumeMeasured).length;
  const volumeUsd = market?.usdTotal ?? (volumeGaps === 0 ? rows.reduce((s, r) => s + (r.volumeUsd ?? 0), 0) : null);
  return {
    asOf, tokens: rows.length, issuers,
    ok: rows.filter(r => r.status === 'ok').length,
    warn: rows.filter(r => r.status === 'warn').length,
    critical: rows.filter(r => r.status === 'critical').length,
    depthUsd: depthGaps === rows.length ? null : depthKnown.reduce((s, r) => s + (r.depthUsd ?? 0), 0),
    depthGaps,
    volumeUsd: volumeGaps > 0 && market?.usdTotal == null ? null : volumeUsd,
    volumeGaps,
  };
}

export function stateAnswer(s: StateSummary): string {
  const when = s.asOf ? s.asOf.slice(0, 10) : 'the latest reading';
  const volume = s.volumeUsd == null ? '7-day on-ledger volume was not measured' : `7-day on-ledger volume was about $${Math.round(s.volumeUsd).toLocaleString('en-US')}`;
  const depth = s.depthUsd == null ? 'AMM depth was not measured' : `AMM depth across tracked pools was about $${Math.round(s.depthUsd).toLocaleString('en-US')}`;
  return `As of ${when}, ReserveWatch tracked ${s.tokens} commodity tokens from ${s.issuers} issuers on the XRP Ledger. ${volume}. ${depth}. The legacy counts were ${s.critical} critical, ${s.warn} warn, and ${s.ok} ok. Those labels are the worst raw check, not a buy or sell rating and not proof of reserves.`;
}
