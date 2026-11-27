// Factual evidence row: issuer attestation, live proof-of-reserves feed, ledger flags, explorer links.
// Labels stay Enabled / Not enabled / Not read / Not available. No grades and no seals.

import { ATTESTATION_DISCLAIMER, presentAttestation, type FreshnessView } from './content/attestations.js';
import { TOKENS } from './config/tokens.js';
import type { ChainReading } from './ledgers/read.js';
import { CHAIN_TOKENS, type ChainToken } from './ledgers/registry.js';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export interface ExplorerLink { name: string; href: string }

export function xrplExplorers(issuer: string): ExplorerLink[] {
  return [
    { name: 'XRPScan', href: `https://xrpscan.com/account/${issuer}` },
    { name: 'Bithomp', href: `https://bithomp.com/explorer/${issuer}` },
  ];
}

export function chainExplorers(token: ChainToken): ExplorerLink[] {
  if (token.ledger === 'solana') {
    const href = token.explorerUrl.includes('solscan.io')
      ? token.explorerUrl
      : `https://solscan.io/token/${token.address}`;
    return [{ name: 'Solscan', href }];
  }
  const href = token.explorerUrl.includes('stellar.expert')
    ? token.explorerUrl
    : `https://stellar.expert/explorer/public/account/${token.issuer || token.address}`;
  return [{ name: 'StellarExpert', href }];
}

function explorerHtml(links: ExplorerLink[]): string {
  const anchors = links.map(link => `<a href="${esc(link.href)}" target="_blank" rel="noopener">${esc(link.name)}</a>`).join(' · ');
  return `External explorer: ${anchors}`;
}

export function attestationPhrase(view: FreshnessView): string {
  if (!view.reportDate) return 'None found';
  return 'Yes (dated)';
}

export function porPhrase(view: FreshnessView): string {
  if (!view.livePorFeed) return 'No';
  const name = view.livePorName ? ` ${view.livePorName}` : '';
  return `Yes${name}`;
}

export function triState(value: boolean | null | undefined): string {
  if (value === true) return 'Enabled';
  if (value === false) return 'Not enabled';
  return 'Not read this run';
}

export function lockingLine(value: boolean | null | undefined): string {
  return `<p class="meter-cap">Trust line locking (XLS-85): ${esc(triState(value))}</p>`;
}

export function attestationBlock(tokenId: string, asOf?: string): string {
  const view = presentAttestation(tokenId, asOf);
  const date = view.reportDate ? `<span>${esc(view.reportDate)}</span>` : '';
  const report = view.officialReportUrl
    ? `<a href="${esc(view.officialReportUrl)}" target="_blank" rel="noopener">Issuer report</a>`
    : '';
  const bars = view.barLookupUrl
    ? `<a href="${esc(view.barLookupUrl)}" target="_blank" rel="noopener">Bar lookup</a>`
    : '';
  const firm = view.accountingFirm ? `<span class="muted">Independent firm: ${esc(view.accountingFirm)}</span>` : '';
  const links = [date, report, bars, firm].filter(Boolean).join(' · ');
  return `<p class="flag-row" aria-label="Attestation freshness"><span class="pill">${esc(view.label)}</span>${links ? ` ${links}` : ''}</p>
<p class="meter-cap">${esc(ATTESTATION_DISCLAIMER)}</p>`;
}

export function cardEvidenceHtml(tokenId: string, asOf?: string): string {
  const view = presentAttestation(tokenId, asOf);
  const report = view.officialReportUrl
    ? `<a href="${esc(view.officialReportUrl)}" target="_blank" rel="noopener">Issuer report</a>`
    : '';
  const date = view.reportDate ? esc(view.reportDate) : '';
  return `<p class="flag-row"><span class="pill">${esc(view.label)}</span> ${date} ${report} <span class="pill">Public attestation: ${esc(attestationPhrase(view))}</span> <span class="pill">Live PoR: ${esc(porPhrase(view))}</span></p>
<p class="meter-cap">${esc(ATTESTATION_DISCLAIMER)}</p>`;
}

export interface FlagFacts {
  freeze: string;
  clawback: string;
  requireAuth: string;
  locking: string;
}

