// Tokenized-commodity news. Items are kept. ${DATA_DIR}/news.json overrides the seed when it is valid.
import fs from 'node:fs';
import path from 'node:path';
import { CLASS_PAGES } from './commodities.js';
import { SNAPSHOTS } from './snapshots.js';

export const NEWS_TAGS = ['gold', 'silver', 'platinum', 'energy', 'diamonds', 'regulation', 'xrpl', 'other-chains'] as const;
export type NewsTag = (typeof NEWS_TAGS)[number];
export const NEWS_LEDGERS = ['xrpl', 'solana', 'stellar', 'other'] as const;
export type NewsLedger = (typeof NEWS_LEDGERS)[number];

export interface NewsSource { name: string; url: string }
export interface NewsCorrection { date: string; text: string }
export interface NewsItem {
  id: string;
  date: string;
  publishedAt: string;
  headline: string;
  summary: string;
  whyItMatters: string;
  tags: NewsTag[];
  source: NewsSource;
  confirmedBy: { url: string }[];
  ledgerLinks: string[];
  correction: NewsCorrection | null;
  /** Which ledgers the item is about. Omitted in old files; inferred from tags. */
  ledgers: NewsLedger[];
}
export interface NewsWeek {
  week: string;
  date: string;
  title: string;
  intro: string;
  snapshot: string;
  itemIds: string[];
  ledgerNotes: string[];
}
export interface NewsFile {
  version: 1;
  updatedAt: string;
  items: NewsItem[];
  weeks: NewsWeek[];
}
export interface NewsDay { date: string; items: NewsItem[] }
export interface NewsMonth { key: string; label: string; days: NewsDay[] }

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{3,60}$/;
const WEEK = /^\d{4}-W\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const HTTPS = /^https:\/\/\S+$/;

export const NEWS_INDEX_TITLE = 'Tokenized commodities news · ReserveWatch';
export const NEWS_ARCHIVE_TITLE = 'Tokenized commodities news archive · ReserveWatch';

export function nyToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function newsMonDay(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function newsLongDay(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
export function newsDayTitle(date: string): string {
  return `Tokenized commodities news, ${newsLongDay(date)} · ReserveWatch`;
}
export function newsWeekTitle(week: string): string {
  const n = Number(week.split('-W')[1] ?? '');
  return `Week ${n} tokenized commodities roundup · ReserveWatch`;
}
export function newsTagTitle(tag: NewsTag): string {
  if (tag === 'xrpl') return 'XRPL news for tokenized commodities · ReserveWatch';
  if (tag === 'other-chains') return 'Other chains: tokenized commodities news · ReserveWatch';
  if (tag === 'regulation') return 'Regulation news for tokenized commodities · ReserveWatch';
  return `Tokenized ${tag} news · ReserveWatch`;
}

function fail(msg: string): never {
  throw new Error(msg);
}
const plain = (value: unknown, label: string, max: number): string => {
  if (typeof value !== 'string') fail(`${label} is empty`);
  const text = value.trim();
  if (!text) fail(`${label} is empty`);
  if (text.length > max) fail(`${label} is longer than ${max}`);
  if (/[<>]/.test(text)) fail(`${label} contains HTML`);
  return text;
};
const dayOk = (value: string) => DATE.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));

function ledgerOk(link: string): boolean {
  if (/^\/token\/[a-z0-9-]+$/.test(link)) return true;
  if (/^\/snapshots\/\d{4}-\d{2}-\d{2}$/.test(link)) return true;
  return CLASS_PAGES.some(c => link === `/${c.slug}` || link === `/commodities/${c.slug}`);
}

