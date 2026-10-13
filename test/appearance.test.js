import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateAppearance, representativeSample, appearanceDistance } from '../src/appearance/generator.js';
import { REGION_IDS, SETTLEMENTS } from '../src/appearance/population.js';
import { SKIN_TONE_CATEGORIES, HAIR_TEXTURES, skinHex, relativeLuminance, hexToRgb } from '../src/appearance/traits.js';
import { applyEvent, withAge, visibleAppearance } from '../src/appearance/lifecycle.js';
import { identityRecord, portraitRequest, describeAppearance } from '../src/appearance/identity.js';
import { generateHousehold } from '../src/appearance/family.js';
import { assignRole, ROLE_GROUPS } from '../src/society/roles.js';
import { CIVILIZATIONS, CIV_IDS } from '../src/world/civilizations.js';
import { renderPortrait, featurePalette } from '../src/portrait/svg.js';

const sample = (regionId, settlement, n, tag = 't') =>
  Array.from({ length: n }, (_, i) => generateAppearance({ id: `${tag}:${regionId}:${settlement}:${i}`, regionId, settlement }));

const stats = (people) => {
  const tones = people.map((p) => p.skin.tone);
  const mean = tones.reduce((a, b) => a + b, 0) / tones.length;
  const sd = Math.sqrt(tones.reduce((a, t) => a + (t - mean) ** 2, 0) / tones.length);
  const share = Object.fromEntries(SKIN_TONE_CATEGORIES.map((c) => [c.id, people.filter((p) => p.skin.category === c.id).length / people.length]));
  return { mean, sd, share };
};

test('appearance is deterministic per character id', () => {
  const a = generateAppearance({ id: 'char-42', regionId: 'orane', settlement: 'urban' });
  const b = generateAppearance({ id: 'char-42', regionId: 'orane', settlement: 'urban' });
  assert.deepEqual(a, b);
  assert.equal(renderPortrait(a), renderPortrait(b));
});

test('appearance generation refuses social/behavioural inputs', () => {
  for (const key of ['occupation', 'socialClass', 'personality', 'politics', 'wealth', 'role']) {
    assert.throws(() => generateAppearance({ id: 'x', regionId: 'orane', [key]: 'anything' }), /not an appearance input/);
  }
});

test('every region and settlement type contains the full light-to-dark range', () => {
  for (const regionId of REGION_IDS) {
    for (const settlement of Object.keys(SETTLEMENTS)) {
      const { sd, share } = stats(sample(regionId, settlement, 2500));
      for (const c of SKIN_TONE_CATEGORIES) {
        assert.ok(share[c.id] >= 0.004, `${regionId}/${settlement}: category ${c.id} missing (${share[c.id]})`);
      }
      assert.ok(sd >= 0.15, `${regionId}/${settlement}: tone sd too narrow (${sd.toFixed(3)})`);
      const top = Math.max(...Object.values(share));
      assert.ok(top <= 0.5, `${regionId}/${settlement}: one category dominates (${top.toFixed(2)})`);
    }
  }
});

test('regional distributions differ according to history, without uniform colours', () => {
  const means = REGION_IDS.map((r) => stats(sample(r, 'rural', 1500)).mean);
  assert.ok(Math.max(...means) - Math.min(...means) > 0.2, 'regions should differ in distribution');
});

test('port cities and cities are more varied than rural areas', () => {
  for (const regionId of REGION_IDS) {
    const rural = stats(sample(regionId, 'rural', 2500)).sd;
    const port = stats(sample(regionId, 'port', 2500)).sd;
    assert.ok(port > rural, `${regionId}: port sd ${port.toFixed(3)} <= rural ${rural.toFixed(3)}`);
  }
});

test('skin tone is independent of occupation in every role group', () => {
  const people = [];
  for (const regionId of REGION_IDS) {
    for (const settlement of ['rural', 'urban', 'port']) {
      for (let i = 0; i < 700; i++) {
        const id = `ind:${regionId}:${settlement}:${i}`;
        people.push({ a: generateAppearance({ id, regionId, settlement }), role: assignRole({ seed: id, settlement }).occupation });
      }
    }
  }
  const darkShare = (ps) => ps.filter((p) => p.a.skin.tone >= 0.58).length / ps.length;
  const lightShare = (ps) => ps.filter((p) => p.a.skin.tone < 0.28).length / ps.length;
  const overallDark = darkShare(people);
  const overallLight = lightShare(people);
  for (const [group, occs] of Object.entries(ROLE_GROUPS)) {
    const members = people.filter((p) => occs.includes(p.role));
    if (members.length < 250) continue;
    assert.ok(Math.abs(darkShare(members) - overallDark) < 0.08, `${group}: dark share ${darkShare(members).toFixed(2)} vs ${overallDark.toFixed(2)}`);
    assert.ok(Math.abs(lightShare(members) - overallLight) < 0.08, `${group}: light share ${lightShare(members).toFixed(2)} vs ${overallLight.toFixed(2)}`);
  }
});

test('broad variety of hair, eyes and features', () => {
  const people = REGION_IDS.flatMap((r) => sample(r, 'urban', 120, 'var'));
  const distinct = (fn) => new Set(people.map(fn)).size;
  assert.equal(distinct((p) => p.hair.texture), HAIR_TEXTURES.length);
  assert.ok(distinct((p) => p.hair.color) >= 7);
  assert.ok(distinct((p) => p.eyes.color) >= 6);
  assert.ok(distinct((p) => p.hair.style) >= 10);
  assert.ok(distinct((p) => p.face.shape) === 6);
  assert.ok(distinct((p) => p.skin.undertone) === 5);
});

