// Scene illustrations (historical events, markets, public spaces) composed
// from persistent character portraits, so the same people look the same in
// dossiers and in scenes.

import { renderPortrait } from './svg.js';
import { hashString } from '../appearance/rng.js';

export const SETTINGS = {
  plaza: { sky: ['#a9c3d6', '#e9eef0'], ground: ['#cbb698', '#a08665'], stone: '#c9b597', label: 'Public square' },
  harbour: { sky: ['#9fc0d4', '#eaf1f2'], ground: ['#7f9ead', '#5f7f8f'], stone: '#b9a284', label: 'Harbour' },
  council: { sky: ['#c8b79c', '#efe5d2'], ground: ['#9b7d5d', '#715a42'], stone: '#a88d6c', label: 'Council hall' },
  market: { sky: ['#b8cfd9', '#f1ebdc'], ground: ['#d2b88f', '#a98c62'], stone: '#c4a982', label: 'Market' },
};

const W = 640;
const H = 360;

function backdrop(setting, uid) {
  const s = SETTINGS[setting];
  let out = `<defs>
    <linearGradient id="${uid}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[0]}"/><stop offset="1" stop-color="${s.sky[1]}"/></linearGradient>
    <linearGradient id="${uid}gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.ground[0]}"/><stop offset="1" stop-color="${s.ground[1]}"/></linearGradient>
    <linearGradient id="${uid}haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.sky[1]}" stop-opacity="0"/><stop offset="1" stop-color="${s.sky[1]}" stop-opacity="0.55"/></linearGradient>
    <filter id="${uid}soft"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>`;
  out += `<rect width="${W}" height="${H}" fill="url(#${uid}sky)"/>`;
  const seed = hashString(setting);
  if (setting === 'council') {
    // Interior: columns and a hanging banner.
    out += `<rect y="40" width="${W}" height="150" fill="${s.stone}" opacity="0.5"/>`;
    for (let i = 0; i < 8; i++) {
      const x = 30 + i * 84;
      out += `<rect x="${x}" y="30" width="22" height="170" fill="${s.stone}"/><rect x="${x + 15}" y="30" width="7" height="170" fill="#000" opacity="0.12"/><rect x="${x - 5}" y="26" width="32" height="8" fill="${s.stone}"/>`;
    }
    out += `<path d="M290,30 h60 v90 l-30,-14 l-30,14z" fill="#6d2f2f"/><circle cx="320" cy="66" r="12" fill="none" stroke="#d6b26e" stroke-width="2.5"/>`;
  } else {
    // Skyline of the town, with arches and domes, fading into the distance.
    for (let layer = 0; layer < 2; layer++) {
      const base = layer ? 190 : 175;
      for (let i = 0; i < 9; i++) {
        const h = 50 + ((seed >> (i + layer)) % 5) * 14 + layer * 10;
        const w = 64 + ((i * 29 + layer * 17) % 30);
        const x = i * 76 - 20 + layer * 30;
        const fill = layer ? s.stone : '#9aa7ad';
        out += `<rect x="${x}" y="${base - h}" width="${w}" height="${h + 10}" fill="${fill}" opacity="${layer ? 0.95 : 0.5}"/>`;
        if ((i + layer) % 3 === 0) out += `<path d="M${x + 8},${base - h} a${w / 2 - 8},${w / 2 - 14} 0 0 1 ${w - 16},0z" fill="${fill}" opacity="${layer ? 0.95 : 0.5}"/>`;
        if (layer) {
          for (let k = 0; k < 3; k++) out += `<path d="M${x + 10 + k * 18},${base - h + 40} v-12 a5,5 0 0 1 10,0 v12z" fill="#4c3b2c" opacity="0.4"/>`;
          out += `<rect x="${x + w - 8}" y="${base - h}" width="8" height="${h + 10}" fill="#000" opacity="0.1"/>`;
        }
      }
    }
    if (setting === 'harbour') {
      out += `<rect y="186" width="${W}" height="30" fill="#6f93a6"/>`;
      out += `<g fill="#6b4f39"><path d="M430,176 h86 l-12,20 h-62z"/><rect x="470" y="96" width="3" height="82"/></g><path d="M473,100 l40,62 h-40z" fill="#efe6d4"/><path d="M470,104 l-30,50 h30z" fill="#e4d6bd"/>`;
    }
    if (setting === 'market') {
      const awn = ['#b5523b', '#3b6f8c', '#c79a3a', '#4f7b4a'];
      for (let i = 0; i < 5; i++) {
        const x = 20 + i * 130;
        out += `<path d="M${x},176 h96 l-8,-22 h-80z" fill="${awn[i % 4]}"/><path d="M${x},176 h96" stroke="#fff" stroke-width="2" stroke-dasharray="12 12" opacity="0.6"/><rect x="${x + 6}" y="176" width="3" height="40" fill="#5b4535"/><rect x="${x + 87}" y="176" width="3" height="40" fill="#5b4535"/>`;
      }
    }
  }
  // Ground with perspective paving.
  out += `<rect y="200" width="${W}" height="${H - 200}" fill="url(#${uid}gr)"/>`;
  out += `<g stroke="#000" stroke-opacity="0.08">`;
  for (let i = -8; i <= 8; i++) out += `<line x1="${320 + i * 30}" y1="200" x2="${320 + i * 110}" y2="${H}"/>`;
  for (const y of [212, 230, 256, 292, 340]) out += `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`;
  out += '</g>';
  return out;
}

function placed(p, x, y, size, detail) {
  return renderPortrait(p, { size, title: p.name ?? p.id, background: false, detail })
    .replace('<svg ', `<svg x="${Math.round(x)}" y="${Math.round(y)}" `);
}

/**
 * Render an event scene. `speaker` (optional) stands on a dais; `people`
 * form a crowd in two rows with atmospheric depth.
 */
export function renderScene(people, { setting = 'plaza', title = SETTINGS[setting].label, speaker = null } = {}) {
  const uid = `s${hashString(setting + people.map((p) => p.id).join(',') + (speaker?.id ?? '')).toString(36)}`;
  let body = backdrop(setting, uid);
  const half = Math.ceil(people.length / 2);
  const rows = [people.slice(0, half), people.slice(half)];
  const drawRow = (row, r) => {
    const size = r === 0 ? 78 : 112;
    const y = r === 0 ? 190 : 226;
    const gap = W / (row.length + 0.6);
    row.forEach((p, i) => {
      let x = gap * (i + 0.8) - size / 2;
      if (speaker && r === 0 && Math.abs(x + size / 2 - 320) < 70) x += x + size / 2 < 320 ? -50 : 50;
      body += placed(p, x, y, size, r === 0 ? 0.6 : 0.85);
    });
  };
  drawRow(rows[0], 0);
  body += `<rect y="150" width="${W}" height="${H - 150}" fill="url(#${uid}haze)" opacity="0.8"/>`;
  if (speaker) {
    body += `<path d="M262,214 h116 l10,22 h-136z" fill="#7a5a3e"/><rect x="252" y="236" width="136" height="10" fill="#5e4430"/>`;
    body += `<rect x="236" y="96" width="4" height="140" fill="#5e4430"/><path d="M240,98 h44 l-8,14 l8,14 h-44z" fill="#8a2f2f"/>`;
    body += placed(speaker, 270, 112, 100, 0.8);
  }
  drawRow(rows[1], 1);
  const t = title.replace(/[<>&"]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${t}"><title>${t}</title>${body}</svg>`;
}
