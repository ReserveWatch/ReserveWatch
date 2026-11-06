import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSnapshot, LOW_LIQ_USD, PEG_WARN_PCT, PEG_CRIT_PCT, CONC_WARN_PCT, MAX_SPREAD_PCT, type Snapshot, type TokenReport, type Severity } from './monitor.js';
import { processAlerts, readAlerts } from './alerts.js';
import { endpointList } from './xrplClient.js';
import { isTransient } from './xrplClient.js';
import { TOKENS, COMMODITY_META, commodityMeta } from './config/tokens.js';
import { CLASS_PAGES, GROUPS, type ClassPage } from './content/commodities.js';
import { SNAPSHOTS, type WeeklySnapshot, type SnapToken } from './content/snapshots.js';
import { BRIEFS, HOW_TO_ADD, type Brief } from './content/briefs.js';
import { LEARN_GUIDES, CLAWBACK_FAQ, type LearnGuide, type LearnCtx } from './content/learn.js';
import { seoHead, robotsTxt, sitemapXml, llmsTxt, orgLd, websiteLd, datasetLd, breadcrumbLd, faqPageLd, DEFAULT_DESCRIPTION, TAGLINE, SITE_URL, type SeoMeta } from './seo.js';
import { presentFromReport, PRESENTATION_MODEL, type PresentItem, type PresentTone } from './presentation.js';
import { renderDetailLead, renderHomeCard } from './face.js';

const PORT = Number(process.env.PORT || 3000);
const POLL_SEC = Number(process.env.POLL_INTERVAL_SEC || 300);
const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
// Static brand assets (logo, favicons). Resolved relative to this file so it works from src/ (tsx) and dist/ (node).
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'peakacademiccoaching1@gmail.com';
const SITE_NAME = 'ReserveWatch';
const LEGAL_UPDATED = 'October 31, 2026';
const LEGAL_UPDATED_ISO = '2026-10-31';
/** Explanatory copy for the comparison menu (methodology, FAQ, about). Legal pages that did not change keep LEGAL_UPDATED. */
const COMPARE_UPDATED = 'November 6, 2026';
const COMPARE_UPDATED_ISO = '2026-11-06';
// Optional privacy-friendly analytics (Plausible). Off unless PLAUSIBLE_DOMAIN is set, e.g. thereservewatch.com.
const PLAUSIBLE_DOMAIN = (process.env.PLAUSIBLE_DOMAIN || '').trim();
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

let snap: Snapshot | null = null;
let lastError: string | null = null;
let running = false;
let lastManualRefresh = 0;

// Serve the last saved snapshot immediately on boot (marked by its own updatedAt) instead of a blank page.
try { snap = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'latest.json'), 'utf8')); console.log(`[server] loaded cached snapshot from ${snap?.updatedAt}`); } catch { /* none yet */ }

async function refresh() {
  if (running) return; running = true;
  try {
    const s = await runSnapshot();
    if (!s.tokens.length) throw new Error('snapshot returned no tokens (XRPL endpoints unreachable?)');
    // If a token's issuer could not be read because of rate limits/timeouts, keep its last good reading (marked stale).
    const prev = snap;
    s.tokens = s.tokens.map(t => {
      const failed = (t.errors ?? []).some(e => e.startsWith('account_info:') && isTransient(e));
      const old = prev?.tokens.find(x => x.id === t.id && !(x.errors ?? []).some(e => e.startsWith('account_info:')));
      return failed && old ? { ...old, errors: [...(old.errors ?? []), `stale: kept reading from ${prev!.updatedAt} (${t.errors.join('; ')})`] } : t;
    });
    snap = s; lastError = null;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), JSON.stringify(s, null, 2));
    await processAlerts(s);
    console.log(`[monitor] snapshot ok: ${s.tokens.map(t => `${t.id}=${t.status}`).join(' ')} (${s.durationMs}ms)`);
  } catch (e) { lastError = (e as Error).message; console.error('[monitor] snapshot failed', e); }
  finally { running = false; }
}

// ---------- HTML helpers ----------
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fmt = (n: number | null | undefined, d = 2) => n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: d });
const usd = (n: number | null | undefined, d = 2) => n == null || !Number.isFinite(n) ? '—' : '$' + fmt(n, d);
const badge = (s: Severity) => `<span class="badge ${s}">${s.toUpperCase()}</span>`;
const acct = (a: string) => `<a href="https://xrpscan.com/account/${esc(a)}" target="_blank" rel="noopener"><code>${esc(a)}</code></a>`;

// ReserveWatch locked brand. Logo file is unchanged. Small gold text uses a darker gold so it stays readable on the paper background; #94801C remains the rule, border, and mark color.
const CSS = `:root{--rw-navy:#0B1F33;--rw-gold:#94801C;--rw-gold-ink:#5C4C0C;--rw-gold-wash:#F7F1E2;--rw-surface:#F3F0E8;--rw-card:#FFFcf8;--rw-text:#14202B;
--rw-muted:#4E5C6A;--rw-border:#E3DACA;--rw-ok:#145C38;--rw-ok-wash:#E6F3EC;--rw-warn:#7A5A10;--rw-critical:#8E2F24;--rw-gap:#3A4654;
--serif:Georgia,"Iowan Old Style",Palatino,"Palatino Linotype",serif;--sans:system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}
body{font-family:var(--sans);font-size:17px;line-height:1.5;margin:0;background:var(--rw-surface);color:var(--rw-text)}
.skip{position:absolute;left:12px;top:-40px;background:#fff;color:var(--rw-navy);padding:8px 12px;z-index:5;border-radius:8px}
.skip:focus{top:12px}
header{background:#fff;border-bottom:1px solid var(--rw-border)}
header .wrap,main,footer .wrap{max-width:1120px;margin:auto;padding-left:28px;padding-right:28px}
header .wrap{display:flex;align-items:center;justify-content:space-between;gap:20px 28px;padding-top:10px;padding-bottom:10px;flex-wrap:wrap}
header a{color:var(--rw-navy);text-decoration:none}
header .brand img{height:64px;width:auto;display:block}
header nav{display:flex;flex-wrap:wrap;gap:8px 18px}
header nav a{font-size:0.95rem;font-weight:650}
header nav a:hover{color:var(--rw-gold-ink)}
main{padding-top:36px;padding-bottom:64px}
h1,h2,.token-card h2{font-family:var(--serif);font-weight:500;letter-spacing:-0.02em;color:var(--rw-navy)}
h1{font-size:clamp(2rem,4.4vw,3.15rem);line-height:1.12;margin:0 0 .35em}
h2{font-size:1.55rem;margin:1.4em 0 .4em}
h3{margin:0 0 8px;font-family:var(--sans);font-size:0.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--rw-gold-ink);font-weight:750}
a{color:var(--rw-navy)}a:hover{color:var(--rw-gold-ink)}
a:focus-visible,summary:focus-visible,button:focus-visible{outline:2px solid var(--rw-gold);outline-offset:3px}
.lede{font-size:1.2rem;line-height:1.45;max-width:38rem;margin:0 0 1rem;color:var(--rw-navy)}
.asof{color:var(--rw-muted);font-size:0.92rem;margin:0 0 1.1rem}
.mast{margin-bottom:8px}
.legend-row{list-style:none;display:flex;flex-wrap:wrap;gap:8px 18px;padding:0;margin:0 0 8px}
.legend-row li{display:flex;align-items:baseline;gap:8px;font-weight:650;color:var(--rw-navy)}
.legend-row li span{font-weight:450;color:var(--rw-muted)}
.swatch{width:11px;height:11px;border-radius:99px;display:inline-block;position:relative;top:1px;flex:none}
.swatch.tone-measured{background:var(--rw-ok)}.swatch.tone-feature{background:var(--rw-navy)}.swatch.tone-gap{background:#fff;border:1.5px dashed var(--rw-gap)}.swatch.tone-critical{background:var(--rw-critical)}
.commodities{display:flex;flex-wrap:wrap;gap:8px 16px;margin:18px 0 26px}
.commodities a{font-weight:650;text-decoration:none;border-bottom:1px solid transparent}
.commodities a:hover{border-bottom-color:var(--rw-gold);color:var(--rw-gold-ink)}
.board{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:18px;margin:0 0 28px}
.token-card{background:var(--rw-card);border:1px solid var(--rw-border);border-radius:18px;padding:22px 22px 14px;display:flex;flex-direction:column;gap:14px;min-width:0}
.token-card.edge-critical{border-top:4px solid var(--rw-critical)}
.token-card.edge-warn{border-top:4px solid var(--rw-warn)}
.card-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.card-top>div:first-child{flex:1;min-width:0}
.supply{flex:none}
.token-card h2{font-size:1.55rem;line-height:1.15;margin:0;overflow-wrap:break-word}
.token-card h2 a{text-decoration:none}
.card-sub{margin:.35em 0 0;color:var(--rw-muted);font-size:.92rem}
.supply{margin:0;text-align:right;font-variant-numeric:tabular-nums}
.supply b{display:block;font-size:1.35rem;color:var(--rw-navy);font-weight:650}
.supply span{color:var(--rw-muted);font-size:.85rem}
.groups{display:flex;flex-direction:column;gap:12px}
.readout{margin:0;font-size:1.02rem;color:var(--rw-navy);font-weight:600}
.facts{display:flex;flex-wrap:wrap;gap:6px}
.chip{display:inline-block;margin:0;padding:3px 9px;border-radius:999px;font-size:.84rem;font-weight:650;line-height:1.35;max-width:100%}
.chip .kicker{font-weight:750;margin-right:4px}
.tone-measured{background:var(--rw-ok-wash);color:var(--rw-ok);border:1px solid #B7D7C6}
.tone-feature{background:#F6F3EC;color:var(--rw-navy);border:1px solid var(--rw-border)}
.tone-gap{background:#F4F6F8;color:var(--rw-gap);border:1px dashed #8B97A4}
.tone-warn{background:var(--rw-warn);color:#fff;border:1px solid var(--rw-warn)}
.tone-critical{background:var(--rw-critical);color:#fff;border:1px solid var(--rw-critical)}
.meter{height:8px;background:#E4DCCB;border-radius:99px;margin-top:10px;overflow:hidden}
.meter>span{display:block;height:100%;background:var(--rw-navy);border-radius:99px}
.meter.conc>span{background:var(--rw-gold)}
.meter-cap{margin:.4em 0 0;color:var(--rw-muted);font-size:.8rem;line-height:1.4}
.peg-track{position:relative;height:10px;margin-top:12px;background:#E4DCCB;border-radius:99px}
.peg-mark{position:absolute;top:-4px;width:3px;height:18px;background:var(--rw-navy);border-radius:2px;transform:translateX(-1px)}
.card-foot{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--rw-border);padding-top:10px;margin-top:auto}
.legacy-mark{font-weight:750;font-size:.78rem;letter-spacing:.06em;background:none;color:var(--rw-muted)}
.legacy-ok{color:var(--rw-ok)}.legacy-warn{color:var(--rw-warn)}.legacy-critical{color:var(--rw-critical)}
.alert-banner{background:var(--rw-critical);color:#fff;border-radius:12px;padding:12px 14px;margin:0 0 4px}
.alert-banner.caution{background:var(--rw-warn)}
.alert-banner p{margin:0 0 8px;font-size:1rem;line-height:1.4}
.alert-banner p:last-child{margin:0}
.banner-k{display:inline-block;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;font-weight:800;margin-right:6px}
.panels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:8px 0 18px}
.panel{background:var(--rw-card);border:1px solid var(--rw-border);border-radius:16px;padding:18px 18px 12px;min-width:0}
.panel h2{font-family:var(--sans);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;font-weight:750;color:var(--rw-gold-ink);margin:0 0 10px}
.fold{margin:8px 0}
.fold summary{cursor:pointer;font-weight:650;color:var(--rw-navy)}
.fold-body{padding:8px 0 2px}
.fold-body p{margin:0 0 8px}
.crumb{margin:0 0 6px;font-size:.92rem}
.stats{margin-top:8px}
table{border-collapse:collapse;width:100%;margin:8px 0;font-variant-numeric:tabular-nums}
.table-wrap{overflow-x:auto;max-width:100%}
th,td{padding:10px 12px;border-bottom:1px solid var(--rw-border);text-align:left;vertical-align:top;font-size:.92rem}
th{color:var(--rw-navy);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;font-weight:750}
code{font-size:.82rem}
.kv{min-width:0}
.scrollcode{display:block;max-width:100%;overflow-x:auto;white-space:nowrap}
.badge{padding:2px 8px;border-radius:999px;font-size:.75rem;font-weight:750;color:#fff}
.ok{background:var(--rw-ok);color:#fff}.warn{background:var(--rw-warn);color:#fff}.critical{background:var(--rw-critical);color:#fff}
.muted{color:var(--rw-muted);font-size:.92rem}
.card{background:var(--rw-card);border:1px solid var(--rw-border);border-radius:16px;padding:18px;margin:16px 0}
.pill{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;font-size:.72rem;font-weight:750;letter-spacing:.03em;color:var(--rw-navy);background:var(--rw-gold-wash);border:1px solid #E4D7B0;vertical-align:middle;font-family:var(--sans)}
.notice{background:transparent;border:0;border-left:3px solid var(--rw-gold);padding:2px 0 2px 14px;margin:14px 0;color:var(--rw-navy)}
footer{border-top:1px solid var(--rw-border);background:#fff;margin-top:12px}
footer .wrap{padding-top:22px;padding-bottom:28px;font-size:.9rem;color:var(--rw-muted)}
footer nav{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:12px}
footer nav a{font-weight:650;text-decoration:none}
.legal{max-width:42rem}.legal p,.legal li{line-height:1.6}
.legal-wide{max-width:none}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px 18px}
.kv b{display:block;color:var(--rw-gold-ink);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;font-weight:750;margin-bottom:3px}
.fail{color:var(--rw-critical)}
@media(max-width:720px){
header .wrap,main,footer .wrap{padding-left:16px;padding-right:16px}
header .brand img{height:52px;width:auto}
main{padding-top:24px}
.card-top{flex-direction:column}
.supply{text-align:left}
.panels{grid-template-columns:1fr}
.token-card,.panel{padding:16px}
}`

