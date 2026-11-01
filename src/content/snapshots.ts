// Frozen weekly ledger snapshots. Each entry is copied verbatim from the live /api/tokens feed at
// capture time so the archive page never changes after publishing. Add new weeks to the TOP of SNAPSHOTS.
import type { Severity } from '../monitor.js';
import type { Commodity } from '../config/tokens.js';

export interface SnapCheck { severity: Severity; key: string; message: string }
export interface SnapToken {
  id: string; name: string; displayCode: string; /** Commodity class code. */ metal: Commodity; status: Severity; label: string | null;
  circulating: number | null; holders: number | null; trustlines: number | null; frozenLines: number | null;
  globalFreeze: boolean; noFreeze: boolean; clawback: boolean; requireAuth: boolean;
  hasPool: boolean; ammTvlUsd: number; spotUsdPerToken: number | null; pegReliable: boolean; pegRawPct: number | null;
  domain: string | null; domainVerified: boolean | null; checks: SnapCheck[];
}
export interface WeeklySnapshot {
  week: string; isoWeek: string; capturedAt: string; ledgerIndex: number; xrpUsd: number | null;
  /** AMM quote assets whose pools counted toward liquidity/peg at capture time. Omitted = XRP + RLUSD (before USDV pools were read). */
  quoteAssets?: string[];
  /** Short editorial context written at capture time (measurement changes, additions). Plain facts only. */
  notes?: string[];
  tokens: SnapToken[];
}

