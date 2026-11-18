// Multi-chain commodity growth. Counts and dollars only. No health grade off the XRP Ledger.
//
// Off XRPL, the set is a maintained list of CoinGecko tokenized gold and silver
// listings whose primary network is one we can read. A bridged copy of a token
// already counted on its primary chain is not counted again. CoinGecko's
// headline market cap is not used: Kinesis Gold's headline cap is about $326M
// while the Ethereum contract's supply × price is about $48M. Market value is
// that chain's supply × the token's price. Where the token's unit is an ounce
// or a gram, a price more than 5× from spot is left out rather than treated as
// a matching unit.
//
// 7-day volume for those tokens is CoinGecko's trailing-24h figure at each UTC
// midnight, summed over 7 midnights, and the 7 midnights before that. That
// figure includes centralized venues. It is assigned to the primary chain and
// is not on-chain DEX volume. XRPL volume stays the on-ledger reading.

import { GRAMS_PER_TROY_OZ } from './config/tokens.js';
import { compareWindows, isDollarStable, type VolumeDirection } from './volume.js';

export const CHAIN_PRICE_FACTOR = 5;

export type ChainId = 'xrpl' | 'ethereum' | 'ethereum-l2' | 'solana' | 'stellar' | 'avalanche';
export type ChainNetwork = 'xrpl' | 'ethereum' | 'base' | 'arbitrum-one' | 'optimistic-ethereum' | 'solana' | 'avalanche' | 'stellar';
export type MetalUnit = 'oz' | 'gram' | 'unspecified';
export type ChainMetal = 'XAU' | 'XAG' | 'XPT' | 'XPD' | 'other';

export interface ChainListing {
  id: string;
  chain: ChainId;
  network: ChainNetwork;
  issuer: string;
  symbol: string;
  name: string;
  coingeckoId: string;
  contract: string;
  unit: MetalUnit;
  metal: ChainMetal;
}

export interface ChainDef {
  id: ChainId;
  name: string;
  /** False when this chain is shown but not enumerated. Its figures stay unmeasured, not zero. */
  enumerated: boolean;
  method: string;
}

export const CHAIN_DEFS: ChainDef[] = [
  {
    id: 'xrpl', name: 'XRP Ledger', enumerated: true,
    method: 'Issuers, tokens, and holders are the commodity tokens ReserveWatch already reads on XRPL. Dollar stables are not included. Market value is circulating supply × the token spot where a spot price exists. Tokens with no spot are left out of the dollar figure. 7-day volume is the on-ledger reading.',
  },
  {
    id: 'ethereum', name: 'Ethereum', enumerated: true,
    method: 'Tokenized gold and silver listings whose primary contract is on Ethereum. Market value is that contract’s supply × the token price. A bridged copy on another network is not added. 7-day volume is CoinGecko’s daily traded volume, including centralized venues, for the primary listing.',
  },
  {
    id: 'ethereum-l2', name: 'Ethereum L2s', enumerated: true,
    method: 'Base, Arbitrum, and Optimism only, and only for a commodity token whose primary contract is on that network. Bridged copies of an Ethereum token are not listed again. Supply is read from that network. Volume is CoinGecko’s all-venue daily volume.',
  },
  {
    id: 'solana', name: 'Solana', enumerated: false,
    method: 'Not measured. CoinGecko’s tokenized gold and silver listings on Solana in this set are bridged copies of tokens already counted on their primary chain, or tokenized stocks. They are not added again, and this column is not a scan of every mint.',
  },
  {
    id: 'stellar', name: 'Stellar', enumerated: false,
    method: 'Not measured. This set has no commodity token whose primary network is Stellar. Kinesis is priced from its Ethereum contracts because that is the contract CoinGecko publishes, and those supplies do not match CoinGecko’s headline market cap. No Stellar issuer was guessed.',
  },
  {
    id: 'avalanche', name: 'Avalanche', enumerated: true,
    method: 'Tokenized gold and silver whose primary contract is on Avalanche. Market value is that contract’s supply × the token price. 7-day volume is CoinGecko’s all-venue daily volume.',
  },
];

