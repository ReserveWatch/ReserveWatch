// Token registry. Issuers/currencies sourced from /workspace/xrpl-tokenized-commodities.md
// (research dated Oct 27, 2026), verified live against XRPL mainnet; Meld issuers corrected Oct 28, 2026
// from Meld's official token page (meld.gold/tokens).
// Public addresses only — this app never handles seeds or private keys.

/** Commodity class codes. XAU/XAG/XPT/XPD are ISO-style metal codes; the rest are ReserveWatch class codes. */
export type Commodity =
  | 'XAU' | 'XAG' | 'XPT' | 'XPD'
  | 'OIL' | 'NGAS' | 'ENERGY' | 'URANIUM'
  | 'COPPER' | 'DIAMOND' | 'TIMBER'
  | 'WHEAT' | 'SOY' | 'CORN' | 'COTTON'
  | 'OTHER';
/** @deprecated kept for older imports; use Commodity. The TokenDef field stays named `metal` for API stability. */
export type Metal = Commodity;

export interface CommodityMeta {
  /** Plain name, lower-case for use mid-sentence ("gold", "crude oil"). */
  name: string;
  /** Title-case label for headings. */
  title: string;
  /** Unit the reference price is quoted in, e.g. "troy oz", "barrel", "MWh". */
  unitLabel: string;
  /** Symbol for the public spot API (gold-api.com). Only set where that feed really exists. */
  spotSymbol?: string;
  /** URL slug of the /commodities/:slug hub page. */
  slug: string;
  /** Broader group used on the /commodities index. */
  group: 'precious-metals' | 'energy' | 'industrial' | 'agriculture' | 'gems-and-other';
}

export const COMMODITY_META: Record<Commodity, CommodityMeta> = {
  XAU: { name: 'gold', title: 'Gold', unitLabel: 'troy oz', spotSymbol: 'XAU', slug: 'gold', group: 'precious-metals' },
  XAG: { name: 'silver', title: 'Silver', unitLabel: 'troy oz', spotSymbol: 'XAG', slug: 'silver', group: 'precious-metals' },
  XPT: { name: 'platinum', title: 'Platinum', unitLabel: 'troy oz', spotSymbol: 'XPT', slug: 'platinum', group: 'precious-metals' },
  XPD: { name: 'palladium', title: 'Palladium', unitLabel: 'troy oz', spotSymbol: 'XPD', slug: 'palladium', group: 'precious-metals' },
  OIL: { name: 'crude oil', title: 'Crude Oil', unitLabel: 'barrel', slug: 'oil', group: 'energy' },
  NGAS: { name: 'natural gas', title: 'Natural Gas', unitLabel: 'MMBtu', slug: 'natural-gas', group: 'energy' },
  ENERGY: { name: 'electricity', title: 'Electricity & Energy', unitLabel: 'MWh', slug: 'energy', group: 'energy' },
  URANIUM: { name: 'uranium', title: 'Uranium', unitLabel: 'lb U3O8', slug: 'uranium', group: 'energy' },
  COPPER: { name: 'copper', title: 'Copper', unitLabel: 'lb', slug: 'copper', group: 'industrial' },
  DIAMOND: { name: 'diamonds', title: 'Diamonds', unitLabel: 'token (unit set by issuer)', slug: 'diamonds', group: 'gems-and-other' },
  TIMBER: { name: 'timber', title: 'Timber', unitLabel: 'board foot', slug: 'timber', group: 'industrial' },
  WHEAT: { name: 'wheat', title: 'Wheat', unitLabel: 'bushel', slug: 'wheat', group: 'agriculture' },
  SOY: { name: 'soybeans', title: 'Soybeans', unitLabel: 'bushel', slug: 'soybeans', group: 'agriculture' },
  CORN: { name: 'corn', title: 'Corn', unitLabel: 'bushel', slug: 'corn', group: 'agriculture' },
  COTTON: { name: 'cotton', title: 'Cotton', unitLabel: 'lb', slug: 'cotton', group: 'agriculture' },
  OTHER: { name: 'other commodities', title: 'Other Commodities', unitLabel: 'token (unit set by issuer)', slug: 'other', group: 'gems-and-other' },
};

export const commodityMeta = (c: string): CommodityMeta => COMMODITY_META[c as Commodity] ?? COMMODITY_META.OTHER;

