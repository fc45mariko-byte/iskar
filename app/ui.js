// Shared UI fragments: escaping, icons, emblems, portraits, charts.

import { renderPortrait } from '../src/portrait/svg.js';
import { CIVILIZATIONS } from '../src/world/civilizations.js';
import { monthShort, de } from '../src/world/fr.js';
import { dateOf } from '../src/sim/calendar.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICONS = {
  play: '<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  crown: '<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5Z"/>',
  region: '<path d="M4 18c3-6 6-2 8-8s5-4 8-6"/><circle cx="8" cy="9" r="2"/><circle cx="16" cy="15" r="2"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  scroll: '<path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2Z"/><path d="M6 4a2 2 0 0 0-2 2v2h2M10 9h6M10 13h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z"/><path d="M4 19V5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5Z"/><path d="m3 13 9 5 9-5"/>',
  wheat: '<path d="M12 21V8"/><path d="M12 8c-3-1-4-3-4-5 3 0 4 2 4 5Zm0 0c3-1 4-3 4-5-3 0-4 2-4 5Zm0 5c-3-1-4-3-4-5 3 0 4 2 4 5Zm0 0c3-1 4-3 4-5-3 0-4 2-4 5Z"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M7 11h10M4 15c1 4 4 6 8 6s7-2 8-6"/>',
  tree: '<path d="M12 21v-5M12 3 6 11h3l-4 5h14l-4-5h3Z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 10h.01M15 10h.01"/>',
  people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M15 20a4.5 4.5 0 0 1 7 0"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6Z"/>',
  sack: '<path d="M9 4h6l-1.5 3h-3Z"/><path d="M10.5 7C6 9 4 13 5 17a4 4 0 0 0 4 3h6a4 4 0 0 0 4-3c1-4-1-8-5.5-10"/>',
  skip: '<path d="M5 5v14l9-7z" fill="currentColor" stroke="none"/><path d="M15 5v14l5-7z" fill="currentColor" stroke="none"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
};
export const icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;

// --- Heraldry -----------------------------------------------------------------
const CHARGES = {
  wheat: '<g stroke="#e8c98f" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M32 52V20"/><path d="M32 22c-6-2-8-6-8-10 6 0 8 4 8 10Zm0 0c6-2 8-6 8-10-6 0-8 4-8 10Zm0 10c-6-2-8-6-8-10 6 0 8 4 8 10Zm0 0c6-2 8-6 8-10-6 0-8 4-8 10Zm0 10c-6-2-8-6-8-10 6 0 8 4 8 10Zm0 0c6-2 8-6 8-10-6 0-8 4-8 10Z"/></g>',
  anchor: '<g stroke="#e8c98f" stroke-width="3" fill="none" stroke-linecap="round"><circle cx="32" cy="17" r="4"/><path d="M32 21v32M22 30h20M18 42c2 8 8 11 14 11s12-3 14-11"/></g>',
  gear: '<g stroke="#e8c98f" stroke-width="3" fill="none"><circle cx="32" cy="34" r="9"/><path d="M32 18v6M32 44v6M16 34h6M42 34h6M20.7 22.7l4.2 4.2M39.1 41.1l4.2 4.2M20.7 45.3l4.2-4.2M39.1 26.9l4.2-4.2"/></g>',
  tower: '<g stroke="#e8c98f" stroke-width="2.6" fill="none" stroke-linejoin="round"><path d="M24 52V26h16v26M22 26v-8h4v4h4v-4h4v4h4v-4h4v8M30 52v-8a2 2 0 0 1 4 0v8M29 32h6"/></g>',
  sun: '<g stroke="#e8c98f" stroke-width="2.6" fill="none" stroke-linecap="round"><circle cx="32" cy="34" r="8"/><path d="M32 16v6M32 46v6M14 34h6M44 34h6M19.3 21.3l4.2 4.2M40.5 42.5l4.2 4.2M19.3 46.7l4.2-4.2M40.5 25.5l4.2-4.2"/></g>',
  tree: '<g stroke="#e8c98f" stroke-width="2.6" fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="M32 52V40M32 14 20 30h6l-8 10h28l-8-10h6Z"/></g>',
};

