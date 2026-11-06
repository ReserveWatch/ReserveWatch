// Display copy for the comparison cards. Does not change presentation.ts labels,
// check severities, or TokenReport.status. The API still returns the full
// presentation object. These strings are only the scannable face of a card.
// Critical and caution sentences are rendered in an alert banner that callers
// must place outside any <details> element.

import type { TokenReport } from './monitor.js';
import {
  itemsOf, presentFromReport, DEFAULT_THRESHOLDS,
  type PresentItem, type PresentTone, type Thresholds,
} from './presentation.js';

export interface CardNav { href: string; name: string }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const usd0 = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
/** A 0–100 number safe to put in a CSS width. */
const pctWidth = (n: number) => {
  if (!Number.isFinite(n)) return '0';
  const c = Math.max(0, Math.min(100, n));
  return String(Math.round(c * 10) / 10);
};

export interface FaceFacts {
  liquidityUsd: number;
  hasPool: boolean;
  deviationPct: number | null;
  pegReliable: boolean;
  topHolderPct: number | null;
  quoteAssets: string[];
  lowLiqUsd: number;
  pegCritPct: number;
}

export function faceFacts(t: TokenReport, thresholds: Thresholds = DEFAULT_THRESHOLDS): FaceFacts {
  const top = t.holders.topHolders.find(h => h.label !== 'AMM pool');
  const quoteAssets = (t.liquidity?.quoteAssets?.length
    ? t.liquidity.quoteAssets
    : t.pools.filter(p => p.exists && (p.tvlUsd ?? 0) > 0).map(p => p.counterAsset ?? '')).filter(q => q.length > 0);
  return {
    liquidityUsd: t.liquidity?.totalUsd ?? t.pools.reduce((s, p) => s + (p.tvlUsd ?? 0), 0),
    hasPool: t.pools.some(p => p.exists),
    deviationPct: t.peg.deviationPct,
    pegReliable: t.peg.reliable,
    topHolderPct: top ? top.pct : null,
    quoteAssets,
    lowLiqUsd: thresholds.lowLiqUsd,
    pegCritPct: thresholds.pegCritPct,
  };
}

const TONE_WORD: Record<PresentTone, string> = {
  measured: 'Measured', feature: 'Feature', gap: 'Gap', warn: 'Caution', critical: 'Critical',
};

/** Short face text. The full item.label stays in the API and in the title tooltip. */
export function visibleLabel(item: PresentItem, facts: FaceFacts): string {
  const dev = facts.deviationPct;
  switch (item.code) {
    case 'liquidity-measured': return `${usd0(facts.liquidityUsd)} pool`;
    case 'liquidity-thin': return `Thin pool ${usd0(facts.liquidityUsd)}`;
    case 'liquidity-none': return 'No pool';
    case 'peg-near': return dev != null ? `Near spot ${signed(dev)}` : 'Near spot';
    case 'peg-warn': return dev != null ? `Off spot ${signed(dev)}` : 'Off spot';
    case 'peg-critical': return dev != null ? `Large peg gap ${signed(dev)}` : 'Large peg gap';
    case 'peg-not-measurable': return 'Peg not measurable';
    case 'peg-no-price': return 'No on-ledger price';
    case 'price-not-measured': return 'No spot reference';
    case 'clawback': return 'Clawback';
    case 'require-auth': return 'Restricted access';
    case 'concentration': return facts.topHolderPct != null
      ? `Concentrated ${facts.topHolderPct.toLocaleString('en-US', { maximumFractionDigits: 1 })}%` : 'Concentrated holding';
    case 'can-freeze': return 'Can freeze';
    case 'nofreeze': return 'NoFreeze set';
    case 'frozen-dust': return 'Frozen lines, ~0%';
    case 'global-freeze': return 'Global Freeze';
    case 'discontinued': return 'Discontinued';
    case 'represented': return 'Represented asset';
    case 'no-supply': return 'No circulating supply';
    case 'identity-confirmed': return 'Identity confirmed';
    case 'identity-conflict': return 'Records conflict';
    case 'identity-unconfirmed': return 'Link not confirmed';
    case 'identity-no-domain': return 'No domain claim';
    case 'issuer-missing': return 'Issuer not found';
    default: return item.label;
  }
}

function nominalNote(quotes: string[]): string {
  const stables = quotes.filter(q => q === 'RLUSD' || q === 'USDV');
  if (!stables.length) return '';
  return ` · ${stables.join(' and ')} at a nominal $1`;
}

export function marketHeadline(items: PresentItem[], facts: FaceFacts): string {
  return items.map(i => visibleLabel(i, facts)).join(' · ') + nominalNote(facts.quoteAssets);
}

function chip(item: PresentItem, facts: FaceFacts): string {
  const face = visibleLabel(item, facts);
  const tone = TONE_WORD[item.tone];
  return `<span class="chip tone-${item.tone}" title="${esc(item.detail)}" aria-label="${esc(tone)}: ${esc(face)}">${esc(face)}</span>`;
}

function liquidityMeter(facts: FaceFacts): string {
  if (!facts.hasPool) return '';
  const width = pctWidth((facts.liquidityUsd / facts.lowLiqUsd) * 100);
  const caption = `${usd0(facts.liquidityUsd)} pool. The bar fills at the ${usd0(facts.lowLiqUsd)} depth gate used before a peg is graded.`;
  return `<div class="meter" role="img" aria-label="${esc(caption)}"><span style="width:${width}%"></span></div><p class="meter-cap">${esc(caption)}</p>`;
}

