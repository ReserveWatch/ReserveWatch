// Comparison menu (model categories-v1).
//
// This module classifies a token for display. It does not change monitor.ts
// check severities, TokenReport.status, alert transitions, or the labels stored
// on historical weekly snapshots. Those remain the legacy worst-check aggregate:
// one WARN check (including a mere feature or a missing measurement) makes the
// whole token WARN.
//
// Categories — what a visitor compares:
//   market    liquidity and peg vs spot
//   controls  issuer powers, holder structure, and active freezes
//   identity  whether public records confirm the issuer account
//
// Tones — not buy/sell ratings. "Measured" is not "safe" and not a backing guarantee.
//   measured   a reading we could actually take (deep-enough liquidity, a reliable
//              price inside the near-spot band, two-way xrp-ledger.toml, NoFreeze)
//   feature    an enabled issuer power or holder structure (clawback, RequireAuth,
//              concentration, retained freeze ability, represented asset). Factual.
//              Not an adverse event. Not risk-free.
//   gap        not confirmed, or not measurable. No pool is not a broken peg.
//              An unconfirmed issuer link is not a fraud finding. A domain file
//              that does not list the account is not the same as a project list
//              that contradicts the account.
//   warn       prominent caution for a specific active problem below the critical
//              set: a reliable peg deviation in the warn band, or individual
//              freezes that lock a measurable share of supply (at most half).
//   critical   prominent: Global Freeze, a discontinued token, issuer account
//              missing, individual freezes over half of supply, a reliable peg
//              deviation at or beyond the critical band, or issuer records that
//              disagree with the account (unverified listing).
//
// Empty frozen lines stay visible but neutral. monitor.ts still records them as
// WARN so the raw check is not deleted. A line that holds none of the supply is
// not an active supply freeze, so the menu does not paint it as caution.
//
// Category `tone` is only a summary (critical > warn > gap > feature > measured).
// Every item is returned and should stay visible. A gap must not hide a measured
// fact, and a feature must not be relabeled WARN or CRITICAL here.

import type { Severity, TokenReport } from './monitor.js';
import { CONC_WARN_PCT, LOW_LIQ_USD, PEG_CRIT_PCT, PEG_WARN_PCT } from './monitor.js';

export const PRESENTATION_MODEL = 'categories-v1' as const;

export type PresentTone = 'measured' | 'feature' | 'gap' | 'warn' | 'critical';
export type GapKind = 'not-confirmed' | 'not-measurable';
export type CategoryId = 'market' | 'controls' | 'identity';

export interface PresentItem {
  code: string;
  tone: PresentTone;
  /** Short chip text. No buy/sell language. */
  label: string;
  /** Holder-facing explanation. Plain text. */
  detail: string;
  /** Set when tone is gap, so the chip can say "Not confirmed" or "Not measurable". */
  gapKind?: GapKind;
  /** Neutral chip kicker when "Feature" would misname a measured non-event. */
  kicker?: string;
}

export interface CategoryView {
  id: CategoryId;
  title: string;
  /** Most serious item tone. A summary only — render every item. */
  tone: PresentTone;
  items: PresentItem[];
}

export interface Presentation {
  model: typeof PRESENTATION_MODEL;
  /** Echo of TokenReport.status. Not recomputed and not a recommendation. */
  legacyOverall: Severity;
  legacyNote: string;
  categories: Record<CategoryId, CategoryView>;
  /** Plain-text market numbers for the comparison row (TVL, peg, nominal-$1 caveat). */
  marketFigures: string;
}

export const LEGACY_OVERALL_NOTE =
  'Legacy overall is the worst raw check (OK, WARN, or CRITICAL). A feature or an information gap still counts as WARN in that aggregate. It is kept for the API status field, the alert log, and historical snapshots. It is not a buy or no-buy rating, and it is not this comparison.';

/** Must match the frozen-line rule in monitor.ts (`share > 50` is critical). */
export const FROZEN_CRIT_SHARE_PCT = 50;
/**
 * Presentation-only. A frozen trust line whose balance is below this share of
 * circulating supply is shown as a noted fact, not a caution. The raw check
 * severity is unchanged.
 */
