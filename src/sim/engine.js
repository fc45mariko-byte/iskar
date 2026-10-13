// Moteur de simulation d'Iskar.
//
// One tick = one day. The world is a plain JSON-serializable object; event
// logic lives in events.js and is looked up by template id, so saves contain
// only data. All randomness comes from the world's own seeded RNG state.

import { Rng, clamp } from '../appearance/rng.js';
import { CIVILIZATIONS, CIV_IDS } from '../world/civilizations.js';
import { dateOf, dayOf, fmtDate, fmtMonth } from './calendar.js';
import { rngOf, adjust, adjustRelation, addLog, schedule, clampCiv } from './state.js';
import { TEMPLATES, SCRIPTED, RANDOM_TEMPLATES } from './events.js';

export { dateOf, dayOf, fmtDate, fmtMonth, rngOf, adjust, adjustRelation, addLog, schedule };
import { createCharacters, monthlyCharacterUpdate } from './characters.js';

export const SAVE_VERSION = 1;
// ---------------------------------------------------------------------------
// Initial indicators (1 January 1920)

const INITIAL = {
  //        reserves  price  prod  stab  tension  treasury  military  health  exports
  nyrad: [3.2, 108, 96, 71, 30, 128, 44, 74, 0.3],
  veyra: [1.9, 121, 92, 58, 52, 141, 82, 66, 0.0],
  orane: [3.9, 100, 74, 66, 36, 92, 48, 70, 0.55],
  thelis: [2.6, 114, 97, 66, 33, 118, 40, 77, 0.1],
  sahel: [3.6, 104, 88, 64, 29, 64, 38, 61, 0.2],
  kaelen: [3.9, 101, 101, 69, 27, 86, 51, 72, 0.1],
};

// Monthly net drain on grain reserves (months of consumption per month).
const DRAIN = { nyrad: 0.22, veyra: 0.3, orane: 0.24, thelis: 0.26, sahel: 0.2, kaelen: 0.18 };

function initialRelations() {
  const rel = {};
  for (const a of CIV_IDS) {
    rel[a] = {};
    for (const b of CIV_IDS) if (a !== b) rel[a][b] = CIVILIZATIONS[a].tradePartners[b] ? 20 + CIVILIZATIONS[a].tradePartners[b] * 8 : 5;
  }
  rel.orane.veyra = rel.veyra.orane = 12;
  rel.veyra.thelis = rel.thelis.veyra = -35; // the Great War ended in 1918
  return rel;
}

export const SCENARIOS = {
  'crise-du-grain': {
    title: 'La crise du grain',
    civ: 'orane',
    summary: 'Orane, 1920. Une mauvaise récolte fait flamber le prix du grain ; Veyra veut acheter les réserves du royaume.',
  },
  'interdiction-export': {
    title: 'Et si Orane avait imposé une interdiction totale d’exportation ?',
    civ: 'orane',
    alternative: true,
    summary: 'Le conseil d’Orane ferme ses frontières au grain dès le 1er mars 1920. Veyra le prend comme une provocation.',
  },
  'guerre-continue': {
    title: 'Et si la Grande Guerre n’avait pas pris fin en 1918 ?',
    civ: 'thelis',
    alternative: true,
    summary: 'Veyra et la Ligue de Thélis sont toujours en guerre en 1920. Les cités doivent se nourrir et se défendre.',
  },
  'revolution-veyra': {
    title: 'Et si les ouvriers de Veyra s’étaient soulevés en 1919 ?',
    civ: 'veyra',
    alternative: true,
    summary: 'Un comité ouvrier tient Cendreval ; l’empire vacille et ses voisins hésitent.',
  },
};

/** Create a new world. Runs January and February 1920 silently so charts have history. */
export function createWorld({ seed = 'iskar', playerCiv, scenario = 'crise-du-grain' } = {}) {
  const sc = SCENARIOS[scenario] ?? SCENARIOS['crise-du-grain'];
  const world = {
    version: SAVE_VERSION,
    seed,
    scenario,
    playerCiv: playerCiv ?? sc.civ,
    day: 0,
    startDay: dayOf(1920, 2, 1),
    rng: new Rng(`${seed}::world`).state,
    civs: {},
    relations: initialRelations(),
    history: {},
    log: [],
    pending: [],
    scheduled: [],
    fired: {},
    cooldown: {},
    flags: {},
    nextUid: 1,
    characters: {},
  };
  for (const id of CIV_IDS) {
    const [reserves, price, prod, stability, tension, treasury, military, health, exports] = INITIAL[id];
    world.civs[id] = { population: CIVILIZATIONS[id].population, reserves, price, prod, stability, tension, treasury, military, health, exports, gdp: 100 };
    world.history[id] = [];
  }
  createCharacters(world);
  applyScenario(world, scenario);
  snapshot(world);
  while (world.day < world.startDay) tick(world, { silent: true });
  return world;
}

