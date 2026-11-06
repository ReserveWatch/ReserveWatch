// Dated public briefs: new-issuer notes, CRITICAL / soft-label situations, material flag or
// measurement changes. Prepend new entries to BRIEFS (newest first). Parent-owned Monday
// issuer-scan and CRITICAL-event routines should append here via the deploy tree (see HOW_TO_ADD).
// Clear Money Voice only — ledger facts, what a label means / does not mean, links to token +
// methodology. Never invent issuer addresses. No buy/sell advice. Not a vault audit.

export type BriefKind = 'critical' | 'soft-label' | 'new-issuer' | 'measurement' | 'flag-change';

export interface Brief {
  /** URL slug under /briefs/{slug}. Stable once published. */
  slug: string;
  /** ISO date YYYY-MM-DD (publish day in America/New_York). */
  date: string;
  /** Short headline (also used in <title>). */
  title: string;
  /** Meta description; plain text, no HTML. */
  description: string;
  kind: BriefKind;
  /** Optional token id(s) this brief is about (must match TOKENS ids). */
  tokenIds: string[];
  /** Plain-text one-liner for index cards. */
  summary: string;
  /**
   * Body HTML fragments (already escaped where needed). Keep factual.
   * Prefer short sections: what we saw on ledger, what the label means / does not mean, links.
   */
  bodyHtml: string;
  /** ISO timestamp of the /api/tokens (or snapshot) reading the facts were taken from, if any. */
  asOf?: string;
}

/**
 * How to add a brief (Monday issuer scan / Thursday cadence / CRITICAL event):
 * 1. Pull live facts from https://thereservewatch.com/api/tokens (or a frozen weekly snapshot).
 * 2. Prepend a Brief object to BRIEFS below — never invent addresses or peg numbers.
 * 3. Redeploy from this tree (`fly deploy -a reservewatch …`). Sitemap picks up /briefs/{slug} automatically.
 * 4. Parent owns UpdateRoutine wiring; this module is the durable content sink.
 */
export const HOW_TO_ADD = `Prepend to BRIEFS in src/content/briefs.ts from live /api/tokens facts; redeploy; do not invent issuers or pegs.`;

export const BRIEFS: Brief[] = [
  {
    slug: '2026-11-05-unverified-gold-rmeld',
    date: '2026-11-05',
    title: 'Unverified GOLD (issuer rMELD…) stays CRITICAL',
    description:
      'ReserveWatch brief: the XRPL GOLD token from issuer rMELD… remains CRITICAL as an Unverified listing. On-ledger Domain points at meld.gold, but Meld’s published token list does not include this issuer. Soft label facts only — not an allegation, not advice.',
    kind: 'soft-label',
    tokenIds: ['unlisted-gold-rmeld'],
    summary:
      'The Unverified listing check is still CRITICAL for the GOLD token whose issuer Domain points at meld.gold. Peg is not measurable on thin AMM liquidity.',
    asOf: '2026-11-05T17:08:00.823Z',
    bodyHtml: `
<p class="notice"><b>Automated readings, not advice.</b> This brief records what ReserveWatch’s public ledger checks showed at one moment. It is not investment advice, not an audit, and not proof of reserves. It is not an allegation of wrongdoing against any person or project.</p>

<h2>What changed on the ledger</h2>
<p>Nothing new flipped the overall label on 5 November 2026. The token <a href="/token/unlisted-gold-rmeld">Unverified “GOLD” (issuer rMELD…)</a> remains <span class="badge critical">CRITICAL</span> under the long-standing <b>Unverified listing</b> rule. A live reading at 12:08&nbsp;PM America/New_York (from <a href="/api/tokens/unlisted-gold-rmeld">/api/tokens/unlisted-gold-rmeld</a>) showed roughly:</p>
<ul>
<li>~2.70&nbsp;million GOLD circulating after excluding the known distribution wallet treated as treasury;</li>
<li>90 non-zero holders across ~2,207 trust lines;</li>
<li>an AMM pool only against XRP, with total TVL about $92 — well under the ~$10,000 gate, so peg vs spot is <b>not measurable</b> (the raw GOLD/XRP implied price is far from spot gold and is marked not meaningful);</li>
<li>no GOLD/RLUSD or GOLD/USDV AMM pool;</li>
<li>on-ledger Domain set to a meld.gold URL, with no confirming <code>xrp-ledger.toml</code> at that host (HTTP 404 on check).</li>
</ul>
<p>Meld Gold’s own published XRPL token page lists different issuers for GLD and SLV. Those separate listings are tracked as <a href="/token/meld-gld">Meld Gold GLD</a> and <a href="/token/meld-slv">Meld Gold SLV</a>.</p>

<h2>What the label means</h2>
<p><b>Unverified listing</b> means ReserveWatch could not match this issuer account to the project its Domain field references. The project’s published token list and this account disagree, so identity and backing could not be confirmed from the project’s own sources. That check is CRITICAL under the <a href="/methodology">methodology</a>.</p>

<h2>What the label does not mean</h2>
<ul>
<li>It does <b>not</b> mean the token is a scam, a fake, or unbacked.</li>
<li>It does <b>not</b> mean anyone did something wrong.</li>
<li>It is <b>not</b> a rating, a buy/sell signal, or an opinion on solvency.</li>
<li>Thin AMM depth and “peg not measurable” describe liquidity on the ledger only. They are not proof that metal is missing from a vault.</li>
</ul>
<p>Longer explainer: <a href="/learn/unverified-listings">what the soft labels mean</a>. Peg rules: <a href="/learn/peg-vs-spot">peg vs spot</a>.</p>

<h2>Related</h2>
<p><a href="/token/unlisted-gold-rmeld">Token page (live)</a> · <a href="/methodology">Methodology</a> · <a href="/snapshots/2026-11-05">Weekly snapshot 2026-11-05</a> · <a href="/alerts">Alert log</a> · <a href="/disclaimer">Disclaimer</a></p>
<p class="muted">If you operate this issuer and can show a published listing or two-way <code>xrp-ledger.toml</code> confirmation, <a href="/contact">contact ReserveWatch</a> with the proof and the listing will be reviewed.</p>
`,
  },
];
