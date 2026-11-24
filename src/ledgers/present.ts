// Maps a Solana or Stellar ChainReading onto the XRPL comparison model
// (market / controls / identity). Does not invent an OK / WARN / CRITICAL
// overall, an xrp-ledger.toml result, an AMM table, or 7-day DEX volume.

import { PEG_CRIT_PCT, PEG_WARN_PCT } from '../monitor.js';
import { presentationFromParts, type PresentItem, type Presentation } from '../presentation.js';
import type { FaceFacts } from '../face.js';
import type { ChainToken } from './registry.js';
import { CHAIN_PEG_LIQ_USD, type ChainCheck, type ChainReading } from './read.js';
import { fmtNum, troyOz } from './parse.js';

export const CHAIN_NA = 'Not available on this ledger';

export const CHAIN_LEGACY_NOTE =
  'Not available on this ledger. Solana and Stellar readings do not use the XRPL worst-check aggregate (OK, WARN, or CRITICAL). The chips compare public fields. They are not a buy or sell rating.';

export interface ChainPresented {
  presentation: Presentation;
  facts: FaceFacts;
  supplyPrimary: string;
  supplyUnit: string;
}

const CONTROL_KEYS = new Set([
  'mint', 'freeze', 'permanentDelegate', 'pausable', 'paused', 'transferHook', 'defaultFrozen',
  'transferFee', 'mintClose', 'auth', 'revocable', 'clawback', 'forced-transfer', 'blocklist', 'upgrade', 'roles',
]);

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function deviation(row: ChainReading): number | null {
  if (row.pricePerOz == null || row.spotUsd == null || !(row.spotUsd > 0)) return null;
  return ((row.pricePerOz - row.spotUsd) / row.spotUsd) * 100;
}

function pegResult(row: ChainReading): ChainCheck['result'] {
  const peg = row.checks.find(c => c.key === 'peg');
  if (peg) return peg.result === 'ok' || peg.result === 'warn' || peg.result === 'critical' || peg.result === 'na' ? peg.result : 'na';
  if (row.pricePerOz == null || row.spotUsd == null || row.liquidityUsd == null || row.liquidityUsd < CHAIN_PEG_LIQ_USD) return 'na';
  const abs = Math.abs((row.pricePerOz - row.spotUsd) / row.spotUsd);
  if (abs >= PEG_CRIT_PCT / 100) return 'critical';
  if (abs >= PEG_WARN_PCT / 100) return 'warn';
  return 'ok';
}

function gap(code: string, label: string, detail: string): PresentItem {
  return { code, tone: 'gap', gapKind: 'not-measurable', label, detail };
}

function feature(code: string, label: string, detail: string, kicker?: string): PresentItem {
  return { code, tone: 'feature', kicker, label, detail };
}

function controlLabel(row: ChainReading, key: string): string {
  switch (key) {
    case 'mint': return row.mintAuthority ? 'Mint authority' : 'Mint authority not read';
    case 'freeze': return row.freezeAuthority ? 'Freeze authority' : 'Freeze authority not read';
    case 'permanentDelegate': return 'Permanent delegate';
    case 'pausable': return 'Can pause transfers';
    case 'paused': return 'Transfers paused';
    case 'transferHook': return 'Transfer hook';
    case 'defaultFrozen': return 'New accounts start frozen';
    case 'transferFee': return row.controls?.transferFeeBps ? `Transfer fee ${row.controls.transferFeeBps} bps` : 'Transfer fee';
    case 'mintClose': return 'Mint close authority';
    case 'auth': return row.authRequired ? 'Restricted access' : 'AUTH_REQUIRED off';
    case 'revocable': return row.revocable ? 'Can freeze trustlines' : 'Authorization not revocable';
    case 'clawback': return row.clawback ? 'Clawback' : 'Clawback off';
    case 'forced-transfer': return 'Forced transfer';
    case 'blocklist': return 'Blocklist';
    case 'upgrade': return 'Timelocked upgrade';
    case 'roles': return 'Owner, Operator, Revoker';
    default: return key;
  }
}

function toneOf(result: ChainCheck['result']): PresentItem['tone'] {
  if (result === 'critical') return 'critical';
  if (result === 'warn') return 'warn';
  if (result === 'ok') return 'measured';
  if (result === 'feature') return 'feature';
  return 'gap';
}

