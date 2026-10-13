// Demographic model for physical appearance.
//
// Appearance emerges from *ancestral pools* (old population groups of Iskar's
// deep history) mixed in different proportions in each region, reshaped by
// settlement type (rural / town / urban / port / border) and by migration.
// No region maps to a single pool, every pool's distributions are wide and
// overlapping, and every individual gets their own ancestry mix — so every
// civilization contains meaningful internal diversity.
//
// NOTE: region ids below are placeholders for Iskar's civilizations. Replace
// `REGIONS` with the canonical world data (keeping the same shape) when the
// civilization definitions are wired in.

import { Rng } from './rng.js';

/**
 * Ancestral pools. Continuous facial parameters are 0..1 means; individual
 * variation (sd) is deliberately larger than the differences between pools.
 */
export const ANCESTRAL_POOLS = {
  uplander: {
    label: 'Old Uplander',
    tone: { mean: 0.1, sd: 0.08 },
    undertone: { 'warm-golden': 2, neutral: 3, cool: 3, olive: 1, 'reddish-brown': 0.5 },
    hairTexture: { straight: 4, wavy: 4, curly: 2, coily: 0.2 },
    hairColor: { blonde: 1.5, 'ash-blonde': 1.5, 'dark-blonde': 2, brown: 3, 'dark-brown': 2.5, black: 1, red: 0.7, auburn: 0.8, chestnut: 1 },
    eyeColor: { blue: 2.5, grey: 2, green: 1.5, hazel: 1.5, brown: 2, 'dark-brown': 1, amber: 0.3 },
    eyelid: { double: 5, hooded: 2.5, 'deep-set': 2.5, monolid: 0.3 },
    face: { noseWidth: 0.4, noseBridge: 0.62, lipFullness: 0.4, cheekbones: 0.5, jaw: 0.52 },
    freckles: 0.22,
  },
  steppe: {
    label: 'Old Steppe',
    tone: { mean: 0.3, sd: 0.09 },
    undertone: { 'warm-golden': 4, neutral: 2.5, cool: 1, olive: 2, 'reddish-brown': 1 },
    hairTexture: { straight: 7, wavy: 2.5, curly: 0.6 },
    hairColor: { black: 6, 'dark-brown': 3, brown: 1, chestnut: 0.4 },
    eyeColor: { 'dark-brown': 5, brown: 3, hazel: 1, amber: 0.6, green: 0.3, grey: 0.2 },
    eyelid: { monolid: 4, hooded: 3, double: 2.5, 'deep-set': 0.5 },
    face: { noseWidth: 0.47, noseBridge: 0.4, lipFullness: 0.45, cheekbones: 0.66, jaw: 0.55 },
    freckles: 0.06,
  },
  riverine: {
    label: 'Old Riverine',
    tone: { mean: 0.48, sd: 0.11 },
    undertone: { 'warm-golden': 3, neutral: 2, cool: 1, olive: 3, 'reddish-brown': 1.5 },
    hairTexture: { straight: 2.5, wavy: 4, curly: 3, coily: 1 },
    hairColor: { black: 4, 'dark-brown': 4, brown: 1.5, chestnut: 0.6, auburn: 0.2 },
    eyeColor: { 'dark-brown': 3.5, brown: 3.5, hazel: 1.5, amber: 1, green: 0.6, grey: 0.2 },
    eyelid: { double: 4, hooded: 3, 'deep-set': 2, monolid: 0.6 },
    face: { noseWidth: 0.5, noseBridge: 0.58, lipFullness: 0.52, cheekbones: 0.52, jaw: 0.5 },
    freckles: 0.05,
  },
  savanna: {
    label: 'Old Savanna',
    tone: { mean: 0.88, sd: 0.08 },
    undertone: { 'warm-golden': 2, neutral: 3, cool: 2, olive: 0.5, 'reddish-brown': 3 },
    hairTexture: { 'tightly-coiled': 4, coily: 4, curly: 1.5, wavy: 0.3 },
    hairColor: { black: 7, 'dark-brown': 2.5, brown: 0.4 },
    eyeColor: { 'dark-brown': 7, brown: 2.5, amber: 0.6, hazel: 0.2 },
    eyelid: { double: 4, hooded: 2.5, 'deep-set': 1.5, monolid: 0.5 },
    face: { noseWidth: 0.62, noseBridge: 0.42, lipFullness: 0.64, cheekbones: 0.58, jaw: 0.5 },
    freckles: 0.04,
  },
  islander: {
    label: 'Old Islander',
    tone: { mean: 0.63, sd: 0.11 },
    undertone: { 'warm-golden': 3, neutral: 2, cool: 1, olive: 1.5, 'reddish-brown': 2.5 },
    hairTexture: { straight: 2, wavy: 3.5, curly: 3.5, coily: 1.5, 'tightly-coiled': 0.5 },
    hairColor: { black: 5, 'dark-brown': 3, brown: 0.8, 'dark-blonde': 0.3, blonde: 0.2 },
    eyeColor: { 'dark-brown': 5, brown: 3.5, amber: 1, hazel: 0.6 },
    eyelid: { double: 3.5, hooded: 3, monolid: 1.5, 'deep-set': 1 },
    face: { noseWidth: 0.57, noseBridge: 0.47, lipFullness: 0.58, cheekbones: 0.6, jaw: 0.56 },
    freckles: 0.05,
  },
  plateau: {
    label: 'Old Plateau',
    tone: { mean: 0.7, sd: 0.1 },
    undertone: { 'warm-golden': 2.5, neutral: 2, cool: 1.5, olive: 2, 'reddish-brown': 2 },
    hairTexture: { straight: 2.5, wavy: 3, curly: 3, coily: 1.5, 'tightly-coiled': 0.6 },
    hairColor: { black: 5, 'dark-brown': 3.5, brown: 1, chestnut: 0.4, auburn: 0.15 },
    eyeColor: { 'dark-brown': 4, brown: 3, hazel: 1.2, amber: 1, green: 0.5, grey: 0.2 },
    eyelid: { double: 3.5, 'deep-set': 3, hooded: 2.5, monolid: 0.4 },
    face: { noseWidth: 0.52, noseBridge: 0.66, lipFullness: 0.5, cheekbones: 0.55, jaw: 0.5 },
    freckles: 0.04,
  },
};