export function xrplFlags(flags: Record<string, boolean> | null | undefined): FlagFacts {
  if (!flags || !Object.keys(flags).length) {
    const missing = 'Not read this run';
    return { freeze: missing, clawback: missing, requireAuth: missing, locking: missing };
  }
  const freeze = flags.globalFreeze === true
    ? 'Enabled'
    : flags.noFreeze === true
      ? 'Not enabled'
      : flags.noFreeze === false || flags.globalFreeze === false
        ? 'Enabled'
        : 'Not read this run';
  return {
    freeze: flags.globalFreeze === true ? 'Enabled' : freeze,
    clawback: triState(flags.allowTrustLineClawback),
    requireAuth: triState(flags.requireAuthorization),
    locking: triState(flags.allowTrustLineLocking),
  };
}

export function chainFlags(row: ChainReading | null): FlagFacts {
  const offLedger = 'Not available on this ledger';
  if (!row) return { freeze: 'Not read this run', clawback: offLedger, requireAuth: offLedger, locking: offLedger };
  if (row.ledger === 'solana') {
    return {
      freeze: row.freezeAuthority ? 'Enabled' : 'Not read this run',
      clawback: offLedger,
      requireAuth: offLedger,
      locking: offLedger,
    };
  }
  return {
    freeze: triState(row.revocable),
    clawback: triState(row.clawback),
    requireAuth: triState(row.authRequired),
    locking: offLedger,
  };
}

export function evidenceRowHtml(tokenId: string, flags: FlagFacts, explorers: ExplorerLink[], asOf?: string): string {
  const view = presentAttestation(tokenId, asOf);
  const dated = view.reportDate ? ` · ${esc(view.reportDate)}` : '';
  const por = view.livePorFeed && view.livePorUrl
    ? `<a href="${esc(view.livePorUrl)}" target="_blank" rel="noopener">${esc(view.livePorName || 'Issuer feed')}</a>`
    : esc(porPhrase(view));
  return `<ul class="flag-row" aria-label="Evidence flags">
<li>Public attestation: ${esc(attestationPhrase(view))}${dated}</li>
<li>Live PoR feed: ${por}</li>
<li>Freeze: ${esc(flags.freeze)}</li>
<li>Clawback: ${esc(flags.clawback)}</li>
<li>RequireAuth: ${esc(flags.requireAuth)}</li>
<li>Trust line locking (XLS-85): ${esc(flags.locking)}</li>
<li>${explorerHtml(explorers)}</li>
</ul>
<p class="meter-cap">${esc(ATTESTATION_DISCLAIMER)}</p>`;
}

export function citeSummary(sentences: [string, string]): string {
  return `<p class="cite-summary">${esc(sentences[0])} ${esc(sentences[1])}</p>`;
}

function tokenLabel(id: string): { name: string; ledger: string } {
  const xrpl = TOKENS.find(token => token.id === id);
  if (xrpl) return { name: xrpl.name, ledger: 'XRPL' };
  const chain = CHAIN_TOKENS.find(token => token.id === id);
  if (chain) return { name: chain.name, ledger: chain.ledger === 'solana' ? 'Solana' : 'Stellar' };
  return { name: id, ledger: '' };
}

/** Comparison table for /attestations. One row per tracked token. */
export function attestationsOverviewHtml(views: FreshnessView[]): string {
  const rows = views.map(view => {
    const meta = tokenLabel(view.tokenId);
    const report = view.officialReportUrl
      ? `<a href="${esc(view.officialReportUrl)}" target="_blank" rel="noopener">Report</a>`
      : '—';
    const cadence = view.cadenceDays == null ? '—' : String(view.cadenceDays);
    return `<tr><td><a href="/token/${esc(view.tokenId)}">${esc(meta.name)}</a></td><td>${esc(meta.ledger)}</td><td>${esc(view.issuer)}</td><td>${esc(view.reportDate ?? '—')}</td><td>${esc(view.accountingFirm ?? '—')}</td><td>${cadence}</td><td>${esc(view.label)}</td><td>${view.livePorFeed ? 'Yes' : 'No'}</td><td>${report}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table><tr><th>Token</th><th>Ledger</th><th>Issuer</th><th>Report date</th><th>Independent firm</th><th>Cadence days</th><th>Freshness</th><th>Live PoR feed</th><th>Source</th></tr>${rows}</table></div>`;
}
