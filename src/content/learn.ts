// Learn hub pillar explainers (/learn/:slug). Clear Money Voice: plain words, on-ledger facts, issuer-neutral,
// no investment advice, no vault-audit or proof-of-reserves claims. Rules described here must match monitor.ts.
// Bodies are HTML builders; server.ts passes live thresholds and helpers so numbers never drift from the code.

export interface LearnCtx {
  /** AMM TVL (USD) at or above which a peg reading is graded. */
  lowLiqUsd: number; pegWarnPct: number; pegCritPct: number; maxSpreadPct: number; concWarnPct: number;
  badge: (s: 'ok' | 'warn' | 'critical') => string;
  /** Pre-rendered live table rows (or '') supplied by server.ts. */
  liveTable?: string;
  asOf?: string;
}

export interface LearnGuide {
  slug: string;
  /** <title> */
  title: string;
  h1: string;
  /** Short breadcrumb name. */
  crumb: string;
  description: string;
  /** One-line summary for the /learn hub. */
  blurb: string;
  datePublished: string;
  dateModified: string;
  body: (c: LearnCtx) => string;
  /** Extra JSON-LD beyond Breadcrumb + Article (e.g. DefinedTermSet). */
  extraLd?: (url: string) => object[];
  /** FAQPage entries: questions this page already answers. Plain text; same facts as `body`. */
  faq?: (c: LearnCtx) => { q: string; a: string }[];
}

const n0 = (n: number) => n.toLocaleString('en-US');
const pill = (t: string) => `<span class="pill">${t}</span>`;

