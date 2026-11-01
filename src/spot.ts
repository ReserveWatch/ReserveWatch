// Spot reference prices (USD per commodity unit, e.g. per troy oz for metals).
// Default: https://api.gold-api.com (free, no API key), which covers XAU / XAG / XPT / XPD only.
// Commodities without a configured `spotSymbol` (oil, diamonds, energy, crops, …) return a null price
// with `unsupported: true` — the monitor then reports "price vs spot not measured" instead of guessing.
// Override the feed with SPOT_API_URL_TEMPLATE ({symbol} placeholder; response must contain a numeric
// `price`), or pin values with SPOT_STATIC_<CODE> (e.g. SPOT_STATIC_XAU) for offline/demo use.
import { commodityMeta, type Commodity } from './config/tokens.js';

export interface SpotQuote {
  metal: Commodity;
  /** USD per `unitLabel`. Kept as `usdPerOz` for API compatibility; for metals the unit is the troy ounce. */
  usdPerOz: number | null;
  /** Same value as usdPerOz, under a unit-neutral name. */
  usdPerUnit: number | null;
  unitLabel: string;
  /** True when ReserveWatch has no public spot feed for this commodity class. */
  unsupported?: boolean;
  source: string; at: string; error?: string;
}

const TEMPLATE = process.env.SPOT_API_URL_TEMPLATE || 'https://api.gold-api.com/price/{symbol}';

export async function getSpot(code: Commodity): Promise<SpotQuote> {
  const meta = commodityMeta(code);
  const base = { metal: code, unitLabel: meta.unitLabel };
  const stat = process.env[`SPOT_STATIC_${code}`];
  if (stat) return { ...base, usdPerOz: Number(stat), usdPerUnit: Number(stat), source: `env SPOT_STATIC_${code}`, at: new Date().toISOString() };
  if (!meta.spotSymbol) {
    return { ...base, usdPerOz: null, usdPerUnit: null, unsupported: true, source: 'none', at: new Date().toISOString(),
      error: `no public spot reference configured for ${meta.name}` };
  }
  const url = TEMPLATE.replace('{symbol}', meta.spotSymbol);
  try {
    const headers: Record<string, string> = {};
    if (process.env.SPOT_API_KEY) headers['x-access-token'] = process.env.SPOT_API_KEY;
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j: any = await r.json();
    const p = Number(j.price);
    if (!Number.isFinite(p) || p <= 0) throw new Error('no numeric price in response');
    return { ...base, usdPerOz: p, usdPerUnit: p, source: url, at: j.updatedAt || new Date().toISOString() };
  } catch (e) {
    return { ...base, usdPerOz: null, usdPerUnit: null, source: url, at: new Date().toISOString(), error: (e as Error).message };
  }
}
