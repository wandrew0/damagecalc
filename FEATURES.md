# Damagecalc Feature Map

This doc is the quick, comprehensive map of features, state, and update touchpoints
for the damage calculator app and its supporting data pipeline. The goal is to
prevent missing related updates when adding new features.

Note on live service data:
- League is a live service. If an agent does not have internet access, it should
  ask before assuming stats, item behavior, or other data that might have changed.

## Project layout and pages
- Main app is a Next.js app under `league-calculator/`.
- Entry route: `league-calculator/app/page.tsx` -> `league-calculator/app/pages/CalculatorPage.tsx`.
- Collector analysis page: `league-calculator/app/collector/page.tsx` with
  `league-calculator/app/components/CollectorAnalysis.tsx`.
- Shared UI: `league-calculator/app/components/Navigation.tsx`.
- Styles: `league-calculator/app/styles/CalculatorPage.css`,
  `league-calculator/app/styles/CollectorAnalysis.css`,
  `league-calculator/app/styles/CollectorPage.css`, and `league-calculator/app/globals.css`.

## Core calculator features (CalculatorPage)
File: `league-calculator/app/pages/CalculatorPage.tsx`

Primary state (and defaults):
- `level` (1-18).
- `builds` (array of `Build`).
- `championId` (`aphelios` or `draven`) and `champion` (constructed from data).
- `armorRange` ([min, max]).
- `absoluteFocus` (boolean).
- `gatheringStormMinutes` (minutes, rounded to 10 in UI).
- `adShardCount` (0-2, each shard adds Adaptive Force; converted to AD via `runes.ts`).
- `targetBonusHP` (for LDR Giant Slayer).
- `targetBonusHPRangeMode` and `targetBonusHPMax` (range mode for target bonus HP).
- Draven Q: `dravenQEnabled`, `dravenQLevel`, `dravenQLevelLinked`.
- UI: `championPanelCompact`.
- Chart controls: margin-related fields exist but are currently unused.

Persistence:
- Local storage key: `calculatorState`.
- Stored fields: `level`, `armorRange`, `builds`, `showMargin`, `stdDevMultiplier`,
  `percentileRange`, `numAutoAttacks`, `absoluteFocus`, `gatheringStormMinutes`,
  `adShardCount`, `targetBonusHP`, `targetBonusHPRangeMode`, `targetBonusHPMax`,
  `championId`, `dravenQEnabled`, `dravenQLevel`, `dravenQLevelLinked`,
  `championPanelCompact`.
- When Draven Q is linked, the stored Q level is derived from champ level.
- URL import (hash) takes precedence and should not be overwritten by local storage
  for that initial load.

UI sections in CalculatorPage:
- Champion selection and level.
- Draven Q controls (only for Draven):
  - Q level uses `getQRankFromChampLevel` when linked.
  - Link toggle disables manual Q level selection.
  - Invariant: if link is on, Q level always equals champ level mapping.
- Rune settings:
  - Absolute Focus, Gathering Storm, AD Shards (0-2).
  - Compact UI mirrors full UI.
- Build list and share/import (delegated to BuildPanel).
- Damage chart (DamageChart).
- Target armor and bonus HP (including range mode).

## Build and item models
- `league-calculator/app/classes/Build.ts`:
  - Holds items and derived stats (AD, crit, lethality, armor pen, etc).
  - Supports JSON serialization for storage/share.
- `league-calculator/app/classes/Item.ts`:
  - Represents item data with stats and image path.
- `league-calculator/app/classes/Champion.ts`:
  - Base AD + growth and `getAD(level)` for base AD.

## Champion data and Draven data
File: `league-calculator/app/data/champions.ts`
- Champion list: `aphelios`, `draven`.
- Base AD and growth data (auto-generated via CDragon in `createitems/cass.py`).
- Draven Spinning Axe data: base damage and bonus AD scaling arrays (auto-generated via CDragon).
- `getQRankFromChampLevel` defines the linked Q level mapping (manual).

## Rune constants (generated)
File: `league-calculator/app/data/runes.ts`
- Absolute Focus min/max AD.
- Adaptive Force shard amount (used to derive AD shard bonus).
- Generated from CDragon `perks.json` by `createitems/cass.py`.

## Calculation pipeline
File: `league-calculator/app/classes/Calculator.ts`
- `getTotalAD` = base AD + bonus AD.
- `getBonusAD` includes:
  - Item bonus AD.
  - AD shards (0-2, derived from Adaptive Force in `runes.ts`).
  - Absolute Focus (scaled by level).
  - Gathering Storm (scaled by minutes).
- Draven Q:
  - `getSpinningAxeDamage` applies base + bonus AD scaling.
  - Spinning Axe can crit; uses same crit averaging and armor/giant slayer scaling.