export interface TokenDef {
  id: string;                 // URL slug
  name: string;
  project: string;
  issuer: string;
  currency: string;           // 3-char code or 40-hex code as it appears on ledger
  displayCode: string;
  /** Commodity class code (field name kept as `metal` for API stability). */
  metal: Commodity;
  /** Precious metals only: 1 for gram tokens, 31.1034768 for troy-ounce tokens. 0 for non-metal tokens. */
  gramsPerToken: number;
  /** Plain-language unit for non-metal tokens, e.g. "1 MWh of contracted electricity (per issuer)". */
  unitText?: string;
  /** Issuer-controlled wallets (treasury / pre-issuance / hot wallets) excluded from circulating supply. */
  treasuryWallets: string[];
  /** Known off-ledger status. 'discontinued' and 'unverified' (issuer not listed by the project it claims) force CRITICAL.
   *  'unconfirmed' = account attributed to a project by third-party registries, but the project publishes no page/toml listing it (WARN). */
  knownStatus?: 'active' | 'discontinued' | 'unverified' | 'unconfirmed';
  /** 'represented' = issuer-held record-keeping token (RWA.xyz terminology), not freely distributed to the public. */
  tokenization?: 'distributed' | 'represented';
  /** Short neutral label shown next to the name in the UI (e.g. "Unverified listing"). */
  label?: string;
  website?: string;
  notes: string[];
}

export const GRAMS_PER_TROY_OZ = 31.1034768;

export const RLUSD = {
  currency: '524C555344000000000000000000000000000000',
  issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
};

/**
 * Valtorum USD (USDV) — a quote asset only, never graded as a commodity.
 * Issuer on-ledger Domain = valtorum.com and valtorum.com/.well-known/xrp-ledger.toml lists this issuer + code (two-way, checked Oct 31, 2026).
 * Assetiko prime pairs (XAUa/XAGa/XPTa) trade mainly against USDV. Valued at a nominal $1 for depth/price math (issuer claim; not verified).
 */
export const USDV = {
  currency: '5553445600000000000000000000000000000000', // "USDV"
  issuer: 'rfffsukWALJB1PXYk7H8xkR6UJUDT8nMJE',
};

/** Quote assets whose AMM pools and order books are read for every token. */
export type QuoteAsset = 'XRP' | 'RLUSD' | 'USDV';
export const QUOTE_ASSETS: QuoteAsset[] = ['XRP', 'RLUSD', 'USDV'];


/** Ctrl Alt issuer (on-ledger Domain ctrl-alt.co). Verified to exist and to issue the DIA-*-COL1 codes on mainnet Oct 30, 2026. */
const CTRL_ALT_ISSUER = 'rDgoZHy4SLPs4jhJZqkyaXX4iEsEUkCAVp';
const CTRL_ALT_NOTES = [
  'Shown for transparency only; not an endorsement. The issuer account\'s on-ledger Domain is ctrl-alt.co, but ctrl-alt.co serves no xrp-ledger.toml listing it (checked Oct 30, 2026), so the link is one-way. RWA.xyz, DefiLlama and Tokenized.so attribute these DIA-*-COL1 collections to Ctrl Alt.',
  'Part of the Ctrl Alt × Billiton Diamond program (reported >$280M / AED 1B of GIA-certified polished diamonds, Ripple custody technology; CoinDesk, Feb 3, 2026). Wider investor distribution was reported as subject to Dubai VARA approval.',
  'RWA.xyz classifies these collections as "represented" assets; DefiLlama notes the full supply of each collection sat in a single inventory account (reviewed Oct 30, 2026). A single dominant holder is therefore expected, not a sign of a problem.',
  'The same issuer account also issues many other codes (individual GIA-numbered stones and DLD-* codes) that ReserveWatch does not track. Diamonds have no public spot price, so price vs spot is not measured.',
];

