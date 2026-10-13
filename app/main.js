import { createWorld, advance, decide, serialize, deserialize, fmtDate, fmtMonth, dateOf, SCENARIOS } from '../src/sim/engine.js';
import { CIVILIZATIONS } from '../src/world/civilizations.js';
import { buildWorld, paintWorld, paintRegion, paintLandscape, layoutRegion } from '../src/render/maps.js';
import { loadConfig, saveConfig, portraitImage, sceneImage, testConnection } from '../src/render/imagegen.js';
import { representativeSample } from '../src/appearance/generator.js';
import { esc, icon } from './ui.js';
import * as V from './views.js';

const $ = (s, r = document) => r.querySelector(s);
const SAVE_KEY = 'iskar.save.v1';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const app = {
  world: null,
  view: 'accueil',
  playing: false,
  speed: 1,
  carry: 0,
  newCiv: 'orane',
  mapMode: 'carte',
  layers: { frontieres: true, villes: true, ressources: true, routes: true, conflits: true },
  layersOpen: typeof window !== 'undefined' ? window.innerWidth > 760 : true,
  zoom: 1,
  pan: [0, 0],
  mapData: null,
  civ: 'orane',
  civTab: 'apercu',
  province: { civ: 'orane', id: 'valmont' },
  regionLayers: { villes: true, villages: true, routes: true, rivieres: true, frontieres: true, ressources: true },
  locality: 'Valmire',
  character: 'mara-venn',
  charTab: 'apercu',
  timeTab: 'evenements',
  anaTab: 'economie',
  anaCiv: 'orane',
  expTab: 'chronologie',
  round: 0,
  confirmClear: false,
  savedSummary: null,
};

const GAME_VIEWS = ['carte', 'civilisation', 'region', 'personnage', 'evenements', 'temps', 'analyses', 'explorateur'];
const NAV = [
  ['carte', 'Carte', 'map'],
  ['civilisation', 'Civilisation', 'crown'],
  ['region', 'Région', 'region'],
  ['personnage', 'Personnage', 'person'],
  ['evenements', 'Événements', 'scroll'],
  ['temps', 'Temps', 'clock'],
  ['analyses', 'Analyses', 'chart'],
  ['explorateur', 'Explorateur', 'book'],
];
const RENDER = {
  accueil: V.viewAccueil, nouvelle: V.viewNouvelle, scenarios: V.viewScenarios, parametres: V.viewParametres,
  carte: V.viewCarte, civilisation: V.viewCivilisation, region: V.viewRegion, personnage: V.viewPersonnage,
  evenements: V.viewEvenements, temps: V.viewTemps, analyses: V.viewAnalyses, explorateur: V.viewExplorateur,
};

// ---------------------------------------------------------------------------
// Save / load

function readSave() {
  const raw = store.get(SAVE_KEY);
  if (!raw) return null;
  try { return deserialize(raw); } catch { return null; }
}
function save() {
  if (app.world) store.set(SAVE_KEY, serialize(app.world));
}
function summary(w) {
  return `${CIVILIZATIONS[w.playerCiv].name} · ${fmtDate(w.day)}`;
}

function startWorld(opts) {
  app.world = createWorld(opts);
  app.civ = app.anaCiv = app.world.playerCiv;
  app.province = { civ: app.world.playerCiv, id: CIVILIZATIONS[app.world.playerCiv].provinces[0].id };
  app.locality = CIVILIZATIONS[app.world.playerCiv].capital;
  app.character = app.world.playerCiv === 'orane' ? 'mara-venn' : V.LEADER[app.world.playerCiv];
  app.playing = false;
  save();
}

// ---------------------------------------------------------------------------
// Rendering

