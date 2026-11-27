// Issuer-published attestation metadata. Dates and firms below were checked on
// 2026-11-27 against the issuer pages named in officialReportUrl. A null report
// date means no dated public report was on file. Nothing here is a ReserveWatch
// vault inspection.

import { TOKENS } from '../config/tokens.js';
import { CHAIN_TOKENS } from '../ledgers/registry.js';

export const ATTESTATION_CHECKED = '2026-11-27';
/** Days past the issuer's stated cadence that still count as within cadence. */
export const FRESHNESS_GRACE_DAYS = 7;
/** A report this many days old is significantly past, once it is also past cadence. */
export const FRESHNESS_OVERDUE_DAYS = 120;

export const ATTESTATION_DISCLAIMER = "Issuer's published report; ReserveWatch has not audited any vault.";
export const PUBLIC_RECORD_DISCLAIMER =
  'ReserveWatch publishes public ledger readings and links to issuer-published reports. ReserveWatch has not audited any vault. This is not investment, financial, legal, or tax advice.';

export type Freshness = 'CURRENT' | 'STALE' | 'OVERDUE' | 'UNPUBLISHED';

export interface AttestationEntry {
  /** Publishing organization. Not an on-ledger account address. */
  issuer: string;
  tokenId: string;
  /** Reserve as-of date on the issuer's report, YYYY-MM-DD, or null when none is published. */
  reportDate: string | null;
  /** Named firm on that report, or null. */
  accountingFirm: string | null;
  /** Issuer-stated cadence in days. 30 monthly, 90 quarterly, 182 semi-annual. Null when the issuer does not state one. */
  cadenceDays: number | null;
  officialReportUrl: string | null;
  /** Official bar or allocation lookup, where the issuer publishes one. */
  barLookupUrl: string | null;
  /** True only when the issuer publishes a continuous proof-of-reserves feed. */
  livePorFeed: boolean;
  livePorName: string | null;
  livePorUrl: string | null;
  checkedDate: typeof ATTESTATION_CHECKED;
}

export interface FreshnessView extends AttestationEntry {
  status: Freshness;
  /** Plain label. Not a letter grade and not a 0–100 score. */
  label: string;
  ageDays: number | null;
  asOf: string;
}

const unpublished = (issuer: string, tokenId: string, cadenceDays: number | null = null): AttestationEntry => ({
  issuer,
  tokenId,
  reportDate: null,
  accountingFirm: null,
  cadenceDays,
  officialReportUrl: null,
  barLookupUrl: null,
  livePorFeed: false,
  livePorName: null,
  livePorUrl: null,
  checkedDate: ATTESTATION_CHECKED,
});

/**
 * Dated public reports checked 2026-11-27.
 * PAXG: Paxos monthly page; KPMG LLP for reports posted on or after 2025-02-28.
 *   Latest linked month on that page is September 2026 (reserve as-of 2026-09-30).
 *   Bar lookup is the tool Paxos names at paxg.com.
 * XAUT / XAUt0: Tether Gold quarterly reserves reports; BDO Italia S.p.A.
 *   Latest published reserves report indexed for September 2026 (as-of 2026-09-30).
 *   The reports page says those figures are not updated after the report date, so there is no live feed.
 * XAUm: Matrixdock semi-annual Bureau Veritas inspection. The July 2026 cycle's last vault date is 2026-07-15.
 * DGLD: Gold Token SA, Grant Thornton agreed-upon procedures, inventory as-of 2026-09-28.
 *   The issuer called this its first such report, so no cadence is stored.
 * VNXAU: VNX Commodities AG, AREVA agreed-upon procedures, reserve as-of 2025-12-31.
 *   The issuer says reports are regular and does not state a day count.
 * Assetiko XAUa says a quarterly report will be published once issued. None was on file.
 * Other tracked XRPL issuers had no public attestation page on the check date.
 */
