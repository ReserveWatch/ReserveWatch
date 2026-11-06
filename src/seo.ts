// Lightweight on-site SEO helpers for ReserveWatch: canonical URLs, meta/OG/Twitter tags,
// JSON-LD, robots.txt and sitemap.xml. No dependencies; everything is server-rendered strings.
import { TOKENS } from './config/tokens.js';
import { SNAPSHOTS } from './content/snapshots.js';
import { CLASS_PAGES } from './content/commodities.js';
import { LEARN_GUIDES } from './content/learn.js';
import { BRIEFS } from './content/briefs.js';

export const SITE_URL = (process.env.SITE_URL || 'https://thereservewatch.com').replace(/\/+$/, '');
export const SITE_NAME = 'ReserveWatch';
export const TAGLINE = 'XRPL Commodity Reserve Health Monitor';
export const BRAND_NAVY = '#0B1F33';
export const LOGO_PATH = '/logo.png';
export const LOGO_W = 1200;
export const LOGO_H = 261;
/** 1200×630 share card (navy canvas + locked logo) used for og:image / twitter:image. */
export const OG_IMAGE_PATH = '/og-share.png';
export const OG_IMAGE_W = 1200;
export const OG_IMAGE_H = 630;
export const DEFAULT_DESCRIPTION =
  'Compare XRPL commodity tokens by issuer controls, liquidity, and public verification. Measured facts, issuer features, and information gaps are separate from active problems. Not a buy or sell rating.';

const escAttr = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const abs = (p: string) => SITE_URL + (p.startsWith('/') ? p : '/' + p);

export interface SeoMeta {
  /** Full <title> (already branded). */
  title: string;
  description: string;
  /** Path for the canonical URL, e.g. "/token/meld-gld". */
  path: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: object[];
}

/** <head> tags: description, canonical, robots, Open Graph, Twitter card, JSON-LD. */
export function seoHead(m: SeoMeta): string {
  const url = abs(m.path);
  const img = abs(OG_IMAGE_PATH);
  const ld = (m.jsonLd ?? []).map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
  return `<title>${escAttr(m.title)}</title>
<meta name="description" content="${escAttr(m.description)}">
${m.noindex ? '<meta name="robots" content="noindex,follow">' : `<link rel="canonical" href="${escAttr(url)}"><meta name="robots" content="index,follow,max-image-preview:large">`}
<meta property="og:site_name" content="${SITE_NAME}"><meta property="og:type" content="${m.ogType ?? 'website'}"><meta property="og:locale" content="en_US">
<meta property="og:title" content="${escAttr(m.title)}"><meta property="og:description" content="${escAttr(m.description)}"><meta property="og:url" content="${escAttr(url)}">
<meta property="og:image" content="${img}"><meta property="og:image:width" content="${OG_IMAGE_W}"><meta property="og:image:height" content="${OG_IMAGE_H}"><meta property="og:image:type" content="image/png"><meta property="og:image:alt" content="${SITE_NAME} — ${TAGLINE}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escAttr(m.title)}"><meta name="twitter:description" content="${escAttr(m.description)}"><meta name="twitter:image" content="${img}"><meta name="twitter:image:alt" content="${SITE_NAME} — ${TAGLINE}">
${ld}`;
}

// ---------- JSON-LD (only factual, verifiable claims) ----------
/** Official profiles for Organization.sameAs. Only add URLs of accounts ReserveWatch actually controls — never
 *  guessed handles. Not yet created as of Oct 31, 2026; fill in when they exist, e.g.:
 *    'https://x.com/<real-handle>', 'https://github.com/<real-org>'
 *  Can also be set at deploy time without a code change: SAME_AS_URLS="https://x.com/...,https://github.com/..."
 *  (comma-separated; only absolute https URLs are kept). Empty = sameAs omitted from the JSON-LD. */
const SAME_AS_STATIC: string[] = [];
export const SAME_AS: string[] = [...new Set([...SAME_AS_STATIC, ...(process.env.SAME_AS_URLS || '').split(',')]
  .map(u => u.trim()).filter(u => /^https:\/\/[^\s,]+$/.test(u)))];

export const orgLd = (email: string) => ({
  '@context': 'https://schema.org', '@type': 'Organization', '@id': SITE_URL + '/#organization',
  name: SITE_NAME, url: SITE_URL + '/', logo: { '@type': 'ImageObject', url: abs(LOGO_PATH), width: LOGO_W, height: LOGO_H },
  slogan: TAGLINE, email,
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email, url: abs('/contact'), availableLanguage: 'en' },
  ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
});

export const websiteLd = () => ({
  '@context': 'https://schema.org', '@type': 'WebSite', '@id': SITE_URL + '/#website',
  name: SITE_NAME, alternateName: `${SITE_NAME} — ${TAGLINE}`, url: SITE_URL + '/', inLanguage: 'en',
  description: DEFAULT_DESCRIPTION, publisher: { '@id': SITE_URL + '/#organization' },
});

