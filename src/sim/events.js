// Catalogue des événements. Templates are looked up by id so saves hold only data.
// Effects mutate the world through helpers in engine.js (imported lazily to
// avoid a cycle at module-evaluation time).

import { CIVILIZATIONS, CIV_IDS } from '../world/civilizations.js';
import * as S from './state.js';
import { de } from '../world/fr.js';
import { dateOf, dayOf } from './calendar.js';

const name = (c) => CIVILIZATIONS[c].name;
const capital = (c) => CIVILIZATIONS[c].capital;
const towns = (c) => CIVILIZATIONS[c].provinces.flatMap((p) => p.localities.map((l) => l[0]));
const pick = (r, xs) => xs[Math.floor(r.next() * xs.length)];
const rival = (civ) => (civ === 'veyra' ? 'thelis' : civ === 'thelis' ? 'veyra' : 'veyra');

export const TEMPLATES = {
  note: {
    title: 'Note',
    text: ({ params }) => params.text,
    kind: 'info',
  },

  // --- La crise du grain (Orane, 1920) --------------------------------------
  'mauvaises-recoltes': {
    title: 'Mauvaises récoltes confirmées',
    text: 'Mauvaises récoltes confirmées dans la province de Valmont.',
    place: () => 'Valmont',
    image: { setting: 'market' },
    effects: ({ world }) => S.adjust(world, 'orane', { tension: 3 }),
  },
  'delegation-veyra': {
    title: 'Délégation de Veyra',
    text: 'Une délégation de Veyra arrive à Valmire pour discuter d’achats de grain.',
    place: () => 'Valmire',
    image: { setting: 'council' },
    effects: ({ world }) => S.adjustRelation(world, 'orane', 'veyra', 3),
  },
  'hausse-ble': {
    title: 'Hausse du prix du blé',
    text: 'Hausse de 18 % du prix du blé sur les marchés urbains.',
    place: () => 'Valmire',
    image: { setting: 'market' },
    effects: ({ world }) => S.adjust(world, 'orane', { priceMul: 1.18, tension: 4 }),
  },
  'manifestation-valmire': {
    title: 'Manifestation à Valmire',
    text: 'Manifestation de travailleurs à Valmire contre la hausse des prix.',
    place: () => 'Valmire',
    image: { setting: 'plaza' },
    effects: ({ world }) => {
      S.adjust(world, 'orane', { stability: -3, tension: 5 });
      world.characters['mara-venn']?.journal.unshift({ day: world.day, text: 'La place était pleine sous les fenêtres du bureau. On nous a demandé de fermer les volets. Je ne l’ai pas fait tout de suite.' });
    },
  },
  'conseil-exportations': {
    title: 'Le conseil d’Orane se réunit',
    text: 'Le conseil d’Orane se réunit pour discuter des exportations de grain.',
    place: () => 'Valmire',
    image: { setting: 'council' },
  },
  'crise-du-grain': {
    title: 'Crise du grain à Orane',
    text: 'Une mauvaise récolte entraîne une hausse rapide des prix du grain. Les marchands de Veyra proposent d’acheter une grande partie des réserves. Le conseil doit décider.',
    place: () => 'Valmire',
    image: { setting: 'council' },
    choices: [
      {
        id: 'exporter',
        label: 'Autoriser les exportations',
        hint: 'Augmente les revenus, risque de tensions internes.',
        outcome: 'Les convois partent vers Hautefer ; le trésor respire, les marchés grondent.',
        apply: ({ world }) => {
          world.civs.orane.exports = 0.9;
          S.adjust(world, 'orane', { treasury: 14, reserves: -0.9, priceMul: 1.08, stability: -4, tension: 6 });
          S.adjustRelation(world, 'orane', 'veyra', 15);
          S.schedule(world, 40, 'emeutes-faim', 'orane', { place: 'Valmire' });
        },
        journal: { 'mara-venn': 'Le conseil a choisi d’exporter. Rénald dit que c’est la seule façon de payer les fonctionnaires cet été. Ma mère dit que le pain va encore augmenter.' },
      },
      {
        id: 'restreindre',
        label: 'Imposer des restrictions',
        hint: 'Protège la population, risque de conflit avec Veyra.',
        outcome: 'Les greniers restent pleins ; à Hautefer, la presse parle de trahison.',
        apply: ({ world }) => {
          world.civs.orane.exports = 0.05;
          world.flags.exportBan = true;
          S.adjust(world, 'orane', { treasury: -8, reserves: 0.6, priceMul: 0.92, stability: 3, tension: -4 });
          S.adjustRelation(world, 'orane', 'veyra', -22);
          S.adjust(world, 'veyra', { tension: 6 });
          S.schedule(world, 25, 'ultimatum-veyra', 'orane');
        },
        journal: { 'mara-venn': 'Restrictions. J’ai passé la nuit à recopier les arrêtés pour les douanes de l’Est. Soren a eu le dossier des quotas ; moi, la paperasse.' },
      },
      {
        id: 'negocier',
        label: 'Chercher un accord diplomatique',
        hint: 'Prendre le temps de négocier une solution intermédiaire.',
        outcome: 'Des émissaires partent pour Hautefer. Les marchés attendent.',
        apply: ({ world }) => {
          world.civs.orane.exports = 0.45;
          S.adjust(world, 'orane', { stability: -1 });
          S.schedule(world, 30, 'issue-negociations', 'orane');
        },
        journal: { 'mara-venn': 'On négocie. Élise pense que c’est une manière élégante de ne rien décider. Je dois préparer les tableaux de réserves pour la délégation.' },
      },
    ],
  },
  'issue-negociations': {
    title: 'Négociations avec Veyra',
    text: ({ world }) => world.relations.orane.veyra > 10
      ? 'Un accord est signé : Veyra achète un tiers des surplus à prix garanti et livre du charbon en échange.'
      : 'Les négociations échouent. Veyra rappelle ses émissaires.',
    image: { setting: 'council' },
    effects: ({ world }) => {
      if (world.relations.orane.veyra > 10) {
        world.civs.orane.exports = 0.5;
        S.adjust(world, 'orane', { treasury: 8, stability: 4, tension: -3 });
        S.adjustRelation(world, 'orane', 'veyra', 10);
      } else {
        S.adjustRelation(world, 'orane', 'veyra', -12);
        S.adjust(world, 'orane', { stability: -3 });
      }
    },
  },
  'ultimatum-veyra': {
    title: 'Ultimatum de Veyra',
    text: 'Hautefer exige la reprise des livraisons de grain sous trente jours et masse des troupes près de la Marche de l’Est.',
    place: () => 'Ostval',
    image: { setting: 'council' },
    choices: [
      { id: 'ceder', label: 'Céder partiellement', hint: 'Reprendre des livraisons limitées pour éviter l’escalade.', outcome: 'Les convois reprennent, sous escorte.', apply: ({ world }) => { world.civs.orane.exports = 0.35; S.adjustRelation(world, 'orane', 'veyra', 18); S.adjust(world, 'orane', { stability: -3, reserves: -0.3 }); } },
      { id: 'tenir', label: 'Tenir bon', hint: 'Mobiliser la garde royale et chercher l’appui de Thélis.', outcome: 'Orane mobilise. Thélis promet son soutien diplomatique.', apply: ({ world }) => { S.adjust(world, 'orane', { military: 12, treasury: -10, tension: 4 }); S.adjustRelation(world, 'orane', 'thelis', 15); S.adjustRelation(world, 'orane', 'veyra', -15); } },
      { id: 'mediation', label: 'Demander la médiation de Nyrad', hint: 'Les guildes de Nyrad proposent d’arbitrer, contre une commission.', outcome: 'Nyrad arbitre : le grain transitera par ses ports.', apply: ({ world }) => { world.civs.orane.exports = 0.3; S.adjust(world, 'orane', { treasury: -4 }); S.adjustRelation(world, 'orane', 'nyrad', 12); S.adjustRelation(world, 'orane', 'veyra', 6); } },
    ],
  },
  'emeutes-faim': {
    title: ({ params }) => `Émeutes du pain à ${params.place}`,
    text: ({ params }) => `La foule attaque les boulangeries ${de(params.place)}. Les marchands exigent la protection de la garde.`,
    image: { setting: 'plaza' },
    choices: [
      { id: 'distribuer', label: 'Distribuer les réserves', hint: 'Calme la ville, épuise les greniers publics.', outcome: 'Des sacs de farine sont distribués sur les places.', apply: ({ world, civ }) => S.adjust(world, civ, { reserves: -0.4, tension: -10, stability: 4 }) },
      { id: 'garde', label: 'Déployer la garde', hint: 'Rétablit l’ordre, laisse des rancœurs.', outcome: 'La garde disperse la foule. On compte des blessés.', apply: ({ world, civ }) => S.adjust(world, civ, { tension: 6, stability: -2, military: 2 }) },
      { id: 'prix', label: 'Fixer le prix du pain', hint: 'Soulage les ménages, mécontente les meuniers.', outcome: 'Un prix maximum est affiché aux portes des boulangeries.', apply: ({ world, civ }) => S.adjust(world, civ, { priceMul: 0.88, treasury: -6, tension: -5 }) },
    ],
  },

  // --- Événements récurrents ------------------------------------------------
  'greve-veyra': {
    title: ({ params }) => `Grève à ${params.place}`,
    text: ({ params }) => `Les ouvriers des forges ${de(params.place)} cessent le travail et réclament du pain et des salaires.`,
    image: { setting: 'plaza' },
    choices: [
      { id: 'salaires', label: 'Augmenter les salaires', hint: 'Coûteux, apaise les ateliers.', outcome: 'Les fourneaux se rallument.', apply: ({ world, civ }) => S.adjust(world, civ, { treasury: -8, tension: -8 }) },
      { id: 'reprimer', label: 'Briser la grève', hint: 'Rapide, mais la colère couve.', outcome: 'La troupe occupe les ateliers.', apply: ({ world, civ }) => S.adjust(world, civ, { tension: 8, stability: -3 }) },
    ],
  },
  'election-cite': {
    title: ({ params }) => `Élections à ${params.place}`,
    text: ({ params, world }) => `Les citoyens ${de(params.place)} élisent un nouveau conseil. ${world.civs.thelis.tension > 45 ? 'Les partisans du pain bon marché l’emportent.' : 'Les modérés conservent la majorité.'}`,
    image: { setting: 'plaza' },
    effects: ({ world }) => S.adjust(world, 'thelis', { stability: world.civs.thelis.tension > 45 ? -2 : 2 }),
  },
  secheresse: {
    title: 'Sécheresse',
    text: ({ civ }) => `Les pluies manquent dans les plaines ${civ === 'sahel' ? 'du Sahel' : de(name(civ))}. La prochaine récolte s’annonce maigre.`,
    image: { setting: 'market' },
    effects: ({ world, civ }) => S.adjust(world, civ, { prod: -9, tension: 3 }),
  },
  'accord-commercial': {
    title: 'Accord commercial',
    text: ({ civ, params }) => `${name(civ)} et ${name(params.other)} signent un accord de libre passage pour les marchandises.`,
    image: { setting: 'harbour' },
    effects: ({ world, civ, params }) => { S.adjustRelation(world, civ, params.other, 12); S.adjust(world, civ, { treasury: 4 }); },
  },
  'incendie-foret': {
    title: 'Incendie de forêt',
    text: ({ params }) => `Un incendie ravage plusieurs milliers d’hectares de forêt près ${de(params.place)}.`,
    image: { setting: 'market' },
    effects: ({ world, civ }) => S.adjust(world, civ, { treasury: -5, stability: -1 }),
  },
  'chemin-de-fer': {
    title: 'Nouvelle ligne de chemin de fer',
    text: ({ civ, params }) => `Inauguration de la ligne ${capital(civ)}–${params.place}.`,
    image: { setting: 'plaza' },
    effects: ({ world, civ }) => S.adjust(world, civ, { gdp: 1.5, treasury: -3, stability: 1 }),
  },
  epidemie: {
    title: ({ params }) => `Grippe à ${params.place}`,
    text: ({ params }) => `Une épidémie de grippe touche ${params.place}. Les écoles ferment.`,
    image: { setting: 'plaza' },
    effects: ({ world, civ }) => S.adjust(world, civ, { health: -6, tension: 2 }),
  },
  'flotte-epices': {
    title: 'Retour de la flotte des épices',
    text: ({ params }) => `La flotte marchande rentre à ${params.place}, chargée d’épices et de nouvelles des mers.`,
    image: { setting: 'harbour' },
    effects: ({ world, civ }) => S.adjust(world, civ, { treasury: 6, stability: 1 }),
  },
  'incident-frontiere': {
    title: 'Incident de frontière',
    text: ({ civ, params }) => `Des gardes ${de(name(civ))} et ${de(name(params.other))} échangent des coups de feu près ${de(params.place)}.`,
    image: { setting: 'plaza' },
    choices: [
      { id: 'excuses', label: 'Présenter des excuses', hint: 'Désamorce l’incident, affaiblit le gouvernement.', outcome: 'Une note diplomatique apaise les esprits.', apply: ({ world, civ, params }) => { S.adjustRelation(world, civ, params.other, 8); S.adjust(world, civ, { stability: -2 }); } },
      { id: 'renforts', label: 'Envoyer des renforts', hint: 'Rassure la frontière, inquiète le voisin.', outcome: 'Deux régiments rejoignent la frontière.', apply: ({ world, civ, params }) => { S.adjustRelation(world, civ, params.other, -10); S.adjust(world, civ, { military: 4, treasury: -3 }); } },
    ],
  },
  'fete-moissons': {
    title: 'Fête des moissons',
    text: ({ params }) => `Les habitants ${de(params.place)} célèbrent la fin des moissons.`,
    image: { setting: 'market' },
    effects: ({ world, civ }) => S.adjust(world, civ, { tension: -3, stability: 1 }),
  },
};