export const FROZEN_DUST_SHARE_PCT = 0.05;

export interface Thresholds {
  lowLiqUsd: number;
  pegWarnPct: number;
  pegCritPct: number;
  concWarnPct: number;
  frozenCritSharePct: number;
  frozenDustSharePct: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  lowLiqUsd: LOW_LIQ_USD,
  pegWarnPct: PEG_WARN_PCT,
  pegCritPct: PEG_CRIT_PCT,
  concWarnPct: CONC_WARN_PCT,
  frozenCritSharePct: FROZEN_CRIT_SHARE_PCT,
  frozenDustSharePct: FROZEN_DUST_SHARE_PCT,
};

export interface PresentInput {
  /** Legacy worst-check aggregate. Passed through; never derived here. */
  status: Severity;
  /**
   * missing = issuer account not on the ledger.
   * unread  = this run could not read the account (timeout / rate limit).
   * ok      = account data was read.
   */
  ledgerRead: 'ok' | 'missing' | 'unread';
  knownStatus?: 'active' | 'discontinued' | 'unverified' | 'unconfirmed';
  tokenization?: 'distributed' | 'represented';
  domainVerified: boolean | null;
  flags: {
    globalFreeze?: boolean;
    noFreeze?: boolean;
    allowTrustLineClawback?: boolean;
    requireAuthorization?: boolean;
  };
  peg: { referenceUsd: number | null; deviationPct: number | null; reliable: boolean };
  liquidityUsd: number;
  quoteAssets: string[];
  hasPool: boolean;
  spotUnsupported: boolean;
  frozenLines: number;
  frozenBalance: number;
  circulating: number | null;
  transferFeePct: number;
  /** Largest non-treasury, non-AMM holder, percent of non-treasury supply. */
  topHolderPct: number | null;
}

const TONE_RANK: Record<PresentTone, number> = { measured: 0, feature: 1, gap: 2, warn: 3, critical: 4 };

const money = (n: number) => '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const shareText = (share: number) => (share < 0.05 ? 'about 0%' : `${share.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`);

function worstTone(items: PresentItem[]): PresentTone {
  return items.reduce<PresentTone>((m, it) => (TONE_RANK[it.tone] > TONE_RANK[m] ? it.tone : m), 'measured');
}

/** critical, then caution, then positives, then features, then gaps — so a measured fact stays visible beside a problem. */
const ITEM_SORT: Record<PresentTone, number> = { critical: 0, warn: 1, measured: 2, feature: 3, gap: 4 };

function category(id: CategoryId, title: string, items: PresentItem[]): CategoryView {
  const sorted = [...items].sort((a, b) => ITEM_SORT[a.tone] - ITEM_SORT[b.tone]);
  return { id, title, tone: sorted.length ? worstTone(sorted) : 'gap', items: sorted };
}

function nominalCaveat(quotes: string[]): string {
  const stables = quotes.filter(q => q === 'RLUSD' || q === 'USDV');
  if (!stables.length) return '';
  const names = stables.join(' and ');
  return ` ${names} ${stables.length > 1 ? 'are' : 'is'} valued at a nominal $1 (the issuer-stated peg, not verified here).`;
}

function marketFigures(input: PresentInput, th: Thresholds): string {
  if (input.ledgerRead !== 'ok') return 'Market data was not read this run.';
  const via = input.quoteAssets.length ? ` via ${input.quoteAssets.join(' + ')}` : '';
  const liq = input.hasPool ? `AMM TVL about ${money(input.liquidityUsd)}${via}.` : 'No AMM pool.';
  const caveat = nominalCaveat(input.quoteAssets);
  let peg: string;
  if (input.spotUnsupported) peg = 'Price vs spot is not measured for this commodity.';
  else if (input.peg.reliable && input.peg.deviationPct != null) peg = `Reliable peg ${pct(input.peg.deviationPct)} vs spot.`;
  else if (input.peg.deviationPct != null) peg = `Peg not measurable; raw reading ${pct(input.peg.deviationPct)} vs spot is not graded.`;
  else if (!input.hasPool) peg = 'No on-ledger price, so the peg was not read.';
  else peg = `Pool TVL is under ${money(th.lowLiqUsd)}, so the peg was not graded.`;
  return `${liq}${caveat} ${peg}`;
}

