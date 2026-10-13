import { generateAppearance, representativeSample } from '../src/appearance/generator.js';
import { REGIONS, REGION_IDS, SETTLEMENTS, ANCESTRAL_POOLS } from '../src/appearance/population.js';
import { SKIN_TONE_CATEGORIES, skinHex, stylesForTexture, EYE_COLORS } from '../src/appearance/traits.js';
import { applyEvent, withAge, visibleAppearance, EVENT_TYPES } from '../src/appearance/lifecycle.js';
import { identityRecord } from '../src/appearance/identity.js';
import { generateHousehold } from '../src/appearance/family.js';
import { assignRole, assignRoleFromGroup } from '../src/society/roles.js';
import { personName } from '../src/society/names.js';
import { renderPortrait } from '../src/portrait/svg.js';
import { renderScene } from '../src/portrait/scene.js';
import { hashString } from '../src/appearance/rng.js';

// ---------------------------------------------------------------------------
// Small helpers

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const txt = (s) => String(s).replace(/-/g, ' ');
const pct = (x) => `${Math.round(x * 100)}%`;
const catOf = (id) => SKIN_TONE_CATEGORIES.find((c) => c.id === id);
const catMid = (c) => (c.min + Math.min(c.max, 1)) / 2;
const SHORT_CAT = { 'very-light': 'Very light', light: 'Light', 'light-olive': 'Light olive', medium: 'Medium', 'medium-brown': 'Medium brown', deep: 'Deep' };
const POOL_COLORS = { uplander: '#7d9fb5', steppe: '#c79a4a', riverine: '#4f8f7d', savanna: '#a8573b', islander: '#5d6fa8', plateau: '#8c6b9e' };

const ICONS = {
  atlas: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  census: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  registry: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  households: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  public: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/><path d="M2 21h20"/>',
  events: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.3"/><circle cx="16" cy="16" r="1.3"/><circle cx="12" cy="12" r="1.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const VIEWS = [
  ['atlas', 'Atlas'],
  ['census', 'Census'],
  ['registry', 'Registry'],
  ['households', 'Households'],
  ['public', 'Public life'],
  ['events', 'Events'],
];

function registryNo(a) {
  const r = (a.context.regionId || 'xx').split('-').map((w) => w[0]).join('').toUpperCase();
  return `${r}·${(hashString(a.id) % 90000 + 10000)}`;
}

// ---------------------------------------------------------------------------
// Persistence (per-viewer; the app works without it)

const STORE_KEY = 'iskar.registry.v1';
const store = {
  load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
  },
  save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
  },
};

const state = {
  view: 'atlas',
  region: 'river-delta',
  settlement: 'port',
  round: 0,
  partner: 'northern-uplands',
  scene: 'plaza',
  filter: { q: '', region: '', tone: '' },
  current: null, // appearance being viewed in the dossier
  viewAge: null,
  people: new Map(), // registry: id -> appearance
};

function seedRegistry() {
  const settlements = ['rural', 'town', 'urban', 'port'];
  REGION_IDS.forEach((regionId, ri) => {
    for (let i = 0; i < 4; i++) {
      const a = generateAppearance({ id: `example:${regionId}:${i}`, regionId, settlement: settlements[(i + ri) % 4] });
      a.example = true;
      state.people.set(a.id, a);
    }
  });
}

function loadRegistry() {
  const saved = store.load();
  if (saved?.people?.length) for (const a of saved.people) state.people.set(a.id, a);
  else seedRegistry();
}
function saveRegistry() {
  store.save({ people: [...state.people.values()] });
}
function remember(a) {
  if (state.people.has(a.id)) return state.people.get(a.id);
  return a;
}
function inRegistry(a) {
  return state.people.has(a.id);
}

// ---------------------------------------------------------------------------
// Shared fragments

function plate(a, line, { size = 220 } = {}) {
  const name = personName(a.id);
  return `<button class="plate" type="button" data-open="${esc(a.id)}">
    <div class="frame">${renderPortrait(a, { size, title: name })}</div>
    <div class="who"><b>${esc(name)}</b><span>${esc(line)}</span><span class="mono">${registryNo(a)}</span></div>
  </button>`;
}

