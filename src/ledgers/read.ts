// Reads Solana and Stellar commodity tokens. One ledger's failure does not throw.
import { getSpot } from '../spot.js';
import { CHAIN_TOKENS, type ChainToken } from './registry.js';
import { parseHorizonAsset, parseSolanaHolders, parseSolanaMintAccount, parseSolanaSupply, parseSorobanSupply } from './parse.js';

export interface ChainCheck { key: string; result: 'ok' | 'feature' | 'na'; message: string }

export interface ChainReading {
  id: string;
  ledger: ChainToken['ledger'];
  name: string;
  project: string;
  displayCode: string;
  bridged: boolean;
  address: string;
  issuer?: string;
  kind: ChainToken['kind'];
  explorerUrl: string;
  website: string;
  supply: number | null;
  holders: number | null;
  holdersNote: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  authRequired: boolean | null;
  clawback: boolean | null;
  spotUsd: number | null;
  peg: 'na';
  pegNote: string;
  checks: ChainCheck[];
  error?: string;
  updatedAt: string;
  notes: string[];
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const SOLANA_RPC = () => process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const HORIZON = () => process.env.STELLAR_HORIZON_URL || 'https://horizon.stellar.org';
const SOROBAN = () => process.env.STELLAR_SOROBAN_RPC_URL || 'https://mainnet.sorobanrpc.com';

async function rpc(fetchImpl: FetchLike, url: string, method: string, params: unknown): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json() as { error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || 'rpc error');
  return body;
}

function base(token: ChainToken, spotUsd: number | null, now: string): ChainReading {
  return {
    id: token.id, ledger: token.ledger, name: token.name, project: token.project, displayCode: token.displayCode,
    bridged: token.bridged, address: token.address, issuer: token.issuer, kind: token.kind,
    explorerUrl: token.explorerUrl, website: token.website,
    supply: null, holders: null, holdersNote: '', mintAuthority: null, freezeAuthority: null,
    authRequired: null, clawback: null, spotUsd, peg: 'na',
    pegNote: 'Price vs spot is not available. ReserveWatch has no on-ledger price for this token.',
    checks: [], error: undefined, updatedAt: now, notes: token.notes,
  };
}

function finish(row: ChainReading): ChainReading {
  const checks: ChainCheck[] = [];
  if (row.supply != null) checks.push({ key: 'supply', result: 'ok', message: `Supply read from the public ${row.ledger} endpoint. This count is tokens, not a vault check.` });
  else checks.push({ key: 'supply', result: 'na', message: row.error ? `Supply not available (${row.error}).` : 'Supply not available from the public endpoint.' });
  if (row.holders != null) checks.push({ key: 'holders', result: 'ok', message: `${row.holders} holder accounts reported. Not a safety rating.` });
  else checks.push({ key: 'holders', result: 'na', message: row.holdersNote || 'Holder count is not available.' });
  if (row.ledger === 'solana') {
    checks.push(row.mintAuthority
      ? { key: 'mint', result: 'feature', message: 'Mint authority is set. The controller can create more tokens. That is an issuer control, not an event.' }
      : { key: 'mint', result: 'na', message: 'Mint authority was not returned.' });
    checks.push(row.freezeAuthority
      ? { key: 'freeze', result: 'feature', message: 'Freeze authority is set. The controller can freeze accounts. That is an issuer control, not an event.' }
      : { key: 'freeze', result: 'na', message: row.freezeAuthority === null ? 'No freeze authority was returned. A missing field is not proof the authority is gone.' : 'Freeze authority was not returned.' });
  }
  if (row.ledger === 'stellar' && row.kind === 'classic') {
    if (row.authRequired != null) checks.push({ key: 'auth', result: 'feature', message: row.authRequired ? 'AUTH_REQUIRED is on. The issuer must approve a trustline.' : 'AUTH_REQUIRED is off.' });
    if (row.clawback != null) checks.push({ key: 'clawback', result: 'feature', message: row.clawback ? 'Clawback is enabled on the issuer account.' : 'Clawback is not enabled on the issuer account.' });
  }
  if (row.kind === 'sep41') checks.push({ key: 'sep41', result: 'na', message: 'SEP-41 contract controls (blocklist, forced transfer) are not graded here. Supply is the Soroban total_supply call when the RPC returns a number.' });
  checks.push({ key: 'peg', result: 'na', message: row.pegNote });
  if (row.bridged) checks.push({ key: 'bridged', result: 'na', message: 'Marked bridged. The on-ledger supply is the bridged representation, not a separate vault check.' });
  return { ...row, checks };
}

