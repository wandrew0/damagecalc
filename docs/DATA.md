# Game data and updates

The app imports checked-in TypeScript data and serves local item icons. Live data fetching happens in [createitems/cass.py](../createitems/cass.py), separately from normal app startup and builds.

## Sources and outputs

| Data | Source | Generated output |
| --- | --- | --- |
| Item stats, names, costs, IDs, and images | [Cassiopeia](https://github.com/meraki-analytics/cassiopeia), using NA static data | [Items.ts](../league-calculator/app/data/Items.ts), [item-ids.ts](../league-calculator/app/data/item-ids.ts), [item images](../league-calculator/public/images/items/) |
| Aphelios and Draven base AD and growth; Draven Q; Aphelios passive ranks | [CommunityDragon](https://www.communitydragon.org/) champion data | [champions.ts](../league-calculator/app/data/champions.ts) |
| Absolute Focus and adaptive-force shard constants | CommunityDragon perk descriptions | [runes.ts](../league-calculator/app/data/runes.ts) |

Cassiopeia is a community Python library that supports Riot's [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) and other data sources. It is not an official Riot API. The generator uses CommunityDragon's `latest` data, so rerunning it later can produce a different snapshot.

Item selection keeps Summoner's Rift entries with AD, crit chance, lethality, or percent armor penetration. It excludes Guardian's items and IDs of 100000 or higher, and deduplicates equal names by taking the lowest ID. These filters depend on upstream metadata. A curated set of armor-item icons is also downloaded for enemy timelines, without adding those armor-only items to the offensive item picker.

Overrides are applied after selection, then aliases are deduplicated and sorted, and items are sorted by name before output. Images left over from previous runs are not automatically removed.

## Refresh locally

Use Python 3.12, matching the workflow. From the repository root on macOS or Linux:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install cassiopeia requests
.venv/bin/python createitems/cass.py
```

On Windows, use `.venv\Scripts\python.exe` for the last two commands. The generator needs network access; the checked-in workflow does not configure a Riot API key.

Review the output before committing:

```bash
git diff --stat
git diff -- league-calculator/app/data
```

Inspect changed icons, compare changed stats with the intended patch, and check the affected tools in the app. The script writes outputs as it progresses, so a failed run can leave partially updated files. A successful local exit can also include fallback warnings. Review both the log and the diff.

For an intentional item correction or search alias, edit [item-overrides.json](../createitems/item-overrides.json), then regenerate. [Item override modes](../createitems/ITEM_OVERRIDES.md) documents direct values, sets, and list operations. Overrides only apply to items already selected by the generator.

## Scheduled updates

The [Update League data workflow](../.github/workflows/update-data.yml) is scheduled daily at **11:00 UTC** and also accepts manual dispatch.

Before fetching anything, it compares the current date in `America/Los_Angeles` with [.github/patch-dates.txt](../.github/patch-dates.txt). Generation runs only on a listed date or one of the following three days. **Manual dispatch uses the same gate**; it does not force an update outside the window.

Inside the window, the workflow installs Python dependencies, runs the generator, and commits changes to the four generated TypeScript files and item-image directory. A failing generator exits before the commit step. The workflow also rejects logs containing `Warning:`.

Fallback behavior is specific:

- Missing CommunityDragon base stats fall back to Cassiopeia and emit a warning.
- Unparseable rune descriptions can use built-in constants and emit warnings.
- Failed Draven Q or Aphelios passive extraction raises an error.
- Image downloads retry three times, then log a failure and return `false`. That message does not contain `Warning:`, and the caller does not stop generation, so inspect missing or stale images separately.

Keep the patch-date list current. The schedule and warning gate do not guarantee that upstream data has caught up with a patch.

## What needs manual maintenance

| Area | Source |
| --- | --- |
| Enemy armor profiles and armor-item values | [enemyArmor.ts](../league-calculator/app/data/enemyArmor.ts) |
| Crit multipliers and build aggregation | [Build.ts](../league-calculator/app/classes/Build.ts) |
| Giant Slayer, Hexoptics, and Gathering Storm formulas | [Calculator.ts](../league-calculator/app/classes/Calculator.ts) |
| Aphelios rank gates and optimization rules | [apheliosCutoff.ts](../league-calculator/app/utils/apheliosCutoff.ts) |
| Collector threshold and analytical models | [collectorMath.ts](../league-calculator/app/features/collector/lib/collectorMath.ts) |
| Linked Draven Q rank schedule emitted into `champions.ts` | [cass.py](../createitems/cass.py) |

Update these when their behavior changes; refreshing generated data does not update the formulas.

Build sharing uses the generated numeric item IDs. Imports resolve those IDs against the app's current data and recalculate build stats, so a shared build is not a frozen record of an older patch. See [Build sharing](../league-calculator/encoder-demo.md).
