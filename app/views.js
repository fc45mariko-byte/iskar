// Écrans du jeu. Each view returns an HTML string; interactions are wired in
// main.js through data-action attributes.

import { CIVILIZATIONS, CIV_IDS, OCEANS, RESOURCES, PREHISTORY } from '../src/world/civilizations.js';
import { FR, fmtNum, fmtInt, de } from '../src/world/fr.js';
import { SKIN_TONE_CATEGORIES, skinHex, EYE_COLORS } from '../src/appearance/traits.js';
import { representativeSample, generateAppearance } from '../src/appearance/generator.js';
import { visibleAppearance } from '../src/appearance/lifecycle.js';
import { identityRecord } from '../src/appearance/identity.js';
import { ANCESTRAL_POOLS } from '../src/appearance/population.js';
import { civName } from '../src/world/names.js';
import { assignRole } from '../src/society/roles.js';
import { renderScene } from '../src/portrait/scene.js';
import { SCENARIOS, fmtDate, fmtMonth, dateOf, trend } from '../src/sim/engine.js';
import { TRAITS } from '../src/sim/characters.js';
import { capitals, cityPositions, borderPoint, WORLD_W, WORLD_H, layoutRegion } from '../src/render/maps.js';
import { loadConfig } from '../src/render/imagegen.js';
import { esc, icon, emblem, portrait, lineChart, bar, delta } from './ui.js';

export const LEADER = { orane: 'clemence-orsel', veyra: 'viktoria-ardaine', nyrad: 'ysolde-haldane', thelis: 'ione-asteridis', sahel: 'nale-ag-tasmar', kaelen: 'brann-de-brumeval' };
const SETTING_SETTLEMENT = { council: 'urban', plaza: 'urban', market: 'town', harbour: 'port' };
const SETTING_LABEL = { council: 'Salle du conseil', plaza: 'Place publique', market: 'Marché', harbour: 'Port' };
const OCC_FR = { farmer: 'Agricultrice·eur', herder: 'Éleveur·se', fisher: 'Pêcheur·se', laborer: 'Ouvrier·ère', artisan: 'Artisan·e', weaver: 'Tisserand·e', smith: 'Forgeron·ne', merchant: 'Marchand·e', shopkeeper: 'Commerçant·e', sailor: 'Marin', soldier: 'Soldat·e', officer: 'Officier·ère', scholar: 'Érudit·e', physician: 'Médecin', engineer: 'Ingénieur·e', scribe: 'Greffier·ère', priest: 'Prêtre·sse', magistrate: 'Magistrat·e', minister: 'Ministre', governor: 'Gouverneur·e', 'head-of-state': 'Chef·fe d’État', artist: 'Artiste', teacher: 'Enseignant·e', banker: 'Banquier·ère' };
const KIND_SETTLEMENT = { urban: 'urban', town: 'town', rural: 'rural', port: 'port', border: 'border' };

const civ = (id) => CIVILIZATIONS[id];
const pct = (x) => `${Math.round(x)} %`;

function residentName(a) {
  return civName(a.id, a.context.regionId, a.presentation);
}
function residentRole(a) {
  return OCC_FR[assignRole({ seed: a.id, settlement: a.context.settlement }).occupation];
}

/** Event illustration composed from persistent people. */
export function sceneFor(app, image, civId, title, { height } = {}) {
  if (!image) return '';
  const settlement = SETTING_SETTLEMENT[image.setting] ?? 'urban';
  const crowd = representativeSample({ regionId: civId, settlement, count: 10, seed: image.seed, oversample: 3 });
  const speakerId = image.setting === 'council' || image.setting === 'plaza' ? LEADER[civId] : null;
  const speaker = speakerId ? app.world.characters[speakerId]?.appearance : null;
  return `<div class="scene" data-scene="${esc(image.seed)}" data-scene-civ="${civId}" data-scene-title="${esc(title)}" data-scene-setting="${image.setting}"${height ? ` style="max-height:${height}px"` : ''}>${renderScene(crowd, { setting: image.setting, title, speaker })}</div>`;
}

// ---------------------------------------------------------------------------
// 1. Écran d'accueil

export function viewAccueil(app) {
  const save = app.savedSummary;
  return `<section class="title-screen">
    <canvas class="landscape" data-paint="landscape" aria-hidden="true"></canvas>
    <div class="title-content">
      <div class="title-block"><h1 class="game-title">ISKAR</h1><p class="tagline">Un monde. Des peuples. Des histoires.</p></div>
      <nav class="title-menu" aria-label="Menu principal">
        ${save ? `<button type="button" data-action="continue"><span>Continuer</span><small>${esc(save)}</small></button>` : ''}
        <button type="button" data-action="go" data-to="nouvelle"><span>Nouvelle partie</span></button>
        <button type="button" data-action="go" data-to="scenarios"><span>Scénarios</span></button>
        <button type="button" data-action="explorer"><span>Explorateur</span></button>
        <button type="button" data-action="go" data-to="parametres"><span>Paramètres</span></button>
      </nav>
      <blockquote class="title-quote">« Les civilisations ne sont que des histoires que les hommes décident de croire ensemble. »</blockquote>
      <aside class="reco">
        <div class="eyebrow">Scénario recommandé</div>
        <b>La crise du grain</b><span>Orane, 1920</span>
        <div class="reco-img">${renderScene(representativeSample({ regionId: 'orane', settlement: 'urban', count: 8, seed: 'reco', oversample: 3 }), { setting: 'council', title: 'La crise du grain' })}</div>
        <button class="btn gold" type="button" data-action="launch-scenario" data-scenario="crise-du-grain">Jouer ce scénario</button>
      </aside>
    </div>
  </section>`;
}

// --- Nouvelle partie / Scénarios / Paramètres -------------------------------

export function viewNouvelle(app) {
  const sel = app.newCiv;
  const cards = CIV_IDS.map((id) => {
    const c = civ(id);
    return `<button type="button" class="civ-card${sel === id ? ' on' : ''}" data-action="pick-civ" data-civ="${id}" aria-pressed="${sel === id}">
      ${emblem(id, 44)}<div><b>${c.name}</b><span class="muted">${c.type} · capitale ${c.capital}</span><p>${esc(c.description)}</p></div></button>`;
  }).join('');
  return `<section class="page narrow">
    <div class="page-head"><div class="eyebrow">Nouvelle partie</div><h1>Choisissez une civilisation</h1><p class="muted">La partie commence le 1er mars 1920. Les autres gouvernements prennent leurs décisions seuls ; vous tranchez celles de votre civilisation.</p></div>
    <div class="civ-grid">${cards}</div>
    <div class="actions"><button class="btn" type="button" data-action="go" data-to="accueil">Retour</button><button class="btn gold" type="button" data-action="new-game">Commencer avec ${civ(sel).name}</button></div>
  </section>`;
}

