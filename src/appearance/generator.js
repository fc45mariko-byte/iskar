// Appearance generation.
//
// Deliberately takes ONLY: identity seed, region/settlement (demographic
// context), optional explicit ancestry, age and presentation. It never sees
// occupation, social class, personality, politics or any simulation state, and
// nothing downstream may derive those from appearance. See src/society/roles.js.

import { Rng, clamp } from './rng.js';
import { ANCESTRAL_POOLS, sampleAncestry } from './population.js';
import {
  skinToneCategory, skinHex, UNDERTONES, HAIR_TEXTURES, HAIR_COLORS, EYE_COLORS,
  EYELIDS, FACE_SHAPES, BUILDS, PRESENTATIONS, stylesForTexture,
} from './traits.js';

export const APPEARANCE_VERSION = 1;
const FACE_KEYS = ['noseWidth', 'noseBridge', 'lipFullness', 'cheekbones', 'jaw'];
const ALLOWED_INPUTS = new Set(['id', 'seed', 'regionId', 'settlement', 'borderWith', 'ancestry', 'age', 'presentation']);

function poolTrait(rng, weights, key) {
  const pool = ANCESTRAL_POOLS[rng.weighted(weights)];
  return rng.weighted(pool[key]);
}

function mixedMean(weights, get) {
  let sum = 0;
  for (const [p, w] of Object.entries(weights)) sum += w * get(ANCESTRAL_POOLS[p]);
  return sum;
}

function hairstyleFor(rng, texture, presentation) {
  const styles = stylesForTexture(texture);
  // Fashion preferences only — never tied to status or region stereotypes.
  const bias = {
    feminine: { long: 3, shoulder: 2.5, braids: 2.5, bun: 2, locs: 1.5, afro: 1.5, twists: 1.5, headwrap: 1, short: 1, topknot: 0.7, 'close-crop': 0.6, shaved: 0.2 },
    masculine: { short: 3, 'close-crop': 3, shaved: 1.2, locs: 1.2, braids: 1, topknot: 1, afro: 1, twists: 1, long: 0.8, shoulder: 0.8, bun: 0.5, headwrap: 0.3 },
    androgynous: {},
  }[presentation];
  return rng.weighted(Object.fromEntries(styles.map((s) => [s, bias[s] ?? 1])));
}

/** Generate a structured, stable appearance record for one person. */
export function generateAppearance(input) {
  for (const key of Object.keys(input)) {
    if (!ALLOWED_INPUTS.has(key)) {
      throw new Error(`generateAppearance: '${key}' is not an appearance input (appearance is independent of role, status and behaviour)`);
    }
  }
  const { id, regionId, settlement = 'rural', borderWith } = input;
  const seed = input.seed ?? id;
  if (seed === undefined) throw new Error('generateAppearance requires an id or seed');
  const rng = Rng.stream(seed, 'appearance');

  const ancestry = input.ancestry
    ? { weights: input.ancestry, origin: regionId }
    : sampleAncestry(rng, regionId, settlement, { borderWith });
  const w = ancestry.weights;

  const presentation = input.presentation ?? rng.weighted({ feminine: 0.48, masculine: 0.48, androgynous: 0.04 });
  const bracket = rng.weighted({ '16-24': 18, '25-34': 22, '35-44': 20, '45-54': 16, '55-64': 12, '65-80': 9 });
  const [lo, hi] = bracket.split('-').map(Number);
  const age = input.age ?? rng.int(lo, hi);

  // Skin: continuous tone = ancestry-weighted mean + individual variation.
  const toneSd = Math.sqrt(mixedMean(w, (p) => p.tone.sd ** 2));
  const tone = clamp(mixedMean(w, (p) => p.tone.mean) + rng.normal(0, toneSd), 0.01, 0.99);
  const undertone = poolTrait(rng, w, 'undertone');

  const hairTexture = poolTrait(rng, w, 'hairTexture');
  const hairColor = poolTrait(rng, w, 'hairColor');
  const eyeColor = poolTrait(rng, w, 'eyeColor');
  const eyelid = poolTrait(rng, w, 'eyelid');

  const face = { shape: rng.pick(FACE_SHAPES) };
  for (const k of FACE_KEYS) face[k] = round(clamp(mixedMean(w, (p) => p.face[k]) + rng.normal(0, 0.14)));
  // Individual proportions, independent of ancestry.
  face.width = round(rng.range(0, 1));
  face.length = round(rng.range(0, 1));
  face.noseLength = round(rng.range(0, 1));
  face.mouthWidth = round(rng.range(0, 1));
  face.featureHeight = round(rng.range(0, 1));
  face.browThickness = round(rng.range(0.15, 0.95));
  face.browArch = round(rng.range(0, 1));
  face.earSize = round(rng.range(0.2, 0.8));

  const eyes = { color: eyeColor, lid: eyelid, size: round(rng.range(0.25, 0.85)), tilt: round(rng.range(-0.6, 0.6)), spacing: round(rng.range(0.3, 0.7)) };

  const build = rng.pick(BUILDS);
  const adultHeight = rng.normal(presentation === 'masculine' ? 174 : presentation === 'feminine' ? 162 : 168, 7);
  const heightCm = Math.round(age >= 18 ? adultHeight : adultHeight * clamp(0.45 + age * 0.03, 0.45, 1));

  const facialHairPotential = presentation === 'masculine' ? round(rng.range(0.2, 1)) : presentation === 'androgynous' ? round(rng.range(0, 0.4)) : 0;
  const facialHair = facialHairPotential > 0.35 && age >= 18
    ? rng.weighted({ none: 3, stubble: 2, moustache: 1, 'short-beard': 2, 'full-beard': 1.5 })
    : 'none';

  const marks = {
    freckles: rng.chance(mixedMean(w, (p) => p.freckles)) ? round(rng.range(0.2, 1)) : 0,
    vitiligo: rng.chance(0.006) ? { patches: rng.int(2, 5), seed: rng.int(1, 1e6) } : null,
    birthmark: rng.chance(0.04) ? { x: round(rng.range(0.2, 0.8)), y: round(rng.range(0.4, 0.85)) } : null,
    moles: Array.from({ length: rng.weighted({ 0: 4, 1: 3, 2: 1.5, 3: 0.5 }) | 0 }, () => ({ x: round(rng.range(0.2, 0.8)), y: round(rng.range(0.35, 0.9)) })),
    dimples: rng.chance(0.18),
  };

  const aging = {
    greyingOnset: Math.round(clamp(rng.normal(45, 9), 25, 75)),
    recession: presentation === 'masculine' ? round(rng.range(0, 1)) : round(rng.range(0, 0.25)),
    wrinkleRate: round(rng.range(0.6, 1.4)),
  };

  return {
    version: APPEARANCE_VERSION,
    id: id ?? String(seed),
    seed: String(seed),
    context: { regionId, settlement, origin: ancestry.origin },
    ancestry: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, round(v, 3)])),
    age,
    presentation,
    skin: { tone: round(tone, 3), category: skinToneCategory(tone).id, undertone, hex: skinHex(tone, undertone) },
    hair: { texture: hairTexture, color: hairColor, style: hairstyleFor(rng, hairTexture, presentation) },
    eyes,
    face,
    body: { build, heightCm },
    facialHair,
    marks,
    aging,
    clothingHue: rng.int(0, 359),
    events: [],
  };
}

