// Personnages notables.
//
// Appearance comes from appearance/generator.js (ancestry and place only);
// personality, skills and social position are drawn from separate streams
// and never read appearance.

import { Rng, clamp } from '../appearance/rng.js';
import { generateAppearance } from '../appearance/generator.js';
import { generateChild } from '../appearance/family.js';
import { withAge } from '../appearance/lifecycle.js';
import { dateOf } from './calendar.js';

export const TRAITS = ['Ambition', 'Besoin de sécurité', 'Sociabilité', 'Idéalisme', 'Pragmatisme'];

function personality(id, fixed) {
  if (fixed) return fixed;
  const r = Rng.stream(id, 'personality');
  return Object.fromEntries(TRAITS.map((t) => [t, Math.round(r.range(18, 92))]));
}

function skills(id, list) {
  const r = Rng.stream(id, 'skills');
  return Object.fromEntries(list.map((s) => [s, Math.round(r.range(15, 85))]));
}

function makeChar(world, spec) {
  const settlement = spec.settlement ?? 'urban';
  const appearance = spec.appearance ?? generateAppearance({ id: spec.id, regionId: spec.civ, settlement, age: spec.age, presentation: spec.presentation });
  const r = Rng.stream(spec.id, 'state');
  const c = {
    id: spec.id,
    name: spec.name,
    civ: spec.civ,
    age: spec.age,
    role: spec.role,
    place: spec.place,
    appearance,
    traits: personality(spec.id, spec.traits),
    etat: spec.etat ?? { Santé: Math.round(r.range(55, 92)), Moral: Math.round(r.range(40, 85)), Finances: Math.round(r.range(25, 90)) },
    objectifs: spec.objectifs ?? [],
    competences: spec.competences ?? skills(spec.id, ['Administration', 'Éloquence', 'Négociation', 'Stratégie', 'Érudition']),
    inventaire: spec.inventaire ?? [],
    relations: spec.relations ?? [],
    context: spec.context ?? '',
    journal: spec.journal ?? [],
  };
  world.characters[c.id] = c;
  return c;
}