export function viewScenarios() {
  const list = Object.entries(SCENARIOS).map(([id, s]) => `<article class="panel scenario">
    <div class="eyebrow">${s.alternative ? 'Scénario alternatif' : 'Scénario historique'} · ${civ(s.civ).name}</div>
    <h2>${esc(s.title)}</h2><p>${esc(s.summary)}</p>
    <button class="btn gold" type="button" data-action="launch-scenario" data-scenario="${id}">Lancer ce scénario</button></article>`).join('');
  return `<section class="page narrow"><div class="page-head"><div class="eyebrow">Scénarios</div><h1>Points de départ</h1><p class="muted">Chaque scénario part de 1920 avec un monde légèrement différent.</p></div><div class="stack">${list}</div>
    <div class="actions"><button class="btn" type="button" data-action="go" data-to="accueil">Retour</button></div></section>`;
}

export function viewParametres(app) {
  const cfg = loadConfig();
  const onClaude = /claude\.ai|claudeusercontent/.test(location.hostname);
  return `<section class="page narrow">
    <div class="page-head"><div class="eyebrow">Paramètres</div><h1>Paramètres</h1></div>
    <form class="panel stack" data-form="imagegen">
      <h2>Portraits et illustrations par modèle d’image</h2>
      <p class="muted">Sans configuration, les portraits et les scènes sont dessinés par le jeu. Avec un service d’images, chaque personnage est envoyé avec sa description d’identité permanente ; le premier portrait obtenu sert ensuite de référence pour qu’il reste reconnaissable.</p>
      ${onClaude ? '<p class="note">Cette page est hébergée sur claude.ai, qui interdit les appels vers d’autres serveurs. Pour utiliser un modèle d’image, lancez le jeu depuis le dépôt (<code>npm start</code>).</p>' : ''}
      <label class="check"><input type="checkbox" id="ig-enabled" ${cfg.enabled ? 'checked' : ''}> Activer la génération d’images</label>
      <label class="field">Adresse du service (compatible « images/generations »)<input type="text" id="ig-endpoint" value="${esc(cfg.endpoint)}"></label>
      <label class="field">Clé d’API<input type="password" id="ig-key" value="${esc(cfg.apiKey)}" autocomplete="off"></label>
      <div class="row"><label class="field">Modèle<input type="text" id="ig-model" value="${esc(cfg.model)}"></label><label class="field">Taille<input type="text" id="ig-size" value="${esc(cfg.size)}"></label></div>
      <label class="field">Style commun<input type="text" id="ig-style" value="${esc(cfg.style)}"></label>
      <div class="actions"><button class="btn gold" type="submit">Enregistrer</button><button class="btn" type="button" data-action="test-imagegen">Tester la connexion</button><span class="muted" id="ig-status" role="status"></span></div>
    </form>
    <div class="panel stack"><h2>Sauvegarde</h2><p class="muted">La partie est enregistrée dans ce navigateur à chaque mois de jeu et à chaque décision.</p>
      <div class="actions">${app.confirmClear ? '<span>Effacer définitivement la partie en cours ?</span><button class="btn danger" type="button" data-action="clear-save" data-confirm="1">Oui, effacer</button><button class="btn" type="button" data-action="cancel-clear">Annuler</button>' : '<button class="btn" type="button" data-action="clear-save">Effacer la sauvegarde</button>'}</div></div>
    <div class="actions"><button class="btn" type="button" data-action="${app.world ? 'go' : 'go'}" data-to="${app.world ? 'carte' : 'accueil'}">Retour</button></div>
  </section>`;
}

// ---------------------------------------------------------------------------
// 2. Carte du monde

const MODE_LABEL = { carte: 'Carte', ressources: 'Ressources', politiques: 'Politiques', relations: 'Relations' };
const LAYER_LABEL = { frontieres: 'Frontières', villes: 'Villes principales', ressources: 'Ressources', routes: 'Routes commerciales', conflits: 'Zones de conflit' };
const RES_ICON = { blé: 'wheat', fer: 'gear', charbon: 'bolt', poisson: 'anchor', sel: 'sack', bétail: 'people', bois: 'tree', vin: 'heart' };

export function worldOverlay(app) {
  const data = app.mapData;
  const w = app.world;
  const caps = capitals(data);
  const cities = cityPositions(data);
  const L = app.layers;
  let s = '';
  // trade routes
  if (L.routes) {
    const seen = new Set();
    for (const a of CIV_IDS) for (const [b, wgt] of Object.entries(civ(a).tradePartners)) {
      const k = [a, b].sort().join('-');
      if (wgt < 2 || seen.has(k)) continue;
      seen.add(k);
      const [x1, y1] = caps[a], [x2, y2] = caps[b];
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18, my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
      s += `<path class="route" d="M${x1},${y1} Q${mx.toFixed(0)},${my.toFixed(0)} ${x2},${y2}"/>`;
    }
  }
  if (L.conflits) {
    for (const a of CIV_IDS) for (const b of CIV_IDS) if (a < b && w.relations[a][b] < -20) {
      const [x, y] = borderPoint(data, a, b, caps);
      s += `<g class="conflict"><circle cx="${x}" cy="${y}" r="22"/><circle cx="${x}" cy="${y}" r="22" class="pulse"/><text x="${x}" y="${y - 28}" text-anchor="middle">Tension ${civ(a).name}–${civ(b).name}</text></g>`;
    }
  }
  if (L.ressources) {
    for (const r of RESOURCES) {
      const x = r.x * WORLD_W, y = r.y * WORLD_H;
      s += `<g class="res" transform="translate(${x - 9},${y - 9})"><title>${r.kind}</title><circle cx="9" cy="9" r="10"/><g transform="translate(2.5 2.5) scale(.55)">${icon(RES_ICON[r.kind]).replace('<svg', '<svg width="24" height="24"')}</g></g>`;
    }
  }
  if (L.villes) {
    for (const id of CIV_IDS) {
      const names = civ(id).provinces.flatMap((p) => p.localities).sort((a, b) => b[1] - a[1]).slice(1, 3);
      cities[id].slice(0, names.length).forEach(([x, y], i) => {
        s += `<g class="city"><circle cx="${x}" cy="${y}" r="3"/><text x="${x + 6}" y="${y + 4}">${esc(names[i][0])}</text></g>`;
      });
    }
  }
  for (const id of CIV_IDS) {
    const [x, y] = caps[id];
    s += `<g class="civ-label" data-action="go" data-to="civilisation" data-civ="${id}" tabindex="0" role="link" aria-label="${civ(id).name}">
      <g transform="translate(${x - 9},${y - 46})">${emblem(id, 18)}</g>
      <text class="name" x="${x}" y="${y - 8}" text-anchor="middle">${civ(id).name}</text>
      <text class="type" x="${x}" y="${y + 8}" text-anchor="middle">${civ(id).type}</text>
      ${L.villes ? `<rect class="cap" x="${x - 3}" y="${y + 14}" width="6" height="6" transform="rotate(45 ${x} ${y + 17})"/><text class="capname" x="${x + 8}" y="${y + 21}">${civ(id).capital}</text>` : ''}
    </g>`;
  }
  for (const o of OCEANS) s += `<text class="ocean" x="${o.x * WORLD_W}" y="${o.y * WORLD_H}" text-anchor="middle">${o.name}</text>`;
  // compass + scale
  s += `<g class="compass" transform="translate(56 ${WORLD_H - 70})"><circle r="22"/><path d="M0,-30 L5,0 L0,30 L-5,0Z"/><path d="M-30,0 L0,4 L30,0 L0,-4Z" opacity=".6"/><text y="-34" text-anchor="middle">N</text></g>`;
  s += `<g class="scalebar" transform="translate(${WORLD_W - 150} ${WORLD_H - 30})"><path d="M0,0 h100 M0,-5 v10 M50,-3 v6 M100,-5 v10"/><text x="50" y="-9" text-anchor="middle">500 km</text></g>`;
  return `<svg class="map-overlay" viewBox="0 0 ${WORLD_W} ${WORLD_H}" aria-label="Carte d’Iskar">${s}</svg>`;
}