const PUBLISHED: AttestationEntry[] = [
  {
    issuer: 'Paxos',
    tokenId: 'solana-paxg',
    reportDate: '2026-09-30',
    accountingFirm: 'KPMG LLP',
    cadenceDays: 30,
    officialReportUrl: 'https://www.paxos.com/transparency/paxg',
    barLookupUrl: 'https://paxg.com',
    livePorFeed: false,
    livePorName: null,
    livePorUrl: null,
    checkedDate: ATTESTATION_CHECKED,
  },
  {
    issuer: 'Tether Gold (XAUT / XAUt0)',
    tokenId: 'solana-xaut0',
    reportDate: '2026-09-30',
    accountingFirm: 'BDO Italia S.p.A.',
    cadenceDays: 90,
    officialReportUrl: 'https://gold.tether.to/reports/',
    barLookupUrl: 'https://gold.tether.to/en/transparency',
    livePorFeed: false,
    livePorName: null,
    livePorUrl: null,
    checkedDate: ATTESTATION_CHECKED,
  },
  {
    issuer: 'Matrixdock',
    tokenId: 'solana-xaum',
    reportDate: '2026-07-15',
    accountingFirm: 'Bureau Veritas',
    cadenceDays: 182,
    officialReportUrl: 'https://matrixdock.gitbook.io/matrixdock-docs/english/gold-token-xaum/physical-gold-vault-audit',
    barLookupUrl: null,
    livePorFeed: false,
    livePorName: null,
    livePorUrl: null,
    checkedDate: ATTESTATION_CHECKED,
  },
  {
    issuer: 'Matrixdock',
    tokenId: 'stellar-xaum',
    reportDate: '2026-07-15',
    accountingFirm: 'Bureau Veritas',
    cadenceDays: 182,
    officialReportUrl: 'https://matrixdock.gitbook.io/matrixdock-docs/english/gold-token-xaum/physical-gold-vault-audit',
    barLookupUrl: null,
    livePorFeed: false,
    livePorName: null,
    livePorUrl: null,
    checkedDate: ATTESTATION_CHECKED,
  },
  {
    issuer: 'Gold Token SA',
    tokenId: 'solana-dgld',
    reportDate: '2026-09-28',
    accountingFirm: 'Grant Thornton',
    cadenceDays: null,
    officialReportUrl: 'https://files.dgld.ch/reports/2026-Q3-GTSA-Grant_Thornton-Physical_Gold_Inventory_Report.pdf',
    barLookupUrl: null,
    livePorFeed: false,
    livePorName: null,
    livePorUrl: null,
    checkedDate: ATTESTATION_CHECKED,
  },
  {
    issuer: 'VNX Commodities AG',
    tokenId: 'solana-vnxau',
    reportDate: '2025-12-31',
    accountingFirm: 'AREVA General Auditing and Trust Company Limited',
    cadenceDays: null,
    officialReportUrl: 'https://vnx.li/uploads/2026/03/VNX_Examination_on_Management_Assertions_VNXAU_31_12_2025_signiert.pdf',
    barLookupUrl: null,
    livePorFeed: false,
    livePorName: null,
    livePorUrl: null,
    checkedDate: ATTESTATION_CHECKED,
  },
  {
    issuer: 'VNX Commodities AG',
    tokenId: 'stellar-vnxau',
    reportDate: '2025-12-31',
    accountingFirm: 'AREVA General Auditing and Trust Company Limited',
    cadenceDays: null,
    officialReportUrl: 'https://vnx.li/uploads/2026/03/VNX_Examination_on_Management_Assertions_VNXAU_31_12_2025_signiert.pdf',
    barLookupUrl: null,
    livePorFeed: false,
    livePorName: null,
    livePorUrl: null,
    checkedDate: ATTESTATION_CHECKED,
  },
];

const STATED_CADENCE: Record<string, number> = {
  // Assetiko's gold page says independent reports are quarterly and will be posted once issued.
  'assetiko-xaua': 90,
};

const publishedById = new Map(PUBLISHED.map(entry => [entry.tokenId, entry]));

function issuerName(tokenId: string): string {
  return TOKENS.find(token => token.id === tokenId)?.project
    ?? CHAIN_TOKENS.find(token => token.id === tokenId)?.project
    ?? tokenId;
}

export function attestationFor(tokenId: string): AttestationEntry {
  return publishedById.get(tokenId) ?? unpublished(issuerName(tokenId), tokenId, STATED_CADENCE[tokenId] ?? null);
}

export function allAttestations(): AttestationEntry[] {
  return [...TOKENS.map(token => token.id), ...CHAIN_TOKENS.map(token => token.id)].map(attestationFor);
}

export function isTrackedToken(tokenId: string): boolean {
  return TOKENS.some(token => token.id === tokenId) || CHAIN_TOKENS.some(token => token.id === tokenId);
}

/** Whole UTC days from reportDate to asOf. Negative when the report date is after asOf. */
export function ageDays(reportDate: string, asOf: string): number {
  const start = Date.parse(`${reportDate}T00:00:00Z`);
  const end = Date.parse(`${asOf}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/**
 * CURRENT: report date is within cadence plus the grace window.
 * STALE: past that window, and not yet significantly past.
 * OVERDUE: more than twice the cadence, or more than 120 days once the report is past cadence.
 * A dated report with no published cadence is CURRENT until it is more than 120 days old, then OVERDUE.
 * UNPUBLISHED: no report date on file.
 */
export function freshnessStatus(entry: Pick<AttestationEntry, 'reportDate' | 'cadenceDays'>, asOf: string): Freshness {
  if (!entry.reportDate) return 'UNPUBLISHED';
  const age = ageDays(entry.reportDate, asOf);
  const cadence = entry.cadenceDays;
  if (cadence == null || cadence <= 0) return age > FRESHNESS_OVERDUE_DAYS ? 'OVERDUE' : 'CURRENT';
  if (age <= cadence + FRESHNESS_GRACE_DAYS) return 'CURRENT';
  if (age > cadence * 2 || age > FRESHNESS_OVERDUE_DAYS) return 'OVERDUE';
  return 'STALE';
}

export function freshnessLabel(status: Freshness, cadenceKnown: boolean): string {
  if (status === 'UNPUBLISHED') return 'Not published / none found';
  if (!cadenceKnown && status === 'CURRENT') return 'Dated report on file';
  if (!cadenceKnown && status === 'OVERDUE') return 'Significantly past the report date';
  if (status === 'CURRENT') return 'Within cadence';
  if (status === 'STALE') return 'Past cadence';
  return 'Significantly past cadence';
}

export function presentAttestation(tokenId: string, asOf = new Date().toISOString().slice(0, 10)): FreshnessView {
  const entry = attestationFor(tokenId);
  const status = freshnessStatus(entry, asOf);
  return {
    ...entry,
    status,
    label: freshnessLabel(status, entry.cadenceDays != null && entry.cadenceDays > 0),
    ageDays: entry.reportDate ? ageDays(entry.reportDate, asOf) : null,
    asOf,
  };
}

export function presentAttestations(asOf = new Date().toISOString().slice(0, 10)): FreshnessView[] {
  return allAttestations().map(entry => presentAttestation(entry.tokenId, asOf));
}