function header() {
  const w = app.world;
  if (!w || !GAME_VIEWS.includes(app.view)) return '';
  const pending = w.pending.length;
  return `<header class="topbar">
    <button type="button" class="brand" data-action="go" data-to="accueil" aria-label="Menu principal">ISKAR</button>
    <div class="date"><span class="mono">${fmtMonth(w.day)}</span><small>${fmtDate(w.day)}</small></div>
    ${V.timeControls(app)}
    ${pending ? `<button type="button" class="pending" data-action="go" data-to="evenements">${icon('scroll')} ${pending === 1 ? 'Décision en attente' : `${pending} décisions en attente`}</button>` : ''}
    <nav class="tabs-nav" aria-label="Écrans">${NAV.map(([k, l, ic]) => `<a href="#${k}"${app.view === k ? ' aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    <button type="button" class="icon-btn" data-action="go" data-to="parametres" aria-label="Paramètres">${icon('gear')}</button>
  </header>`;
}

function render({ keepScroll = false } = {}) {
  const y = window.scrollY;
  if (GAME_VIEWS.includes(app.view) && !app.world) app.view = 'accueil';
  if (app.view === 'carte' && !app.mapData) app.mapData = buildWorld('iskar');
  if (app.view === 'accueil') {
    const s = app.world ?? readSave();
    app.savedSummary = s ? summary(s) : null;
  }
  $('#app').innerHTML = header() + `<main id="view" class="view-${app.view}">${RENDER[app.view](app)}</main>`;
  afterRender();
  if (!keepScroll) window.scrollTo(0, 0);
  else window.scrollTo(0, y);
}

/** Cheap refresh while time runs: header, plus the current view when it shows live data. */
let lastViewRefresh = 0;
function refreshLive(force = false) {
  const hdr = $('.topbar');
  if (hdr) {
    const tmp = document.createElement('div');
    tmp.innerHTML = header();
    hdr.replaceWith(tmp.firstElementChild);
  }
  const now = performance.now();
  if (force || (['temps', 'analyses', 'evenements'].includes(app.view) && now - lastViewRefresh > 900)) {
    lastViewRefresh = now;
    const y = window.scrollY;
    $('#view').innerHTML = RENDER[app.view](app);
    afterRender();
    window.scrollTo(0, y);
  }
}

const painted = new Map();
function afterRender() {
  for (const cv of document.querySelectorAll('canvas[data-paint]')) {
    const spec = cv.dataset.paint;
    const [kind, a, b] = spec.split(':');
    if (kind === 'landscape') paintCached(cv, 'landscape', () => paintLandscape(cv));
    if (kind === 'world') {
      if (!app.mapData) app.mapData = buildWorld('iskar');
      const values = {};
      for (const [id, c] of Object.entries(app.world.civs)) values[id] = app.mapMode === 'relations' ? app.world.relations[app.world.playerCiv][id] ?? 0 : c.stability;
      const key = `world:${app.mapMode}:${app.layers.frontieres}:${app.mapMode === 'carte' || app.mapMode === 'ressources' ? '' : JSON.stringify(values)}`;
      paintCached(cv, key, () => paintWorld(cv, app.mapData, { mode: app.mapMode, borders: app.layers.frontieres, values, player: app.world.playerCiv }));
    }
    if (kind === 'region' || kind === 'regionmap') {
      const prov = CIVILIZATIONS[a].provinces.find((p) => p.id === b);
      const layers = kind === 'region' ? {} : app.regionLayers;
      paintCached(cv, `${spec}:${JSON.stringify(layers)}`, () => paintRegion(cv, a, prov, layoutRegion(a, prov), layers));
    }
  }
  wireMap();
  hydrateImages();
}

/** Paint once per key, then reuse the bitmap. */
function paintCached(cv, key, paint) {
  const hit = painted.get(key);
  if (hit) {
    cv.width = hit.width;
    cv.height = hit.height;
    cv.getContext('2d').drawImage(hit, 0, 0);
    return;
  }
  paint();
  const copy = document.createElement('canvas');
  copy.width = cv.width;
  copy.height = cv.height;
  copy.getContext('2d').drawImage(cv, 0, 0);
  painted.set(key, copy);
}

// ---------------------------------------------------------------------------
// Image model (optional)

function hydrateImages() {
  if (!loadConfig().enabled || !app.world) return;
  for (const el of document.querySelectorAll('.pt[data-pid]')) {
    const ch = app.world.characters[el.dataset.pid];
    if (!ch) continue;
    portraitImage(ch.appearance).then((src) => {
      if (src && el.isConnected) el.innerHTML = `<img src="${esc(src)}" alt="${esc(ch.name)}">`;
    }).catch(() => { /* keep the SVG */ });
  }
  for (const el of document.querySelectorAll('.scene[data-scene]')) {
    const civ = el.dataset.sceneCiv;
    const people = representativeSample({ regionId: civ, settlement: 'urban', count: 5, seed: el.dataset.scene, oversample: 3 });
    sceneImage(el.dataset.scene, `${el.dataset.sceneTitle}, ${el.dataset.sceneSetting} in ${CIVILIZATIONS[civ].name}`, people).then((src) => {
      if (src && el.isConnected) el.innerHTML = `<img src="${esc(src)}" alt="${esc(el.dataset.sceneTitle)}">`;
    }).catch(() => { /* keep the SVG */ });
  }
}

// ---------------------------------------------------------------------------
// Map zoom and pan

function wireMap() {
  const stage = $('[data-zoom-stage]');
  if (!stage) return;
  const inner = $('.map-inner', stage);
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input, label, .civ-label, .layers')) return;
    drag = { x: e.clientX, y: e.clientY, pan: [...app.pan] };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    app.pan = [drag.pan[0] + e.clientX - drag.x, drag.pan[1] + e.clientY - drag.y];
    inner.style.transform = `translate(${app.pan[0]}px,${app.pan[1]}px) scale(${app.zoom})`;
  });
  const end = () => { drag = null; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------------------
// Time loop

let timer = null;
let lastMonth = -1;
function setPlaying(on) {
  app.playing = on && app.world && !app.world.pending.length;
  clearInterval(timer);
  if (app.playing) timer = setInterval(step, 250);
}
function step() {
  const w = app.world;
  if (!w) return;
  app.carry += app.speed / 4;
  const days = Math.floor(app.carry);
  app.carry -= days;
  if (days) advance(w, days);
  const m = dateOf(w.day).m;
  if (m !== lastMonth) { lastMonth = m; save(); }
  if (w.pending.length) {
    setPlaying(false);
    save();
    toast('Une décision vous attend');
    if (app.view !== 'evenements') { refreshLive(); return; }
    refreshLive(true);
    return;
  }
  refreshLive();
}

let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------------------------------------------------------------------------
// Actions

function go(view, opts = {}) {
  if (opts.civ) app.civ = opts.civ;
  if (opts.char) { app.character = opts.char; app.charTab = 'apercu'; }
  if (opts.prov) { app.province = { civ: opts.civ ?? app.civ, id: opts.prov }; app.locality = null; }
  if (location.hash.slice(1) !== view) location.hash = view;
  else { app.view = view; render(); }
}

const ACTIONS = {
  go: (d) => go(d.to, { civ: d.civ, char: d.char, prov: d.prov }),
  continue: () => {
    if (!app.world) app.world = readSave();
    if (app.world) { app.civ = app.anaCiv = app.world.playerCiv; go(app.world.pending.length ? 'evenements' : 'carte'); }
  },
  explorer: () => {
    if (!app.world) app.world = readSave() ?? createWorld({});
    app.expTab = 'chronologie';
    go('explorateur');
  },
  'pick-civ': (d) => { app.newCiv = d.civ; render({ keepScroll: true }); },
  'new-game': () => { startWorld({ seed: `iskar-${Date.now().toString(36)}`, playerCiv: app.newCiv }); go('carte'); },
  'launch-scenario': (d) => { startWorld({ seed: `iskar-${d.scenario}`, scenario: d.scenario }); toast(SCENARIOS[d.scenario].title); go('carte'); },
  play: () => { if (app.world?.pending.length) { go('evenements'); return; } setPlaying(true); refreshLive(true); },
  pause: () => { setPlaying(false); save(); refreshLive(true); },
  speed: (d) => { app.speed = Number(d.speed); if (!app.playing) setPlaying(true); refreshLive(true); },
  skip: () => {
    const w = app.world;
    const { y, m } = dateOf(w.day);
    const target = Math.round((Date.UTC(y, m + 1, 1) - Date.UTC(1920, 0, 1)) / 86400000);
    advance(w, target - w.day);
    save();
    if (w.pending.length) { toast('Une décision vous attend'); go('evenements'); } else render({ keepScroll: true });
  },
  decide: (d) => {
    const entry = decide(app.world, Number(d.uid), d.choice);
    save();
    toast(entry.text.slice(0, 90));
    if (!app.world.pending.length) go('temps'); else render();
  },
  'map-mode': (d) => { app.mapMode = d.mode; render({ keepScroll: true }); },
  'toggle-layers': () => { app.layersOpen = !app.layersOpen; render({ keepScroll: true }); },
  zoom: (d) => {
    const dir = Number(d.dir);
    if (!dir) { app.zoom = 1; app.pan = [0, 0]; } else app.zoom = Math.max(1, Math.min(3, app.zoom * (dir > 0 ? 1.3 : 1 / 1.3)));
    const inner = $('.map-inner');
    if (inner) inner.style.transform = `translate(${app.pan[0]}px,${app.pan[1]}px) scale(${app.zoom})`;
  },
  'civ-tab': (d) => { app.civTab = d.tab; render({ keepScroll: true }); },
  'char-tab': (d) => { app.charTab = d.tab; render({ keepScroll: true }); },
  'time-tab': (d) => { app.timeTab = d.tab; render({ keepScroll: true }); },
  'ana-tab': (d) => { app.anaTab = d.tab; render({ keepScroll: true }); },
  'exp-tab': (d) => { app.expTab = d.tab; render({ keepScroll: true }); },
  locality: (d) => { app.locality = d.name; render({ keepScroll: true }); },
  reroll: () => { app.round++; render({ keepScroll: true }); },
  'test-imagegen': async () => {
    const status = $('#ig-status');
    status.textContent = 'Test en cours…';
    try { await testConnection(readImageForm()); status.textContent = 'Connexion réussie.'; } catch (e) { status.textContent = `Échec : ${e.message}. Vérifiez l’adresse, la clé et que le service accepte les requêtes de ce site.`; }
  },
  'clear-save': (d) => {
    if (!d.confirm) { app.confirmClear = true; render({ keepScroll: true }); return; }
    store.del(SAVE_KEY);
    setPlaying(false);
    app.world = null;
    app.confirmClear = false;
    toast('Sauvegarde effacée');
    go('accueil');
  },
  'cancel-clear': () => { app.confirmClear = false; render({ keepScroll: true }); },
};

const CHANGES = {
  layer: (el) => { app.layers[el.dataset.layer] = el.checked; render({ keepScroll: true }); },
  'region-layer': (el) => { app.regionLayers[el.dataset.layer] = el.checked; render({ keepScroll: true }); },
  'select-civ': (el) => { app.civ = el.value; render({ keepScroll: true }); },
  'select-char': (el) => { app.character = el.value; render({ keepScroll: true }); },
  'select-province': (el) => { const [c, p] = el.value.split(':'); app.province = { civ: c, id: p }; app.locality = null; render({ keepScroll: true }); },
  'ana-civ': (el) => { app.anaCiv = el.value; render({ keepScroll: true }); },
};

function readImageForm() {
  return {
    ...loadConfig(),
    enabled: $('#ig-enabled').checked,
    endpoint: $('#ig-endpoint').value.trim(),
    apiKey: $('#ig-key').value.trim(),
    model: $('#ig-model').value.trim(),
    size: $('#ig-size').value.trim(),
    style: $('#ig-style').value.trim(),
  };
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.matches('input, select')) return;
  const fn = ACTIONS[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el.dataset); }
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-action], svg [data-action]')) {
    e.preventDefault();
    ACTIONS[e.target.dataset.action]?.(e.target.dataset);
  }
  if (e.key === ' ' && app.world && GAME_VIEWS.includes(app.view) && !e.target.closest('input, select, textarea, button, a, [role="button"], [role="link"]')) {
    e.preventDefault();
    (app.playing ? ACTIONS.pause : ACTIONS.play)();
  }
});
document.addEventListener('change', (e) => {
  const fn = CHANGES[e.target.dataset.action];
  if (fn) fn(e.target);
});
document.addEventListener('submit', (e) => {
  if (e.target.dataset.form === 'imagegen') {
    e.preventDefault();
    saveConfig(readImageForm());
    toast('Paramètres enregistrés');
  }
});

function fromHash() {
  const h = location.hash.slice(1);
  app.view = RENDER[h] ? h : 'accueil';
  if (GAME_VIEWS.includes(app.view) && !app.world) {
    app.world = readSave();
    if (app.world) app.civ = app.anaCiv = app.world.playerCiv;
    else app.view = 'accueil';
  }
  render();
}
window.addEventListener('hashchange', fromHash);
fromHash();