// ---------- 1. Peg vs spot ----------
const PEG_VS_SPOT: LearnGuide = {
  slug: 'peg-vs-spot',
  title: 'Peg vs Spot for XRPL Gold & Metal Tokens: How It Is Measured · ReserveWatch',
  h1: 'Peg vs spot: how ReserveWatch compares on-ledger prices with metal prices',
  crumb: 'Peg vs spot',
  description: 'How ReserveWatch compares the on-ledger price of XRPL gold, silver and platinum tokens with spot metal prices: AMM pools in XRP, RLUSD and USDV, the ~$10k liquidity gate, and why non-metal tokens are "not measured". Not advice.',
  blurb: 'How on-ledger prices are compared with spot, and when the number means something.',
  datePublished: '2026-10-31', dateModified: '2026-11-06',
  body: c => `<p class="notice"><b>Short version:</b> For gold, silver, platinum and palladium tokens, ReserveWatch compares two numbers: the <b>spot price</b> of the metal a token says it represents, and the <b>price the token trades at on the XRP Ledger</b>. The gap is the <b>peg deviation</b>. We only grade that gap when the token's AMM pools hold at least about $${n0(c.lowLiqUsd)}. A thin pool or no pool is <b>not measurable</b>, not a broken peg. A peg reading describes trading prices only. It is not proof that metal exists in a vault, and it is not a signal to buy or sell.</p>

<h2>1. The two numbers</h2>
<ul>
<li><b>Spot price per token.</b> We load the spot price per troy ounce (31.1035 g) for gold, silver, platinum or palladium from a public price API. Then we convert it using the weight each issuer says one token represents. A 1-gram gold token's spot value is the gold price divided by 31.1035.</li>
<li><b>On-ledger price.</b> We read the token's AMM (automated market maker) pools on the XRP Ledger against three quote assets: <b>XRP</b>, <b>RLUSD</b> and <b>USDV</b> (Valtorum USD). Each pool implies a price from the ratio of its two reserves. If a token has more than one live pool, we take a TVL-weighted average, so deeper pools count more. The token page names which pools contributed.</li>
</ul>
<p>Peg deviation = (on-ledger price − spot price per token) ÷ spot price per token, shown as a percentage. A positive number means the token traded above spot; a negative number means below.</p>

<h2>2. Quote assets: XRP, RLUSD and USDV</h2>
<ul>
<li><b>XRP</b> pools are converted to US dollars with a live XRP/USD rate.</li>
<li><b>RLUSD</b> and <b>USDV</b> pools are valued at a nominal $1 per unit. We do not check those stablecoins' own reserves, and USDV is never graded as a commodity.</li>
<li>USDV pools were added to the count after the first ledger snapshot (October 30, 2026). Many Assetiko metal pairs trade against USDV, so their liquidity and peg readings now include USDV pools that were not counted before.</li>
</ul>

<h2>3. When the peg reading is reliable</h2>
<p>A small pool can sit far from spot simply because nobody has traded it back into line. That is a liquidity fact, not a broken peg. So ReserveWatch uses a <b>liquidity gate</b>:</p>
<ul>
<li><b>Reliable</b> — the price comes from AMM pools holding at least about <b>$${n0(c.lowLiqUsd)}</b> in total value locked (TVL). Only then is the deviation graded. Under ${c.pegWarnPct}% the comparison says <b>price near spot</b> (measured — a trading price, not a safety rating). From ${c.pegWarnPct}% up to ${c.pegCritPct}% is a prominent caution. ${c.pegCritPct}% or more is critical. The raw check uses the same bands: ${c.badge('ok')}, ${c.badge('warn')}, ${c.badge('critical')}.</li>
<li><b>Not measurable</b> — pools below the gate, or no pool at all. If there is no pool, we may read the middle of the best bid and ask on the DEX order book (only when the spread is ${c.maxSpreadPct}% or less), but an order-book price is <b>never</b> graded as reliable because we do not measure its depth. The comparison shows "Peg not measurable" as a gap, not as a broken peg. The raw check is still ${c.badge('warn')}, which can make the legacy overall WARN. The raw number is kept and marked not graded.</li>
</ul>

<h2>4. Commodities with no spot reference: "not measured"</h2>
<p>Oil, natural gas, electricity, uranium, copper, diamonds, timber and crops have no single free, public spot price that maps cleanly onto a token. Contracts differ by grade, location and delivery terms. So for those classes ReserveWatch shows <b>"price vs spot not measured"</b> instead of a guess. Every other ledger check (supply, issuer flags, liquidity, holders, domain verification) still runs. Each <a href="/commodities">commodity page</a> explains why.</p>

<h2>5. What a peg reading does — and does not — tell you</h2>
<ul>
<li><b>It does</b> show whether the token's on-ledger trading price is close to the value of the metal it says it represents, at the time of reading.</li>
<li><b>It does not</b> show that the metal exists, is insured, or can be redeemed. ReserveWatch does not audit vaults or custodians, and on-ledger data is not proof of reserves.</li>
<li><b>It does not</b> tell anyone to buy, sell or hold. A token near spot can still carry other risks (clawback, freeze, concentration); a token far from spot may simply have a thin pool.</li>
</ul>

${c.liveTable ? `<h2>6. Live readings${c.asOf ? ` <span class="muted" style="font-size:14px;font-weight:400">(as of ${c.asOf})</span>` : ''}</h2>${c.liveTable}<p class="muted">Live values update about every five minutes on each token page and in the free <a href="/api/tokens">JSON API</a> (<code>peg</code> and <code>liquidity</code> fields).</p>` : ''}

<p class="muted">Related: <a href="/methodology#peg">Methodology: peg</a> · <a href="/learn/glossary">Glossary</a> · <a href="/learn/unverified-listings">Unverified listings explained</a> · <a href="/snapshots">Ledger snapshots</a> · <a href="/learn">All guides</a> · <a href="/disclaimer">Disclaimer</a></p>`,
  faq: c => [
    { q: 'What is peg deviation?', a: `For gold, silver, platinum and palladium tokens, ReserveWatch compares the spot price of the metal a token says it represents with the price the token trades at on the XRP Ledger. The gap is the peg deviation: (on-ledger price − spot price per token) ÷ spot price per token, shown as a percentage. A positive number means the token traded above spot; a negative number means below. A peg reading describes trading prices only. It is not proof that metal exists in a vault, and it is not a signal to buy or sell.` },
    { q: 'When is a peg reading graded?', a: `ReserveWatch grades the gap only when the token's AMM pools hold at least about $${n0(c.lowLiqUsd)} in total value locked. Under ${c.pegWarnPct}% the comparison says price near spot (measured, not a safety rating) and the raw check is OK. From ${c.pegWarnPct}% up to ${c.pegCritPct}% is a caution, and the raw check is WARN. ${c.pegCritPct}% or more is critical on both the comparison and the raw check. Pools below that gate, or no pool at all, are not measurable: the comparison shows a gap, not a broken peg, and the raw check stays WARN. If there is no pool, the middle of the best bid and ask on the DEX order book may be shown when the spread is ${c.maxSpreadPct}% or less, but an order-book price is never graded as reliable.` },
    { q: 'Which commodities show "price vs spot not measured"?', a: 'Oil, natural gas, electricity, uranium, copper, diamonds, timber and crops have no single free, public spot price that maps cleanly onto a token. For those classes ReserveWatch shows "price vs spot not measured" instead of a guess. Every other ledger check (supply, issuer flags, liquidity, holders, domain verification) still runs.' },
    { q: 'What does a peg reading not show?', a: 'It does not show that the metal exists, is insured, or can be redeemed. ReserveWatch does not audit vaults or custodians, and on-ledger data is not proof of reserves. It does not tell anyone to buy, sell or hold. A token near spot can still carry other risks (clawback, freeze, concentration); a token far from spot may simply have a thin pool.' },
  ],
};

