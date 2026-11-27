import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { TOKENS } from '../src/config/tokens.ts';
import {
  ageDays, allAttestations, ATTESTATION_DISCLAIMER, freshnessLabel, freshnessStatus, presentAttestation, PUBLIC_RECORD_DISCLAIMER,
} from '../src/content/attestations.ts';
import { CHAIN_TOKENS } from '../src/ledgers/registry.ts';
import { commodityEscrowRows, escrowTableHtml, lockingFromAccount, LSF_ALLOW_TRUST_LINE_LOCKING, rlusdEscrowRow } from '../src/escrow.ts';
import { handleMcpMessage } from '../src/mcp.ts';
import { openApiDocument } from '../src/openapi.ts';
import { historyConcentrationSeries, snapshotSupplySeries, sparklineSvg, sparkSection } from '../src/sparklines.ts';
import { llmsTxt, sitemapXml } from '../src/seo.ts';
import { app } from '../src/server.ts';

const AS_OF = '2026-11-27';
const RETIRED = 'peak' + 'academiccoaching';

test('freshness follows cadence, grace, and a missing report date', () => {
  assert.equal(freshnessStatus({ reportDate: null, cadenceDays: 30 }, AS_OF), 'UNPUBLISHED');
  assert.equal(freshnessLabel('UNPUBLISHED', false), 'Not published / none found');
  assert.equal(freshnessStatus({ reportDate: '2026-11-01', cadenceDays: 30 }, AS_OF), 'CURRENT');
  assert.equal(ageDays('2026-09-30', AS_OF), 58);
  assert.equal(freshnessStatus({ reportDate: '2026-09-30', cadenceDays: 30 }, AS_OF), 'STALE');
  assert.equal(freshnessStatus({ reportDate: '2026-09-27', cadenceDays: 30 }, AS_OF), 'OVERDUE');
  assert.equal(freshnessStatus({ reportDate: '2026-09-30', cadenceDays: 90 }, AS_OF), 'CURRENT');
  assert.equal(freshnessStatus({ reportDate: '2026-07-15', cadenceDays: 182 }, AS_OF), 'CURRENT');
  assert.equal(freshnessStatus({ reportDate: '2026-06-01', cadenceDays: 90 }, AS_OF), 'OVERDUE');
  assert.equal(freshnessStatus({ reportDate: '2026-09-28', cadenceDays: null }, AS_OF), 'CURRENT');
  assert.equal(freshnessLabel('CURRENT', false), 'Dated report on file');
  assert.equal(freshnessStatus({ reportDate: '2025-12-31', cadenceDays: null }, AS_OF), 'OVERDUE');
});

test('the registry covers every tracked token and does not invent a report date', () => {
  const rows = allAttestations();
  const ids = [...TOKENS.map(token => token.id), ...CHAIN_TOKENS.map(token => token.id)];
  assert.deepEqual(rows.map(row => row.tokenId), ids);
  assert.equal(new Set(rows.map(row => row.tokenId)).size, rows.length);
  for (const id of ['solana-paxg', 'solana-xaut0', 'solana-xaum', 'stellar-xaum', 'solana-dgld', 'solana-vnxau', 'stellar-vnxau']) {
    const row = presentAttestation(id, AS_OF);
    assert.ok(row.reportDate);
    assert.ok(row.officialReportUrl);
    assert.equal(row.checkedDate, '2026-11-27');
    assert.equal(row.livePorFeed, false);
  }
  const pax = presentAttestation('solana-paxg', AS_OF);
  assert.equal(pax.accountingFirm, 'KPMG LLP');
  assert.equal(pax.reportDate, '2026-09-30');
  assert.equal(pax.cadenceDays, 30);
  assert.equal(pax.status, 'STALE');
  assert.equal(pax.barLookupUrl, 'https://paxg.com');
  const xaut = presentAttestation('solana-xaut0', AS_OF);
  assert.equal(xaut.issuer.includes('XAUT'), true);
  assert.equal(xaut.status, 'CURRENT');
  assert.equal(xaut.accountingFirm, 'BDO Italia S.p.A.');
  const xaum = presentAttestation('solana-xaum', AS_OF);
  assert.equal(xaum.status, 'CURRENT');
  assert.ok(xaum.ageDays != null && xaum.ageDays > 120);
  const dgld = presentAttestation('solana-dgld', AS_OF);
  assert.equal(dgld.label, 'Dated report on file');
  const vnx = presentAttestation('stellar-vnxau', AS_OF);
  assert.equal(vnx.status, 'OVERDUE');
  for (const token of TOKENS) {
    const row = presentAttestation(token.id, AS_OF);
    assert.equal(row.reportDate, null);
    assert.equal(row.status, 'UNPUBLISHED');
    assert.equal(row.label, 'Not published / none found');
    assert.equal(row.officialReportUrl, null);
  }
  const blob = JSON.stringify(rows);
  assert.equal(blob.toLowerCase().includes(RETIRED), false);
  assert.equal(/\bgrade [a-f]\b/i.test(blob), false);
});