function round(x, d = 2) {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

// ---------------------------------------------------------------------------
// Distinctness: avoid "the same face with minor changes".

export function featureVector(a) {
  return [
    a.skin.tone * 2,
    UNDERTONES.indexOf(a.skin.undertone) / 4,
    (HAIR_TEXTURES.indexOf(a.hair.texture) / 4) * 1.5,
    Object.keys(HAIR_COLORS).indexOf(a.hair.color) / 8,
    Object.keys(EYE_COLORS).indexOf(a.eyes.color) / 6,
    EYELIDS.indexOf(a.eyes.lid) / 3,
    ...FACE_KEYS.map((k) => a.face[k]),
    a.face.width, a.face.length, a.face.noseLength * 0.6, a.face.mouthWidth * 0.6,
    FACE_SHAPES.indexOf(a.face.shape) / 5,
    BUILDS.indexOf(a.body.build) / 5,
    a.hair.style.length / 10,
    PRESENTATIONS.indexOf(a.presentation) / 2,
    Math.min(a.age, 80) / 80,
  ];
}

export function appearanceDistance(a, b) {
  const va = featureVector(a);
  const vb = featureVector(b);
  return Math.sqrt(va.reduce((s, x, i) => s + (x - vb[i]) ** 2, 0));
}

/**
 * Representative preview of a population: draws from the real local
 * distribution, then picks across tone quantiles (so the full local range,
 * including both tails, is shown) while maximising pairwise distinctness.
 */
export function representativeSample({ regionId, settlement = 'rural', count = 12, seed = 'preview', borderWith, oversample = 8 }) {
  const candidates = Array.from({ length: count * oversample }, (_, i) =>
    generateAppearance({ id: `${seed}:${regionId}:${settlement}:${i}`, regionId, settlement, borderWith }));
  candidates.sort((a, b) => a.skin.tone - b.skin.tone);
  const chosen = [];
  for (let bin = 0; bin < count; bin++) {
    const slice = candidates.slice(Math.floor((bin * candidates.length) / count), Math.floor(((bin + 1) * candidates.length) / count));
    let best = slice[0];
    let bestScore = -1;
    for (const c of slice) {
      const score = chosen.length ? Math.min(...chosen.map((o) => appearanceDistance(c, o))) : 1;
      if (score > bestScore) [best, bestScore] = [c, score];
    }
    chosen.push(best);
  }
  return chosen;
}