// ---------- 2. Unverified listings / issuer link unconfirmed ----------
const UNVERIFIED: LearnGuide = {
  slug: 'unverified-listings',
  title: 'Unverified Listing & Issuer Link Unconfirmed: What the Labels Mean · ReserveWatch',
  h1: '"Unverified listing" and "Issuer link unconfirmed": what the labels mean',
  crumb: 'Unverified listings',
  description: 'What ReserveWatch means by "Unverified listing" and "Issuer link unconfirmed" on XRPL commodity tokens, how two-way domain and xrp-ledger.toml verification works, and what the labels do not mean. Not an allegation.',
  blurb: 'Two soft labels, what they mean, and what they do not mean.',
  datePublished: '2026-10-31', dateModified: '2026-11-06',
  body: c => `<p class="notice"><b>Short version:</b> On the XRP Ledger, anyone can create a token with any name. So ReserveWatch checks whether the project a token points to <b>confirms the issuer account itself</b>. A project list that leaves the account out is a <b>records conflict</b> (a prominent caution). A project that simply has not published a listing is <b>not confirmed</b>. Those are different. A label is a statement about what we could verify. It is <b>not</b> an accusation, and it says nothing about anyone's intentions or reserves.</p>

<h2>1. Why issuer identity needs checking</h2>
<p>A token on the XRP Ledger is identified by its <b>issuer address</b> plus a <b>currency code</b>. The code ("GOLD", "XAU") is not unique: two different accounts can issue tokens with the same code. The only reliable way to know which token belongs to which project is for the project to publish the issuer address itself, in a place it controls.</p>

<h2>2. Two-way domain verification</h2>
<p>The XRP Ledger has a standard way to do this, described in the XRPL documentation for <code>xrp-ledger.toml</code>:</p>
<ol>
<li><b>Ledger → website.</b> The issuer account sets its <b>Domain</b> field on the ledger (for example <code>example.com</code>).</li>
<li><b>Website → ledger.</b> That website publishes a file at <code>https://example.com/.well-known/xrp-ledger.toml</code> that lists the issuer address.</li>
</ol>
<p>When both directions match, the comparison says <b>Identity confirmed</b> (measured). That confirms the account link only. It is not a backing guarantee. If the account claims a domain but the file is missing or does not list the account, the comparison says <b>Domain not confirmed</b>. The raw domain check is still ${c.badge('warn')}. One direction alone is not enough: anyone can type any domain into their account's Domain field. A missing file is not the same as a project token list that contradicts the account.</p>

<h2>3. "${pill('Unverified listing')}" — what it means</h2>
<p><b>It means:</b> the issuer account points to a project (for example through its on-ledger Domain), but that project's own published token list or <code>xrp-ledger.toml</code> does <b>not</b> include this account. The project's own source and the account disagree, so identity and backing could not be confirmed from those sources. The comparison shows this as <b>Critical — records conflict</b>, and the raw check is ${c.badge('critical')}. A holder cannot tell from those public sources whether the token is connected to the project it references. That is conflicting evidence. It is not a fraud finding.</p>

<h2>4. "${pill('Issuer link unconfirmed')}" — what it means</h2>
<p><b>It means:</b> third-party registries or data providers attribute the account to a project, but the project itself publishes no <code>xrp-ledger.toml</code> or official page listing the account. Nothing contradicts the link; it simply cannot be confirmed from the issuer's own channels. The comparison shows <b>Not confirmed</b>, not Critical. The raw check is still ${c.badge('warn')}, so the legacy overall can be WARN for this gap alone. It is common for newer or institution-only (represented) assets that are not marketed to the public.</p>

<h2>5. What neither label means</h2>
<ul>
<li>It is <b>not</b> a fraud finding, and it does not state that the token is unbacked.</li>
<li>ReserveWatch makes <b>no allegation</b> against any person or company.</li>
<li>It does <b>not</b> mean a token without the label is safe or fully backed. Verified identity is one check among many, and ReserveWatch does not audit vaults or attest to reserves.</li>
<li>It is <b>not</b> investment advice or a recommendation about any token.</li>
</ul>

<h2>6. How a label is removed</h2>
<p>Labels follow published rules, the same for every issuer. A label comes off when the project confirms the account from a source it controls — usually by listing the issuer address in its <code>xrp-ledger.toml</code> or on an official token page. Issuers can also <a href="/contact">contact us</a> with that link and we will review the listing.</p>

<h2>7. How to check a token yourself</h2>
<ol>
<li>Copy the issuer address from the token page (it links to a public explorer).</li>
<li>Find the project's official website from a source you trust, not from the token itself.</li>
<li>Open <code>/.well-known/xrp-ledger.toml</code> on that site, or its official token page, and look for the exact issuer address.</li>
<li>If the address is not there, treat the link between the token and the project as unconfirmed.</li>
</ol>
${c.liveTable ? `<h2>Tokens currently carrying a label${c.asOf ? ` <span class="muted" style="font-size:14px;font-weight:400">(as of ${c.asOf})</span>` : ''}</h2>${c.liveTable}<p class="muted">Shown for transparency only — not an endorsement, and not an allegation of wrongdoing.</p>` : ''}

<p class="muted">Related: <a href="/methodology">Methodology</a> · <a href="/learn/glossary">Glossary</a> · <a href="/learn/clawback-freeze-trust-lines">Clawback, freeze and trust lines</a> · <a href="/independent">Independence</a> · <a href="/learn">All guides</a> · <a href="/disclaimer">Disclaimer</a></p>`,
  faq: () => [
    { q: 'What does "Unverified listing" mean?', a: 'The issuer account points to a project (for example through its on-ledger Domain), but that project\'s own published token list or xrp-ledger.toml does not include this account. The project\'s own source and the account disagree, so ReserveWatch cannot confirm identity or backing from those sources. The comparison shows this as a Critical records conflict, and the raw check is CRITICAL. A label is a statement about what could be verified. It is not an accusation and not a fraud finding.' },
    { q: 'What does "Issuer link unconfirmed" mean?', a: 'Third-party registries or data providers attribute the account to a project, but the project itself publishes no xrp-ledger.toml or official page listing the account. Nothing contradicts the link; it simply cannot be confirmed from the issuer\'s own channels. The comparison shows Not confirmed, not Critical. The raw check is still WARN. It is common for newer or institution-only (represented) assets that are not marketed to the public.' },
    { q: 'What do these labels not mean?', a: 'Neither label is a fraud finding, and neither states that a token is unbacked. ReserveWatch makes no allegation against any person or company. A token without the label is not thereby safe or fully backed. Verified identity is one check among many, and ReserveWatch does not audit vaults or attest to reserves. Neither label is investment advice or a recommendation about any token.' },
    { q: 'How does a label come off?', a: 'Labels follow published rules, the same for every issuer. A label comes off when the project confirms the account from a source it controls — usually by listing the issuer address in its xrp-ledger.toml or on an official token page.' },
  ],
};

