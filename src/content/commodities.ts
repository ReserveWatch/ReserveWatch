// Commodity-class hub pages (/commodities/:slug). Clear Money Voice: plain words, sourced facts, no advice.
// Every factual claim about issuers below was checked on Oct 30, 2026 (sources named inline). Do NOT add issuer
// addresses here — tracked tokens come only from src/config/tokens.ts, which holds verified on-ledger definitions.
import type { Commodity } from '../config/tokens.js';

export interface ClassPage {
  slug: string;
  /** Singular noun used in "a tokenized ___ token" phrases. */
  noun?: string;
  /** Commodity codes whose TokenDefs are listed on this page. */
  codes: Commodity[];
  title: string;        // <title>
  h1: string;
  description: string;  // meta description (unique per page)
  /** One-paragraph plain-language definition. */
  what: string;
  /** How price comparison works for this class. */
  pricing: string;
  /** Honest status of this class on XRPL (HTML allowed, no issuer addresses). */
  xrplStatus: string;
  /** Optional: what exists on other networks (context only). */
  elsewhere?: string;
  /** Extra questions specific to this class. */
  questions?: string[];
  related?: string[];   // other slugs
}

const SPOT_METAL = (name: string) => `ReserveWatch loads a public spot price for ${name} in US dollars per troy ounce (31.1035 g), then converts it to a price per token using the weight each issuer says one token represents. It compares that with the token's on-ledger price from an AMM pool or DEX order book — but only grades the gap when the pool is deep enough to mean something (see <a href="/methodology#peg">how peg is measured</a>).`;
const NO_SPOT = (name: string, unit: string) => `There is no single free, public spot price for ${name === 'diamond' ? 'diamonds' : name === 'crop' ? 'crops' : name === 'these commodity' ? 'these commodities' : name} that maps cleanly onto a token, and contracts are usually quoted per ${unit} with grade, location and delivery terms that differ by issuer. So ReserveWatch does <b>not</b> compare ${name} tokens with a spot price. Their pages show "price vs spot not measured" instead of a guess, and every other ledger check (supply, issuer flags, freeze, clawback, liquidity, holders, domain verification) still runs.`;
const NONE_TRACKED = (name: string) => `<p><b>No public XRPL issuer of a ${name} token is tracked yet.</b> We looked for an issuer account we could confirm on XRP Ledger mainnet or on the issuer's own published page or <code>xrp-ledger.toml</code>, and found none as of October 30, 2026. When one appears, it gets its own token page here with live checks.</p>`;