/** Primary-chain listings. Addresses are the CoinGecko platform contracts checked 18 Nov 2026. */
export const CHAIN_LISTINGS: ChainListing[] = [
  { id: 'paxg', chain: 'ethereum', network: 'ethereum', issuer: 'Paxos', symbol: 'PAXG', name: 'PAX Gold', coingeckoId: 'pax-gold', contract: '0x45804880de22913dafe09f4980848ece6ecbaf78', unit: 'oz', metal: 'XAU' },
  { id: 'xaut', chain: 'ethereum', network: 'ethereum', issuer: 'Tether', symbol: 'XAUT', name: 'Tether Gold', coingeckoId: 'tether-gold', contract: '0x68749665ff8d2d112fa859aa293f07a622782f38', unit: 'oz', metal: 'XAU' },
  { id: 'kau', chain: 'ethereum', network: 'ethereum', issuer: 'Kinesis', symbol: 'KAU', name: 'Kinesis Gold', coingeckoId: 'kinesis-gold', contract: '0x14dab79fd7b7b3f748d434812fd6a9aac460ea52', unit: 'gram', metal: 'XAU' },
  { id: 'kag', chain: 'ethereum', network: 'ethereum', issuer: 'Kinesis', symbol: 'KAG', name: 'Kinesis Silver', coingeckoId: 'kinesis-silver', contract: '0x56ba8b58b7d1f6d384a1c4dd553f39ebc8741b8e', unit: 'oz', metal: 'XAG' },
  { id: 'xaum', chain: 'ethereum', network: 'ethereum', issuer: 'Matrixdock', symbol: 'XAUM', name: 'Matrixdock Gold', coingeckoId: 'matrixdock-gold', contract: '0x2103e845c5e135493bb6c2a4f0b8651956ea8682', unit: 'oz', metal: 'XAU' },
  { id: 'xagm', chain: 'ethereum', network: 'ethereum', issuer: 'Matrixdock', symbol: 'XAGM', name: 'Matrixdock Silver', coingeckoId: 'matrixdock-silver', contract: '0x123ffe0a3c62878dcbee2742227dc8990058d9e1', unit: 'oz', metal: 'XAG' },
  { id: 'vnxau', chain: 'ethereum', network: 'ethereum', issuer: 'VNX', symbol: 'VNXAU', name: 'VNX Gold', coingeckoId: 'vnx-gold', contract: '0x6d57b2e05f26c26b549231c866bdd39779e4a488', unit: 'gram', metal: 'XAU' },
  { id: 'xgz', chain: 'ethereum', network: 'ethereum', issuer: 'GoldZip', symbol: 'XGZ', name: 'GoldZip Gold', coingeckoId: 'goldzip-gold', contract: '0x69af64f409c08e9076bf7f3ed9db3a7409717161', unit: 'gram', metal: 'XAU' },
  { id: 'xauh', chain: 'ethereum', network: 'ethereum', issuer: 'Herculis', symbol: 'XAUH', name: 'Herculis Gold', coingeckoId: 'herculis-gold-coin', contract: '0xa9b17f572341219703bc951725bdb3ca756b1a65', unit: 'gram', metal: 'XAU' },
  { id: 'dgld', chain: 'ethereum', network: 'ethereum', issuer: 'Digital Gold', symbol: 'DGLD', name: 'Digital Gold', coingeckoId: 'gold-token-sa-dgld-tokenized-gold', contract: '0xa9299c296d7830a99414d1e5546f5171fa01e9c8', unit: 'oz', metal: 'XAU' },
  { id: 'tgld', chain: 'ethereum', network: 'ethereum', issuer: 'Tenbin', symbol: 'TGLD', name: 'Tenbin Gold', coingeckoId: 'tenbin-gold', contract: '0x6a547b25534234bb79ce6961a23db13de154b6f4', unit: 'oz', metal: 'XAU' },
  { id: 'stt', chain: 'ethereum', network: 'ethereum', issuer: 'SilverTimes', symbol: 'STT', name: 'SilverTimes', coingeckoId: 'silvertimes-token', contract: '0x9f13a262ac5be07a8e6eac09d01daf00be5e0fce', unit: 'oz', metal: 'XAG' },
  { id: 'ggbr', chain: 'ethereum', network: 'ethereum', issuer: 'Goldfish', symbol: 'GGBR', name: 'Goldfish Gold', coingeckoId: 'goldfish-gold', contract: '0x7e2ac793f3e692f388e66c7dc28f739d13b0b71a', unit: 'unspecified', metal: 'XAU' },
  { id: 'goldst', chain: 'ethereum', network: 'ethereum', issuer: 'Strato', symbol: 'GOLDST', name: 'Strato Gold', coingeckoId: 'strato-goldst-tokenized-gold', contract: '0xf6c8a66788fddea78eb4654a8b5674b2fe1857cb', unit: 'oz', metal: 'XAU' },
  { id: 'silvst', chain: 'ethereum', network: 'ethereum', issuer: 'Strato', symbol: 'SILVST', name: 'Strato Silver', coingeckoId: 'strato-silvst-tokenized-silver', contract: '0x5925525658c86d2c3117f79c0c88203cbec812c1', unit: 'oz', metal: 'XAG' },
  { id: 'pgold', chain: 'ethereum-l2', network: 'arbitrum-one', issuer: 'Pleasing Gold', symbol: 'PGOLD', name: 'Pleasing Gold', coingeckoId: 'pleasing-gold', contract: '0x3e76bb02286bfeaa89dd35f11253f2cbce634f91', unit: 'oz', metal: 'XAU' },
  { id: 'gldy', chain: 'ethereum-l2', network: 'base', issuer: 'Streamex', symbol: 'GLDY', name: 'Streamex GLDY', coingeckoId: 'streamex-gldy', contract: '0x632db1aaace73401a5dc8cde6e9062b8ec0fd819', unit: 'oz', metal: 'XAU' },
  { id: 'gramg', chain: 'avalanche', network: 'avalanche', issuer: 'Gram', symbol: 'GRAMG', name: 'Gram Gold', coingeckoId: 'gram-gold', contract: '0xae55ab6a966863cb4c774ba8e6c0a37cfbea01f9', unit: 'gram', metal: 'XAU' },
  { id: 'grams', chain: 'avalanche', network: 'avalanche', issuer: 'Gram', symbol: 'GRAMS', name: 'Gram Silver', coingeckoId: 'gram-silver', contract: '0x97cf07b5401b76d69bf48a4f6fdf63684e0748e0', unit: 'gram', metal: 'XAG' },
];

