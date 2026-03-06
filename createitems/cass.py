"""
Fetches League of Legends items using Cassiopeia and generates TypeScript item definitions.

This script automatically deduplicates items with the same name by keeping only the one
with the lowest item ID. This prevents duplicate entries from special game modes or 
temporary variants introduced by Riot.
"""

import cassiopeia as cass
import json
import requests
import time
import re
from pathlib import Path
from collections.abc import Sequence
from typing import Optional, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

CDragon_BASE = "https://raw.communitydragon.org/latest"
CDRAGON_CHAR_URL = CDragon_BASE + "/game/data/characters/{key}/{key}.bin.json"
CDRAGON_PERKS_URL = (
    CDragon_BASE
    + "/plugins/rcp-be-lol-game-data/global/default/v1/perks.json"
)

maps = cass.get_maps(region="NA")
map_lookup = {int(m.id): m.name for m in maps}

all_items = cass.get_items(region="NA")

# Download images directly to league-calculator public directory
images_dir = REPO_ROOT / "league-calculator/public/images/items"
images_dir.mkdir(parents=True, exist_ok=True)

CHAMPION_CONFIG = {
    "aphelios": {
        "name": "Aphelios",
        "cdragon_key": "aphelios",
    },
    "draven": {
        "name": "Draven",
        "cdragon_key": "draven",
    },
}

RUNE_FALLBACK = {
    "absolute_focus": {"min_ad": 1.8, "max_ad": 18},
    "adaptive_force": {"amount": 9, "ad_per_point": 0.6},
}

ITEM_OVERRIDES_PATH = SCRIPT_DIR / "item-overrides.json"

# Keep armor-only target timeline items synced to locally downloaded images.
# These may not pass the AD/crit/lethality/armor-pen filter for ALL_ITEMS.
CURATED_ARMOR_IMAGE_ITEM_NAMES = {
    "Cloth Armor",
    "Plated Steelcaps",
    "Chain Vest",
    "Warden's Mail",
    "Bramble Vest",
    "Frozen Heart",
    "Thornmail",
    "Randuin's Omen",
    "Sunfire Aegis",
    "Dead Man's Plate",
    "Guardian Angel",
}