test('population previews are representative and visually distinct', () => {
  for (const regionId of REGION_IDS) {
    const preview = representativeSample({ regionId, settlement: 'urban', count: 12, seed: 'test' });
    assert.equal(preview.length, 12);
    const tones = preview.map((p) => p.skin.tone);
    assert.ok(Math.max(...tones) - Math.min(...tones) >= 0.4, `${regionId}: preview range too narrow`);
    for (let i = 0; i < preview.length; i++) {
      for (let j = i + 1; j < preview.length; j++) {
        assert.ok(appearanceDistance(preview[i], preview[j]) > 0.35, `${regionId}: near-duplicate faces in preview`);
      }
    }
  }
});

test('aging and events change appearance but never identity traits', () => {
  const young = generateAppearance({ id: 'life', regionId: 'sahel', age: 22 });
  const old = withAge(young, 75);
  assert.deepEqual(old.skin, young.skin);
  assert.deepEqual(old.face, young.face);
  assert.deepEqual(old.eyes, young.eyes);
  assert.ok(visibleAppearance(old).wrinkles > visibleAppearance(young).wrinkles);

  const scarred = applyEvent(withAge(young, 30), { type: 'scar', side: 'left', location: 'brow' });
  assert.equal(visibleAppearance(scarred).scars.length, 1);
  assert.equal(visibleAppearance(withAge(scarred, 25)).scars.length, 0, 'event must not appear before it happened');
  assert.throws(() => applyEvent(young, { type: 'scar', changes: { skin: {} } }), /immutable/);
});

test('identity record is stable and travels with every image request', () => {
  const a = generateAppearance({ id: 'ident', regionId: 'nyrad', settlement: 'port' });
  const id1 = identityRecord(a);
  const id2 = identityRecord(generateAppearance({ id: 'ident', regionId: 'nyrad', settlement: 'port' }));
  assert.deepEqual(id1, id2);
  assert.match(id1.descriptor, new RegExp(a.skin.hex));
  const req = portraitRequest(identityRecord(a, 'ref://ident.png'), 'speaking at the harbour assembly');
  assert.ok(req.prompt.includes(id1.descriptor));
  assert.equal(req.referenceImage, 'ref://ident.png');
  assert.notEqual(describeAppearance(applyEvent(a, { type: 'spectacles' })), id1.descriptor);
});

test('households: children are related to both parents but are distinct individuals', () => {
  const h = generateHousehold({ id: 'fam-1', regionId: 'orane', partnerRegionId: 'kaelen' });
  const [p1, p2, ...kids] = h.members;
  const lo = Math.min(p1.skin.tone, p2.skin.tone) - 0.15;
  const hi = Math.max(p1.skin.tone, p2.skin.tone) + 0.15;
  for (const k of kids) assert.ok(k.skin.tone >= lo && k.skin.tone <= hi);
  for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) assert.ok(appearanceDistance(kids[i], kids[j]) > 0.1);
});

test('portrait feature colours stay legible across the full tone range', () => {
  const contrast = (a, b) => {
    const [la, lb] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (la + 0.05) / (lb + 0.05);
  };
  const dist = (a, b) => Math.hypot(...hexToRgb(a).map((v, i) => v - hexToRgb(b)[i]));
  for (let t = 0; t <= 1.0001; t += 0.05) {
    for (const u of ['warm-golden', 'neutral', 'cool', 'olive', 'reddish-brown']) {
      const skin = skinHex(t, u);
      const p = featurePalette(skin);
      assert.ok(contrast(skin, p.line) >= 1.25, `eye line too faint at tone ${t.toFixed(2)} ${u}`);
      assert.ok(dist(skin, p.lip) >= 18, `lips indistinct at tone ${t.toFixed(2)} ${u}`);
      assert.ok(dist(skin, p.highlight) >= 8, `no highlight at tone ${t.toFixed(2)} ${u}`);
    }
  }
});

test('skin colour ramp is monotonic from light to dark', () => {
  let prev = Infinity;
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const l = relativeLuminance(skinHex(t, 'neutral'));
    assert.ok(l < prev, `luminance not decreasing at ${t}`);
    prev = l;
  }
});

test('portraits render as valid, labelled SVG for every texture and style', () => {
  const people = REGION_IDS.flatMap((r) => sample(r, 'port', 40, 'svg'));
  for (const p of people) {
    const svg = renderPortrait(p, { title: 'x' });
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `bad geometry for ${p.id}`);
    assert.ok(svg.includes(p.skin.hex));
  }
});

test('skin-tone distribution is not a proxy for development level', () => {
  const dev = CIV_IDS.map((c) => CIVILIZATIONS[c].devIndex);
  const tone = CIV_IDS.map((c) => stats(sample(c, 'rural', 1500, 'dev')).mean);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const [md, mt] = [mean(dev), mean(tone)];
  const cov = dev.reduce((s, d, i) => s + (d - md) * (tone[i] - mt), 0);
  const r = cov / Math.sqrt(dev.reduce((s, d) => s + (d - md) ** 2, 0) * tone.reduce((s, t) => s + (t - mt) ** 2, 0));
  assert.ok(Math.abs(r) < 0.5, `development level correlates with mean tone (r = ${r.toFixed(2)})`);
});
