// Inline SVG sparklines from the weekly snapshot archive and the daily poll history.
// Fewer than two numeric points is "History building". No fabricated points.

import { SNAPSHOTS } from './content/snapshots.js';
import { tokenHistory, type DailyPoint } from './history.js';

export interface SeriesPoint { date: string; value: number }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function snapshotSupplySeries(tokenId: string): SeriesPoint[] {
  return [...SNAPSHOTS].reverse().flatMap(week => {
    const token = week.tokens.find(item => item.id === tokenId);
    if (!token || token.circulating == null || !Number.isFinite(token.circulating)) return [];
    return [{ date: week.week, value: token.circulating }];
  });
}

export function historySupplySeries(days: DailyPoint[]): SeriesPoint[] {
  return days.flatMap(point => point.supply != null && Number.isFinite(point.supply) ? [{ date: point.day, value: point.supply }] : []);
}

export function historyConcentrationSeries(days: DailyPoint[]): SeriesPoint[] {
  return days.flatMap(point => {
    const value = point.topHolderPct;
    return value != null && Number.isFinite(value) ? [{ date: point.day, value }] : [];
  });
}

/** Prefer the longer real series. An empty result means fewer than two points. */
export function chooseSeries(primary: SeriesPoint[], extra: SeriesPoint[]): SeriesPoint[] {
  const usable = [primary, extra].filter(series => series.length >= 2);
  if (!usable.length) return [];
  return usable.sort((a, b) => b.length - a.length)[0];
}

export function sparklineSvg(points: SeriesPoint[], label: string): string {
  if (points.length < 2) return '<p class="muted">History building</p>';
  const w = 168;
  const h = 36;
  const pad = 2;
  const values = points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => {
    const x = pad + (index / (points.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (point.value - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const caption = points.map(point => `${point.date} ${point.value}`).join(', ');
  return `<svg class="spark" role="img" aria-label="${esc(label)}: ${esc(caption)}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${coords}"></polyline></svg>`;
}

export function sparkSection(tokenId: string, dir?: string): string {
  let days: DailyPoint[] = [];
  try { days = tokenHistory(tokenId, dir).days; } catch { days = []; }
  const supply = chooseSeries(snapshotSupplySeries(tokenId), historySupplySeries(days));
  const concentration = historyConcentrationSeries(days).length >= 2 ? historyConcentrationSeries(days) : [];
  const supplyFig = sparklineSvg(supply, 'Circulating supply');
  const concFig = sparklineSvg(concentration, 'Top-holder share');
  return `<section class="sparks" aria-label="Supply and holder history"><h2>Supply and holder history</h2>
<figure><figcaption>Circulating supply</figcaption>${supplyFig}</figure>
<figure><figcaption>Top-holder share</figcaption>${concFig}</figure>
<p class="meter-cap">Points are the weekly snapshot archive and the daily poll history already on file. History building means fewer than two points. Not a vault check.</p></section>`;
}