/** Fixed-date events (day index from 1 January 1920). */
export const SCRIPTED = [
  { id: 'recoltes', day: dayOf(1920, 1, 28), template: 'mauvaises-recoltes', civ: 'orane' },
  { id: 'delegation', day: dayOf(1920, 2, 2), template: 'delegation-veyra', civ: 'orane' },
  { id: 'hausse', day: dayOf(1920, 2, 8), template: 'hausse-ble', civ: 'orane' },
  { id: 'manif', day: dayOf(1920, 2, 12), template: 'manifestation-valmire', civ: 'orane' },
  { id: 'conseil', day: dayOf(1920, 2, 15), template: 'conseil-exportations', civ: 'orane', scenarios: ['crise-du-grain', 'guerre-continue', 'revolution-veyra'] },
  { id: 'crise', day: dayOf(1920, 2, 15), template: 'crise-du-grain', civ: 'orane', scenarios: ['crise-du-grain', 'guerre-continue', 'revolution-veyra'] },
  { id: 'ultimatum-alt', day: dayOf(1920, 3, 2), template: 'ultimatum-veyra', civ: 'orane', scenarios: ['interdiction-export'] },
];

/** Random / conditional events, checked daily for every civilization. */
export const RANDOM_TEMPLATES = [
  { id: 'emeutes-faim', chance: ({ world, civ }) => (world.civs[civ].price > 150 && world.civs[civ].tension > 55 ? 0.02 : 0), cooldown: 90, params: ({ civ, r }) => ({ place: pick(r, towns(civ)) }) },
  { id: 'greve-veyra', when: ({ civ }) => civ === 'veyra', chance: ({ world }) => (world.civs.veyra.tension > 50 ? 0.012 : 0.003), cooldown: 75, params: ({ r }) => ({ place: pick(r, ['Cendreval', 'Hautefer', 'Ferrières', 'Garance']) }) },
  { id: 'election-cite', when: ({ civ }) => civ === 'thelis', chance: () => 0.004, cooldown: 180, params: ({ r }) => ({ place: pick(r, ['Asterre', 'Lumen', 'Sélénie']) }) },
  { id: 'secheresse', when: ({ world, civ }) => [4, 5, 6].includes(dateOf(world.day).m) && civ !== 'nyrad', chance: ({ civ }) => (civ === 'sahel' ? 0.006 : 0.0025), cooldown: 300 },
  { id: 'accord-commercial', chance: () => 0.0012, cooldown: 200, params: ({ civ, r }) => ({ other: pick(r, Object.keys(CIVILIZATIONS[civ].tradePartners)) }) },
  { id: 'incendie-foret', when: ({ world, civ }) => civ === 'kaelen' && [5, 6, 7].includes(dateOf(world.day).m), chance: () => 0.006, cooldown: 120, params: ({ civ, r }) => ({ place: pick(r, towns(civ)) }) },
  { id: 'chemin-de-fer', when: ({ civ }) => ['veyra', 'orane', 'thelis', 'nyrad'].includes(civ), chance: () => 0.0012, cooldown: 365, params: ({ civ, r }) => ({ place: pick(r, towns(civ).slice(1)) }) },
  { id: 'epidemie', chance: () => 0.0009, cooldown: 365, params: ({ civ, r }) => ({ place: pick(r, towns(civ)) }) },
  { id: 'flotte-epices', when: ({ civ }) => civ === 'nyrad', chance: () => 0.004, cooldown: 120, params: () => ({ place: 'Port-Aurel' }) },
  {
    id: 'incident-frontiere',
    chance: ({ world, civ }) => (CIVILIZATIONS[civ].neighbors.some((n) => world.relations[civ][n] < -10) ? 0.004 : 0.0004),
    cooldown: 120,
    params: ({ world, civ, r }) => {
      const hostile = CIVILIZATIONS[civ].neighbors.slice().sort((a, b) => world.relations[civ][a] - world.relations[civ][b]);
      return { other: hostile[0] ?? rival(civ), place: pick(r, towns(civ)) };
    },
  },
  { id: 'fete-moissons', when: ({ world }) => dateOf(world.day).m === 8, chance: () => 0.01, cooldown: 300, params: ({ civ, r }) => ({ place: pick(r, towns(civ)) }) },
];

export const ALL_CIVS = CIV_IDS;
