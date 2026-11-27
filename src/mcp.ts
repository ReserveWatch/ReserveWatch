// Keyless, read-only MCP endpoint (Streamable HTTP, JSON-RPC 2.0).
// Every tool result carries the factual payload, a canonical page URL, and the disclaimer.

import { isTrackedToken, presentAttestation, presentAttestations, PUBLIC_RECORD_DISCLAIMER, ATTESTATION_CHECKED } from './content/attestations.js';
import { SITE_URL } from './seo.js';

export const MCP_PROTOCOL = '2025-06-18';
const SUPPORTED = new Set(['2025-06-18', '2025-03-26']);

export interface JsonRpc {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

export interface McpToolText {
  type: 'text';
  text: string;
}

export interface McpToolResult {
  content: McpToolText[];
  structuredContent: {
    data: unknown;
    canonicalUrl: string;
    disclaimer: string;
  };
  isError?: boolean;
}

export interface McpContext {
  listTokens: () => unknown;
  tokenReading: (id: string) => unknown | null;
  escrow: () => Promise<unknown>;
}

const TOOLS = [
  {
    name: 'list_commodity_tokens',
    description: 'List tracked commodity tokens and the canonical ReserveWatch page for each. Read only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_token_reading',
    description: 'Return the cached public reading for one commodity token id, plus its canonical page URL. Read only. Not a vault audit.',
    inputSchema: {
      type: 'object',
      properties: { tokenId: { type: 'string', description: 'ReserveWatch token id, for example solana-paxg or meld-gld.' } },
      required: ['tokenId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_attestation_freshness',
    description: 'Issuer-published attestation date, cadence, and freshness for one token or the full registry. Read only. ReserveWatch has not audited any vault.',
    inputSchema: {
      type: 'object',
      properties: { tokenId: { type: 'string', description: 'Optional token id. Omit for every tracked token.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_xrpl_escrow_readiness',
    description: 'allowTrustLineLocking (XLS-85) for tracked XRPL commodity tokens, plus RLUSD as a reference settlement asset, not a commodity token. Read only.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

function toolResult(data: unknown, canonicalUrl: string, isError = false): McpToolResult {
  const text = `${JSON.stringify(data)}\n\nCanonical URL: ${canonicalUrl}\n${PUBLIC_RECORD_DISCLAIMER}`;
  return {
    content: [{ type: 'text', text }],
    structuredContent: { data, canonicalUrl, disclaimer: PUBLIC_RECORD_DISCLAIMER },
    ...(isError ? { isError: true } : {}),
  };
}

function rpcResult(id: JsonRpc['id'], result: unknown) {
  return { jsonrpc: '2.0' as const, id: id ?? null, result };
}

function rpcError(id: JsonRpc['id'], code: number, message: string) {
  return { jsonrpc: '2.0' as const, id: id ?? null, error: { code, message } };
}

function argsOf(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object') return {};
  const record = params as { arguments?: unknown; name?: unknown };
  if (record.arguments && typeof record.arguments === 'object') return record.arguments as Record<string, unknown>;
  return {};
}

async function callTool(name: string, args: Record<string, unknown>, ctx: McpContext): Promise<McpToolResult> {
  if (name === 'list_commodity_tokens') {
    return toolResult(ctx.listTokens(), `${SITE_URL}/`);
  }
  if (name === 'get_token_reading') {
    const tokenId = typeof args.tokenId === 'string' ? args.tokenId : '';
    if (!tokenId || !isTrackedToken(tokenId)) {
      return toolResult({ error: 'Unknown token id.', tokenId }, `${SITE_URL}/`, true);
    }
    const reading = ctx.tokenReading(tokenId);
    return toolResult(
      reading ?? { tokenId, reading: 'not loaded' },
      `${SITE_URL}/token/${tokenId}`,
    );
  }
  if (name === 'get_attestation_freshness') {
    const tokenId = typeof args.tokenId === 'string' ? args.tokenId : '';
    if (tokenId && !isTrackedToken(tokenId)) {
      return toolResult({ error: 'Unknown token id.', tokenId }, `${SITE_URL}/attestations`, true);
    }
    const data = tokenId
      ? presentAttestation(tokenId)
      : { checkedDate: ATTESTATION_CHECKED, entries: presentAttestations() };
    const url = tokenId ? `${SITE_URL}/token/${tokenId}` : `${SITE_URL}/attestations`;
    return toolResult(data, url);
  }
  if (name === 'get_xrpl_escrow_readiness') {
    return toolResult(await ctx.escrow(), `${SITE_URL}/#token-escrow`);
  }
  return toolResult({ error: 'Unknown tool.', name }, `${SITE_URL}/`, true);
}

export async function handleMcpMessage(message: JsonRpc, ctx: McpContext): Promise<{ status: number; body: unknown | null }> {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return { status: 400, body: rpcError(message?.id ?? null, -32600, 'Invalid Request') };
  }
  const { method } = message;
  const notification = message.id === undefined;
  if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
    return { status: 202, body: null };
  }
  if (method === 'initialize') {
    const requested = (message.params as { protocolVersion?: string } | undefined)?.protocolVersion;
    const protocolVersion = requested && SUPPORTED.has(requested) ? requested : MCP_PROTOCOL;
    return {
      status: 200,
      body: rpcResult(message.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'ReserveWatch', version: '1.0.0' },
        instructions: `Read-only public ledger readings. ${PUBLIC_RECORD_DISCLAIMER}`,
      }),
    };
  }
  if (method === 'ping') return { status: 200, body: rpcResult(message.id, {}) };
  if (method === 'tools/list') return { status: 200, body: rpcResult(message.id, { tools: TOOLS }) };
  if (method === 'tools/call') {
    const params = message.params as { name?: unknown } | undefined;
    const name = typeof params?.name === 'string' ? params.name : '';
    if (!name) return { status: 200, body: rpcError(message.id, -32602, 'Invalid params') };
    const known = TOOLS.some(tool => tool.name === name);
    if (!known) return { status: 200, body: rpcError(message.id, -32602, 'Unknown tool') };
    const result = await callTool(name, argsOf(message.params), ctx);
    return { status: 200, body: rpcResult(message.id, result) };
  }
  if (notification) return { status: 202, body: null };
  return { status: 200, body: rpcError(message.id, -32601, 'Method not found') };
}

export function wantsEventStream(accept: string | undefined): boolean {
  const header = accept || '';
  return header.includes('text/event-stream') && !header.includes('application/json');
}