export const SNAPSHOTS: WeeklySnapshot[] = [
{
 "week": "2026-10-31",
 "isoWeek": "2026-W44",
 "capturedAt": "2026-11-01T03:11:59.424Z",
 "ledgerIndex": 108036678,
 "xrpUsd": 1.2501395808499431,
 "quoteAssets": [
  "XRP",
  "RLUSD",
  "USDV"
 ],
 "notes": [
  "Second snapshot, captured one day after the first (both fall in ISO week 2026-W44). Changes below are day-over-day, not week-over-week.",
  "Since the first snapshot, ReserveWatch also reads AMM pools quoted in USDV (Valtorum USD), valued at a nominal $1. Many Assetiko pairs trade against USDV, so liquidity and peg readings for those tokens now include USDV pools that were not counted in the first snapshot. Their AMM TVL change comes from this wider measurement, so it is not a like-for-like comparison with October 30.",
  "Ten tokens were added to tracking (one electricity token and nine diamond collections). All carry the \"Issuer link unconfirmed\" label: third-party registries attribute the accounts to a project, but the project does not publish an xrp-ledger.toml or official page listing them. That is not an allegation of wrongdoing."
 ],
 "tokens": [
  {
   "id": "meld-gld",
   "name": "Meld Gold GLD",
   "displayCode": "GLD",
   "metal": "XAU",
   "status": "warn",
   "label": null,
   "circulating": 1000,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": false,
   "requireAuth": false,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": 124.62915084785634,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "No on-ledger price (no AMM pool and no two-sided DEX book) — peg cannot be verified."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rowP2q94mErLcTkjKgyvgBrgn9bsbFq3P holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "meld-slv",
   "name": "Meld Gold SLV",
   "displayCode": "SLV",
   "metal": "XAG",
   "status": "warn",
   "label": null,
   "circulating": 1000,
   "holders": 1,
   "trustlines": 3,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": false,
   "requireAuth": false,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": 1.5835529357926956,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "No on-ledger price (no AMM pool and no two-sided DEX book) — peg cannot be verified."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rnVma47psmNduh7fnNz3T5qJ85Qqm4jbBN holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "unlisted-gold-rmeld",
   "name": "Unverified \"GOLD\" (issuer rMELD…)",
   "displayCode": "GOLD",
   "metal": "XAU",
   "status": "critical",
   "label": "Unverified listing",
   "circulating": 2696023.50340271,
   "holders": 91,
   "trustlines": 2210,
   "frozenLines": 3,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": false,
   "requireAuth": false,
   "hasPool": true,
   "ammTvlUsd": 99.04100064683519,
   "spotUsdPerToken": 124.62915084785634,
   "pegReliable": false,
   "pegRawPct": -99.94809949878815,
   "domain": "https://www.meld.gold",
   "domainVerified": false,
   "checks": [
    {
     "severity": "critical",
     "key": "status",
     "message": "Unverified listing: this issuer does not appear on the published token list of the project its Domain field references, so its identity and backing could not be confirmed. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "warn",
     "key": "domain",
     "message": "No xrp-ledger.toml at www.meld.gold (HTTP 404) — on-ledger Domain claim unverified."
    },
    {
     "severity": "warn",
     "key": "frozenLines",
     "message": "3 trust line(s) individually frozen (0.0% of circulating)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "AMM liquidity only ~$99 (< $10000) across GOLD/XRP."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Peg not measurable: Pool TVL ~$99 is below $10000; implied price is not a meaningful peg reading. (raw AMM GOLD/XRP reading -99.9% vs spot.)"
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder riPPLEymBuFA4nG12YxhNW2hFjj834ztK holds 93.8% of non-treasury supply."
    }
   ]
  },
  {
   "id": "assetiko-xaua",
   "name": "Assetiko XAUa",
   "displayCode": "XAUa",
   "metal": "XAU",
   "status": "warn",
   "label": null,
   "circulating": 1503.996876191054,
   "holders": 90,
   "trustlines": 136,
   "frozenLines": 2,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": false,
   "hasPool": true,
   "ammTvlUsd": 2050271.406280052,
   "spotUsdPerToken": 3876.399902,
   "pegReliable": true,
   "pegRawPct": 0.07997363735350647,
   "domain": "gold.assetiko.com",
   "domainVerified": true,
   "checks": [
    {
     "severity": "ok",
     "key": "domain",
     "message": "Issuer listed in gold.assetiko.com/.well-known/xrp-ledger.toml."
    },
    {
     "severity": "warn",
     "key": "frozenLines",
     "message": "2 trust line(s) individually frozen (0.0% of circulating)."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "liquidity",
     "message": "AMM liquidity ~$2050271 across XAUa/USDV (USDV valued at $1 nominal)."
    },
    {
     "severity": "ok",
     "key": "peg",
     "message": "Price within 0.08% of spot via AMM XAUa/USDV."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder ravTdRivyuerQzaq8hL9yTk6nqiFxcyucX holds 66.8% of non-treasury supply."
    }
   ]
  },
  {
   "id": "assetiko-xaga",
   "name": "Assetiko XAGa",
   "displayCode": "XAGa",
   "metal": "XAG",
   "status": "warn",
   "label": null,
   "circulating": 54999.98607958314,
   "holders": 47,
   "trustlines": 72,
   "frozenLines": 2,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": false,
   "hasPool": true,
   "ammTvlUsd": 510798.8081600518,
   "spotUsdPerToken": 49.254002,
   "pegReliable": true,
   "pegRawPct": 0.046480353387376966,
   "domain": "silver.assetiko.com",
   "domainVerified": true,
   "checks": [
    {
     "severity": "ok",
     "key": "domain",
     "message": "Issuer listed in silver.assetiko.com/.well-known/xrp-ledger.toml."
    },
    {
     "severity": "warn",
     "key": "frozenLines",
     "message": "2 trust line(s) individually frozen (0.0% of circulating)."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "liquidity",
     "message": "AMM liquidity ~$510799 across XAGa/USDV (USDV valued at $1 nominal)."
    },
    {
     "severity": "ok",
     "key": "peg",
     "message": "Price within 0.05% of spot via AMM XAGa/USDV."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder ravTdRivyuerQzaq8hL9yTk6nqiFxcyucX holds 69.1% of non-treasury supply."
    }
   ]
  },
  {
   "id": "assetiko-xpta",
   "name": "Assetiko XPTa",
   "displayCode": "XPTa",
   "metal": "XPT",
   "status": "warn",
   "label": null,
   "circulating": 1922.999904778518,
   "holders": 18,
   "trustlines": 27,
   "frozenLines": 2,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": false,
   "hasPool": true,
   "ammTvlUsd": 1516755.8149180044,
   "spotUsdPerToken": 1439,
   "pegReliable": true,
   "pegRawPct": -0.11118189284818888,
   "domain": "platinum.assetiko.com",
   "domainVerified": true,
   "checks": [
    {
     "severity": "ok",
     "key": "domain",
     "message": "Issuer listed in platinum.assetiko.com/.well-known/xrp-ledger.toml."
    },
    {
     "severity": "warn",
     "key": "frozenLines",
     "message": "2 trust line(s) individually frozen (0.0% of circulating)."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "liquidity",
     "message": "AMM liquidity ~$1516756 across XPTa/USDV (USDV valued at $1 nominal)."
    },
    {
     "severity": "ok",
     "key": "peg",
     "message": "Price within 0.11% of spot via AMM XPTa/USDV."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rERsXvh8GM239AfQCav7A8m5QEGtYt53KX holds 71.3% of non-treasury supply."
    }
   ]
  },
  {
   "id": "justoken-jmwh",
   "name": "Justoken JMWH (energy, MWh)",
   "displayCode": "JMWH",
   "metal": "ENERGY",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 36947585.1427,
   "holders": 171,
   "trustlines": 325,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": false,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Justoken × YPF Luz (Argentina), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for electricity."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rNdn11orwd9NUGG7w5AfvMYrZDRZHZ775a holds 56.4% of non-treasury supply."
    }
   ]
  },
  {
   "id": "ctrl-alt-dia-ad-col1",
   "name": "Ctrl Alt Diamonds: AD Collection 1",
   "displayCode": "DIA-AD-COL1",
   "metal": "DIAMOND",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 230900,
   "holders": 1,
   "trustlines": 3,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": true,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Ctrl Alt × Billiton Diamond (Dubai), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "requireAuth",
     "message": "RequireAuth: holders must be authorized by issuer."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for diamonds."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rGJmNemAJ4SgKkZAVjcAbCfrHRFhjQXPZB holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "ctrl-alt-dia-ag-col1",
   "name": "Ctrl Alt Diamonds: AG Collection 1",
   "displayCode": "DIA-AG-COL1",
   "metal": "DIAMOND",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 736246,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": true,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Ctrl Alt × Billiton Diamond (Dubai), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "requireAuth",
     "message": "RequireAuth: holders must be authorized by issuer."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for diamonds."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rGJmNemAJ4SgKkZAVjcAbCfrHRFhjQXPZB holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "ctrl-alt-dia-fs-col1",
   "name": "Ctrl Alt Diamonds: FS Collection 1",
   "displayCode": "DIA-FS-COL1",
   "metal": "DIAMOND",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 368838,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": true,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Ctrl Alt × Billiton Diamond (Dubai), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "requireAuth",
     "message": "RequireAuth: holders must be authorized by issuer."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for diamonds."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rGJmNemAJ4SgKkZAVjcAbCfrHRFhjQXPZB holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "ctrl-alt-dia-kd-col1",
   "name": "Ctrl Alt Diamonds: KD Collection 1",
   "displayCode": "DIA-KD-COL1",
   "metal": "DIAMOND",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 2212,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": true,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Ctrl Alt × Billiton Diamond (Dubai), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "requireAuth",
     "message": "RequireAuth: holders must be authorized by issuer."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for diamonds."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rGJmNemAJ4SgKkZAVjcAbCfrHRFhjQXPZB holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "ctrl-alt-dia-kps-col1",
   "name": "Ctrl Alt Diamonds: KPS Collection 1",
   "displayCode": "DIA-KPS-COL1",
   "metal": "DIAMOND",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 1112622,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": true,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Ctrl Alt × Billiton Diamond (Dubai), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "requireAuth",
     "message": "RequireAuth: holders must be authorized by issuer."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for diamonds."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rGJmNemAJ4SgKkZAVjcAbCfrHRFhjQXPZB holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "ctrl-alt-dia-l-col1",
   "name": "Ctrl Alt Diamonds: L Collection 1",
   "displayCode": "DIA-L-COL1",
   "metal": "DIAMOND",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 1699513,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": true,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Ctrl Alt × Billiton Diamond (Dubai), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "requireAuth",
     "message": "RequireAuth: holders must be authorized by issuer."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for diamonds."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rGJmNemAJ4SgKkZAVjcAbCfrHRFhjQXPZB holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "ctrl-alt-dia-s-col1",
   "name": "Ctrl Alt Diamonds: S Collection 1",
   "displayCode": "DIA-S-COL1",
   "metal": "DIAMOND",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 741667,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": true,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Ctrl Alt × Billiton Diamond (Dubai), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "requireAuth",
     "message": "RequireAuth: holders must be authorized by issuer."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for diamonds."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rGJmNemAJ4SgKkZAVjcAbCfrHRFhjQXPZB holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "ctrl-alt-dia-sd-col1",
   "name": "Ctrl Alt Diamonds: SD Collection 1",
   "displayCode": "DIA-SD-COL1",
   "metal": "DIAMOND",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 739884,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": true,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Ctrl Alt × Billiton Diamond (Dubai), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "requireAuth",
     "message": "RequireAuth: holders must be authorized by issuer."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for diamonds."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rGJmNemAJ4SgKkZAVjcAbCfrHRFhjQXPZB holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "ctrl-alt-dia-sg-col1",
   "name": "Ctrl Alt Diamonds: SG Collection 1",
   "displayCode": "DIA-SG-COL1",
   "metal": "DIAMOND",
   "status": "warn",
   "label": "Issuer link unconfirmed",
   "circulating": 53811,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": true,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": null,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "warn",
     "key": "status",
     "message": "Issuer link unconfirmed: third-party registries attribute this account to Ctrl Alt × Billiton Diamond (Dubai), but the project publishes no xrp-ledger.toml or official page listing it, so ReserveWatch could not confirm it from the issuer itself. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "ok",
     "key": "tokenization",
     "message": "Represented asset: an issuer-held record-keeping token (RWA.xyz terminology), not a freely distributed retail token — low holder counts and no AMM are expected."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "ok",
     "key": "requireAuth",
     "message": "RequireAuth: holders must be authorized by issuer."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP, RLUSD or USDV."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Price vs spot not measured: ReserveWatch has no public spot reference for diamonds."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rGJmNemAJ4SgKkZAVjcAbCfrHRFhjQXPZB holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "bpg-xau",
   "name": "BPG XAU (GateHub)",
   "displayCode": "XAU",
   "metal": "XAU",
   "status": "critical",
   "label": null,
   "circulating": 3948.1395132601124,
   "holders": 580,
   "trustlines": 5752,
   "frozenLines": 0,
   "globalFreeze": true,
   "noFreeze": false,
   "clawback": false,
   "requireAuth": false,
   "hasPool": true,
   "ammTvlUsd": 17.943204289510675,
   "spotUsdPerToken": 124.62915084785634,
   "pegReliable": false,
   "pegRawPct": -98.66902992392833,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "critical",
     "key": "status",
     "message": "Issuer has publicly discontinued this token (not redeemable)."
    },
    {
     "severity": "critical",
     "key": "globalFreeze",
     "message": "Issuer has Global Freeze enabled — token cannot move."
    },
    {
     "severity": "ok",
     "key": "transferFee",
     "message": "Transfer fee 0.300%."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "AMM liquidity only ~$18 (< $10000) across XAU/XRP, XAU/RLUSD (RLUSD valued at $1 nominal)."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Peg not measurable: Pool TVL ~$18 is below $10000; implied price is not a meaningful peg reading. (raw AMM XAU/XRP + XAU/RLUSD (TVL-weighted) reading -98.7% vs spot.)"
    }
   ]
  }
 ]
},
{
 "week": "2026-10-30",
 "isoWeek": "2026-W44",
 "capturedAt": "2026-10-30T18:28:52.766Z",
 "ledgerIndex": 108006798,
 "xrpUsd": 1.2382077542870797,
 "tokens": [
  {
   "id": "meld-gld",
   "name": "Meld Gold GLD",
   "displayCode": "GLD",
   "metal": "XAU",
   "status": "warn",
   "label": null,
   "circulating": 1000,
   "holders": 1,
   "trustlines": 2,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": false,
   "requireAuth": false,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": 124.7223927390651,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP or RLUSD."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "No on-ledger price (no AMM pool and no two-sided DEX book) — peg cannot be verified."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rowP2q94mErLcTkjKgyvgBrgn9bsbFq3P holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "meld-slv",
   "name": "Meld Gold SLV",
   "displayCode": "SLV",
   "metal": "XAG",
   "status": "warn",
   "label": null,
   "circulating": 1000,
   "holders": 1,
   "trustlines": 3,
   "frozenLines": 0,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": false,
   "requireAuth": false,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": 1.5759009616571225,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP or RLUSD."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "No on-ledger price (no AMM pool and no two-sided DEX book) — peg cannot be verified."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rnVma47psmNduh7fnNz3T5qJ85Qqm4jbBN holds 100.0% of non-treasury supply (only holder)."
    }
   ]
  },
  {
   "id": "unlisted-gold-rmeld",
   "name": "Unverified \"GOLD\" (issuer rMELD…)",
   "displayCode": "GOLD",
   "metal": "XAU",
   "status": "critical",
   "label": "Unverified listing",
   "circulating": 2696023.50340271,
   "holders": 91,
   "trustlines": 2210,
   "frozenLines": 3,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": false,
   "requireAuth": false,
   "hasPool": true,
   "ammTvlUsd": 98.1,
   "spotUsdPerToken": 124.7223927390651,
   "pegReliable": false,
   "pegRawPct": -99.94863328794686,
   "domain": "https://www.meld.gold",
   "domainVerified": false,
   "checks": [
    {
     "severity": "critical",
     "key": "status",
     "message": "Unverified listing: this issuer does not appear on the published token list of the project its Domain field references, so its identity and backing could not be confirmed. Shown for transparency; not an endorsement or an allegation."
    },
    {
     "severity": "warn",
     "key": "domain",
     "message": "No xrp-ledger.toml at www.meld.gold (HTTP 404) — on-ledger Domain claim unverified."
    },
    {
     "severity": "warn",
     "key": "frozenLines",
     "message": "3 trust line(s) individually frozen (0.0% of circulating)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "AMM liquidity only ~$98 (< $10000)."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Peg not measurable: Pool TVL ~$98 is below $10000; implied price is not a meaningful peg reading. (raw AMM GOLD/XRP reading -99.9% vs spot.)"
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder riPPLEymBuFA4nG12YxhNW2hFjj834ztK holds 93.8% of non-treasury supply."
    }
   ]
  },
  {
   "id": "assetiko-xaua",
   "name": "Assetiko XAUa",
   "displayCode": "XAUa",
   "metal": "XAU",
   "status": "warn",
   "label": null,
   "circulating": 1503.996876191054,
   "holders": 90,
   "trustlines": 136,
   "frozenLines": 2,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": false,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": 3879.300049,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": "gold.assetiko.com",
   "domainVerified": true,
   "checks": [
    {
     "severity": "ok",
     "key": "domain",
     "message": "Issuer listed in gold.assetiko.com/.well-known/xrp-ledger.toml."
    },
    {
     "severity": "warn",
     "key": "frozenLines",
     "message": "2 trust line(s) individually frozen (0.0% of circulating)."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP or RLUSD."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Peg not measurable: DEX book XAUa/XRP too wide to price (bid 12.38 / ask 4053.60 USD, spread 199%)."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder ravTdRivyuerQzaq8hL9yTk6nqiFxcyucX holds 66.8% of non-treasury supply."
    }
   ]
  },
  {
   "id": "assetiko-xaga",
   "name": "Assetiko XAGa",
   "displayCode": "XAGa",
   "metal": "XAG",
   "status": "warn",
   "label": null,
   "circulating": 54999.98607958312,
   "holders": 46,
   "trustlines": 71,
   "frozenLines": 2,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": false,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": 49.015999,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": "silver.assetiko.com",
   "domainVerified": true,
   "checks": [
    {
     "severity": "ok",
     "key": "domain",
     "message": "Issuer listed in silver.assetiko.com/.well-known/xrp-ledger.toml."
    },
    {
     "severity": "warn",
     "key": "frozenLines",
     "message": "2 trust line(s) individually frozen (0.0% of circulating)."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP or RLUSD."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Peg not measurable: DEX book XAGa/XRP too wide to price (bid 0.12 / ask 51.46 USD, spread 199%)."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder ravTdRivyuerQzaq8hL9yTk6nqiFxcyucX holds 69.1% of non-treasury supply."
    }
   ]
  },
  {
   "id": "assetiko-xpta",
   "name": "Assetiko XPTa",
   "displayCode": "XPTa",
   "metal": "XPT",
   "status": "warn",
   "label": null,
   "circulating": 1922.999904778516,
   "holders": 18,
   "trustlines": 27,
   "frozenLines": 2,
   "globalFreeze": false,
   "noFreeze": false,
   "clawback": true,
   "requireAuth": false,
   "hasPool": false,
   "ammTvlUsd": 0,
   "spotUsdPerToken": 1431,
   "pegReliable": false,
   "pegRawPct": null,
   "domain": "platinum.assetiko.com",
   "domainVerified": true,
   "checks": [
    {
     "severity": "ok",
     "key": "domain",
     "message": "Issuer listed in platinum.assetiko.com/.well-known/xrp-ledger.toml."
    },
    {
     "severity": "warn",
     "key": "frozenLines",
     "message": "2 trust line(s) individually frozen (0.0% of circulating)."
    },
    {
     "severity": "warn",
     "key": "clawback",
     "message": "Issuer can claw back tokens from holders (allowTrustLineClawback)."
    },
    {
     "severity": "ok",
     "key": "freezeable",
     "message": "Issuer retains ability to freeze (NoFreeze not set) — standard for regulated issuers."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "No AMM pool vs XRP or RLUSD."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Peg not measurable: DEX book XPTa/XRP too wide to price (bid 0.12 / ask 1477.39 USD, spread 200%)."
    },
    {
     "severity": "warn",
     "key": "concentration",
     "message": "Top holder rERsXvh8GM239AfQCav7A8m5QEGtYt53KX holds 71.3% of non-treasury supply."
    }
   ]
  },
  {
   "id": "bpg-xau",
   "name": "BPG XAU (GateHub)",
   "displayCode": "XAU",
   "metal": "XAU",
   "status": "critical",
   "label": null,
   "circulating": 3948.1395132601124,
   "holders": 580,
   "trustlines": 5752,
   "frozenLines": 0,
   "globalFreeze": true,
   "noFreeze": false,
   "clawback": false,
   "requireAuth": false,
   "hasPool": true,
   "ammTvlUsd": 17.77,
   "spotUsdPerToken": 124.7223927390651,
   "pegReliable": false,
   "pegRawPct": -98.68247466733887,
   "domain": null,
   "domainVerified": null,
   "checks": [
    {
     "severity": "critical",
     "key": "status",
     "message": "Issuer has publicly discontinued this token (not redeemable)."
    },
    {
     "severity": "critical",
     "key": "globalFreeze",
     "message": "Issuer has Global Freeze enabled — token cannot move."
    },
    {
     "severity": "ok",
     "key": "transferFee",
     "message": "Transfer fee 0.300%."
    },
    {
     "severity": "warn",
     "key": "liquidity",
     "message": "AMM liquidity only ~$18 (< $10000)."
    },
    {
     "severity": "warn",
     "key": "peg",
     "message": "Peg not measurable: Pool TVL ~$18 is below $10000; implied price is not a meaningful peg reading. (raw AMM XAU/XRP reading -98.7% vs spot.)"
    }
   ]
  }
 ]
},
];
