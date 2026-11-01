// One-shot CLI: fetch a snapshot, print a summary, write data/latest.json + alerts.
import fs from 'node:fs';
import path from 'node:path';
import { runSnapshot } from './monitor.js';
import { processAlerts } from './alerts.js';
import { closeClient } from './xrplClient.js';

const s = await runSnapshot();
if (!s.tokens.length) { console.error('Snapshot returned no tokens — not overwriting data/latest.json.'); await closeClient(); process.exit(1); }
const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), JSON.stringify(s, null, 2));
await processAlerts(s);
console.log(`XRP/USD ${s.xrpUsd?.toFixed(4)} (${s.xrpUsdSource})`);
for (const t of s.tokens) {
  console.log(`\n== ${t.name} [${t.status.toUpperCase()}]  issuer ${t.issuer}  currency ${t.currency}`);
  console.log(`   circulating ${t.supply.circulating}  (raw ${t.supply.rawObligations}, treasury ${t.supply.treasury})  holders ${t.holders.nonZero}/${t.holders.trustlines} lines, frozen ${t.holders.frozenLines}`);
  console.log(`   spot/token $${t.spot.usdPerToken?.toFixed(2)}  ledger price ${t.peg.referenceUsd ?? '—'} (${t.peg.source ?? 'none'})  dev ${t.peg.deviationPct?.toFixed(2) ?? '—'}% ${t.peg.referenceUsd != null && !t.peg.reliable ? '[not meaningful: thin]' : ''}`);
  console.log(`   domain ${t.domain ?? '—'} verified=${t.domainVerified}`);
  for (const p of t.pools) console.log(`   AMM ${p.pair}: ${p.exists ? `${p.tokenAmount} / ${p.counterAmount} ${p.counterAsset}, TVL $${p.tvlUsd?.toFixed(0)}` : p.error}`);
  for (const c of t.checks) console.log(`   - [${c.severity}] ${c.message}`);
  if (t.errors.length) console.log(`   errors: ${t.errors.join('; ')}`);
}
await closeClient();