export function viewCarte(app) {
  const w = app.world;
  const modes = Object.entries(MODE_LABEL).map(([k, l]) => `<button type="button" data-action="map-mode" data-mode="${k}" aria-pressed="${app.mapMode === k}">${l}</button>`).join('');
  const layers = Object.entries(LAYER_LABEL).map(([k, l]) => `<label class="check"><input type="checkbox" data-action="layer" data-layer="${k}" ${app.layers[k] ? 'checked' : ''}> ${l}</label>`).join('');
  const legend = app.mapMode === 'politiques' ? '<div class="map-legend"><span>Stabilité</span><i style="background:linear-gradient(90deg,#b03e32,#d6a040,#56965c)"></i><span>0</span><span>100</span></div>'
    : app.mapMode === 'relations' ? `<div class="map-legend"><span>Relations avec ${civ(w.playerCiv).name}</span><i style="background:linear-gradient(90deg,#b03e32,#d6a040,#56965c)"></i><span>hostiles</span><span>amicales</span></div>`
      : app.mapMode === 'ressources' ? '<div class="map-legend"><span>Relief et ressources principales</span></div>' : '';
  return `<section class="page wide">
    <div class="panel map-panel">
      <div class="map-toolbar"><h1 class="map-title">ISKAR — ${dateOf(w.day).y}</h1><div class="seg" role="group" aria-label="Mode de carte">${modes}</div>
        <button type="button" class="btn small" data-action="toggle-layers" aria-expanded="${app.layersOpen}">${icon('layers')} Filtres</button></div>
      <div class="map-stage" data-zoom-stage>
        <div class="map-inner" style="transform:translate(${app.pan[0]}px,${app.pan[1]}px) scale(${app.zoom})"><canvas data-paint="world" aria-hidden="true"></canvas>${worldOverlay(app)}</div>
        <aside class="layers" ${app.layersOpen ? '' : 'hidden'}><div class="eyebrow">Afficher</div>${layers}</aside>
        <div class="zoom-ctl"><button type="button" data-action="zoom" data-dir="1" aria-label="Zoomer">${icon('plus')}</button><button type="button" data-action="zoom" data-dir="-1" aria-label="Dézoomer">${icon('minus')}</button><button type="button" data-action="zoom" data-dir="0" aria-label="Recentrer">${icon('reset')}</button></div>
        ${legend}
      </div>
      <p class="muted small-print">Cliquez sur le nom d’une civilisation pour ouvrir son panneau. Faites glisser pour déplacer la carte.</p>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// 3. Panneau d'une civilisation

const CIV_TABS = { apercu: 'Aperçu', politique: 'Politique', economie: 'Économie', societe: 'Société', relations: 'Relations', historique: 'Historique' };

function toneDistribution(civId, n = 900) {
  const counts = Object.fromEntries(SKIN_TONE_CATEGORIES.map((c) => [c.id, 0]));
  for (let i = 0; i < n; i++) counts[generateAppearance({ id: `census:${civId}:${i}`, regionId: civId, settlement: ['rural', 'town', 'urban', 'port'][i % 4] }).skin.category]++;
  return { n, counts };
}
const distCache = new Map();

export function viewCivilisation(app) {
  const id = app.civ;
  const c = civ(id);
  const s = app.world.civs[id];
  const tabs = Object.entries(CIV_TABS).map(([k, l]) => `<button type="button" role="tab" data-action="civ-tab" data-tab="${k}" aria-selected="${app.civTab === k}">${l}</button>`).join('');
  let body = '';
  const leaders = Object.values(app.world.characters).filter((p) => p.civ === id);
  switch (app.civTab) {
    case 'apercu':
      body = `<div class="civ-overview">
        <div class="facts">${emblem(id, 72)}<dl class="kv">
          <dt>Population</dt><dd>${fmtNum(s.population, 1)} millions</dd><dt>Régime</dt><dd>${c.regime}</dd><dt>Capitale</dt><dd>${c.capital}</dd>
          <dt>Langue(s)</dt><dd>${c.langue}</dd><dt>Monnaie</dt><dd>${c.monnaie}</dd><dt>Religion(s)</dt><dd>${c.religion}</dd>
          <dt>Niveau de développement</dt><dd>${c.developpement}</dd><dt>Stabilité</dt><dd class="mono">${Math.round(s.stability)} / 100</dd></dl></div>
        <div><p class="lead">${esc(c.description)}</p>
          <h3>Forces</h3><ul class="pluses">${c.forces.map((f) => `<li>${f}</li>`).join('')}</ul>
          <h3>Défis</h3><ul class="minuses">${c.defis.map((f) => `<li>${f}</li>`).join('')}</ul></div></div>`;
      break;
    case 'politique':
      body = `<div class="grid2"><div><h3>Institutions</h3><dl class="kv"><dt>Régime</dt><dd>${c.regime}</dd><dt>Stabilité</dt><dd>${bar(s.stability, { label: 'Stabilité' })} <span class="mono">${Math.round(s.stability)}</span></dd><dt>Tensions sociales</dt><dd>${bar(s.tension, { color: 'var(--red)', label: 'Tensions' })} <span class="mono">${Math.round(s.tension)}</span></dd><dt>Trésor</dt><dd class="mono">${Math.round(s.treasury)}</dd></dl></div>
        <div><h3>Figures publiques</h3><div class="people-row">${leaders.map((p) => `<button type="button" class="mini-person" data-action="go" data-to="personnage" data-char="${p.id}">${portrait(p.appearance, { size: 64, title: p.name })}<b>${esc(p.name)}</b><span>${esc(p.role)}</span></button>`).join('')}</div></div></div>`;
      break;
    case 'economie': {
      const h = app.world.history[id];
      body = `<div class="grid2"><div><h3>Prix du grain</h3>${lineChart([{ points: h.map((x) => [x.day, x.price]).concat([[app.world.day, s.price]]), color: 'var(--gold)', area: true }], { height: 200, label: 'Prix du grain' })}</div>
        <div><h3>Indicateurs</h3><dl class="kv"><dt>Production de grain</dt><dd>${delta(s.prod - 100)} par rapport à la normale</dd><dt>Réserves</dt><dd>${fmtNum(s.reserves)} mois</dd><dt>Exportations</dt><dd>${pct(s.exports * 100)} des surplus</dd><dt>Activité (indice)</dt><dd class="mono">${fmtNum(s.gdp, 1)}</dd><dt>Trésor</dt><dd class="mono">${Math.round(s.treasury)}</dd></dl></div></div>`;
      break;
    }
    case 'societe': {
      if (!distCache.has(id)) distCache.set(id, toneDistribution(id));
      const dist = distCache.get(id);
      const people = representativeSample({ regionId: id, settlement: 'urban', count: 8, seed: `societe:${app.round}`, oversample: 5 });
      const pools = Object.entries(c.ancestry).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${ANCESTRAL_POOLS[k].label} ${Math.round(v * 100)} %`).join(' · ');
      body = `<div class="grid2"><div><h3>Apparence de la population</h3><p class="muted">Répartition des teintes de peau (échantillon de ${dist.n} habitants). Chaque civilisation mêle plusieurs ascendances : ${pools}.</p>
          <div class="tonebar big">${SKIN_TONE_CATEGORIES.map((t) => `<span style="width:${(dist.counts[t.id] / dist.n) * 100}%;background:${skinHex((t.min + Math.min(t.max, 1)) / 2)}" title="${FR.skin[t.id]}"></span>`).join('')}</div>
          <ul class="legend">${SKIN_TONE_CATEGORIES.map((t) => `<li><i style="background:${skinHex((t.min + Math.min(t.max, 1)) / 2)}"></i>${FR.skinShort[t.id]}<span class="mono">${Math.round((dist.counts[t.id] / dist.n) * 100)} %</span></li>`).join('')}</ul>
          <dl class="kv"><dt>Santé publique</dt><dd>${bar(s.health, { color: 'var(--green)', label: 'Santé' })} <span class="mono">${Math.round(s.health)}</span></dd><dt>Tensions sociales</dt><dd>${bar(s.tension, { color: 'var(--red)', label: 'Tensions' })} <span class="mono">${Math.round(s.tension)}</span></dd></dl></div>
        <div><h3>Habitants</h3><div class="resident-grid">${people.map((p) => `<figure>${portrait(p, { size: 96, title: residentName(p) })}<figcaption><b>${esc(residentName(p))}</b><span>${p.age} ans · ${residentRole(p)}</span></figcaption></figure>`).join('')}</div>
          <button class="btn small" type="button" data-action="reroll">D’autres habitants</button></div></div>`;
      break;
    }
    case 'relations':
      body = `<div class="relations">${CIV_IDS.filter((o) => o !== id).map((o) => {
        const v = app.world.relations[id][o];
        const col = v > 20 ? 'var(--green)' : v < -20 ? 'var(--red)' : 'var(--gold)';
        return `<div class="rel-row">${emblem(o, 28)}<b>${civ(o).name}</b><span class="rel-bar"><span style="left:${v < 0 ? 50 + v / 2 : 50}%;width:${Math.abs(v) / 2}%;background:${col}"></span></span><span class="mono">${v > 0 ? '+' : ''}${Math.round(v)}</span></div>`;
      }).join('')}<p class="muted">De −100 (hostiles) à +100 (alliés).</p></div>`;
      break;
    case 'historique': {
      const pre = PREHISTORY.filter((p) => p.civ === id).map((p) => ({ when: String(p.year), text: p.text }));
      const recent = app.world.log.filter((e) => e.civ === id).slice(0, 12).map((e) => ({ when: fmtDate(e.day), text: e.text }));
      body = `<ol class="timeline">${[...recent, ...pre.reverse()].map((x) => `<li><span class="mono">${x.when}</span><span>${esc(x.text)}</span></li>`).join('') || '<li>Rien à signaler.</li>'}</ol>`;
      break;
    }
  }
  const prov = c.provinces[0];
  return `<section class="page">
    <header class="civ-banner"><canvas data-paint="region:${id}:${prov.id}" aria-hidden="true"></canvas>
      <div class="civ-banner-text">${emblem(id, 60)}<div><h1>${c.name}</h1><span>${c.type}</span></div></div>
      <div class="banner-actions"><select data-action="select-civ" aria-label="Civilisation">${CIV_IDS.map((o) => `<option value="${o}"${o === id ? ' selected' : ''}>${civ(o).name}</option>`).join('')}</select>
      <button type="button" class="btn small" data-action="go" data-to="region" data-civ="${id}" data-prov="${prov.id}">Voir les régions</button></div></header>
    <div class="panel"><div class="tabs" role="tablist">${tabs}</div><div class="tab-body">${body}</div></div>
  </section>`;
}

