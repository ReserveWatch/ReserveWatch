// Pure readers for Solana RPC and Stellar Horizon JSON. No network.

export const GRAMS_PER_TROY_OZ = 31.1034768;
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export function troyOz(supply: number, gramsPerToken: number): number {
  return supply * gramsPerToken / GRAMS_PER_TROY_OZ;
}

export function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Native token units from a Soroban total_supply and decimals pair. */
export function sorobanSupply(raw: bigint, decimals: number): number {
  return Number(BigInt(raw)) / 10 ** Number(decimals);
}

export interface SolanaControls {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  program: 'token' | 'token-2022' | null;
  permanentDelegate: boolean;
  pausable: boolean;
  paused: boolean;
  transferHook: boolean;
  defaultFrozen: boolean;
  transferFeeBps: number | null;
  mintCloseAuthority: boolean;
}

export function parseSolanaSupply(body: unknown): { supply: number | null; decimals: number | null } {
  const value = (body as { result?: { value?: { uiAmount?: unknown; uiAmountString?: unknown; amount?: unknown; decimals?: unknown } } })?.result?.value;
  if (!value) return { supply: null, decimals: null };
  const decimals = Number(value.decimals);
  const ui = Number(value.uiAmountString ?? value.uiAmount);
  if (Number.isFinite(ui)) return { supply: ui, decimals: Number.isFinite(decimals) ? decimals : null };
  const raw = Number(value.amount);
  if (Number.isFinite(raw) && Number.isFinite(decimals)) return { supply: raw / 10 ** decimals, decimals };
  return { supply: null, decimals: Number.isFinite(decimals) ? decimals : null };
}

export function parseSolanaMintAccount(body: unknown): SolanaControls {
  const value = (body as { result?: { value?: { owner?: unknown; data?: { parsed?: { info?: Record<string, unknown> } } } } })?.result?.value;
  const info = value?.data?.parsed?.info ?? {};
  const owner = typeof value?.owner === 'string' ? value.owner : '';
  const extensions = Array.isArray(info.extensions) ? info.extensions as { extension?: string; state?: Record<string, unknown> }[] : [];
  const ext = (name: string) => extensions.find(item => item.extension === name);
  const fee = ext('transferFeeConfig');
  const newer = (fee?.state?.newerTransferFee ?? fee?.state) as { transferFeeBasisPoints?: unknown } | undefined;
  const bps = Number(newer?.transferFeeBasisPoints);
  const hook = ext('transferHook')?.state?.programId;
  const paused = ext('pausableConfig')?.state?.paused === true;
  const accountState = String(ext('defaultAccountState')?.state?.state ?? '');
  return {
    mintAuthority: typeof info.mintAuthority === 'string' ? info.mintAuthority : null,
    freezeAuthority: typeof info.freezeAuthority === 'string' ? info.freezeAuthority : null,
    program: owner === TOKEN_2022 ? 'token-2022' : owner === TOKEN_PROGRAM ? 'token' : null,
    permanentDelegate: !!ext('permanentDelegate'),
    pausable: !!ext('pausableConfig'),
    paused,
    transferHook: typeof hook === 'string' && hook.length > 0,
    defaultFrozen: accountState === 'frozen',
    transferFeeBps: Number.isFinite(bps) && bps > 0 ? bps : null,
    mintCloseAuthority: !!ext('mintCloseAuthority'),
  };
}

export function parseSolanaHolders(body: unknown): number | null {
  const result = (body as { result?: { total?: unknown; token_accounts?: unknown[] } })?.result;
  if (!result) return null;
  if (typeof result.total === 'number' && Number.isFinite(result.total)) return result.total;
  if (Array.isArray(result.token_accounts)) return result.token_accounts.length;
  return null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseHorizonAsset(body: unknown): {
  supply: number | null;
  holders: number | null;
  authRequired: boolean | null;
  revocable: boolean | null;
  clawback: boolean | null;
} {
  const rec = (body as { _embedded?: { records?: Record<string, unknown>[] } })?._embedded?.records?.[0];
  if (!rec) return { supply: null, holders: null, authRequired: null, revocable: null, clawback: null };
  const balances = (rec.balances ?? {}) as Record<string, unknown>;
  const accounts = (rec.accounts ?? {}) as Record<string, unknown>;
  const parts = ['authorized', 'authorized_to_maintain_liabilities'].map(key => num(balances[key]));
  const extra = ['claimable_balances_amount', 'liquidity_pools_amount', 'contracts_amount'].map(key => num(rec[key]));
  const supplyParts = [...parts, ...extra];
  const summed = supplyParts.every(part => part != null)
    ? supplyParts.reduce((sum: number, part) => sum + (part ?? 0), 0)
    : null;
  const holdersParts = ['authorized', 'authorized_to_maintain_liabilities'].map(key => num(accounts[key]));
  const holders = holdersParts.every(part => part != null)
    ? holdersParts.reduce((sum: number, part) => sum + (part ?? 0), 0)
    : num(rec.num_accounts);
  const flags = (rec.flags ?? {}) as Record<string, unknown>;
  const flag = (key: string) => typeof flags[key] === 'boolean' ? flags[key] as boolean : null;
  return {
    supply: summed ?? num(rec.amount),
    holders,
    authRequired: flag('auth_required'),
    revocable: flag('auth_revocable'),
    clawback: flag('auth_clawback_enabled'),
  };
}

export function parseJupiterPrices(body: unknown): Record<string, { usdPrice: number | null; liquidity: number | null }> {
  const root = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const out: Record<string, { usdPrice: number | null; liquidity: number | null }> = {};
  for (const [mint, row] of Object.entries(data)) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as { usdPrice?: unknown; liquidity?: unknown };
    out[mint] = { usdPrice: num(rec.usdPrice), liquidity: num(rec.liquidity) };
  }
  return out;
}

export function parseAquaUsdc(body: unknown, inputBaseUnits: bigint, tokenDecimals: number): { usd: number | null; liquidity: number | null } {
  const amount = num((body as { amount?: unknown })?.amount);
  if (amount == null) return { usd: null, liquidity: num((body as { liquidity?: unknown })?.liquidity) };
  const usd = amount / 1e7;
  const tokens = Number(inputBaseUnits) / 10 ** tokenDecimals;
  const liquidity = num((body as { liquidity?: unknown })?.liquidity);
  return { usd: tokens > 0 ? usd / tokens : null, liquidity };
}
