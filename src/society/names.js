// Placeholder personal names (syllabic, culture-neutral) until Iskar's naming
// conventions are wired in. Drawn from their own RNG stream — independent of
// appearance and role.

import { Rng } from '../appearance/rng.js';

const ONSETS = ['', 'b', 'd', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'r', 's', 't', 'v', 'z', 'sh', 'th', 'kh', 'y', 'w'];
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'ai', 'ei', 'ou', 'aa', 'ia'];
const CODAS = ['', '', '', 'n', 'r', 'l', 's', 'm', 'k', 'th'];

function word(rng, syllables) {
  let w = '';
  for (let i = 0; i < syllables; i++) w += rng.pick(ONSETS) + rng.pick(VOWELS) + (i === syllables - 1 ? rng.pick(CODAS) : '');
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function personName(seed) {
  const rng = Rng.stream(seed, 'name');
  return `${word(rng, rng.int(2, 3))} ${word(rng, rng.int(2, 3))}`;
}
