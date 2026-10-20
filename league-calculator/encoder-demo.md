# Build sharing

Source: [encoder.ts](app/utils/encoder.ts), with URL and paste handling in [CalculatorPage.tsx](app/features/calculator/CalculatorPage.tsx) and [ImportModal.tsx](app/features/calculator/components/ImportModal.tsx).

Share codes are compact JSON. Items are represented by numeric IDs from [item-ids.ts](app/data/item-ids.ts), and derived build stats are recalculated on import.

## Format

This example contains a level-11 Aphelios build with The Collector and Infinity Edge, 24 manual bonus AD, 18 manual lethality, and two AD shards:

```json
{
  "v": 1,
  "c": "aphelios",
  "l": 11,
  "b": [
    { "n": "Collector + IE", "i": [6676, 3031], "b": [24, 18, 0] }
  ],
  "r": { "af": false, "gs": 0, "ad": 2 }
}
```

| Field | Meaning |
| --- | --- |
| `v` | Writer's format version, currently `1`; the decoder does not enforce it |
| `c`, `l` | Optional champion ID (`aphelios` or `draven`) and level |
| `b` | Build array; each entry has name `n`, item IDs `i`, and bonuses `b` |
| Build `b` | `[bonusAD, bonusLethality, bonusCritChance]`; crit uses a fraction, so `0.25` means 25% |
| `r` | Optional runes: Absolute Focus `af`, Gathering Storm minutes `gs`, AD shard count `ad` |
| `d` | Optional Draven settings: Q enabled `e`, Q rank `q`, linked rank `l` |

For example, Draven Q enabled and linked to champion level is represented by `"d": { "e": true, "q": 5, "l": true }` alongside `"c": "draven"`. A linked rank is derived from champion level when applied, rather than taken from the stored `q` value.

The share dialog lets users omit optional settings. Target armor, target bonus HP, Hexoptics distance, and other pages' timelines are not part of this format. Item stats and patch versions are not embedded: the same code can produce different results after game data changes.

## URLs and imports

Copy URL places `encodeURIComponent(code)` in `/calculator#builds=...`. Copy Code returns the JSON directly, without Base64 encoding. The import dialog accepts raw JSON, `builds=` followed by raw JSON, or a full share URL. Legacy root-page hash links redirect to the calculator.

Users select which parsed builds and settings to apply, and whether to replace existing builds. Levels are rounded and clamped to 1–18, AD shards to 0–2, and Draven Q ranks to 1–5. Gathering Storm minutes are rounded to 10-minute steps and clamped at zero. Unrecognized item IDs are skipped, and the build's item limit is six.

The decoder requires the checked-in item ID mapping. There is no sequential-ID generator or runtime fallback mapping. A separate legacy decoder accepts JSON arrays of serialized builds; the current JSON decoder does not recognize every older payload as a legacy format. Base64 decoding is not implemented.
