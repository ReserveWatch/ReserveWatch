import { Client } from 'xrpl';

const ENDPOINTS = (process.env.XRPL_WS_URLS || 'wss://xrplcluster.com,wss://s1.ripple.com,wss://s2.ripple.com')
  .split(',').map(s => s.trim()).filter(Boolean);

let client: Client | null = null;
let startIdx = 0;
const TRANSIENT = /slowDown|tooBusy|noNetwork|noCurrent|timeout|Timeout|NotConnected|DisconnectedError|websocket/i;
export const isTransient = (code?: string) => !!code && TRANSIENT.test(code);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function getClient(): Promise<Client> {
  if (client?.isConnected()) return client;
  let lastErr: unknown;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    const url = ENDPOINTS[(startIdx + i) % ENDPOINTS.length];
    try {
      const c = new Client(url, { connectionTimeout: 15000 });
      await c.connect();
      c.on('error', (e: unknown) => console.warn('[xrpl] ws error', e));
      client = c;
      console.log(`[xrpl] connected ${url}`);
      return c;
    } catch (e) {
      lastErr = e;
      console.warn(`[xrpl] failed ${url}:`, (e as Error).message);
    }
  }
  throw new Error(`All XRPL endpoints failed: ${(lastErr as Error)?.message}`);
}

/** Thin wrapper: returns result or {error} for expected ledger errors (actNotFound etc.).
 *  Rate-limit / transient errors (slowDown, tooBusy, timeouts) are retried with backoff, rotating endpoints. */
export async function req<T = any>(r: Record<string, unknown>): Promise<{ result?: T; error?: string }> {
  let code = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const c = await getClient();
      const res: any = await c.request(r as any);
      return { result: res.result as T };
    } catch (e: any) {
      code = e?.data?.error || e?.message || String(e);
      if (!isTransient(code)) return { error: code };
      await sleep(800 * 2 ** attempt);
      if (attempt >= 1) { // rotate to next endpoint
        startIdx = (startIdx + 1) % ENDPOINTS.length;
        try { await client?.disconnect(); } catch { /* ignore */ }
        client = null;
      }
    }
  }
  return { error: code };
}

export async function closeClient() {
  if (client?.isConnected()) await client.disconnect();
  client = null;
}

export function endpointList() { return ENDPOINTS; }
