import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWorld, advance, decide, serialize, deserialize, fmtDate, dayOf, SCENARIOS } from '../src/sim/engine.js';
import { appearanceDistance } from '../src/appearance/generator.js';
import { CIV_IDS } from '../src/world/civilizations.js';

test('the grain crisis reaches the council on 15 March 1920', () => {
  const w = createWorld({ seed: 't1' });
  assert.equal(fmtDate(w.day), '1er mars 1920');
  advance(w, 60);
  assert.equal(fmtDate(w.day), '15 mars 1920');
  assert.equal(w.pending[0].title, 'Crise du grain à Orane');
  assert.deepEqual(w.pending[0].choices.map((c) => c.id), ['exporter', 'restreindre', 'negocier']);
  assert.equal(advance(w, 10), 0, 'time stops while a decision is pending');
});

test('simulation is deterministic for a seed', () => {
  const run = () => {
    const w = createWorld({ seed: 'det' });
    for (let i = 0; i < 6; i++) {
      advance(w, 120);
      while (w.pending.length) decide(w, w.pending[0].uid, w.pending[0].choices[0].id);
    }
    return w;
  };
  assert.equal(serialize(run()), serialize(run()));
});

test('decisions have different consequences', () => {
  const outcome = (choice) => {
    const w = createWorld({ seed: 'choice' });
    advance(w, 60);
    decide(w, w.pending[0].uid, choice);
    return w;
  };
  const exp = outcome('exporter');
  const ban = outcome('restreindre');
  assert.ok(exp.civs.orane.treasury > ban.civs.orane.treasury);
  assert.ok(ban.civs.orane.reserves > exp.civs.orane.reserves);
  assert.ok(exp.relations.orane.veyra > ban.relations.orane.veyra);
  assert.ok(exp.characters['mara-venn'].journal[0].text !== ban.characters['mara-venn'].journal[0].text);
});

test('a saved game continues exactly as the original', () => {
  const a = createWorld({ seed: 'save' });
  advance(a, 60);
  decide(a, a.pending[0].uid, 'negocier');
  const b = deserialize(serialize(a));
  advance(a, 200);
  advance(b, 200);
  assert.equal(serialize(a), serialize(b));
});

test('alternative scenarios change the starting world', () => {
  const ban = createWorld({ seed: 's', scenario: 'interdiction-export' });
  assert.ok(ban.flags.exportBan);
  advance(ban, 60);
  assert.notEqual(ban.pending[0]?.title, 'Crise du grain à Orane');
  const war = createWorld({ seed: 's', scenario: 'guerre-continue' });
  assert.equal(war.playerCiv, 'thelis');
  assert.ok(war.relations.veyra.thelis < -50);
  assert.equal(Object.keys(SCENARIOS).length, 4);
});

test('every civilization keeps a history and stays within bounds over ten years', () => {
  const w = createWorld({ seed: 'long' });
  while (w.day < dayOf(1930, 0, 1)) {
    advance(w, 365);
    while (w.pending.length) decide(w, w.pending[0].uid, w.pending[0].choices.at(-1).id);
  }
  for (const id of CIV_IDS) {
    const c = w.civs[id];
    assert.ok(w.history[id].length >= 120);
    for (const k of ['stability', 'tension', 'military', 'health']) assert.ok(c[k] >= 0 && c[k] <= 100, `${id}.${k}`);
    assert.ok(c.reserves >= 0 && c.population > 0);
  }
});

test('Mara Venn is her parents’ child, with her own personality', () => {
  const w = createWorld({ seed: 'mara' });
  const { 'mara-venn': mara, 'helene-venn': mother, 'armand-venn': father } = w.characters;
  assert.deepEqual(mara.appearance.parents, ['helene-venn', 'armand-venn']);
  const lo = Math.min(mother.appearance.skin.tone, father.appearance.skin.tone) - 0.15;
  const hi = Math.max(mother.appearance.skin.tone, father.appearance.skin.tone) + 0.15;
  assert.ok(mara.appearance.skin.tone >= lo && mara.appearance.skin.tone <= hi);
  assert.ok(appearanceDistance(mara.appearance, mother.appearance) > 0.1);
  assert.equal(mara.traits.Ambition, 74);
});
