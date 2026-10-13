// Social role assignment. Kept strictly separate from appearance: it draws
// from its own RNG stream and never receives an appearance record, so skin
// tone, hair, or features cannot influence occupation, class, politics or
// narrative role (and vice versa).

import { Rng } from '../appearance/rng.js';

export const OCCUPATIONS = {
  farmer: 'Farmer', herder: 'Herder', fisher: 'Fisher', laborer: 'Labourer', artisan: 'Artisan',
  weaver: 'Weaver', smith: 'Smith', merchant: 'Merchant', shopkeeper: 'Shopkeeper', sailor: 'Sailor',
  soldier: 'Soldier', officer: 'Officer', scholar: 'Scholar', physician: 'Physician', engineer: 'Engineer',
  scribe: 'Scribe', priest: 'Priest', magistrate: 'Magistrate', minister: 'Minister', governor: 'Governor',
  'head-of-state': 'Head of state', artist: 'Artist', teacher: 'Teacher', banker: 'Banker',
};

export const ROLE_GROUPS = {
  leaders: ['head-of-state', 'minister', 'governor', 'magistrate'],
  officials: ['scribe', 'magistrate', 'officer'],
  workers: ['farmer', 'herder', 'fisher', 'laborer', 'artisan', 'weaver', 'smith', 'sailor'],
  merchants: ['merchant', 'shopkeeper', 'banker'],
  soldiers: ['soldier', 'officer'],
  scholars: ['scholar', 'physician', 'engineer', 'teacher', 'priest'],
};

const SETTLEMENT_WEIGHTS = {
  rural: { farmer: 8, herder: 4, laborer: 3, artisan: 2, weaver: 2, smith: 1, priest: 0.6, teacher: 0.5, soldier: 1, shopkeeper: 1 },
  town: { artisan: 3, shopkeeper: 3, merchant: 2, smith: 1.5, weaver: 1.5, laborer: 3, farmer: 2, scribe: 1, teacher: 1, physician: 0.6, priest: 0.8, soldier: 1.2, magistrate: 0.2 },
  urban: { laborer: 4, artisan: 3, shopkeeper: 2.5, merchant: 2, scribe: 1.5, scholar: 1, physician: 0.8, engineer: 0.8, teacher: 1.2, artist: 0.8, soldier: 1.5, officer: 0.4, banker: 0.4, magistrate: 0.3, minister: 0.08, governor: 0.03, 'head-of-state': 0.005 },
  port: { sailor: 5, fisher: 3, laborer: 4, merchant: 3, shopkeeper: 2, artisan: 2, banker: 0.6, scribe: 1, soldier: 1, officer: 0.3, engineer: 0.5, physician: 0.4, magistrate: 0.2 },
  border: { farmer: 4, herder: 3, soldier: 3, officer: 0.6, merchant: 1.5, laborer: 2, smith: 1, scribe: 0.6, priest: 0.5, magistrate: 0.2 },
};

/**
 * @param {{ seed: string, settlement?: string }} input — note: no appearance input exists.
 */
export function assignRole({ seed, settlement = 'rural' }) {
  const rng = Rng.stream(seed, 'social-role');
  const occupation = rng.weighted(SETTLEMENT_WEIGHTS[settlement] ?? SETTLEMENT_WEIGHTS.rural);
  return { occupation, label: OCCUPATIONS[occupation] };
}

/** Pick a specific role from a group (e.g. for an officials panel) — still appearance-blind. */
export function assignRoleFromGroup({ seed, group }) {
  const rng = Rng.stream(seed, 'social-role-group');
  const occupation = rng.pick(ROLE_GROUPS[group]);
  return { occupation, label: OCCUPATIONS[occupation] };
}