test('allowTrustLineLocking is the XLS-85 bit, and the matrix names RLUSD as a reference asset', () => {
  assert.equal(lockingFromAccount({ allowTrustLineLocking: true }, 0), true);
  assert.equal(lockingFromAccount({}, Number(LSF_ALLOW_TRUST_LINE_LOCKING)), true);
  assert.equal(lockingFromAccount({}, 0), false);
  assert.equal(lockingFromAccount(undefined, undefined), null);
  const rows = [...commodityEscrowRows([]), rlusdEscrowRow(null, 'RPC unavailable')];
  assert.equal(rows.filter(row => row.role === 'commodity').length, TOKENS.length);
  const rlusd = rows.find(row => row.id === 'rlusd');
  assert.ok(rlusd);
  assert.equal(rlusd.role, 'reference-settlement');
  assert.equal(rlusd.issuer, 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De');
  assert.match(rlusd.note, /not a commodity token/);
  const html = escrowTableHtml([{ ...rows[0], allowTrustLineLocking: true }, rlusd]);
  assert.match(html, /Trust line locking \(XLS-85\)/);
  assert.match(html, /Enabled/);
  assert.match(html, /Reference settlement asset \(not a commodity token\)/);
  assert.match(html, /has not audited any vault/);
});

test('sparklines use snapshot supply and say History building under two points', () => {
  const supply = snapshotSupplySeries('meld-gld');
  assert.ok(supply.length >= 2);
  const svg = sparklineSvg(supply, 'Circulating supply');
  assert.match(svg, /<polyline /);
  assert.equal(svg.includes('<script'), false);
  assert.match(sparklineSvg([{ date: '2026-11-01', value: 1 }], 'Circulating supply'), /History building/);
  assert.equal(historyConcentrationSeries([{ day: '2026-11-01', at: '2026-11-01', supply: 1, supplyOz: null, holders: 1, trustlines: null, flags: {}, pegPct: null, liquidityUsd: null, pegGrade: 'na', topHolderPct: 40 }]).length, 1);
  const section = sparkSection('solana-paxg', '/tmp/reserve-watch-no-such-history');
  assert.match(section, /History building/);
  assert.match(section, /Circulating supply/);
  assert.match(section, /Top-holder share/);
});

test('OpenAPI 3.1 lists the public read endpoints', () => {
  const spec = openApiDocument();
  assert.equal(spec.openapi, '3.1.0');
  const paths = spec.paths as Record<string, unknown>;
  for (const path of ['/api/tokens', '/api/tokens/{id}', '/api/attestations', '/api/escrow-readiness', '/healthz']) {
    assert.ok(paths[path], path);
  }
  assert.match(JSON.stringify(spec), /has not audited any vault/);
});

test('MCP tool results carry the reading, the canonical URL, and the disclaimer', async () => {
  const init = await handleMcpMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, {
    listTokens: () => ({ tokens: [] }),
    tokenReading: () => null,
    escrow: async () => ({ rows: [] }),
  });
  const initBody = init.body as { result: { protocolVersion: string; instructions: string } };
  assert.equal(initBody.result.protocolVersion, '2025-03-26');
  assert.match(initBody.result.instructions, /has not audited any vault/);
  const listed = await handleMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, {
    listTokens: () => ({ tokens: [] }), tokenReading: () => null, escrow: async () => ({ rows: [] }),
  });
  const names = ((listed.body as { result: { tools: { name: string }[] } }).result.tools).map(tool => tool.name);
  assert.deepEqual(names, ['list_commodity_tokens', 'get_token_reading', 'get_attestation_freshness', 'get_xrpl_escrow_readiness']);
  const called = await handleMcpMessage({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'get_attestation_freshness', arguments: { tokenId: 'solana-paxg' } },
  }, { listTokens: () => ({ tokens: [] }), tokenReading: () => null, escrow: async () => ({ rows: [] }) });
  const result = (called.body as { result: { content: { text: string }[]; structuredContent: { canonicalUrl: string; disclaimer: string; data: { reportDate: string } } } }).result;
  assert.match(result.content[0].text, /2026-09-30/);
  assert.match(result.content[0].text, /https:\/\/thereservewatch\.com\/token\/solana-paxg/);
  assert.equal(result.structuredContent.disclaimer, PUBLIC_RECORD_DISCLAIMER);
  assert.equal(result.structuredContent.data.reportDate, '2026-09-30');
  const note = await handleMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, {
    listTokens: () => ({ tokens: [] }), tokenReading: () => null, escrow: async () => ({ rows: [] }),
  });
  assert.equal(note.status, 202);
  assert.equal(note.body, null);
});