export function emblem(civId, size = 56) {
  const c = CIVILIZATIONS[civId];
  return `<svg class="emblem" viewBox="0 0 64 72" width="${size}" height="${Math.round(size * 1.125)}" role="img" aria-label="Armoiries ${esc(de(c.name))}">
    <defs><linearGradient id="em-${civId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.color}"/><stop offset="1" stop-color="#1b1310"/></linearGradient></defs>
    <path d="M6 6h52v26c0 20-12 32-26 36C18 64 6 52 6 32Z" fill="url(#em-${civId})" stroke="#c9a46a" stroke-width="2.5"/>
    <path d="M11 11h42v21c0 16-9.5 26-21 29.5C20.5 58 11 48 11 32Z" fill="none" stroke="#c9a46a" stroke-opacity=".45" stroke-width="1"/>
    ${CHARGES[c.emblem]}
  </svg>`;
}

// --- Portraits ---------------------------------------------------------------
/** Portrait wrapper; `data-pid` lets the image model replace it later. */
export function portrait(a, { size = 120, title, cls = '' } = {}) {
  return `<div class="pt ${cls}" data-pid="${esc(a.id)}">${renderPortrait(a, { size, title: title ?? a.id, backdrop: 'dusk', detail: size < 80 ? 0.5 : 1 })}</div>`;
}

// --- Charts ------------------------------------------------------------------
/**
 * Line chart over game days. series: [{ points: [[day, value]], color, label, area }]
 */
export function lineChart(series, { width = 640, height = 240, yFmt, yMin, yMax, label = '' } = {}) {
  const pl = 44, pr = 12, pt = 12, pb = 28;
  const all = series.flatMap((s) => s.points);
  if (!all.length) return '<p class="muted">Pas encore de données.</p>';
  const x0 = Math.min(...all.map((p) => p[0])), x1 = Math.max(...all.map((p) => p[0]), x0 + 1);
  let lo = yMin ?? Math.min(...all.map((p) => p[1]));
  let hi = yMax ?? Math.max(...all.map((p) => p[1]));
  const step = niceStep((hi - lo) / 4 || 1);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (hi === lo) hi = lo + step;
  const fmt = yFmt ?? ((v) => (step < 1 || step % 1 ? v.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : Math.round(v)));
  const X = (d) => pl + ((d - x0) / (x1 - x0)) * (width - pl - pr);
  const Y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (height - pt - pb);
  let g = '<g class="grid">';
  for (let v = lo; v <= hi + 1e-9; v += step) g += `<line x1="${pl}" x2="${width - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${pl - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
  // month ticks
  const months = [];
  for (let d = x0; d <= x1; d++) if (dateOf(d).d === 1) months.push(d);
  const every = Math.max(1, Math.ceil(months.length / 8));
  months.forEach((d, i) => {
    if (i % every) return;
    const { m, y } = dateOf(d);
    g += `<text x="${X(d).toFixed(1)}" y="${height - 8}" text-anchor="middle">${m === 0 && months.length > 12 ? y : monthShort(m)}</text>`;
  });
  g += '</g>';
  const lines = series.map((s) => {
    const pts = s.points.map(([d, v]) => `${X(d).toFixed(1)},${Y(v).toFixed(1)}`);
    const area = s.area ? `<path d="M${pts[0]} L${pts.join(' L')} L${X(s.points.at(-1)[0]).toFixed(1)},${Y(lo).toFixed(1)} L${X(s.points[0][0]).toFixed(1)},${Y(lo).toFixed(1)}Z" fill="${s.color}" opacity=".16"/>` : '';
    const last = s.points.at(-1);
    return `${area}<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>${s.points.length < 40 ? s.points.map(([d, v]) => `<circle cx="${X(d).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.6" fill="${s.color}"/>`).join('') : ''}<circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="4" fill="${s.color}" stroke="var(--panel)" stroke-width="2"/>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${g}${lines}</svg>`;
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function bar(value, { max = 100, color = 'var(--gold)', label = '' } = {}) {
  const w = Math.max(0, Math.min(100, (value / max) * 100));
  return `<span class="bar" role="meter" aria-valuenow="${Math.round(value)}" aria-valuemin="0" aria-valuemax="${max}" aria-label="${esc(label)}"><span style="width:${w}%;background:${color}"></span></span>`;
}

export function delta(pct, { invert = false } = {}) {
  const v = Math.round(pct);
  if (!v) return '<span class="delta flat">stable</span>';
  const good = invert ? v < 0 : v > 0;
  return `<span class="delta ${good ? 'up' : 'down'}">${v > 0 ? '+' : ''}${v} %</span>`;
}
