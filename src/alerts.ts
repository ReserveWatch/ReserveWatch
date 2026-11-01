// Alert stubs: file-based JSONL log + console. Telegram/email are placeholders (see README).
import fs from 'node:fs';
import path from 'node:path';
import type { Snapshot, Severity } from './monitor.js';

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const ALERT_FILE = path.join(DATA_DIR, 'alerts.log');
const STATE_FILE = path.join(DATA_DIR, 'alert-state.json');

export interface AlertEvent { at: string; tokenId: string; from: Severity | null; to: Severity; reasons: string[] }

function loadState(): Record<string, Severity> {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}

export async function processAlerts(snap: Snapshot): Promise<AlertEvent[]> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const prev = loadState(); const next: Record<string, Severity> = {}; const events: AlertEvent[] = [];
  for (const t of snap.tokens) {
    next[t.id] = t.status;
    if (prev[t.id] !== t.status) {
      events.push({ at: snap.updatedAt, tokenId: t.id, from: prev[t.id] ?? null, to: t.status,
        reasons: t.checks.filter(c => c.severity !== 'ok').map(c => `[${c.severity}] ${c.message}`) });
    }
  }
  for (const ev of events) {
    fs.appendFileSync(ALERT_FILE, JSON.stringify(ev) + '\n');
    console.log(`[alert] ${ev.tokenId}: ${ev.from ?? 'new'} -> ${ev.to}`);
    await sendTelegram(ev); await sendEmail(ev);
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return events;
}

export function readAlerts(limit = 100): AlertEvent[] {
  try { return fs.readFileSync(ALERT_FILE, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)).slice(-limit).reverse(); }
  catch { return []; }
}

// ---- Stubs: intentionally no network calls yet ----
async function sendTelegram(ev: AlertEvent) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  console.log(`[alert:telegram STUB] would send to chat ${process.env.TELEGRAM_CHAT_ID}: ${ev.tokenId} ${ev.to}`);
}
async function sendEmail(ev: AlertEvent) {
  if (!process.env.ALERT_EMAIL_TO) return;
  console.log(`[alert:email STUB] would email ${process.env.ALERT_EMAIL_TO}: ${ev.tokenId} ${ev.to}`);
}
