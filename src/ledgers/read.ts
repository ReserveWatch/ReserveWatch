// Reads Solana and Stellar commodity tokens. One token's failure does not throw.
import { rpc as SRpc, Contract, TransactionBuilder, Networks, Account, Keypair, BASE_FEE, scValToNative } from '@stellar/stellar-sdk';
import { getSpot } from '../spot.js';
import { CHAIN_TOKENS, type ChainToken } from './registry.js';
import { fmtNum, parseAquaUsdc, parseHorizonAsset, parseJupiterPrices, parseSolanaHolders, parseSolanaMintAccount, parseSolanaSupply, sorobanSupply, troyOz, type SolanaControls, GRAMS_PER_TROY_OZ } from './parse.js';

export interface ChainCheck { key: string; result: 'ok' | 'feature' | 'na' | 'warn' | 'critical'; message: string }

export interface ChainReading {
  id: string;
  ledger: ChainToken['ledger'];
  name: string;
  project: string;
  displayCode: string;
  metal: 'gold';
  gramsPerToken: number;
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
  revocable: boolean | null;
  clawback: boolean | null;
  controls: SolanaControls | null;
  spotUsd: number | null;
  /** Public gold spot feed named on the reading. Empty when the caller passed a number only. */
  spotSource: string;
  priceUsd: number | null;
  pricePerOz: number | null;
  liquidityUsd: number | null;
  pegNote: string;
  checks: ChainCheck[];
  error?: string;
  updatedAt: string;
  notes: string[];
  /** False when supply is a known zero. Those rows stay listed and stay out of totals. */
  countInTotal: boolean;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type SorobanCall = (rpcUrl: string, contractId: string, fn: string) => Promise<unknown>;

const SOLANA_RPC = () => process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const HORIZON = () => process.env.STELLAR_HORIZON_URL || 'https://horizon.stellar.org';
const SOROBAN = () => process.env.STELLAR_SOROBAN_RPC_URL || 'https://mainnet.sorobanrpc.com';
const USDC_STELLAR = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
const USDC_CLASSIC = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
/** Quote liquidity, in USD, required before a Solana or Stellar price is graded. */
export const CHAIN_PEG_LIQ_USD = 25_000;
const PRICE_TTL = 5 * 60 * 1000;

export const SOLANA_ENDPOINT = SOLANA_RPC;
export const HORIZON_ENDPOINT = HORIZON;
export const SOROBAN_ENDPOINT = SOROBAN;

const lastGood = new Map<string, ChainReading>();
const priceCache = new Map<string, { at: number; value: unknown }>();

export async function sorobanCall(rpcUrl: string, contractId: string, fn: string): Promise<unknown> {
  const server = new SRpc.Server(rpcUrl);
  const src = new Account(Keypair.random().publicKey(), '0');
  const tx = new TransactionBuilder(src, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC })
    .addOperation(new Contract(contractId).call(fn))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (SRpc.Api.isSimulationError(sim)) throw new Error(sim.error.split('\n')[0]);
  return scValToNative(sim.result!.retval);
}

function unreachable(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error || '');
  if (!msg || /fetch failed|failed to fetch|network|econn|enotfound|timeout|aborted/i.test(msg)) return 'endpoint unreachable at last check';
  return msg.split('\n')[0];
}

async function rpc(fetchImpl: FetchLike, url: string, method: string, params: unknown): Promise<unknown> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json() as { error?: { message?: string }; result?: { error?: unknown } };
  if (body.error) throw new Error(body.error.message || 'rpc error');
  if (body.result && typeof body.result === 'object' && 'error' in body.result && body.result.error) {
    throw new Error(String(body.result.error).split('\n')[0]);
  }
  return body;
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T | null> {
  const hit = priceCache.get(key);
  if (hit && Date.now() - hit.at < PRICE_TTL) return hit.value as T;
  try {
    const value = await load();
    priceCache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return hit ? hit.value as T : null;
  }
}

function emptyControls(): SolanaControls {
  return { mintAuthority: null, freezeAuthority: null, program: null, permanentDelegate: false, pausable: false, paused: false, transferHook: false, defaultFrozen: false, transferFeeBps: null, mintCloseAuthority: false };
}