export const CHAIN_METHOD =
  'Commodity tokens only. Dollar stables are not counted. XRPL figures reuse ReserveWatch’s own ledger readings. Other chains use a maintained list of CoinGecko tokenized gold and silver listings, one primary chain each. Market value is that chain’s token supply × the token price, not a headline market cap and not a vault value. A stated ounce or gram whose price is more than 5× from spot is not measured. 7-day volume on XRPL is on-ledger. Elsewhere it is CoinGecko’s traded volume across the venues it tracks, summed from seven UTC midnights, and it is not limited to that chain’s DEX. Holders are counted on XRPL only. Solana and Stellar are not enumerated. A missing figure is not measured, not zero.';

export interface MetalSpots { XAU?: number | null; XAG?: number | null; XPT?: number | null; XPD?: number | null }

/** Expected USD for one token of a stated unit. Null when this token has no spot check. */
export function expectedUnitPrice(unit: MetalUnit, metal: ChainMetal, spots: MetalSpots): number | null {
  if (unit === 'unspecified' || metal === 'other') return null;
  const spot = spots[metal];
  if (spot == null || !(spot > 0)) return null;
  return unit === 'gram' ? spot / GRAMS_PER_TROY_OZ : spot;
}

export function priceFarFromSpot(price: number | null, unit: MetalUnit, metal: ChainMetal, spots: MetalSpots): boolean {
  if (price == null || !(price > 0)) return false;
  const expected = expectedUnitPrice(unit, metal, spots);
  if (expected == null) return false;
  return price > expected * CHAIN_PRICE_FACTOR || price < expected / CHAIN_PRICE_FACTOR;
}