export const POOL_IDS = Object.keys(ANCESTRAL_POOLS);

/**
 * Regions / civilizations. `ancestry` is the long-run mixture of pools in the
 * settled population; `neighbors` share border zones; `tradePartners` weight
 * where port-city migrants come from.
 */
export const REGIONS = {
  'northern-uplands': {
    label: 'Northern Uplands',
    ancestry: { uplander: 0.5, steppe: 0.16, riverine: 0.16, plateau: 0.06, savanna: 0.06, islander: 0.06 },
    neighbors: ['eastern-steppe', 'river-delta'],
    tradePartners: { 'river-delta': 3, 'western-archipelago': 2, 'eastern-steppe': 1 },
  },
  'eastern-steppe': {
    label: 'Eastern Steppe',
    ancestry: { steppe: 0.48, uplander: 0.16, riverine: 0.16, plateau: 0.08, savanna: 0.07, islander: 0.05 },
    neighbors: ['northern-uplands', 'river-delta', 'southwest-plateau'],
    tradePartners: { 'river-delta': 3, 'northern-uplands': 1, 'southwest-plateau': 1 },
  },
  'river-delta': {
    label: 'River Delta',
    ancestry: { riverine: 0.42, uplander: 0.12, steppe: 0.12, savanna: 0.14, islander: 0.1, plateau: 0.1 },
    neighbors: ['northern-uplands', 'eastern-steppe', 'southern-savanna', 'southwest-plateau'],
    tradePartners: { 'western-archipelago': 3, 'southern-savanna': 2, 'northern-uplands': 2, 'eastern-steppe': 2 },
  },
  'southern-savanna': {
    label: 'Southern Savanna',
    ancestry: { savanna: 0.5, riverine: 0.15, plateau: 0.15, islander: 0.1, steppe: 0.05, uplander: 0.05 },
    neighbors: ['river-delta', 'southwest-plateau'],
    tradePartners: { 'river-delta': 3, 'western-archipelago': 2, 'southwest-plateau': 1 },
  },
  'western-archipelago': {
    label: 'Western Archipelago',
    ancestry: { islander: 0.46, savanna: 0.15, riverine: 0.15, uplander: 0.1, steppe: 0.08, plateau: 0.06 },
    neighbors: ['river-delta'],
    tradePartners: { 'river-delta': 3, 'southern-savanna': 2, 'northern-uplands': 2 },
  },
  'southwest-plateau': {
    label: 'Southwest Plateau',
    ancestry: { plateau: 0.44, savanna: 0.2, riverine: 0.14, uplander: 0.1, islander: 0.07, steppe: 0.05 },
    neighbors: ['southern-savanna', 'river-delta', 'eastern-steppe'],
    tradePartners: { 'river-delta': 2, 'southern-savanna': 2, 'eastern-steppe': 1 },
  },
};

