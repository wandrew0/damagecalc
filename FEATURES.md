# Project map

The Next.js app is in `league-calculator/`. Route files provide metadata and render feature components; calculation helpers and generated game data are separate from the UI.

## Routes

| Route | Main component | Calculation source |
| --- | --- | --- |
| `/` | [HomePage.tsx](league-calculator/app/features/home/HomePage.tsx) | Tool navigation; legacy build hashes redirect to `/calculator` |
| `/calculator` | [CalculatorPage.tsx](league-calculator/app/features/calculator/CalculatorPage.tsx) | [Calculator.ts](league-calculator/app/classes/Calculator.ts) |
| `/aphelios-cutoff` | [ApheliosCutoffAnalysis.tsx](league-calculator/app/features/aphelios-cutoff/components/ApheliosCutoffAnalysis.tsx) | [apheliosCutoff.ts](league-calculator/app/utils/apheliosCutoff.ts) |
| `/collector` | [CollectorAnalysis.tsx](league-calculator/app/features/collector/components/CollectorAnalysis.tsx) | [collectorMath.ts](league-calculator/app/features/collector/lib/collectorMath.ts) |

## Shared code

- [classes/](league-calculator/app/classes/): champion AD growth, item data, build aggregation, and expected auto damage.
- [data/](league-calculator/app/data/): generated offensive items, IDs, champions, and runes, plus manually maintained enemy armor data.
- [components/](league-calculator/app/components/): navigation, headers, and item-icon UI shared across tools.
- [styles/](league-calculator/app/styles/): shared and feature CSS. The Aphelios styles are split into numbered files under `aphelios-cutoff/`.
- [itemRegistry.ts](league-calculator/app/utils/itemRegistry.ts): resolves saved item references against current data and fingerprints item data for persistence.
- [encoder.ts](league-calculator/app/utils/encoder.ts): compact build export and import. [Format reference](league-calculator/encoder-demo.md).
- [seo.ts](league-calculator/app/lib/seo.ts): site URL and metadata defaults.
- [createitems/](createitems/): data generator and item overrides. [Update procedure](docs/DATA.md).

## State and persistence

The interactive pages use React state and browser local storage. [usePersistenceLifecycle.ts](league-calculator/app/hooks/usePersistenceLifecycle.ts) coordinates loading and saving.

| Storage key | Contents |
| --- | --- |
| `calculatorState` | Builds, champion and level, runes, Draven Q settings, target controls, and display settings |
| `aphelios_cutoff_state` | Own/enemy purchase timelines, armor profile, forced W levels, and analysis settings |
| `collector_maxHp`, `collector_autoDamage` | Collector inputs |

The Q vs E page can seed its initial state from the calculator when it has no saved state of its own. URL build imports open a selection dialog so the user can choose which builds and settings to apply.

Adding a shared calculator setting usually touches `CalculatorPage`, the relevant controls, local storage, `encoder.ts`, and the share/import dialogs under [calculator/components/](league-calculator/app/features/calculator/components/). A setting saved locally is not automatically included in share codes.

For model changes, start with [Calculations](docs/CALCULATIONS.md). For generated values, change the generator or its overrides and follow [Data updates](docs/DATA.md).