interface PageOpts extends SeoMeta { body: string; /** Auto-refresh live-data pages for open browser tabs. */ refresh?: boolean }
const page = (o: PageOpts) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${o.refresh ? '<meta http-equiv="refresh" content="60">' : ''}${seoHead(o)}<meta name="theme-color" content="#0B1F33">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">${PLAUSIBLE_DOMAIN ? `<script defer data-domain="${esc(PLAUSIBLE_DOMAIN)}" src="https://plausible.io/js/script.js"></script>` : ''}<style>${CSS}</style></head><body>
<a class="skip" href="#content">Skip to content</a>
<header><div class="wrap"><a href="/" class="brand"><img src="/logo.png" alt="ReserveWatch — XRPL Commodity Reserve Health Monitor" width="441" height="96"></a><nav aria-label="Primary"><a href="/commodities">Commodities</a><a href="/methodology">Methodology</a><a href="/snapshots">Snapshots</a><a href="/faq">FAQ</a><a href="/about">About</a></nav></div></header>
<main id="content">${o.body}</main>
<footer><div class="wrap"><nav><a href="/about">About</a><a href="/independent">Independence</a><a href="/commodities">Commodities</a><a href="/methodology">Methodology</a><a href="/snapshots">Weekly snapshots</a><a href="/briefs">Briefs</a><a href="/learn">Learn</a><a href="/faq">FAQ</a><a href="/alerts">Alerts</a><a href="/disclaimer">Disclaimer</a><a href="/terms">Terms of use</a><a href="/privacy">Privacy</a><a href="/contact">Contact</a><a href="/api/tokens">API</a></nav>
<p>Public XRPL readings, plus a spot price for gold, silver, platinum, and palladium. Not investment advice and not proof of reserves. RLUSD and USDV are valued at a nominal $1. Measured is not a safety rating. <a href="/disclaimer">Disclaimer</a>.</p>
<p>© ${new Date().getFullYear()} ${SITE_NAME}. <a href="/independent">Independent</a>; not affiliated with Ripple, the XRPL Foundation, or any token issuer listed. Ledger: ${esc(endpointList()[0])}.</p></div></footer></body></html>`;

function header(): string {
  if (!snap) return `<div class="card">${lastError ? `Snapshot error: ${esc(lastError)}` : 'Loading first snapshot from XRPL… refresh in a few seconds.'}</div>`;
  const src = snap.xrpUsdSource;
  const shortSrc = src.includes(' AMM ') ? src.slice(0, src.indexOf(' AMM ') + 4) : src;
  return `<p class="asof">Updated <b>${esc(snap.updatedAt)}</b> · XRP/USD ${usd(snap.xrpUsd, 4)} · <span title="${esc(src)}">${esc(shortSrc)}</span>${lastError ? ` · <strong class="fail">refresh failed: ${esc(lastError)}</strong>` : ''}</p>`;
}

const labelPill = (t: { label?: string }) => t.label ? `<span class="pill" title="Shown for transparency; not an endorsement or an allegation">${esc(t.label)}</span>` : '';

const KICKER: Record<PresentTone, string> = {
  measured: 'Measured', feature: 'Feature', gap: 'Gap', warn: 'Caution', critical: 'Critical',
};
const chipKicker = (it: PresentItem) => it.kicker ?? (it.tone === 'gap' ? (it.gapKind === 'not-confirmed' ? 'Not confirmed' : 'Not measurable') : KICKER[it.tone]);
const chip = (it: PresentItem) => `<span class="chip tone-${it.tone}" title="${esc(it.detail)}" aria-label="${esc(chipKicker(it))}: ${esc(it.label)}">${esc(it.label)}</span>`;
const chips = (items: PresentItem[]) => items.map(chip).join('') || '<span class="muted">—</span>';

function viewOf(t: TokenReport) {
  return presentFromReport(t);
}

function listPage() {
  const cards = (snap?.tokens ?? []).map(t => renderHomeCard(t, { href: `/commodities/${commodityMeta(t.metal).slug}`, name: commodityMeta(t.metal).title })).join('');
  return page({
    title: 'Compare XRPL Commodity Tokens: Controls, Liquidity, Verification · ReserveWatch',
    description: DEFAULT_DESCRIPTION, path: '/', refresh: true,
    jsonLd: [orgLd(CONTACT_EMAIL), websiteLd(), datasetLd(snap?.updatedAt)],
    body: `<div class="mast"><h1>Compare XRPL commodity tokens</h1>
<p class="lede">Issuer controls, liquidity, and public verification. Public ledger readings, not a buy or sell list.</p>
${header()}
<ul class="legend-row">
<li><i class="swatch tone-measured" aria-hidden="true"></i> Measured <span>a reading, not a safety rating</span></li>
<li><i class="swatch tone-feature" aria-hidden="true"></i> Feature <span>an issuer power</span></li>
<li><i class="swatch tone-gap" aria-hidden="true"></i> Gap <span>not confirmed, or not measurable</span></li>
<li><i class="swatch tone-critical" aria-hidden="true"></i> Critical <span>an active problem, always on the card</span></li>
</ul>
<details class="fold"><summary>What the labels mean</summary><div class="fold-body">
<p><b>Measured</b> means the reading could be taken: pool depth at or above about $${n0(LOW_LIQ_USD)}, a reliable price within ${PEG_WARN_PCT}% of spot, or an issuer listed in its own xrp-ledger.toml. It is not proof of backing.</p>
<p><b>Feature</b> means clawback, restricted access, a concentrated holder, or the ability to freeze a line. It says what holders are exposed to. It is not an adverse event, and it is not risk-free.</p>
<p><b>Gap</b> means the data is missing. No pool is not a broken peg. An unconfirmed issuer link is not a fraud finding.</p>
<p><b>Caution and Critical</b> are only for an active problem or conflicting records: Global Freeze, a discontinued token, a reliable peg at least ${PEG_WARN_PCT}% from spot, supply that is actually frozen, or issuer records that disagree with the account. Those lines stay on the card. They are not accusations.</p>
<p>Legacy OK / WARN / CRITICAL is the older worst raw check. A feature or a gap still makes it WARN. It remains the API <code>status</code> field. <a href="/methodology">Full rules</a> · <a href="/disclaimer">disclaimer</a>.</p>
<p>RLUSD and USDV are valued at a nominal $1. That is the issuer-stated peg, not a reserve check. USDV is not graded as a commodity.</p>
</div></details></div>
${classStrip()}
<div class="board">${cards || '<p class="muted">No tokens in this reading yet.</p>'}</div>
<p class="muted">Today: ${esc(trackedClassList())}. Other classes are explained under Commodities until a public issuer can be confirmed. JSON: <a href="/api/tokens">/api/tokens</a> (<code>status</code> and <code>checks</code> unchanged; <code>presentation</code> is model ${PRESENTATION_MODEL}).</p>` });
}

const METAL_NAME: Record<string, string> = Object.fromEntries(Object.entries(COMMODITY_META).map(([k, v]) => [k, v.name]));
/** Commodity classes that have at least one tracked token, in COMMODITY_META order. */
const trackedClasses = () => Object.keys(COMMODITY_META).filter(c => TOKENS.some(t => t.metal === c));
const trackedClassList = () => { const n = trackedClasses().map(c => commodityMeta(c).name); return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}` : n.join(''); };
function classStrip(): string {
  const links = CLASS_PAGES.filter(p => classTokens(p).length).map(p => `<a href="/commodities/${p.slug}">${esc(p.h1.replace(/^Tokenized /, '').replace(/ on the XRP Ledger$/, ''))}</a>`).join('') + '<a href="/commodities">All classes</a>';
  return `<nav class="commodities" aria-label="Commodities">${links}</nav>`;
}
type TokenMeta = { id: string; name: string; displayCode: string; metal: string };
const tokenTitle = (t: TokenMeta) => `${t.name}${t.name.includes(t.displayCode) ? '' : ` (${t.displayCode})`} on XRPL — controls, liquidity, verification · ReserveWatch`;
const priceVsSpotPhrase = (t: TokenMeta) => commodityMeta(t.metal).spotSymbol ? 'price vs spot' : 'on-ledger price';
const tokenDescription = (t: TokenMeta) => `Compare ${t.name} (${t.displayCode}), a ${METAL_NAME[t.metal] ?? t.metal} token on the XRP Ledger: issuer controls, AMM liquidity, ${priceVsSpotPhrase(t)} and public verification. Measured facts are not a safety rating. Not investment advice.`;