/** Sum the trailing-24h volume at each UTC midnight. The live intraday point overlaps the latest midnight, so it is left out. */
export function midnightVolumes(points: [number, number][]): number[] {
  return points
    .filter(([ts, value]) => {
      if (!Number.isFinite(ts) || !Number.isFinite(value) || value < 0) return false;
      const d = new Date(ts);
      return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
    })
    .map(([, value]) => value);
}

export function splitSevenDayVolume(points: [number, number][]): { recent: number | null; prior: number | null } {
  const days = midnightVolumes(points);
  if (days.length < 14) return { recent: null, prior: null };
  const last = days.slice(-14);
  const prior = last.slice(0, 7).reduce((s, n) => s + n, 0);
  const recent = last.slice(7).reduce((s, n) => s + n, 0);
  return { recent, prior };
}

export interface XrplChainToken {
  id: string;
  issuer: string;
  currency: string;
  symbol: string;
  name: string;
  holders: number | null;
  circulating: number | null;
  /** Spot USD per token. Null when this commodity has no spot, or the spot read failed. */
  usdPerToken: number | null;
  /** True when this commodity class has no public spot. Left out of the dollar figure, not a failed read. */
  noSpot: boolean;
  /** True when the token unit is not confirmed, so supply × spot would be a guess. */
  unitUnconfirmed?: boolean;
  volumeUsd: number | null;
  priorVolumeUsd: number | null;
  volumeMeasured: boolean;
}

export interface OffchainReading {
  listing: ChainListing;
  supply: number | null;
  priceUsd: number | null;
  volume7dUsd: number | null;
  priorVolume7dUsd: number | null;
  note: string;
}

export interface ChainTokenRow {
  id: string;
  chain: ChainId;
  network: string;
  issuer: string;
  symbol: string;
  name: string;
  supply: number | null;
  priceUsd: number | null;
  marketValueUsd: number | null;
  volume7dUsd: number | null;
  priorVolume7dUsd: number | null;
  holders: number | null;
  /** Left out of the chain dollar figure on purpose. Not a failed read. */
  omitValue: boolean;
  note: string;
}

export interface ChainSummary {
  id: ChainId;
  name: string;
  enumerated: boolean;
  issuers: number | null;
  tokens: number | null;
  holders: number | null;
  marketValueUsd: number | null;
  volume7dUsd: number | null;
  priorMarketValueUsd: number | null;
  priorVolume7dUsd: number | null;
  marketChangePct: number | null;
  marketDirection: VolumeDirection;
  volumeChangePct: number | null;
  volumeDirection: VolumeDirection;
  /** Tokens left out of the dollar figure because the read failed or the price was far from spot. */
  marketGaps: number;
  volumeGaps: number;
  /** Tokens left out of the dollar figure on purpose: no spot, or a unit the issuer has not confirmed. */
  noSpot: number;
  rows: ChainTokenRow[];
  method: string;
}

export interface ChainWeekPoint {
  id: ChainId;
  marketValueUsd: number | null;
  volume7dUsd: number | null;
  marketComplete: boolean;
  volumeComplete: boolean;
}

export interface ChainWeek {
  week: string;
  asOf: string;
  chains: ChainWeekPoint[];
}

export interface ChainGrowth {
  asOf: string;
  source: 'reservewatch-chains';
  method: string;
  chains: ChainSummary[];
  trend: ChainWeek[];
  historyNote: string;
}

const HISTORY = 'Weekly snapshots saved before this reading do not include chain counts. Those weeks were not reconstructed. The trend is the saved market value and 7-day volume of each chain, once two complete weeks exist.';

function sumNullable(values: (number | null)[]): number | null {
  if (values.some(v => v == null)) return null;
  return values.reduce<number>((s, n) => s + (n ?? 0), 0);
}

function changeOf(current: number | null, prior: number | null, ok: boolean): { changePct: number | null; direction: VolumeDirection } {
  if (!ok || current == null) return { changePct: null, direction: 'unknown' };
  return compareWindows(current, prior, prior != null);
}

