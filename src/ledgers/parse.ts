// Pure readers for Solana RPC and Stellar Horizon / Soroban JSON. No network.

export interface SolanaMintView {
  supply: number | null;
  decimals: number | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
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

export function parseSolanaMintAccount(body: unknown): { mintAuthority: string | null; freezeAuthority: string | null } {
  const info = (body as { result?: { value?: { data?: { parsed?: { info?: { mintAuthority?: unknown; freezeAuthority?: unknown } } } } } })
    ?.result?.value?.data?.parsed?.info;
  const mint = typeof info?.mintAuthority === 'string' ? info.mintAuthority : null;
  const freeze = typeof info?.freezeAuthority === 'string' ? info.freezeAuthority : null;
  return { mintAuthority: mint, freezeAuthority: freeze };
}

export function parseSolanaHolders(body: unknown): number | null {
  const result = (body as { result?: { total?: unknown; token_accounts?: unknown[] } })?.result;
  if (!result) return null;
  if (typeof result.total === 'number' && Number.isFinite(result.total)) return result.total;
  if (Array.isArray(result.token_accounts)) return result.token_accounts.length;
  return null;
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
  const amount = Number(rec.amount);
  const holders = Number(rec.num_accounts);
  const flags = (rec.flags ?? {}) as Record<string, unknown>;
  const flag = (k: string) => typeof flags[k] === 'boolean' ? flags[k] as boolean : null;
  return {
    supply: Number.isFinite(amount) ? amount : null,
    holders: Number.isFinite(holders) ? holders : null,
    authRequired: flag('auth_required'),
    revocable: flag('auth_revocable'),
    clawback: flag('auth_clawback_enabled'),
  };
}

/** A Soroban total_supply simulation, or a test double that already extracted the number. */
export function parseSorobanSupply(body: unknown): number | null {
  const result = (body as { result?: { supply?: unknown; retval?: unknown } })?.result;
  if (!result) return null;
  if (typeof result.supply === 'number' && Number.isFinite(result.supply)) return result.supply;
  if (typeof result.supply === 'string' && result.supply.trim() && Number.isFinite(Number(result.supply))) return Number(result.supply);
  if (typeof result.retval === 'number' && Number.isFinite(result.retval)) return result.retval;
  if (typeof result.retval === 'string' && Number.isFinite(Number(result.retval))) return Number(result.retval);
  return null;
}