/** Reject a file that breaks the version-1 rules. A missing snapshot is warned, not rejected. */
export function validateNews(raw: unknown, today = nyToday()): NewsFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('News file must be an object');
  const doc = raw as Partial<NewsFile>;
  const updatedAt = doc.updatedAt;
  const rawItems = doc.items;
  const rawWeeks = doc.weeks;
  if (doc.version !== 1) fail('News version must be 1');
  if (typeof updatedAt !== 'string' || !ISO.test(updatedAt)) fail('News updatedAt must be an ISO timestamp');
  if (!Array.isArray(rawItems) || !rawItems.length) fail('News items are missing');
  if (!Array.isArray(rawWeeks)) fail('News weeks must be an array');
  const ids = new Set<string>();
  const items = rawItems.map((row, i) => {
    const item = row as Partial<NewsItem>;
    const id = item?.id;
    const date = item?.date;
    const publishedAt = item?.publishedAt;
    if (typeof id !== 'string' || !ID.test(id)) fail(`News item ${i} has a bad id`);
    if (ids.has(id)) fail(`Duplicate news id ${id}`);
    ids.add(id);
    if (typeof date !== 'string' || !dayOk(date)) fail(`${id} has a bad date`);
    if (!id.startsWith(date + '-')) fail(`${id} does not start with its date`);
    if (date > today) fail(`${id} is in the future`);
    if (typeof publishedAt !== 'string' || !ISO.test(publishedAt) || !publishedAt.startsWith(date)) fail(`${id} has a bad publishedAt`);
    const headline = plain(item.headline, `${id} headline`, 70);
    const summary = plain(item.summary, `${id} summary`, 420);
    const whyItMatters = plain(item.whyItMatters, `${id} whyItMatters`, 220);
    const rawTags = item.tags;
    if (!Array.isArray(rawTags) || !rawTags.length) fail(`${id} needs a tag`);
    const tags: NewsTag[] = [];
    for (const tag of rawTags) {
      if (typeof tag !== 'string' || !(NEWS_TAGS as readonly string[]).includes(tag)) fail(`${id} has an unknown tag`);
      if (tags.includes(tag as NewsTag)) fail(`${id} repeats a tag`);
      tags.push(tag as NewsTag);
    }
    const sourceNameRaw = item.source?.name;
    const sourceUrl = item.source?.url;
    if (typeof sourceNameRaw !== 'string' || typeof sourceUrl !== 'string') fail(`${id} is missing a source`);
    const sourceName = plain(sourceNameRaw, `${id} source name`, 80);
    if (!HTTPS.test(sourceUrl)) fail(`${id} source URL must be https`);
    const rawConfirmed = item.confirmedBy;
    if (!Array.isArray(rawConfirmed) || !rawConfirmed.length) fail(`${id} needs a confirming source`);
    const confirmedBy = rawConfirmed.map(entry => {
      const url = (entry as { url?: unknown })?.url;
      if (typeof url !== 'string' || !HTTPS.test(url)) fail(`${id} confirming URL must be https`);
      return { url };
    });
    const rawLinks = item.ledgerLinks;
    if (!Array.isArray(rawLinks)) fail(`${id} ledgerLinks must be an array`);
    const ledgerLinks = rawLinks.map(link => {
      if (typeof link !== 'string' || !ledgerOk(link)) fail(`${id} has a bad ledger link`);
      return link;
    });
    let correction: NewsCorrection | null = null;
    if (item.correction != null) {
      const correctionDate = (item.correction as Partial<NewsCorrection>).date;
      const correctionText = (item.correction as Partial<NewsCorrection>).text;
      if (typeof correctionDate !== 'string' || !dayOk(correctionDate) || correctionDate > today) fail(`${id} has a bad correction date`);
      correction = { date: correctionDate, text: plain(correctionText, `${id} correction`, 420) };
    }
    const rawLedgers = (item as { ledgers?: unknown }).ledgers;
    let ledgers: NewsLedger[];
    if (rawLedgers == null) ledgers = tags.includes('xrpl') ? ['xrpl'] : ['other'];
    else {
      if (!Array.isArray(rawLedgers) || !rawLedgers.length) fail(`${id} ledgers must be a non-empty list when present`);
      ledgers = [];
      for (const name of rawLedgers) {
        if (typeof name !== 'string' || !(NEWS_LEDGERS as readonly string[]).includes(name)) fail(`${id} has an unknown ledger`);
        if (!ledgers.includes(name as NewsLedger)) ledgers.push(name as NewsLedger);
      }
    }
    return { id, date, publishedAt, headline, summary, whyItMatters, tags, source: { name: sourceName, url: sourceUrl }, confirmedBy, ledgerLinks, correction, ledgers };
  });
  const weeks = rawWeeks.map(row => {
    const week = row as Partial<NewsWeek>;
    const weekId = week?.week;
    const date = week?.date;
    const snapshot = week?.snapshot;
    if (typeof weekId !== 'string' || !WEEK.test(weekId)) fail('A week id is invalid');
    if (typeof date !== 'string' || !dayOk(date) || date > today) fail(`${weekId} has a bad date`);
    if (typeof snapshot !== 'string' || !dayOk(snapshot)) fail(`${weekId} has a bad snapshot date`);
    if (!SNAPSHOTS.some(s => s.week === snapshot)) {
      console.warn(`[news] ${weekId} snapshot ${snapshot} is not in SNAPSHOTS; the week page will not link to it`);
    }
    const rawIds = week?.itemIds;
    if (!Array.isArray(rawIds) || !rawIds.length) fail(`${weekId} has no items`);
    const itemIds = rawIds.map(itemId => {
      if (typeof itemId !== 'string' || !ids.has(itemId)) fail(`${weekId} cites a missing item`);
      return itemId;
    });
    const rawNotes = week?.ledgerNotes;
    if (!Array.isArray(rawNotes)) fail(`${weekId} ledger notes are missing`);
    return {
      week: weekId,
      date,
      title: plain(week?.title, `${weekId} title`, 120),
      intro: plain(week?.intro, `${weekId} intro`, 240),
      snapshot,
      itemIds,
      ledgerNotes: rawNotes.map((note, n) => plain(note, `${weekId} note ${n}`, 240)),
    };
  });
  return { version: 1, updatedAt, items, weeks };
}

