# Chain SEO audit (Solana and Stellar vs XRPL)

Compared on 2026-11-24 against live https://thereservewatch.com and `main` at `40df6ed`. XRPL references: `/`, `/gold`, `/silver`, an XRPL token page (`/token/meld-gld`), `/state`, `/faq`, `/llms.txt`, `/sitemap.xml`, `/badge/{id}.svg`, and `/news/ledger/xrpl`. Chain pages: `/ledger/solana`, `/ledger/stellar`, `/ledger/all`, `/token/solana-{paxg,xaut0,xaum,dgld,vnxau}`, `/token/stellar-{xaum,vnxau}`.

Titles already include the word commodity, stay at or under 60 characters, and are unique. Descriptions stay at or under 155. Canonical, robots, Open Graph, and Twitter card tags are present on the chain pages. Badge SVGs already return for chain token ids. Sitemap `lastmod` on ledger and token URLs already uses the same live date as the home page.

## Gaps

1. **Commodity hubs do not list the other ledgers.** `/gold` and `/silver` only render XRPL tokens. The gold page says "ReserveWatch covers XRPL only" under "Outside the XRP Ledger", while PAXG, XAUT0, XAUm, DGLD, and VNXAU are already tracked on Solana and Stellar. `/silver` never says that no Solana or Stellar silver commodity token is tracked. The commodities index counts XRPL tokens only.

2. **Cross-links stop at the ledger board.** Solana and Stellar commodity strips show the word Gold and do not link `/gold`. Chain token breadcrumbs are Home → ledger → token, with no gold hub. Token pages do not link the same commodity token on the other ledger (XAUm and VNXAU) or the other tokens on the same ledger. XRPL token breadcrumbs include Commodities → metal.

3. **JSON-LD is thinner than the XRPL pages that answer questions.** Ledger pages have BreadcrumbList and a Dataset with creator, publisher, and license. They do not emit the standalone Organization node the home page uses, so `sameAs` cannot appear there even when `SAME_AS_URLS` is set. They have no FAQPage. The Dataset has no `distribution`, `keywords`, `measurementTechnique`, or `dateModified`. Chain token pages have BreadcrumbList and Thing, and no FAQPage. `/state` and `/gold` both have FAQPage. `sameAs` is empty on every page, including home, because no confirmed profile URL is configured. That empty list is intentional in `src/seo.ts`.

4. **FAQ copy an answer engine can cite does not cover these tokens.** `/faq` has no question such as "Is PAXG on Solana backed?". Ledger pages and chain token pages have no short answers that separate what the public ledger shows from what it cannot show. Nothing states, in citable form, that a Solana or Stellar reading is not a vault, reserve, or audit check.

5. **`llms.txt` names the ledger URLs and then stops.** It does not list `/api/tokens?ledger=solana`, `/api/tokens?ledger=stellar`, or `/api/tokens?ledger=all`, the chain token pages, the badge paths, or the alerts RSS ledger filters. There is no `llms-full.txt` and no HTML API reference. Sitemap `lastmod` for `/llms.txt` is still `2026-11-06`. Chain token sitemap priority is `0.6` while XRPL token pages are `0.8`.

6. **News ledger pages and the news RSS are not paired.** `/news/ledger/solana` and `/news/ledger/stellar` exist, use a canonical URL, and are `noindex` because each ledger has fewer than five items. XRPL is under that same threshold (one item) and is also `noindex` and absent from the sitemap. The news RSS has no `?ledger=` filter. Alerts RSS already has one. Empty ledger pages describe themselves as "solana news: Short summaries with source links." and have no H2.

## Already at parity (no change required)

- Canonical, `og:title`, `og:description`, `twitter:card`, `twitter:title`, and `twitter:image` on ledger and token pages.
- H1 on ledger pages, and H2 Market / Controls / Identity on chain token pages, matching the XRPL token panels.
- "Not available on this ledger" for volume, AMM pools, order books, xrp-ledger.toml, and the legacy overall.
- `/badge/solana-paxg.svg` and `/badge/stellar-vnxau.svg` return an SVG with no OK / WARN / CRITICAL grade.
- `/alerts/feed.xml?ledger=solana` and `?ledger=stellar` already filter the change feed.
- Dataset creator and publisher on ledger pages are a typed Organization with the data-license URL.