/** Dataset: the public JSON API really is a free, machine-readable feed of these readings. */
export const datasetLd = (updatedAt?: string) => ({
  '@context': 'https://schema.org', '@type': 'Dataset', '@id': SITE_URL + '/#dataset',
  name: 'XRPL commodity token on-ledger health readings',
  description: 'Automated readings of public XRP Ledger data for commodity tokens (gold, silver, platinum, energy, diamonds and other classes as issuers appear): circulating supply, treasury exclusions, issuer account flags (freeze, clawback, authorization), AMM pool liquidity, DEX order books, on-ledger price versus spot metal price where a spot reference exists, holder concentration and xrp-ledger.toml domain verification. The presentation field compares market, issuer controls, and identity without rewriting checks. status and checks remain the legacy worst-check aggregate (OK / WARN / CRITICAL). They are not audits, proof of reserves, credit ratings, or investment advice. RLUSD and USDV are valued at a nominal $1.',
  url: SITE_URL + '/', isAccessibleForFree: true, inLanguage: 'en',
  keywords: ['XRP Ledger', 'XRPL', 'tokenized gold', 'tokenized silver', 'tokenized platinum', 'tokenized energy', 'tokenized diamonds', 'tokenized commodities', 'commodity tokens', 'on-ledger data', 'AMM liquidity', 'issuer flags'],
  creator: { '@id': SITE_URL + '/#organization' }, publisher: { '@id': SITE_URL + '/#organization' },
  ...(updatedAt ? { dateModified: updatedAt } : {}),
  measurementTechnique: 'Automated queries of public XRPL mainnet servers (account_info, gateway_balances, account_lines, amm_info, book_offers) plus a public spot metal price API for gold, silver, platinum and palladium',
  distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: abs('/api/tokens') }],
});

export const breadcrumbLd = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
});

/** One question the page already answers, in plain text (no HTML, no new claims). */
export interface FaqItem { q: string; a: string }

/** FAQPage JSON-LD. Pass only Q&A taken from that page's existing copy. */
export const faqPageLd = (items: FaqItem[]) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: items.filter(it => it.q.trim() && it.a.trim()).map(it => ({
    '@type': 'Question', name: it.q,
    acceptedAnswer: { '@type': 'Answer', text: it.a },
  })),
});

// ---------- robots.txt / sitemap.xml / llms.txt ----------
export const robotsTxt = () => `# ${SITE_NAME} — ${SITE_URL}
# Search and AI crawlers are allowed, including GPTBot, ClaudeBot, Google-Extended, PerplexityBot, Applebot-Extended, and CCBot.
User-agent: *
Allow: /
Disallow: /api/refresh
Disallow: /healthz

Sitemap: ${SITE_URL}/sitemap.xml
# Summary for language models: ${SITE_URL}/llms.txt
`;

/** Short, machine-readable site summary (llms.txt). Facts only; no issuer addresses. */
export function llmsTxt(): string {
  const learn = [
    { href: abs('/learn/clawback-freeze-trust-lines'), title: 'Clawback, freeze and trust lines', note: 'What an issuer can and cannot do to tokens held on a trust line.' },
    ...LEARN_GUIDES.map(g => ({ href: abs(`/learn/${g.slug}`), title: g.crumb, note: g.blurb })),
  ];
  return `# ${SITE_NAME}

> ${TAGLINE}. ${DEFAULT_DESCRIPTION}

${SITE_NAME} reads public XRP Ledger data for tokens that say they represent a commodity. The live pages compare three categories: market and peg, issuer controls, and identity / verification. Measured means a reading was taken (not a safety rating and not proof of backing). Feature means an issuer power or holder structure is on, such as clawback, restricted access, or a concentrated holder (not an adverse event, and not risk-free). Not measurable and not confirmed mean the data is missing: no pool is not a broken peg, and an unconfirmed issuer link is not a fraud finding. Caution and Critical are reserved for an active problem or conflicting public records (Global Freeze, a reliable peg far from spot, issuer records that disagree with the account). The legacy OK / WARN / CRITICAL overall is the worst raw check. It is still the API status field and the label stored on historical snapshots. A feature or a gap still makes that legacy overall WARN. It is not a buy or sell rating. "Unverified listing" is the records-conflict case. "Issuer link unconfirmed" is the not-confirmed case. A label is not an allegation. RLUSD and USDV pools are valued at a nominal $1 (issuer-stated peg, not verified).

## What ${SITE_NAME} is not

- Not a vault audit and not proof of reserves. On-ledger supply counts tokens. It does not show that a physical commodity exists.
- Not investment, financial, legal, or tax advice. Comparison labels and the legacy OK, WARN, and CRITICAL overall are not credit ratings, recommendations, or opinions on solvency. Measured does not mean safe.
- Not a custodian and not an issuer. ${SITE_NAME} does not hold funds, run wallets, or ask for seeds, private keys, or payments.
- Not affiliated with Ripple, the XRPL Foundation, or any token issuer it lists.

## Key pages

- [Home](${abs('/')}): live comparison of issuer controls, liquidity, and public verification.
- [Methodology](${abs('/methodology')}): how comparison labels differ from the legacy OK / WARN / CRITICAL overall, including peg vs spot.
- [Learn](${abs('/learn')}): plain-language explainers.
${learn.map(l => `- [${l.title}](${l.href}): ${l.note}`).join('\n')}
- [Commodities](${abs('/commodities')}): asset classes on the XRP Ledger, including classes with no public issuer tracked yet.
- [Weekly snapshots](${abs('/snapshots')}): frozen weekly copies of the automated checks. Each week: ${abs('/snapshots')}/{YYYY-MM-DD}.
- [Briefs](${abs('/briefs')}): short dated notes when a new commodity issuer appears or a CRITICAL / soft-label situation is worth documenting. Each brief: ${abs('/briefs')}/{slug}.
- [About](${abs('/about')}): what ${SITE_NAME} watches and what it does not do.
- [Independence](${abs('/independent')}): not a custodian, issuer, vault auditor, or investment advice.
- [Dataset JSON API](${abs('/api/tokens')}): free JSON readings (application/json). Free to cite.

## Citation

The Dataset JSON API is free to cite: ${abs('/api/tokens')}
Attribute "${SITE_NAME}" and link the API URL or the page a reading came from. Per-token JSON is ${abs('/api/tokens')}/{id}.
Cache responses. Acceptable use: ${abs('/terms')}
Do not describe the labels as an audit, proof of reserves, a credit rating, or investment advice. Readings can be delayed, incomplete, or wrong. Confirm with the issuer and an independent explorer.
Limits: ${abs('/disclaimer')}
Corrections: ${abs('/contact')}
`;
}