test('pages, sitemap, llms, OpenAPI, and MCP stay issuer-neutral', async () => {
  const xml = sitemapXml('2026-11-27', '2026-11-22');
  assert.match(xml, /\/attestations</);
  assert.equal(xml.includes('/api/'), false);
  assert.equal(xml.includes('/news/tag/'), false);
  assert.equal(xml.includes('/news/ledger/'), false);
  const llms = llmsTxt();
  for (const path of ['/openapi.json', '/mcp', '/attestations', '/api/attestations', '/api/escrow-readiness']) {
    assert.match(llms, new RegExp(path.replace(/[/.]/g, '\\$&')));
  }
  assert.equal(llms.includes('5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW'), false);
  assert.equal(llms.toLowerCase().includes(RETIRED), false);

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = async (path: string, init?: RequestInit) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, init);
    return { status: res.status, type: res.headers.get('content-type') ?? '', allow: res.headers.get('allow') ?? '', robots: res.headers.get('x-robots-tag') ?? '', html: await res.text() };
  };
  try {
    const home = await get('/');
    assert.match(home.html, /href="\/attestations">Attestations/);
    assert.match(home.html, /id="token-escrow"/);
    assert.match(home.html, /rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De/);
    assert.match(home.html, /not a commodity token/);
    assert.match(home.html, /Trust line locking \(XLS-85\)/);
    assert.equal(home.html.toLowerCase().includes(RETIRED), false);

    const page = await get('/attestations');
    assert.equal(page.status, 200);
    assert.match(page.html, /commodity token/);
    assert.match(page.html, /Not published \/ none found/);
    assert.match(page.html, /2026-09-30/);
    assert.match(page.html, /KPMG LLP/);
    assert.match(page.html, /Issuer(?:'|&#39;)s published report; ReserveWatch has not audited any vault\./);
    assert.equal(/vault was verified|reserves were verified|audit was verified/i.test(page.html), false);
    assert.equal(page.html.toLowerCase().includes(RETIRED), false);

    const pax = await get('/token/solana-paxg');
    assert.match(pax.html, /<title>PAXG gold commodity token on Solana · ReserveWatch<\/title>/);
    assert.match(pax.html, /gold commodity token on Solana/);
    assert.match(pax.html, /Public attestation: Yes \(dated\)/);
    assert.match(pax.html, /Live PoR feed: No/);
    assert.match(pax.html, /External explorer: <a[^>]+>Solscan<\/a>/);
    assert.match(pax.html, /Trust line locking \(XLS-85\): Not available on this ledger/);
    assert.match(pax.html, /History building/);
    assert.match(pax.html, /has not audited any vault/);
    assert.match(pax.html, /Issuer report/);

    const spec = await get('/openapi.json');
    assert.equal(spec.status, 200);
    assert.equal(spec.robots, '');
    const parsed = JSON.parse(spec.html) as { openapi: string; paths: Record<string, unknown> };
    assert.equal(parsed.openapi, '3.1.0');
    assert.ok(parsed.paths['/api/escrow-readiness']);

    const denied = await get('/mcp');
    assert.equal(denied.status, 405);
    assert.match(denied.allow, /POST/);
    assert.equal(denied.robots, 'noindex');

    const rpc = await get('/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'list_commodity_tokens', arguments: {} } }),
    });
    assert.equal(rpc.status, 200);
    assert.equal(rpc.robots, 'noindex');
    const body = JSON.parse(rpc.html) as { result: { structuredContent: { canonicalUrl: string; disclaimer: string; data: { tokens: { id: string }[] } } } };
    assert.equal(body.result.structuredContent.canonicalUrl, 'https://thereservewatch.com/');
    assert.match(body.result.structuredContent.disclaimer, /not investment/);
    assert.ok(body.result.structuredContent.data.tokens.some(token => token.id === 'solana-paxg'));
    assert.ok(body.result.structuredContent.data.tokens.some(token => token.id === 'meld-gld'));

    const ready = await get('/api/escrow-readiness');
    assert.equal(ready.status, 200);
    assert.equal(ready.type.includes('json'), true);
    const matrix = JSON.parse(ready.html) as { disclaimer: string; canonicalUrl: string; rows: { id: string; role: string; allowTrustLineLocking: boolean | null }[] };
    assert.match(matrix.disclaimer, /has not audited any vault/);
    assert.match(matrix.canonicalUrl, /thereservewatch\.com/);
    assert.ok(matrix.rows.some(row => row.id === 'rlusd' && row.role === 'reference-settlement'));
    assert.equal(matrix.rows.filter(row => row.role === 'commodity').length, TOKENS.length);

    const feed = await get('/api/attestations');
    const attest = JSON.parse(feed.html) as { entries: { tokenId: string; status: string }[]; disclaimer: string };
    assert.equal(attest.disclaimer, ATTESTATION_DISCLAIMER);
    assert.ok(attest.entries.some(entry => entry.tokenId === 'meld-gld' && entry.status === 'UNPUBLISHED'));

    const sitemap = await get('/sitemap.xml');
    assert.match(sitemap.html, /\/attestations</);
    assert.equal(sitemap.html.includes('/news/ledger/'), false);
    assert.equal(sitemap.html.includes('/api/attestations'), false);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