function chainOf(id: ChainId, rows: ChainTokenRow[], prior: ChainWeekPoint | undefined, enumerated: boolean): ChainSummary {
  const def = CHAIN_DEFS.find(c => c.id === id)!;
  const expected = id === 'xrpl' ? rows.length : CHAIN_LISTINGS.filter(l => l.chain === id).length;
  if (enumerated && expected > 0 && rows.length === 0) {
    return {
      id, name: def.name, enumerated: true,
      issuers: null, tokens: null, holders: null,
      marketValueUsd: null, volume7dUsd: null, priorMarketValueUsd: null, priorVolume7dUsd: null,
      marketChangePct: null, marketDirection: 'unknown', volumeChangePct: null, volumeDirection: 'unknown',
      marketGaps: 0, volumeGaps: 0, noSpot: 0, rows, method: def.method,
    };
  }
  if (!enumerated) {
    return {
      id, name: def.name, enumerated: false,
      issuers: null, tokens: null, holders: null,
      marketValueUsd: null, volume7dUsd: null, priorMarketValueUsd: null, priorVolume7dUsd: null,
      marketChangePct: null, marketDirection: 'unknown', volumeChangePct: null, volumeDirection: 'unknown',
      marketGaps: 0, volumeGaps: 0, noSpot: 0, rows, method: def.method,
    };
  }
  const issuers = new Set(rows.map(r => r.issuer)).size;
  const noSpot = rows.filter(r => r.omitValue).length;
  const marketGaps = rows.filter(r => !r.omitValue && r.marketValueUsd == null).length;
  const volumeGaps = rows.filter(r => r.volume7dUsd == null).length;
  const holderGaps = rows.filter(r => r.holders == null).length;
  const marketValues = rows.filter(r => !r.omitValue).map(r => r.marketValueUsd);
  const marketValueUsd = marketGaps === 0 ? marketValues.reduce<number>((s, n) => s + (n ?? 0), 0) : (marketValues.some(n => n != null) ? marketValues.reduce<number>((s, n) => s + (n ?? 0), 0) : null);
  const marketComplete = marketGaps === 0;
  const volumeComplete = volumeGaps === 0 && rows.length > 0;
  const volume7dUsd = volumeComplete ? rows.reduce((s, r) => s + (r.volume7dUsd ?? 0), 0) : (rows.some(r => r.volume7dUsd != null) ? rows.reduce((s, r) => s + (r.volume7dUsd ?? 0), 0) : null);
  const priorVolume7dUsd = volumeComplete ? sumNullable(rows.map(r => r.priorVolume7dUsd)) : null;
  const priorMarket = prior?.marketComplete ? prior.marketValueUsd : null;
  const marketChange = changeOf(marketComplete ? marketValueUsd : null, priorMarket, marketComplete && prior?.marketComplete === true);
  const volumeChange = changeOf(volumeComplete ? volume7dUsd : null, priorVolume7dUsd, volumeComplete && priorVolume7dUsd != null);
  const holders = holderGaps === 0 ? rows.reduce((s, r) => s + (r.holders ?? 0), 0) : null;
  return {
    id, name: def.name, enumerated: true, issuers, tokens: rows.length, holders,
    marketValueUsd: rows.length === 0 ? 0 : marketValueUsd,
    volume7dUsd: rows.length === 0 ? 0 : volume7dUsd,
    priorMarketValueUsd: priorMarket, priorVolume7dUsd,
    marketChangePct: marketChange.changePct, marketDirection: marketChange.direction,
    volumeChangePct: volumeChange.changePct, volumeDirection: volumeChange.direction,
    marketGaps, volumeGaps, noSpot, rows, method: def.method,
  };
}