export const REGION_IDS = Object.keys(REGIONS);

/**
 * Settlement types. `alpha` is the Dirichlet concentration of individual
 * ancestry around the local mixture (lower = more individual variation);
 * `migrants` is the share of first/second-generation arrivals from elsewhere.
 */
export const SETTLEMENTS = {
  rural: { label: 'Rural', alpha: 1.3, migrants: 0.03 },
  town: { label: 'Market town', alpha: 1.2, migrants: 0.07 },
  urban: { label: 'City', alpha: 1.1, migrants: 0.14 },
  port: { label: 'Port city', alpha: 0.9, migrants: 0.32 },
  border: { label: 'Border region', alpha: 1.0, migrants: 0.08 },
};

function blend(a, b, t) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[k] = (a[k] ?? 0) * (1 - t) + (b[k] ?? 0) * t;
  }
  return out;
}

/** The local population mixture for a region + settlement (before individual variation). */
export function localMixture(regionId, settlement = 'rural', { borderWith } = {}) {
  const region = REGIONS[regionId];
  if (!region) throw new Error(`Unknown region: ${regionId}`);
  if (settlement === 'border') {
    const other = REGIONS[borderWith ?? region.neighbors[0]];
    return blend(region.ancestry, other.ancestry, 0.45);
  }
  return { ...region.ancestry };
}

/**
 * Sample one individual's ancestry weights. Uses its own RNG; nothing about
 * occupation, class or personality is an input.
 */
export function sampleAncestry(rng, regionId, settlement = 'rural', opts = {}) {
  const s = SETTLEMENTS[settlement];
  if (!s) throw new Error(`Unknown settlement: ${settlement}`);
  let base = localMixture(regionId, settlement, opts);
  let origin = regionId;
  if (rng.chance(s.migrants)) {
    const partners = settlement === 'port'
      ? Object.fromEntries(REGION_IDS.filter((r) => r !== regionId).map((r) => [r, 1 + (REGIONS[regionId].tradePartners[r] ?? 0)]))
      : REGIONS[regionId].tradePartners;
    origin = rng.weighted(partners);
    base = { ...REGIONS[origin].ancestry };
  }
  // Mixed-heritage households: a share of people have one parent line from elsewhere.
  const intermarriage = { rural: 0.06, town: 0.1, urban: 0.16, port: 0.25, border: 0.3 }[settlement];
  if (rng.chance(intermarriage)) {
    const other = rng.pick(REGION_IDS.filter((r) => r !== origin));
    base = blend(base, REGIONS[other].ancestry, 0.5);
  }
  return { weights: rng.dirichlet(base, s.alpha), origin };
}
