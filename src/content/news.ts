// Dated commodity-token news. Items are kept. Nothing here is a ReserveWatch measurement.
import { readFileSync } from 'node:fs';

export interface NewsItem {
  id: string;
  date: string;
  headline: string;
  source: string;
  url: string;
  summary: string;
}

export interface NewsDay {
  date: string;
  items: NewsItem[];
}

export interface NewsMonth {
  key: string;
  label: string;
  days: NewsDay[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseNews(raw: unknown): NewsItem[] {
  if (!Array.isArray(raw)) throw new Error('News seed must be an array.');
  const seen = new Set<string>();
  return raw.map((row, i) => {
    const item = row as Partial<NewsItem>;
    if (!item || typeof item.id !== 'string' || !ID.test(item.id)) throw new Error(`News item ${i} has a bad id.`);
    if (typeof item.date !== 'string' || !DATE.test(item.date) || Number.isNaN(Date.parse(item.date + 'T00:00:00Z'))) throw new Error(`News item ${item.id} has a bad date.`);
    for (const key of ['headline', 'source', 'url', 'summary'] as const) {
      if (typeof item[key] !== 'string' || !item[key].trim()) throw new Error(`News item ${item.id} is missing ${key}.`);
    }
    if (!/^https:\/\//.test(item.url!)) throw new Error(`News item ${item.id} URL must be https.`);
    const key = `${item.date}#${item.id}`;
    if (seen.has(key)) throw new Error(`Duplicate news item ${key}.`);
    seen.add(key);
    return { id: item.id, date: item.date, headline: item.headline!.trim(), source: item.source!.trim(), url: item.url!, summary: item.summary!.trim() };
  });
}

export function loadNewsSeed(): NewsItem[] {
  const raw = readFileSync(new URL('./news-seed.json', import.meta.url), 'utf8');
  return parseNews(JSON.parse(raw));
}

/** Newest day first. Items within a day keep seed order. */
export function newsDays(items: NewsItem[]): NewsDay[] {
  const byDate = new Map<string, NewsItem[]>();
  for (const item of items) {
    const list = byDate.get(item.date) ?? [];
    list.push(item);
    byDate.set(item.date, list);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0] < b[0] ? 1 : -1)
    .map(([date, dayItems]) => ({ date, items: dayItems }));
}

/** Newest items across days. A later date wins; within a day, seed order is kept. */
export function latestNews(items: NewsItem[], count: number): NewsItem[] {
  const ranked = newsDays(items).flatMap(day => day.items);
  return ranked.slice(0, Math.max(0, count));
}

export function dayNeighbors(days: NewsDay[], date: string): { prev: string | null; next: string | null } {
  const i = days.findIndex(d => d.date === date);
  if (i < 0) return { prev: null, next: null };
  return { prev: days[i + 1]?.date ?? null, next: days[i - 1]?.date ?? null };
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Newest month first, and newest day first inside the month. */
export function newsMonths(days: NewsDay[]): NewsMonth[] {
  const groups = new Map<string, NewsDay[]>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(day);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] < b[0] ? 1 : -1)
    .map(([key, monthDays]) => ({
      key,
      label: MONTH.format(new Date(key + '-01T00:00:00Z')),
      days: monthDays.sort((a, b) => a.date < b.date ? 1 : -1),
    }));
}

export function newsItemPath(item: NewsItem): string {
  return `/news/${item.date}#${item.id}`;
}
