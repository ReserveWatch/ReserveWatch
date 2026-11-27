// OpenAPI 3.1 description of the public read-only ReserveWatch endpoints.
import { PUBLIC_RECORD_DISCLAIMER } from './content/attestations.js';
import { SITE_URL } from './seo.js';

const json = (schema: object, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export function openApiDocument(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ReserveWatch public readings',
      version: '1.0.0',
      summary: 'Public ledger readings for commodity tokens.',
      description: `Machine-readable readings for commodity tokens on XRPL, Solana, and Stellar. ${PUBLIC_RECORD_DISCLAIMER}`,
    },
    servers: [{ url: SITE_URL }],
    paths: {
      '/api/tokens': {
        get: {
          operationId: 'listTokens',
          summary: 'List commodity-token readings',
          description: 'XRPL is the default. ledger=solana, stellar, or all selects the other public readings. status on XRPL rows is the legacy worst raw check, not a rating.',
          parameters: [{
            name: 'ledger', in: 'query', required: false,
            schema: { type: 'string', enum: ['xrpl', 'solana', 'stellar', 'all'] },
          }],
          responses: {
            '200': json({ type: 'object', additionalProperties: true }, 'Token readings. Fields vary by ledger.'),
            '400': json({ type: 'object', properties: { error: { type: 'string' } } }, 'Unknown ledger query.'),
            '503': json({ type: 'object', properties: { error: { type: 'string' } } }, 'XRPL snapshot is not loaded yet.'),
          },
        },
      },
      '/api/tokens/{id}': {
        get: {
          operationId: 'getToken',
          summary: 'One commodity-token reading',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': json({ type: 'object', additionalProperties: true }, 'One token reading.'),
            '404': json({ type: 'object', properties: { error: { type: 'string' } } }, 'Unknown token id.'),
          },
        },
      },
      '/api/attestations': {
        get: {
          operationId: 'listAttestations',
          summary: 'Issuer attestation freshness',
          description: 'Dated issuer reports and live proof-of-reserves feed flags. UNPUBLISHED means no dated public report was on file. ReserveWatch has not audited any vault.',
          responses: {
            '200': json({
              type: 'object',
              required: ['disclaimer', 'canonicalUrl', 'entries'],
              properties: {
                asOf: { type: 'string' },
                checkedDate: { type: 'string' },
                disclaimer: { type: 'string' },
                canonicalUrl: { type: 'string' },
                entries: { type: 'array', items: { type: 'object', additionalProperties: true } },
              },
            }, 'Attestation registry with a computed freshness status.'),
          },
        },
      },
      '/api/escrow-readiness': {
        get: {
          operationId: 'escrowReadiness',
          summary: 'XRPL allowTrustLineLocking matrix',
          description: 'Trust line locking (XLS-85) for each tracked XRPL commodity token, plus RLUSD as a reference settlement asset, not a commodity token. A null flag means the account_info read was not available.',
          responses: {
            '200': json({
              type: 'object',
              required: ['disclaimer', 'canonicalUrl', 'rows'],
              properties: {
                disclaimer: { type: 'string' },
                canonicalUrl: { type: 'string' },
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id', 'issuer', 'role', 'allowTrustLineLocking'],
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      issuer: { type: 'string' },
                      role: { type: 'string', enum: ['commodity', 'reference-settlement'] },
                      allowTrustLineLocking: { type: ['boolean', 'null'] },
                      note: { type: 'string' },
                    },
                  },
                },
              },
            }, 'Escrow-readiness rows.'),
          },
        },
      },
      '/healthz': {
        get: {
          operationId: 'healthz',
          summary: 'Process health',
          description: '200 when the cached XRPL snapshot is fresh enough. 503 while it is missing or old.',
          responses: {
            '200': json({ type: 'object', properties: { ok: { type: 'boolean' }, updatedAt: { type: ['string', 'null'] } } }, 'Snapshot is fresh.'),
            '503': json({ type: 'object', properties: { ok: { type: 'boolean' } } }, 'Snapshot is missing or old.'),
          },
        },
      },
    },
  };
}