// ---------- 3. Glossary ----------
export interface GlossaryTerm { id: string; term: string; def: (c: LearnCtx) => string }
export const GLOSSARY: GlossaryTerm[] = [
  { id: 'amm-tvl', term: 'AMM TVL', def: c => `<b>Automated market maker total value locked.</b> An AMM pool on the XRP Ledger holds two assets (for example a gold token and XRP) and lets anyone trade against it. TVL is the US-dollar value of everything in the pool. ReserveWatch adds up a token's pools against XRP, RLUSD and USDV. Below about $${n0(c.lowLiqUsd)}, the pool is treated as too thin for a meaningful price.` },
  { id: 'circulating-vs-treasury', term: 'Circulating vs treasury supply', def: () => `<b>Raw obligations</b> are every token the issuer has outstanding on trust lines. <b>Treasury</b> is the part held by wallets the issuer says it controls (pre-issued or not yet sold). <b>Circulating supply</b> is raw obligations minus treasury. On-ledger supply counts tokens; it does not prove any physical asset exists.` },
  { id: 'trust-line', term: 'Trust line', def: () => `The link an account must open to an issuer before it can hold that issuer's token. Each trust line ties one holder to one issuer for one currency code. <a href="/learn/clawback-freeze-trust-lines">More on trust lines</a>.` },
  { id: 'clawback', term: 'Clawback', def: c => `An issuer setting (<code>allowTrustLineClawback</code>) that lets the issuer pull tokens back out of a holder's account. It can only be turned on before the issuer has any trust lines, and it cannot be turned off. The comparison shows it as a <b>Feature</b>: some regulated issuers choose it, holders do not have final control of their balance, and the label does not say a clawback has happened or that the power is risk-free. The raw check is still ${c.badge('warn')}, so the legacy overall can be WARN for this feature alone.` },
  { id: 'freeze-nofreeze', term: 'Freeze / NoFreeze', def: () => `By default an issuer can <b>freeze</b> an individual trust line, which stops that holder sending the token to anyone except the issuer. Setting <b>NoFreeze</b> gives up that power permanently. "Can freeze" is shown as normal context, not as a problem.` },
  { id: 'global-freeze', term: 'Global Freeze', def: c => `An issuer setting that freezes <b>every</b> trust line at once, so the token cannot move between holders. ReserveWatch marks it ${c.badge('critical')}. An issuer that has set NoFreeze cannot turn Global Freeze on.` },
  { id: 'requireauth', term: 'RequireAuth', def: () => `An issuer setting that requires the issuer to approve each trust line before it can hold tokens. Common for regulated or institution-only tokens. Shown as context, not as a problem.` },
  { id: 'domain-toml', term: 'Domain / xrp-ledger.toml', def: () => `The <b>Domain</b> is a website name an issuer account can set on the ledger. The <b>xrp-ledger.toml</b> file is published by that website at <code>/.well-known/xrp-ledger.toml</code> and can list the issuer's accounts. When both point at each other, the issuer is verified two ways. <a href="/learn/unverified-listings">More on verification</a>.` },
  { id: 'health-labels', term: 'OK / WARN / CRITICAL', def: c => `The <b>legacy overall</b>. Each raw check is ${c.badge('ok')}, ${c.badge('warn')} or ${c.badge('critical')}, and a token's legacy overall is its worst check. A feature such as clawback, or a gap such as "no pool", still makes that overall WARN. The live comparison (measured, feature, not confirmed / not measurable, caution) is separate and does not rewrite these checks. Neither model is a rating, an audit, an opinion on solvency, or advice. <a href="/methodology">How classification works</a>.` },
  { id: 'peg-deviation', term: 'Peg deviation', def: c => `How far a metal token's on-ledger price is from the spot price of the metal it represents, in percent. Graded only when AMM pools hold at least about $${n0(c.lowLiqUsd)}: under ${c.pegWarnPct}% is price near spot (measured, not a safety rating), ${c.pegWarnPct}–${c.pegCritPct}% is a caution, ${c.pegCritPct}% or more is critical. Below that gate the comparison says not measurable, and the raw check stays WARN. Not measured for commodities without a public spot reference. <a href="/learn/peg-vs-spot">More on peg vs spot</a>.` },
  { id: 'quote-assets', term: 'Quote assets (XRP / RLUSD / USDV)', def: () => `The assets a token's AMM pools are paired against. ReserveWatch reads pools against <b>XRP</b> (converted with a live XRP/USD rate), <b>RLUSD</b> and <b>USDV</b> (Valtorum USD), both valued at a nominal $1. ReserveWatch does not check those stablecoins' own reserves.` },
  { id: 'unverified-listing', term: 'Unverified listing / Issuer link unconfirmed', def: () => `Labels for issuers ReserveWatch could not confirm from the project's own sources. "Unverified listing": the project's own list does not include the account (comparison: Critical records conflict; raw check stays critical). "Issuer link unconfirmed": third parties attribute the account to a project, but the project publishes nothing listing it (comparison: Not confirmed; raw check stays warn). Neither is an allegation. <a href="/learn/unverified-listings">What the labels mean</a>.` },
];