function marketItems(input: PresentInput, th: Thresholds): PresentItem[] {
  const items: PresentItem[] = [];
  const caveat = nominalCaveat(input.quoteAssets).trim();
  if (!input.hasPool) {
    items.push({
      code: 'liquidity-none',
      tone: 'gap',
      gapKind: 'not-measurable',
      label: 'No pool',
      detail: 'No AMM pool against XRP, RLUSD, or USDV. Missing depth is not a broken peg.',
    });
  } else if (input.liquidityUsd < th.lowLiqUsd) {
    items.push({
      code: 'liquidity-thin',
      tone: 'gap',
      gapKind: 'not-measurable',
      label: `Thin liquidity (${money(input.liquidityUsd)})`,
      detail: `AMM TVL is about ${money(input.liquidityUsd)}, under the ${money(th.lowLiqUsd)} gate used before a peg is graded.${caveat ? ' ' + caveat : ''} A thin pool is not a broken peg.`,
    });
  } else {
    items.push({
      code: 'liquidity-measured',
      tone: 'measured',
      label: `Measurable liquidity (${money(input.liquidityUsd)})`,
      detail: `AMM pools hold at least ${money(th.lowLiqUsd)}.${input.quoteAssets.length ? ' Quoted via ' + input.quoteAssets.join(' + ') + '.' : ''}${caveat ? ' ' + caveat : ''} Depth is not proof of backing.`,
    });
  }

  if (input.spotUnsupported) {
    const quoted = input.peg.referenceUsd != null ? ' An on-ledger price was read and is not graded against spot, because this class has no public spot reference.' : '';
    items.push({
      code: 'price-not-measured',
      tone: 'gap',
      gapKind: 'not-measurable',
      label: 'Price vs spot not measured',
      detail: `ReserveWatch has no public spot reference for this commodity, so it does not invent a peg.${quoted}`,
    });
    return items;
  }

  const dev = input.peg.deviationPct;
  if (input.peg.reliable && dev != null) {
    const abs = Math.abs(dev);
    if (abs >= th.pegCritPct) {
      items.push({
        code: 'peg-critical',
        tone: 'critical',
        label: `Large peg gap (${pct(dev)})`,
        detail: `A reliable AMM reading (pools at or above ${money(th.lowLiqUsd)}) is ${th.pegCritPct}% or more from spot. This is a measured trading-price gap. It is not a statement about vaults or anyone's conduct.`,
      });
    } else if (abs >= th.pegWarnPct) {
      items.push({
        code: 'peg-warn',
        tone: 'warn',
        label: `Peg off spot (${pct(dev)})`,
        detail: `A reliable AMM reading is at least ${th.pegWarnPct}% and under ${th.pegCritPct}% from spot. This is an active price gap on a pool deep enough to grade, not a missing measurement. It is a trading price only.`,
      });
    } else {
      items.push({
        code: 'peg-near',
        tone: 'measured',
        label: `Price near spot (${pct(dev)})`,
        detail: `The on-ledger price is within ${th.pegWarnPct}% of spot, from AMM pools deep enough to grade. This is a trading price. It is not proof of backing and it is not a safety rating.`,
      });
    }
  } else if (dev != null || input.peg.referenceUsd != null) {
    items.push({
      code: 'peg-not-measurable',
      tone: 'gap',
      gapKind: 'not-measurable',
      label: 'Peg not measurable',
      detail: dev != null
        ? `A raw on-ledger reading is ${pct(dev)} vs spot, but the pool or book is too thin to grade (below ${money(th.lowLiqUsd)}, or an order book whose depth was not measured). That raw figure is not a broken peg.`
        : `An on-ledger price was read, but it is not deep enough to grade against spot. That is not a broken peg.`,
    });
  } else {
    items.push({
      code: 'peg-no-price',
      tone: 'gap',
      gapKind: 'not-measurable',
      label: 'No on-ledger price',
      detail: 'No AMM pool and no usable two-sided order book, so the peg cannot be read. Absence of a price is not a peg break.',
    });
  }
  return items;
}