function pegMeter(facts: FaceFacts): string {
  if (!facts.pegReliable || facts.deviationPct == null) return '';
  const half = facts.pegCritPct || 10;
  const left = pctWidth(((facts.deviationPct + half) / (half * 2)) * 100);
  const caption = `Reliable peg ${signed(facts.deviationPct)} versus spot. The scale is ±${half} percentage points. Inside 3 points is near spot. Not a safety rating.`;
  return `<div class="peg" role="img" aria-label="${esc(caption)}"><div class="peg-track"><span class="peg-mark" style="left:${left}%"></span></div></div><p class="meter-cap">${esc(caption)}</p>`;
}

function concentrationMeter(items: PresentItem[], facts: FaceFacts): string {
  if (facts.topHolderPct == null || !items.some(i => i.code === 'concentration')) return '';
  const width = pctWidth(facts.topHolderPct);
  const caption = `Largest holder is ${facts.topHolderPct.toLocaleString('en-US', { maximumFractionDigits: 1 })}% of non-treasury supply.`;
  return `<div class="meter conc" role="img" aria-label="${esc(caption)}"><span style="width:${width}%"></span></div><p class="meter-cap">${esc(caption)}</p>`;
}

function banner(items: PresentItem[]): string {
  const hot = items.filter(i => i.tone === 'critical' || i.tone === 'warn');
  if (!hot.length) return '';
  const crit = hot.some(i => i.tone === 'critical');
  return `<div class="alert-banner${crit ? '' : ' caution'}" role="note">${hot.map(i => `<p><span class="banner-k">${i.tone === 'critical' ? 'Critical' : 'Caution'}</span> ${esc(i.detail)}</p>`).join('')}</div>`;
}

function readings(items: PresentItem[], facts: FaceFacts, figures: string): string {
  const body = items.map(i => `<p><b>${esc(visibleLabel(i, facts))}.</b> ${esc(i.detail)}</p>`).join('') + `<p>${esc(figures)}</p>`;
  return `<details class="fold"><summary>Readings</summary><div class="fold-body">${body}</div></details>`;
}

/** Homepage and commodity card. The alert banner is before any details element. */
export function renderHomeCard(t: TokenReport, nav: CardNav, thresholds: Thresholds = DEFAULT_THRESHOLDS): string {
  const view = presentFromReport(t, thresholds);
  const facts = faceFacts(t, thresholds);
  const items = itemsOf(view);
  const edge = items.some(i => i.tone === 'critical') ? ' edge-critical' : items.some(i => i.tone === 'warn') ? ' edge-warn' : '';
  const pill = t.label ? `<span class="pill">${esc(t.label)}</span>` : '';
  const controls = view.categories.controls.items;
  const identity = view.categories.identity.items;
  return `<article class="token-card${edge}">
<header class="card-top"><div><h2><a href="/token/${esc(t.id)}">${esc(t.name)}</a>${pill}</h2><p class="card-sub">${esc(t.project)} · <a href="${esc(nav.href)}">${esc(nav.name)}</a></p></div><p class="supply"><b>${esc(t.supply.circulating == null ? '—' : Math.round(t.supply.circulating).toLocaleString('en-US'))}</b><span>${esc(t.displayCode)}</span></p></header>
${banner(items)}
<div class="groups">
<section class="group"><h3>Market</h3><p class="readout">${esc(marketHeadline(view.categories.market.items, facts))}</p>${liquidityMeter(facts)}${pegMeter(facts)}</section>
<section class="group"><h3>Controls</h3><div class="facts">${controls.map(i => chip(i, facts)).join('') || '<span class="muted">None read</span>'}</div>${concentrationMeter(controls, facts)}</section>
<section class="group"><h3>Identity</h3><div class="facts">${identity.map(i => chip(i, facts)).join('') || '<span class="muted">None read</span>'}</div></section>
</div>
<footer class="card-foot"><span class="legacy-mark legacy-${view.legacyOverall}" title="${esc(view.legacyNote)}">Legacy ${view.legacyOverall.toUpperCase()}</span>${readings(items, facts, view.marketFigures)}</footer>
</article>`;
}

/** Token page lead: banner, then the three groups. Explanations sit in details; the banner does not. */
export function renderDetailLead(t: TokenReport, thresholds: Thresholds = DEFAULT_THRESHOLDS): string {
  const view = presentFromReport(t, thresholds);
  const facts = faceFacts(t, thresholds);
  const items = itemsOf(view);
  const block = (title: string, inner: string, groupItems: PresentItem[]) => `<section class="panel"><h2>${title}</h2>${inner}<details class="fold"><summary>Explanation</summary><div class="fold-body">${groupItems.map(i => `<p><b>${esc(visibleLabel(i, facts))}.</b> ${esc(i.detail)}</p>`).join('') || '<p>Nothing classified.</p>'}</div></details></section>`;
  return `${banner(items)}<div class="panels">
${block('Market', `<p class="readout">${esc(marketHeadline(view.categories.market.items, facts))}</p>${liquidityMeter(facts)}${pegMeter(facts)}`, view.categories.market.items)}
${block('Controls', `<div class="facts">${view.categories.controls.items.map(i => chip(i, facts)).join('')}</div>${concentrationMeter(view.categories.controls.items, facts)}`, view.categories.controls.items)}
${block('Identity', `<div class="facts">${view.categories.identity.items.map(i => chip(i, facts)).join('')}</div>`, view.categories.identity.items)}
</div><p class="meter-cap">${esc(view.marketFigures)}</p>`;
}