const transient = new Map(); // people shown on screen but not in the registry
function track(list) {
  for (const a of list) if (!state.people.has(a.id)) transient.set(a.id, a);
  return list.map(remember);
}
function lookup(id) {
  return state.people.get(id) ?? transient.get(id);
}

function toneDistribution(regionId, settlement, n = 1200) {
  const counts = Object.fromEntries(SKIN_TONE_CATEGORIES.map((c) => [c.id, 0]));
  const bins = new Array(20).fill(0);
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const a = generateAppearance({ id: `census:${regionId}:${settlement}:${i}`, regionId, settlement });
    counts[a.skin.category]++;
    bins[Math.min(19, Math.floor(a.skin.tone * 20))]++;
    sum += a.skin.tone;
    sq += a.skin.tone ** 2;
  }
  const mean = sum / n;
  return { n, counts, bins, mean, sd: Math.sqrt(sq / n - mean * mean) };
}
const distCache = new Map();
function cachedDist(regionId, settlement) {
  const key = `${regionId}|${settlement}`;
  if (!distCache.has(key)) distCache.set(key, toneDistribution(regionId, settlement));
  return distCache.get(key);
}

function toneBar(dist) {
  return `<div class="tonebar" aria-hidden="true">${SKIN_TONE_CATEGORIES.map((c) => `<span style="width:${(dist.counts[c.id] / dist.n) * 100}%;background:${skinHex(catMid(c))}"></span>`).join('')}</div>`;
}