def download_image(url, filename, max_retries=3):
    """Download an image from URL and save it to the images directory with retry logic"""
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            filepath = images_dir / filename
            with open(filepath, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded: {filename}")
            return True
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Attempt {attempt + 1} failed for {filename}: {e}. Retrying...")
                time.sleep(1)  # Wait 1 second before retry
            else:
                print(f"Failed to download {filename} after {max_retries} attempts: {e}")
                return False

relevant_stats = [
    ("attackDamage", "attack_damage"),
    ("criticalStrikeChance", "crit_chance"),
]

arptag = "ArmorPenetration"

# Dictionary to track items by name and keep only the one with the lowest ID
items_by_name = {}

def _format_number(value: float) -> str:
    value_float = float(value)
    if abs(value_float - round(value_float)) < 1e-9:
        return str(int(round(value_float)))
    return f"{value_float:.4f}".rstrip("0").rstrip(".")

def _format_number_list(values: Sequence[float]) -> str:
    return ", ".join(_format_number(v) for v in values)

def _fetch_json(url: str):
    response = requests.get(url, timeout=20)
    response.raise_for_status()
    return response.json()

def _normalize_spell_values(values: Sequence[float], expected_len: int = 5) -> Sequence[float]:
    if not values:
        return []
    if len(values) == expected_len:
        return list(values)
    if len(values) > expected_len:
        # CDragon often includes a padding value at index 0; use levels 1-5.
        if len(values) >= expected_len + 1:
            return list(values[1 : expected_len + 1])
    return list(values[:expected_len])

def _normalize_aliases(aliases: Sequence[str]) -> list[str]:
    if not aliases:
        return []
    if isinstance(aliases, (str, bytes)):
        raise ValueError("Item aliases must be a list of strings, not a single string.")
    cleaned = [alias for alias in aliases if isinstance(alias, str) and alias.strip()]
    seen = set()
    unique = []
    for alias in cleaned:
        key = alias.lower()
        if key not in seen:
            seen.add(key)
            unique.append(alias)
    unique.sort(key=lambda s: (s.lower(), s))
    return unique

def _load_item_overrides(path: Path) -> dict[str, dict]:
    """Load item overrides from JSON.

    Expected shape:
    {
      "items": {
        "<item name>": {
          "<field>": <direct value> | {
            "mode": "set" | "replace" | "add" | "remove" | "patch",
            ...
          }
        }
      }
    }
    """
    if not path.exists():
        return {}

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc

    if not isinstance(payload, dict):
        raise ValueError(f"{path} must contain a JSON object.")

    raw_items = payload.get("items", {})
    if not isinstance(raw_items, dict):
        raise ValueError(f"{path} must define an object at 'items'.")

    for item_name, field_overrides in raw_items.items():
        if not isinstance(field_overrides, dict):
            raise ValueError(
                f"{path} item '{item_name}' must map to an object of field overrides."
            )

    return raw_items

def _coerce_override_list(value, context: str) -> list:
    if not isinstance(value, list):
        raise ValueError(f"{context} must be a list.")
    return list(value)

def _remove_list_values(values: Sequence, to_remove: Sequence) -> list:
    if all(isinstance(v, str) for v in values) and all(
        isinstance(v, str) for v in to_remove
    ):
        remove_set = {v.lower() for v in to_remove}
        return [v for v in values if v.lower() not in remove_set]
    return [v for v in values if v not in to_remove]

def _apply_list_override(current_values: Sequence, override_spec: dict, context: str) -> list:
    mode = override_spec.get("mode")
    if mode not in {"replace", "add", "remove", "patch"}:
        raise ValueError(
            f"{context} has unsupported mode '{mode}'. "
            "Use one of: replace, add, remove, patch."
        )

    updated = list(current_values)

    if mode == "replace":
        return _coerce_override_list(override_spec.get("values"), f"{context}.values")
    if mode == "add":
        updated.extend(
            _coerce_override_list(override_spec.get("values"), f"{context}.values")
        )
        return updated
    if mode == "remove":
        return _remove_list_values(
            updated,
            _coerce_override_list(override_spec.get("values"), f"{context}.values"),
        )

    if "replace" in override_spec:
        updated = _coerce_override_list(override_spec["replace"], f"{context}.replace")
    if "add" in override_spec:
        updated.extend(_coerce_override_list(override_spec["add"], f"{context}.add"))
    if "remove" in override_spec:
        updated = _remove_list_values(
            updated, _coerce_override_list(override_spec["remove"], f"{context}.remove")
        )
    return updated

def _apply_field_override(item_name: str, item_data: dict, field_name: str, override):
    context = f"override {item_name}.{field_name}"

    # Shorthand: direct value means full replacement for that field.
    if not (isinstance(override, dict) and "mode" in override):
        item_data[field_name] = override
        return

    mode = override["mode"]
    if mode == "set":
        if "value" not in override:
            raise ValueError(f"{context} mode=set requires a 'value'.")
        item_data[field_name] = override["value"]
        return

    current_value = item_data.get(field_name, [])
    if not isinstance(current_value, list):
        raise ValueError(
            f"{context} mode={mode} can only be used on list fields. "
            f"Current value is {type(current_value).__name__}."
        )

    item_data[field_name] = _apply_list_override(current_value, override, context)

def _apply_item_overrides(item_defs: Sequence[dict], item_overrides: dict[str, dict]) -> None:
    if not item_overrides:
        return

    item_lookup = {item["name"]: item for item in item_defs}
    for item_name, field_overrides in item_overrides.items():
        item = item_lookup.get(item_name)
        if not item:
            print(f"Warning: Item override skipped (unknown item): {item_name}")
            continue

        for field_name, override in field_overrides.items():
            _apply_field_override(item_name, item, field_name, override)

def _get_nested_value(node: dict, path: Sequence[str]):
    current = node
    for key in path:
        if not isinstance(current, dict) or key not in current:
            return None
        current = current[key]
    return current

def _get_cdragon_champion_stats(champ_name: str, champ_key: str) -> Tuple[float, float]:
    url = CDRAGON_CHAR_URL.format(key=champ_key)
    data = _fetch_json(url)
    root_key = f"Characters/{champ_name}/CharacterRecords/Root"
    root = data.get(root_key)
    if not root:
        raise ValueError(f"Missing CDragon root data at {root_key}")

    # CDragon moved several basic stats behind hashed keys in 16.5.x. Keep the
    # older named paths first so this still works if Riot restores readable keys.
    base_ad = _get_nested_value(root, ("baseDamage",))
    if base_ad is None:
        base_ad = _get_nested_value(root, ("{4af40dc3}", "{b35aa769}"))

    ad_growth = _get_nested_value(root, ("damagePerLevel",))
    if ad_growth is None:
        ad_growth = _get_nested_value(root, ("{e2b5d80d}", "{b35aa769}"))

    if base_ad is None or ad_growth is None:
        raise ValueError(
            "Unable to locate champion base AD or AD growth in CDragon root data."
        )

    base_ad = float(base_ad)
    ad_growth = float(ad_growth)
    return base_ad, ad_growth

def _get_cdragon_draven_q(champ_name: str, champ_key: str) -> Tuple[Sequence[float], Sequence[float]]:
    url = CDRAGON_CHAR_URL.format(key=champ_key)
    data = _fetch_json(url)
    spell_key = (
        f"Characters/{champ_name}/Spells/DravenSpinningAbility/DravenSpinning"
    )
    node = data.get(spell_key)
    if not node or "mSpell" not in node:
        raise ValueError("Missing CDragon Draven Q spell data.")
    data_values = node["mSpell"].get("DataValues", [])
    base_vals = None
    scaling_vals = None
    for entry in data_values:
        name = entry.get("mName")
        if name == "BaseDamage":
            base_vals = entry.get("mValues", [])
        elif name == "ADScaling":
            scaling_vals = entry.get("mValues", [])
    if not base_vals or not scaling_vals:
        raise ValueError("Unable to locate BaseDamage or ADScaling in CDragon data.")
    base_damage = _normalize_spell_values(base_vals, expected_len=5)
    bonus_scaling = _normalize_spell_values(scaling_vals, expected_len=5)
    return base_damage, bonus_scaling

def _collect_cdragon_data_values(node, output: list[dict]) -> None:
    if isinstance(node, dict):
        mspell = node.get("mSpell")
        if isinstance(mspell, dict):
            data_values = mspell.get("DataValues")
            if isinstance(data_values, list):
                output.extend([entry for entry in data_values if isinstance(entry, dict)])

        for key in ("DataValues", "mDataValues"):
            values = node.get(key)
            if isinstance(values, list):
                output.extend([entry for entry in values if isinstance(entry, dict)])

        for value in node.values():
            _collect_cdragon_data_values(value, output)
    elif isinstance(node, list):
        for value in node:
            _collect_cdragon_data_values(value, output)

def _pick_aphelios_passive_values(
    data_values: Sequence[dict],
) -> Tuple[Optional[Sequence[float]], Optional[Sequence[float]]]:
    def to_cumulative(values: Sequence[float]) -> list[float]:
        total = 0.0
        output: list[float] = []
        for value in values:
            total += float(value)
            output.append(total)
        return output

    q_bonus = None
    e_bonus = None

    for entry in data_values:
        name = str(entry.get("mName", "")).lower()
        values = entry.get("mValues", [])
        if not isinstance(values, Sequence) or isinstance(values, (str, bytes)):
            continue

        normalized = [float(v) for v in _normalize_spell_values(values, expected_len=6)]
        if len(normalized) != 6:
            continue

        # CDragon currently exposes passive ranks as per-rank increments (e.g. ADPerRank/APPerRank).
        # Convert those increment arrays into cumulative totals by rank to match calculator usage.
        if "perrank" in name:
            normalized = to_cumulative(normalized)

        if (
            q_bonus is None
            and (
                "attackdamage" in name
                or "bonusad" in name
                or "bonusattackdamage" in name
                or "adperrank" in name
            )
            and "ratio" not in name
        ):
            q_bonus = normalized

        if (
            e_bonus is None
            and (
                "lethality" in name
                or "armorpenetration" in name
                or "apperrank" in name
            )
            and "ratio" not in name
        ):
            e_bonus = normalized

        if q_bonus is not None and e_bonus is not None:
            break

    return q_bonus, e_bonus

def _get_cdragon_aphelios_passive(
    champ_name: str, champ_key: str
) -> Tuple[Sequence[float], Sequence[float]]:
    url = CDRAGON_CHAR_URL.format(key=champ_key)
    data = _fetch_json(url)

    passive_values = []
    for key, node in data.items():
        key_lower = key.lower()
        if "apheliospassive" in key_lower or (
            "aphelios" in key_lower and "passive" in key_lower
        ):
            _collect_cdragon_data_values(node, passive_values)

    if not passive_values:
        _collect_cdragon_data_values(data, passive_values)

    q_bonus, e_bonus = _pick_aphelios_passive_values(passive_values)
    if not q_bonus or not e_bonus:
        available_names = sorted(
            {
                str(entry.get("mName", ""))
                for entry in passive_values
                if isinstance(entry, dict) and entry.get("mName")
            }
        )
        preview = ", ".join(available_names[:20])
        raise ValueError(
            "Unable to locate Aphelios passive Q/E values in CDragon data. "
            f"Found mName entries (first 20): {preview}"
        )

    return q_bonus, e_bonus

def _extract_rune_data() -> dict:
    perks = _fetch_json(CDRAGON_PERKS_URL)
    def find_perk(name: str) -> Optional[dict]:
        return next((p for p in perks if p.get("name") == name), None)

    fallback_used = False

    absolute_focus = find_perk("Absolute Focus")
    adaptive_force = find_perk("Adaptive Force")

    if not absolute_focus or not adaptive_force:
        print("Warning: Unable to locate rune data in CDragon. Using fallback values.")
        return RUNE_FALLBACK

    af_desc = absolute_focus.get("longDesc", "")
    ad_matches = re.findall(r"([0-9]+(?:\.[0-9]+)?)\s*Attack Damage", af_desc)
    ad_values = [float(v) for v in ad_matches]
    if len(ad_values) < 2:
        print("Warning: Unable to parse Absolute Focus numbers. Using fallback values.")
        absolute_focus_data = RUNE_FALLBACK["absolute_focus"]
        fallback_used = True
    else:
        absolute_focus_data = {
            "min_ad": min(ad_values),
            "max_ad": max(ad_values),
        }

    af_short = adaptive_force.get("shortDesc", "")
    af_match = re.search(r"\+\s*([0-9]+(?:\.[0-9]+)?)", af_short)
    if not af_match:
        print("Warning: Unable to parse Adaptive Force value. Using fallback values.")
        adaptive_force_data = RUNE_FALLBACK["adaptive_force"]
        fallback_used = True
    else:
        adaptive_force_data = {
            "amount": float(af_match.group(1)),
            "ad_per_point": RUNE_FALLBACK["adaptive_force"]["ad_per_point"],
        }

    if fallback_used:
        print("Warning: Rune fallback values applied; verify generated rune data.")

    return {
        "absolute_focus": absolute_focus_data,
        "adaptive_force": adaptive_force_data,
    }

for item in all_items:
    if not any(m.id == 11 for m in item.maps):
        continue

    stats = item.stats  # ItemStatsData
    data = {
        "name": item.name,
        "cost": item.gold.total or 0,
        "has_crit": item.name == "Infinity Edge",
        "aliases": item.keywords or [],
    }
    hassomething = False
    lethality = 0
    armorpen = 0
    if arptag in item.tags:
        if "> Lethality" in item.description:
            lethality = int(
                item.description.split("</attention> Lethality")[0].split(
                    "<attention>"
                )[-1]
            )
        if "> Armor Penetration" in item.description:
            armorpen = (
                float(
                    item.description.split("</attention> Armor Penetration")[0].split(
                        "<attention>"
                    )[-1][:-1]
                )
                / 100.0
            )
        hassomething = lethality != 0 or armorpen != 0
    data["lethality"] = lethality
    data["armor_pen"] = armorpen

    # Safely pull each stat (defaulting to 0 if missing)
    for attr_name, out_key in relevant_stats:
        # Some attributes might be missing entirely → getattr with default
        value = getattr(stats, attr_name, 0) or 0
        if value != 0:
            hassomething = True
        data[out_key] = value

    # Only add items that have at least one relevant stat
    # Filter out ARAM items (Guardian's Blade, Guardian's Hammer)
    if item.name.startswith("Guardian's"):
        continue
    # Filter out Arena items (6-digit IDs like Atma's Reckoning, Sword of the Divine, etc.)
    if int(item.id) >= 100000:
        continue
    force_download_image = item.name in CURATED_ARMOR_IMAGE_ITEM_NAMES
    if hassomething or force_download_image:
        # print(f"Processing: {item.name}")
        # map_ids = [m.id for m in item.maps]
        # map_names = [map_lookup.get(mid, f"Unknown({mid})") for mid in map_ids]
        # print(f"  Maps: {map_names}")

        # Download item image
        image_url = item.image.url
        
        # Debug: Print image properties for the first few items
        if hassomething and len(items_by_name) < 3:
            print(f"\nImage data for {item.name}:")
            print(f"  URL: {item.image.url}")
            print(f"  Width: {getattr(item.image, 'width', 'N/A')}")
            print(f"  Height: {getattr(item.image, 'height', 'N/A')}")
            print(f"  Sprite info: {getattr(item.image, 'sprite_info', 'N/A')}")
            print(f"  Available attributes: {[attr for attr in dir(item.image) if not attr.startswith('_')]}")
        
        # Create a safe filename from the item name
        safe_name = "".join(c for c in item.name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_name = safe_name.replace(' ', '_')
        filename = f"{safe_name}.png"
        
        download_image(image_url, filename)
        data["image_path"] = f"/images/items/{filename}"
        data["item_id"] = int(item.id)

        # Keep armor-only image downloads local, but don't include them in ALL_ITEMS.
        if not hassomething:
            continue
        
        # Check if we already have this item name
        item_name = item.name
        if item_name in items_by_name:
            # Keep the one with the lower ID (likely the original, not a mode-specific variant)
            existing_id = items_by_name[item_name]["item_id"]
            if data["item_id"] < existing_id:
                print(f"Replacing duplicate '{item_name}': ID {existing_id} -> {data['item_id']} (keeping lower ID)")
                items_by_name[item_name] = data
            else:
                print(f"Skipping duplicate '{item_name}': ID {data['item_id']} (keeping existing ID {existing_id})")
        else:
            items_by_name[item_name] = data

# Convert dictionary to list
item_defs = list(items_by_name.values())

item_overrides = _load_item_overrides(ITEM_OVERRIDES_PATH)
if item_overrides:
    print(f"Applying overrides for {len(item_overrides)} item(s) from {ITEM_OVERRIDES_PATH}")
_apply_item_overrides(item_defs, item_overrides)

for it in item_defs:
    raw_aliases = it.get("aliases", [])
    if not isinstance(raw_aliases, list):
        raise ValueError(
            f"Item '{it['name']}' has invalid aliases override. Expected list, got "
            f"{type(raw_aliases).__name__}."
        )
    it["aliases"] = _normalize_aliases(raw_aliases)

item_defs.sort(key=lambda it: it["name"].lower())

# Emit your TypeScript file directly to league-calculator
with open(REPO_ROOT / "league-calculator/app/data/Items.ts", "w", encoding="utf-8") as f:
    f.write('import { Item } from "../classes/Item";\n\nexport const ALL_ITEMS = [\n')
    for it in item_defs:
        f.write(
            f"    new Item("
            f'"{it["name"]}", {it["cost"]}, {it["attack_damage"]}, '
            f'{it["crit_chance"]}, {"true" if it["has_crit"] else "false"}, '
            f'{it["lethality"]}, {it["armor_pen"]}, '
            f'{it["aliases"]!r}, '
            f'"{it["image_path"]}"'
            "),\n"
        )
    f.write("];\n")

# Generate item ID mapping for encoder (using already deduplicated items)
print("\nGenerating item ID mapping...")
item_id_mapping = {item["name"]: item["item_id"] for item in item_defs}

# Create TypeScript version directly in the league-calculator app directory
ts_output_path = REPO_ROOT / "league-calculator/app/data/item-ids.ts"
with open(ts_output_path, "w", encoding="utf-8") as f:
    f.write("// Auto-generated item ID mapping from Cassiopeia\n")
    f.write("export const ITEM_IDS: { [key: string]: number } = {\n")
    for name, item_id in item_id_mapping.items():
        f.write(f'    "{name}": {item_id},\n')
    f.write("};\n")

print(f"Generated mapping for {len(item_id_mapping)} items")
print(f"Item ID mapping saved to {ts_output_path}")
print(f"Items.ts updated in league-calculator/app/data/")
print(f"Item images downloaded to league-calculator/public/images/items/")

# Generate champions.ts from CDragon (fallback to Cassiopeia)
print("\nGenerating champion data...")
champion_rows = []
draven_q_base = None
draven_q_scaling = None
aphelios_q_bonus = None
aphelios_e_bonus = None

for champ_id, config in CHAMPION_CONFIG.items():
    base_ad = None
    ad_growth = None
    try:
        base_ad, ad_growth = _get_cdragon_champion_stats(
            config["name"], config["cdragon_key"]
        )
    except Exception as e:
        print(f"Warning: CDragon stats failed for {config['name']}: {e}")
        print(f"Warning: Using Cassiopeia fallback for {config['name']} base stats.")
        champion = cass.get_champion(config["name"], region="NA")
        base_ad = float(champion.stats.attack_damage)
        ad_growth = float(champion.stats.attack_damage_per_level)

    champion_rows.append(
        {
            "id": champ_id,
            "name": config["name"],
            "base_ad": base_ad,
            "ad_growth": ad_growth,
        }
    )

    if champ_id == "draven":
        try:
            draven_q_base, draven_q_scaling = _get_cdragon_draven_q(
                config["name"], config["cdragon_key"]
            )
        except Exception as e:
            raise ValueError(f"CDragon Draven Q extraction failed: {e}") from e

    if champ_id == "aphelios":
        try:
            aphelios_q_bonus, aphelios_e_bonus = _get_cdragon_aphelios_passive(
                config["name"], config["cdragon_key"]
            )
        except Exception as e:
            raise ValueError(f"CDragon Aphelios passive extraction failed: {e}") from e

if not draven_q_base or not draven_q_scaling:
    raise ValueError("Draven Q data missing; champions.ts not generated.")
if not aphelios_q_bonus or not aphelios_e_bonus:
    raise ValueError("Aphelios passive data missing; champions.ts not generated.")

champions_output_path = REPO_ROOT / "league-calculator/app/data/champions.ts"
with open(champions_output_path, "w", encoding="utf-8") as f:
    f.write("// Auto-generated by createitems/cass.py. Do not edit by hand.\n")
    f.write('import { Champion } from "../classes/Champion";\n\n')
    f.write('export type ChampionId = "aphelios" | "draven";\n\n')
    f.write("export interface ChampionData {\n")
    f.write("    id: ChampionId;\n")
    f.write("    name: string;\n")
    f.write("    baseAD: number;\n")
    f.write("    adGrowth: number;\n")
    f.write("}\n\n")
    f.write("export const CHAMPIONS: Record<ChampionId, ChampionData> = {\n")
    for row in champion_rows:
        f.write(f'    {row["id"]}: {{\n')
        f.write(f'        id: "{row["id"]}",\n')
        f.write(f'        name: "{row["name"]}",\n')
        f.write(f"        baseAD: {_format_number(row['base_ad'])},\n")
        f.write(f"        adGrowth: {_format_number(row['ad_growth'])},\n")
        f.write("    },\n")
    f.write("};\n\n")
    f.write("export function createChampion(id: ChampionId): Champion {\n")
    f.write("    const data = CHAMPIONS[id];\n")
    f.write("    return new Champion(data.name, data.baseAD, data.adGrowth);\n")
    f.write("}\n\n")
    f.write("// Draven Spinning Axe data (CDragon)\n")
    f.write("export const SPINNING_AXE = {\n")
    f.write(f"    baseDamage: [{_format_number_list(draven_q_base)}],\n")
    f.write(f"    bonusAdScaling: [{_format_number_list(draven_q_scaling)}],\n")
    f.write("};\n\n")
    f.write("// Aphelios passive stat totals by rank (CDragon)\n")
    f.write("export const APHELIOS_PASSIVE = {\n")
    f.write(f"    qBonusAdByRank: [{_format_number_list(aphelios_q_bonus)}],\n")
    f.write(
        f"    eBonusLethalityByRank: [{_format_number_list(aphelios_e_bonus)}],\n"
    )
    f.write("};\n\n")
    f.write("/**\n")
    f.write(" * Calculate Q level from champion level when maxing Q first.\n")
    f.write(" * Standard skill order: Q at 1, W at 2, E at 3, Q at 4, Q at 5, R at 6, Q at 7, secondary at 8, Q at 9\n")
    f.write(" * @param champLevel - Champion level (1-18)\n")
    f.write(" * @returns Q ability level (1-5)\n")
    f.write(" */\n")
    f.write("export function getQRankFromChampLevel(champLevel: number): number {\n")
    f.write("    if (champLevel >= 9) return 5;\n")
    f.write("    if (champLevel >= 7) return 4;\n")
    f.write("    if (champLevel >= 5) return 3;\n")
    f.write("    if (champLevel >= 4) return 2;\n")
    f.write("    return 1; // Levels 1-3\n")
    f.write("}\n")

print(f"Champion data saved to {champions_output_path}")

print("\nGenerating rune data...")
rune_data = _extract_rune_data()
runes_output_path = REPO_ROOT / "league-calculator/app/data/runes.ts"
with open(runes_output_path, "w", encoding="utf-8") as f:
    f.write("// Auto-generated by createitems/cass.py. Do not edit by hand.\n")
    f.write("export const RUNE_DATA = {\n")
    f.write("    absoluteFocus: {\n")
    f.write(
        f"        minAd: {_format_number(rune_data['absolute_focus']['min_ad'])},\n"
    )
    f.write(
        f"        maxAd: {_format_number(rune_data['absolute_focus']['max_ad'])},\n"
    )
    f.write("    },\n")
    f.write("    adaptiveForce: {\n")
    f.write(
        f"        amount: {_format_number(rune_data['adaptive_force']['amount'])},\n"
    )
    f.write(
        f"        adPerPoint: {_format_number(rune_data['adaptive_force']['ad_per_point'])},\n"
    )
    f.write("    },\n")
    f.write("};\n")

print(f"Rune data saved to {runes_output_path}")
