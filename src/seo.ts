// Lightweight on-site SEO helpers for ReserveWatch: canonical URLs, meta/OG/Twitter tags,
// JSON-LD, robots.txt and sitemap.xml. No dependencies; everything is server-rendered strings.
import { TOKENS } from './config/tokens.js';
import { SNAPSHOTS } from './content/snapshots.js';
import { CLASS_PAGES } from './content/commodities.js';
import { LEARN_GUIDES } from './content/learn.js';

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
  'Independent, issuer-neutral monitor of commodity tokens on the XRP Ledger — gold, silver, platinum, energy, diamonds and more: supply, issuer flags, AMM liquidity, peg vs spot. Not investment advice.';

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
  description: 'Automated readings of public XRP Ledger data for commodity tokens (gold, silver, platinum, energy, diamonds and other classes as issuers appear): circulating supply, treasury exclusions, issuer account flags (freeze, clawback, authorization), AMM pool liquidity, DEX order books, on-ledger price versus spot metal price where a spot reference exists, holder concentration and xrp-ledger.toml domain verification. Health labels (OK / WARN / CRITICAL) summarize rule-based checks; they are not audits, proof of reserves, credit ratings or investment advice.',
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

// ---------- robots.txt / sitemap.xml ----------
export const robotsTxt = () => `# ${SITE_NAME} — ${SITE_URL}
User-agent: *
Allow: /
Disallow: /api/refresh
Disallow: /healthz

Sitemap: ${SITE_URL}/sitemap.xml
`;

/** Sitemap of key public URLs. `lastmod` = YYYY-MM-DD; live pages use the latest snapshot date. */
export function sitemapXml(liveDate: string, legalDate: string): string {
  const urls: { loc: string; lastmod: string; changefreq: string; priority: string }[] = [
    { loc: abs('/'), lastmod: liveDate, changefreq: 'hourly', priority: '1.0' },
    ...TOKENS.map(t => ({ loc: abs(`/token/${t.id}`), lastmod: liveDate, changefreq: 'hourly', priority: '0.8' })),
    { loc: abs('/commodities'), lastmod: liveDate, changefreq: 'daily', priority: '0.8' },
    ...CLASS_PAGES.map(c => ({ loc: abs(`/commodities/${c.slug}`), lastmod: legalDate, changefreq: 'weekly', priority: '0.7' })),
    { loc: abs('/methodology'), lastmod: legalDate, changefreq: 'monthly', priority: '0.6' },
    { loc: abs('/about'), lastmod: legalDate, changefreq: 'monthly', priority: '0.5' },
    { loc: abs('/independent'), lastmod: legalDate, changefreq: 'monthly', priority: '0.5' },
    { loc: abs('/alerts'), lastmod: liveDate, changefreq: 'daily', priority: '0.5' },
    { loc: abs('/snapshots'), lastmod: SNAPSHOTS[0]?.week ?? legalDate, changefreq: 'weekly', priority: '0.6' },
    ...SNAPSHOTS.map(s => ({ loc: abs(`/snapshots/${s.week}`), lastmod: s.week, changefreq: 'yearly', priority: '0.5' })),
    { loc: abs('/learn'), lastmod: [legalDate, ...LEARN_GUIDES.map(g => g.dateModified)].sort().at(-1)!, changefreq: 'monthly', priority: '0.5' },
    { loc: abs('/learn/clawback-freeze-trust-lines'), lastmod: legalDate, changefreq: 'monthly', priority: '0.6' },
    ...LEARN_GUIDES.map(g => ({ loc: abs(`/learn/${g.slug}`), lastmod: g.dateModified, changefreq: 'monthly', priority: '0.6' })),
    { loc: abs('/privacy'), lastmod: legalDate, changefreq: 'monthly', priority: '0.4' },
    { loc: abs('/disclaimer'), lastmod: legalDate, changefreq: 'yearly', priority: '0.3' },
    { loc: abs('/terms'), lastmod: legalDate, changefreq: 'yearly', priority: '0.3' },
    { loc: abs('/contact'), lastmod: legalDate, changefreq: 'yearly', priority: '0.3' },
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${escAttr(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
}
