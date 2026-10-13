// Persistent identity for image-model portraits. The descriptor is a pure
// function of the stored appearance, so every scene prompt for a character
// carries the same physical description; a reference image (once generated)
// is pinned to the record and passed with every subsequent request.

import { SKIN_TONE_CATEGORIES } from './traits.js';
import { visibleAppearance } from './lifecycle.js';

const txt = (s) => s.replace(/-/g, ' ');

const level = (x, lo, mid, hi) => (x < 0.35 ? lo : x > 0.65 ? hi : mid);

export function describeAppearance(a) {
  const v = visibleAppearance(a);
  const tone = SKIN_TONE_CATEGORIES.find((c) => c.id === a.skin.category).label.toLowerCase();
  const parts = [
    `${a.age}-year-old ${a.presentation === 'androgynous' ? 'androgynous person' : a.presentation === 'feminine' ? 'woman' : 'man'}`,
    `${tone} skin (tone ${a.skin.tone.toFixed(2)} on a 0–1 light-to-dark scale, ${txt(a.skin.undertone)} undertone, ${a.skin.hex})`,
    `${a.face.shape} face, ${level(a.face.cheekbones, 'soft', 'moderate', 'high')} cheekbones, ${level(a.face.jaw, 'narrow', 'medium', 'broad')} jaw`,
    `${level(a.face.noseWidth, 'narrow', 'medium-width', 'broad')} nose with a ${level(a.face.noseBridge, 'low', 'medium', 'high')} bridge`,
    `${level(a.face.lipFullness, 'thin', 'medium', 'full')} lips`,
    `${txt(a.eyes.color)} eyes, ${txt(a.eyes.lid)} eyelids`,
    `${level(a.face.browThickness, 'fine', 'medium', 'thick')} brows`,
    `${txt(a.hair.texture)} ${v.grey > 0.6 ? 'grey' : v.grey > 0.15 ? `greying ${txt(a.hair.color)}` : txt(a.hair.color)} hair worn ${txt(v.hairStyle)}`,
  ];
  if (v.facialHair !== 'none') parts.push(txt(v.facialHair));
  if (a.marks.freckles) parts.push('freckles');
  if (a.marks.vitiligo) parts.push('vitiligo patches');
  if (a.marks.birthmark) parts.push('a birthmark on the face');
  if (a.marks.dimples) parts.push('dimples');
  if (v.wrinkles > 0.3) parts.push(v.wrinkles > 0.7 ? 'deep age lines' : 'light age lines');
  for (const s of v.scars) parts.push(`a scar on the ${s.side} ${s.location}`);
  for (const t of v.tattoos) parts.push(`a ${t.pattern} tattoo on the ${t.location}`);
  if (v.eyeInjury) parts.push(v.eyeInjury.patch ? `an eyepatch over the ${v.eyeInjury.side} eye` : `a scarred ${v.eyeInjury.side} eye`);
  if (v.spectacles) parts.push('spectacles');
  parts.push(`${a.body.build} build, ${a.body.heightCm} cm`);
  return parts.join('; ');
}

/** Identity record to persist alongside the character. */
export function identityRecord(a, referenceImage = null) {
  return {
    characterId: a.id,
    appearanceVersion: a.version,
    seed: a.seed,
    descriptor: describeAppearance(a),
    referenceImage,
    // Guards against the most common image-model drift.
    negative: 'do not lighten or darken skin, do not change facial structure, do not change hair texture, not a different person',
  };
}

/** Build an image-model request for a scene; identity always travels with it. */
export function portraitRequest(identity, scene = 'head-and-shoulders portrait, neutral background') {
  return {
    prompt: `${scene}. The same individual as the reference: ${identity.descriptor}.`,
    negativePrompt: identity.negative,
    referenceImage: identity.referenceImage,
    seed: identity.seed,
  };
}
