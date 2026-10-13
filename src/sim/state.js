// Helpers that mutate world state; shared by the engine and the event catalogue.

import { Rng, clamp } from '../appearance/rng.js';

export function rngOf(world) {
  const r = new Rng(world.rng);
  return { r, save: () => { world.rng = r.state; } };
}

export function adjust(world, civ, changes) {
  const c = world.civs[civ];
  for (const [k, v] of Object.entries(changes)) {
    if (k === 'priceMul') c.price *= v;
    else c[k] += v;
  }
  clampCiv(c);
}

export function adjustRelation(world, a, b, delta) {
  world.relations[a][b] = clamp(world.relations[a][b] + delta, -100, 100);
  world.relations[b][a] = clamp(world.relations[b][a] + delta, -100, 100);
}

export function clampCiv(c) {
  c.reserves = Math.max(0, c.reserves);
  c.price = clamp(c.price, 40, 400);
  for (const k of ['stability', 'tension', 'military', 'health']) c[k] = clamp(c[k], 0, 100);
  c.exports = clamp(c.exports, 0, 1);
}

export function addLog(world, entry) {
  const e = { uid: world.nextUid++, day: world.day, kind: 'info', ...entry };
  world.log.unshift(e);
  if (world.log.length > 400) world.log.length = 400;
  return e;
}

export function schedule(world, inDays, template, civ, params = {}) {
  world.scheduled.push({ day: world.day + inDays, template, civ, params });
}