function marketItems(row: ChainReading, dev: number | null, graded: ChainCheck['result']): PresentItem[] {
  const items: PresentItem[] = [];
  const liq = row.liquidityUsd;
  if (liq == null) {
    items.push(gap('chain-liq-none', 'No quoted liquidity', 'No public quote returned a liquidity figure. AMM pools are not available on this ledger. Missing depth is not a broken peg.'));
  } else if (liq < CHAIN_PEG_LIQ_USD) {
    items.push(gap('chain-liq-thin', `Thin market (${money(liq)})`, `A public quote reports about ${money(liq)} of liquidity, under the ${money(CHAIN_PEG_LIQ_USD)} gate used before a price is graded. A thin market is not a broken peg. This is not an AMM pool.`));
  } else {
    items.push({
      code: 'chain-liq-measured', tone: 'measured', label: `Quoted liquidity (${money(liq)})`,
      detail: `A public quote reports at least ${money(CHAIN_PEG_LIQ_USD)} of liquidity. This is not an XRP Ledger AMM pool, and it is not proof of backing.`,
    });
  }

  if (dev == null || row.pricePerOz == null) {
    items.push(gap('chain-price-none', 'No quoted price', 'No quoted price was read. Absence of a price is not a peg break. 7-day DEX volume is not available on this ledger.'));
  } else if (graded === 'na') {
    items.push(gap('chain-price-thin', 'Thin-market price', `About ${fmtNum(row.pricePerOz)} USD per troy oz (${pct(dev)} vs spot). The quote is too thin to grade, or spot was not read with it. That raw figure is not a broken peg.`));
  } else if (graded === 'critical') {
    items.push({
      code: 'chain-price-critical', tone: 'critical', label: `Large peg gap (${pct(dev)})`,
      detail: `A quote deep enough to grade is ${PEG_CRIT_PCT}% or more from spot. This is a trading-price gap. It is not a statement about vaults.`,
    });
  } else if (graded === 'warn') {
    items.push({
      code: 'chain-price-warn', tone: 'warn', label: `Peg off spot (${pct(dev)})`,
      detail: `A quote deep enough to grade is at least ${PEG_WARN_PCT}% and under ${PEG_CRIT_PCT}% from spot. This is a trading price only.`,
    });
  } else {
    items.push({
      code: 'chain-price-near', tone: 'measured', label: `Price near spot (${pct(dev)})`,
      detail: `The quoted price is within ${PEG_WARN_PCT}% of spot, from a market deep enough to grade. This is a trading price. It is not proof of backing and it is not a safety rating.`,
    });
  }

  if (row.holders != null) {
    const note = row.holdersNote || `${row.holders.toLocaleString('en-US')} holder accounts reported. Not a safety rating.`;
    items.push({ code: 'chain-holders', tone: 'measured', label: `${row.holders.toLocaleString('en-US')} holder accounts`, detail: note });
  } else {
    items.push(gap('chain-holders-na', 'Holders not available', row.holdersNote || 'Holder count is not available on this ledger yet.'));
  }

  if (row.supply === 0 && row.ledger === 'stellar') {
    items.push(feature('chain-zero-issued', '0 issued on Stellar', '0 issued on Stellar. The token stays listed and is left out of totals. This is a supply reading, not a vault check.', 'Noted'));
  } else if (row.supply == null) {
    items.push(gap('chain-supply-na', 'Supply not read', row.error
      ? `Supply was not read (${row.error}). That is a missing reading, not a finding about the token.`
      : 'Supply was not read from the public endpoint this run.'));
  }
  if (row.error && row.supply != null) {
    items.push(gap('chain-stale', 'Last good reading', `The latest call did not succeed (${row.error}). Figures shown are the last good reading. This is not a new finding.`));
  }
  return items;
}

const XAUM_CONTROLS: PresentItem[] = [
  feature('chain-forced-transfer', 'Forced transfer', 'The published XAUm contract includes forced transfer. That is an issuer control, not an event.'),
  feature('chain-blocklist', 'Blocklist', 'The published XAUm contract includes a blocklist. That is an issuer control, not an event.'),
  feature('chain-upgrade', 'Timelocked upgrade', 'The published XAUm contract has a timelocked upgrade. That is an issuer control, not an event.'),
  feature('chain-roles', 'Owner, Operator, Revoker', 'The published XAUm contract has Owner, Operator, and Revoker roles. Those are issuer controls, not an event.'),
];