function base(token: ChainToken, spotUsd: number | null, now: string): ChainReading {
  return {
    id: token.id, ledger: token.ledger, name: token.name, project: token.project, displayCode: token.displayCode,
    metal: 'gold', gramsPerToken: token.gramsPerToken, bridged: token.bridged, address: token.address, issuer: token.issuer,
    kind: token.kind, explorerUrl: token.explorerUrl, website: token.website,
    supply: null, holders: null, holdersNote: '', mintAuthority: null, freezeAuthority: null,
    authRequired: null, revocable: null, clawback: null, controls: null, spotUsd, spotSource: '',
    priceUsd: null, pricePerOz: null, liquidityUsd: null,
    pegNote: 'Price vs spot is not available.',
    checks: [], error: undefined, updatedAt: now, notes: token.notes, countInTotal: true,
  };
}

function applyPrice(row: ChainReading, usdPerToken: number | null, liquidity: number | null) {
  row.priceUsd = usdPerToken;
  row.liquidityUsd = liquidity;
  if (usdPerToken == null || !(row.gramsPerToken > 0)) {
    row.pegNote = 'Price vs spot is not available.';
    return;
  }
  const perOz = usdPerToken * GRAMS_PER_TROY_OZ / row.gramsPerToken;
  row.pricePerOz = perOz;
  const thin = liquidity == null || liquidity < CHAIN_PEG_LIQ_USD;
  if (thin) {
    row.pegNote = `About ${fmtNum(perOz)} USD per troy oz. Thin market, not graded.`;
    return;
  }
  if (row.spotUsd == null) {
    row.pegNote = `About ${fmtNum(perOz)} USD per troy oz. Spot was not available, so the gap is not graded.`;
    return;
  }
  const gap = ((perOz - row.spotUsd) / row.spotUsd) * 100;
  const abs = Math.abs(gap);
  row.pegNote = abs >= 10
    ? `About ${fmtNum(perOz)} USD per troy oz, ${fmtNum(abs)}% from spot. Liquidity is about ${fmtNum(liquidity!)} USD.`
    : abs >= 3
      ? `About ${fmtNum(perOz)} USD per troy oz, ${fmtNum(abs)}% from spot.`
      : `About ${fmtNum(perOz)} USD per troy oz, within ${fmtNum(abs)}% of spot.`;
}

function pegGrade(row: ChainReading): ChainCheck['result'] {
  if (row.pricePerOz == null || row.spotUsd == null || row.liquidityUsd == null || row.liquidityUsd < CHAIN_PEG_LIQ_USD) return 'na';
  const abs = Math.abs((row.pricePerOz - row.spotUsd) / row.spotUsd);
  if (abs >= 0.1) return 'critical';
  if (abs >= 0.03) return 'warn';
  return 'ok';
}

