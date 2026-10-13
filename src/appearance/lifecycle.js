// Appearance over time. The base record is immutable identity; age and events
// produce a *visible* state. Skin tone, undertone, eye colour, hair texture and
// bone structure never change through these functions.

import { HAIR_COLORS, mixHex } from './traits.js';

const IMMUTABLE_KEYS = ['skin', 'eyes', 'face', 'ancestry', 'seed', 'id'];

export const EVENT_TYPES = {
  scar: 'Visible scar',
  haircut: 'New hairstyle',
  'facial-hair': 'Facial hair change',
  tattoo: 'Tattoo',
  'eye-injury': 'Eye injury',
  'weight-change': 'Weight change',
  spectacles: 'Started wearing spectacles',
};

/** Record a meaningful event that changes appearance. Returns a new record. */
export function applyEvent(appearance, event) {
  if (!EVENT_TYPES[event.type]) throw new Error(`Unknown appearance event: ${event.type}`);
  for (const k of IMMUTABLE_KEYS) {
    if (k in (event.changes ?? {})) throw new Error(`Event may not alter immutable trait '${k}'`);
  }
  return { ...appearance, events: [...appearance.events, { ...event, atAge: event.atAge ?? appearance.age }] };
}

/** Advance (or set) the character's age. Returns a new record. */
export function withAge(appearance, age) {
  return { ...appearance, age };
}

/** Derived visual state at the record's current age, including all events so far. */
export function visibleAppearance(a) {
  const yearsGrey = Math.max(0, a.age - a.aging.greyingOnset);
  const grey = Math.min(1, yearsGrey / 35);
  const baseHair = HAIR_COLORS[a.hair.color];
  const hairHex = grey > 0 ? mixHex(baseHair, '#d9d6d0', grey * 0.8) : baseHair;
  const wrinkles = Math.max(0, Math.min(1, ((a.age - 32) / 45) * a.aging.wrinkleRate));
  const recession = a.age > 28 ? Math.min(1, a.aging.recession * ((a.age - 28) / 30)) : 0;

  const v = {
    hairHex,
    hairStyle: a.hair.style,
    facialHair: a.facialHair,
    grey: Math.round(grey * 100) / 100,
    wrinkles: Math.round(wrinkles * 100) / 100,
    recession: Math.round(recession * 100) / 100,
    scars: [],
    tattoos: [],
    eyeInjury: null,
    spectacles: false,
    buildShift: 0,
  };
  for (const e of a.events) {
    if (e.atAge > a.age) continue;
    if (e.type === 'haircut') v.hairStyle = e.style;
    if (e.type === 'facial-hair') v.facialHair = e.style;
    if (e.type === 'scar') v.scars.push({ side: e.side ?? 'left', location: e.location ?? 'cheek' });
    if (e.type === 'tattoo') v.tattoos.push({ location: e.location ?? 'cheek', pattern: e.pattern ?? 'line' });
    if (e.type === 'eye-injury') v.eyeInjury = { side: e.side ?? 'left', patch: e.patch ?? true };
    if (e.type === 'weight-change') v.buildShift += e.delta ?? 1;
    if (e.type === 'spectacles') v.spectacles = true;
  }
  return v;
}