export const TOKENS: TokenDef[] = [
  {
    id: 'meld-gld',
    name: 'Meld Gold GLD',
    project: 'Meld Gold (Australia)',
    // Issuer + code as published on https://www.meld.gold/tokens (XRPL section), checked Oct 28, 2026.
    issuer: 'r45PCzxaEWJhWZS8obXnDQK9c2dgYcAfq5',
    currency: 'GLD',
    displayCode: 'GLD',
    metal: 'XAU',
    gramsPerToken: 1,
    treasuryWallets: [],
    knownStatus: 'active',
    website: 'https://www.meld.gold/tokens',
    notes: [
      'Issuer address and code (GLD) taken from Meld\'s official token page (meld.gold/tokens, checked Oct 28, 2026).',
      '1 token = 1 gram gold per Meld documentation.',
      'Live check Oct 28, 2026: 1,000 GLD outstanding, held by a single account; no XRP or RLUSD AMM pool.',
      'Issuer account sets no on-ledger Domain and meld.gold publishes no xrp-ledger.toml, so two-way domain verification is not possible.',
      'Separate MCAU listing on BTC Markets was delisted (cutoff Jun 29, 2026).',
    ],
  },
  {
    id: 'meld-slv',
    name: 'Meld Gold SLV',
    project: 'Meld Gold (Australia)',
    // Issuer + code as published on https://www.meld.gold/tokens (XRPL section), checked Oct 28, 2026.
    issuer: 'r3uhxnfY9UnwyRrrNJy68sQjjyKidBUPrs',
    currency: 'SLV',
    displayCode: 'SLV',
    metal: 'XAG',
    gramsPerToken: 1,
    treasuryWallets: [],
    knownStatus: 'active',
    website: 'https://www.meld.gold/tokens',
    notes: [
      'Issuer address and code (SLV) taken from Meld\'s official token page (meld.gold/tokens, checked Oct 28, 2026).',
      '1 token = 1 gram silver. Included as a bonus (same project as GLD).',
      'Live check Oct 28, 2026: 1,000 SLV outstanding, held by a single account; no XRP or RLUSD AMM pool.',
    ],
  },
  {
    id: 'unlisted-gold-rmeld',
    name: 'Unverified "GOLD" (issuer rMELD…)',
    project: 'Unverified issuer — not on Meld Gold\'s published token list',
    issuer: 'rMELDgMrr8nvbhnb8oiP5aHWakqPJLh5Rn',
    currency: '474F4C4400000000000000000000000000000000', // "GOLD"
    displayCode: 'GOLD',
    metal: 'XAU',
    gramsPerToken: 1, // as assumed by the original research; no issuer documentation confirms it
    // rippLE4uy7... activated this issuer (Oct 1, 2024) and received the initial ~1e11 GOLD issuance;
    // treated as the issuer's own distribution wallet, not circulating supply.
    treasuryWallets: ['rippLE4uy7r898MzuHTeTe7sPfuUDafLB'],
    knownStatus: 'unverified',
    label: 'Unverified listing',
    website: 'https://www.meld.gold/tokens',
    notes: [
      'Shown for transparency only. ReserveWatch does not endorse this token and makes no claim about who operates it; inclusion is not an allegation of wrongdoing.',
      'The issuer\'s on-ledger Domain field reads www.meld.gold. Meld Gold\'s published token page lists different XRPL issuers (GLD r45PCzxa…, SLV r3uhxnfY…), and meld.gold publishes no xrp-ledger.toml, so the Domain reference could not be confirmed (checked Oct 28, 2026).',
      'On-ledger history: rippLE4uy7r898MzuHTeTe7sPfuUDafLB activated the issuer and received the initial ~1e11 GOLD issuance (excluded here as the issuer\'s distribution wallet).',
      'riPPLEymBuFA4nG12YxhNW2hFjj834ztK (largest remaining holder) was funded by the same account as rippLE4uy7… (rfKsmLP6sTfVGDvga6rW6XbmSFUzc3G9f3). Both set Domain ripple.com, which ripple.com\'s xrp-ledger.toml does not list.',
      'The same issuer also issues "SILVER"; its largest SILVER holder is an AMM paired against an "RLUSD" from rLUSDfDx…, which is not the RLUSD issuer published by Ripple (rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De).',
      'Until the issuer\'s identity and reserves are confirmed by the project it references, any on-ledger price here should not be read as reflecting redeemable gold.',
    ],
  },
  {
    id: 'assetiko-xaua',
    name: 'Assetiko XAUa',
    project: 'Assetiko (BVI)',
    issuer: 'rJanYBNcgXZFRqTNcaY5AoPdSEgveJofGw',
    currency: '5841556100000000000000000000000000000000', // "XAUa"
    displayCode: 'XAUa',
    metal: 'XAU',
    gramsPerToken: GRAMS_PER_TROY_OZ,
    treasuryWallets: [],
    knownStatus: 'active',
    website: 'https://gold.assetiko.com',
    notes: [
      '1 token = 1 troy oz gold (mixed reserve: 40–80% physical, 10–50% ETFs/ETCs, up to 30% certificates, up to 10% cash).',
      'Physical redemption excluded for US persons.',
      'DefiLlama labels the platform "Suspicious" (no named team, restricted reserve docs) as of Oct 27, 2026.',
    ],
  },
  {
    id: 'assetiko-xaga',
    name: 'Assetiko XAGa',
    project: 'Assetiko (BVI)',
    // Issuer + code from https://silver.assetiko.com/.well-known/xrp-ledger.toml; issuer Domain = silver.assetiko.com (two-way). Verified on mainnet Oct 30, 2026.
    issuer: 'rQJ1EbtepKKzx4sBCUtPjvSk8CfiAx2H8e',
    currency: '5841476100000000000000000000000000000000', // "XAGa"
    displayCode: 'XAGa',
    metal: 'XAG',
    gramsPerToken: GRAMS_PER_TROY_OZ,
    treasuryWallets: [],
    knownStatus: 'active',
    website: 'https://silver.assetiko.com',
    notes: [
      'Issuer and currency code taken from silver.assetiko.com/.well-known/xrp-ledger.toml; the issuer\'s on-ledger Domain points back to silver.assetiko.com (checked Oct 30, 2026).',
      'Separate issuer account from XAUa (rJanYB… issues XAUa only).',
      '1 token = 1 troy oz silver per issuer metadata, which cites a 102.3% reserve coverage framework (issuer claim; not verified by ReserveWatch).',
      'Live check Oct 30, 2026: ~55,000 XAGa outstanding; clawback enabled.',
      'DefiLlama labels the Assetiko platform "Suspicious" (no named team, restricted reserve docs) as of Oct 27, 2026.',
    ],
  },
  {
    id: 'assetiko-xpta',
    name: 'Assetiko XPTa',
    project: 'Assetiko Commodities Ltd. (BVI)',
    // Issuer + code from https://platinum.assetiko.com/.well-known/xrp-ledger.toml; issuer Domain = platinum.assetiko.com (two-way). Verified on mainnet Oct 30, 2026.
    issuer: 'rGE4oF6VCDPj48ghZYb9uEQwGQ1beqoTJo',
    currency: '5850546100000000000000000000000000000000', // "XPTa"
    displayCode: 'XPTa',
    metal: 'XPT',
    gramsPerToken: GRAMS_PER_TROY_OZ,
    treasuryWallets: [],
    knownStatus: 'active',
    website: 'https://platinum.assetiko.com',
    notes: [
      'Issuer and currency code taken from platinum.assetiko.com/.well-known/xrp-ledger.toml; the issuer\'s on-ledger Domain points back to platinum.assetiko.com (checked Oct 30, 2026).',
      'Separate issuer account from XAUa (rJanYB… issues XAUa only).',
      '1 token = 1 fine troy oz platinum per issuer metadata, which cites a 101.45% reserve coverage framework (issuer claim; not verified by ReserveWatch).',
      'Live check Oct 30, 2026: ~1,923 XPTa outstanding; clawback enabled.',
      'DefiLlama labels the Assetiko platform "Suspicious" (no named team, restricted reserve docs) as of Oct 27, 2026.',
    ],
  },
  {
    id: 'justoken-jmwh',
    name: 'Justoken JMWH (energy, MWh)',
    project: 'Justoken × YPF Luz (Argentina) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (account_info + gateway_balances). Attribution comes from third-party
    // registries (XRPSCAN, RWA.xyz); the account sets no Domain and justoken.com serves no xrp-ledger.toml (HTTP 404, Oct 30, 2026).
    issuer: 'r976xbKc6om7WYTFwZHByvxnYFi1y5hJXH',
    currency: '4A4D574800000000000000000000000000000000', // "JMWH"
    displayCode: 'JMWH',
    metal: 'ENERGY',
    gramsPerToken: 0,
    unitText: '1 token = 1 MWh of electricity under an energy delivery contract (per Justoken / RWA.xyz)',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://www.justoken.com',
    notes: [
      'Shown for transparency only; not an endorsement. ReserveWatch could not confirm from Justoken\'s own published material that this XRPL account is theirs: the account sets no on-ledger Domain and justoken.com serves no xrp-ledger.toml (checked Oct 30, 2026). The account is attributed to Justoken by XRPSCAN and RWA.xyz.',
      'RWA.xyz classifies JMWH as a "represented" commodity asset (Justoken platform), meaning it is a record-keeping token on the issuer\'s platform rather than a freely traded retail token. RWA.xyz showed ~37.15M tokens and $2.23B total value at a $60 NAV (accessed Oct 30, 2026) — an issuer-reported figure, not a ReserveWatch valuation.',
      'Live check Oct 30, 2026: ~36.95M JMWH outstanding; the same account also issues a second code "JMWHC" (~203K), not tracked here. Clawback is enabled on the issuer account.',
      'ReserveWatch uses no public spot benchmark for electricity, so price vs spot is not measured for this token.',
    ],
  },
  {
    id: 'ctrl-alt-dia-ad-col1',
    name: 'Ctrl Alt Diamonds: AD Collection 1',
    project: 'Ctrl Alt × Billiton Diamond (Dubai) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (gateway_balances on the issuer). Attribution: issuer Domain = ctrl-alt.co
    // (no xrp-ledger.toml published there) and third-party registries (RWA.xyz / DefiLlama / Tokenized.so).
    issuer: CTRL_ALT_ISSUER,
    currency: '4449412D41442D434F4C31000000000000000000', // "DIA-AD-COL1"
    displayCode: 'DIA-AD-COL1',
    metal: 'DIAMOND',
    gramsPerToken: 0,
    unitText: 'Share of a certified polished-diamond collection; per-token unit not published by the issuer',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://ctrl-alt.co',
    notes: CTRL_ALT_NOTES,
  },
  {
    id: 'ctrl-alt-dia-ag-col1',
    name: 'Ctrl Alt Diamonds: AG Collection 1',
    project: 'Ctrl Alt × Billiton Diamond (Dubai) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (gateway_balances on the issuer). Attribution: issuer Domain = ctrl-alt.co
    // (no xrp-ledger.toml published there) and third-party registries (RWA.xyz / DefiLlama / Tokenized.so).
    issuer: CTRL_ALT_ISSUER,
    currency: '4449412D41472D434F4C31000000000000000000', // "DIA-AG-COL1"
    displayCode: 'DIA-AG-COL1',
    metal: 'DIAMOND',
    gramsPerToken: 0,
    unitText: 'Share of a certified polished-diamond collection; per-token unit not published by the issuer',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://ctrl-alt.co',
    notes: CTRL_ALT_NOTES,
  },
  {
    id: 'ctrl-alt-dia-fs-col1',
    name: 'Ctrl Alt Diamonds: FS Collection 1',
    project: 'Ctrl Alt × Billiton Diamond (Dubai) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (gateway_balances on the issuer). Attribution: issuer Domain = ctrl-alt.co
    // (no xrp-ledger.toml published there) and third-party registries (RWA.xyz / DefiLlama / Tokenized.so).
    issuer: CTRL_ALT_ISSUER,
    currency: '4449412D46532D434F4C31000000000000000000', // "DIA-FS-COL1"
    displayCode: 'DIA-FS-COL1',
    metal: 'DIAMOND',
    gramsPerToken: 0,
    unitText: 'Share of a certified polished-diamond collection; per-token unit not published by the issuer',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://ctrl-alt.co',
    notes: CTRL_ALT_NOTES,
  },
  {
    id: 'ctrl-alt-dia-kd-col1',
    name: 'Ctrl Alt Diamonds: KD Collection 1',
    project: 'Ctrl Alt × Billiton Diamond (Dubai) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (gateway_balances on the issuer). Attribution: issuer Domain = ctrl-alt.co
    // (no xrp-ledger.toml published there) and third-party registries (RWA.xyz / DefiLlama / Tokenized.so).
    issuer: CTRL_ALT_ISSUER,
    currency: '4449412D4B442D434F4C31000000000000000000', // "DIA-KD-COL1"
    displayCode: 'DIA-KD-COL1',
    metal: 'DIAMOND',
    gramsPerToken: 0,
    unitText: 'Share of a certified polished-diamond collection; per-token unit not published by the issuer',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://ctrl-alt.co',
    notes: CTRL_ALT_NOTES,
  },
  {
    id: 'ctrl-alt-dia-kps-col1',
    name: 'Ctrl Alt Diamonds: KPS Collection 1',
    project: 'Ctrl Alt × Billiton Diamond (Dubai) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (gateway_balances on the issuer). Attribution: issuer Domain = ctrl-alt.co
    // (no xrp-ledger.toml published there) and third-party registries (RWA.xyz / DefiLlama / Tokenized.so).
    issuer: CTRL_ALT_ISSUER,
    currency: '4449412D4B50532D434F4C310000000000000000', // "DIA-KPS-COL1"
    displayCode: 'DIA-KPS-COL1',
    metal: 'DIAMOND',
    gramsPerToken: 0,
    unitText: 'Share of a certified polished-diamond collection; per-token unit not published by the issuer',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://ctrl-alt.co',
    notes: CTRL_ALT_NOTES,
  },
  {
    id: 'ctrl-alt-dia-l-col1',
    name: 'Ctrl Alt Diamonds: L Collection 1',
    project: 'Ctrl Alt × Billiton Diamond (Dubai) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (gateway_balances on the issuer). Attribution: issuer Domain = ctrl-alt.co
    // (no xrp-ledger.toml published there) and third-party registries (RWA.xyz / DefiLlama / Tokenized.so).
    issuer: CTRL_ALT_ISSUER,
    currency: '4449412D4C2D434F4C3100000000000000000000', // "DIA-L-COL1"
    displayCode: 'DIA-L-COL1',
    metal: 'DIAMOND',
    gramsPerToken: 0,
    unitText: 'Share of a certified polished-diamond collection; per-token unit not published by the issuer',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://ctrl-alt.co',
    notes: CTRL_ALT_NOTES,
  },
  {
    id: 'ctrl-alt-dia-s-col1',
    name: 'Ctrl Alt Diamonds: S Collection 1',
    project: 'Ctrl Alt × Billiton Diamond (Dubai) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (gateway_balances on the issuer). Attribution: issuer Domain = ctrl-alt.co
    // (no xrp-ledger.toml published there) and third-party registries (RWA.xyz / DefiLlama / Tokenized.so).
    issuer: CTRL_ALT_ISSUER,
    currency: '4449412D532D434F4C3100000000000000000000', // "DIA-S-COL1"
    displayCode: 'DIA-S-COL1',
    metal: 'DIAMOND',
    gramsPerToken: 0,
    unitText: 'Share of a certified polished-diamond collection; per-token unit not published by the issuer',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://ctrl-alt.co',
    notes: CTRL_ALT_NOTES,
  },
  {
    id: 'ctrl-alt-dia-sd-col1',
    name: 'Ctrl Alt Diamonds: SD Collection 1',
    project: 'Ctrl Alt × Billiton Diamond (Dubai) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (gateway_balances on the issuer). Attribution: issuer Domain = ctrl-alt.co
    // (no xrp-ledger.toml published there) and third-party registries (RWA.xyz / DefiLlama / Tokenized.so).
    issuer: CTRL_ALT_ISSUER,
    currency: '4449412D53442D434F4C31000000000000000000', // "DIA-SD-COL1"
    displayCode: 'DIA-SD-COL1',
    metal: 'DIAMOND',
    gramsPerToken: 0,
    unitText: 'Share of a certified polished-diamond collection; per-token unit not published by the issuer',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://ctrl-alt.co',
    notes: CTRL_ALT_NOTES,
  },
  {
    id: 'ctrl-alt-dia-sg-col1',
    name: 'Ctrl Alt Diamonds: SG Collection 1',
    project: 'Ctrl Alt × Billiton Diamond (Dubai) — represented asset',
    // Issuer + code read on XRPL mainnet Oct 30, 2026 (gateway_balances on the issuer). Attribution: issuer Domain = ctrl-alt.co
    // (no xrp-ledger.toml published there) and third-party registries (RWA.xyz / DefiLlama / Tokenized.so).
    issuer: CTRL_ALT_ISSUER,
    currency: '4449412D53472D434F4C31000000000000000000', // "DIA-SG-COL1"
    displayCode: 'DIA-SG-COL1',
    metal: 'DIAMOND',
    gramsPerToken: 0,
    unitText: 'Share of a certified polished-diamond collection; per-token unit not published by the issuer',
    treasuryWallets: [],
    knownStatus: 'unconfirmed',
    tokenization: 'represented',
    label: 'Issuer link unconfirmed',
    website: 'https://ctrl-alt.co',
    notes: CTRL_ALT_NOTES,
  },
  {
    id: 'bpg-xau',
    name: 'BPG XAU (GateHub)',
    project: 'BPG / GateHub — DISCONTINUED',
    issuer: 'rcoef87SYMJ58NAFx7fNM5frVknmvHsvJ',
    currency: 'XAU',
    displayCode: 'XAU',
    metal: 'XAU',
    gramsPerToken: 1,
    treasuryWallets: ['rh7WFDNxbZ7zfpvpUh5kjrfpGPkDodZFvr'], // BPG published hot wallet
    knownStatus: 'discontinued',
    website: 'https://support.gatehub.net/hc/en-us/articles/24697584224530',
    notes: [
      'Delisted; trading ended Mar 20, 2025; tokens frozen and non-redeemable after Jun 30, 2025.',
      'Included as a control case — any AMM/DEX price is NOT backed by redeemable gold.',
    ],
  },
];
