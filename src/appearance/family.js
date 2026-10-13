// Households: children inherit from both parents with realistic sibling
// variation — siblings are related, not clones, and mixed-heritage families
// can show a wide range of appearances.

import { Rng, clamp } from './rng.js';
import { generateAppearance } from './generator.js';
import { skinHex, skinToneCategory, HAIR_TEXTURES } from './traits.js';

function averageAncestry(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = ((a[k] ?? 0) + (b[k] ?? 0)) / 2;
  return out;
}

export function generateChild(parentA, parentB, { id, age, presentation }) {
  const ancestry = averageAncestry(parentA.ancestry, parentB.ancestry);
  const base = generateAppearance({ id, regionId: parentA.context.regionId, settlement: parentA.context.settlement, ancestry, age, presentation });
  const rng = Rng.stream(id, 'inheritance');
  const from = () => (rng.chance(0.5) ? parentA : parentB);

  const spread = Math.abs(parentA.skin.tone - parentB.skin.tone);
  const tone = clamp((parentA.skin.tone + parentB.skin.tone) / 2 + rng.normal(0, 0.035 + spread * 0.25), 0.01, 0.99);
  const undertone = from().skin.undertone;

  const ta = HAIR_TEXTURES.indexOf(parentA.hair.texture);
  const tb = HAIR_TEXTURES.indexOf(parentB.hair.texture);
  const texIdx = Math.round(clamp(rng.range(Math.min(ta, tb) - 0.4, Math.max(ta, tb) + 0.4), 0, 4));

  const face = { ...base.face };
  for (const k of ['noseWidth', 'noseBridge', 'lipFullness', 'cheekbones', 'jaw']) {
    face[k] = Math.round(clamp((parentA.face[k] + parentB.face[k]) / 2 + rng.normal(0, 0.1)) * 100) / 100;
  }
  return {
    ...base,
    context: { ...base.context, origin: parentA.context.origin },
    skin: { tone: Math.round(tone * 1000) / 1000, category: skinToneCategory(tone).id, undertone, hex: skinHex(tone, undertone) },
    hair: { ...base.hair, texture: HAIR_TEXTURES[texIdx], color: rng.chance(0.8) ? from().hair.color : base.hair.color },
    eyes: { ...base.eyes, color: rng.chance(0.8) ? from().eyes.color : base.eyes.color, lid: from().eyes.lid },
    face,
    parents: [parentA.id, parentB.id],
  };
}

/**
 * A household: two adults (possibly from different regions — intermarriage)
 * and 1–4 children.
 */
export function generateHousehold({ id, regionId, settlement = 'town', partnerRegionId }) {
  const rng = Rng.stream(id, 'household');
  const adultAge = rng.int(30, 50);
  const a = generateAppearance({ id: `${id}:a`, regionId, settlement, age: adultAge, presentation: 'feminine' });
  const b = generateAppearance({ id: `${id}:b`, regionId: partnerRegionId ?? regionId, settlement, age: adultAge + rng.int(-4, 6), presentation: 'masculine' });
  const children = Array.from({ length: rng.int(1, 4) }, (_, i) =>
    generateChild(a, b, { id: `${id}:c${i}`, age: Math.max(1, adultAge - 22 - i * rng.int(2, 4)) }));
  return { id, members: [a, b, ...children] };
}