function tokenPage(t: TokenReport) {
  const flagRows = ['globalFreeze', 'noFreeze', 'allowTrustLineClawback', 'requireAuthorization', 'disableMasterKey', 'defaultRipple', 'depositAuth']
    .map(k => `<tr><td>${k}</td><td>${t.flags[k] === undefined ? '—' : t.flags[k] ? '<b>true</b>' : 'false'}</td></tr>`).join('');
  const poolRows = t.pools.map(p => p.exists
    ? `<tr><td>${esc(p.pair)}</td><td>${acct(p.account!)}</td><td>${fmt(p.tokenAmount, 4)} ${esc(t.displayCode)} / ${fmt(p.counterAmount, 4)} ${esc(p.counterAsset)}</td><td>${usd(p.tvlUsd)}</td><td>${usd(p.impliedUsdPerToken, 4)}</td><td>${fmt(p.tradingFeePct, 3)}%</td></tr>`
    : `<tr><td>${esc(p.pair)}</td><td colspan="5" class="muted">No pool (${esc(p.error)})</td></tr>`).join('');
  const bookRows = t.books.map(b => `<tr><td>${esc(b.pair)}</td><td>${usd(b.bestBidUsd, 4)} <span class="muted">(${b.fundedBids ?? b.bidCount}/${b.bidCount} funded)</span></td><td>${usd(b.bestAskUsd, 4)} <span class="muted">(${b.fundedAsks ?? b.askCount}/${b.askCount} funded)</span></td><td>${b.spreadPct == null ? '—' : fmt(b.spreadPct, 1) + '%'}</td></tr>`).join('');
  const holderRows = t.holders.topHolders.map(h => `<tr><td>${acct(h.account)}${h.label ? ` <span class="muted">(${esc(h.label)})</span>` : ''}</td><td>${fmt(h.balance, 4)}</td><td>${fmt(h.pct, 2)}%</td></tr>`).join('');
  const checks = t.checks.map(c => `<tr><td>${badge(c.severity)}</td><td>${esc(c.key)}</td><td>${esc(c.message)}</td></tr>`).join('');
  return page({
    title: tokenTitle(t), description: tokenDescription(t), path: `/token/${t.id}`, refresh: true,
    jsonLd: [breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Commodities', path: '/commodities' }, { name: commodityMeta(t.metal).title, path: `/commodities/${commodityMeta(t.metal).slug}` }, { name: t.name, path: `/token/${t.id}` }])],
    body: `<p class="crumb"><a href="/commodities/${esc(commodityMeta(t.metal).slug)}">${esc(commodityMeta(t.metal).title)}</a></p>
<h1>${esc(t.name)}${labelPill(t)}</h1>
<p class="asof">${fmt(t.supply.circulating, 0)} ${esc(t.displayCode)} circulating · ${fmt(t.holders.nonZero, 0)} holders · Legacy <span class="legacy-mark legacy-${t.status}">${t.status.toUpperCase()}</span> · <a href="/methodology">how labels differ</a></p>
${header()}
${renderDetailLead(t)}
<div class="card stats grid">
<div class="kv"><b>Issuer</b><span class="scrollcode">${acct(t.issuer)}</span></div>
<div class="kv"><b>Currency code</b><span class="scrollcode"><code>${esc(t.currency)}</code> (${esc(t.displayCode)})</span></div>
<div class="kv"><b>Commodity class</b><a href="/commodities/${esc(commodityMeta(t.metal).slug)}">${esc(commodityMeta(t.metal).title)}</a>${t.tokenization === 'represented' ? '<div class="muted">represented asset (issuer-held record)</div>' : ''}</div>
<div class="kv"><b>Unit</b>${t.gramsPerToken > 0 ? `1 token = ${fmt(t.gramsPerToken, 4)} g ${esc(METAL_NAME[t.metal] ?? t.metal)}` : esc(t.unitText ?? 'Not published by the issuer')}</div>
<div class="kv"><b>Domain (on-ledger)</b>${esc(t.domain ?? '—')}<div class="muted">${t.domainVerified === true ? '✔ verified via xrp-ledger.toml' : t.domainVerified === false ? '✖ not verified' : 'no domain claim'}</div></div>
<div class="kv"><b>Raw obligations</b>${fmt(t.supply.rawObligations, 4)}</div>
<div class="kv"><b>Treasury excluded</b>${fmt(t.supply.treasury, 4)}</div>
<div class="kv"><b>Circulating</b>${fmt(t.supply.circulating, 4)} ${esc(t.displayCode)}</div>
<div class="kv"><b>Implied value @ spot</b>${usd(t.supply.circulating != null && t.spot.usdPerToken != null ? t.supply.circulating * t.spot.usdPerToken : null, 0)}</div>
<div class="kv"><b>Spot ${esc(METAL_NAME[t.metal] ?? t.metal)}</b>${t.spot.unsupported ? `<span class="muted">No public spot reference used for ${esc(METAL_NAME[t.metal] ?? t.metal)} — price vs spot not measured</span>` : `${usd(t.spot.usdPerOz)}/${esc(t.spot.unitLabel ?? commodityMeta(t.metal).unitLabel)} → ${usd(t.spot.usdPerToken)}/token<div class="muted">${esc(t.spot.source)}</div>`}</div>
<div class="kv"><b>On-ledger price</b>${usd(t.peg.referenceUsd, 4)} <div class="muted">${esc(t.peg.source ?? 'none')}</div></div>
<div class="kv"><b>Peg deviation</b>${t.peg.deviationPct == null ? '—' : t.peg.reliable ? fmt(t.peg.deviationPct, 2) + '%' : `<span class="muted">not meaningful (raw ${fmt(t.peg.deviationPct, 1)}%)</span>`}${t.peg.note ? `<div class="muted">${esc(t.peg.note)}</div>` : ''}</div>
<div class="kv"><b>Transfer fee</b>${fmt(t.transferFeePct, 3)}%</div>
<div class="kv"><b>Trust lines / holders</b>${fmt(t.holders.trustlines, 0)} / ${fmt(t.holders.nonZero, 0)}</div>
<div class="kv"><b>Frozen lines</b>${fmt(t.holders.frozenLines, 0)} (${fmt(t.holders.frozenBalance, 4)} tokens)</div>
<div class="kv"><b>Ledger</b>${esc(t.ledgerIndex ?? '—')}</div>
</div>
<details class="fold"><summary>Raw automated checks</summary><div class="fold-body">
<p class="muted">These severities are the legacy model. They are not relabeled. One WARN still makes the legacy overall WARN, including a feature or a gap. The comparison above is a separate reading of the same facts. Historical snapshots keep the legacy labels they were published with.</p>
<div class="table-wrap"><table>${checks}</table></div></div></details>
<details class="fold"><summary>Issuer control flags</summary><div class="fold-body"><div class="table-wrap"><table><tr><th>Flag</th><th>Value</th></tr>${flagRows}</table></div></div></details>
<details class="fold"><summary>Pools, order book, and holders</summary><div class="fold-body">
<h3>AMM pools</h3><p class="muted">Pools against XRP, RLUSD and USDV (Valtorum USD) are read and added together for depth${t.liquidity ? ` — total ${usd(t.liquidity.totalUsd, 0)}${t.liquidity.quoteAssets.length ? ` via ${esc(t.liquidity.quoteAssets.join(' + '))}` : ''}` : ''}. RLUSD and USDV are valued at a nominal $1; the on-ledger price is TVL-weighted across live pools.</p><div class="table-wrap"><table><tr><th>Pair</th><th>AMM account</th><th>Reserves</th><th>TVL</th><th>Implied $/token</th><th>Fee</th></tr>${poolRows}</table></div>
<h3>DEX order book</h3><div class="table-wrap"><table><tr><th>Pair</th><th>Best bid</th><th>Best ask</th><th>Spread</th></tr>${bookRows}</table></div>
<h3>Top holders, excluding treasury</h3><div class="table-wrap"><table><tr><th>Account</th><th>Balance</th><th>% of non-treasury</th></tr>${holderRows}</table></div>
</div></details>
<details class="fold"><summary>Notes</summary><div class="fold-body"><ul>${t.notes.map(n => `<li>${esc(n)}</li>`).join('')}${t.website ? `<li>Issuer info: <a href="${esc(t.website)}" target="_blank" rel="noopener">${esc(t.website)}</a></li>` : ''}</ul></div></details>
${t.errors.length ? `<h3>Fetch errors</h3><ul>${t.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
<p class="muted">JSON: <a href="/api/tokens/${esc(t.id)}">/api/tokens/${esc(t.id)}</a> · More ${esc(METAL_NAME[t.metal] ?? t.metal)} tokens: <a href="/commodities/${esc(commodityMeta(t.metal).slug)}">${esc(commodityMeta(t.metal).title)} on XRPL</a> · <a href="/methodology">How checks work</a></p>` });
}

// ---------- Legal / info pages (plain-language; not legal advice — have counsel review before relying on them) ----------
const legalPage = (title: string, path: string, description: string, html: string, updated = LEGAL_UPDATED) => page({
  title: `${title} · ReserveWatch`, description, path,
  body: `<div class="legal"><h1>${esc(title)}</h1><p class="muted">Last updated ${updated}</p>${html}</div>` });
const mail = () => `<a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>`;

const DISCLAIMER = `
<p><b>${SITE_NAME} publishes automated readings of public XRP Ledger data. It is not investment, financial, legal, accounting, or tax advice, and it is not a recommendation to buy, sell, or hold any token.</b></p>
<ul>
<li><b>On-ledger data only.</b> Supply, holders, issuer flags, AMM pools, and order books come from public XRPL servers. Spot prices for gold, silver, platinum and palladium come from a public third-party price API; other commodity classes are not compared with a spot price. ${SITE_NAME} does not audit, inspect, or attest to any vault, custodian, or reserve, and on-ledger supply is not proof of reserves.</li>
<li><b>Labels are automated readings, not recommendations.</b> The comparison separates measured facts, issuer features (such as clawback or restricted access), and information gaps from active problems. The legacy "OK", "WARN", and "CRITICAL" overall is the worst raw check. A measured reading is not a statement that a token is safe or fully backed. None of these are credit ratings, buy or sell signals, opinions on solvency, or statements about anyone's conduct.</li>
<li><b>No endorsement, no accusation.</b> Listing a token does not mean ${SITE_NAME} endorses it. "Records conflict" means the project's published list does not include the account. "Issuer link not confirmed" means the project has not published a listing. Neither is an allegation of fraud or of anyone's conduct.</li>
<li><b>Accuracy.</b> Data can be delayed, incomplete, or wrong (for example when public servers or the price API are unavailable). Always confirm with the issuer's own documentation and an independent explorer before acting.</li>
<li><b>Independence.</b> ${SITE_NAME} is independent and is not affiliated with Ripple, the XRPL Foundation, or any issuer shown. Trademarks and token names belong to their owners and are used only to identify the tokens.</li>
<li><b>Your risk.</b> Digital assets can lose all value. You are responsible for your own decisions; consider speaking with a licensed professional.</li>
</ul>
<p>Issuers who believe a reading is wrong can reach us at ${mail()}; see <a href="/contact">Contact</a>.</p>`;

const TERMS = `
<p>By using ${SITE_NAME} (the website and its JSON API) you agree to these terms. If you do not agree, please do not use the site.</p>
<ol>
<li><b>Informational service.</b> The site provides automated, informational readings of public blockchain data as described in the <a href="/disclaimer">Disclaimer</a>. Nothing on the site is an offer, solicitation, or advice of any kind.</li>
<li><b>No warranty.</b> The site and data are provided "as is" and "as available", without warranties of any kind, express or implied, including accuracy, completeness, availability, or fitness for a particular purpose.</li>
<li><b>Limitation of liability.</b> To the fullest extent permitted by law, ${SITE_NAME} and its operators are not liable for any loss or damage arising from use of, or reliance on, the site or its data.</li>
<li><b>Acceptable use.</b> Do not attempt to disrupt the service, bypass rate limits, or overload it with automated requests. Reasonable use of the public JSON API is welcome; please cache responses and attribute "${SITE_NAME}" when you republish readings.</li>
<li><b>Third-party links and data.</b> Links to explorers, issuers, and other sites are for convenience. We do not control and are not responsible for third-party content.</li>
<li><b>No accounts, no wallets.</b> The site never asks for wallet seeds, private keys, or payments. Anyone asking for them in our name is not us.</li>
<li><b>Changes.</b> We may update the site, its checks, or these terms at any time; the "last updated" date above will change when we do.</li>
</ol>
<p>Questions about these terms: ${mail()}.</p>`;

const CONTACT = `
<p>Email: ${mail()}</p>
<ul>
<li><b>Issuers and projects:</b> to correct a reading, confirm which XRPL issuer accounts are yours, or have an "Unverified listing" reviewed, please include the issuer address and a link to your official documentation or <code>xrp-ledger.toml</code>.</li>
<li><b>Data or bug reports:</b> include the token page URL and what you expected to see.</li>
<li><b>Press and partnerships:</b> general inquiries welcome.</li>
</ul>
<p class="muted">We never ask for seeds, private keys, or payments by email. We aim to reply within a few business days.</p>`;

// ---------- Methodology / About (plain language; describes the real rules in monitor.ts) ----------
const n0 = (n: number) => n.toLocaleString('en-US');
const METHODOLOGY = () => `
<p class="notice"><b>Short version:</b> ${SITE_NAME} reads public data from the XRP Ledger and compares each commodity token it tracks (today ${trackedClassList()}) on three questions: what the market shows, what the issuer can do, and whether public records confirm the account. It is <b>not an audit</b>, <b>not proof of reserves</b>, and <b>not investment advice</b>. Nothing on the comparison is a buy or no-buy rating.</p>

<h2>The comparison</h2>
<p>The home page, each token page, and each commodity page lead with three categories. Every fact in a category keeps its own label. A missing measurement does not hide a measured fact, and an issuer power is not painted as an active problem.</p>
<ul>
<li><b>Market, liquidity and peg.</b> Whether an AMM pool exists, how much value it holds, and — only when that pool is deep enough — how far the on-ledger price sits from spot.</li>
<li><b>Issuer controls.</b> Powers and structure: clawback, RequireAuth, the ability to freeze, holder concentration, and whether a freeze is actually on.</li>
<li><b>Identity and verification.</b> Whether the issuer's own website lists the account, whether a project link is simply unpublished, or whether the project's records disagree with the account.</li>
</ul>
<h3>What the labels mean</h3>
<ul>
<li><span class="chip tone-measured"><span class="kicker">Measured</span></span> — a reading we could take. Examples: AMM liquidity at or above about $${n0(LOW_LIQ_USD)}, a reliable price within ${PEG_WARN_PCT}% of spot, two-way confirmation in <code>xrp-ledger.toml</code>, or NoFreeze set. <b>Measured is not "safe"</b> and not a backing guarantee. It means this particular fact was observed.</li>
<li><span class="chip tone-feature"><span class="kicker">Feature</span></span> — an issuer power or holder structure that is on: clawback, restricted access (RequireAuth), a concentrated holder, or the retained ability to freeze lines. The chip explains the holder implication. It is not an adverse event. It is also not risk-free. A few measured non-events use the same neutral style with the kicker <b>Noted</b> (frozen lines that hold none of the supply, a transfer fee above 1%, zero circulating supply).</li>
<li><span class="chip tone-gap"><span class="kicker">Not measurable</span></span> or <span class="chip tone-gap"><span class="kicker">Not confirmed</span></span> — the data is missing. <b>No pool is not a broken peg.</b> A thin pool is not a graded peg break. <b>An unconfirmed issuer link is not a fraud finding.</b> A domain file that does not list the account is not the same thing as a project token list that leaves the account out.</li>
<li><span class="chip tone-warn"><span class="kicker">Caution</span></span> and <span class="chip tone-critical"><span class="kicker">Critical</span></span> — reserved for a specific active problem or for conflicting public records. They are not accusations of conduct.</li>
</ul>
<h3>What is allowed to show Caution or Critical</h3>
<ul>
<li><b>Critical — Global Freeze is on</b>, so the token cannot move between holders.</li>
<li><b>Critical — Discontinued.</b> The issuer has publicly said the token is not redeemable.</li>
<li><b>Critical — Issuer account not found</b> on the ledger.</li>
<li><b>Critical — Most of the supply is frozen</b> on individual trust lines (more than half of circulating).</li>
<li><b>Caution — a measurable slice of supply is frozen</b> (more than a dust balance, up to half). Lines that hold about none of the supply stay Noted, and the raw check below still records them.</li>
<li><b>Caution or Critical — a reliable peg gap.</b> Only when AMM pools hold at least about $${n0(LOW_LIQ_USD)}. From ${PEG_WARN_PCT}% up to ${PEG_CRIT_PCT}% is Caution. ${PEG_CRIT_PCT}% or more is Critical. A large raw print from a thin pool is <b>not measurable</b>, not Critical.</li>
<li><b>Critical — records conflict.</b> The project's published token list or <code>xrp-ledger.toml</code> does not include the account the issuer points at. Identity and backing could not be confirmed from those sources. That is conflicting evidence. It is not a fraud finding, and it does not by itself state that the token is unbacked.</li>
</ul>
<p>The rules live in <code>src/presentation.ts</code> (model <code>${PRESENTATION_MODEL}</code>). Thresholds are the same constants the raw checks use (<code>LOW_LIQUIDITY_USD</code>, <code>PEG_WARN_PCT</code>, <code>PEG_CRIT_PCT</code>, <code>CONCENTRATION_WARN_PCT</code>). The comparison does not invent prices, supplies, or issuers.</p>

<h2>Legacy overall: OK, WARN, CRITICAL</h2>
<p>Each token still gets the raw checks in the table at the bottom of its page. Every check is marked ${badge('ok')}, ${badge('warn')} or ${badge('critical')}. The <b>legacy overall</b> is the <b>worst</b> of those checks. One WARN check makes the legacy overall WARN, even when the comparison calls that same fact a feature or a gap. One CRITICAL check makes it CRITICAL.</p>
<p>That overall is what <code>/api/tokens</code> returns as <code>status</code>, what the <a href="/alerts">alert log</a> follows, and what <a href="/snapshots">weekly snapshots</a> and dated <a href="/briefs">briefs</a> were published with. This change does not rewrite those severities and does not relabel a past snapshot. The comparison is an added <code>presentation</code> object on the live JSON. Old clients that read only <code>status</code> and <code>checks</code> see the same aggregate as before.</p>
<ul>
<li>${badge('ok')} — none of the raw checks tripped. It does <b>not</b> mean the token is safe, fully backed, or a good buy.</li>
<li>${badge('warn')} — a raw check tripped. On the comparison, that same fact may be a feature (clawback, concentration), a gap (no pool, peg not measurable, issuer link not confirmed), or a real caution (a reliable peg gap, a material freeze).</li>
<li>${badge('critical')} — a raw check for an active limit or for conflicting issuer records. The comparison shows that same fact as Critical.</li>
</ul>
<h3>Raw checks that still make the legacy overall CRITICAL</h3>
<ul>
<li><b>Unverified listing.</b> The issuer account does not appear on the published token list of the project it points to, so we could not confirm who issued it.</li>
<li><b>Discontinued.</b> The issuer has publicly said the token is discontinued (no longer redeemable).</li>
<li><b>Issuer account not found</b> on the ledger.</li>
<li><b>Global Freeze is on</b>, which means the token cannot move between holders.</li>
<li><b>More than half</b> of the circulating supply sits in individually frozen trust lines.</li>
<li><b>Price far from spot:</b> the on-ledger price is ${PEG_CRIT_PCT}% or more away from the spot metal price, measured from an AMM pool deep enough to trust (see below).</li>
</ul>
<h3>Raw checks that still make the legacy overall WARN</h3>
<p>These severities are unchanged. The comparison reads the same facts and may label them Feature, Noted, or Not measurable / Not confirmed instead of a warning badge. The raw row is still WARN, so the legacy overall stays WARN.</p>
<ul>
<li><b>Issuer link unconfirmed.</b> Third-party registries attribute the account to a project, but the project publishes no <code>xrp-ledger.toml</code> or official page listing it. (Different from "Unverified listing", where the project's own list contradicts the account.)</li>
<li><b>Clawback is enabled</b> — the issuer can take tokens back from holders. This is WARN, not CRITICAL, because some regulated issuers use it on purpose.</li>
<li>Some trust lines are individually frozen (but 50% of supply or less).</li>
<li>The issuer's website (the on-ledger Domain) does not confirm the issuer in its <code>xrp-ledger.toml</code> file.</li>
<li>A transfer fee above 1%.</li>
<li>No circulating supply outside the issuer and its known treasury wallets.</li>
<li>No AMM pool against XRP, RLUSD or USDV, or pools holding less than about $${n0(LOW_LIQ_USD)} in total.</li>
<li>The price is ${PEG_WARN_PCT}% or more (but under ${PEG_CRIT_PCT}%) from spot, or the price <b>cannot be measured</b> at all.</li>
<li>The spot metal price could not be loaded, or the commodity has no public spot reference (oil, energy, diamonds, crops and similar), so price vs spot is not measured.</li>
<li>One holder (not counting the issuer, treasury, or AMM pools) owns ${CONC_WARN_PCT}% or more of the supply.</li>
</ul>
<h3>Raw checks shown as OK for context</h3>
<p>Some facts are listed as OK on the raw table because they are normal and useful to know: the issuer can still freeze lines, holders must be authorized (RequireAuth), the master key is disabled, a small transfer fee, a verified domain, and a price within ${PEG_WARN_PCT}% of spot. The comparison still shows RequireAuth as a <b>Feature</b> (restricted access) and a verified domain as <b>Measured</b> (identity confirmed). An OK raw check is not a safety rating.</p>

<h2>XRPL basics: trust lines, freeze and clawback</h2>
<ul>
<li><b>Trust line.</b> On the XRP Ledger, you must open a "trust line" to an issuer before you can hold its token. The issuer's total outstanding tokens are the sum of all those lines. We subtract balances held by the issuer's known treasury wallets to get <b>circulating supply</b>.</li>
<li><b>Freeze.</b> An issuer can freeze one holder's trust line, or turn on a <b>Global Freeze</b> that stops the token from moving for everyone. Issuers can give up this power forever by setting <b>NoFreeze</b>. "Deep freeze" is a stricter version for single lines.</li>
<li><b>Clawback.</b> If the issuer turned on <code>allowTrustLineClawback</code>, it can pull tokens back out of a holder's account. This can be used for legal or compliance reasons, but it means holders do not have final control of their balance.</li>
<li><b>RequireAuth.</b> The issuer must approve each trust line before it can hold tokens.</li>
</ul>
<p>These are settings on the issuer's account. We read them directly from the ledger; we do not judge why an issuer chose them.</p>

<h2 id="peg">How peg vs spot is measured</h2>
<ol>
<li><b>Spot price.</b> For gold, silver, platinum and palladium we load the spot price per troy ounce from a public price API, then convert it to a price per token using how many grams each token claims to represent. Other commodities (oil, natural gas, electricity, uranium, copper, diamonds, timber, crops) have no single public spot price that maps onto a token, so we do not compare them with spot — their pages say "price vs spot not measured" rather than guess. Each <a href="/commodities">commodity page</a> explains why.</li>
<li><b>On-ledger price.</b> We look at the token's AMM pools against XRP, RLUSD and USDV (Valtorum USD — many Assetiko pairs trade against it) and add their depth together. The price is a TVL-weighted average across the live pools, so deeper pools count more, and the token page names which pools contributed. RLUSD and USDV are valued at a nominal $1 each; we do not check those stablecoins' own reserves, and USDV is never graded as a commodity. If there is no AMM pool, we look at the DEX order book and use the middle of the best bid and best ask, but only if the gap between them is ${MAX_SPREAD_PCT}% or less.</li>
<li><b>Deviation.</b> We compare the two: how many percent above or below spot the on-ledger price is.</li>
</ol>
<h3>When the peg cannot be measured</h3>
<p>A small pool can show a price far from spot simply because nobody has traded it back into line. That is not the same as a broken peg. So we only <b>grade</b> the deviation when the price comes from an AMM pool holding at least about $${n0(LOW_LIQ_USD)}. A DEX order book mid-price is never treated as reliable, because we do not measure its depth.</p>
<p>In those cases the comparison says <b>Peg not measurable</b> (a gap, not a Caution or Critical). The raw check still reads "Peg not measurable" and is still ${badge('warn')}, which can make the legacy overall WARN. The same gap is used when there is no pool and no usable two-sided order book, or when the spot price is unavailable. No pool is not a broken peg.</p>
<p>Even a reliable reading only says what the token <i>trades</i> for on the ledger. It says nothing about whether metal, or any other commodity, exists in a vault or warehouse.</p>
<h3>Represented assets</h3>
<p>Some commodity tokens (for example energy and diamond collections) are what RWA.xyz calls <b>represented</b> assets: record-keeping tokens held on the issuer's own platform, often by one inventory account, rather than tokens sold to the public. For these, a single dominant holder and no AMM pool are expected. We still run every check and show the result; the token page marks the asset as represented.</p>

<h2>What "Unverified listing" means — and does not mean</h2>
<p><b>It means:</b> public records disagree. The issuer account points to a project, but that project's published token list does not include this issuer. Identity and backing could not be confirmed from those sources. The comparison shows this as <span class="chip tone-critical"><span class="kicker">Critical</span>Records conflict</span>. The raw check is still CRITICAL, so the legacy overall stays CRITICAL.</p>
<p><b>"Issuer link unconfirmed" is different.</b> Third-party registries attribute the account to a project, but the project publishes no page or <code>xrp-ledger.toml</code> listing it. Nothing in our reading contradicts the link. The comparison shows <span class="chip tone-gap"><span class="kicker">Not confirmed</span>Issuer link not confirmed</span>. The raw check is still WARN. Not confirmed is not a fraud finding.</p>
<p><b>Neither label</b> is an accusation, a solvency opinion, or a statement that a token is unbacked. A token without the label is not thereby safe or fully backed. If you run the issuer, <a href="/contact">contact us</a> with proof and we will review the listing.</p>
<p>A domain file that is missing is its own gap ("Domain not confirmed"). It is not, by itself, the records-conflict caution. Longer explainer: <a href="/learn/unverified-listings">what the labels mean</a>. Peg details: <a href="/learn/peg-vs-spot">peg vs spot</a>. Terms: <a href="/learn/glossary">glossary</a>.</p>

<h2>Where the data comes from and how often</h2>
<p>All ledger data comes from public XRPL mainnet servers (account info, gateway balances, trust lines, AMM info and order books). We refresh about every ${Math.round(POLL_SEC / 60)} minutes. When a token's label changes, the change and its reasons are saved in the <a href="/alerts">alert log</a>. The raw readings are free as JSON at <a href="/api/tokens">/api/tokens</a>. Data can be late, missing or wrong if a server or the price API has problems.</p>

<h2>What this is not</h2>
<ul>
<li><b>Not an audit.</b> We do not visit, inspect or verify any vault, custodian, or bank account.</li>
<li><b>Not proof of reserves.</b> On-ledger supply shows how many tokens exist, not how much metal or other commodity backs them.</li>
<li><b>Not investment advice.</b> Comparison labels and the legacy overall are not ratings, recommendations, or opinions on solvency. Do your own research and confirm with the issuer and an independent explorer. See the full <a href="/disclaimer">disclaimer</a>.</li>
</ul>
<p>Short answers to common questions are on the <a href="/faq">FAQ</a>.</p>`;

const ABOUT = () => `
<p><b>${SITE_NAME} is an independent, issuer-neutral XRPL commodity reserve monitor.</b> It reads public XRP Ledger data for tokens that say they represent a commodity — today ${trackedClassList()} — and compares issuer controls, liquidity, and public verification. The legacy OK / WARN / CRITICAL overall is still published, separately, as the worst raw check.</p>

<h2>What it watches</h2>
<p>Right now ${SITE_NAME} tracks ${TOKENS.length} commodity tokens on the XRP Ledger:</p>
<ul>${TOKENS.map(t => `<li><a href="/token/${esc(t.id)}">${esc(t.name)}</a> <span class="muted">— ${esc(METAL_NAME[t.metal] ?? t.metal)}${t.label ? ` · ${esc(t.label)}` : ''}</span></li>`).join('')}</ul>
<p>Every other commodity class — palladium, oil, natural gas, uranium, copper, timber, wheat, soybeans, corn, cotton and more — has a plain-language <a href="/commodities">commodity page</a> that says honestly whether any public XRPL issuer exists yet. We add a token only when we can confirm its issuer account on XRPL mainnet.</p>
<p>For each one it shows circulating supply, issuer control settings (freeze, clawback, authorization), AMM pool liquidity, DEX order books, on-ledger price compared with spot price (metals only), holder concentration, and whether the issuer's website confirms the issuer. How each check works is explained on the <a href="/methodology">methodology</a> page.</p>

<h2>What it does not do</h2>
<ul>
<li>It does <b>not</b> audit vaults or custodians, and it is <b>not</b> proof of reserves.</li>
<li>It does <b>not</b> give investment, financial, legal or tax advice, and it does not tell anyone to buy, sell or hold a token.</li>
<li>It does <b>not</b> endorse or accuse any issuer. Listing a token is not an endorsement.</li>
<li>It does <b>not</b> hold funds, run wallets, or ask for seeds, private keys or payments.</li>
</ul>

<h2>Independence</h2>
<p>${SITE_NAME} is not affiliated with Ripple, the XRPL Foundation, or any token issuer it lists. The same rules apply to every token. Read the one-page summary: <a href="/independent">what ReserveWatch is — and is not</a>.</p>

<h2>Contact</h2>
<p>Issuers, data users and press can reach us at ${mail()}. See the <a href="/contact">contact page</a> for what to include with a correction or verification request.</p>`;

const INDEPENDENT = () => `
<p class="notice"><b>${SITE_NAME} is an independent ${TAGLINE.toLowerCase()}.</b> We read public XRP Ledger data about commodity tokens and explain what it shows, in plain language. We are <b>not a custodian, not an issuer, not a vault auditor, and not investment advice.</b></p>

<h2>What we are</h2>
<ul>
<li><b>A monitor.</b> We check public ledger facts for gold, silver, platinum and other commodity tokens: supply, issuer settings, liquidity and price, and whether the issuer's website confirms the issuer.</li>
<li><b>Independent.</b> We are not affiliated with Ripple, the XRPL Foundation, Valtorum, or any token issuer we list. No issuer pays for a listing or a label.</li>
<li><b>Even-handed.</b> The same published rules apply to every token. You can read every rule on the <a href="/methodology">methodology</a> page.</li>
</ul>

<h2>What we are not</h2>
<ul>
<li><b>Not a custodian.</b> We never hold tokens, metal, cash or keys. We will never ask for a seed phrase, private key or payment.</li>
<li><b>Not an issuer.</b> We do not create, sell, redeem or market any token.</li>
<li><b>Not a vault auditor.</b> We do not visit or inspect vaults, warehouses or bank accounts. On-ledger supply shows how many tokens exist — it is not proof of reserves.</li>
<li><b>Not investment advice.</b> Comparison labels and the legacy OK / WARN / CRITICAL overall are automated readings of ledger checks. They are not ratings, recommendations, or opinions on anyone's solvency or conduct. Measured does not mean safe.</li>
</ul>

<h2>How we stay useful</h2>
<ul>
<li>Every reading comes from public XRPL servers you can check yourself, and the raw data is free at <a href="/api/tokens">/api/tokens</a>.</li>
<li>When we cannot confirm something, we say "not confirmed" or "not measurable" rather than guess. A missing pool is not shown as a broken peg. An unpublished issuer link is not shown as records that conflict. A label is not an allegation.</li>
<li>Issuers can send corrections or proof through the <a href="/contact">contact page</a>; changes follow the same rules for everyone.</li>
</ul>

<h2>Read more</h2>
<ul>
<li><a href="/methodology">Methodology</a> — how each check and label works.</li>
<li><a href="/disclaimer">Disclaimer</a> — the full limits of what this data means.</li>
<li><a href="/about">About ${SITE_NAME}</a> — what we watch and how to reach us.</li>
</ul>`;

const INDEPENDENT_DESC = 'ReserveWatch is an independent XRPL commodity reserve health monitor: not a custodian, not an issuer, not a vault auditor, and not investment advice. What that means, in plain language.';

const infoPage = (title: string, h1: string, path: string, description: string, html: string, updated = LEGAL_UPDATED) => page({
  title, description, path, ogType: 'article',
  jsonLd: [breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: h1, path }])],
  body: `<div class="legal"><h1>${esc(h1)}</h1><p class="muted">Last updated ${updated}</p>${html}</div>` });

// ---------- Privacy (honest description of what the site actually does) ----------
const PRIVACY = () => `
<p class="notice"><b>Short version:</b> ${SITE_NAME} has no accounts, no wallets, no sign-up and no login cookies. Our host keeps normal server logs. ${PLAUSIBLE_DOMAIN ? 'We count page views in aggregate with Plausible Analytics, which uses no cookies.' : 'Website analytics are currently <b>off</b>.'} We do not sell personal data.</p>

<h2>What this site is</h2>
<p>${SITE_NAME} is a public, read-only website and JSON API that shows automated readings of public XRP Ledger data for commodity tokens. You do not need an account. We never ask for wallet seeds, private keys, or payments, and we do not set cookies to log anyone in.</p>

<h2>What we collect today</h2>
<ul>
<li><b>Server access logs.</b> Like almost every website, our hosting provider (Fly.io) and our app record basic request details: IP address, browser user-agent, the page or API path requested, the time, and the response status. We use these logs to keep the site running, fix errors, and stop abuse. They are kept only as long as our host retains them and are not used to build profiles of people.</li>
<li><b>Public API use.</b> Requests to <a href="/api/tokens">/api/tokens</a> are logged the same way. No API key is required, so we do not know who you are unless you tell us.</li>
<li><b>Email.</b> If you write to us, we receive your email address and message and use them only to reply.</li>
</ul>

<h2>Analytics</h2>
${PLAUSIBLE_DOMAIN
  ? `<p>We use <a href="https://plausible.io/data-policy" target="_blank" rel="noopener">Plausible Analytics</a> to count visits in aggregate (for example, how many people viewed a page and which site sent them). Plausible does not use cookies, does not build personal profiles, and does not track you across other websites. It does not store your IP address; it uses a daily rotating, anonymous identifier to count unique visitors. We see only totals. You can read how it works in <a href="https://plausible.io/data-policy" target="_blank" rel="noopener">Plausible's data policy</a>. Blocking the script (for example with a content blocker) does not affect how the site works.</p>`
  : `<p>Website analytics are <b>off</b> right now. No analytics script loads on any page. If we turn analytics on later, we plan to use a privacy-friendly, cookie-free service (Plausible Analytics) that counts page views in aggregate only, and we will update this page with the date and the details before or when it goes live.</p>`}

<h2>Cookies</h2>
<p>${SITE_NAME} does not set cookies for logins, ads, or tracking. ${PLAUSIBLE_DOMAIN ? 'Our analytics provider is cookie-free.' : ''}</p>

<h2>Sharing and selling</h2>
<ul>
<li>We do <b>not</b> sell or rent personal data.</li>
<li>We do not run ads or ad-tracking pixels.</li>
<li>Service providers that help run the site (our host${PLAUSIBLE_DOMAIN ? ' and analytics provider' : ''}) process data only to provide that service. We may disclose information if the law requires it.</li>
</ul>

<h2>Third-party links</h2>
<p>Token pages link to block explorers (such as XRPScan) and issuer websites. Those sites have their own privacy policies; we do not control them.</p>

<h2>Your choices and requests</h2>
<p>To ask what we hold about you, or to ask us to delete it, email ${mail()} with "Privacy" in the subject. We aim to reply within a few business days. We do not knowingly collect data from children.</p>

<h2>Changes</h2>
<p>If we change how the site handles data (for example, turning analytics on), we will update this page and the "last updated" date above.</p>`;

// ---------- Weekly ledger snapshots (frozen copies of the live feed; see src/content/snapshots.ts) ----------
const snapPath = (s: WeeklySnapshot) => `/snapshots/${s.week}`;
const longDate = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const etTime = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET';
const SEV_ORDER: Severity[] = ['critical', 'warn', 'ok'];
const snapNo = (s: WeeklySnapshot) => SNAPSHOTS.length - SNAPSHOTS.indexOf(s);
const snapQuotes = (s: WeeklySnapshot) => s.quoteAssets ?? ['XRP', 'RLUSD'];
const orList = (xs: string[]) => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}` : xs.join('');
const snapTitle = (s: WeeklySnapshot) => `XRPL Commodity Token Ledger Snapshot #${snapNo(s)} — ${longDate(s.week)} · ReserveWatch`;
const snapDescription = (s: WeeklySnapshot) => {
  const c = (v: Severity) => s.tokens.filter(t => t.status === v).length;
  return `Ledger snapshot #${snapNo(s)}: on-ledger health readings for ${s.tokens.length} commodity tokens on the XRP Ledger (${longDate(s.week)}): ${c('critical')} CRITICAL, ${c('warn')} WARN, ${c('ok')} OK, with the reasons, liquidity and peg readings. Automated data, not advice.`;
};

function snapshotHighlights(s: WeeklySnapshot): string[] {
  const names = (ts: SnapToken[]) => ts.map(t => `<a href="/token/${esc(t.id)}">${esc(t.name)}</a>`).join(', ');
  const out: string[] = [];
  const pooled = s.tokens.filter(t => t.hasPool);
  const deep = pooled.filter(t => t.ammTvlUsd >= LOW_LIQ_USD);
  const noPool = s.tokens.filter(t => !t.hasPool);
  out.push(deep.length
    ? `${deep.length} token(s) had AMM pools holding at least $${n0(LOW_LIQ_USD)}: ${names(deep)}.`
    : `<b>No token had an AMM pool holding $${n0(LOW_LIQ_USD)} or more.</b> ${pooled.length ? `The pools that do exist are small: ${pooled.map(t => `<a href="/token/${esc(t.id)}">${esc(t.name)}</a> ~${usd(t.ammTvlUsd, 0)}`).join(', ')}.` : ''}`);
  if (noPool.length) out.push(`${noPool.length} of ${s.tokens.length} tokens had no AMM pool against ${orList(snapQuotes(s))} at all: ${names(noPool)}.`);
  const reliable = s.tokens.filter(t => t.pegReliable);
  out.push(reliable.length
    ? `A reliable peg reading was possible for ${reliable.map(t => `<a href="/token/${esc(t.id)}">${esc(t.name)}</a> (${fmt(t.pegRawPct, 2)}% vs spot)`).join(', ')}. Every other token shows "Peg not measurable" or "not measured" — see <a href="/learn/peg-vs-spot">peg vs spot explained</a>.`
    : `<b>No token had a measurable peg in this snapshot.</b> Every on-ledger price came from a pool or order book too thin or too wide to compare fairly with spot, so the raw check says "Peg not measurable" and was recorded as WARN. That is a missing measurement, not a graded peg break and not a sign the metal is missing — see <a href="/methodology#peg">how peg is measured</a>.`);
  const gf = s.tokens.filter(t => t.globalFreeze);
  if (gf.length) out.push(`Global Freeze was on for ${names(gf)} — the token cannot move between holders.`);
  const cb = s.tokens.filter(t => t.clawback);
  if (cb.length) out.push(`Clawback was enabled for ${cb.length} token(s): ${names(cb)}. The issuer can take tokens back from holders. This archived page still counts that inside the legacy WARN aggregate. The live comparison lists clawback as an issuer-control feature, not as an active adverse event. <a href="/learn/clawback-freeze-trust-lines">What clawback means</a>.`);
  const fl = s.tokens.filter(t => (t.frozenLines ?? 0) > 0);
  if (fl.length) out.push(`Some individual trust lines were frozen on ${fl.map(t => `<a href="/token/${esc(t.id)}">${esc(t.name)}</a> (${t.frozenLines})`).join(', ')}; in each case the frozen balance was about 0% of circulating supply.`);
  const dv = s.tokens.filter(t => t.domainVerified === true);
  if (dv.length) out.push(`${dv.length} issuer(s) were confirmed by their own website's <code>xrp-ledger.toml</code>: ${names(dv)}.`);
  const unv = s.tokens.filter(t => t.label);
  for (const lbl of [...new Set(unv.map(t => t.label!))]) {
    const ts = unv.filter(t => t.label === lbl);
    out.push(`${ts.length > 3 ? `${ts.length} tokens` : names(ts)} carried the "${esc(lbl)}" label: ${lbl === 'Issuer link unconfirmed' ? 'the project they are attributed to does not publish an <code>xrp-ledger.toml</code> or official page listing the issuer, so we could not confirm the link from the issuer itself' : 'we could not match the issuer to the project it references'}. That is not an allegation of wrongdoing. <a href="/learn/unverified-listings">What the labels mean</a>.`);
  }
  return out;
}

function snapshotChanges(s: WeeklySnapshot, prev: WeeklySnapshot | undefined): string {
  if (!prev) return `<p>This is the <b>first</b> snapshot, so there is no earlier one to compare against. It sets the baseline. The <a href="/alerts">alert log</a> showed no label changes this week: every token was recorded once, at its current label, when monitoring restarted on October 30, 2026. The next snapshot lists which tokens improved or worsened and why.</p>`;
  const rank: Record<Severity, number> = { ok: 0, warn: 1, critical: 2 };
  const link = (t: { id: string; name: string }) => `<a href="/token/${esc(t.id)}">${esc(t.name)}</a>`;
  const pct = (a: number | null, b: number | null) => a && b != null ? ((b - a) / a) * 100 : null;
  const labelRows: string[] = [], detailRows: string[] = [], added: SnapToken[] = [];
  for (const t of s.tokens) {
    const p = prev.tokens.find(x => x.id === t.id);
    if (!p) { added.push(t); continue; }
    const was = new Set(p.checks.filter(c => c.severity !== 'ok').map(c => c.key));
    const now = new Set(t.checks.filter(c => c.severity !== 'ok').map(c => c.key));
    const msg = (m: string) => esc(m.replace(/\.\s*$/, ''));
    const newIssues = t.checks.filter(c => c.severity !== 'ok' && !was.has(c.key)).map(c => msg(c.message));
    const cleared = p.checks.filter(c => c.severity !== 'ok' && !now.has(c.key)).map(c => msg(c.message));
    if (p.status !== t.status) {
      const dir = rank[t.status] > rank[p.status] ? 'worsened' : 'improved';
      labelRows.push(`<li>${link(t)} ${dir}: ${badge(p.status)} → ${badge(t.status)}.${newIssues.length ? ` New: ${newIssues.join('; ')}.` : ''}${cleared.length ? ` Cleared: ${cleared.join('; ')}.` : ''}</li>`);
      continue;
    }
    const bits: string[] = [];
    if (cleared.length) bits.push(`cleared ${cleared.length} issue${cleared.length === 1 ? '' : 's'} (${cleared.join('; ')})`);
    if (newIssues.length) bits.push(`new issue${newIssues.length === 1 ? '' : 's'}: ${newIssues.join('; ')}`);
    if (!p.hasPool && t.hasPool) bits.push(`AMM liquidity now read at ${usd(t.ammTvlUsd, 0)} (was: no pool counted)`);
    else if (p.hasPool && t.hasPool && Math.abs(t.ammTvlUsd - p.ammTvlUsd) >= 1) bits.push(`AMM TVL ${usd(p.ammTvlUsd, 0)} → ${usd(t.ammTvlUsd, 0)}`);
    if (!p.pegReliable && t.pegReliable) bits.push(`peg now measurable: ${fmt(t.pegRawPct, 2)}% vs spot`);
    else if (p.pegReliable && !t.pegReliable) bits.push('peg no longer measurable');
    else if (p.pegReliable && t.pegReliable) bits.push(`peg ${fmt(p.pegRawPct, 2)}% → ${fmt(t.pegRawPct, 2)}%`);
    const sc = pct(p.circulating, t.circulating);
    if (sc != null && Math.abs(sc) >= 0.01) bits.push(`circulating supply ${fmt(p.circulating, 2)} → ${fmt(t.circulating, 2)} ${esc(t.displayCode)} (${sc > 0 ? '+' : ''}${fmt(sc, 2)}%)`);
    if (p.holders != null && t.holders != null && p.holders !== t.holders) bits.push(`holders ${fmt(p.holders, 0)} → ${fmt(t.holders, 0)}`);
    if ((p.frozenLines ?? 0) !== (t.frozenLines ?? 0)) bits.push(`frozen trust lines ${fmt(p.frozenLines, 0)} → ${fmt(t.frozenLines, 0)}`);
    for (const [k, nm] of [['clawback', 'clawback'], ['globalFreeze', 'Global Freeze'], ['noFreeze', 'NoFreeze'], ['requireAuth', 'RequireAuth']] as const)
      if (p[k] !== t[k]) bits.push(`${nm} ${p[k] ? 'on' : 'off'} → ${t[k] ? 'on' : 'off'}`);
    if (bits.length) detailRows.push(`<li>${link(t)} (still ${badge(t.status)}): ${bits.join('; ')}.</li>`);
  }
  const removed = prev.tokens.filter(p => !s.tokens.some(t => t.id === p.id));
  const since = `the <a href="${snapPath(prev)}">${longDate(prev.week)} snapshot</a>`;
  let html = `<h3>Label changes</h3>` + (labelRows.length ? `<ul>${labelRows.join('')}</ul>` : `<p>No previously tracked token changed its overall label since ${since}.</p>`);
  if (detailRows.length) html += `<h3>Other on-ledger changes</h3><p class="muted">Supply, liquidity, peg and flag changes for tokens whose overall label stayed the same. Tiny rounding-level supply moves are left out.</p><ul>${detailRows.join('')}</ul>`;
  if (added.length) {
    const c = (v: Severity) => added.filter(t => t.status === v).length;
    html += `<h3>Newly tracked tokens (${added.length})</h3><p>${c('critical')} CRITICAL, ${c('warn')} WARN, ${c('ok')} OK at first reading.</p><ul>${added.map(t => `<li>${link(t)} <span class="muted">— ${esc(METAL_NAME[t.metal] ?? t.metal)} · ${fmt(t.circulating, 2)} ${esc(t.displayCode)} circulating · ${fmt(t.holders, 0)} holder${t.holders === 1 ? '' : 's'}</span> ${badge(t.status)}${t.label ? `<span class="pill">${esc(t.label)}</span>` : ''}</li>`).join('')}</ul>`;
  }
  if (removed.length) html += `<h3>No longer tracked</h3><ul>${removed.map(t => `<li>${link(t)}</li>`).join('')}</ul>`;
  return html;
}

function snapshotPage(s: WeeklySnapshot) {
  const i = SNAPSHOTS.indexOf(s); const prev = SNAPSHOTS[i + 1]; const next = i > 0 ? SNAPSHOTS[i - 1] : undefined;
  const count = (v: Severity) => s.tokens.filter(t => t.status === v).length;
  const groups = SEV_ORDER.map(sev => {
    const ts = s.tokens.filter(t => t.status === sev);
    if (!ts.length) return `<h3>${badge(sev)} (0)</h3><p class="muted">No tokens at this label in this snapshot.</p>`;
    return `<h3>${badge(sev)} (${ts.length} token${ts.length === 1 ? '' : 's'})</h3>` + ts.map(t => {
      const why = t.checks.filter(c => c.severity !== 'ok');
      return `<div class="card"><b><a href="/token/${esc(t.id)}">${esc(t.name)}</a></b> <span class="muted">${esc(METAL_NAME[t.metal] ?? t.metal)} · ${esc(t.displayCode)}</span>${t.label ? `<span class="pill">${esc(t.label)}</span>` : ''}
<div class="muted">Circulating ${fmt(t.circulating, 2)} ${esc(t.displayCode)} · ${fmt(t.holders, 0)} holder${t.holders === 1 ? '' : 's'} · AMM TVL ${t.hasPool ? usd(t.ammTvlUsd, 0) : 'no pool'} · clawback ${t.clawback ? '<b>on</b>' : 'off'} · global freeze ${t.globalFreeze ? '<b>on</b>' : 'off'}</div>
${why.length ? `<p style="margin:8px 0 0"><b>Why:</b></p><ul>${why.map(c => `<li>${badge(c.severity)} ${esc(c.message)}</li>`).join('')}</ul>` : '<p class="muted">No checks raised an issue.</p>'}</div>`;
    }).join('');
  }).join('');
  const table = s.tokens.map(t => `<tr><td><a href="/token/${esc(t.id)}">${esc(t.name)}</a></td><td>${badge(t.status)}</td><td>${fmt(t.circulating, 2)}</td><td>${usd(t.spotUsdPerToken)}</td><td>${t.hasPool ? usd(t.ammTvlUsd, 0) : '<span class="muted">none</span>'}</td><td>${t.pegReliable ? fmt(t.pegRawPct, 2) + '%' : '<span class="muted">not measurable</span>'}</td><td>${t.clawback ? 'yes' : 'no'}</td><td>${t.globalFreeze ? '<b>yes</b>' : 'no'}</td></tr>`).join('');
  const title = `Ledger snapshot #${snapNo(s)}: ${longDate(s.week)}`;
  return page({
    title: snapTitle(s), description: snapDescription(s), path: snapPath(s), ogType: 'article',
    jsonLd: [
      breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Weekly snapshots', path: '/snapshots' }, { name: `Snapshot #${snapNo(s)} — ${longDate(s.week)}`, path: snapPath(s) }]),
      { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: snapDescription(s), datePublished: s.capturedAt, dateModified: s.capturedAt,
        mainEntityOfPage: SITE_URL + snapPath(s), author: { '@id': SITE_URL + '/#organization' }, publisher: { '@id': SITE_URL + '/#organization' }, isBasedOn: SITE_URL + '/api/tokens' },
    ],
    body: `<div class="legal" style="max-width:980px"><h1>${esc(title)}</h1>
<p class="muted">ISO week ${esc(s.isoWeek)} · readings captured ${esc(s.capturedAt)} (${esc(etTime(s.capturedAt))}) · XRPL ledger ~${esc(s.ledgerIndex)} · XRP/USD ${usd(s.xrpUsd, 4)}</p>
<p class="notice"><b>Automated readings, not advice.</b> This page is a frozen copy of the <b>legacy worst-check labels</b> (OK / WARN / CRITICAL) as saved on this date. Those words are not rewritten to the live comparison menu. A WARN here may be only an issuer control or a missing measurement. Live pages separate those from active problems. It is not investment advice, not an audit, and not proof of reserves. See each token page for the current comparison, and the <a href="/methodology">methodology</a> for both models.</p>
${s.notes?.length ? `<h2>Context for this snapshot</h2><ul>${s.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
<h2>At a glance</h2>
<p>We tracked <b>${s.tokens.length}</b> commodity tokens: <b>${count('critical')}</b> ${badge('critical')}, <b>${count('warn')}</b> ${badge('warn')}, <b>${count('ok')}</b> ${badge('ok')}.</p>
<ul>${snapshotHighlights(s).map(h => `<li>${h}</li>`).join('')}</ul>
<h2>What changed since the previous snapshot</h2>${snapshotChanges(s, prev)}
<h2>Each token and why</h2>${groups}
<h2>Summary table</h2>
<table><tr><th>Token</th><th>Label</th><th>Circulating</th><th>Spot / token</th><th>AMM TVL</th><th>Peg vs spot</th><th>Clawback</th><th>Global freeze</th></tr>${table}</table>
<p class="muted">Source: <a href="/api/tokens">/api/tokens</a> at capture time. AMM pools counted: ${esc(snapQuotes(s).join(', '))}. Spot metal prices from a public price API (metals only). ${prev ? `Previous: <a href="${snapPath(prev)}">snapshot #${snapNo(prev)}, ${longDate(prev.week)}</a>. ` : ''}${next ? `Next: <a href="${snapPath(next)}">snapshot #${snapNo(next)}, ${longDate(next.week)}</a>. ` : ''}<a href="/snapshots">All weekly snapshots</a>.</p></div>` });
}

function snapshotsIndex() {
  const rows = SNAPSHOTS.map(s => {
    const c = (v: Severity) => s.tokens.filter(t => t.status === v).length;
    return `<li><a href="${snapPath(s)}"><b>Snapshot #${snapNo(s)} — ${esc(longDate(s.week))}</b></a> <span class="muted">(${esc(s.isoWeek)})</span> — ${s.tokens.length} tokens: ${c('critical')} CRITICAL, ${c('warn')} WARN, ${c('ok')} OK</li>`;
  }).join('');
  return page({
    title: 'Weekly XRPL Commodity Token Ledger Snapshots · ReserveWatch',
    description: 'Archive of weekly on-ledger health snapshots for gold, silver, platinum and other commodity tokens on the XRP Ledger: labels, reasons, liquidity and peg readings, week by week. Not investment advice.',
    path: '/snapshots', ogType: 'website',
    jsonLd: [breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Weekly snapshots', path: '/snapshots' }])],
    body: `<div class="legal"><h1>Weekly ledger snapshots</h1>
<p>Once a week we save a frozen copy of ReserveWatch's raw checks for every tracked XRPL commodity token: the legacy OK, WARN, or CRITICAL overall, why, and what changed since the week before. Those archived labels are not relabeled when the live site's comparison menu changes. Live comparison is on the <a href="/">home page</a>; every legacy-label change between snapshots is in the <a href="/alerts">alert log</a>.</p>
<ul>${rows}</ul>
<p class="notice">Automated readings of public ledger data, not investment advice, not an audit, and not proof of reserves. See the <a href="/methodology">methodology</a>.</p></div>` });
}

// ---------- Learn: pillar explainers ----------
const LEARN_LIVE = [
  { path: '/learn/clawback-freeze-trust-lines', title: 'Clawback, freeze and trust lines on XRPL: what they mean for metal tokens', blurb: 'What an issuer can and cannot do to your tokens, in plain words.' },
  ...LEARN_GUIDES.map(g => ({ path: `/learn/${g.slug}`, title: g.h1, blurb: g.blurb })),
];

/** Live table for a learn guide, built from the current snapshot (falls back to the latest frozen snapshot). */
function learnLiveTable(slug: string): { html: string; asOf: string } {
  const asOf = snap?.updatedAt ?? SNAPSHOTS[0]?.capturedAt ?? '';
  const link = (id: string, name: string) => `<a href="/token/${esc(id)}">${esc(name)}</a>`;
  if (slug === 'peg-vs-spot') {
    const rows = snap?.tokens.length
      ? snap.tokens.map(t => {
          const cm = commodityMeta(t.metal);
          const pegTxt = t.spot.unsupported ? '<span class="muted">not measured (no spot reference)</span>'
            : t.peg.reliable ? `${fmt(t.peg.deviationPct, 2)}% vs spot`
            : t.peg.referenceUsd != null ? `<span class="muted">not measurable (thin liquidity)</span>` : '<span class="muted">not measurable (no on-ledger price)</span>';
          const q = t.liquidity?.quoteAssets ?? [];
          return `<tr><td>${link(t.id, t.name)}</td><td>${esc(cm.title)}</td><td>${t.spot.unsupported ? '—' : usd(t.spot.usdPerToken)}</td><td>${usd(t.peg.referenceUsd, 4)}</td><td>${t.pools.some(p => p.exists) ? `${usd(t.liquidity?.totalUsd ?? 0, 0)}${q.length ? ` <span class="muted">via ${esc(q.join(' + '))}</span>` : ''}` : '<span class="muted">no pool</span>'}</td><td>${pegTxt}</td></tr>`;
        })
      : (SNAPSHOTS[0]?.tokens ?? []).map(t => `<tr><td>${link(t.id, t.name)}</td><td>${esc(commodityMeta(t.metal).title)}</td><td>${t.spotUsdPerToken == null ? '—' : usd(t.spotUsdPerToken)}</td><td>—</td><td>${t.hasPool ? usd(t.ammTvlUsd, 0) : '<span class="muted">no pool</span>'}</td><td>${t.pegReliable ? `${fmt(t.pegRawPct, 2)}% vs spot` : t.spotUsdPerToken == null ? '<span class="muted">not measured</span>' : '<span class="muted">not measurable</span>'}</td></tr>`);
    return { asOf, html: `<table><tr><th>Token</th><th>Class</th><th>Spot / token</th><th>On-ledger price</th><th>AMM TVL</th><th>Peg reading</th></tr>${rows.join('')}</table>` };
  }
  if (slug === 'unverified-listings') {
    const ts = (snap?.tokens.length ? snap.tokens.map(t => ({ id: t.id, name: t.name, label: t.label ?? null, status: t.status as Severity }))
      : (SNAPSHOTS[0]?.tokens ?? []).map(t => ({ id: t.id, name: t.name, label: t.label, status: t.status }))).filter(t => t.label);
    if (!ts.length) return { asOf, html: '<p>No tracked token carries either label right now.</p>' };
    const liveById = new Map((snap?.tokens ?? []).map(t => [t.id, t]));
    return { asOf, html: `<table><tr><th>Token</th><th>Label</th><th>Comparison</th><th>Legacy overall</th></tr>${ts.map(t => {
      const live = liveById.get(t.id);
      const ident = live ? chips(viewOf(live).categories.identity.items) : '<span class="muted">see snapshot</span>';
      return `<tr><td>${link(t.id, t.name)}</td><td><span class="pill">${esc(t.label)}</span></td><td>${ident}</td><td><span class="legacy-mark legacy-${t.status}">${t.status.toUpperCase()}</span></td></tr>`;
    }).join('')}</table><p class="muted">Legacy overall is the worst raw check and is not the comparison. Records that disagree with the account stay Critical. An unpublished issuer link stays Not confirmed.</p>` };
  }
  return { asOf, html: '' };
}

function learnGuidePage(g: LearnGuide) {
  const path = `/learn/${g.slug}`;
  const live = learnLiveTable(g.slug);
  const ctx: LearnCtx = { lowLiqUsd: LOW_LIQ_USD, pegWarnPct: PEG_WARN_PCT, pegCritPct: PEG_CRIT_PCT, maxSpreadPct: MAX_SPREAD_PCT, concWarnPct: CONC_WARN_PCT, badge, liveTable: live.html, asOf: live.asOf ? esc(live.asOf) : undefined };
  return page({
    title: g.title, description: g.description, path, ogType: 'article',
    jsonLd: [
      breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Learn', path: '/learn' }, { name: g.crumb, path }]),
      { '@context': 'https://schema.org', '@type': 'Article', headline: g.h1, description: g.description, datePublished: g.datePublished, dateModified: g.dateModified,
        mainEntityOfPage: SITE_URL + path, author: { '@id': SITE_URL + '/#organization' }, publisher: { '@id': SITE_URL + '/#organization' } },
      ...(g.extraLd?.(SITE_URL + path) ?? []),
      ...(g.faq ? [faqPageLd(g.faq(ctx))] : []),
    ],
    body: `<div class="legal"><h1>${esc(g.h1)}</h1><p class="muted">Last updated ${esc(longDate(g.dateModified))} · <a href="/learn">All guides</a></p>
${g.body(ctx)}</div>` });
}

function learnIndex() {
  return page({
    title: 'Learn: XRPL Commodity Token Basics Explained · ReserveWatch',
    description: 'Plain-language explainers on how gold, silver, energy, diamond and other commodity tokens work on the XRP Ledger: trust lines, freeze, clawback, peg vs spot and more. Not investment advice.',
    path: '/learn',
    jsonLd: [breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Learn', path: '/learn' }])],
    body: `<div class="legal"><h1>Learn: XRPL commodity token basics</h1>
<p>Short, plain-language guides to the ledger settings and numbers ReserveWatch reads. For how the comparison differs from the legacy overall, start with the <a href="/methodology">methodology</a>. Common questions are on the <a href="/faq">FAQ</a>.</p>
<h2>Guides</h2><ul>${LEARN_LIVE.map(l => `<li><a href="${l.path}"><b>${esc(l.title)}</b></a><div class="muted">${esc(l.blurb)}</div></li>`).join('')}</ul>
<h2>By commodity</h2><p>${CLASS_PAGES.map(p => `<a href="/commodities/${p.slug}">${esc(p.h1.replace(/^Tokenized /, '').replace(/ on the XRP Ledger$/, ''))}</a>`).join(' · ')}</p>
<h2>See it in the data</h2><p><a href="/snapshots">Ledger snapshots</a> · <a href="/methodology">Methodology</a> · <a href="/faq">FAQ</a> · <a href="/api/tokens">JSON API</a></p></div>` });
}

function clawbackPillar() {
  const ts: { id: string; name: string; clawback: boolean; globalFreeze: boolean; noFreeze: boolean; frozenLines: number | null; requireAuth: boolean }[] =
    snap?.tokens.length ? snap.tokens.map(t => ({ id: t.id, name: t.name, clawback: !!t.flags.allowTrustLineClawback, globalFreeze: !!t.flags.globalFreeze, noFreeze: !!t.flags.noFreeze, frozenLines: t.holders.frozenLines, requireAuth: !!t.flags.requireAuthorization }))
      : (SNAPSHOTS[0]?.tokens ?? []);
  const asOf = snap?.updatedAt ?? SNAPSHOTS[0]?.capturedAt ?? '';
  const link = (t: { id: string; name: string }) => `<a href="/token/${esc(t.id)}">${esc(t.name)}</a>`;
  const list = (xs: typeof ts) => xs.length ? xs.map(link).join(', ') : '<i>none of the tracked tokens</i>';
  const cb = ts.filter(t => t.clawback), gf = ts.filter(t => t.globalFreeze), nf = ts.filter(t => t.noFreeze), fl = ts.filter(t => (t.frozenLines ?? 0) > 0);
  const rows = ts.map(t => `<tr><td>${link(t)}</td><td>${t.clawback ? '<b>on</b>' : 'off'}</td><td>${t.noFreeze ? 'yes (gave up freeze)' : 'no (can freeze)'}</td><td>${t.globalFreeze ? '<b>on</b>' : 'off'}</td><td>${fmt(t.frozenLines, 0)}</td><td>${t.requireAuth ? 'yes' : 'no'}</td></tr>`).join('');
  const path = '/learn/clawback-freeze-trust-lines';
  const h1 = 'Clawback, freeze and trust lines on XRPL: what they mean for metal tokens';
  const description = 'Plain-language guide to trust lines, freeze, Global Freeze, NoFreeze and clawback on the XRP Ledger, and what each means if you hold a gold, silver, platinum or other commodity token. With live on-ledger flags. Not advice.';
  return page({
    title: 'XRPL Clawback, Freeze & Trust Lines Explained for Gold Tokens · ReserveWatch', description, path, ogType: 'article',
    jsonLd: [
      breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Learn', path: '/learn' }, { name: 'Clawback, freeze and trust lines', path }]),
      { '@context': 'https://schema.org', '@type': 'Article', headline: h1, description, datePublished: '2026-10-30', dateModified: COMPARE_UPDATED_ISO,
        mainEntityOfPage: SITE_URL + path, author: { '@id': SITE_URL + '/#organization' }, publisher: { '@id': SITE_URL + '/#organization' } },
      faqPageLd(CLAWBACK_FAQ),
    ],
    body: `<div class="legal"><h1>${esc(h1)}</h1><p class="muted">Last updated ${COMPARE_UPDATED}</p>
<p class="notice"><b>Short version:</b> On the XRP Ledger, a gold, silver, platinum or other commodity token is an IOU from an issuer, and you hold it through a <b>trust line</b>. The issuer's account settings decide whether it can <b>freeze</b> your tokens or <b>claw them back</b>. ReserveWatch reads those settings straight from the ledger for every token it tracks. This is education, not investment advice, and these settings say nothing about whether metal sits in a vault.</p>

<h2>1. Trust lines: how you hold a token</h2>
<p>XRP is the ledger's own coin. Every other token — including metal tokens — is issued by a specific account (the <b>issuer</b>). Before you can hold one, your account must open a <b>trust line</b> to that issuer. Think of it as saying, "I agree to hold up to this many of your tokens."</p>
<ul>
<li>Each trust line ties <b>one holder</b> to <b>one issuer</b> for <b>one currency code</b>. Two tokens with the same code (say, "GOLD") from different issuers are completely different tokens.</li>
<li>The issuer's total supply is the sum of all its trust-line balances. ReserveWatch subtracts known treasury wallets to get <b>circulating supply</b>.</li>
<li>Opening a trust line costs a small XRP reserve that is locked while the line exists.</li>
<li>Some issuers turn on <b>RequireAuth</b>, which means they must approve each trust line before it can hold tokens.</li>
</ul>
<p><b>Why it matters:</b> because the code alone does not identify a token, always check the <b>issuer address</b>. That is why ReserveWatch soft-labels tokens it cannot match to the project they reference as <span class="pill">Unverified listing</span>.</p>

<h2>2. Freeze: stopping tokens from moving</h2>
<p>By default, an XRPL issuer can freeze its tokens. There are three related settings:</p>
<ul>
<li><b>Individual freeze.</b> The issuer freezes one holder's trust line. That holder can still send the tokens back to the issuer, but generally cannot send them to anyone else. Issuers often use this for legal or compliance holds.</li>
<li><b>Global Freeze.</b> The issuer freezes <b>all</b> of its trust lines at once. The token stops moving between holders; in practice, holders can only send it back to the issuer. ReserveWatch marks this ${badge('critical')}.</li>
<li><b>NoFreeze.</b> An issuer can give up its freeze power <b>forever</b> by setting NoFreeze. Once set, it cannot be undone, and the issuer can no longer freeze lines or turn on Global Freeze. Many regulated issuers keep freeze power on purpose, so ReserveWatch treats "can freeze" as normal (${badge('ok')}) and shows it for context.</li>
</ul>
<p>Some ledger versions also support a stricter <b>deep freeze</b> on a single line, which also stops that holder from receiving the token.</p>

<h2>3. Clawback: taking tokens back</h2>
<p><b>Clawback</b> lets an issuer pull tokens out of a holder's trust line and back to itself. On the XRP Ledger the issuer has to switch this on with the <code>allowTrustLineClawback</code> account setting, and the ledger only allows that <b>before</b> the issuer has any trust lines or offers. After it is on, it cannot be switched off, and it cannot be combined with NoFreeze. So clawback is a choice an issuer makes at launch, and it stays for the life of that issuer account.</p>
<ul>
<li><b>Why issuers use it:</b> to meet court orders, fix mistakes, or follow rules for regulated assets.</li>
<li><b>What it means for holders:</b> you do not have final control of your balance — the issuer can reduce it without your signature.</li>
<li><b>How ReserveWatch shows it:</b> the comparison uses a neutral <b>Feature</b> label. Holders do not have final control of the balance. The label does not say a clawback has happened, and it does not say the power is risk-free. The raw check is still ${badge('warn')}, not CRITICAL, so the legacy overall can be WARN for this feature alone.</li>
</ul>

<h2>4. What ReserveWatch sees on-ledger right now</h2>
<p>These flags are read directly from each issuer's XRPL account${asOf ? ` (as of ${esc(asOf)})` : ''}. We do not judge why an issuer chose them.</p>
<ul>
<li><b>Clawback enabled:</b> ${list(cb)}.</li>
<li><b>Global Freeze on:</b> ${list(gf)}.</li>
<li><b>NoFreeze set (freeze power given up):</b> ${list(nf)}.</li>
<li><b>Some individually frozen trust lines:</b> ${list(fl)}.</li>
</ul>
<table><tr><th>Token</th><th>Clawback</th><th>NoFreeze</th><th>Global Freeze</th><th>Frozen lines</th><th>RequireAuth</th></tr>${rows}</table>
<p class="muted">Live values for each token are on its token page under "Issuer control flags". A frozen-line count only says lines exist that the issuer froze; it does not say why.</p>

<h2>5. Questions to ask before you rely on a metal token</h2>
<ol>
<li>Is the issuer address the one the project publishes (for example, in its <code>xrp-ledger.toml</code> file)?</li>
<li>Can the issuer freeze or claw back my tokens, and does the issuer explain when it would?</li>
<li>Is Global Freeze on right now? If so, the token cannot move between holders.</li>
<li>Is there enough liquidity to exit, and does the on-ledger price track spot? See the <a href="/methodology">methodology</a>.</li>
<li>Remember: none of these settings prove metal is in a vault. On-ledger data is not proof of reserves.</li>
</ol>

<h2>How to check it yourself</h2>
<p>Open the issuer address on a public explorer (each ReserveWatch token page links to XRPScan) and look at the account flags, or query the ledger's <code>account_info</code> method. ReserveWatch shows the same flags on every token page and in the free <a href="/api/tokens">JSON API</a>.</p>
<p class="muted">Related: <a href="/methodology">How the health checks work</a> · <a href="/learn/peg-vs-spot">Peg vs spot</a> · <a href="/learn/unverified-listings">Unverified listings</a> · <a href="/learn/glossary">Glossary</a> · <a href="/snapshots">Ledger snapshots</a> · <a href="/learn">All guides</a> · <a href="/disclaimer">Disclaimer</a></p></div>` });
}

// ---------- Commodity hubs (/commodities, /commodities/:slug) ----------
const classTokens = (c: ClassPage) => TOKENS.filter(t => c.codes.includes(t.metal));
const classLabel = (c: ClassPage) => c.h1.replace(/^Tokenized /, '').replace(/ on the XRP Ledger$/, '');
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function commoditiesIndex() {
  const live = CLASS_PAGES.filter(c => classTokens(c).length);
  const groups = GROUPS.map(g => {
    const items = g.slugs.map(sl => CLASS_PAGES.find(c => c.slug === sl)!).filter(Boolean).map(c => {
      const n = classTokens(c).length;
      return `<li><a href="/commodities/${c.slug}"><b>${esc(cap(classLabel(c)))}</b></a> <span class="muted">— ${n ? `${n} XRPL token${n === 1 ? '' : 's'} tracked` : 'no public XRPL issuer tracked yet'}</span></li>`;
    }).join('');
    return `<h2>${esc(g.title)}</h2><ul>${items}</ul>`;
  }).join('');
  return page({
    title: 'Tokenized Commodities on the XRP Ledger (XRPL): Every Asset Class · ReserveWatch',
    description: 'Gold, silver, platinum, palladium, oil, natural gas, energy, uranium, copper, diamonds, timber and crop tokens on the XRP Ledger: which exist, which ReserveWatch tracks, and how each is checked.',
    path: '/commodities',
    jsonLd: [breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Commodities', path: '/commodities' }]),
      { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Tokenized commodities on the XRP Ledger', url: SITE_URL + '/commodities',
        hasPart: CLASS_PAGES.map(c => ({ '@type': 'WebPage', name: c.h1, url: SITE_URL + '/commodities/' + c.slug })), publisher: { '@id': SITE_URL + '/#organization' } }],
    body: `<div class="legal"><h1>Tokenized commodities on the XRP Ledger</h1>
<p class="notice"><b>Short version:</b> A commodity token is an IOU on the XRP Ledger that says it stands for something physical — gold, a megawatt-hour of electricity, a collection of diamonds, a silo of grain. The ledger can show how many tokens exist, who holds them and what the issuer is allowed to do (freeze, claw back). It <b>cannot</b> show that the physical goods exist. ReserveWatch reads the ledger part, honestly, for every class. Not investment advice; not an audit or proof of reserves.</p>
<p>Today ReserveWatch runs live checks on <b>${TOKENS.length}</b> XRPL tokens across <b>${live.length}</b> classes (${esc(trackedClassList())}). Every other class below has an explainer page that says plainly when no public XRPL issuer is tracked yet — we add a token only when its issuer account can be confirmed on XRPL mainnet.</p>
${groups}
<h2>How every commodity token is checked</h2>
<ul>
<li><b>Same comparison for every class.</b> Market and peg, issuer controls (freeze, Global Freeze, clawback, RequireAuth, concentration), and identity. The legacy overall is still the worst raw check. See the <a href="/methodology">methodology</a>.</li>
<li><b>Peg vs spot only where a fair spot price exists.</b> Gold, silver, platinum and palladium are compared with a public spot price. Other classes show "price vs spot not measured" instead of a made-up number.</li>
<li><b>Soft labels, not accusations.</b> <span class="pill">Unverified listing</span> and <span class="pill">Issuer link unconfirmed</span> mean we could not confirm the issuer from the project itself — nothing more.</li>
</ul>
<p class="muted">Data: <a href="/api/commodities">/api/commodities</a> (classes and tracked token ids) · <a href="/api/tokens">/api/tokens</a> (live readings) · <a href="/snapshots">weekly snapshots</a> · <a href="/learn/clawback-freeze-trust-lines">clawback &amp; freeze explained</a></p></div>` });
}

function commodityPage(c: ClassPage) {
  const defs = classTokens(c);
  const live = (id: string) => snap?.tokens.find(x => x.id === id);
  const cards = defs.map(d => {
    const t = live(d.id);
    if (!t) return `<article class="token-card"><h2><a href="/token/${esc(d.id)}">${esc(d.name)}</a></h2><p class="muted">Reading not loaded yet.</p></article>`;
    return renderHomeCard(t, { href: `/commodities/${commodityMeta(d.metal).slug}`, name: commodityMeta(d.metal).title });
  }).join('');
  const tracked = defs.length
    ? `<h2>${esc(cap(classLabel(c)))} on the ledger</h2>${header()}<div class="board">${cards}</div>`
    : '';
  const related = (c.related ?? []).map(sl => CLASS_PAGES.find(x => x.slug === sl)).filter(Boolean).map(x => `<a href="/commodities/${x!.slug}">${esc(cap(classLabel(x!)))}</a>`).join(' · ');
  const meta = commodityMeta(c.codes[0]);
  const path = `/commodities/${c.slug}`;
  const qs = [
    'Who is the issuer, and does its own website publish an <code>xrp-ledger.toml</code> that lists the issuer account?',
    'Can the issuer freeze or claw back tokens? (Check the token page\u2019s issuer flags.)',
    ...(c.questions ?? []),
    'Is there enough on-ledger liquidity to sell, or only a thin pool?',
    'Remember: none of the ledger data proves the physical goods exist. On-ledger supply is not proof of reserves.',
  ];
  return page({
    title: c.title, description: c.description, path, ogType: 'article',
    refresh: defs.length > 0,
    jsonLd: [
      breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Commodities', path: '/commodities' }, { name: cap(classLabel(c)), path }]),
      { '@context': 'https://schema.org', '@type': 'Article', headline: c.h1, description: c.description, datePublished: '2026-10-30', dateModified: LEGAL_UPDATED_ISO,
        mainEntityOfPage: SITE_URL + path, author: { '@id': SITE_URL + '/#organization' }, publisher: { '@id': SITE_URL + '/#organization' },
        about: { '@type': 'Thing', name: meta.title } },
    ],
    body: `<div class="legal legal-wide"><h1>${esc(c.h1)}</h1><p class="muted">Last updated ${LEGAL_UPDATED} · <a href="/commodities">All commodities</a></p>
<p class="notice"><b>Automated ledger readings, not advice.</b> ReserveWatch is not an audit, not proof of reserves and not investment advice. It does not tell anyone to buy, sell or hold a token.</p>
<h2>What is a tokenized ${esc(c.noun ?? classLabel(c))} token?</h2><p>${c.what}</p>
<h2>How price is compared</h2><p>${c.pricing}</p>
<h2>${esc(cap(classLabel(c)))} on the XRP Ledger today</h2>${c.xrplStatus}
${tracked}
${c.elsewhere ? `<h2>Outside the XRP Ledger</h2><p>${esc(c.elsewhere)} ReserveWatch covers XRPL only; these are listed for context, not tracked or endorsed.</p>` : ''}
<h2>Questions to ask before relying on a ${esc(c.noun ?? classLabel(c))} token</h2><ul>${qs.map(q => `<li>${q}</li>`).join('')}</ul>
<p class="muted">How labels are set: <a href="/methodology">methodology</a> · Data: <a href="/api/commodities/${c.slug}">/api/commodities/${c.slug}</a> and <a href="/api/tokens">/api/tokens</a> · <a href="/learn/clawback-freeze-trust-lines">Clawback &amp; freeze explained</a>${related ? ` · Related: ${related}` : ''}</p></div>` });
}


// ---------- Briefs (dated public notes; see src/content/briefs.ts) ----------
const briefPath = (b: Brief) => `/briefs/${b.slug}`;
const briefKindLabel: Record<Brief['kind'], string> = {
  critical: 'CRITICAL situation',
  'soft-label': 'Soft label',
  'new-issuer': 'New issuer',
  measurement: 'Measurement change',
  'flag-change': 'Flag change',
};

function briefPage(b: Brief) {
  const tokens = b.tokenIds.map(id => {
    const def = TOKENS.find(t => t.id === id);
    const live = snap?.tokens.find(t => t.id === id);
    const name = def?.name ?? id;
    const status = live ? `<span class="legacy-mark legacy-${live.status}">Legacy ${live.status.toUpperCase()}</span>` : '';
    return `<a href="/token/${esc(id)}">${esc(name)}</a>${status ? ' ' + status : ''}${live?.label ? `<span class="pill">${esc(live.label)}</span>` : ''}`;
  });
  return page({
    title: `${b.title} · ReserveWatch`,
    description: b.description,
    path: briefPath(b),
    ogType: 'article',
    jsonLd: [
      breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Briefs', path: '/briefs' }, { name: b.title, path: briefPath(b) }]),
      {
        '@context': 'https://schema.org', '@type': 'Article',
        headline: b.title, description: b.description,
        datePublished: b.asOf ?? `${b.date}T17:00:00.000Z`,
        dateModified: b.asOf ?? `${b.date}T17:00:00.000Z`,
        mainEntityOfPage: SITE_URL + briefPath(b),
        author: { '@id': SITE_URL + '/#organization' },
        publisher: { '@id': SITE_URL + '/#organization' },
        about: b.tokenIds.map(id => SITE_URL + '/token/' + id),
        isBasedOn: SITE_URL + '/api/tokens',
      },
    ],
    body: `<div class="legal" style="max-width:820px"><h1>${esc(b.title)}</h1>
<p class="muted">${esc(longDate(b.date))} · ${esc(briefKindLabel[b.kind])}${b.asOf ? ` · facts as of ${esc(etTime(b.asOf))}` : ''} · <a href="/briefs">All briefs</a></p>
${tokens.length ? `<p>Tokens: ${tokens.join(' · ')}</p>` : ''}
<p class="notice"><b>How to read the labels in this dated note.</b> Briefs keep the words they were published with. Where a note says CRITICAL or WARN, that is the legacy worst-check aggregate as of that date. Live token pages now lead with market readings, issuer controls, and identity. Conflicting issuer records stay a prominent caution. A thin pool stays "not measurable", not a graded peg break. The legacy aggregate is still on the token page and in the API <code>status</code> field. This note does not rewrite the facts below.</p>
${b.bodyHtml}
<p class="muted">Related: <a href="/methodology">Methodology</a> · <a href="/snapshots">Weekly snapshots</a> · <a href="/alerts">Alert log</a> · <a href="/learn/unverified-listings">Soft labels</a> · <a href="/disclaimer">Disclaimer</a></p></div>`,
  });
}

function briefsIndex() {
  const rows = BRIEFS.length
    ? `<ul>${BRIEFS.map(b => `<li><a href="${briefPath(b)}"><b>${esc(b.title)}</b></a> <span class="muted">${esc(longDate(b.date))} · ${esc(briefKindLabel[b.kind])}</span><div class="muted">${esc(b.summary)}</div></li>`).join('')}</ul>`
    : `<p class="notice"><b>No briefs published yet.</b> When a new commodity issuer appears on the ledger, or a material CRITICAL / soft-label / peg situation is worth documenting, a short dated note will appear here. Weekly frozen readings stay on <a href="/snapshots">snapshots</a>; status transitions stay in the <a href="/alerts">alert log</a>.</p>
<p class="muted">Editors: ${esc(HOW_TO_ADD)}</p>`;
  return page({
    title: 'XRPL Commodity Token Briefs · ReserveWatch',
    description: 'Short dated public briefs when a new XRPL commodity issuer appears or a CRITICAL / soft-label situation is worth documenting. Ledger facts only — not investment advice.',
    path: '/briefs',
    ogType: 'website',
    jsonLd: [breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Briefs', path: '/briefs' }])],
    body: `<div class="legal"><h1>Briefs</h1>
<p>Short, dated notes when something on the watchlist is worth calling out in plain words: a new commodity issuer, a legacy CRITICAL situation, a soft-label change, or a material measurement change. Each brief keeps the wording from its publish date. The live comparison is on the <a href="/">home page</a> and in the <a href="/methodology">methodology</a>. Weekly frozen tables live under <a href="/snapshots">snapshots</a>; every legacy-label flip is in the <a href="/alerts">alert log</a>.</p>
${rows}
<p class="notice">Automated readings of public ledger data, not investment advice, not an audit, and not proof of reserves.</p></div>`,
  });
}

// ---------- FAQ (/faq) ----------
const FAQ_UPDATED = 'November 6, 2026';
/** Plain-text answers only. Links live in `more` so FAQPage JSON-LD stays free of HTML. */
const FAQ_BLOCKS = (): { q: string; a: string; more: string }[] => [
  {
    q: 'What is ReserveWatch?',
    a: `${SITE_NAME} is an independent, issuer-neutral monitor of commodity tokens on the XRP Ledger — gold, silver, platinum, energy, diamonds and more. It reads public ledger data and compares three things: issuer controls, liquidity and peg, and public verification of the issuer account. Measured facts, issuer features, and information gaps are labeled separately from active problems. A legacy OK, WARN, or CRITICAL overall is still published as the worst raw check. The same published rules apply to every issuer. It does not tell anyone to buy, sell, or hold a token.`,
    more: '<a href="/about">About</a> · <a href="/independent">Independence</a> · <a href="/methodology">Methodology</a>',
  },
  {
    q: 'What is ReserveWatch not?',
    a: `${SITE_NAME} is not a custodian, not an issuer, and not a vault auditor. It does not hold funds, run wallets, or ask for seeds, private keys, or payments. It is not affiliated with Ripple, the XRPL Foundation, or any token issuer it lists. It does not audit vaults or attest to reserves, and on-ledger supply is not proof of reserves. Comparison labels and the legacy OK, WARN, and CRITICAL overall are not credit ratings, recommendations, or opinions on solvency. A measured reading is not a statement that a token is safe or fully backed. Nothing on the site is investment, financial, legal, or tax advice.`,
    more: '<a href="/independent">Independence</a> · <a href="/disclaimer">Disclaimer</a>',
  },
  {
    q: 'What do the comparison labels and OK, WARN and CRITICAL mean?',
    a: `The comparison has four kinds of label. Measured means a reading was taken, such as liquidity at or above about $${n0(LOW_LIQ_USD)}, a reliable price within ${PEG_WARN_PCT}% of spot, or an issuer listed in its own xrp-ledger.toml. Measured does not mean safe or fully backed. Feature means an issuer power or holder structure is on, such as clawback, restricted access, or a concentrated holder. It describes what holders are exposed to. It is not an adverse event and it is not risk-free. Not measurable and not confirmed mean the data is missing. No pool is not a broken peg. An unconfirmed issuer link is not a fraud finding. Caution and Critical are reserved for an active problem or conflicting public records: Global Freeze, a reliable peg at least ${PEG_WARN_PCT}% from spot, a discontinued token, supply that is actually frozen, or issuer records that disagree with the account. Separately, each raw check is still OK, WARN, or CRITICAL, and the legacy overall is the worst of those checks. One feature or one gap still makes that legacy overall WARN. The legacy overall is what the API status field, the alert log, and historical snapshots use. It is not a buy or no-buy rating.`,
    more: '<a href="/methodology">How classification works</a> · <a href="/learn/glossary">Glossary</a>',
  },
  {
    q: 'Is ReserveWatch a vault audit or proof of reserves?',
    a: `No. ${SITE_NAME} does not visit, inspect, or attest to any vault, custodian, warehouse, or bank account. On-ledger supply counts how many tokens exist. It does not show that a physical commodity exists, is insured, or can be redeemed. On-ledger data is not proof of reserves.`,
    more: '<a href="/methodology">Methodology</a> · <a href="/disclaimer">Disclaimer</a>',
  },
  {
    q: 'What do "Unverified listing" and "Issuer link unconfirmed" mean?',
    a: `They are labels for issuers ${SITE_NAME} could not confirm from the project's own sources. A label is a statement about what could be verified. It is not an accusation. "Unverified listing" means the issuer account points at a project, but that project's own published token list or xrp-ledger.toml does not include the account. The project's source and the account disagree, so identity and backing could not be confirmed from those sources. The comparison shows that as a Critical records-conflict caution, and the raw check is still CRITICAL. "Issuer link unconfirmed" means third-party registries attribute the account to a project, but the project itself publishes no xrp-ledger.toml or official page listing it. Nothing contradicts the link. The comparison shows that as Not confirmed, not as Critical. The raw check is still WARN. Neither label is a fraud finding, and neither states that a token is unbacked. A token without the label is not thereby safe or fully backed.`,
    more: '<a href="/learn/unverified-listings">What the labels mean</a> · <a href="/methodology">Methodology</a>',
  },
  {
    q: 'Why is peg vs spot sometimes "not measurable" when liquidity is thin?',
    a: `For gold, silver, platinum and palladium, ${SITE_NAME} compares the spot price of the metal a token says it represents with the price the token trades at on the XRP Ledger. The gap is the peg deviation. A small pool can sit far from spot simply because nobody has traded it back into line. That is a liquidity fact, not a broken peg, and not a sign the metal is missing. ${SITE_NAME} grades the gap only when the price comes from AMM pools holding at least about $${n0(LOW_LIQ_USD)}. Under ${PEG_WARN_PCT}% the comparison says price near spot (measured, not a safety rating). From ${PEG_WARN_PCT}% up to ${PEG_CRIT_PCT}% is Caution. ${PEG_CRIT_PCT}% or more is Critical. Below that gate, or when there is no usable pool, the comparison says peg not measurable, and the raw check is still WARN. The raw number is kept and marked not graded. A DEX order-book price is never graded as reliable, because its depth is not measured. Oil, natural gas, electricity, uranium, copper, diamonds, timber and crops have no single public spot price that maps onto a token, so those classes show "price vs spot not measured" instead of a guess. RLUSD and USDV pools are valued at a nominal $1, which is the issuer-stated peg and not a reserve check. A peg reading describes trading prices only. It is not proof that a commodity exists in a vault, and it is not a signal to buy or sell.`,
    more: '<a href="/learn/peg-vs-spot">Peg vs spot</a> · <a href="/methodology#peg">How peg is measured</a>',
  },
  {
    q: 'How should I cite /api/tokens?',
    a: `The dataset at ${SITE_URL}/api/tokens is free JSON and free to cite. Attribute "${SITE_NAME}" and link that URL, or the page a reading came from. Per-token JSON is ${SITE_URL}/api/tokens/{id}, using the id from that token's page address. Cache responses. Acceptable use is described on the terms page. Do not describe the labels as an audit, proof of reserves, a credit rating, or investment advice. Readings can be delayed, incomplete, or wrong. Confirm with the issuer and an independent explorer.`,
    more: '<a href="/api/tokens">/api/tokens</a> · <a href="/terms">Terms of use</a> · <a href="/disclaimer">Disclaimer</a>',
  },
];

function faqPage() {
  const blocks = FAQ_BLOCKS();
  const description = 'What ReserveWatch is and is not, how the comparison labels differ from the legacy OK / WARN / CRITICAL overall, why it is not a vault audit or proof of reserves, what unverified and unconfirmed issuer links mean, peg vs spot when liquidity is thin, and how to cite /api/tokens.';
  return page({
    title: 'FAQ: What ReserveWatch Is, Health Labels, and How to Cite the Data · ReserveWatch',
    description, path: '/faq', ogType: 'article',
    jsonLd: [
      breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'FAQ', path: '/faq' }]),
      faqPageLd(blocks.map(({ q, a }) => ({ q, a }))),
    ],
    body: `<div class="legal"><h1>Frequently asked questions</h1>
<p class="muted">Last updated ${FAQ_UPDATED}</p>
<p class="notice"><b>Short version:</b> ${SITE_NAME} publishes automated readings of public XRP Ledger data. These answers use the same plain words as the <a href="/methodology">methodology</a> and <a href="/learn">learn</a> guides. They are not investment advice, not a vault audit, and not proof of reserves.</p>
${blocks.map(b => `<h2>${esc(b.q)}</h2><p>${esc(b.a)}</p><p class="muted">More: ${b.more}</p>`).join('\n')}
<p class="muted">Related: <a href="/methodology">Methodology</a> · <a href="/briefs">Briefs</a> · <a href="/learn/peg-vs-spot">Peg vs spot</a> · <a href="/learn/unverified-listings">Unverified listings</a> · <a href="/learn/clawback-freeze-trust-lines">Clawback, freeze and trust lines</a> · <a href="/learn/glossary">Glossary</a> · <a href="/learn">All guides</a> · <a href="/api/tokens">JSON API</a> · <a href="/disclaimer">Disclaimer</a></p></div>` });
}

const commodityJson = (c: ClassPage) => ({
  slug: c.slug, name: c.h1, url: SITE_URL + '/commodities/' + c.slug, codes: c.codes,
  unitLabel: commodityMeta(c.codes[0]).unitLabel, spotReference: c.codes.some(code => !!commodityMeta(code).spotSymbol),
  trackedTokens: classTokens(c).map(t => {
    const live = snap?.tokens.find(x => x.id === t.id);
    const presentation = live ? viewOf(live) : null;
    return {
      id: t.id, name: t.name, label: t.label ?? null,
      status: live?.status ?? null,
      presentation,
      url: SITE_URL + '/token/' + t.id,
    };
  }),
});

/** Live JSON keeps status and checks exactly as measured. presentation is additive. */
function publicToken(t: TokenReport) {
  return { ...t, presentation: viewOf(t) };
}
function publicSnap(s: Snapshot) {
  return { ...s, presentationModel: PRESENTATION_MODEL, tokens: s.tokens.map(publicToken) };
}

// ---------- Routes ----------
const app = express();
app.disable('x-powered-by');
// Consolidate ranking signals on the custom domain: 301 the fly.dev hostname to the canonical host
// (health checks and the JSON API stay reachable on any host).
const CANONICAL_HOST = new URL(SITE_URL).host;
app.use((q, r, next) => {
  const host = q.hostname;
  if ((q.method === 'GET' || q.method === 'HEAD') && (host === 'reservewatch.fly.dev' || host === 'www.' + CANONICAL_HOST)
    && q.path !== '/healthz' && !q.path.startsWith('/api/')) return void r.redirect(301, SITE_URL + q.originalUrl);
  // Keep raw JSON / health endpoints out of search results.
  if (q.path.startsWith('/api/') || q.path === '/healthz') r.set('X-Robots-Tag', 'noindex');
  next();
});
app.get('/robots.txt', (_q, r) => { r.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(robotsTxt()); });
app.get('/llms.txt', (_q, r) => { r.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(llmsTxt()); });
// Crawlers that request /.well-known/llms.txt land on the same summary. /llms.txt stays the canonical URL.
app.get('/.well-known/llms.txt', (_q, r) => {
  r.set('Cache-Control', 'public, max-age=3600');
  r.redirect(301, `${SITE_URL}/llms.txt`);
});
app.get('/sitemap.xml', (_q, r) => {
  const live = (snap?.updatedAt ?? new Date().toISOString()).slice(0, 10);
  r.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(sitemapXml(live, LEGAL_UPDATED_ISO));
});
app.use(express.static(PUBLIC_DIR, { maxAge: '7d', index: false }));
app.get('/', (_q, r) => { r.send(listPage()); });
app.get('/token/:id', (q, r) => {
  const t = snap?.tokens.find(x => x.id === q.params.id);
  if (!t) {
    const def = TOKENS.find(x => x.id === q.params.id);
    if (def && !snap) return void r.status(503).set('Retry-After', '60').send(page({ title: tokenTitle(def), description: tokenDescription(def), path: `/token/${def.id}`, refresh: true, body: `<h1>${esc(def.name)}</h1>${header()}` }));
    return void r.status(snap ? 404 : 503).send(page({ title: 'Not found · ReserveWatch', description: 'This page does not exist on ReserveWatch.', path: q.path, noindex: true, body: `<h1>Not found</h1>${snap ? '<p>Unknown token. <a href="/">See all monitored XRPL commodity tokens</a> or <a href="/commodities">browse by commodity</a>.</p>' : header()}` }));
  }
  r.send(tokenPage(t));
});
app.get('/alerts', (_q, r) => {
  const rows = readAlerts().map(a => `<tr><td class="muted">${esc(a.at)}</td><td><a href="/token/${esc(a.tokenId)}">${esc(a.tokenId)}</a></td><td>${a.from ? badge(a.from) : 'new'} → ${badge(a.to)}</td><td>${a.reasons.map(esc).join('<br>')}</td></tr>`).join('');
  r.send(page({
    title: 'XRPL Commodity Token Health Alert Log · ReserveWatch',
    description: 'History of automated health-status changes (OK, WARN, CRITICAL) for gold, silver, platinum, energy, diamond and other commodity tokens on the XRP Ledger, with the on-ledger reasons for each change. Not investment advice.',
    path: '/alerts', refresh: true,
    body: `<h1>Health status alert log</h1><p class="muted">Alerts follow the <b>legacy overall</b> (the worst raw check: OK, WARN, CRITICAL). They do not fire because a comparison chip is a feature or a gap. A legacy move can be clawback, a missing pool, or an unconfirmed link — read the reasons. The live comparison is on each token page. Labels are not reserves or solvency, and not buy or sell signals.</p><table><tr><th>At</th><th>Token</th><th>Legacy change</th><th>Reasons (raw checks)</th></tr>${rows || '<tr><td colspan="4" class="muted">No status changes recorded yet.</td></tr>'}</table>` }));
});
app.get('/methodology', (_q, r) => { r.send(infoPage('How ReserveWatch Compares XRPL Commodity Tokens · ReserveWatch', 'Methodology: comparison labels and the legacy overall', '/methodology', 'How ReserveWatch separates measured liquidity and peg, issuer-control features, and unconfirmed or unmeasurable gaps from active problems. The legacy OK / WARN / CRITICAL overall is the worst raw check and is not rewritten. Not an audit or proof of reserves.', METHODOLOGY(), COMPARE_UPDATED)); });
app.get('/faq', (_q, r) => { r.send(faqPage()); });
app.get('/about', (_q, r) => { r.send(infoPage('About ReserveWatch — Independent XRPL Commodity Token Monitor', 'About ReserveWatch', '/about', 'ReserveWatch is an independent, issuer-neutral monitor of commodity tokens on the XRP Ledger — gold, silver, platinum, energy, diamonds and more. It compares issuer controls, liquidity, and public verification. What it watches, what it does not do, and how to contact us.', ABOUT(), COMPARE_UPDATED)); });
app.get('/independent', (_q, r) => { r.send(page({
  title: 'Independent XRPL Commodity Monitor — Not a Custodian, Issuer or Auditor · ReserveWatch', description: INDEPENDENT_DESC, path: '/independent', ogType: 'article',
  jsonLd: [breadcrumbLd([{ name: 'ReserveWatch', path: '/' }, { name: 'Independence', path: '/independent' }]), {
    '@context': 'https://schema.org', '@type': 'AboutPage', '@id': SITE_URL + '/independent#page', url: SITE_URL + '/independent',
    name: 'ReserveWatch independence statement', description: INDEPENDENT_DESC, inLanguage: 'en', dateModified: LEGAL_UPDATED_ISO,
    about: { '@id': SITE_URL + '/#organization' }, isPartOf: { '@id': SITE_URL + '/#website' }, publisher: { '@id': SITE_URL + '/#organization' },
    significantLink: [SITE_URL + '/methodology', SITE_URL + '/disclaimer', SITE_URL + '/about'],
  }],
  body: `<div class="legal"><h1>Independent by design</h1><p class="muted">Last updated ${COMPARE_UPDATED}</p>${INDEPENDENT()}</div>` })); });
app.get('/disclaimer', (_q, r) => { r.send(legalPage('Disclaimer', '/disclaimer', 'ReserveWatch publishes automated readings of public XRP Ledger data. It does not audit vaults or attest to reserves, and nothing on the site is investment, financial, legal or tax advice.', DISCLAIMER, COMPARE_UPDATED)); });
app.get('/terms', (_q, r) => { r.send(legalPage('Terms of use', '/terms', 'Terms of use for the ReserveWatch website and public JSON API: informational service, no warranty, acceptable use and attribution.', TERMS)); });
app.get('/contact', (_q, r) => { r.send(legalPage('Contact', '/contact', 'Contact ReserveWatch: issuer corrections and verification requests, data or bug reports, press and partnership inquiries.', CONTACT)); });
app.get('/privacy', (_q, r) => { r.send(legalPage('Privacy policy', '/privacy', 'How ReserveWatch handles data: no accounts, wallets or login cookies; standard server logs; optional cookie-free aggregate analytics; no sale of personal data; how to make a privacy request.', PRIVACY())); });
app.get('/snapshots', (_q, r) => { r.send(snapshotsIndex()); });
app.get('/snapshots/:week', (q, r) => {
  const s = SNAPSHOTS.find(x => x.week === q.params.week);
  if (!s) return void r.status(404).send(page({ title: 'Not found · ReserveWatch', description: 'This page does not exist on ReserveWatch.', path: q.path, noindex: true, body: '<h1>Not found</h1><p>No snapshot for that week. <a href="/snapshots">See all weekly snapshots</a>.</p>' }));
  r.send(snapshotPage(s));
});
app.get('/briefs', (_q, r) => { r.send(briefsIndex()); });
app.get('/briefs/:slug', (q, r) => {
  const b = BRIEFS.find(x => x.slug === q.params.slug);
  if (!b) return void r.status(404).send(page({ title: 'Not found · ReserveWatch', description: 'This page does not exist on ReserveWatch.', path: q.path, noindex: true, body: '<h1>Not found</h1><p>No brief with that slug. <a href="/briefs">See all briefs</a>.</p>' }));
  r.send(briefPage(b));
});
app.get('/commodities', (_q, r) => { r.send(commoditiesIndex()); });
app.get('/commodities/:slug', (q, r) => {
  const c = CLASS_PAGES.find(x => x.slug === q.params.slug);
  if (!c) return void r.status(404).send(page({ title: 'Not found · ReserveWatch', description: 'This page does not exist on ReserveWatch.', path: q.path, noindex: true, body: '<h1>Not found</h1><p>Unknown commodity. <a href="/commodities">See all commodity classes</a>.</p>' }));
  r.send(commodityPage(c));
});
app.get('/api/commodities', (_q, r) => { r.json({ updatedAt: snap?.updatedAt ?? null, classes: CLASS_PAGES.map(commodityJson) }); });
app.get('/api/commodities/:slug', (q, r) => { const c = CLASS_PAGES.find(x => x.slug === q.params.slug); c ? r.json(commodityJson(c)) : r.status(404).json({ error: 'not found' }); });
app.get('/learn', (_q, r) => { r.send(learnIndex()); });
app.get('/learn/clawback-freeze-trust-lines', (_q, r) => { r.send(clawbackPillar()); });
for (const g of LEARN_GUIDES) app.get(`/learn/${g.slug}`, (_q, r) => { r.send(learnGuidePage(g)); });
app.get('/api/tokens', (_q, r) => { snap ? r.json(publicSnap(snap)) : r.status(503).json({ error: lastError ?? 'warming up' }); });
app.get('/api/tokens/:id', (q, r) => {
  const t = snap?.tokens.find(x => x.id === q.params.id);
  t ? r.json(publicToken(t)) : r.status(404).json({ error: 'not found' });
});
app.get('/healthz', (_q, r) => {
  const ageSec = snap ? (Date.now() - Date.parse(snap.updatedAt)) / 1000 : null;
  const ok = ageSec != null && ageSec < POLL_SEC * 3 + 120;
  r.status(ok ? 200 : 503).json({ ok, updatedAt: snap?.updatedAt ?? null, ageSec, lastError });
});
// Manual refresh: requires REFRESH_TOKEN (header x-refresh-token) when set; always rate-limited so the
// public endpoint cannot be used to hammer shared XRPL servers.
app.post('/api/refresh', async (q, r) => {
  const tok = process.env.REFRESH_TOKEN;
  if (tok && q.get('x-refresh-token') !== tok) return void r.status(403).json({ error: 'forbidden' });
  if (!tok && process.env.NODE_ENV === 'production') return void r.status(403).json({ error: 'set REFRESH_TOKEN to enable' });
  if (Date.now() - lastManualRefresh < 60_000) return void r.status(429).json({ error: 'rate limited (60s)' });
  lastManualRefresh = Date.now();
  await refresh(); r.json({ ok: !lastError, updatedAt: snap?.updatedAt });
});

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}  (poll every ${POLL_SEC}s)`);
  refresh();
  setInterval(refresh, POLL_SEC * 1000);
});