function controlItems(input: PresentInput, th: Thresholds): PresentItem[] {
  const items: PresentItem[] = [];
  if (input.knownStatus === 'discontinued') {
    items.push({
      code: 'discontinued',
      tone: 'critical',
      label: 'Discontinued',
      detail: 'The issuer has publicly said this token is discontinued and not redeemable. Treat any on-ledger price as a market print only.',
    });
  }
  if (input.flags.globalFreeze) {
    items.push({
      code: 'global-freeze',
      tone: 'critical',
      label: 'Global Freeze on',
      detail: 'Global Freeze is on. The token cannot move between holders. Holders can generally only send it back to the issuer.',
    });
  }
  if (input.frozenLines > 0) {
    const share = input.circulating != null && input.circulating > 0 ? (input.frozenBalance / input.circulating) * 100 : null;
    if (share == null) {
      items.push({
        code: 'frozen-unknown',
        tone: 'warn',
        label: `Frozen lines (${input.frozenLines})`,
        detail: `${input.frozenLines} trust line(s) are individually frozen, and circulating supply was not available to weigh them. Those holders generally cannot send the token onward.`,
      });
    } else if (share > th.frozenCritSharePct) {
      items.push({
        code: 'frozen-majority',
        tone: 'critical',
        label: `Most supply frozen (${shareText(share)})`,
        detail: `${input.frozenLines} trust line(s) are individually frozen and hold ${shareText(share)} of circulating supply, over half. Those tokens cannot move freely.`,
      });
    } else if (share >= th.frozenDustSharePct) {
      items.push({
        code: 'frozen-supply',
        tone: 'warn',
        label: `Supply frozen (${shareText(share)})`,
        detail: `${input.frozenLines} trust line(s) are individually frozen and hold ${shareText(share)} of circulating supply. Those holders generally cannot send the token onward. This is an active freeze, not only a power the issuer retains.`,
      });
    } else {
      items.push({
        code: 'frozen-dust',
        tone: 'feature',
        kicker: 'Noted',
        label: `Frozen lines (${input.frozenLines}, ${shareText(share)} of supply)`,
        detail: `${input.frozenLines} trust line(s) are marked frozen and hold ${shareText(share)} of circulating supply. The legacy raw check still records this. The comparison does not treat an empty balance as an active supply freeze.`,
      });
    }
  }
  if (input.flags.allowTrustLineClawback) {
    items.push({
      code: 'clawback',
      tone: 'feature',
      label: 'Clawback enabled',
      detail: 'The issuer can pull tokens back from holders (allowTrustLineClawback). Some regulated issuers turn this on at launch and cannot turn it off. Holders do not have final control of the balance. This label does not say a clawback has happened, and it does not say the power is risk-free.',
    });
  }
  if (input.flags.requireAuthorization) {
    items.push({
      code: 'require-auth',
      tone: 'feature',
      label: 'Restricted access',
      detail: 'RequireAuth is on. The issuer must approve each trust line before it can hold tokens. Who can hold and transfer is limited to authorized accounts. This describes access rules. It is not a finding that a holder was harmed.',
    });
  }
  if (input.topHolderPct != null && input.topHolderPct >= th.concWarnPct) {
    const represented = input.tokenization === 'represented'
      ? ' On a represented (issuer-held) asset, one dominant holder is expected.'
      : '';
    items.push({
      code: 'concentration',
      tone: 'feature',
      label: `Concentrated holding (${input.topHolderPct.toLocaleString('en-US', { maximumFractionDigits: 1 })}%)`,
      detail: `The largest holder outside treasury and AMM pools has ${input.topHolderPct.toLocaleString('en-US', { maximumFractionDigits: 1 })}% of non-treasury supply. A large holder is most of the float and can move the on-ledger price.${represented} This is a structure fact, not an active freeze and not a peg grade.`,
    });
  }
  if (input.transferFeePct > 1) {
    items.push({
      code: 'transfer-fee',
      tone: 'feature',
      kicker: 'Noted',
      label: `Transfer fee ${input.transferFeePct.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`,
      detail: 'A transfer fee above 1% is charged when the token moves. Shown as a cost. It is not, by itself, an adverse event.',
    });
  }
  if (input.circulating != null && input.circulating <= 0) {
    items.push({
      code: 'no-supply',
      tone: 'feature',
      kicker: 'Noted',
      label: 'No circulating supply',
      detail: 'Circulating supply outside the issuer and known treasury wallets is zero. That is a supply reading, not a safety rating.',
    });
  }
  if (input.tokenization === 'represented') {
    items.push({
      code: 'represented',
      tone: 'feature',
      label: 'Represented asset',
      detail: 'This is an issuer-held record-keeping token, not a freely distributed retail token. A single holder and no public AMM are expected. That expectation is not a safety rating.',
    });
  }
  if (input.flags.noFreeze) {
    items.push({
      code: 'nofreeze',
      tone: 'measured',
      label: 'NoFreeze set',
      detail: 'The issuer has permanently given up the power to freeze trust lines, so Global Freeze cannot be turned on. This is an account setting only. It is not a backing guarantee.',
    });
  } else if (!input.flags.globalFreeze) {
    items.push({
      code: 'can-freeze',
      tone: 'feature',
      label: 'Can freeze lines',
      detail: 'NoFreeze is not set, so the issuer can still freeze individual trust lines. Keeping that power is common. It is not an active freeze, and it is not a statement that a future freeze would be harmless.',
    });
  }
  return items;
}