function finish(row: ChainReading): ChainReading {
  const checks: ChainCheck[] = [];
  if (row.supply === 0 && row.ledger === 'stellar') {
    row.countInTotal = false;
    checks.push({ key: 'supply', result: 'ok', message: '0 issued on Stellar. The token stays listed. It is left out of totals.' });
  } else if (row.supply != null) {
    const oz = troyOz(row.supply, row.gramsPerToken);
    checks.push({ key: 'supply', result: 'ok', message: `${fmtNum(row.supply)} ${row.displayCode} = ${fmtNum(row.supply * row.gramsPerToken)} g ≈ ${fmtNum(oz)} troy oz. This count is tokens, not a vault check.` });
  } else checks.push({ key: 'supply', result: 'na', message: row.error ? `Supply not available (${row.error}).` : 'Supply not available from the public endpoint.' });
  if (row.holders != null) checks.push({ key: 'holders', result: 'ok', message: `${row.holders} holder accounts reported. Not a safety rating.` });
  else checks.push({ key: 'holders', result: 'na', message: row.holdersNote || 'Holder count is not available.' });
  if (row.ledger === 'solana') {
    checks.push(row.mintAuthority
      ? { key: 'mint', result: 'feature', message: 'Mint authority is set. The controller can create more tokens. That is an issuer control, not an event.' }
      : { key: 'mint', result: 'na', message: 'Mint authority was not returned. A missing field is not proof the authority is gone.' });
    checks.push(row.freezeAuthority
      ? { key: 'freeze', result: 'feature', message: 'Freeze authority is set. The controller can freeze accounts. That is an issuer control, not an event.' }
      : { key: 'freeze', result: 'na', message: 'Freeze authority was not returned.' });
    const c = row.controls;
    if (c?.permanentDelegate) checks.push({ key: 'permanentDelegate', result: 'feature', message: 'A permanent delegate can move or burn any holder\'s tokens. That is an issuer control, like clawback, not an event.' });
    if (c?.paused) checks.push({ key: 'paused', result: 'critical', message: 'Transfers are paused. That is an active control, not a vault finding.' });
    else if (c?.pausable) checks.push({ key: 'pausable', result: 'feature', message: 'The mint can pause all transfers. That is an issuer control, not an event. It is not paused in this reading.' });
    if (c?.transferHook) checks.push({ key: 'transferHook', result: 'feature', message: 'A transfer hook program is set. That is an issuer control, not an event.' });
    if (c?.defaultFrozen) checks.push({ key: 'defaultFrozen', result: 'feature', message: 'New token accounts start frozen. That is an issuer control, not an event.' });
    if (c?.transferFeeBps) checks.push({ key: 'transferFee', result: 'feature', message: `A transfer fee of ${c.transferFeeBps} bps is set. That is an issuer control, not an event.` });
    if (c?.mintCloseAuthority) checks.push({ key: 'mintClose', result: 'feature', message: 'A mint close authority is set. That is an issuer control, not an event.' });
  }
  if (row.ledger === 'stellar' && row.kind === 'classic') {
    if (row.authRequired != null) checks.push({ key: 'auth', result: 'feature', message: row.authRequired ? 'AUTH_REQUIRED is on. The issuer must approve a trustline. That is an issuer control, not an event.' : 'AUTH_REQUIRED is off.' });
    if (row.revocable != null) checks.push({ key: 'revocable', result: 'feature', message: row.revocable ? 'Authorization is revocable. The issuer can freeze a trustline. That is an issuer control, not an event.' : 'Authorization is not revocable.' });
    if (row.clawback != null) checks.push({ key: 'clawback', result: 'feature', message: row.clawback ? 'Clawback is enabled on the issuer account. That is an issuer control, not an event.' : 'Clawback is not enabled on the issuer account.' });
  }
  if (row.id === 'stellar-xaum') {
    checks.push({ key: 'forced-transfer', result: 'feature', message: 'The published XAUm contract includes forced transfer. That is an issuer control, not an event.' });
    checks.push({ key: 'blocklist', result: 'feature', message: 'The published XAUm contract includes a blocklist. That is an issuer control, not an event.' });
    checks.push({ key: 'upgrade', result: 'feature', message: 'The published XAUm contract has a timelocked upgrade. That is an issuer control, not an event.' });
    checks.push({ key: 'roles', result: 'feature', message: 'The published XAUm contract has Owner, Operator, and Revoker roles. Those are issuer controls, not an event.' });
  }
  checks.push({ key: 'peg', result: pegGrade(row), message: row.pegNote });
  if (row.bridged) checks.push({ key: 'bridged', result: 'na', message: 'Marked bridged. The on-ledger supply is the bridged representation, not a separate vault check.' });
  return { ...row, checks };
}

function keep(row: ChainReading): ChainReading {
  const prev = lastGood.get(row.id);
  const failed = row.supply == null && !!row.error;
  if (failed && prev && prev.supply != null) {
    const note = `Last good reading as of ${prev.updatedAt}.`;
    return finish({ ...prev, error: 'endpoint unreachable at last check', notes: prev.notes.includes(note) ? prev.notes : [...prev.notes, note] });
  }
  if (row.error) row.error = unreachable(new Error(row.error));
  if (row.supply != null) lastGood.set(row.id, row);
  return finish(row);
}

async function readSolana(token: ChainToken, fetchImpl: FetchLike, env: NodeJS.ProcessEnv, spotUsd: number | null, quote: { usdPrice: number | null; liquidity: number | null } | undefined, now: string): Promise<ChainReading> {
  const row = base(token, spotUsd, now);
  const rpcUrl = env.SOLANA_RPC_URL || SOLANA_RPC();
  try {
    const supplyBody = await rpc(fetchImpl, rpcUrl, 'getTokenSupply', [token.address]);
    row.supply = parseSolanaSupply(supplyBody).supply;
  } catch (e) { row.error = unreachable(e); }
  try {
    const infoBody = await rpc(fetchImpl, rpcUrl, 'getAccountInfo', [token.address, { encoding: 'jsonParsed' }]);
    const auth = parseSolanaMintAccount(infoBody);
    row.controls = auth;
    row.mintAuthority = auth.mintAuthority;
    row.freezeAuthority = auth.freezeAuthority;
  } catch { row.controls = emptyControls(); }
  if (env.SOLANA_INDEXER_URL) {
    try {
      const body = await rpc(fetchImpl, env.SOLANA_INDEXER_URL, 'getTokenAccounts', { mint: token.address, limit: 1000 });
      row.holders = parseSolanaHolders(body);
      row.holdersNote = row.holders == null ? 'The indexer did not return a holder count.' : '';
    } catch (e) { row.holdersNote = `Holder count not available (${unreachable(e)}).`; }
  } else row.holdersNote = 'Holder count is not available on this ledger yet.';
  applyPrice(row, quote?.usdPrice ?? null, quote?.liquidity ?? null);
  return keep(row);
}