function applyScenario(world, scenario) {
  if (scenario === 'interdiction-export') {
    world.flags.exportBan = true;
    world.civs.orane.exports = 0;
    world.scheduled.push({ day: dayOf(1920, 2, 1), template: 'note', civ: 'orane', params: { text: 'Le conseil d’Orane interdit toute exportation de grain.' } });
    world.relations.orane.veyra = world.relations.veyra.orane = -15;
  }
  if (scenario === 'guerre-continue') {
    world.flags.war = ['veyra', 'thelis'];
    world.relations.veyra.thelis = world.relations.thelis.veyra = -90;
    Object.assign(world.civs.thelis, { military: 70, stability: 52, tension: 55, reserves: 1.8 });
    Object.assign(world.civs.veyra, { military: 92, tension: 62 });
  }
  if (scenario === 'revolution-veyra') {
    world.flags.revolution = true;
    Object.assign(world.civs.veyra, { stability: 31, tension: 84, military: 60 });
  }
}

// ---------------------------------------------------------------------------
// Daily dynamics

function dynamics(world, r) {
  const { m, d } = dateOf(world.day);
  for (const id of CIV_IDS) {
    const c = world.civs[id];
    const war = world.flags.war?.includes(id);
    // Grain: net consumption, exports, harvest.
    c.reserves -= (DRAIN[id] + c.exports * 0.26 + (war ? 0.12 : 0)) / 30;
    // Emergency imports when granaries run low, paid from the treasury.
    if (c.reserves < 0.8 && c.treasury > 20) {
      c.reserves += 0.35 / 30;
      c.treasury -= 0.12;
    }
    if (id === 'veyra' || id === 'thelis') c.reserves += Math.min(0.6, world.civs.orane.exports * 0.25 + world.civs.nyrad.exports * 0.2) / 30;
    if (m === 7 && d === 20) {
      const harvest = (id === 'orane' ? 6.6 : DRAIN[id] * 12.5) * (c.prod / 100);
      c.reserves += harvest;
      const nextProd = clamp(r.normal(100, 11) + (id === 'sahel' ? -4 : 0), 60, 130);
      const change = Math.round(c.prod - 100);
      addLog(world, { civ: id, kind: 'harvest', text: `Moisson ${dateOf(world.day).y} ${id === 'sahel' ? 'au' : 'en'} ${CIVILIZATIONS[id].name} : récolte ${change >= 0 ? 'supérieure' : 'inférieure'} de ${Math.abs(change)} % à la normale.`, silent: id !== world.playerCiv });
      c.prod = nextProd;
    }
    c.reserves = Math.max(0, c.reserves);
    // Price follows scarcity and export pull.
    const scarcity = Math.max(0, 3.6 - c.reserves) / 3.6;
    const target = 100 * (1 + 0.85 * scarcity ** 1.3 + (c.reserves < 3 ? 0.22 * c.exports : 0) + (war ? 0.15 : 0));
    c.price += (target - c.price) * 0.035 + r.normal(0, 0.5);
    // Society.
    const tensionTarget = 22 + (c.price - 100) * 0.42 + (100 - c.health) * 0.15 + (war ? 15 : 0) + (world.flags.revolution && id === 'veyra' ? 25 : 0);
    c.tension += (tensionTarget - c.tension) * 0.025 + r.normal(0, 0.3);
    const stabTarget = CIVILIZATIONS[id].stabilite + 14 - c.tension * 0.38 + (c.treasury - 100) * 0.05;
    c.stability += (stabTarget - c.stability) * 0.012 + r.normal(0, 0.22);
    c.health += ((c.reserves < 0.8 ? 52 : 74) - c.health) * 0.01;
    c.treasury += (c.exports * 0.09 - 0.025 - (war ? 0.08 : 0)) + r.normal(0, 0.02);
    c.military += ((war ? 85 : 50) - c.military) * 0.004;
    c.gdp *= 1 + (0.02 - (c.tension > 60 ? 0.03 : 0) - (war ? 0.04 : 0)) / 365;
    c.population *= 1 + ((c.reserves < 0.4 ? -0.02 : 0.009) / 365);
    clampCiv(c);
  }
  // Relations relax slowly toward their long-run level.
  for (const a of CIV_IDS) for (const b of CIV_IDS) if (a < b) {
    const base = initialRelations()[a][b];
    const nv = world.relations[a][b] + (base - world.relations[a][b]) * 0.002;
    world.relations[a][b] = world.relations[b][a] = nv;
  }
}

function snapshot(world) {
  for (const id of CIV_IDS) {
    const c = world.civs[id];
    world.history[id].push({
      day: world.day,
      population: c.population, reserves: c.reserves, price: c.price, prod: c.prod, stability: c.stability, tension: c.tension,
      treasury: c.treasury, military: c.military, health: c.health, gdp: c.gdp, exports: c.exports,
      relations: { ...world.relations[id] },
    });
  }
}

// ---------------------------------------------------------------------------
// Events