export function clipAtWord(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max + 1);
  const space = slice.lastIndexOf(' ');
  const end = space > 0 ? space : max;
  return clean.slice(0, end).trim().replace(/[;,:.\s]+$/, '');
}

/** Headlines joined under a prefix, then cut on a word boundary at 155. */
export function describeHeadlines(prefix: string, headlines: string[], tail = 'Short summaries with source links.'): string {
  const clean = headlines.map(h => h.replace(/\s+/g, ' ').trim().replace(/[.]+$/, '')).filter(Boolean);
  if (!clean.length) return clipAtWord(`${prefix}${tail}`.trim());
  const chosen: string[] = [];
  for (const headline of clean) {
    const body = [...chosen, headline].join('; ');
    if (`${prefix}${body}. ${tail}`.length <= 155 || `${prefix}${body}.`.length <= 155) chosen.push(headline);
    else break;
  }
  if (!chosen.length) return clipAtWord(`${prefix}${clean[0]}`);
  const body = `${prefix}${chosen.join('; ')}.`;
  const withTail = `${body} ${tail}`;
  return withTail.length <= 155 ? withTail : body;
}

function readSeed(): NewsFile {
  const raw = fs.readFileSync(new URL('./news-seed.json', import.meta.url), 'utf8');
  return validateNews(JSON.parse(raw));
}

function newsPath(): string {
  return path.join(process.env.DATA_DIR || path.resolve('data'), 'news.json');
}

let cache: { doc: NewsFile; mtimeMs: number | null; checkedAt: number } | null = null;

export function resetNewsCacheForTests(): void {
  cache = null;
}

/** Read news.json at most once a minute, and only again when its mtime changes. Invalid JSON keeps the previous good copy. */
export function loadNews(now = Date.now()): NewsFile {
  if (cache && now - cache.checkedAt < 60_000) return cache.doc;
  let mtimeMs: number | null = null;
  try { mtimeMs = fs.statSync(newsPath()).mtimeMs; } catch { mtimeMs = null; }
  if (mtimeMs == null) {
    if (!cache || cache.mtimeMs != null) console.warn('[news] news.json is missing; using the seed');
    const doc = cache && cache.mtimeMs == null ? cache.doc : readSeed();
    cache = { doc, mtimeMs: null, checkedAt: now };
    return doc;
  }
  if (cache && cache.mtimeMs === mtimeMs) {
    cache.checkedAt = now;
    return cache.doc;
  }
  try {
    const doc = validateNews(JSON.parse(fs.readFileSync(newsPath(), 'utf8')));
    cache = { doc, mtimeMs, checkedAt: now };
    return doc;
  } catch (err) {
    console.warn(`[news] invalid news.json, keeping the last good copy: ${(err as Error).message}`);
    if (!cache) cache = { doc: readSeed(), mtimeMs: null, checkedAt: now };
    else cache.checkedAt = now;
    return cache.doc;
  }
}

