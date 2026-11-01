# Launch notes — XRPL Commodity-Token Health Monitor

Status as of **Oct 28, 2026, 11:33 PM EDT** (last good `npm run check`, snapshot `2026-10-29T03:33:04Z`, 15 s, 5 tokens).

## What works
- `npm install`, `npm run typecheck`, `npm run check`, `npm run build`, `npm run start:prod` all succeed (Node 24 on the box; needs Node ≥ 22.9).
- Live reads with public data only: XRPL mainnet over WebSocket (`wss://xrplcluster.com` first, then Ripple's s1/s2) and gold-api.com for spot. No keys, wallets, or seeds.
- Cross-checked independently on Oct 28:
  - **Ledger:** JSON-RPC on xrplcluster.com matched the app for obligations, AMM reserves, XRP/RLUSD price, and issuer flags.
  - **Spot:** gold-api gave XAU $4,038. PAXG traded at $4,033 (Kraken) and $4,035 (CoinGecko).
  - **XRP/USD:** the on-ledger AMM gave $1.291, against $1.290 on both Kraken and CoinGecko.
- UI (`/`, `/token/:id`, `/alerts`), JSON API, `/healthz` (now returns 503 when the snapshot is stale), and the file-based alert log.

## Fixed in this pass
1. **Wrong Meld issuer (most serious).** Meld's official token page (meld.gold/tokens) lists XRPL **GLD** `r45PCzxaEWJhWZS8obXnDQK9c2dgYcAfq5` and **SLV** `r3uhxnfY9UnwyRrrNJy68sQjjyKidBUPrs`. Each has 1,000 tokens outstanding, a single holder, and no AMM. The issuer we had been monitoring as "Meld Gold", `rMELD…`, is **not listed by Meld**. It only claims `www.meld.gold` in its own on-ledger Domain field, and Meld publishes no xrp-ledger.toml. The registry now tracks the official GLD/SLV. `rMELD…` "GOLD" stays in as a clearly labeled lookalike control case (`unlisted-gold-rmeld`, CRITICAL "not listed by the project it claims"). On-ledger evidence for that entry is in its notes.
2. **Misleading peg %.** A pool or book that is too thin no longer shows "−99.9% vs spot" in the headline. A peg reading counts as *reliable* only when it comes from an AMM with TVL ≥ `LOW_LIQUIDITY_USD`. Otherwise the list shows "thin liquidity ($X TVL) — not a peg reading" and the check says "Peg not measurable". The raw % is still in the JSON and on the detail page.
3. **DEX mid with a huge spread.** XAUa was priced at a "−48%" mid from a $13 bid and a $4,136 ask. A DEX mid is now used only when the spread is ≤ `MAX_DEX_SPREAD_PCT` (20%).
4. **Unfunded offers.** For the frozen BPG XAU, book offers were counted but showed null prices. The app now skips unfunded offers and shows funded/total counts and the spread.
5. **Domain verification.** New check that the issuer appears in `https://{Domain}/.well-known/xrp-ledger.toml`. Assetiko ✔ verified. rMELD ✖ not verified.
6. **AMM accounts in top holders** are now labeled and excluded from the concentration warning.
7. **Ops hardening:**
   - The server serves the cached `latest.json` on boot.
   - A snapshot with no tokens no longer overwrites good data.
   - `POST /api/refresh` is rate-limited to once per minute and requires `REFRESH_TOKEN` in production.
   - `check.ts` respects `DATA_DIR`.
   - Added `start:prod` (compiled JS, no tsx at runtime).
   - The old alert log, which held the misattributed Meld history, was archived as `data/*.pre-2026-10-28.*`.

## Caveats (show on the site)
- On-ledger supply is not the same as reserves. No off-ledger attestations are ingested yet.
- Thin AMM/DEX liquidity: no tracked token currently has a pool deep enough for a meaningful peg reading.
- The `rMELD…` treasury exclusion (`rippLE4uy7…`) rests on on-ledger evidence: that account activated the issuer and received the initial issuance. Nobody has confirmed it.
- Spot depends on a single free API (gold-api.com). The SPOT_STATIC_* overrides are for demos only.
- Public XRPL servers can rate-limit. Keep the poll interval ≥ 60 s; the default is 300 s.
- Telegram and email alerts are still stubs that only log.

## Remaining blockers before a public URL
1. **Legal and wording review** of how the `unlisted-gold-rmeld` lookalike is presented. Optionally contact Meld to confirm which issuers are theirs and whether `rMELD…` is affiliated. Until then, consider hiding that entry from the public list.
2. **Disclaimer, terms, and contact page.** There is currently only a one-line footer.
3. **Real alert delivery** (Telegram bot API and/or email via a provider) if alerts are part of the launch pitch.
4. **Second spot source** (for example PAXG/XAUT mid as a sanity check) with a disagreement flag.
5. **Persistent volume, HTTPS, uptime monitor** on `/healthz`, and basic request rate limiting / CDN in front.
6. No automated tests yet, and the project is not in git. Initialize a repo before deploying.

## Hosting recommendation
Run it as a **long-running Node service, not pure serverless**. The app keeps an XRPL WebSocket open, runs an in-process poller, and writes state files. Good fits:
- **Fly.io** or **Railway/Render** with a small always-on instance (about $5–10 a month) and a 1 GB volume mounted at `DATA_DIR`.
- A **$5 VPS** (Hetzner or DigitalOcean) running `npm run build && npm run start:prod` under systemd or pm2, with Caddy for automatic HTTPS.
- Put Cloudflare (free) in front for DNS, TLS, and caching of `/` and `/api/tokens` (60 s).

Env for production: `NODE_ENV=production`, `REFRESH_TOKEN`, `DATA_DIR=/data`, `POLL_INTERVAL_SEC=300`.

## Name and domain ideas
Nothing is chosen yet. RDAP lookups on Oct 28, 2026 found **no registration** for the names below (confirm at a registrar before buying, since premium pricing can apply). Avoid "XRP" or "Ripple" in the brand because of trademark risk.

| Name | Domain(s) unregistered per RDAP | Angle |
|---|---|---|
| **LedgerAssay** | ledgerassay.com | "Assay" means testing metal purity, a natural fit for a gold-token checker |
| **OnchainAssay** | onchainassay.com | Same idea, chain-agnostic, so it can expand beyond XRPL |
| **RWA Assay** | rwaassay.com | Broader real-world-asset scope (energy, diamonds later) |
| **MetalPeg** | metalpeg.com | Plain-spoken: is the metal token on peg? |
| **ReserveWatch** | reservewatch.io | Transparency/monitoring framing, good for issuer "badges" later |

Taken: tokenassay.com, assaywatch.com, assayboard.com, pegwatch.io.

## Update — Oct 30, 2026
- **rMELD "GOLD"** now uses neutral wording and an "Unverified listing" label: a pill in the list, a notice on its detail page with a link to /contact, and softer notes and check messages. All of its data is still shown.
- **Watchlist:** added Assetiko **XAGa** (`rQJ1EbtepKKzx4sBCUtPjvSk8CfiAx2H8e`, code `5841476100000000000000000000000000000000`) and **XPTa** (`rGE4oF6VCDPj48ghZYb9uEQwGQ1beqoTJo`, code `5850546100000000000000000000000000000000`).
  - Each issuer was checked both ways: it is listed in silver./platinum.assetiko.com xrp-ledger.toml, and its on-ledger Domain points back to that subdomain.
  - `rJanYB…` issues **only XAUa**.
  - Added the `XPT` metal; spot comes from gold-api `/price/XPT`.
- **Legal pages:** `/disclaimer`, `/terms`, `/contact`, plus a footer on every page. `CONTACT_EMAIL` env sets the address (default peakacademiccoaching1@gmail.com). These are plain-language drafts and not legal advice; have counsel review them.

## Deploy checklist (Fly.io + Porkbun)
1. `flyctl auth login` (browser) **or** `export FLY_API_TOKEN=...`, then run `./fly-deploy.sh reservewatch`. If the name is taken, use `thereservewatch`.
2. Fly billing: you need a card on file to create the app and volume.
3. Porkbun DNS for thereservewatch.com:
   - Delete the parking records: ALIAS/A `@` → 207.207.210.x and CNAME `www` → uixie.porkbun.com. To do this, turn off "URL forwarding/parking" for the domain.
   - Add `A @` → the Fly shared IPv4 from `flyctl ips list`.
   - Add `AAAA @` → the Fly IPv6 from `flyctl ips list`.
   - Add `CNAME www` → `<app>.fly.dev`.
   - If `flyctl certs setup` prints `_acme-challenge` CNAMEs, add those too.
4. `flyctl certs check thereservewatch.com -a <app>` until it shows Issued.