export function xrplRows(tokens: XrplChainToken[]): ChainTokenRow[] {
  return tokens.filter(t => !isDollarStable(t.currency)).map(t => {
    const omit = t.noSpot || !!t.unitUnconfirmed;
    const market = !omit && t.circulating != null && t.usdPerToken != null ? t.circulating * t.usdPerToken : null;
    return {
      id: t.id, chain: 'xrpl', network: 'xrpl', issuer: t.issuer, symbol: t.symbol, name: t.name,
      supply: t.circulating, priceUsd: t.usdPerToken, marketValueUsd: market,
      volume7dUsd: t.volumeMeasured ? t.volumeUsd : null,
      priorVolume7dUsd: t.volumeMeasured ? t.priorVolumeUsd : null,
      holders: t.holders, omitValue: omit,
      note: t.unitUnconfirmed ? 'The token unit is not confirmed by the issuer. Left out of the dollar figure.'
        : t.noSpot ? 'No public spot. Left out of the dollar figure.'
        : (market == null ? 'Supply or spot was not read.' : ''),
    };
  });
}

export function offchainRow(reading: OffchainReading, spots: MetalSpots): ChainTokenRow {
  const { listing: L } = reading;
  const far = priceFarFromSpot(reading.priceUsd, L.unit, L.metal, spots);
  const market = reading.supply != null && reading.priceUsd != null && !far ? reading.supply * reading.priceUsd : null;
  const volumeOk = !far && reading.volume7dUsd != null;
  const note = [
    reading.note,
    far ? `Token price is more than ${CHAIN_PRICE_FACTOR}× from spot for a ${L.unit}. Left out of the dollar figure and the volume.` : '',
    L.unit === 'unspecified' && market != null ? 'Unit is not an ounce or a gram. Market value is supply × token price.' : '',
  ].filter(Boolean).join(' ');
  return {
    id: L.id, chain: L.chain, network: L.network, issuer: L.issuer, symbol: L.symbol, name: L.name,
    supply: reading.supply, priceUsd: reading.priceUsd,
    marketValueUsd: market,
    volume7dUsd: volumeOk ? reading.volume7dUsd : null,
    priorVolume7dUsd: volumeOk ? reading.priorVolume7dUsd : null,
    holders: null, omitValue: false,
    note,
  };
}

export function buildChainGrowth(opts: {
  asOf: string;
  xrpl: XrplChainToken[];
  offchain: OffchainReading[];
  spots: MetalSpots;
  trend: ChainWeek[];
  week: string;
}): ChainGrowth {
  const priorWeek = [...opts.trend].reverse().find(w => w.week !== opts.week);
  const priorPoint = (id: ChainId) => priorWeek?.chains.find(c => c.id === id);
  const offRows = opts.offchain.map(r => offchainRow(r, opts.spots));
  const byChain = new Map<ChainId, ChainTokenRow[]>();
  for (const def of CHAIN_DEFS) byChain.set(def.id, []);
  for (const row of xrplRows(opts.xrpl)) byChain.get('xrpl')!.push(row);
  for (const row of offRows) byChain.get(row.chain)!.push(row);
  const chains = CHAIN_DEFS.map(def => chainOf(def.id, byChain.get(def.id) ?? [], priorPoint(def.id), def.enumerated));
  return {
    asOf: opts.asOf, source: 'reservewatch-chains', method: CHAIN_METHOD, chains, trend: opts.trend, historyNote: HISTORY,
  };
}

export function rememberChainWeek(points: ChainWeek[], point: ChainWeek): ChainWeek[] {
  const useful = point.chains.some(c => c.marketComplete || c.volumeComplete);
  if (!useful) return points.slice();
  const next = points.filter(p => p.week !== point.week);
  next.push(point);
  next.sort((a, b) => a.week < b.week ? -1 : 1);
  return next.slice(-12);
}

export function weekPoint(summary: ChainSummary): ChainWeekPoint {
  const marketComplete = summary.enumerated && summary.marketGaps === 0 && summary.marketValueUsd != null;
  const volumeComplete = summary.enumerated && summary.volumeGaps === 0 && summary.volume7dUsd != null;
  return {
    id: summary.id,
    marketValueUsd: marketComplete ? summary.marketValueUsd : null,
    volume7dUsd: volumeComplete ? summary.volume7dUsd : null,
    marketComplete, volumeComplete,
  };
}