export function createCharacters(world) {
  // Mara Venn and her circle (Orane). Mara is generated as her parents' child.
  const mother = makeChar(world, { id: 'helene-venn', name: 'Hélène Venn', civ: 'orane', age: 51, presentation: 'feminine', role: 'Couturière', place: 'Valmire', settlement: 'urban' });
  const father = makeChar(world, { id: 'armand-venn', name: 'Armand Venn', civ: 'orane', age: 55, presentation: 'masculine', role: 'Cheminot', place: 'Valmire', settlement: 'town' });
  makeChar(world, {
    id: 'mara-venn',
    name: 'Mara Venn',
    civ: 'orane',
    age: 24,
    role: 'Fonctionnaire junior',
    place: 'Valmire',
    appearance: generateChild(mother.appearance, father.appearance, { id: 'mara-venn', age: 24, presentation: 'feminine' }),
    traits: { Ambition: 74, 'Besoin de sécurité': 82, Sociabilité: 61, Idéalisme: 48, Pragmatisme: 67 },
    etat: { Santé: 78, Moral: 58, Finances: 32 },
    objectifs: [
      { text: 'Obtenir un poste permanent', progress: 35 },
      { text: 'Soutenir sa famille', progress: 50 },
      { text: 'Gagner en influence', progress: 15 },
    ],
    competences: { Administration: 58, Rédaction: 66, Négociation: 39, Comptabilité: 47, 'Connaissance du terrain': 31 },
    inventaire: ['Carnet de notes', 'Lettre de recommandation de Rénald Vesc', '14 solis', 'Clé du bureau des archives', 'Photographie de famille'],
    relations: [
      { id: 'elise-taron', kind: 'Amie', trust: 78 },
      { id: 'renald-vesc', kind: 'Supérieur', trust: 52 },
      { id: 'soren-lyth', kind: 'Rival', trust: 31 },
      { id: 'helene-venn', kind: 'Mère', trust: 85 },
      { id: 'armand-venn', kind: 'Père', trust: 72 },
    ],
    context: 'Issue d’une famille modeste, Mara a rejoint l’administration pour assurer un avenir stable. Elle se sent partagée entre ses ambitions personnelles et ses obligations familiales.',
    journal: [{ day: 59, text: 'Premier jour au bureau des subsistances. On m’a confié les registres de réserves de la province de Valmont. Les chiffres sont pires que ce qu’on dit au marché.' }],
  });
  makeChar(world, { id: 'elise-taron', name: 'Élise Taron', civ: 'orane', age: 25, presentation: 'feminine', role: 'Institutrice', place: 'Valmire', relations: [{ id: 'mara-venn', kind: 'Amie', trust: 80 }] });
  makeChar(world, { id: 'renald-vesc', name: 'Rénald Vesc', civ: 'orane', age: 46, presentation: 'masculine', role: 'Chef du bureau des subsistances', place: 'Valmire', relations: [{ id: 'mara-venn', kind: 'Subordonnée', trust: 55 }] });
  makeChar(world, { id: 'soren-lyth', name: 'Soren Lyth', civ: 'orane', age: 27, presentation: 'masculine', role: 'Fonctionnaire', place: 'Valmire', relations: [{ id: 'mara-venn', kind: 'Rivale', trust: 30 }] });

  const leaders = [
    ['aurele-ii', 'Aurèle II', 'orane', 58, 'masculine', 'Roi d’Orane', 'Valmire'],
    ['clemence-orsel', 'Clémence Orsel', 'orane', 49, 'feminine', 'Première ministre', 'Valmire'],
    ['casimir-iv', 'Casimir IV', 'veyra', 63, 'masculine', 'Empereur de Veyra', 'Hautefer'],
    ['viktoria-ardaine', 'Viktoria Ardaine', 'veyra', 52, 'feminine', 'Chancelière impériale', 'Hautefer'],
    ['konrad-moravec', 'Konrad Moravec', 'veyra', 38, 'masculine', 'Syndicaliste', 'Cendreval'],
    ['ysolde-haldane', 'Ysolde Haldane', 'nyrad', 57, 'feminine', 'Doyenne des guildes', 'Port-Aurel'],
    ['corvin-strand', 'Corvin Strand', 'nyrad', 41, 'masculine', 'Armateur', 'Port-Aurel'],
    ['ione-asteridis', 'Ione Asteridis', 'thelis', 44, 'feminine', 'Archonte de la Ligue', 'Asterre'],
    ['nikias-mavros', 'Nikias Mavros', 'thelis', 61, 'masculine', 'Recteur de l’université', 'Lumen'],
    ['nale-ag-tasmar', 'Nalé Ag-Tasmar', 'sahel', 48, 'feminine', 'Présidente du Conseil fédéral', 'Tasmar'],
    ['amaru-imzad', 'Amaru Imzad', 'sahel', 34, 'masculine', 'Chef caravanier', 'Sirocca'],
    ['brann-de-brumeval', 'Brann de Brumeval', 'kaelen', 39, 'masculine', 'Souverain élu', 'Brumeval'],
    ['sorcha-ollamh', 'Sorcha Ollamh', 'kaelen', 66, 'feminine', 'Gardienne du Cercle des Bois', 'Chêne-Roi'],
  ];
  for (const [id, name, civ, age, presentation, role, place] of leaders) makeChar(world, { id, name, civ, age, presentation, role, place });
}

/** Monthly drift of characters' state with their country's conditions. */
export function monthlyCharacterUpdate(world) {
  const { m } = dateOf(world.day);
  for (const c of Object.values(world.characters)) {
    const civ = world.civs[c.civ];
    const r = new Rng(`${c.id}:${world.day}`);
    c.etat.Finances = Math.round(clamp(c.etat.Finances + (110 - civ.price) * 0.05 + r.normal(0, 2), 0, 100));
    c.etat.Moral = Math.round(clamp(c.etat.Moral + (civ.stability - 60) * 0.05 + r.normal(0, 2.5), 0, 100));
    c.etat.Santé = Math.round(clamp(c.etat.Santé + (civ.health - 70) * 0.04 + r.normal(0, 1.5) - (c.age > 60 ? 0.3 : 0), 0, 100));
    if (m === 0) {
      c.age += 1;
      c.appearance = withAge(c.appearance, c.age);
    }
  }
}