async function readSolana(token: ChainToken, fetchImpl: FetchLike, env: NodeJS.ProcessEnv, spotUsd: number | null, now: string): Promise<ChainReading> {
  const row = base(token, spotUsd, now);
  const rpcUrl = env.SOLANA_RPC_URL || SOLANA_RPC();
  try {
    const supplyBody = await rpc(fetchImpl, rpcUrl, 'getTokenSupply', [token.address]);
    const parsed = parseSolanaSupply(supplyBody);
    row.supply = parsed.supply;
  } catch (e) { row.error = (e as Error).message; }
  try {
    const infoBody = await rpc(fetchImpl, rpcUrl, 'getAccountInfo', [token.address, { encoding: 'jsonParsed' }]);
    const auth = parseSolanaMintAccount(infoBody);
    row.mintAuthority = auth.mintAuthority;
    row.freezeAuthority = auth.freezeAuthority;
  } catch { /* authority stays unavailable; supply may still be present */ }
  if (env.SOLANA_INDEXER_URL) {
    try {
      const body = await rpc(fetchImpl, env.SOLANA_INDEXER_URL, 'getTokenAccounts', { mint: token.address, limit: 1000 });
      row.holders = parseSolanaHolders(body);
      row.holdersNote = row.holders == null ? 'The indexer did not return a holder count.' : '';
    } catch (e) { row.holdersNote = `Holder count not available (${(e as Error).message}).`; }
  } else {
    row.holdersNote = 'Not available. The public Solana RPC does not return holder counts. SOLANA_INDEXER_URL is unset.';
  }
  return finish(row);
}

async function readStellar(token: ChainToken, fetchImpl: FetchLike, env: NodeJS.ProcessEnv, spotUsd: number | null, now: string): Promise<ChainReading> {
  const row = base(token, spotUsd, now);
  const horizon = (env.STELLAR_HORIZON_URL || HORIZON()).replace(/\/$/, '');
  const soroban = env.STELLAR_SOROBAN_RPC_URL || SOROBAN();
  try {
    if (token.kind === 'classic' && token.issuer) {
      const res = await fetchImpl(`${horizon}/assets?asset_code=${encodeURIComponent(token.address)}&asset_issuer=${encodeURIComponent(token.issuer)}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseHorizonAsset(await res.json());
      row.supply = parsed.supply;
      row.holders = parsed.holders;
      row.authRequired = parsed.authRequired;
      row.clawback = parsed.clawback;
      row.holdersNote = parsed.holders == null ? 'Horizon did not return a trustline count.' : 'Trustlines reported by Horizon. A trustline is not a holder of metal.';
    } else {
      const body = await rpc(fetchImpl, soroban, 'simulateTransaction', { contractId: token.address, function: 'total_supply' });
      row.supply = parseSorobanSupply(body);
      row.holders = null;
      row.holdersNote = 'Not available. SEP-41 holder counts are not read from the public Soroban RPC.';
      if (row.supply == null) row.error = 'Soroban did not return total_supply.';
    }
  } catch (e) { row.error = (e as Error).message; }
  return finish(row);
}

/** Read every non-XRPL token. A thrown request becomes a row with an error, never a thrown batch. */
export async function readChainLedgers(opts: { fetchImpl?: FetchLike; env?: NodeJS.ProcessEnv; spotUsd?: number | null } = {}): Promise<ChainReading[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const env = opts.env ?? process.env;
  let spot = opts.spotUsd ?? null;
  if (opts.spotUsd === undefined) {
    try { spot = (await getSpot('XAU')).usdPerOz; } catch { spot = null; }
  }
  const now = new Date().toISOString();
  const out: ChainReading[] = [];
  for (const token of CHAIN_TOKENS) {
    try {
      out.push(token.ledger === 'solana'
        ? await readSolana(token, fetchImpl, env, spot, now)
        : await readStellar(token, fetchImpl, env, spot, now));
    } catch (e) {
      const row = base(token, spot, now);
      row.error = (e as Error).message;
      row.holdersNote = 'Not available.';
      out.push(finish(row));
    }
  }
  return out;
}
