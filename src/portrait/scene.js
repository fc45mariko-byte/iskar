// Scene illustrations (historical events, markets, public spaces) composed
// from persistent character portraits, so the same people look the same in
// dossiers and in scenes.

import { renderPortrait } from './svg.js';

const SETTINGS = {
  plaza: { sky: '#cfdde6', ground: '#c9b79a', building: '#b89f80', label: 'Public square' },
  harbour: { sky: '#d4e2ea', ground: '#9fb3bd', building: '#a58e72', label: 'Harbour' },
  council: { sky: '#e6dccb', ground: '#a88a6a', building: '#8c6f55', label: 'Council hall' },
  market: { sky: '#e9dcc4', ground: '#cdb390', building: '#b59570', label: 'Market' },
};

export function renderScene(people, { setting = 'plaza', title = SETTINGS[setting].label, width = 640 } = {}) {
  const s = SETTINGS[setting];
  const H = 300;
  const rows = [people.slice(0, Math.ceil(people.length / 2)), people.slice(Math.ceil(people.length / 2))];
  let body = `<rect width="640" height="${H}" fill="${s.sky}"/>`;
  for (let i = 0; i < 7; i++) {
    const bw = 70 + ((i * 37) % 40), bh = 70 + ((i * 53) % 60), bx = i * 95 - 10;
    body += `<rect x="${bx}" y="${150 - bh}" width="${bw}" height="${bh + 20}" fill="${s.building}" opacity="${0.55 + (i % 3) * 0.12}"/>`;
    for (let w = 0; w < 3; w++) body += `<rect x="${bx + 12 + w * 20}" y="${150 - bh + 14}" width="9" height="14" fill="#5b4a3b" opacity="0.35"/>`;
  }
  if (setting === 'harbour') body += `<path d="M420,120 l60,0 l-10,22 l-40,0z M448,60 v60 M448,64 l26,40 l-26,0z" fill="#7a5c43" stroke="#5b4535"/>`;
  body += `<rect y="160" width="640" height="${H - 160}" fill="${s.ground}"/>`;
  rows.forEach((row, r) => {
    const size = r === 0 ? 74 : 96;
    const y = r === 0 ? 112 : 168;
    const gap = 640 / (row.length + 1);
    row.forEach((p, i) => {
      const x = gap * (i + 1) - size / 2;
      const svg = renderPortrait(p, { size, title: p.name ?? p.id })
        .replace('<svg ', `<svg x="${Math.round(x)}" y="${y}" `)
        .replace(/<rect width="200" height="240" fill="[^"]+"\/>/, '');
      body += svg;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 ${H}" width="${width}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
}