/** Visible text of a glossary definition. Cross-links are navigation, not part of the definition. */
const plain = (html: string) => html
  .replace(/\s*<a\b[^>]*>.*?<\/a>/gi, '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+\./g, '.')
  .replace(/\.{2,}/g, '.')
  .replace(/\s+/g, ' ').trim();

/** Question text for a glossary heading already on the page. */
const glossaryQuestion = (term: string) => ({
  'AMM TVL': 'What is AMM TVL?',
  'Circulating vs treasury supply': 'What is circulating supply versus treasury supply?',
  'Trust line': 'What is a trust line?',
  'Clawback': 'What is clawback?',
  'Freeze / NoFreeze': 'What do freeze and NoFreeze mean?',
  'Global Freeze': 'What is Global Freeze?',
  'RequireAuth': 'What is RequireAuth?',
  'Domain / xrp-ledger.toml': 'What are Domain and xrp-ledger.toml?',
  'OK / WARN / CRITICAL': 'What do OK, WARN and CRITICAL mean?',
  'Peg deviation': 'What is peg deviation?',
  'Quote assets (XRP / RLUSD / USDV)': 'What are quote assets (XRP, RLUSD and USDV)?',
  'Unverified listing / Issuer link unconfirmed': 'What do "Unverified listing" and "Issuer link unconfirmed" mean?',
}[term] ?? `What is ${term}?`);

const GLOSSARY_GUIDE: LearnGuide = {
  slug: 'glossary',
  title: 'XRPL Commodity Token Glossary: AMM TVL, Trust Lines, Clawback, toml · ReserveWatch',
  h1: 'Glossary: XRPL commodity token terms in plain words',
  crumb: 'Glossary',
  description: 'Short, plain definitions of the terms ReserveWatch uses for XRPL commodity tokens: AMM TVL, circulating vs treasury supply, trust lines, clawback, freeze, Global Freeze, RequireAuth, xrp-ledger.toml, peg deviation and quote assets.',
  blurb: 'Short, plain definitions of every term on ReserveWatch pages.',
  datePublished: '2026-10-31', dateModified: '2026-11-06',
  body: c => `<p class="notice">Plain definitions of the words ReserveWatch uses. These describe ledger settings and readings; none of them is investment advice, and none proves reserves. Measured does not mean safe.</p>
<p class="muted">Jump to: ${GLOSSARY.map(g => `<a href="#${g.id}">${g.term}</a>`).join(' · ')}</p>
<dl>${GLOSSARY.map(g => `<dt id="${g.id}" style="margin-top:16px"><h2 style="font-size:1.15em;margin:0">${g.term}</h2></dt><dd style="margin:6px 0 0 0;line-height:1.55">${g.def(c)}</dd>`).join('')}</dl>
<p class="muted" style="margin-top:24px">Related: <a href="/methodology">Methodology</a> · <a href="/learn/peg-vs-spot">Peg vs spot</a> · <a href="/learn/unverified-listings">Unverified listings</a> · <a href="/learn/clawback-freeze-trust-lines">Clawback, freeze and trust lines</a> · <a href="/learn">All guides</a></p>`,
  extraLd: url => [{
    '@context': 'https://schema.org', '@type': 'DefinedTermSet', '@id': url + '#terms', name: 'ReserveWatch glossary of XRPL commodity token terms', url,
    hasDefinedTerm: GLOSSARY.map(g => ({ '@type': 'DefinedTerm', '@id': `${url}#${g.id}`, name: g.term, url: `${url}#${g.id}`, inDefinedTermSet: url + '#terms' })),
  }],
  faq: c => GLOSSARY.map(g => ({ q: glossaryQuestion(g.term), a: plain(g.def(c)) })),
};

/** New pillar guides served from this module, in hub order. */
export const LEARN_GUIDES: LearnGuide[] = [PEG_VS_SPOT, UNVERIFIED, GLOSSARY_GUIDE];

/** FAQ for the clawback pillar (body lives in server.ts). Wording matches that page; no live token lists. */
export const CLAWBACK_FAQ: { q: string; a: string }[] = [
  { q: 'What is a trust line?', a: 'On the XRP Ledger, a gold, silver, platinum or other commodity token is an IOU from an issuer, and you hold it through a trust line. Before you can hold one, your account must open a trust line to that issuer. Each trust line ties one holder to one issuer for one currency code. Two tokens with the same code from different issuers are different tokens.' },
  { q: 'What do freeze, Global Freeze and NoFreeze mean?', a: 'By default an XRPL issuer can freeze one holder\'s trust line: that holder can still send the tokens back to the issuer, but generally cannot send them to anyone else. Global Freeze freezes all of the issuer\'s trust lines at once, so the token stops moving between holders. ReserveWatch marks Global Freeze CRITICAL. NoFreeze gives up freeze power forever; once set, it cannot be undone, and the issuer can no longer freeze lines or turn on Global Freeze. ReserveWatch treats "can freeze" as normal (OK) and shows it for context.' },
  { q: 'What is clawback?', a: 'Clawback lets an issuer pull tokens out of a holder\'s trust line and back to itself. The issuer switches this on with the allowTrustLineClawback account setting, and the ledger only allows that before the issuer has any trust lines or offers. After it is on, it cannot be switched off, and it cannot be combined with NoFreeze. The comparison shows clawback as a Feature, not as Caution or Critical: some regulated issuers choose it, and holders do not have final control of their balance. The label does not say a clawback has happened, and it does not say the power is risk-free. The raw check is still WARN, so the legacy overall can be WARN for this feature alone.' },
  { q: 'Do freeze and clawback settings prove metal is in a vault?', a: 'No. These settings say nothing about whether metal sits in a vault. On-ledger data is not proof of reserves. The page is education, not investment advice.' },
];