// ---------------------------------------------------------------------------
// 4. Vue d'une région

const REGION_LAYERS = { villes: 'Villes', villages: 'Villages', routes: 'Routes', rivieres: 'Rivières', frontieres: 'Frontières', ressources: 'Ressources' };

export function viewRegion(app) {
  const { civ: cid, id: pid } = app.province;
  const c = civ(cid);
  const prov = c.provinces.find((p) => p.id === pid) ?? c.provinces[0];
  const layout = layoutRegion(cid, prov);
  const list = layout.places.map((p) => {
    const rep = representativeSample({ regionId: cid, settlement: KIND_SETTLEMENT[p.kind], count: 1, seed: `loc:${p.name}`, oversample: 2 })[0];
    return `<button type="button" class="loc${app.locality === p.name ? ' on' : ''}" data-action="locality" data-name="${esc(p.name)}">${portrait(rep, { size: 40, title: residentName(rep) })}<span><b>${esc(p.name)}</b><small>${fmtInt(p.pop)} hab.</small></span></button>`;
  }).join('') + (prov.others ? `<div class="loc static"><span><b>Autres localités</b><small>(${prov.others})</small></span></div>` : '');
  const labels = layout.places.map((p) => `<g class="place${p.pop >= 20000 ? ' big' : ''}" data-action="locality" data-name="${esc(p.name)}" tabindex="0" role="button"><circle cx="${p.x}" cy="${p.y}" r="${p.pop >= 20000 ? 7 : 5}"/><text x="${p.x + 12}" y="${p.y - 10}">${esc(p.name)}</text></g>`).join('');
  const res = app.regionLayers.ressources ? layout.places.slice(1).map((p, i) => `<g class="res" transform="translate(${p.x - 40},${p.y + 18})"><circle cx="9" cy="9" r="10"/><g transform="translate(2.5 2.5) scale(.55)">${icon(['wheat', 'tree', 'sack', 'gear'][i % 4]).replace('<svg', '<svg width="24" height="24"')}</g></g>`).join('') : '';
  const layers = Object.entries(REGION_LAYERS).map(([k, l]) => `<label class="check"><input type="checkbox" data-action="region-layer" data-layer="${k}" ${app.regionLayers[k] !== false ? 'checked' : ''}> ${l}</label>`).join('');
  const sel = layout.places.find((p) => p.name === app.locality);
  let detail = '';
  if (sel) {
    const people = representativeSample({ regionId: cid, settlement: KIND_SETTLEMENT[sel.kind], count: 6, seed: `loc:${sel.name}:${app.round}`, oversample: 4 });
    const notables = Object.values(app.world.characters).filter((p) => p.place === sel.name);
    detail = `<div class="panel"><div class="row-between"><div><div class="eyebrow">${FR_KIND[sel.kind]}</div><h2>${esc(sel.name)}</h2><p class="muted">${fmtInt(sel.pop)} habitants</p></div><button class="btn small" type="button" data-action="reroll">D’autres habitants</button></div>
      ${notables.length ? `<h3>Personnages</h3><div class="people-row">${notables.map((p) => `<button type="button" class="mini-person" data-action="go" data-to="personnage" data-char="${p.id}">${portrait(p.appearance, { size: 64, title: p.name })}<b>${esc(p.name)}</b><span>${esc(p.role)}</span></button>`).join('')}</div>` : ''}
      <h3>Habitants</h3><div class="resident-grid">${people.map((p) => `<figure>${portrait(p, { size: 96, title: residentName(p) })}<figcaption><b>${esc(residentName(p))}</b><span>${p.age} ans · ${residentRole(p)}</span></figcaption></figure>`).join('')}</div></div>`;
  }
  return `<section class="page wide">
    <div class="panel region-panel">
      <div class="region-head">${emblem(cid, 40)}<div><h1>${esc(prov.name)}</h1><span class="muted">${c.name}</span></div>
        <select data-action="select-province" aria-label="Province">${CIV_IDS.flatMap((o) => civ(o).provinces.map((p) => `<option value="${o}:${p.id}"${o === cid && p.id === prov.id ? ' selected' : ''}>${civ(o).name} — ${esc(p.name)}</option>`)).join('')}</select></div>
      <div class="region-body">
        <nav class="loc-list" aria-label="Localités">${list}</nav>
        <div class="region-map"><canvas data-paint="regionmap:${cid}:${prov.id}" aria-hidden="true"></canvas>
          <svg class="map-overlay" viewBox="0 0 ${layout.W} ${layout.H}">${res}${labels}<g class="scalebar" transform="translate(30 ${layout.H - 30})"><path d="M0,0 h120 M0,-5 v10 M60,-3 v6 M120,-5 v10"/><text x="0" y="-9">0</text><text x="60" y="-9" text-anchor="middle">10</text><text x="120" y="-9" text-anchor="middle">20 km</text></g></svg>
          <aside class="layers"><div class="eyebrow">Afficher</div>${layers}</aside></div>
      </div>
    </div>
    ${detail}
  </section>`;
}
const FR_KIND = { urban: 'Ville', town: 'Bourg', rural: 'Village', port: 'Port', border: 'Ville frontalière' };

