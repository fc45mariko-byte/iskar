import { generateAppearance, representativeSample } from '../src/appearance/generator.js';
import { REGIONS, REGION_IDS, SETTLEMENTS } from '../src/appearance/population.js';
import { SKIN_TONE_CATEGORIES, skinHex, stylesForTexture, EYE_COLORS } from '../src/appearance/traits.js';
import { applyEvent, withAge, visibleAppearance } from '../src/appearance/lifecycle.js';
import { identityRecord } from '../src/appearance/identity.js';
import { generateHousehold } from '../src/appearance/family.js';
import { assignRole, assignRoleFromGroup } from '../src/society/roles.js';
import { personName } from '../src/society/names.js';
import { renderPortrait } from '../src/portrait/svg.js';
import { renderScene } from '../src/portrait/scene.js';

const $ = (id) => document.getElementById(id);
const txt = (s) => String(s).replace(/-/g, ' ');
const state = { region: 'river-delta', settlement: 'port', seed: 'iskar', round: 0, selected: null, partner: 'northern-uplands' };
const people = new Map(); // id -> current appearance (persistent within the session)
const originals = new Map(); // id -> appearance as first generated

function remember(a) {
  if (!people.has(a.id)) {
    people.set(a.id, a);
    originals.set(a.id, a);
  }
  return people.get(a.id);
}

function fillSelect(el, entries, value) {
  el.innerHTML = entries.map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
  el.value = value;
}

function card(a, caption) {
  const name = personName(a.id);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'card';
  btn.dataset.id = a.id;
  btn.setAttribute('aria-pressed', String(state.selected === a.id));
  btn.innerHTML = `${renderPortrait(a, { size: 160, title: name })}<div class="cap"><b>${name}</b>${caption}</div>`;
  btn.addEventListener('click', () => select(a.id));
  return btn;
}

function renderDistribution() {
  const N = 800;
  const counts = Object.fromEntries(SKIN_TONE_CATEGORIES.map((c) => [c.id, 0]));
  for (let i = 0; i < N; i++) {
    counts[generateAppearance({ id: `dist:${state.region}:${state.settlement}:${i}`, regionId: state.region, settlement: state.settlement }).skin.category]++;
  }
  $('dist').innerHTML = SKIN_TONE_CATEGORIES.map((c) => {
    const mid = (c.min + Math.min(c.max, 1)) / 2;
    return `<span title="${c.label}: ${Math.round((counts[c.id] / N) * 100)}%" style="width:${(counts[c.id] / N) * 100}%;background:${skinHex(mid)}"></span>`;
  }).join('');
  $('legend').innerHTML = SKIN_TONE_CATEGORIES.map((c) => `<span><i class="swatch" style="background:${skinHex((c.min + Math.min(c.max, 1)) / 2)}"></i>${c.label} ${Math.round((counts[c.id] / N) * 100)}%</span>`).join('');
}

function renderPopulation() {
  const grid = $('pop-grid');
  grid.innerHTML = '';
  const sample = representativeSample({ regionId: state.region, settlement: state.settlement, count: 12, seed: `${state.seed}:${state.round}` });
  for (const a0 of sample) {
    const a = remember(a0);
    const role = assignRole({ seed: a.id, settlement: state.settlement });
    grid.append(card(a, `${a.age} · ${role.label}`));
  }
  if (!state.selected || !people.has(state.selected)) state.selected = sample[0].id;
}

function renderDossier() {
  const a = people.get(state.selected);
  const v = visibleAppearance(a);
  const name = personName(a.id);
  const role = assignRole({ seed: a.id, settlement: a.context.settlement });
  $('dos-portrait').innerHTML = renderPortrait(a, { size: 260, title: name });
  $('dos-ages').innerHTML = [-15, 0, 25]
    .map((d) => Math.max(8, a.age + d))
    .map((age) => `<figure>${renderPortrait(withAge(a, age), { size: 90, title: `${name} at ${age}` })}<figcaption>age ${age}</figcaption></figure>`)
    .join('');
  const ancestry = Object.entries(a.ancestry).sort((x, y) => y[1] - x[1]).filter(([, w]) => w >= 0.05).map(([k, w]) => `${k} ${Math.round(w * 100)}%`).join(', ');
  const rows = [
    ['Name', name],
    ['Age', a.age],
    ['Occupation', role.label],
    ['Home', `${REGIONS[a.context.regionId].label} · ${SETTLEMENTS[a.context.settlement].label}${a.context.origin !== a.context.regionId ? ` (family from ${REGIONS[a.context.origin].label})` : ''}`],
    ['Skin', `<i class="swatch" style="background:${a.skin.hex}"></i>${SKIN_TONE_CATEGORIES.find((c) => c.id === a.skin.category).label} · ${txt(a.skin.undertone)} undertone · ${a.skin.tone.toFixed(2)}`],
    ['Hair', `<i class="swatch" style="background:${v.hairHex}"></i>${txt(a.hair.texture)}, ${txt(a.hair.color)}${v.grey > 0.15 ? ' (greying)' : ''}, ${txt(v.hairStyle)}`],
    ['Eyes', `<i class="swatch" style="background:${EYE_COLORS[a.eyes.color]}"></i>${txt(a.eyes.color)}, ${a.eyes.lid} lids`],
    ['Face', `${a.face.shape}; nose width ${a.face.noseWidth}, bridge ${a.face.noseBridge}; lips ${a.face.lipFullness}`],
    ['Build', `${a.body.build}, ${a.body.heightCm} cm`],
    ['Ancestry', ancestry],
    ['History', a.events.length ? a.events.map((e) => `${txt(e.type)} at ${e.atAge}`).join('; ') : '—'],
  ];
  $('dos-attrs').innerHTML = rows.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('');
  $('dos-desc').textContent = `Image-model identity: ${identityRecord(a).descriptor}`;
  document.querySelectorAll('.card').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.id === state.selected)));
}