function controlItems(row: ChainReading): PresentItem[] {
  const fromChecks = row.checks.filter(c => CONTROL_KEYS.has(c.key));
  const items: PresentItem[] = fromChecks.map(c => {
    const tone = toneOf(c.result);
    return {
      code: `chain-${c.key}`,
      tone,
      gapKind: tone === 'gap' ? 'not-measurable' as const : undefined,
      label: controlLabel(row, c.key),
      detail: c.message,
    };
  });
  if (!fromChecks.length && row.ledger === 'solana') {
    items.push(gap('chain-mint', 'Mint authority not read', 'Mint authority was not returned. A missing field is not proof the authority is gone.'));
    items.push(gap('chain-freeze', 'Freeze authority not read', 'Freeze authority was not returned. A missing field is not proof the authority is gone.'));
  } else if (!fromChecks.length && row.ledger === 'stellar' && row.kind === 'classic') {
    items.push(gap('chain-flags', 'Issuer flags not read', 'AUTH_REQUIRED, authorization revocable, and clawback were not read this run. A missing flag is not a finding that the flag is off.'));
  }
  if (row.id === 'stellar-xaum' && !fromChecks.some(c => c.key === 'forced-transfer')) items.push(...XAUM_CONTROLS);
  return items;
}

function identityItems(row: ChainReading): PresentItem[] {
  const kind = row.kind === 'mint' ? 'Mint address' : row.kind === 'sep41' ? 'Contract address' : 'Asset code';
  const items: PresentItem[] = [];
  if (row.bridged) {
    items.push(feature('chain-bridged', 'Bridged', 'Marked bridged. The on-ledger supply is the bridged representation, not a separate vault check.', 'Noted'));
  }
  items.push(feature(
    'chain-address',
    kind,
    `${kind} ${row.address}${row.issuer ? `. Issuer account ${row.issuer}` : ''}. Public explorer: ${row.explorerUrl}. This identifies the listed record. It is not a backing check.`,
    'Noted',
  ));
  items.push(gap(
    'chain-domain-na',
    'No domain check on this ledger',
    'xrp-ledger.toml and on-ledger Domain checks are not available on this ledger. ReserveWatch does not treat that as a failed verification. The address on this card is the public mint, contract, or asset code.',
  ));
  return items;
}

function figures(row: ChainReading): string {
  const parts: string[] = [];
  if (row.supply === 0 && row.ledger === 'stellar') parts.push('0 issued on Stellar.');
  else if (row.supply != null) parts.push(`${fmtNum(row.supply)} ${row.displayCode}, about ${fmtNum(troyOz(row.supply, row.gramsPerToken))} troy oz. This count is tokens, not a vault check.`);
  else parts.push('Supply was not read this run.');
  parts.push(row.pegNote || 'Price vs spot is not available.');
  parts.push('7-day DEX volume is not available on this ledger.');
  parts.push('AMM pools are not available on this ledger.');
  return parts.join(' ');
}

export function chainSupplyFace(row: ChainReading): { primary: string; unit: string } {
  if (row.supply == null) return { primary: '—', unit: 'not available' };
  if (row.supply === 0 && row.ledger === 'stellar') return { primary: '0 issued on Stellar', unit: row.displayCode };
  return { primary: fmtNum(row.supply), unit: row.displayCode };
}

/** Classify one Solana or Stellar reading for the same cards and token panels as XRPL. */
export function presentFromChain(row: ChainReading): ChainPresented {
  const dev = deviation(row);
  const graded = pegResult(row);
  const reliable = graded === 'ok' || graded === 'warn' || graded === 'critical';
  const presentation = presentationFromParts({
    legacyOverall: null,
    legacyNote: CHAIN_LEGACY_NOTE,
    marketFigures: figures(row),
    market: marketItems(row, dev, graded),
    controls: controlItems(row),
    identity: identityItems(row),
  });
  const supply = chainSupplyFace(row);
  return {
    presentation,
    facts: {
      liquidityUsd: row.liquidityUsd ?? 0,
      hasPool: false,
      deviationPct: dev,
      pegReliable: reliable && dev != null,
      topHolderPct: null,
      quoteAssets: [],
      lowLiqUsd: CHAIN_PEG_LIQ_USD,
      pegCritPct: PEG_CRIT_PCT,
    },
    supplyPrimary: supply.primary,
    supplyUnit: supply.unit,
  };
}

export function placeholderChainReading(token: ChainToken): ChainReading {
  return {
    id: token.id, ledger: token.ledger, name: token.name, project: token.project, displayCode: token.displayCode,
    metal: 'gold', gramsPerToken: token.gramsPerToken, bridged: token.bridged, address: token.address, issuer: token.issuer,
    kind: token.kind, explorerUrl: token.explorerUrl, website: token.website,
    supply: null, holders: null, holdersNote: 'Holder count is not available on this ledger yet.', mintAuthority: null, freezeAuthority: null,
    authRequired: null, revocable: null, clawback: null, controls: null, spotUsd: null, spotSource: '',
    priceUsd: null, pricePerOz: null, liquidityUsd: null,
    pegNote: 'Price vs spot is not available.',
    checks: [], updatedAt: '', notes: token.notes, countInTotal: true,
  };
}