function regionOptions(selected) {
  return REGION_IDS.map((r) => `<option value="${r}"${r === selected ? ' selected' : ''}>${REGIONS[r].label}</option>`).join('');
}
function settlementSeg(selected, attr = 'data-settlement') {
  return `<div class="seg" role="group" aria-label="Settlement type">${Object.entries(SETTLEMENTS).map(([k, v]) => `<button type="button" ${attr}="${k}" aria-pressed="${k === selected}">${v.label}</button>`).join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Atlas

const MAP = {
  'northern-uplands': { c: [330, 110], r: [150, 70], label: [330, 104] },
  'eastern-steppe': { c: [545, 215], r: [95, 120], label: [548, 210] },
  'river-delta': { c: [345, 245], r: [118, 72], label: [345, 240] },
  'western-archipelago': { c: [110, 220], r: [70, 95], islands: true, label: [112, 216] },
  'southwest-plateau': { c: [215, 370], r: [105, 62], label: [215, 366] },
  'southern-savanna': { c: [440, 380], r: [130, 66], label: [440, 376] },
};

function blob(cx, cy, rx, ry, seed, n = 14) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.82 + (((seed >> (i % 24)) & 7) / 7) * 0.26;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    if (!i) d += `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
    d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

function renderAtlas() {
  const shapes = REGION_IDS.map((id) => {
    const m = MAP[id];
    const seed = hashString(id);
    let land;
    if (m.islands) {
      land = [[0, 0, 1], [-30, -70, 0.45], [25, 72, 0.5], [-38, 40, 0.35]].map(([dx, dy, s], i) =>
        `<path class="land" d="${blob(m.c[0] + dx, m.c[1] + dy, m.r[0] * s, m.r[1] * s * 0.6, seed >> i)}"/>`).join('');
    } else land = `<path class="land" d="${blob(m.c[0], m.c[1], m.r[0], m.r[1], seed)}"/>`;
    const dist = cachedDist(id, 'rural');
    // mini tone strip under the label
    let x = m.label[0] - 50;
    const strip = SKIN_TONE_CATEGORIES.map((c) => {
      const w = (dist.counts[c.id] / dist.n) * 100;
      const r = `<rect x="${x.toFixed(1)}" y="${m.label[1] + 8}" width="${w.toFixed(1)}" height="7" fill="${skinHex(catMid(c))}"/>`;
      x += w;
      return r;
    }).join('');
    return `<g class="region${state.region === id ? ' on' : ''}" tabindex="0" role="button" data-region="${id}" aria-label="${REGIONS[id].label}">${land}<text class="label" x="${m.label[0]}" y="${m.label[1]}" text-anchor="middle">${REGIONS[id].label}</text>${strip}</g>`;
  }).join('');
  const rivers = `<path d="M330,150 C340,190 300,215 345,250 S360,300 330,330" fill="none" stroke="var(--map-sea)" stroke-width="5" stroke-linecap="round"/>`;
  const list = REGION_IDS.map((id) => {
    const dist = cachedDist(id, 'rural');
    const faces = track(representativeSample({ regionId: id, settlement: 'town', count: 4, seed: 'atlas', oversample: 4 }));
    return `<button class="region-row${state.region === id ? ' on' : ''}" type="button" data-region="${id}">
      <div class="faces">${faces.map((a) => renderPortrait(a, { size: 40, title: personName(a.id), detail: 0.4 })).join('')}</div>
      <div><b>${REGIONS[id].label}</b><div class="sub" style="font-size:13px;color:var(--ink-2)">Mean tone <span class="mono">${dist.mean.toFixed(2)}</span> · spread <span class="mono">${dist.sd.toFixed(2)}</span></div>${toneBar(dist)}</div>
    </button>`;
  }).join('');
  return `<div class="view-head"><div><div class="eyebrow">Atlas of Iskar</div><h1>Six regions, one continuous range of people</h1><p>Each region draws on several ancestral populations in different proportions. The strip under each name is its rural skin-tone mix, from very light to deep. Choose a region to open its census.</p></div></div>
  <div class="atlas">
    <div class="panel map"><svg viewBox="0 0 660 460" role="group" aria-label="Map of Iskar"><rect class="sea" width="660" height="460" rx="12"/>${shapes}${rivers}</svg></div>
    <div class="region-list">${list}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Census

function histogram(dist) {
  const Wd = 560, Hd = 220, pl = 36, pb = 34, pt = 10;
  const max = Math.max(...dist.bins) / dist.n;
  const top = Math.ceil(max * 20) / 20 || 0.05; // round up to 5%
  const bw = (Wd - pl - 8) / 20;
  const y = (v) => pt + (Hd - pt - pb) * (1 - v / top);
  let grid = '<g class="grid">';
  for (let v = 0; v <= top + 1e-9; v += 0.05) grid += `<line x1="${pl}" x2="${Wd - 4}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${pl - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${Math.round(v * 100)}%</text>`;
  grid += '</g>';
  const bars = dist.bins.map((c, i) => {
    const v = c / dist.n;
    return `<rect x="${(pl + i * bw + 1).toFixed(1)}" y="${y(v).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(y(0) - y(v)).toFixed(1)}" rx="2" fill="${skinHex((i + 0.5) / 20)}"><title>Tone ${(i / 20).toFixed(2)}–${((i + 1) / 20).toFixed(2)}: ${(v * 100).toFixed(1)}%</title></rect>`;
  }).join('');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => `<text x="${(pl + t * 20 * bw).toFixed(1)}" y="${Hd - pb + 16}" text-anchor="middle">${t.toFixed(2)}</text>`).join('');
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="Distribution of skin tone, 0 very light to 1 very dark">${grid}${bars}${ticks}<text x="${pl}" y="${Hd - 4}">very light</text><text x="${Wd - 4}" y="${Hd - 4}" text-anchor="end">very dark</text></svg>`;
}

function renderCensus() {
  const dist = cachedDist(state.region, state.settlement);
  const sample = track(representativeSample({ regionId: state.region, settlement: state.settlement, count: 12, seed: `census:${state.round}` }));
  const legend = SKIN_TONE_CATEGORIES.map((c) => `<div><span class="sw" style="background:${skinHex(catMid(c))}"></span><span>${c.label}</span><span class="mono">${pct(dist.counts[c.id] / dist.n)}</span></div>`).join('');
  const plates = sample.map((a) => plate(a, `${a.age} · ${assignRole({ seed: a.id, settlement: state.settlement }).label}`)).join('');
  return `<div class="view-head"><div><div class="eyebrow">Census</div><h1>${REGIONS[state.region].label}, ${SETTLEMENTS[state.settlement].label.toLowerCase()}</h1><p>Skin tone across ${dist.n.toLocaleString()} sampled residents, then twelve people drawn across the whole local range.</p></div>
    <div class="controls"><label class="field">Region<select id="c-region">${regionOptions(state.region)}</select></label>${settlementSeg(state.settlement)}</div></div>
  <div class="stack">
    <div class="census-grid">
      <div class="panel chart"><h2>Skin-tone distribution</h2><p class="sub">Share of residents in each 0.05 band of the tone scale.</p>${histogram(dist)}</div>
      <div class="panel"><h2>By category</h2><p class="sub">Display categories derived from the continuous scale.</p><div class="legend">${legend}</div>
        <div class="stats"><div><b>${dist.mean.toFixed(2)}</b><span>mean tone</span></div><div><b>${dist.sd.toFixed(2)}</b><span>spread (sd)</span></div><div><b>${Object.values(dist.counts).filter((v) => v > 0).length}/6</b><span>categories present</span></div></div></div>
    </div>
    <div class="panel"><div class="view-head" style="margin-bottom:12px"><div><h2>Residents</h2><p class="sub" style="margin:0">One person from each twelfth of the local tone range, chosen to look as different from each other as possible.</p></div><button class="btn" type="button" id="reroll">${icon('dice')}Draw new residents</button></div>
      <div class="plates">${plates}</div></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Registry

function renderRegistry() {
  const { q, region, tone } = state.filter;
  const all = [...state.people.values()];
  const list = all.filter((a) =>
    (!region || a.context.regionId === region) &&
    (!tone || a.skin.category === tone) &&
    (!q || personName(a.id).toLowerCase().includes(q.toLowerCase()) || registryNo(a).toLowerCase().includes(q.toLowerCase())));
  const examples = all.some((a) => a.example);
  const toneOpts = SKIN_TONE_CATEGORIES.map((c) => `<option value="${c.id}"${tone === c.id ? ' selected' : ''}>${SHORT_CAT[c.id]}</option>`).join('');
  return `<div class="view-head"><div><div class="eyebrow">Registry</div><h1>${all.length} registered residents</h1><p>Everyone you add from a census, household or public panel is kept here with their life events, in this browser.</p></div>
    <div class="controls">
      <label class="field">Search<input type="search" id="f-q" value="${esc(q)}" placeholder="Name or number"></label>
      <label class="field">Region<select id="f-region"><option value="">All regions</option>${regionOptions(region)}</select></label>
      <label class="field">Skin tone<select id="f-tone"><option value="">All tones</option>${toneOpts}</select></label>
    </div></div>
  ${examples ? `<p class="example-note"><span class="chip">Examples</span>The registry starts with 24 example residents, four from each region.</p>` : ''}
  <div class="panel">${list.length ? `<div class="plates">${list.map((a) => plate(a, `${REGIONS[a.context.regionId].label} · ${a.age}`)).join('')}</div>` : '<p class="sub">No one matches these filters. Clear the search or choose another region or tone.</p>'}</div>`;
}

// ---------------------------------------------------------------------------
// Dossier

function renderDossier() {
  const base = state.current;
  if (!base) return renderRegistry();
  const age = state.viewAge ?? base.age;
  const a = age === base.age ? base : withAge(base, age);
  const v = visibleAppearance(a);
  const name = personName(base.id);
  const role = assignRole({ seed: base.id, settlement: base.context.settlement });
  const cat = catOf(base.skin.category);
  const ancestry = Object.entries(base.ancestry).sort((x, y) => y[1] - x[1]);
  const id = identityRecord(base);
  const origin = base.context.origin !== base.context.regionId ? `, family from ${REGIONS[base.context.origin].label}` : '';
  const types = Object.entries(EVENT_TYPES).map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
  const history = base.events.length
    ? `<ul class="history">${base.events.map((e) => `<li><span class="mono">age ${e.atAge}</span><span>${esc(EVENT_TYPES[e.type])}${e.side ? `, ${e.side}` : ''}${e.location ? ` ${e.location}` : ''}${e.style ? `: ${txt(e.style)}` : ''}</span></li>`).join('')}</ul>`
    : '<p class="sub" style="margin:0">No recorded events yet. Events such as a scar or new hairstyle change how this person looks from that age on.</p>';
  return `<div class="view-head"><div><div class="eyebrow">Dossier · <span class="record-no">${registryNo(base)}</span></div><h1>${esc(name)}</h1><p>${role.label} · ${REGIONS[base.context.regionId].label}, ${SETTLEMENTS[base.context.settlement].label.toLowerCase()}${origin}</p></div>
    <div class="controls">${inRegistry(base) ? '<span class="chip">In registry</span>' : `<button class="btn primary" type="button" id="add-reg">${icon('plus')}Add to registry</button>`}<a class="btn" href="#registry">Back to registry</a></div></div>
  <div class="dossier">
    <div>
      <div class="portrait-main" id="d-portrait">${renderPortrait(a, { size: 340, title: `${name} at ${age}` })}</div>
      <div class="timeline">
        <label class="field" for="d-age">Life timeline · viewing age <span class="mono" id="d-age-val">${age}</span></label>
        <input type="range" id="d-age" min="6" max="90" value="${age}">
        <div class="ticks mono"><span>6</span><span>30</span><span>60</span><span>90</span></div>
        ${age !== base.age ? `<button class="btn" type="button" id="d-set-age">Record current age as ${age}</button>` : ''}
      </div>
    </div>
    <div class="stack">
      <div class="panel"><h2>Appearance</h2><p class="sub">Structured attributes. These never change with role, wealth or behaviour.</p>
        <dl class="dl">
          <dt>Skin</dt><dd><span class="dot" style="background:${base.skin.hex}"></span> ${cat.label}<br><span class="mono" style="font-size:13px;color:var(--ink-2)">tone ${base.skin.tone.toFixed(3)} · ${txt(base.skin.undertone)} undertone · ${base.skin.hex}</span></dd>
          <dt>Hair</dt><dd><span class="dot" style="background:${v.hairHex}"></span> ${txt(base.hair.texture)}, ${txt(base.hair.color)}${v.grey > 0.15 ? ', greying' : ''}; worn ${txt(v.hairStyle)}</dd>
          <dt>Eyes</dt><dd><span class="dot" style="background:${EYE_COLORS[base.eyes.color]}"></span> ${txt(base.eyes.color)}, ${base.eyes.lid} lids</dd>
          <dt>Face</dt><dd>${base.face.shape} face; nose width ${base.face.noseWidth.toFixed(2)}, bridge ${base.face.noseBridge.toFixed(2)}; lips ${base.face.lipFullness.toFixed(2)}; cheekbones ${base.face.cheekbones.toFixed(2)}</dd>
          <dt>Build</dt><dd>${base.body.build}, ${base.body.heightCm} cm${base.facialHair !== 'none' ? `; ${txt(base.facialHair)}` : ''}</dd>
          <dt>Ancestry</dt><dd><div class="ancestry">${ancestry.map(([k, w]) => `<span style="width:${w * 100}%;background:${POOL_COLORS[k]}" title="${ANCESTRAL_POOLS[k].label} ${pct(w)}"></span>`).join('')}</div><span style="font-size:13px;color:var(--ink-2)">${ancestry.filter(([, w]) => w >= 0.05).map(([k, w]) => `${ANCESTRAL_POOLS[k].label} ${pct(w)}`).join(' · ')}</span></dd>
        </dl>
      </div>
      <div class="panel"><h2>Life events</h2><p class="sub">Recorded at age ${base.age}. Skin, eyes and facial structure cannot be changed by events.</p>
        ${history}
        <form class="event-form" id="ev-form" style="margin-top:14px">
          <label class="field">Event<select id="ev-type">${types}</select></label>
          <label class="field" id="ev-extra-wrap">Detail<select id="ev-extra"></select></label>
          <button class="btn primary" type="submit">Record event</button>
        </form>
      </div>
      <div class="panel"><h2>Portrait identity</h2><p class="sub">Sent with every image-model request so this person stays recognisable in every scene.</p>
        <div class="descriptor" id="d-desc">${esc(id.descriptor)}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="copy-desc">${icon('copy')}Copy description</button></div>
      </div>
    </div>
  </div>`;
}

function eventExtras(type, a) {
  const sides = ['left', 'right'];
  switch (type) {
    case 'scar': return ['cheek', 'brow', 'chin'].flatMap((l) => sides.map((s) => [`${s}|${l}`, `${s} ${l}`]));
    case 'tattoo': return [['|cheek', 'cheek'], ['|forehead', 'forehead'], ['|chin', 'chin']];
    case 'eye-injury': return [['left|patch', 'left, eyepatch'], ['right|patch', 'right, eyepatch'], ['left|scar', 'left, scarred'], ['right|scar', 'right, scarred']];
    case 'haircut': return stylesForTexture(a.hair.texture).map((s) => [s, txt(s)]);
    case 'facial-hair': return ['none', 'stubble', 'moustache', 'short-beard', 'full-beard'].map((s) => [s, txt(s)]);
    case 'weight-change': return [['1', 'gained weight'], ['-1', 'lost weight']];
    default: return [];
  }
}

function buildEvent(type, val, atAge) {
  const e = { type, atAge };
  const [p, q] = (val || '').split('|');
  if (type === 'scar') Object.assign(e, { side: p, location: q });
  if (type === 'tattoo') Object.assign(e, { location: q });
  if (type === 'eye-injury') Object.assign(e, { side: p, patch: q === 'patch' });
  if (type === 'haircut' || type === 'facial-hair') e.style = val;
  if (type === 'weight-change') e.delta = Number(val);
  return e;
}

// ---------------------------------------------------------------------------
// Households, public life, events

function renderHouseholds() {
  const h = generateHousehold({ id: `hh:${state.region}:${state.partner}:${state.settlement}:${state.round}`, regionId: state.region, settlement: state.settlement, partnerRegionId: state.partner });
  const members = track(h.members);
  const plates = members.map((m, i) => plate(m, `${i < 2 ? `Parent · ${REGIONS[m.context.regionId].label}` : 'Child'} · ${m.age}`)).join('');
  return `<div class="view-head"><div><div class="eyebrow">Households</div><h1>A family in ${REGIONS[state.region].label}</h1><p>Partners can come from different regions. Children take after both parents, and siblings still look like themselves.</p></div>
    <div class="controls"><label class="field">Home region<select id="h-region">${regionOptions(state.region)}</select></label><label class="field">Partner's region<select id="h-partner">${regionOptions(state.partner)}</select></label><button class="btn" type="button" id="reroll">${icon('dice')}Another family</button></div></div>
  <div class="panel"><div class="plates">${plates}</div></div>`;
}

const GROUPS = [
  ['leaders', 'Leaders and officials', 'Heads of state, ministers, governors and magistrates'],
  ['merchants', 'Merchants', 'Traders, shopkeepers and bankers'],
  ['workers', 'Workers', 'Farmers, herders, fishers, artisans and labourers'],
  ['soldiers', 'Soldiers', 'Soldiers and officers'],
  ['scholars', 'Scholars', 'Scholars, physicians, engineers, teachers and priests'],
];

function renderPublic() {
  const blocks = GROUPS.map(([g, title, sub]) => {
    const people = track(representativeSample({ regionId: state.region, settlement: 'urban', count: 6, seed: `public:${g}:${state.round}`, oversample: 5 }));
    return `<div class="panel"><h2>${title}</h2><p class="sub">${sub}</p><div class="plates">${people.map((a) => plate(a, assignRoleFromGroup({ seed: a.id, group: g }).label)).join('')}</div></div>`;
  }).join('');
  return `<div class="view-head"><div><div class="eyebrow">Public life</div><h1>Who serves in ${REGIONS[state.region].label}</h1><p>Roles are assigned on their own, without reference to appearance, so every group shows the region's full range.</p></div>
    <div class="controls"><label class="field">Region<select id="p-region">${regionOptions(state.region)}</select></label><button class="btn" type="button" id="reroll">${icon('dice')}New faces</button></div></div>
  <div class="stack">${blocks}</div>`;
}

const SCENE_EVENTS = {
  plaza: 'The reading of the new water charter',
  harbour: 'The spice fleet returns to harbour',
  council: 'The regional council votes on the river accord',
  market: 'First market day after the harvest',
};

function renderEvents() {
  const settlement = state.scene === 'harbour' ? 'port' : state.scene === 'market' ? 'town' : 'urban';
  const crowd = track(representativeSample({ regionId: state.region, settlement, count: 12, seed: `scene:${state.scene}:${state.round}`, oversample: 4 }));
  const speaker = track(representativeSample({ regionId: state.region, settlement: 'urban', count: 3, seed: `speaker:${state.round}` }))[state.round % 3];
  const title = `${SCENE_EVENTS[state.scene]}, ${REGIONS[state.region].label}`;
  const seg = ['plaza', 'harbour', 'council', 'market'].map((s) => `<button type="button" data-scene="${s}" aria-pressed="${s === state.scene}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('');
  return `<div class="view-head"><div><div class="eyebrow">Event illustration</div><h1>${esc(SCENE_EVENTS[state.scene])}</h1><p>Scenes are composed from the same persistent residents, so anyone here looks the same in their dossier.</p></div>
    <div class="controls"><label class="field">Region<select id="e-region">${regionOptions(state.region)}</select></label><div class="seg" role="group" aria-label="Setting">${seg}</div><button class="btn" type="button" id="reroll">${icon('dice')}Redraw</button></div></div>
  <div class="stack">
    <div class="scene">${renderScene(crowd, { setting: state.scene, title, speaker })}</div>
    <div class="panel"><h2>In this scene</h2><p class="sub">Speaker first, then the crowd from back to front.</p><div class="plates">${[speaker, ...crowd].map((a, i) => plate(a, i === 0 ? 'Speaker' : assignRole({ seed: a.id, settlement }).label, { size: 160 })).join('')}</div></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Router and wiring

const RENDER = { atlas: renderAtlas, census: renderCensus, registry: renderRegistry, dossier: renderDossier, households: renderHouseholds, public: renderPublic, events: renderEvents };

function renderNav() {
  const active = state.view === 'dossier' ? 'registry' : state.view;
  $('#nav').innerHTML = VIEWS.map(([k, l]) => `<a href="#${k}" ${k === active ? 'aria-current="page"' : ''}>${icon(k)}<span>${l}</span></a>`).join('');
}

function render({ keepScroll = false } = {}) {
  renderNav();
  const y = window.scrollY;
  $('#view').innerHTML = RENDER[state.view]();
  wire();
  if (!keepScroll) window.scrollTo(0, 0);
  else window.scrollTo(0, y);
}

function go(view) {
  if (location.hash.slice(1) !== view) location.hash = view;
  else { state.view = view; render(); }
}

function openPerson(id) {
  const a = lookup(id);
  if (!a) return;
  state.current = a;
  state.viewAge = null;
  if (location.hash.slice(1) === 'dossier') { state.view = 'dossier'; render(); } else location.hash = 'dossier';
}

let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

function updatePerson(a) {
  state.current = a;
  if (state.people.has(a.id)) { state.people.set(a.id, a); saveRegistry(); } else transient.set(a.id, a);
}

function wire() {
  document.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => openPerson(el.dataset.open)));
  document.querySelectorAll('[data-region]').forEach((el) => {
    const act = () => { state.region = el.dataset.region; go('census'); };
    el.addEventListener('click', act);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
  });
  document.querySelectorAll('[data-settlement]').forEach((el) => el.addEventListener('click', () => { state.settlement = el.dataset.settlement; render({ keepScroll: true }); }));
  document.querySelectorAll('[data-scene]').forEach((el) => el.addEventListener('click', () => { state.scene = el.dataset.scene; render({ keepScroll: true }); }));
  const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
  on('#reroll', 'click', () => { state.round++; render({ keepScroll: true }); });
  for (const id of ['#c-region', '#h-region', '#p-region', '#e-region']) on(id, 'change', (e) => { state.region = e.target.value; render({ keepScroll: true }); });
  on('#h-partner', 'change', (e) => { state.partner = e.target.value; render({ keepScroll: true }); });
  on('#f-q', 'input', (e) => {
    state.filter.q = e.target.value;
    const pos = e.target.selectionStart;
    render({ keepScroll: true });
    const el = $('#f-q'); el.focus(); el.setSelectionRange(pos, pos);
  });
  on('#f-region', 'change', (e) => { state.filter.region = e.target.value; render({ keepScroll: true }); });
  on('#f-tone', 'change', (e) => { state.filter.tone = e.target.value; render({ keepScroll: true }); });

  // Dossier
  on('#add-reg', 'click', () => {
    const a = { ...state.current };
    delete a.example;
    state.people.set(a.id, a);
    transient.delete(a.id);
    saveRegistry();
    toast(`${personName(a.id)} added to the registry`);
    render({ keepScroll: true });
  });
  on('#d-age', 'input', (e) => {
    state.viewAge = Number(e.target.value);
    const a = withAge(state.current, state.viewAge);
    $('#d-age-val').textContent = state.viewAge;
    $('#d-portrait').innerHTML = renderPortrait(a, { size: 340, title: `${personName(a.id)} at ${state.viewAge}` });
  });
  on('#d-age', 'change', () => render({ keepScroll: true }));
  on('#d-set-age', 'click', () => {
    updatePerson(withAge(state.current, state.viewAge));
    state.viewAge = null;
    toast('Age recorded');
    render({ keepScroll: true });
  });
  const fillExtras = () => {
    const type = $('#ev-type').value;
    const opts = eventExtras(type, state.current);
    $('#ev-extra').innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    $('#ev-extra-wrap').hidden = !opts.length;
  };
  if ($('#ev-type')) { fillExtras(); on('#ev-type', 'change', fillExtras); }
  on('#ev-form', 'submit', (e) => {
    e.preventDefault();
    const type = $('#ev-type').value;
    updatePerson(applyEvent(state.current, buildEvent(type, $('#ev-extra').value, state.current.age)));
    toast(`${EVENT_TYPES[type]} recorded`);
    render({ keepScroll: true });
  });
  on('#copy-desc', 'click', async () => {
    const text = $('#d-desc').textContent;
    try { await navigator.clipboard.writeText(text); toast('Description copied'); } catch {
      const r = document.createRange(); r.selectNodeContents($('#d-desc'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast('Selected. Press Ctrl+C or Cmd+C to copy');
    }
  });
}

// Theme toggle: system → light → dark
const THEMES = ['system', 'light', 'dark'];
let theme = 'system';
try { theme = localStorage.getItem('iskar.theme') || 'system'; } catch { /* default */ }
function applyTheme() {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  for (const id of ['#theme', '#theme-m']) { const b = $(id); if (b) b.textContent = `Theme: ${theme}`; }
}
for (const id of ['#theme', '#theme-m']) {
  $(id)?.addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % 3];
    try { localStorage.setItem('iskar.theme', theme); } catch { /* ignore */ }
    applyTheme();
  });
}

function fromHash() {
  const h = location.hash.slice(1);
  state.view = RENDER[h] ? h : 'atlas';
  if (state.view === 'dossier' && !state.current) state.view = 'registry';
  render();
}
window.addEventListener('hashchange', fromHash);

loadRegistry();
applyTheme();
fromHash();
