// Live reads for the off-XRPL commodity list. Public RPC for supply, CoinGecko for price and daily volume.
import { CHAIN_LISTINGS, splitSevenDayVolume, type ChainListing, type OffchainReading } from './chains.js';

const CG = () => (process.env.COINGECKO_API || 'https://api.coingecko.com/api/v3').replace(/\/+$/, '');
const RPC: Record<string, string> = {
  ethereum: process.env.ETH_RPC || 'https://ethereum.publicnode.com',
  base: process.env.BASE_RPC || 'https://base.publicnode.com',
  'arbitrum-one': process.env.ARB_RPC || 'https://arbitrum-one.publicnode.com',
  'optimistic-ethereum': process.env.OP_RPC || 'https://optimism.publicnode.com',
  avalanche: process.env.AVAX_RPC || 'https://avalanche-c-chain.publicnode.com',
  solana: process.env.SOL_RPC || 'https://api.mainnet-beta.solana.com',
};

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function bounded<T>(work: Promise<T>, ms = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  try { return await Promise.race([work, limit]); }
  finally { if (timer) clearTimeout(timer); }
}

async function getJson(url: string): Promise<any | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await bounded(fetch(url, { signal: AbortSignal.timeout(10000), headers: { accept: 'application/json', 'user-agent': 'ReserveWatch' } }));
      if (r.status === 429 || r.status >= 500) { await pause(1200 * (attempt + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch {
      if (attempt === 1) return null;
      await pause(800);
    }
  }
  return null;
}

async function rpc(url: string, method: string, params: unknown[]): Promise<any | null> {
  try {
    const r = await bounded(fetch(url, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'content-type': 'application/json', 'user-agent': 'ReserveWatch' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }));
    if (!r.ok) return null;
    const body = await r.json();
    return body?.result ?? null;
  } catch { return null; }
}

async function evmSupply(network: string, contract: string): Promise<number | null> {
  const url = RPC[network];
  if (!url) return null;
  const supplyHex = await rpc(url, 'eth_call', [{ to: contract, data: '0x18160ddd' }, 'latest']);
  const decHex = await rpc(url, 'eth_call', [{ to: contract, data: '0x313ce567' }, 'latest']);
  if (typeof supplyHex !== 'string' || typeof decHex !== 'string') return null;
  const decimals = Number(BigInt(decHex));
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const raw = BigInt(supplyHex);
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  const supply = Number(whole) + Number(frac) / Number(base);
  return Number.isFinite(supply) ? supply : null;
}

async function solSupply(mint: string): Promise<number | null> {
  const url = RPC.solana;
  const result = await rpc(url, 'getTokenSupply', [mint]);
  const amount = Number(result?.value?.uiAmount);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

async function supplyOf(listing: ChainListing): Promise<number | null> {
  if (listing.network === 'solana') return solSupply(listing.contract);
  return evmSupply(listing.network, listing.contract);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function loadOffchainReadings(listings: ChainListing[] = CHAIN_LISTINGS): Promise<OffchainReading[]> {
  const prices = new Map<string, number>();
  for (const group of chunk(listings, 50)) {
    const ids = group.map(l => l.coingeckoId).join(',');
    const body = await getJson(`${CG()}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&per_page=250&page=1&sparkline=false`);
    if (Array.isArray(body)) {
      for (const row of body) {
        const price = Number(row?.current_price);
        if (row?.id && Number.isFinite(price) && price > 0) prices.set(String(row.id), price);
      }
    }
  }
  const out: OffchainReading[] = new Array(listings.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const n = cursor++;
      if (n >= listings.length) return;
      const listing = listings[n];
    const supply = await supplyOf(listing);
    await pause(450);
    const chart = await getJson(`${CG()}/coins/${encodeURIComponent(listing.coingeckoId)}/market_chart?vs_currency=usd&days=14&interval=daily`);
    const points: [number, number][] = Array.isArray(chart?.total_volumes)
      ? chart.total_volumes.map((p: unknown) => Array.isArray(p) ? [Number(p[0]), Number(p[1])] as [number, number] : null).filter((p: [number, number] | null): p is [number, number] => !!p)
      : [];
    const split = splitSevenDayVolume(points);
    const notes = [
      supply == null ? 'Supply was not read from the network.' : '',
      !prices.has(listing.coingeckoId) ? 'Token price was not read.' : '',
      split.recent == null ? '7-day volume was not read.' : '',
    ].filter(Boolean);
    out[n] = {
      listing, supply, priceUsd: prices.get(listing.coingeckoId) ?? null,
      volume7dUsd: split.recent, priorVolume7dUsd: split.prior, note: notes.join(' '),
    };
    }
  }
  await worker();
  const missing = out.map((row, i) => row.volume7dUsd == null ? i : -1).filter(i => i >= 0);
  if (missing.length) await pause(8000);
  for (const n of missing) {
    const listing = listings[n];
    await pause(700);
    const chart = await getJson(`${CG()}/coins/${encodeURIComponent(listing.coingeckoId)}/market_chart?vs_currency=usd&days=14&interval=daily`);
    const points: [number, number][] = Array.isArray(chart?.total_volumes)
      ? chart.total_volumes.map((p: unknown) => Array.isArray(p) ? [Number(p[0]), Number(p[1])] as [number, number] : null).filter((p: [number, number] | null): p is [number, number] => !!p)
      : [];
    const split = splitSevenDayVolume(points);
    if (split.recent == null) continue;
    out[n] = {
      ...out[n], volume7dUsd: split.recent, priorVolume7dUsd: split.prior,
      note: out[n].note.replace('7-day volume was not read.', '').trim(),
    };
  }
  return out;
}
