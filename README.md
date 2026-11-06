# ReserveWatch — XRPL commodity reserve health monitor

Source for [https://thereservewatch.com](https://thereservewatch.com).

MVP — gold focus.

Monitors gold / precious-metal tokens on the XRP Ledger using **public ledger data only**
(xrpl.js over public WebSockets). No wallet, no seeds, no private keys — ever.

## Run

Requires Node 22.9+ (uses `--env-file-if-exists`).

```bash
npm install
npm run dev        # http://localhost:3000 (auto-reload); or: npm start
npm run check      # one-shot CLI snapshot -> console + data/latest.json + data/alerts.log
npm run typecheck
npm run build && npm run start:prod   # production: compiled JS, no tsx at runtime
```

Optional: `cp .env.example .env` and edit. **No API keys are required.**

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `POLL_INTERVAL_SEC` | 300 | Ledger refresh interval |
| `XRPL_WS_URLS` | `wss://xrplcluster.com,wss://s1.ripple.com,wss://s2.ripple.com` | Endpoints, tried in order |
| `SPOT_API_URL_TEMPLATE` | `https://api.gold-api.com/price/{symbol}` | Spot USD/oz (free, keyless). Response must have numeric `price` |
| `SPOT_API_KEY` | – | Sent as `x-access-token` if your provider needs one |
| `SPOT_STATIC_XAU` / `SPOT_STATIC_XAG` / `SPOT_STATIC_XPT` | – | Pin spot price (offline/demo), overrides API |
| `LOW_LIQUIDITY_USD` | 10000 | AMM TVL below this = warn; also marks peg signal "thin" |
| `PEG_WARN_PCT` / `PEG_CRIT_PCT` | 3 / 10 | Peg deviation thresholds |
| `CONCENTRATION_WARN_PCT` | 50 | Top non-treasury, non-AMM holder share that triggers warn |
| `MAX_DEX_SPREAD_PCT` | 20 | DEX mid used as a price only if bid/ask spread ≤ this |
| `DATA_DIR` | `./data` | latest.json, alerts.log, alert-state.json |
| `REFRESH_TOKEN` | – | Enables `POST /api/refresh` in production (header `x-refresh-token`); always rate-limited to 1/min |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ALERT_EMAIL_TO` | – | Alert **stubs** (log "would send"; no network calls yet) |

## Routes

- `/` — comparison menu: market/liquidity/peg, issuer controls, and identity/verification. The legacy overall (worst raw check: ok/warn/critical) is shown second. `presentation` on `/api/tokens` is that comparison; `status` and `checks` are unchanged.
- `/token/:id` — public transparency page (issuer, currency code, supply, flags, AMM pools, DEX top of book, top holders, checks, notes)
- `/alerts` — alert log (status transitions)
- `/api/tokens`, `/api/tokens/:id` — JSON; `/healthz`; `POST /api/refresh`

Token ids: `meld-gld`, `meld-slv`, `unlisted-gold-rmeld` ("Unverified listing" — shown for transparency, not on Meld's published list), `assetiko-xaua`, `assetiko-xaga` (silver), `assetiko-xpta` (platinum), `bpg-xau`.

- `/disclaimer`, `/terms`, `/contact` — public-launch info pages (linked in every page footer). Contact address set by `CONTACT_EMAIL` (default peakacademiccoaching1@gmail.com).

## What is measured (per token)

| Metric | XRPL method |
|---|---|
| Domain verification (issuer listed in `https://{Domain}/.well-known/xrp-ledger.toml`) | `account_info` Domain + HTTPS fetch |
| Issuer flags (globalFreeze, noFreeze, allowTrustLineClawback, requireAuthorization, disableMasterKey…) , TransferRate, Domain | `account_info` |
| Outstanding supply; treasury/pre-issuance excluded | `gateway_balances` with `hotwallet` = configured treasury wallets |
| Holders, frozen / deep-frozen trust lines, top-holder concentration | `account_lines` on issuer (paged) |
| AMM depth vs XRP, RLUSD and USDV, implied price, fee | `amm_info` |
| DEX top of book vs XRP, RLUSD and USDV | `book_offers` |
| XRP/USD | on-ledger XRP/RLUSD AMM (no external API) |
| Spot gold/silver/platinum | gold-api.com (USD/oz, XAU/XAG/XPT) → per token via grams-per-token |

Peg = TVL-weighted AMM implied price across XRP, RLUSD and USDV pools (RLUSD and USDV at a nominal $1; not a reserve check), or DEX mid if no AMM and spread ≤ `MAX_DEX_SPREAD_PCT`. A peg reading is
**reliable** only from an AMM with TVL ≥ `LOW_LIQUIDITY_USD`. Otherwise the comparison says "peg not measurable" (a gap, not a broken peg). The raw check is still warn, never critical, and the raw figure stays in JSON.

**Comparison** (`src/presentation.ts`, model `categories-v1`) is what the pages lead with. It does not rewrite check severities.

- **Measured** — liquidity at/above the gate, a reliable price within `PEG_WARN_PCT`, or two-way `xrp-ledger.toml`. Not a safety rating and not proof of backing.
- **Feature** — clawback, RequireAuth, concentration, retained freeze ability. Empty frozen lines are Noted, not a caution. Not risk-free.
- **Not measurable / not confirmed** — no pool, thin pool, no spot reference, unpublished issuer link, missing domain file. No pool is not a broken peg. Not confirmed is not a fraud finding.
- **Caution / Critical** — Global Freeze, discontinued, issuer missing, material or majority freezes, a *reliable* peg at/beyond the warn or crit band, or issuer records that disagree with the account (`knownStatus: 'unverified'`).

**Legacy overall** (`status`) is still the worst raw check. One feature or gap still makes it WARN. Alerts and weekly snapshots follow that aggregate and are not relabeled.

## Adding a token
Edit `src/config/tokens.ts` (issuer, currency code — 3-char or 40-hex, grams per token, metal, treasury wallets, notes).

## Layout
```
src/config/tokens.ts  token registry (verified live Oct 27–28, 2026)
src/xrplClient.ts     xrpl.js client with endpoint failover
src/spot.ts           spot metal price (pluggable / static override)
src/monitor.ts        metrics + legacy raw-check rules (status = worst check)
src/presentation.ts  comparison categories (does not rewrite status or checks)
src/alerts.ts         file-based alerts (data/alerts.log JSONL) + Telegram/email stubs
src/server.ts         Express SSR UI + JSON API + poller
src/check.ts          one-shot CLI
data/                 latest.json, alerts.log, alert-state.json (gitignored)
```

## Known caveats
- **Meld issuer correction (Oct 28, 2026):** Meld's official token page (meld.gold/tokens) lists XRPL tokens **GLD**
  (`r45PCzxaEWJhWZS8obXnDQK9c2dgYcAfq5`) and **SLV** (`r3uhxnfY9UnwyRrrNJy68sQjjyKidBUPrs`), each with 1,000 outstanding and
  one holder. The earlier `GOLD`/`SILVER` issuer `rMELDgMrr8nvbhnb8oiP5aHWakqPJLh5Rn` is **not listed by Meld**; it only
  self-declares `www.meld.gold` as Domain (no xrp-ledger.toml). It is kept as `unlisted-gold-rmeld`, a lookalike control case.
  Its ~1e11 initial issuance sits in `rippLE4uy7…` (the account that activated the issuer), excluded as issuer distribution wallet.
- On-ledger supply ≠ reserves. Off-ledger reserve attestations are not yet ingested.
- Public XRPL servers may rate-limit; keep `POLL_INTERVAL_SEC` ≥ 60.
- Facts and flags only — not investment advice and not an allegation against any issuer.
