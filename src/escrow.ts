// XLS-85 trust-line locking (lsfAllowTrustLineLocking). A public account flag.
// RLUSD is included only as a reference settlement asset, not as a commodity token.

import { RLUSD, TOKENS } from './config/tokens.js';
import { PUBLIC_RECORD_DISCLAIMER } from './content/attestations.js';
import { SITE_URL } from './seo.js';

/** AccountRoot flag from the TokenEscrow amendment. */
export const LSF_ALLOW_TRUST_LINE_LOCKING = 0x40000000n;

export const RLUSD_ISSUER = RLUSD.issuer;
export const ESCROW_PAGE = `${SITE_URL}/#token-escrow`;

export function lockingFromAccount(flags: Record<string, boolean> | undefined, raw: unknown): boolean | null {
  if (flags && typeof flags.allowTrustLineLocking === 'boolean') return flags.allowTrustLineLocking;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  try {
    return (BigInt(Math.trunc(n)) & LSF_ALLOW_TRUST_LINE_LOCKING) !== 0n;
  } catch {
    return null;
  }
}

export type EscrowRole = 'commodity' | 'reference-settlement';

export interface EscrowRow {
  id: string;
  name: string;
  issuer: string;
  role: EscrowRole;
  allowTrustLineLocking: boolean | null;
  /** Why a boolean is missing. Empty when the flag was read. */
  readNote: string;
  note: string;
}

export interface EscrowPayload {
  disclaimer: string;
  canonicalUrl: string;
  rows: EscrowRow[];
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function lockingText(value: boolean | null): string {
  if (value === true) return 'Enabled';
  if (value === false) return 'Not enabled';
  return 'Not read this run';
}

export function commodityEscrowRows(flags: { id: string; name: string; issuer: string; allowTrustLineLocking: boolean | null }[]): EscrowRow[] {
  const byId = new Map(flags.map(row => [row.id, row]));
  return TOKENS.map(token => {
    const live = byId.get(token.id);
    const value = live ? live.allowTrustLineLocking : null;
    return {
      id: token.id,
      name: token.name,
      issuer: token.issuer,
      role: 'commodity' as const,
      allowTrustLineLocking: value,
      readNote: value == null ? 'Not read this run' : '',
      note: 'Tracked XRPL commodity token.',
    };
  });
}

export function rlusdEscrowRow(value: boolean | null, error?: string): EscrowRow {
  return {
    id: 'rlusd',
    name: 'RLUSD',
    issuer: RLUSD_ISSUER,
    role: 'reference-settlement',
    allowTrustLineLocking: value,
    readNote: value == null ? (error || 'RPC unavailable') : '',
    note: 'Reference settlement asset (not a commodity token).',
  };
}

export function escrowPayload(rows: EscrowRow[]): EscrowPayload {
  return { disclaimer: PUBLIC_RECORD_DISCLAIMER, canonicalUrl: ESCROW_PAGE, rows };
}

const rpcUrls = () => (process.env.XRPL_WS_URLS || 'wss://xrplcluster.com,wss://s1.ripple.com,wss://s2.ripple.com')
  .split(',').map(part => part.trim()).filter(Boolean)
  .map(url => url.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://'));

/** One account_info. Returns null when the endpoint does not answer. Does not retry for long. */
export async function readAllowTrustLineLocking(account: string, timeoutMs = 1500): Promise<{ value: boolean | null; error?: string }> {
  const body = JSON.stringify({ method: 'account_info', params: [{ account, ledger_index: 'validated' }] });
  let last = 'RPC unavailable';
  for (const url of rpcUrls().slice(0, 2)) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) { last = `HTTP ${res.status}`; continue; }
      const json = await res.json() as {
        result?: { account_flags?: Record<string, boolean>; account_data?: { Flags?: number } };
        error?: string;
      };
      if (!json.result) { last = json.error || 'no account_info result'; continue; }
      const value = lockingFromAccount(json.result.account_flags, json.result.account_data?.Flags);
      if (value == null) { last = 'allowTrustLineLocking was not in account_info'; continue; }
      return { value };
    } catch (err) {
      last = err instanceof Error ? err.message : 'RPC unavailable';
    }
  }
  return { value: null, error: last };
}

export function escrowTableHtml(rows: EscrowRow[]): string {
  const body = rows.map(row => {
    const flag = row.allowTrustLineLocking == null ? (row.readNote || 'Not read this run') : lockingText(row.allowTrustLineLocking);
    const name = row.role === 'reference-settlement' ? esc(row.name) : `<a href="/token/${esc(row.id)}">${esc(row.name)}</a>`;
    return `<tr><td>${name}</td><td><code>${esc(row.issuer)}</code></td><td>${esc(flag)}</td><td>${esc(row.note)}</td></tr>`;
  }).join('');
  return `<section id="token-escrow" aria-label="XRPL TokenEscrow"><h2>XRPL TokenEscrow (allowTrustLineLocking)</h2>
<p class="answer">Each row is the issuer account flag <code>allowTrustLineLocking</code> (XLS-85). Enabled means the account flag is set. Not enabled means the flag was read and is off. RLUSD is a reference settlement asset, not a commodity token.</p>
<div class="table-wrap"><table><tr><th>Token</th><th>Issuer account</th><th>Trust line locking (XLS-85)</th><th>Role</th></tr>${body}</table></div>
<p class="meter-cap">${esc(PUBLIC_RECORD_DISCLAIMER)}</p></section>`;
}