/** Sitemap of key public URLs. `lastmod` = YYYY-MM-DD; live pages use the latest snapshot date. */
export function sitemapXml(liveDate: string, legalDate: string): string {
  const urls: { loc: string; lastmod: string; changefreq: string; priority: string }[] = [
    { loc: abs('/'), lastmod: liveDate, changefreq: 'hourly', priority: '1.0' },
    ...TOKENS.map(t => ({ loc: abs(`/token/${t.id}`), lastmod: liveDate, changefreq: 'hourly', priority: '0.8' })),
    { loc: abs('/commodities'), lastmod: liveDate, changefreq: 'daily', priority: '0.8' },
    ...CLASS_PAGES.map(c => ({ loc: abs(`/commodities/${c.slug}`), lastmod: legalDate, changefreq: 'weekly', priority: '0.7' })),
    { loc: abs('/methodology'), lastmod: '2026-11-06', changefreq: 'monthly', priority: '0.6' },
    { loc: abs('/about'), lastmod: '2026-11-06', changefreq: 'monthly', priority: '0.5' },
    { loc: abs('/independent'), lastmod: '2026-11-06', changefreq: 'monthly', priority: '0.5' },
    { loc: abs('/alerts'), lastmod: liveDate, changefreq: 'daily', priority: '0.5' },
    { loc: abs('/snapshots'), lastmod: SNAPSHOTS[0]?.week ?? legalDate, changefreq: 'weekly', priority: '0.6' },
    ...SNAPSHOTS.map(s => ({ loc: abs(`/snapshots/${s.week}`), lastmod: s.week, changefreq: 'yearly', priority: '0.5' })),
    { loc: abs('/briefs'), lastmod: BRIEFS[0]?.date ?? legalDate, changefreq: 'weekly', priority: '0.6' },
    ...BRIEFS.map(b => ({ loc: abs(`/briefs/${b.slug}`), lastmod: b.date, changefreq: 'yearly', priority: '0.5' })),
    { loc: abs('/learn'), lastmod: [legalDate, ...LEARN_GUIDES.map(g => g.dateModified)].sort().at(-1)!, changefreq: 'monthly', priority: '0.5' },
    { loc: abs('/learn/clawback-freeze-trust-lines'), lastmod: '2026-11-06', changefreq: 'monthly', priority: '0.6' },
    ...LEARN_GUIDES.map(g => ({ loc: abs(`/learn/${g.slug}`), lastmod: g.dateModified, changefreq: 'monthly', priority: '0.6' })),
    { loc: abs('/faq'), lastmod: '2026-11-06', changefreq: 'monthly', priority: '0.6' },
    { loc: abs('/privacy'), lastmod: legalDate, changefreq: 'monthly', priority: '0.4' },
    { loc: abs('/disclaimer'), lastmod: '2026-11-06', changefreq: 'yearly', priority: '0.3' },
    { loc: abs('/terms'), lastmod: legalDate, changefreq: 'yearly', priority: '0.3' },
    { loc: abs('/contact'), lastmod: legalDate, changefreq: 'yearly', priority: '0.3' },
    { loc: abs('/llms.txt'), lastmod: '2026-11-06', changefreq: 'monthly', priority: '0.3' },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${escAttr(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
}