- LDR Giant Slayer:
  - `getGiantSlayerMultiplier` scales with target bonus HP.
- `calculateSingleAutoDamage` is the core formula used by the chart.
- `calculateDamageWithMargin` exists but is currently not surfaced in the UI.

## Damage chart
File: `league-calculator/app/components/DamageChart.tsx`
- Plots expected auto damage over armor range.
- Optional target bonus HP range mode:
  - Computes min/max damage for LDR builds.
- Tooltip compares builds at hovered armor value.
- Must pass rune/champion/Draven config into `calculateSingleAutoDamage`.

## Share/import flow (URL + paste)
Files:
- `league-calculator/app/components/ShareModal.tsx`
- `league-calculator/app/components/ImportModal.tsx`
- `league-calculator/app/components/BuildPanel.tsx`
- `league-calculator/app/utils/encoder.ts`

Summary:
- Share creates either a raw code string or a URL with `#builds=...`.
- Import accepts:
  - Raw encoded JSON
  - `builds=` prefixed text
  - Full share URL with hash
- URL imports always open the Import modal first.
- Import lets you choose which builds and settings to apply, and optionally replace
  existing builds.

Encoder format (JSON, no base64):
```
{
  "v": 1,
  "c": "aphelios" | "draven",
  "l": number,
  "b": [{ "n": name, "i": [itemIds], "b": [bonusAD, bonusLethality, bonusCrit] }],
  "r": { "af": boolean, "gs": minutes, "ad": adShardCount },
  "d": { "e": boolean, "q": qLevel, "l": qLevelLinked }
}
```
Validation rules:
- Champion id is restricted to supported list.
- AD shard count is clamped to 0-2.
- Draven Q level is clamped to 1-5.
- Draven data is only included/used if champion is Draven.

Draven link invariant:
- If Q level link is on, Q level always follows `getQRankFromChampLevel`.
- Import respects this: when `dravenQLevelLinked` is true, imported Q level is
  ignored and the linked value is used.

Touchpoints for new shared state:
- `CalculatorPage` state + localStorage save/load.
- Share modal include toggles and encoder args.
- Import modal options and decode handling.
- BuildPanel import wiring and URL auto-import behavior.
- `encoder.ts` format and validation.

## Items data (generated)
Files:
- `league-calculator/app/data/Items.ts` (generated)
- `league-calculator/app/data/item-ids.ts` (generated)
- Images: `league-calculator/public/images/items/*.png`

Items are used for:
- Build stats and calculations.
- Item selection in UI.
- Encoding/decoding by numeric IDs.

Encoder hard requirement:
- `encoder.ts` throws if `ITEM_IDS` is missing or empty.

## Python data pipeline (Cassiopeia)
File: `createitems/cass.py`
- Fetches item data via Cassiopeia (network required).
- Filters to Summoner's Rift (map id 11).
- Filters out ARAM and Arena special items.
- Deduplicates items by name (keeps lowest item id).
- Normalizes alias order for deterministic diffs.
- Downloads item images into `league-calculator/public/images/items/`.
- Writes:
  - `league-calculator/app/data/Items.ts`
  - `league-calculator/app/data/item-ids.ts`
  - `league-calculator/app/data/champions.ts`
  - `league-calculator/app/data/runes.ts`
- Adds alias shortcuts (e.g., LDR, LW, yuntal).

Related doc:
- `league-calculator/CASSIOPEIA_INTEGRATION.md`
- `league-calculator/encoder-demo.md`

If item data or images look wrong, check:
- Cassiopeia data availability.
- Filters and dedupe logic in `createitems/cass.py`.
- Generated files and image paths.

## Collector analysis feature
Files:
- `league-calculator/app/collector/page.tsx`
- `league-calculator/app/components/CollectorAnalysis.tsx`
- `league-calculator/app/components/CollectorEfficiencyChart.tsx`
- `league-calculator/app/components/CollectorConceptViz.tsx`
- `league-calculator/app/utils/collectorMath.ts`
- Styles in `league-calculator/app/styles/CollectorAnalysis.css`.

State and persistence:
- `collector_maxHp` and `collector_autoDamage` in localStorage.

## Quick change checklist for new features
When adding any new state or calculation, check:
1) State in `CalculatorPage` (defaults, localStorage save/load).
2) UI controls (compact + full variants).
3) Calculations in `Calculator.ts` and any call sites.
4) Chart and tooltip usage in `DamageChart.tsx`.
5) Share/Import: `ShareModal.tsx`, `ImportModal.tsx`, `BuildPanel.tsx`,
   `encoder.ts` (encode/decode and validation).
6) Data sources (`champions.ts`, `Items.ts`, images) if needed.
7) Collector page if the feature impacts it.

This doc should be kept up to date when new features are added.
