# Iskar: the game

A world simulation set on the continent of Iskar, starting in 1920. The interface is in French.

## Screens

| # | Screen | Route | What it does |
|---|---|---|---|
| 1 | Écran d’accueil | `#accueil` | Continue, new game, scenarios, explorer mode, settings; recommended scenario. |
| 2 | Carte du monde | `#carte` | Painted continent; modes Carte / Ressources / Politiques (stability) / Relations; toggles for borders, cities, resources, trade routes and conflict zones; zoom and pan. |
| 3 | Panneau d’une civilisation | `#civilisation` | Aperçu, Politique, Économie, Société (skin-tone distribution and residents), Relations, Historique. |
| 4 | Vue d’une région | `#region` | Province map with towns, villages, river, roads; localities with residents and notable characters. |
| 5 | Fiche d’un personnage | `#personnage` | State, traits, goals, key relations, journal, skills, inventory, appearance and identity description. |
| 6 | Événements et décisions | `#evenements` | Pending decision with an illustration and choices, or recent events. |
| 7 | Simulation et temps | `#temps` | Pause / play, x1, x7, x30 or x365 days per second, skip to next month; event log, indicators, charts, chronology. |
| 8 | Tableaux et analyses | `#analyses` | Population, economy, politics, society, military, relations per civilization. |
| 9 | Explorateur / historien | `#explorateur` | Chronology since 1902, characters, places, archival documents, alternative scenarios. |

## Simulation (`src/sim/`)

- `engine.js`: one tick = one day. Grain reserves, prices, production and harvests (20 August); stability, social tension, public health, treasury, military, population, relations. Snapshots on the 1st and 15th of each month. Deterministic per seed; saves are plain JSON.
- `events.js`: scripted events (the Orane grain crisis, 28 February to 15 March 1920), follow-ups (negotiations, ultimatum, bread riots) and recurring events (strikes, elections, droughts, epidemics, border incidents…). Decisions for the player's civilization pause time; other governments decide for themselves.
- `characters.js`: notable characters. Mara Venn is generated as her parents' child. Personality, skills and state come from separate random streams, never from appearance.
- Scenarios: *La crise du grain*, plus three alternatives (total export ban, the Great War continuing, a workers' uprising in Veyra).

The game saves to the browser's local storage every in-game month and after each decision.

## Portraits and illustrations

Portraits and scenes are drawn procedurally (`src/portrait/`) from each person's stored appearance, so they are consistent everywhere.

Optionally, **Paramètres** configures an image-generation endpoint compatible with OpenAI's `images/generations` API (`src/render/imagegen.js`). Each request carries:

- the character's persistent identity description;
- a negative prompt against identity drift;
- after the first portrait, that image as `reference_image`.

Images are cached in IndexedDB, and the SVG stays as the fallback. When the page is hosted on claude.ai, its sandbox blocks calls to other servers, so this feature needs the self-hosted build (`npm start`).

## Running

```
npm test            # appearance + simulation tests
npm run build       # dist/index.html: the whole game in one file
npm run test:ui     # builds, plays through every screen at 390 / 820 / 1440 px; screenshots → test/ui/output
npm start           # serve the repo; open http://localhost:8080/dist/ (or /app/ for unbundled ES modules)
```