function renderHousehold() {
  const h = generateHousehold({ id: `${state.seed}:hh:${state.region}:${state.partner}:${state.round}`, regionId: state.region, settlement: state.settlement, partnerRegionId: state.partner });
  const grid = $('household');
  grid.innerHTML = '';
  h.members.forEach((m, i) => grid.append(card(remember(m), `${i < 2 ? 'Parent' : 'Child'} · ${m.age}`)));
}

function renderRoles() {
  const groups = [
    ['leaders', 'Leaders & officials'],
    ['merchants', 'Merchants'],
    ['workers', 'Workers'],
    ['soldiers', 'Soldiers'],
    ['scholars', 'Scholars'],
  ];
  const root = $('roles');
  root.innerHTML = '';
  for (const [group, title] of groups) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<h3>${title}</h3>`;
    const grid = document.createElement('div');
    grid.className = 'grid';
    const sample = representativeSample({ regionId: state.region, settlement: 'urban', count: 6, seed: `${state.seed}:${group}:${state.round}`, oversample: 5 });
    for (const a0 of sample) {
      const a = remember(a0);
      grid.append(card(a, assignRoleFromGroup({ seed: a.id, group }).label));
    }
    wrap.append(grid);
    root.append(wrap);
  }
}

function renderEventScene() {
  const setting = state.settlement === 'port' ? 'harbour' : state.settlement === 'rural' ? 'market' : 'plaza';
  const crowd = representativeSample({ regionId: state.region, settlement: state.settlement, count: 11, seed: `${state.seed}:scene:${state.round}`, oversample: 4 }).map(remember);
  const title = `Proclamation in the ${setting} — ${REGIONS[state.region].label}`;
  $('scene-note').textContent = title;
  $('scene').innerHTML = renderScene(crowd, { setting, title });
}

function select(id) {
  state.selected = id;
  renderDossier();
  if (matchMedia('(max-width: 900px)').matches) $('dossier-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAll() {
  renderDistribution();
  renderPopulation();
  renderDossier();
  renderHousehold();
  renderRoles();
  renderEventScene();
}

document.querySelectorAll('[data-event]').forEach((b) => b.addEventListener('click', () => {
  let a = people.get(state.selected);
  const n = a.events.length;
  switch (b.dataset.event) {
    case 'scar': a = applyEvent(a, { type: 'scar', side: n % 2 ? 'right' : 'left', location: ['cheek', 'brow', 'chin'][n % 3] }); break;
    case 'spectacles': a = applyEvent(a, { type: 'spectacles' }); break;
    case 'haircut': {
      const styles = stylesForTexture(a.hair.texture).filter((s) => s !== visibleAppearance(a).hairStyle);
      a = applyEvent(a, { type: 'haircut', style: styles[(n * 7 + a.age) % styles.length] });
      break;
    }
    case 'age': a = withAge(a, a.age + 10); break;
    case 'reset': a = originals.get(a.id); break;
  }
  people.set(a.id, a);
  renderDossier();
  document.querySelectorAll(`.card[data-id="${CSS.escape(a.id)}"] svg`).forEach((svg) => { svg.outerHTML = renderPortrait(a, { size: 160, title: personName(a.id) }); });
}));

fillSelect($('region'), REGION_IDS.map((r) => [r, REGIONS[r].label]), state.region);
fillSelect($('partner'), REGION_IDS.map((r) => [r, REGIONS[r].label]), state.partner);
fillSelect($('settlement'), Object.entries(SETTLEMENTS).map(([k, v]) => [k, v.label]), state.settlement);
$('region').addEventListener('change', (e) => { state.region = e.target.value; state.selected = null; renderAll(); });
$('settlement').addEventListener('change', (e) => { state.settlement = e.target.value; state.selected = null; renderAll(); });
$('partner').addEventListener('change', (e) => { state.partner = e.target.value; renderHousehold(); });
$('seed').addEventListener('change', (e) => { state.seed = e.target.value || 'iskar'; state.selected = null; renderAll(); });
$('reroll').addEventListener('click', () => { state.round++; state.selected = null; renderAll(); });

renderAll();
