# Human appearance and skin-tone diversity (spec §19)

How Iskar generates, stores, ages and draws the physical appearance of its people.

## Modules

| Path | Responsibility |
|---|---|
| `src/appearance/traits.js` | Vocabulary: continuous skin tone → 6 display categories, 5 undertones, hair textures/colours, eye colours, eyelids, face shapes, builds, hairstyles; colour ramp. |
| `src/appearance/population.js` | Demographic model: ancestral pools, regions (civilizations), settlement types, migration and intermarriage. |
| `src/appearance/generator.js` | `generateAppearance()`, distinctness metric, `representativeSample()` for previews. |
| `src/appearance/family.js` | Households and inheritance (`generateHousehold`, `generateChild`). |
| `src/appearance/lifecycle.js` | Aging and appearance-changing events; derived visible state. |
| `src/appearance/identity.js` | Persistent text descriptor + reference-image slot for image-model portraits. |
| `src/society/roles.js`, `src/society/names.js` | Occupation and name assignment, separate from appearance. |
| `src/portrait/svg.js`, `src/portrait/scene.js` | Procedural portraits and crowd/event scenes. |
| `demo/` | Dossier, population preview, household, public-life panels, event illustration. |

## Data model

```js
{
  version, id, seed,
  context: { regionId, settlement, origin },        // origin ≠ regionId for migrant families
  ancestry: { uplander: 0.61, riverine: 0.22, ... }, // individual mix, sums to 1
  age, presentation,
  skin:  { tone /* 0 very light … 1 very dark */, category, undertone, hex },
  hair:  { texture, color, style },
  eyes:  { color, lid, size, tilt, spacing },
  face:  { shape, noseWidth, noseBridge, noseLength, lipFullness, cheekbones, jaw,
           width, length, mouthWidth, featureHeight, browThickness, browArch, earSize },
  body:  { build, heightCm },
  facialHair, marks: { freckles, vitiligo, birthmark, moles, dimples },
  aging: { greyingOnset, recession, wrinkleRate },
  events: [ { type, atAge, ... } ],
}
```

Skin tone is a continuous value; the six categories (very light ivory/pale beige → deep brown/dark umber/very dark brown) are derived from it for display only.

## Population model

- **Ancestral pools** are old population groups from Iskar's history. Each has wide, overlapping distributions, so variation within a pool is larger than the differences between pools.
- **Regions** mix several pools. No region maps to one pool, and every region includes all pools to some degree.
- **Individuals** get their own ancestry mix, drawn from a Dirichlet distribution around the local mixture. Tone is the ancestry-weighted mean plus individual variation. Categorical traits (hair texture and colour, eyes, eyelids, undertone) are drawn per trait from a pool chosen by ancestry weight, so mixed ancestry recombines traits.
- **Settlement type** sets how much individuals vary and how many migrants arrive. Rural areas are the most uniform and port cities the most varied. Border regions blend two neighbouring regions. Migrants come from trading partners; intermarriage blends in a second region.

These properties are guaranteed by tests in `test/appearance.test.js`:
- Every region and settlement type contains all six tone categories.
- No category exceeds 50% anywhere.
- Every port is more varied than its rural hinterland.
- Regional means differ.

## Separation from behaviour and status

`generateAppearance()` accepts only `id/seed, regionId, settlement, borderWith, ancestry, age, presentation`. Passing `occupation`, `socialClass`, `personality` or similar throws. Roles and names use separate RNG streams and never receive an appearance record. A test checks that the share of light and dark skin tones is the same across leaders, merchants, workers, soldiers and scholars.

## Consistency over time

- Appearance is a pure function of the character id, so the same person looks the same on every screen.
- `withAge()` and `applyEvent()` return new records. Skin, eyes, face, ancestry and id are immutable. Aging adds greying, age lines and hairline change. Events add scars, tattoos, eye injury, spectacles, haircuts, facial-hair changes and weight changes, each dated with `atAge`.
- For image models, `identityRecord()` produces a deterministic descriptor (including exact tone value and hex) plus a negative prompt against drift. After a reference image is generated, pass it to `identityRecord(a, ref)`. `portraitRequest()` attaches the descriptor and reference image to every scene request.

## Avoiding repeated faces

`appearanceDistance()` compares about 20 structured features. `representativeSample()` oversamples the real local distribution, picks one person per tone quantile (covering both tails) and maximises the minimum pairwise distance. This is used for previews, public-life panels and crowd scenes.

## Rendering across the tone range

Shading, eye lines, lips and highlights come from each person's own skin colour (`featurePalette`), not fixed outline colours. A test checks that these stay distinct from the skin across the full 0–1 range and all undertones. Hair is drawn by texture (smooth, wavy, curly, coily, tightly coiled) and style (including afro, braids, locs, twists and headwrap).

## Integrating with the rest of the world spec

`REGIONS` and `ANCESTRAL_POOLS` in `population.js` are placeholders. Replace them with Iskar's canonical civilizations and migration history, keeping the same shape. The tests will flag any configuration that loses internal diversity. Names in `src/society/names.js` are likewise placeholders.

## Running

```
npm test            # unit + distribution tests
npm run test:ui     # demo at 360 / 768 / 1280 px, light + dark; screenshots → test/ui/output
npm run demo        # serve the repo, open http://localhost:8080/demo/
```
