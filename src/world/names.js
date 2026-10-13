// Personal names by civilization (cultural, not physical: drawn from their
// own RNG stream and independent of appearance and role).

import { Rng } from '../appearance/rng.js';

const NAMES = {
  orane: {
    given: { f: ['Mara', 'Élise', 'Anaïs', 'Clémence', 'Noémie', 'Sidonie', 'Inès', 'Lisette', 'Odile', 'Margaux', 'Jeanne', 'Hélène'], m: ['Rénald', 'Soren', 'Lucien', 'Bastien', 'Hugo', 'Armand', 'Gaspard', 'Théo', 'Mathis', 'Félix', 'Aurèle', 'Victor'] },
    family: ['Venn', 'Taron', 'Vesc', 'Lyth', 'Delmas', 'Orsel', 'Brunet', 'Calvé', 'Morand', 'Lissac', 'Fauvel', 'Garrel', 'Aubrac', 'Pernet', 'Rochat', 'Sauval'],
  },
  nyrad: {
    given: { f: ['Ysolde', 'Ilsa', 'Nerys', 'Saska', 'Edda', 'Liv', 'Brisa', 'Tamsin', 'Maren'], m: ['Kael', 'Tobin', 'Corvin', 'Halvar', 'Joren', 'Aldo', 'Oskar', 'Bram'] },
    family: ['van Aurel', 'Kerrick', 'Haldane', 'Moerk', 'Tessaly', 'Brannoch', 'Vey-Sund', 'Ostmar', 'Callow', 'Duvessa', 'Morrow', 'Strand'],
  },
  veyra: {
    given: { f: ['Viktoria', 'Ludmila', 'Rosalind', 'Henrike', 'Ottilie', 'Vera', 'Agathe', 'Ilona'], m: ['Aurélien', 'Casimir', 'Anselm', 'Dmitri', 'Maximin', 'Severin', 'Leopold', 'Konrad'] },
    family: ['von Hautefer', 'Ardaine', 'Kessler', 'Moravec', 'Strelitz', 'Garance', 'Volkhov', 'Brandis', 'Eisenlohr', 'Tarnow', 'Rével', 'Zorrin'],
  },
  thelis: {
    given: { f: ['Ione', 'Callia', 'Phèdre', 'Daphné', 'Thalie', 'Mélis', 'Zoé', 'Cléo'], m: ['Damas', 'Theron', 'Lysandre', 'Nikias', 'Orest', 'Kyros', 'Alexis', 'Isandre'] },
    family: ['Asteridis', 'Kallistos', 'Mavros', 'Selenos', 'Andrakis', 'Lumeni', 'Paleos', 'Vitrou', 'Zafiris', 'Oreste', 'Kostal', 'Arvani'],
  },
  sahel: {
    given: { f: ['Nalé', 'Tiwa', 'Kenza', 'Saba', 'Zina', 'Aïcha', 'Taziri', 'Ina', 'Lalla'], m: ['Amaru', 'Issa', 'Oumar', 'Yaro', 'Moussa', 'Bala', 'Sidi', 'Idris'] },
    family: ['Ag-Tasmar', 'Kel-Amaru', 'Ould-Sirocca', 'Ténéré', 'Imzad', 'Agadès', 'Tilwat', 'Adrar', 'Ouazzan', 'Tamesna', 'Iferouane', 'Assodé'],
  },
  kaelen: {
    given: { f: ['Eilis', 'Maela', 'Sorcha', 'Niamh', 'Rhosyn', 'Ailbhe', 'Isolde', 'Brina'], m: ['Brann', 'Corrin', 'Torin', 'Aodh', 'Fergal', 'Cael', 'Duncan', 'Eamon'] },
    family: ['de Brumeval', 'Chêneroi', 'MacArdan', 'Ollamh', 'Fearne', 'Glasraen', 'Dunmore', 'Résinier', 'Loupgué', 'Cairbre', 'Ashgrove', 'Morvenne'],
  },
};

export function civName(seed, civ, presentation = 'androgynous') {
  const lists = NAMES[civ] ?? NAMES.orane;
  const rng = Rng.stream(seed, 'name');
  const pool = presentation === 'feminine' ? lists.given.f : presentation === 'masculine' ? lists.given.m : [...lists.given.f, ...lists.given.m];
  return `${rng.pick(pool)} ${rng.pick(lists.family)}`;
}

export const familyName = (fullName) => fullName.split(' ').slice(1).join(' ');