function identityItems(input: PresentInput): PresentItem[] {
  const items: PresentItem[] = [];
  if (input.knownStatus === 'unverified') {
    items.push({
      code: 'identity-conflict',
      tone: 'critical',
      label: 'Records conflict',
      detail: 'Public issuer records disagree with this account. The project the account points to does not list this issuer on its published token list or xrp-ledger.toml, so identity and backing could not be confirmed from those sources. That is conflicting evidence. It is not a fraud finding, and it does not by itself state that the token is unbacked.',
    });
  } else if (input.knownStatus === 'unconfirmed') {
    items.push({
      code: 'identity-unconfirmed',
      tone: 'gap',
      gapKind: 'not-confirmed',
      label: 'Issuer link not confirmed',
      detail: 'Third-party registries attribute this account to the named project, but the project publishes no xrp-ledger.toml or official page listing it. Nothing in this reading contradicts the link. Not confirmed is not a fraud finding.',
    });
  } else if (input.domainVerified === true) {
    items.push({
      code: 'identity-confirmed',
      tone: 'measured',
      label: 'Identity confirmed',
      detail: 'The issuer account is listed in its domain\'s xrp-ledger.toml, so the ledger and the website agree. That confirms the account link only. It is not a backing guarantee and it is not a safety rating.',
    });
  } else if (input.domainVerified === false) {
    items.push({
      code: 'identity-domain-gap',
      tone: 'gap',
      gapKind: 'not-confirmed',
      label: 'Domain not confirmed',
      detail: 'The on-ledger Domain is set, but that host\'s xrp-ledger.toml is missing or does not list this issuer. The domain claim is not confirmed. That is not the same as a project list that contradicts the account.',
    });
  } else {
    items.push({
      code: 'identity-no-domain',
      tone: 'gap',
      gapKind: 'not-confirmed',
      label: 'No domain claim',
      detail: 'The issuer sets no on-ledger Domain, so a two-way xrp-ledger.toml check was not possible. No claim is not a confirmed identity.',
    });
  }
  // A project-list conflict and a missing toml file are different observations. Show both.
  if (input.knownStatus === 'unverified' && input.domainVerified === false) {
    items.push({
      code: 'identity-domain-gap',
      tone: 'gap',
      gapKind: 'not-confirmed',
      label: 'Domain file not confirmed',
      detail: 'The host in the on-ledger Domain has no xrp-ledger.toml listing this issuer. A missing file is an unconfirmed domain claim. The records-conflict caution above is the separate fact that the project\'s own token list does not include this account.',
    });
  }
  return items;
}

