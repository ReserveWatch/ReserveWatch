import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { CLASS_PAGES } from '../src/content/commodities.ts';
import { robotsTxt, sitemapXml } from '../src/seo.ts';
import { app } from '../src/server.ts';

const diamonds = CLASS_PAGES.find(c => c.slug === 'diamonds')!;

test('diamond title and description match the search and stay within the length limits', () => {
  assert.ok(diamonds.title.length <= 60, diamonds.title);
  assert.ok(diamonds.description.length <= 155, diamonds.description);
  assert.match(diamonds.title.toLowerCase(), /diamond/);
  assert.match(diamonds.description.toLowerCase(), /diamond token/);
  assert.match(diamonds.description.toLowerCase(), /how diamond tokenization works/);
  assert.equal(/vitta/i.test(diamonds.title + diamonds.description), false);
});

test('api responses are noindex, robots.txt still allows them, and pages do not canonicalize to /api', async () => {
  const robots = robotsTxt();
  const blocked = robots.split('\n').some(line => /^disallow:\s*\/api\/?\s*$/i.test(line.trim()));
  assert.equal(blocked, false);
  assert.match(robots, /Sitemap:/);
  const sitemap = sitemapXml('2026-11-20', '2026-10-31');
  assert.equal(sitemap.includes('/api/'), false);

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const get = (p: string) => fetch(`http://127.0.0.1:${port}${p}`);
  try {
    const json = await get('/api/tokens');
    assert.equal(json.headers.get('x-robots-tag'), 'noindex');
    assert.match(json.headers.get('content-type') ?? '', /json/);
    const csv = await get('/api/tokens.csv');
    assert.equal(csv.headers.get('x-robots-tag'), 'noindex');
    const missing = await get('/api/commodities/no-such-class');
    assert.equal(missing.headers.get('x-robots-tag'), 'noindex');
    const attestations = await get('/api/attestations');
    assert.equal(attestations.headers.get('x-robots-tag'), 'noindex');
    const escrow = await get('/api/escrow-readiness');
    assert.equal(escrow.headers.get('x-robots-tag'), 'noindex');

    const mcpGet = await get('/mcp');
    assert.equal(mcpGet.status, 405);
    assert.match(mcpGet.headers.get('allow') ?? '', /POST/);
    assert.equal(mcpGet.headers.get('x-robots-tag'), 'noindex');
    assert.deepEqual(await mcpGet.json(), { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Method Not Allowed' } });
    for (const method of ['HEAD', 'OPTIONS', 'PUT', 'DELETE', 'PATCH']) {
      const other = await fetch(`http://127.0.0.1:${port}/mcp`, { method });
      assert.equal(other.headers.get('x-robots-tag'), 'noindex', method);
    }
    const mcpHead = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'HEAD' });
    assert.equal(mcpHead.status, 405);
    assert.match(mcpHead.headers.get('allow') ?? '', /POST/);
    const mcpPost = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }),
    });
    assert.equal(mcpPost.status, 200);
    assert.equal(mcpPost.headers.get('x-robots-tag'), 'noindex');
    const initialized = await mcpPost.json() as { result: { protocolVersion: string; serverInfo: { name: string } } };
    assert.equal(initialized.result.protocolVersion, '2025-06-18');
    assert.equal(initialized.result.serverInfo.name, 'ReserveWatch');
    const mcpList = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
    });
    assert.equal(mcpList.status, 200);
    assert.equal(mcpList.headers.get('x-robots-tag'), 'noindex');
    const listed = await mcpList.json() as { result: { tools: { name: string }[] } };
    assert.deepEqual(listed.result.tools.map(tool => tool.name), ['list_commodity_tokens', 'get_token_reading', 'get_attestation_freshness', 'get_xrpl_escrow_readiness']);
    const mcpCall = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_commodity_tokens', arguments: {} } }),
    });
    assert.equal(mcpCall.status, 200);
    assert.equal(mcpCall.headers.get('x-robots-tag'), 'noindex');
    const mcpBad = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(mcpBad.status, 400);
    assert.equal(mcpBad.headers.get('x-robots-tag'), 'noindex');

    const openapi = await get('/openapi.json');
    assert.equal(openapi.status, 200);
    assert.equal(openapi.headers.get('x-robots-tag'), null);
    const spec = await openapi.json() as { openapi: string; paths: Record<string, unknown> };
    assert.equal(spec.openapi, '3.1.0');
    assert.ok(spec.paths['/api/attestations']);
    assert.ok(spec.paths['/api/escrow-readiness']);

    const page = await get('/diamonds');
    const html = await page.text();
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] ?? '';
    const ogDescription = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ?? '';
    assert.equal(title, diamonds.title);
    assert.equal(description, diamonds.description);
    assert.equal(ogTitle, title);
    assert.equal(ogDescription, description);
    assert.match(html, /<h2>How does diamond tokenization work\?<\/h2>/);
    assert.match(html, /"@type":"Question","name":"How does diamond tokenization work\?"/);
    assert.equal(/rel="canonical" href="[^"]*\/api\//.test(html), false);
    assert.match(html, /rel="canonical" href="https:\/\/thereservewatch\.com\/diamonds"/);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