export const CLASS_PAGES: ClassPage[] = [
  {
    slug: 'gold', codes: ['XAU'],
    title: 'Tokenized Gold on the XRP Ledger (XRPL): Gold Token Health Checks · ReserveWatch',
    h1: 'Tokenized gold on the XRP Ledger',
    description: 'Every tracked gold token on the XRP Ledger in one place: issuer, circulating supply, clawback and freeze flags, AMM liquidity, and on-ledger price vs spot gold. Automated data, not advice.',
    what: 'A tokenized gold token is a digital IOU that says it stands for a set amount of gold — often 1 gram or 1 troy ounce — held by the issuer or a vault partner. On the XRP Ledger you hold it through a trust line to the issuer\u2019s account. The token is only as good as the issuer\u2019s promise to redeem it; the ledger shows the token, not the metal.',
    pricing: SPOT_METAL('gold'),
    xrplStatus: '<p>Gold has the most XRPL issuers of any commodity class, but most trading is thin: no tracked gold token had a deep AMM pool against XRP or RLUSD in our first <a href="/snapshots">weekly snapshot</a>. Since October 31, 2026 ReserveWatch also reads pools against USDV (Valtorum USD), where Assetiko XAUa does most of its on-ledger trading; see each token page for live depth. One former gold token (BPG / GateHub XAU) was discontinued and frozen in 2025 and stays listed as a control case.</p><p><b>Regolda</b> (recycled gold, Swiss custody) uses XRPL Digital Product Passports and an MPT (multi-purpose token) issuance rather than a classic trust-line token. Public explorers (xrpldashboard, Bithomp) showed that MPT with zero outstanding supply on October 30, 2026, so it is not tracked here yet.</p>',
    elsewhere: 'Most tokenized gold by value lives on other networks — Tether Gold (XAUT) and Paxos Gold (PAXG) are the largest on RWA.xyz (accessed October 30, 2026). Neither is issued natively on the XRP Ledger.',
    questions: ['How many grams or ounces does one token claim to represent, and does the issuer publish a bar list or vault statement?', 'Can holders in your country redeem for metal, or only sell the token?'],
    related: ['silver', 'platinum', 'palladium'],
  },
  {
    slug: 'silver', codes: ['XAG'],
    title: 'Tokenized Silver on the XRP Ledger (XRPL): Silver Token Health Checks · ReserveWatch',
    h1: 'Tokenized silver on the XRP Ledger',
    description: 'Tracked silver tokens on the XRP Ledger with live on-ledger checks: supply, issuer clawback and freeze settings, AMM pools, holders and price vs spot silver. Not investment advice.',
    what: 'A tokenized silver token is an IOU that says it represents a fixed weight of silver — usually 1 gram or 1 troy ounce. Because silver is cheap per ounce and costly to store, fees and redemption minimums matter more than with gold. Check them before relying on a silver token.',
    pricing: SPOT_METAL('silver'),
    xrplStatus: '<p>XRPL silver tokens are small and thinly traded. ReserveWatch tracks the tokens below; each one\u2019s own page shows whether a peg reading was possible.</p>',
    questions: ['Is there a minimum amount you must hold before you can redeem for physical silver?'],
    related: ['gold', 'platinum', 'palladium'],
  },
  {
    slug: 'platinum', codes: ['XPT'],
    title: 'Tokenized Platinum on the XRP Ledger (XRPL): Platinum Token Health · ReserveWatch',
    h1: 'Tokenized platinum on the XRP Ledger',
    description: 'Platinum tokens on the XRP Ledger, checked automatically: circulating supply, issuer flags (clawback, freeze), AMM liquidity, holder concentration and price vs spot platinum. Not advice.',
    what: 'A tokenized platinum token claims to represent a weight of platinum, usually one fine troy ounce. Platinum is a smaller, more industrial market than gold, so spreads and liquidity can be wider.',
    pricing: SPOT_METAL('platinum'),
    xrplStatus: '<p>One platinum issuer is tracked today. Meld Gold has said it planned platinum and palladium tokens; its token page listed only gold and silver when we checked on October 30, 2026.</p>',
    related: ['palladium', 'gold', 'silver'],
  },
  {
    slug: 'palladium', codes: ['XPD'],
    title: 'Tokenized Palladium on the XRP Ledger (XRPL): Palladium Tokens · ReserveWatch',
    h1: 'Tokenized palladium on the XRP Ledger',
    description: 'Is there a palladium token on the XRP Ledger? What a tokenized palladium token is, how ReserveWatch would check it (supply, issuer flags, peg vs spot palladium), and what is tracked today.',
    what: 'A tokenized palladium token would claim to represent a weight of palladium, a precious metal used mostly in car catalytic converters. Like other metals, its value depends on the issuer actually holding the metal and letting holders redeem it.',
    pricing: SPOT_METAL('palladium') + ' A public palladium spot feed is already connected, so a palladium token can be graded on day one.',
    xrplStatus: NONE_TRACKED('palladium'),
    elsewhere: 'Tokenized.so lists palladium exposure from several issuers on other networks (accessed October 30, 2026), some through funds or securities rather than allocated metal.',
    related: ['platinum', 'gold', 'silver'],
  },
  {
    slug: 'oil', codes: ['OIL'],
    title: 'Tokenized Oil on the XRP Ledger (XRPL): Crude Oil Tokens Explained · ReserveWatch',
    h1: 'Tokenized crude oil on the XRP Ledger',
    description: 'What a tokenized oil token is, why there is no simple spot peg for it, the questions to ask an oil token issuer, and whether any crude oil token on the XRP Ledger is tracked today.',
    what: 'A tokenized oil token would represent a claim on barrels of crude oil, a storage receipt, or a contract to deliver oil later. Those are very different things. Physical oil is bulky, graded (WTI, Brent and others) and stored in specific places, so most "oil tokens" are really claims on a contract or a fund, not on barrels you could collect.',
    pricing: NO_SPOT('crude oil', 'barrel'),
    xrplStatus: NONE_TRACKED('crude oil'),
    elsewhere: 'Tokenized.so lists a WTI crude oil product from another issuer on a different network (accessed October 30, 2026). Justoken\u2019s soybean-oil token (JSOY_OIL) is an agricultural product on Polygon, not crude oil and not on XRPL (RWA.xyz).',
    questions: ['Is the token a claim on physical barrels, a storage receipt, a futures position, or a fund share?', 'Which grade and delivery location does it reference, and who stores it?'],
    related: ['natural-gas', 'energy', 'uranium'],
  },
  {
    slug: 'natural-gas', codes: ['NGAS'],
    title: 'Tokenized Natural Gas on the XRP Ledger (XRPL): Explained · ReserveWatch',
    h1: 'Tokenized natural gas on the XRP Ledger',
    description: 'How a tokenized natural gas token would work, why it is usually a contract rather than stored gas, how ReserveWatch would check it on the XRP Ledger, and what is tracked today.',
    what: 'Natural gas is hard to store, so a natural gas token almost always represents a contract — a right to gas delivered through a pipeline over a period, or exposure through a fund — rather than gas sitting in a vault.',
    pricing: NO_SPOT('natural gas', 'MMBtu'),
    xrplStatus: NONE_TRACKED('natural gas'),
    elsewhere: 'Tokenized.so lists natural-gas exposure products on other networks (accessed October 30, 2026); these track funds or securities, not delivered gas.',
    related: ['oil', 'energy', 'uranium'],
  },
  {
    slug: 'energy', noun: 'electricity or energy', codes: ['ENERGY'],
    title: 'Tokenized Energy & Electricity on the XRP Ledger (XRPL): MWh Tokens · ReserveWatch',
    h1: 'Tokenized electricity and energy on the XRP Ledger',
    description: 'Energy tokens on the XRP Ledger, such as megawatt-hour (MWh) tokens: what they represent, why they are "represented" assets, and live on-ledger checks of supply, holders and issuer flags.',
    what: 'An energy token usually stands for an amount of electricity — for example 1 megawatt-hour (MWh) — under a supply contract between a generator and a buyer. You cannot store a megawatt-hour in a vault, so the token is a record of a contract. It is "used up" (often burned) when the power is delivered.',
    pricing: NO_SPOT('electricity', 'MWh'),
    xrplStatus: '<p>Energy is the largest commodity class on the XRP Ledger by reported value, but it is mostly a <b>represented</b> asset: an issuer-run record-keeping token with few holders, not a retail token you can trade on the DEX. ReserveWatch tracks the token below and labels it <span class="pill">Issuer link unconfirmed</span> because the issuer account publishes no on-ledger Domain or <code>xrp-ledger.toml</code>.</p>',
    questions: ['Is the token burned when the power is delivered, and who confirms delivery?', 'Is the reported value a market price, or a contract value set by the issuer?'],
    related: ['oil', 'natural-gas', 'uranium'],
  },
  {
    slug: 'uranium', codes: ['URANIUM'],
    title: 'Tokenized Uranium on the XRP Ledger (XRPL): U3O8 Tokens Explained · ReserveWatch',
    h1: 'Tokenized uranium on the XRP Ledger',
    description: 'What a tokenized uranium (U3O8) token would represent, why custody is tightly regulated, how ReserveWatch would check one on the XRP Ledger, and what is tracked today.',
    what: 'Uranium is traded mostly as U3O8 concentrate and held by licensed converters and storage sites. Ordinary holders cannot take delivery, so a uranium token is a claim on uranium held in a licensed facility, or exposure through a fund.',
    pricing: NO_SPOT('uranium', 'pound of U3O8'),
    xrplStatus: NONE_TRACKED('uranium'),
    elsewhere: 'Tokenized.so lists a U3O8 exposure product on another network (accessed October 30, 2026).',
    related: ['energy', 'oil', 'copper'],
  },
  {
    slug: 'copper', codes: ['COPPER'],
    title: 'Tokenized Copper on the XRP Ledger (XRPL): Copper Tokens Explained · ReserveWatch',
    h1: 'Tokenized copper on the XRP Ledger',
    description: 'How a tokenized copper token would work, why warehouse receipts matter, how ReserveWatch would check one on the XRP Ledger (supply, issuer flags, liquidity), and what is tracked today.',
    what: 'Copper is an industrial metal stored in bulk in exchange-approved warehouses. A copper token would usually represent a warehouse receipt or fund exposure, quoted per pound or per tonne, rather than a small bar you could collect.',
    pricing: NO_SPOT('copper', 'pound'),
    xrplStatus: NONE_TRACKED('copper'),
    elsewhere: 'Tokenized.so lists copper exposure products on other networks, mostly through funds (accessed October 30, 2026).',
    related: ['timber', 'uranium', 'platinum'],
  },
  {
    slug: 'diamonds', noun: 'diamond', codes: ['DIAMOND'],
    title: 'Tokenized Diamonds on the XRP Ledger (XRPL): Diamond Token Checks · ReserveWatch',
    h1: 'Tokenized diamonds on the XRP Ledger',
    description: 'Diamond tokens on the XRP Ledger, including Ctrl Alt diamond collections: what they represent, why there is no spot price, and live checks of supply, holders, clawback and freeze.',
    what: 'Every diamond is different (cut, colour, clarity, carat), so there is no single diamond price the way there is for gold. A diamond token usually represents a share of a certified stone or a collection of stones held by a custodian. Its value depends on the appraisal and on whether holders can sell or redeem.',
    pricing: NO_SPOT('diamond', 'stone or collection'),
    xrplStatus: '<p>The XRP Ledger hosts the Ctrl Alt × Billiton Diamond collections (reported at over $280M of certified polished diamonds, CoinDesk, February 3, 2026). They are <b>represented</b> assets: each collection\u2019s supply sat in a single inventory account, and wider investor distribution was reported as subject to Dubai VARA approval. ReserveWatch reads them from the ledger and labels them <span class="pill">Issuer link unconfirmed</span> because the issuer\u2019s website publishes no <code>xrp-ledger.toml</code> confirming the account. A single dominant holder is expected for these, not a warning sign by itself.</p>',
    elsewhere: 'Tokenized.so also lists Diamond Standard diamond products on other networks (accessed October 30, 2026).',
    questions: ['Is each stone certified (for example by GIA), and is the certificate number linked to the token?', 'Who appraises the collection, how often, and can holders redeem or only transfer?'],
    related: ['other', 'gold', 'timber'],
  },
  {
    slug: 'timber', codes: ['TIMBER'],
    title: 'Tokenized Timber & Forestry on the XRP Ledger (XRPL): Explained · ReserveWatch',
    h1: 'Tokenized timber on the XRP Ledger',
    description: 'What a tokenized timber or forestry token would represent (standing trees, cut lumber or land), the questions to ask, how ReserveWatch would check it on the XRP Ledger, and what is tracked today.',
    what: 'Timber can mean standing trees on forest land, harvested logs, or sawn lumber. A timber token could represent any of these, or a share in the land itself, which is closer to real estate than to a commodity. Read the terms carefully to see which one you are getting.',
    pricing: NO_SPOT('timber', 'board foot or cubic metre'),
    xrplStatus: NONE_TRACKED('timber'),
    questions: ['Does the token represent trees, cut wood, or the land — and who owns the land?', 'How is the timber measured and insured against fire or disease?'],
    related: ['copper', 'agriculture', 'diamonds'],
  },
  {
    slug: 'wheat', codes: ['WHEAT'],
    title: 'Tokenized Wheat on the XRP Ledger (XRPL): Grain Tokens Explained · ReserveWatch',
    h1: 'Tokenized wheat on the XRP Ledger',
    description: 'How a tokenized wheat token would work (warehouse receipts and forward contracts), how ReserveWatch would check it on the XRP Ledger, and whether any wheat token is tracked today.',
    what: 'Grain like wheat is usually tokenized as a warehouse receipt (wheat already in storage) or a forward contract (wheat to be delivered after harvest). Quality grade and storage location change its value.',
    pricing: NO_SPOT('wheat', 'bushel'),
    xrplStatus: NONE_TRACKED('wheat'),
    elsewhere: 'Tokenized.so lists wheat products from several issuers on other networks (accessed October 30, 2026).',
    related: ['agriculture', 'corn', 'soybeans'],
  },
  {
    slug: 'soybeans', noun: 'soybean', codes: ['SOY'],
    title: 'Tokenized Soybeans on the XRP Ledger (XRPL): Soy Tokens Explained · ReserveWatch',
    h1: 'Tokenized soybeans on the XRP Ledger',
    description: 'What a tokenized soybean token represents, which soy tokens exist and on which networks, how ReserveWatch would check one on the XRP Ledger, and what is tracked today.',
    what: 'A soybean token usually represents grain held in a silo (a warehouse receipt) or a contract for a future harvest. Farmers can use these tokens as collateral or to sell part of a crop early.',
    pricing: NO_SPOT('soybeans', 'bushel'),
    xrplStatus: NONE_TRACKED('soybean') + '<p>Justoken\u2019s soybean tokens (JSOY and the soybean-oil token JSOY_OIL) are listed by RWA.xyz on Polygon, not the XRP Ledger. VALYRIA, a Brazilian agricultural forward-contract project in the Ripple/FGV UDAX 2026 accelerator, is building tokenized crop lots; we have not found a public XRPL issuer account for it.</p>',
    related: ['agriculture', 'corn', 'wheat'],
  },
  {
    slug: 'corn', codes: ['CORN'],
    title: 'Tokenized Corn on the XRP Ledger (XRPL): Grain Tokens Explained · ReserveWatch',
    h1: 'Tokenized corn on the XRP Ledger',
    description: 'How a tokenized corn token would represent stored grain or a harvest contract, how ReserveWatch would check it on the XRP Ledger, and whether any corn token is tracked today.',
    what: 'A corn token, like other grain tokens, usually stands for corn in a specific silo or a contract for future delivery. Grade, moisture and storage costs all affect what one token is worth.',
    pricing: NO_SPOT('corn', 'bushel'),
    xrplStatus: NONE_TRACKED('corn') + '<p>Tokenized.so lists a Justoken corn product (accessed October 30, 2026); we found no XRPL issuer account for it.</p>',
    related: ['agriculture', 'soybeans', 'wheat'],
  },
  {
    slug: 'cotton', codes: ['COTTON'],
    title: 'Tokenized Cotton on the XRP Ledger (XRPL): Cotton Tokens Explained · ReserveWatch',
    h1: 'Tokenized cotton on the XRP Ledger',
    description: 'What a tokenized cotton token would represent (bales in a warehouse or a crop contract), how ReserveWatch would check it on the XRP Ledger, and whether any cotton token is tracked today.',
    what: 'Cotton is traded in graded bales stored in warehouses. A cotton token would typically represent specific bales (a warehouse receipt) or a contract for a future crop.',
    pricing: NO_SPOT('cotton', 'pound'),
    xrplStatus: NONE_TRACKED('cotton') + '<p>Tokenized.so lists a Justoken cotton product (accessed October 30, 2026); we found no XRPL issuer account for it.</p>',
    related: ['agriculture', 'corn', 'wheat'],
  },
  {
    slug: 'agriculture', noun: 'agricultural commodity', codes: ['WHEAT', 'SOY', 'CORN', 'COTTON'],
    title: 'Tokenized Agricultural Commodities on the XRP Ledger (XRPL) · ReserveWatch',
    h1: 'Tokenized agricultural commodities on the XRP Ledger',
    description: 'Wheat, soybean, corn and cotton tokens explained: warehouse receipts vs forward contracts, how ReserveWatch would check them on the XRP Ledger, and what is tracked today. Not advice.',
    what: 'Agricultural tokens turn crops into digital records — either grain or fibre already in storage (warehouse receipts) or a promise of a future harvest (forward contracts). They can help farmers raise money or prove ownership, but their value depends on storage, quality grading and the buyer keeping its side of the contract.',
    pricing: NO_SPOT('crop', 'bushel or pound'),
    xrplStatus: NONE_TRACKED('crop') + '<p>See the pages for <a href="/commodities/wheat">wheat</a>, <a href="/commodities/soybeans">soybeans</a>, <a href="/commodities/corn">corn</a> and <a href="/commodities/cotton">cotton</a> for what exists on other networks.</p>',
    questions: ['Is the token backed by crops already in storage, or by a future harvest?', 'Who inspects the silo or warehouse, and what happens if the harvest fails?'],
    related: ['wheat', 'soybeans', 'corn', 'cotton'],
  },
  {
    slug: 'other', noun: 'commodity', codes: ['OTHER'],
    title: 'Other Tokenized Commodities on the XRP Ledger (XRPL) · ReserveWatch',
    h1: 'Other tokenized commodities on the XRP Ledger',
    description: 'Gemstones, rare materials and other commodity tokens on the XRP Ledger: how ReserveWatch checks any commodity IOU, what it can and cannot prove, and how to request a new listing.',
    what: 'Some tokens represent commodities outside the big groups — coloured gemstones, rare earths, coffee, carbon-related products and more. The same rule applies: the ledger shows the token and the issuer\u2019s settings, not the physical goods.',
    pricing: NO_SPOT('these commodity', 'unit set by each issuer'),
    xrplStatus: NONE_TRACKED('commodity in this group') + '<p>If you know of a commodity token on the XRP Ledger, <a href="/contact">contact us</a> with the issuer address and the issuer\u2019s own page or <code>xrp-ledger.toml</code>. We list a token once we can confirm the account on mainnet.</p>',
    elsewhere: 'Tokenized.so lists emerald tokens from GEMx AG on another network (accessed October 30, 2026).',
    related: ['diamonds', 'timber', 'gold'],
  },
];

export const GROUPS: { id: string; title: string; slugs: string[] }[] = [
  { id: 'precious-metals', title: 'Precious metals', slugs: ['gold', 'silver', 'platinum', 'palladium'] },
  { id: 'energy', title: 'Energy', slugs: ['energy', 'oil', 'natural-gas', 'uranium'] },
  { id: 'industrial', title: 'Industrial materials', slugs: ['copper', 'timber'] },
  { id: 'agriculture', title: 'Agriculture', slugs: ['agriculture', 'wheat', 'soybeans', 'corn', 'cotton'] },
  { id: 'gems-and-other', title: 'Gems and other', slugs: ['diamonds', 'other'] },
];