function unread(status: Severity, kind: 'missing' | 'unread'): Presentation {
  const missing = kind === 'missing';
  const detail = missing
    ? 'The issuer account was not found on the ledger, so market and control readings were not taken.'
    : 'The issuer account could not be read this run, so these categories are not a measurement. This is not an adverse finding about the token.';
  const gap = (id: CategoryId, title: string, code: string): CategoryView =>
    category(id, title, [{ code, tone: 'gap', gapKind: 'not-measurable', label: 'Not read this run', detail }]);
  return {
    model: PRESENTATION_MODEL,
    legacyOverall: status,
    legacyNote: LEGACY_OVERALL_NOTE,
    marketFigures: 'Market data was not read this run.',
    categories: {
      market: gap('market', 'Market, liquidity and peg', 'market-unread'),
      controls: gap('controls', 'Issuer controls', 'controls-unread'),
      identity: category('identity', 'Identity and verification', [{
        code: missing ? 'issuer-missing' : 'issuer-unread',
        tone: missing ? 'critical' : 'gap',
        gapKind: missing ? undefined : 'not-confirmed',
        label: missing ? 'Issuer account not found' : 'Issuer not read this run',
        detail: missing
          ? 'The issuer account was not found on the ledger.'
          : 'The ledger query did not return the issuer this run. That is a missing reading, not a finding that the account is gone.',
      }]),
    },
  };
}

/** Classify one token for the comparison menu. Does not modify `status`. */
export function classify(input: PresentInput, thresholds: Thresholds = DEFAULT_THRESHOLDS): Presentation {
  if (input.ledgerRead === 'missing') return unread(input.status, 'missing');
  if (input.ledgerRead === 'unread') return unread(input.status, 'unread');
  return {
    model: PRESENTATION_MODEL,
    legacyOverall: input.status,
    legacyNote: LEGACY_OVERALL_NOTE,
    marketFigures: marketFigures(input, thresholds),
    categories: {
      market: category('market', 'Market, liquidity and peg', marketItems(input, thresholds)),
      controls: category('controls', 'Issuer controls', controlItems(input, thresholds)),
      identity: category('identity', 'Identity and verification', identityItems(input)),
    },
  };
}

/** Adapter from a live TokenReport. Reads structured fields; does not edit checks or status. */
export function presentFromReport(t: TokenReport, thresholds?: Thresholds): Presentation {
  const issuerMissing = t.checks.some(c => c.key === 'issuer' && c.severity === 'critical');
  const issuerUnread = !issuerMissing && t.checks.some(c => c.key === 'issuer' && c.severity === 'warn');
  const top = t.holders.topHolders.find(h => h.label !== 'AMM pool');
  const quoteAssets = (t.liquidity?.quoteAssets?.length
    ? t.liquidity.quoteAssets
    : t.pools.filter(p => p.exists && (p.tvlUsd ?? 0) > 0).map(p => p.counterAsset ?? '')).filter(q => q.length > 0);
  const liquidityUsd = t.liquidity?.totalUsd ?? t.pools.reduce((s, p) => s + (p.tvlUsd ?? 0), 0);
  return classify({
    ledgerRead: issuerMissing ? 'missing' : issuerUnread ? 'unread' : 'ok',
    status: t.status,
    knownStatus: t.knownStatus,
    tokenization: t.tokenization,
    domainVerified: t.domainVerified,
    flags: t.flags,
    peg: {
      referenceUsd: t.peg.referenceUsd,
      deviationPct: t.peg.deviationPct,
      reliable: t.peg.reliable,
    },
    liquidityUsd,
    quoteAssets,
    hasPool: t.pools.some(p => p.exists),
    spotUnsupported: t.spot.unsupported === true,
    frozenLines: t.holders.frozenLines,
    frozenBalance: t.holders.frozenBalance,
    circulating: t.supply.circulating,
    transferFeePct: t.transferFeePct,
    topHolderPct: top ? top.pct : null,
  }, thresholds);
}

export function itemsOf(p: Presentation): PresentItem[] {
  return [p.categories.market, p.categories.controls, p.categories.identity].flatMap(c => c.items);
}