export function newsAnchor(item: NewsItem): string {
  const prefix = `${item.date}-`;
  return item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.id;
}
export function newsItemPath(item: NewsItem): string {
  return `/news/${item.date}#${newsAnchor(item)}`;
}

/** Newest day first. Items within a day stay in file order. */
export function newsDays(doc: NewsFile = loadNews()): NewsDay[] {
  const byDate = new Map<string, NewsItem[]>();
  for (const item of doc.items) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }
  return [...byDate.entries()].sort((a, b) => a[0] < b[0] ? 1 : -1).map(([date, items]) => ({ date, items }));
}

export function newsByTag(tag: string, doc: NewsFile = loadNews()): NewsItem[] {
  return newsDays(doc).flatMap(day => day.items).filter(item => item.tags.includes(tag as NewsTag));
}

export function newsByLedger(ledger: string, doc: NewsFile = loadNews()): NewsItem[] {
  return newsDays(doc).flatMap(day => day.items).filter(item => item.ledgers.includes(ledger as NewsLedger));
}

export function newsWeek(week: string, doc: NewsFile = loadNews()): NewsWeek | null {
  return doc.weeks.find(w => w.week === week) ?? null;
}

export function weekItems(week: NewsWeek, doc: NewsFile): NewsItem[] {
  const byId = new Map(doc.items.map(item => [item.id, item]));
  return week.itemIds.map(id => byId.get(id)).filter((item): item is NewsItem => !!item);
}

export function latestNews(doc: NewsFile = loadNews(), count = 3): NewsItem[] {
  return newsDays(doc).flatMap(day => day.items).slice(0, Math.max(0, count));
}

export function dayNeighbors(days: NewsDay[], date: string): { prev: string | null; next: string | null } {
  const i = days.findIndex(day => day.date === date);
  if (i < 0) return { prev: null, next: null };
  return { prev: days[i + 1]?.date ?? null, next: days[i - 1]?.date ?? null };
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function newsMonths(doc: NewsFile = loadNews()): NewsMonth[] {
  const groups = new Map<string, NewsDay[]>();
  for (const day of newsDays(doc)) {
    const key = day.date.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(day);
    groups.set(key, list);
  }
  return [...groups.entries()].sort((a, b) => a[0] < b[0] ? 1 : -1).map(([key, days]) => ({
    key, label: MONTH.format(new Date(key + '-01T00:00:00Z')), days,
  }));
}

export function snapshotPath(week: NewsWeek): string | null {
  return SNAPSHOTS.some(s => s.week === week.snapshot) ? `/snapshots/${week.snapshot}` : null;
}

export function newsRss(doc: NewsFile, siteUrl: string, ledger?: string): string {
  const items = newsDays(doc).flatMap(day => day.items).filter(item => !ledger || item.ledgers.includes(ledger as NewsLedger)).slice(0, 50);
  const xml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
  const rows = items.map(item => {
    const day = `${siteUrl}/news/${item.date}`;
    const description = `${item.summary} Why it matters: ${item.whyItMatters} Source: ${item.source.name} (${item.source.url})`;
    return `<item><title>${xml(item.headline)}</title><link>${xml(day)}</link><guid isPermaLink="true">${xml(day + '#' + newsAnchor(item))}</guid><pubDate>${xml(new Date(item.publishedAt).toUTCString())}</pubDate><description>${xml(description)}</description><source url="${xml(item.source.url)}">${xml(item.source.name)}</source></item>`;
  }).join('');
  const title = ledger ? `ReserveWatch ${ledger} commodity news` : 'ReserveWatch news';
  const link = ledger ? `${siteUrl}/news/ledger/${ledger}` : `${siteUrl}/news`;
  const about = ledger ? ` about ${ledger}` : '';
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(title)}</title><link>${xml(link)}</link><description>Short summaries of tokenized-commodity news${about}, with the source named.</description>${rows}</channel></rss>`;
}