async function readStellar(token: ChainToken, fetchImpl: FetchLike, env: NodeJS.ProcessEnv, spotUsd: number | null, now: string, call: SorobanCall): Promise<ChainReading> {
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
      row.revocable = parsed.revocable;
      row.clawback = parsed.clawback;
      row.holdersNote = parsed.holders == null ? 'Horizon did not return a trustline count.' : 'Trustlines reported by Horizon. A trustline is not a holder of metal.';
      const path = await cached(`path:${token.address}`, async () => {
        const url = `${horizon}/paths/strict-send?source_asset_type=credit_alphanum12&source_asset_code=${encodeURIComponent(token.address)}&source_asset_issuer=${encodeURIComponent(token.issuer!)}&source_amount=1&destination_assets=${encodeURIComponent(`USDC:${USDC_CLASSIC}`)}`;
        const quote = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
        if (!quote.ok) throw new Error(`HTTP ${quote.status}`);
        return quote.json();
      });
      const dest = Number((path as { _embedded?: { records?: { destination_amount?: unknown }[] } })?._embedded?.records?.[0]?.destination_amount);
      applyPrice(row, Number.isFinite(dest) ? dest : null, null);
    } else {
      const [raw, dec] = await Promise.all([call(soroban, token.address, 'total_supply'), call(soroban, token.address, 'decimals')]);
      row.supply = sorobanSupply(raw as bigint, Number(dec));
      row.holders = null;
      row.holdersNote = 'Not available. SEP-41 holder counts are not read from the public Soroban RPC.';
      const aqua = await cached(`aqua:${token.address}`, async () => {
        const res = await fetchImpl('https://amm-api.aqua.network/api/external/v1/find-path/', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token_in_address: token.address, token_out_address: USDC_STELLAR, amount: '1000000000' }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
      const parsed = aqua ? parseAquaUsdc(aqua, 1000000000n, Number(dec)) : { usd: null, liquidity: null };
      applyPrice(row, parsed.usd, parsed.liquidity);
    }
  } catch (e) { row.error = unreachable(e); }
  return keep(row);
}

export interface ReadOpts {
  fetchImpl?: FetchLike;
  env?: NodeJS.ProcessEnv;
  spotUsd?: number | null;
  sorobanCall?: SorobanCall;
}

/** Read every non-XRPL token in parallel. A failed token keeps its last good numbers. */
export async function readChainLedgers(opts: ReadOpts = {}): Promise<ChainReading[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const env = opts.env ?? process.env;
  const call = opts.sorobanCall ?? sorobanCall;
  let spot = opts.spotUsd ?? null;
  let spotSource = '';
  if (opts.spotUsd === undefined) {
    try {
      const quote = await getSpot('XAU');
      spot = quote.usdPerOz;
      spotSource = quote.source;
    } catch { spot = null; }
  }
  const now = new Date().toISOString();
  const mints = CHAIN_TOKENS.filter(token => token.ledger === 'solana').map(token => token.address);
  const jupiter = await cached(`jup:${mints.join(',')}`, async () => {
    const res = await fetchImpl(`https://lite-api.jup.ag/price/v3?ids=${mints.join(',')}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseJupiterPrices(await res.json());
  });
  const settled = await Promise.allSettled(CHAIN_TOKENS.map(token => token.ledger === 'solana'
    ? readSolana(token, fetchImpl, env, spot, jupiter?.[token.address], now)
    : readStellar(token, fetchImpl, env, spot, now, call)));
  return settled.map((item, i) => {
    const row = item.status === 'fulfilled' ? item.value : (() => {
      const failed = base(CHAIN_TOKENS[i], spot, now);
      failed.error = unreachable(item.reason);
      failed.holdersNote = 'Not available.';
      return keep(failed);
    })();
    return { ...row, spotSource };
  });
}

export function resetLedgerMemoryForTests(): void {
  lastGood.clear();
  priceCache.clear();
}

export function supplyLabel(supply: number | null, ledger: string, grams: number, unit = 'tokens'): string {
  if (supply == null) return 'not available';
  if (supply === 0 && ledger === 'stellar') return '0 issued on Stellar';
  if (!(grams > 0)) return `${fmtNum(supply)} ${unit}`;
  return fmtNum(troyOz(supply, grams));
}