// ---------------------------------------------------------------------------
// 5. Fiche d'un personnage

const CHAR_TABS = { apercu: 'Aperçu', relations: 'Relations', journal: 'Journal', objectifs: 'Objectifs', competences: 'Compétences', inventaire: 'Inventaire', apparence: 'Apparence' };
const ETAT_ICON = { Santé: ['heart', 'var(--red)'], Moral: ['smile', 'var(--gold)'], Finances: ['coin', 'var(--green)'] };

export function viewPersonnage(app) {
  const w = app.world;
  const p = w.characters[app.character] ?? w.characters['mara-venn'];
  const a = p.appearance;
  const tabs = Object.entries(CHAR_TABS).map(([k, l]) => `<button type="button" role="tab" data-action="char-tab" data-tab="${k}" aria-selected="${app.charTab === k}">${l}</button>`).join('');
  const rel = (r) => {
    const o = w.characters[r.id];
    if (!o) return '';
    return `<button type="button" class="rel-person" data-action="go" data-to="personnage" data-char="${o.id}">${portrait(o.appearance, { size: 48, title: o.name })}<span><b>${esc(o.name)}</b><small>${esc(r.kind)}</small><small class="mono">Confiance : ${r.trust}</small></span></button>`;
  };
  let body = '';
  switch (app.charTab) {
    case 'apercu':
      body = `<div class="grid3">
        <div><h3>Traits</h3><ul class="traits">${TRAITS.map((t) => `<li><span>${t}</span>${bar(p.traits[t], { color: 'linear-gradient(90deg,#b4523f,#d9a35a)', label: t })}<span class="mono">${p.traits[t]}</span></li>`).join('')}</ul></div>
        <div><h3>Objectifs</h3><ul class="goals">${p.objectifs.map((o) => `<li>${esc(o.text)}</li>`).join('') || '<li class="muted">Aucun objectif connu.</li>'}</ul>
          ${p.context ? `<h3>Contexte</h3><p class="muted">${esc(p.context)}</p>` : ''}</div>
        <div><h3>Relations clés</h3><div class="rel-list">${p.relations.map(rel).join('') || '<p class="muted">Aucune relation enregistrée.</p>'}</div></div></div>`;
      break;
    case 'relations': {
      const known = Object.values(w.characters).filter((o) => o.id !== p.id && o.civ === p.civ && !p.relations.some((r) => r.id === o.id));
      body = `<h3>Relations</h3><div class="rel-list wide">${p.relations.map(rel).join('')}</div>
        <h3>Autres personnages ${de(civ(p.civ).name)}</h3><div class="people-row">${known.map((o) => `<button type="button" class="mini-person" data-action="go" data-to="personnage" data-char="${o.id}">${portrait(o.appearance, { size: 56, title: o.name })}<b>${esc(o.name)}</b><span>${esc(o.role)}</span></button>`).join('')}</div>`;
      break;
    }
    case 'journal':
      body = `<ol class="journal">${p.journal.map((j) => `<li><span class="mono">${fmtDate(j.day)}</span><p>${esc(j.text)}</p></li>`).join('') || '<li class="muted">Le journal est vide.</li>'}</ol>`;
      break;
    case 'objectifs':
      body = `<ul class="goal-progress">${p.objectifs.map((o) => `<li><span>${esc(o.text)}</span>${bar(o.progress, { label: o.text })}<span class="mono">${o.progress} %</span></li>`).join('') || '<li class="muted">Aucun objectif connu.</li>'}</ul>`;
      break;
    case 'competences':
      body = `<ul class="traits">${Object.entries(p.competences).map(([k, v]) => `<li><span>${k}</span>${bar(v, { label: k })}<span class="mono">${v}</span></li>`).join('')}</ul>`;
      break;
    case 'inventaire':
      body = `<ul class="inventory">${p.inventaire.map((i) => `<li>${icon('sack')}<span>${esc(i)}</span></li>`).join('') || '<li class="muted">Rien de notable.</li>'}</ul>`;
      break;
    case 'apparence': {
      const v = visibleAppearance(a);
      body = `<div class="grid2"><dl class="kv">
        <dt>Peau</dt><dd><i class="dot" style="background:${a.skin.hex}"></i> ${FR.skin[a.skin.category]} · sous-ton ${FR.undertone[a.skin.undertone]} · <span class="mono">${a.skin.tone.toFixed(2)}</span></dd>
        <dt>Cheveux</dt><dd><i class="dot" style="background:${v.hairHex}"></i> ${FR.texture[a.hair.texture]}, ${FR.hairColor[a.hair.color]}${v.grey > 0.15 ? ', grisonnants' : ''}, ${FR.style[v.hairStyle]}</dd>
        <dt>Yeux</dt><dd><i class="dot" style="background:${EYE_COLORS[a.eyes.color]}"></i> ${FR.eyeColor[a.eyes.color]}, ${FR.lid[a.eyes.lid]}</dd>
        <dt>Visage</dt><dd>${FR.face[a.face.shape]}</dd><dt>Silhouette</dt><dd>${FR.build[a.body.build]}, ${a.body.heightCm} cm</dd>
        ${a.parents ? `<dt>Parents</dt><dd>${a.parents.map((id) => esc(w.characters[id]?.name ?? id)).join(' et ')}</dd>` : ''}</dl>
        <div><h3>Description d’identité</h3><p class="muted">Envoyée au modèle d’image avec chaque demande (en anglais).</p><p class="descriptor">${esc(identityRecord(a).descriptor)}</p></div></div>`;
      break;
    }
  }
  const etat = Object.entries(p.etat).map(([k, v]) => `<li><span class="etat-ico" style="color:${ETAT_ICON[k][1]}">${icon(ETAT_ICON[k][0])}</span><span>${k}</span>${bar(v, { color: ETAT_ICON[k][1], label: k })}<span class="mono">${v}</span></li>`).join('');
  const options = Object.values(w.characters).sort((x, y) => x.civ.localeCompare(y.civ)).map((o) => `<option value="${o.id}"${o.id === p.id ? ' selected' : ''}>${esc(o.name)} — ${civ(o.civ).name}</option>`).join('');
  return `<section class="page">
    <div class="panel char-sheet">
      <div class="char-head">${portrait(a, { size: 180, title: p.name, cls: 'char-portrait' })}
        <div class="char-id"><h1>${esc(p.name)}</h1><p>${p.age} ans · ${civ(p.civ).name}</p><p>${esc(p.role)}</p><p class="muted">${esc(p.place)}</p></div>
        <div class="etat"><div class="eyebrow">État actuel</div><ul>${etat}</ul>
          <label class="field char-switch">Changer de personnage<select data-action="select-char">${options}</select></label></div>
      </div>
      <div class="tabs" role="tablist">${tabs}</div><div class="tab-body">${body}</div>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// 6. Événements et décisions

export function viewEvenements(app) {
  const w = app.world;
  const pending = w.pending[0];
  if (pending) {
    return `<section class="page narrow"><article class="panel decision">
      ${sceneFor(app, pending.image, pending.civ, pending.title)}
      <div class="decision-body"><h1>${esc(pending.title)}</h1><p class="muted">${fmtDate(pending.day)}${pending.place ? ` · ${esc(pending.place)}` : ''}</p><p class="lead">${esc(pending.text)}</p>
      <div class="choices">${pending.choices.map((c) => `<button type="button" class="choice" data-action="decide" data-uid="${pending.uid}" data-choice="${c.id}">${icon('arrow')}<span><b>${esc(c.label)}</b><small>${esc(c.hint)}</small></span></button>`).join('')}</div>
      ${w.pending.length > 1 ? `<p class="muted">${w.pending.length - 1} autre(s) décision(s) en attente.</p>` : ''}</div></article></section>`;
  }
  const recent = w.log.filter((e) => (e.civ === w.playerCiv || e.kind === 'choice') && e.image && !e.silent).slice(0, 6);
  return `<section class="page">
    <div class="page-head"><div class="eyebrow">Événements et décisions</div><h1>Aucune décision en attente</h1><p class="muted">Le temps s’arrête dès que votre conseil doit trancher. Reprenez la simulation depuis la barre du haut.</p></div>
    <div class="event-grid">${recent.map((e) => `<article class="panel event-card">${sceneFor(app, e.image, e.civ, e.title ?? e.text)}<div><span class="mono muted">${fmtDate(e.day)}</span><h3>${esc(e.title ?? '')}</h3><p>${esc(e.text)}</p></div></article>`).join('') || '<p class="muted">Pas encore d’événements.</p>'}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// 7. Simulation et temps

const TIME_TABS = { evenements: 'Événements', indicateurs: 'Indicateurs', graphiques: 'Graphiques', chronologie: 'Chronologie' };

export function viewTemps(app) {
  const w = app.world;
  const tabs = Object.entries(TIME_TABS).map(([k, l]) => `<button type="button" role="tab" data-action="time-tab" data-tab="${k}" aria-selected="${app.timeTab === k}">${l}</button>`).join('');
  const feed = w.log.filter((e) => !e.silent && (e.civ === w.playerCiv || ['choice', 'decision'].includes(e.kind) || e.kind === 'event'));
  let body = '';
  if (app.timeTab === 'evenements') {
    body = `<ul class="log">${feed.slice(0, 40).map((e) => `<li class="k-${e.kind}"><span class="mono">${fmtDate(e.day, { year: false })}</span>${e.civ !== w.playerCiv ? `<span class="civ-dot" style="background:${civ(e.civ).color}" title="${civ(e.civ).name}"></span>` : ''}<span>${esc(e.text)}</span></li>`).join('')}</ul>`;
  } else if (app.timeTab === 'indicateurs') {
    body = `<div class="table-wrap"><table class="data"><thead><tr><th>Civilisation</th><th>Population (M)</th><th>Prix du grain</th><th>Réserves (mois)</th><th>Stabilité</th><th>Tensions</th><th>Armée</th></tr></thead><tbody>${CIV_IDS.map((id) => {
      const s = w.civs[id];
      return `<tr${id === w.playerCiv ? ' class="me"' : ''}><th>${civ(id).name}</th><td>${fmtNum(s.population, 2)}</td><td>${Math.round(s.price)} ${delta(trend(w, id, 'price'), { invert: true })}</td><td>${fmtNum(s.reserves)}</td><td>${Math.round(s.stability)}</td><td>${Math.round(s.tension)}</td><td>${Math.round(s.military)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  } else if (app.timeTab === 'graphiques') {
    const metric = (key, label) => `<div><h3>${label}</h3>${lineChart(CIV_IDS.map((id) => ({ points: w.history[id].map((h) => [h.day, h[key]]).concat([[w.day, w.civs[id][key]]]), color: civ(id).color })), { height: 180, label })}</div>`;
    body = `<div class="legend-row">${CIV_IDS.map((id) => `<span><i style="background:${civ(id).color}"></i>${civ(id).name}</span>`).join('')}</div><div class="grid2">${metric('price', 'Prix du grain')}${metric('stability', 'Stabilité')}${metric('reserves', 'Réserves (mois)')}${metric('tension', 'Tensions sociales')}</div>`;
  } else {
    const items = [...w.log.filter((e) => ['choice', 'harvest'].includes(e.kind) || (e.kind === 'event' && e.civ === w.playerCiv)).slice(0, 30)];
    body = `<ol class="timeline">${items.map((e) => `<li><span class="mono">${fmtDate(e.day)}</span><span>${esc(e.text)}</span></li>`).join('')}${PREHISTORY.slice().reverse().map((p) => `<li class="past"><span class="mono">${p.year}</span><span>${esc(p.text)}</span></li>`).join('')}</ol>`;
  }
  const latest = feed.find((e) => e.image);
  return `<section class="page">
    <div class="panel time-panel">
      <div class="time-head"><h1>${fmtMonth(w.day)}</h1>${timeControls(app)}<button type="button" class="btn" data-action="skip">${icon('skip')} Sauter une période</button></div>
      <div class="time-body"><div><div class="tabs" role="tablist">${tabs}</div><div class="tab-body">${body}</div></div>
        ${latest ? `<figure class="latest">${sceneFor(app, latest.image, latest.civ, latest.title ?? latest.text)}<figcaption>${esc(latest.text)}</figcaption></figure>` : ''}</div>
    </div>
  </section>`;
}

export function timeControls(app) {
  const speeds = [1, 7, 30, 365].map((s) => `<button type="button" data-action="speed" data-speed="${s}" aria-pressed="${app.speed === s}">x${s}</button>`).join('');
  return `<div class="time-ctl" role="group" aria-label="Vitesse du temps"><button type="button" class="tc-btn" data-action="pause" aria-pressed="${!app.playing}" aria-label="Pause">${icon('pause')}</button><button type="button" class="tc-btn play" data-action="play" aria-pressed="${app.playing}" aria-label="Lecture">${icon('play')}</button><span class="speeds">${speeds}</span></div>`;
}

// ---------------------------------------------------------------------------
// 8. Tableaux et analyses

const ANA = {
  population: { label: 'Population', main: ['population', 'Population (millions)', (v) => fmtNum(v, 1)], ind: [['population', 'Population', 'people', (v) => `${fmtNum(v, 2)} M`], ['health', 'Santé publique', 'heart', (v) => `${Math.round(v)} / 100`]] },
  economie: { label: 'Économie', main: ['price', 'Prix du grain', (v) => Math.round(v)], ind: [['prod', 'Production de grain', 'wheat', null], ['price', 'Prix moyen', 'coin', null], ['reserves', 'Réserves alimentaires', 'sack', (v) => `${fmtNum(v)} mois`], ['stability', 'Stabilité politique', 'shield', (v) => `${Math.round(v)} / 100`]] },
  politique: { label: 'Politique', main: ['stability', 'Stabilité politique', (v) => Math.round(v)], ind: [['stability', 'Stabilité', 'shield', (v) => `${Math.round(v)} / 100`], ['tension', 'Tensions sociales', 'bolt', (v) => `${Math.round(v)} / 100`], ['treasury', 'Trésor', 'coin', (v) => Math.round(v)]] },
  societe: { label: 'Société', main: ['tension', 'Tensions sociales', (v) => Math.round(v)], ind: [['tension', 'Tensions sociales', 'bolt', (v) => `${Math.round(v)} / 100`], ['health', 'Santé publique', 'heart', (v) => `${Math.round(v)} / 100`], ['price', 'Prix du pain', 'wheat', (v) => Math.round(v)]] },
  militaire: { label: 'Militaire', main: ['military', 'Puissance militaire', (v) => Math.round(v)], ind: [['military', 'Puissance militaire', 'shield', (v) => `${Math.round(v)} / 100`], ['treasury', 'Trésor', 'coin', (v) => Math.round(v)]] },
  relations: { label: 'Relations' },
};

export function viewAnalyses(app) {
  const w = app.world;
  const id = app.anaCiv;
  const t = ANA[app.anaTab];
  const tabs = Object.entries(ANA).map(([k, v]) => `<button type="button" role="tab" data-action="ana-tab" data-tab="${k}" aria-selected="${app.anaTab === k}">${v.label}</button>`).join('');
  const hist = w.history[id];
  let chart, ind;
  if (app.anaTab === 'relations') {
    chart = `<h2>Relations de ${civ(id).name}</h2>${lineChart(CIV_IDS.filter((o) => o !== id).map((o) => ({ points: hist.map((h) => [h.day, h.relations[o]]).concat([[w.day, w.relations[id][o]]]), color: civ(o).color })), { height: 260, yMin: -100, yMax: 100, label: 'Relations' })}
      <div class="legend-row">${CIV_IDS.filter((o) => o !== id).map((o) => `<span><i style="background:${civ(o).color}"></i>${civ(o).name}</span>`).join('')}</div>`;
    ind = CIV_IDS.filter((o) => o !== id).map((o) => `<li>${emblem(o, 22)}<span>${civ(o).name}</span><b class="mono">${Math.round(w.relations[id][o])}</b></li>`).join('');
  } else {
    const [key, label, fmt] = t.main;
    chart = `<h2>${label} (${civ(id).name})</h2>${lineChart([{ points: hist.map((h) => [h.day, h[key]]).concat([[w.day, w.civs[id][key]]]), color: 'var(--gold)', area: true }], { height: 260, yFmt: fmt, label })}`;
    ind = t.ind.map(([k, l, ic, f]) => {
      const v = w.civs[id][k];
      const shown = k === 'prod' ? delta(v - 100) : k === 'price' && !f ? delta(v - 100, { invert: true }) : `<b class="mono">${f(v)}</b>`;
      return `<li><span class="ind-ico">${icon(ic)}</span><span>${l}</span>${shown}</li>`;
    }).join('');
  }
  return `<section class="page">
    <div class="panel"><div class="row-between"><div class="tabs" role="tablist">${tabs}</div><select data-action="ana-civ" aria-label="Civilisation">${CIV_IDS.map((o) => `<option value="${o}"${o === id ? ' selected' : ''}>${civ(o).name}</option>`).join('')}</select></div>
      <div class="ana-body"><div>${chart}</div><div><h2>Indicateurs clés</h2><ul class="indicators">${ind}</ul><p class="muted small-print">Production comparée à une année normale ; prix comparé à la moyenne de 1919 (indice 100).</p></div></div></div>
  </section>`;
}

// ---------------------------------------------------------------------------
// 9. Mode explorateur / historien

const EXP_TABS = { chronologie: 'Chronologie', personnages: 'Personnages', lieux: 'Lieux', documents: 'Documents', scenarios: 'Scénarios alternatifs' };

function documents(w) {
  const docs = w.log.filter((e) => e.kind === 'choice').map((e) => ({
    title: `Arrêté du conseil ${de(civ(e.civ).name)}`,
    date: fmtDate(e.day),
    body: `Le conseil, réuni à ${e.place ?? civ(e.civ).capital} au sujet de « ${e.title} », arrête : ${e.text.replace(/^Décision : /, '')}`,
  }));
  docs.push({ title: 'Traité de Lumen', date: '11 novembre 1918', body: 'Les plénipotentiaires de l’Empire de Veyra et de la Ligue de Thélis conviennent de la cessation des hostilités. Les frontières de 1914 sont rétablies ; une commission mixte réglera les dommages de guerre.' });
  docs.push({ title: 'Rapport sur les réformes agricoles d’Orane', date: '1910', body: 'Le partage des communaux et la création de coopératives de semences doivent porter les rendements de la province de Valmont au premier rang d’Iskar. Le rapport met en garde contre la dépendance aux acheteurs étrangers.' });
  return docs;
}

export function viewExplorateur(app) {
  const w = app.world;
  const tabs = Object.entries(EXP_TABS).map(([k, l]) => `<button type="button" role="tab" data-action="exp-tab" data-tab="${k}" aria-selected="${app.expTab === k}">${l}</button>`).join('');
  let body = '';
  if (app.expTab === 'chronologie') {
    const items = [...PREHISTORY.map((p) => ({ when: p.year, text: p.text, civ: p.civ })), ...w.log.filter((e) => ['choice', 'event', 'harvest'].includes(e.kind) && !e.silent).slice().reverse().map((e) => ({ when: fmtDate(e.day), text: e.text, civ: e.civ }))];
    body = `<ol class="timeline vertical">${items.map((x) => `<li><span class="civ-dot" style="background:${civ(x.civ).color}"></span><span class="mono">${x.when}</span><span>${esc(x.text)}</span></li>`).join('')}</ol>`;
  } else if (app.expTab === 'personnages') {
    body = `<div class="people-grid">${Object.values(w.characters).map((p) => `<button type="button" class="person-card" data-action="go" data-to="personnage" data-char="${p.id}">${portrait(p.appearance, { size: 120, title: p.name })}<b>${esc(p.name)}</b><span>${esc(p.role)}</span><small>${civ(p.civ).name} · ${p.age} ans</small></button>`).join('')}</div>`;
  } else if (app.expTab === 'lieux') {
    body = `<div class="places">${CIV_IDS.map((id) => `<div><h3>${emblem(id, 22)} ${civ(id).name}</h3><ul>${civ(id).provinces.map((p) => `<li><button type="button" class="link" data-action="go" data-to="region" data-civ="${id}" data-prov="${p.id}">${esc(p.name)}</button><small class="muted"> · ${p.localities.map((l) => l[0]).join(', ')}</small></li>`).join('')}</ul></div>`).join('')}</div>`;
  } else if (app.expTab === 'documents') {
    body = `<div class="docs">${documents(w).map((d) => `<article class="doc"><h3>${esc(d.title)}</h3><span class="mono">${esc(d.date)}</span><p>${esc(d.body)}</p></article>`).join('')}</div>`;
  } else {
    body = `<div class="alt-grid">${Object.entries(SCENARIOS).filter(([, s]) => s.alternative).map(([id, s]) => `<article class="alt">
      <div class="alt-img">${renderScene(representativeSample({ regionId: s.civ, settlement: 'urban', count: 6, seed: `alt:${id}`, oversample: 3 }), { setting: id === 'guerre-continue' ? 'plaza' : 'council', title: s.title })}</div>
      <div><b>Et si…</b><p>${esc(s.title.replace(/^Et si /, '').replace(/^./, (c) => c.toUpperCase()))}</p><p class="muted">${esc(s.summary)}</p><button class="btn gold" type="button" data-action="launch-scenario" data-scenario="${id}">Lancer ce scénario</button></div></article>`).join('')}</div>`;
  }
  return `<section class="page"><div class="panel"><div class="page-head"><div class="eyebrow">Mode explorateur</div><h1>Archives d’Iskar</h1><p class="muted">Consulter l’histoire, comparer des scénarios, explorer des récits.</p></div><div class="tabs" role="tablist">${tabs}</div><div class="tab-body">${body}</div></div></section>`;
}