export function fire(world, templateId, civ, params = {}) {
  const t = TEMPLATES[templateId];
  if (!t) throw new Error(`Unknown event template ${templateId}`);
  const ctx = { world, civ, params };
  const isPlayer = civ === world.playerCiv;
  const base = {
    template: templateId,
    civ,
    title: typeof t.title === 'function' ? t.title(ctx) : t.title,
    text: typeof t.text === 'function' ? t.text(ctx) : t.text,
    place: params.place ?? t.place?.(ctx) ?? CIVILIZATIONS[civ].capital,
    image: t.image ? { ...t.image, seed: `${world.seed}:${templateId}:${world.day}` } : null,
    params,
  };
  t.effects?.(ctx);
  if (t.choices && isPlayer && !world.headless) {
    const inst = { uid: world.nextUid++, day: world.day, ...base, choices: t.choices.map(({ id, label, hint }) => ({ id, label, hint })) };
    world.pending.push(inst);
    addLog(world, { civ, kind: 'decision', text: `${base.title} : le conseil doit décider.`, event: inst.uid, image: base.image, place: base.place, title: base.title });
    return inst;
  }
  if (t.choices) {
    // Other governments decide on their own.
    const { r, save } = rngOf(world);
    const choice = t.choices[Math.floor(r.next() * t.choices.length)];
    save();
    choice.apply({ ...ctx, choice });
    return addLog(world, { civ, kind: 'event', title: base.title, text: `${base.title} — ${CIVILIZATIONS[civ].name} choisit : ${choice.label.toLowerCase()}.`, image: base.image, place: base.place });
  }
  return addLog(world, { civ, kind: t.kind ?? 'event', title: base.title, text: base.text, image: base.image, place: base.place });
}

/** Resolve a pending decision. */
export function decide(world, uid, choiceId) {
  const i = world.pending.findIndex((p) => p.uid === uid);
  if (i < 0) throw new Error('No such pending decision');
  const inst = world.pending[i];
  const t = TEMPLATES[inst.template];
  const choice = t.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error('No such choice');
  world.pending.splice(i, 1);
  choice.apply({ world, civ: inst.civ, params: inst.params, choice });
  const entry = addLog(world, { civ: inst.civ, kind: 'choice', title: inst.title, text: `Décision : ${choice.label}. ${choice.outcome ?? ''}`.trim(), image: inst.image, place: inst.place });
  world.fired[`choice:${inst.template}`] = choiceId;
  if (choice.journal) {
    for (const [charId, text] of Object.entries(choice.journal)) {
      world.characters[charId]?.journal.unshift({ day: world.day, text });
    }
  }
  return entry;
}

function runEvents(world, r) {
  // Scripted events (fixed dates, possibly conditional).
  for (const s of SCRIPTED) {
    const key = `scripted:${s.id}`;
    if (world.fired[key] || world.day < s.day) continue;
    if (s.scenarios && !s.scenarios.includes(world.scenario)) { world.fired[key] = 'skip'; continue; }
    if (s.when && !s.when(world)) continue;
    world.fired[key] = true;
    fire(world, s.template, s.civ, s.params ?? {});
  }
  // Scheduled follow-ups.
  const due = world.scheduled.filter((s) => s.day <= world.day);
  world.scheduled = world.scheduled.filter((s) => s.day > world.day);
  for (const s of due) fire(world, s.template, s.civ, s.params);
  // Random and conditional events.
  for (const t of RANDOM_TEMPLATES) {
    for (const civ of CIV_IDS) {
      const key = `${t.id}:${civ}`;
      if ((world.cooldown[key] ?? -1) > world.day) continue;
      const ctx = { world, civ, r };
      if (t.when && !t.when(ctx)) continue;
      if (r.next() >= t.chance(ctx)) continue;
      world.cooldown[key] = world.day + t.cooldown;
      fire(world, t.id, civ, t.params?.(ctx) ?? {});
    }
  }
}

/** Advance one day. */
export function tick(world, { silent = false } = {}) {
  if (world.pending.length && !silent) return false;
  const { r, save } = rngOf(world);
  world.day += 1;
  dynamics(world, r);
  const wasHeadless = world.headless;
  if (silent) world.headless = true;
  runEvents(world, r);
  world.headless = wasHeadless;
  save();
  const { d } = dateOf(world.day);
  if (d === 1 || d === 15) snapshot(world);
  if (d === 1) monthlyCharacterUpdate(world);
  return true;
}

/** Advance up to `days`, stopping early when a decision is pending. */
export function advance(world, days) {
  let n = 0;
  while (n < days && !world.pending.length) {
    tick(world);
    n++;
  }
  return n;
}

export function serialize(world) {
  return JSON.stringify(world);
}
export function deserialize(json) {
  const w = typeof json === 'string' ? JSON.parse(json) : json;
  if (w.version !== SAVE_VERSION) throw new Error('Sauvegarde incompatible');
  return w;
}

/** Indicator change between the latest snapshot and `months` earlier. */
export function trend(world, civ, key, months = 1) {
  const h = world.history[civ];
  if (h.length < 2) return 0;
  const now = world.civs[civ][key];
  const then = h[Math.max(0, h.length - 1 - months)][key];
  return then ? ((now - then) / then) * 100 : 0;
}
