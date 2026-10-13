// Structured appearance vocabulary. These are descriptive visual categories used
// for rendering and text descriptions — not biological classifications, and they
// carry no meaning for personality, status, ability or behaviour.

import { clamp } from './rng.js';

/**
 * Skin tone is stored as a continuous value `tone` in [0, 1]
 * (0 = very light ivory, 1 = very dark brown). Categories are derived from it
 * for display and filtering only.
 */
export const SKIN_TONE_CATEGORIES = [
  { id: 'very-light', label: 'Very light ivory / pale beige', min: 0.0, max: 0.14 },
  { id: 'light', label: 'Light beige / peach-brown', min: 0.14, max: 0.28 },
  { id: 'light-olive', label: 'Light olive / golden beige', min: 0.28, max: 0.42 },
  { id: 'medium', label: 'Medium beige / honey / caramel', min: 0.42, max: 0.58 },
  { id: 'medium-brown', label: 'Medium brown / warm chestnut', min: 0.58, max: 0.75 },
  { id: 'deep', label: 'Deep brown / dark umber / very dark brown', min: 0.75, max: 1.0001 },
];

export function skinToneCategory(tone) {
  return SKIN_TONE_CATEGORIES.find((c) => tone >= c.min && tone < c.max) ?? SKIN_TONE_CATEGORIES.at(-1);
}

// Anchor colours along the tone axis (sRGB), interpolated in linear light.
const TONE_ANCHORS = [
  [0.0, '#f7e4d6'],
  [0.08, '#f0d5c0'],
  [0.18, '#e6c0a2'],
  [0.28, '#d9ab84'],
  [0.38, '#cb9a6c'],
  [0.48, '#b9835a'],
  [0.58, '#a26c46'],
  [0.68, '#8a5636'],
  [0.78, '#6e4129'],
  [0.88, '#52301f'],
  [1.0, '#3a2116'],
];

export const UNDERTONES = ['warm-golden', 'neutral', 'cool', 'olive', 'reddish-brown'];

// Multiplicative RGB shifts applied to the base tone colour.
const UNDERTONE_SHIFT = {
  'warm-golden': [1.03, 1.02, 0.9],
  neutral: [1, 1, 1],
  cool: [1.02, 0.97, 1.04],
  olive: [0.96, 1.02, 0.9],
  'reddish-brown': [1.06, 0.95, 0.92],
};

export const HAIR_TEXTURES = ['straight', 'wavy', 'curly', 'coily', 'tightly-coiled'];

export const HAIR_COLORS = {
  black: '#1b1512',
  'dark-brown': '#33231a',
  brown: '#55392a',
  chestnut: '#6e3f24',
  auburn: '#8a3b1f',
  red: '#a8492a',
  'dark-blonde': '#9a7748',
  blonde: '#cfae74',
  'ash-blonde': '#b7a587',
};

export const EYE_COLORS = {
  'dark-brown': '#2c1a10',
  brown: '#4e2e19',
  amber: '#8b5a1c',
  hazel: '#6b5a2e',
  green: '#4f6b3a',
  grey: '#6f7a80',
  blue: '#4a6f99',
};

export const EYELIDS = ['monolid', 'hooded', 'double', 'deep-set'];
export const FACE_SHAPES = ['oval', 'round', 'square', 'heart', 'long', 'diamond'];
export const BUILDS = ['slight', 'lean', 'average', 'sturdy', 'broad', 'heavy'];
export const PRESENTATIONS = ['feminine', 'masculine', 'androgynous'];

/** Hairstyles grouped by which textures they suit; most are open to all. */
export const HAIRSTYLES = {
  shaved: HAIR_TEXTURES,
  'close-crop': HAIR_TEXTURES,
  short: HAIR_TEXTURES,
  shoulder: HAIR_TEXTURES,
  long: HAIR_TEXTURES,
  bun: HAIR_TEXTURES,
  topknot: HAIR_TEXTURES,
  braids: HAIR_TEXTURES,
  locs: ['wavy', 'curly', 'coily', 'tightly-coiled'],
  afro: ['curly', 'coily', 'tightly-coiled'],
  twists: ['curly', 'coily', 'tightly-coiled'],
  headwrap: HAIR_TEXTURES,
};

export function stylesForTexture(texture) {
  return Object.entries(HAIRSTYLES)
    .filter(([, textures]) => textures.includes(texture))
    .map(([style]) => style);
}

// ---------------------------------------------------------------------------
// Colour helpers

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}

const toLinear = (c) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function mixHex(a, b, t) {
  const ra = hexToRgb(a).map(toLinear);
  const rb = hexToRgb(b).map(toLinear);
  return rgbToHex(ra.map((v, i) => toSrgb(v + (rb[i] - v) * t)));
}

export function shadeHex(hex, factor) {
  // factor < 1 darkens, > 1 lightens (in linear light)
  return rgbToHex(hexToRgb(hex).map((c) => toSrgb(clamp(toLinear(c) * factor, 0, 1))));
}

export function skinHex(tone, undertone = 'neutral') {
  const t = clamp(tone);
  let i = 0;
  while (i < TONE_ANCHORS.length - 2 && t > TONE_ANCHORS[i + 1][0]) i++;
  const [t0, c0] = TONE_ANCHORS[i];
  const [t1, c1] = TONE_ANCHORS[i + 1];
  const base = hexToRgb(mixHex(c0, c1, (t - t0) / (t1 - t0)));
  // Undertone shifts are softened at the very light end, where they otherwise read as yellow or grey.
  const strength = 0.45 + 0.55 * clamp(t / 0.3);
  const shift = UNDERTONE_SHIFT[undertone] ?? UNDERTONE_SHIFT.neutral;
  return rgbToHex(base.map((v, k) => v * (1 + (shift[k] - 1) * strength)));
}

export function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
