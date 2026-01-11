"""
Fetches League of Legends items using Cassiopeia and generates TypeScript item definitions.

This script automatically deduplicates items with the same name by keeping only the one
with the lowest item ID. This prevents duplicate entries from special game modes or 
temporary variants introduced by Riot.
"""

import cassiopeia as cass
import requests
import time
import re
from pathlib import Path
from collections.abc import Iterable, Sequence
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
        "q_spell_id": "DravenSpinning",
        "q_spell_name": "Spinning Axe",
        "cdragon_key": "draven",
    },
}

DRAVEN_Q_FALLBACK = {
    "base_damage": [40, 45, 50, 55, 60],
    "bonus_ad_scaling": [0.75, 0.85, 0.95, 1.05, 1.15],
}

RUNE_FALLBACK = {
    "absolute_focus": {"min_ad": 1.8, "max_ad": 18},
    "adaptive_force": {"amount": 9, "ad_per_point": 0.6},
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

def _extract_effect_values(effect) -> Optional[Sequence[float]]:
    for attr in ("values", "values_by_level", "levels"):
        if hasattr(effect, attr):
            values = getattr(effect, attr)
            if isinstance(values, Iterable):
                return list(values)
    return None

def _pick_level_list(candidates: Iterable[Sequence[float]], expected_len: int = 5) -> Optional[Sequence[float]]:
    for values in candidates:
        if not values:
            continue
        if len(values) == expected_len and any(v is not None and v != 0 for v in values):
            return list(values)
    return None

def _get_spell_raw(spell) -> Optional[dict]:
    for attr in ("raw", "raw_data", "_data"):
        if hasattr(spell, attr):
            raw = getattr(spell, attr)
            if isinstance(raw, dict):
                return raw
    if hasattr(spell, "to_dict"):
        raw = spell.to_dict()
        if isinstance(raw, dict):
            return raw
    return None

def _extract_base_damage(spell) -> Optional[Sequence[float]]:
    effects = getattr(spell, "effects", None) or []
    effect_lists = []
    for effect in effects:
        values = _extract_effect_values(effect)
        if values:
            effect_lists.append(values)
    base = _pick_level_list(effect_lists)
    if base:
        return base

    effects_by_level = getattr(spell, "effects_by_level", None)
    if effects_by_level:
        if isinstance(effects_by_level, dict):
            base = _pick_level_list(effects_by_level.values())
        else:
            base = _pick_level_list(effects_by_level)
        if base:
            return base

    raw = _get_spell_raw(spell)
    if raw:
        raw_effects = raw.get("effect") or raw.get("effects") or []
        base = _pick_level_list(
            [effect for effect in raw_effects if isinstance(effect, list)]
        )
        if base:
            return base
    return None

def _extract_bonus_ad_scaling(spell) -> Optional[Sequence[float]]:
    variable_sources = []
    for attr in ("variables", "vars"):
        if hasattr(spell, attr):
            variables = getattr(spell, attr)
            if variables:
                variable_sources.append(variables)

    raw = _get_spell_raw(spell)
    if raw:
        for key in ("variables", "vars"):
            if key in raw:
                variable_sources.append(raw[key])

    for variables in variable_sources:
        for var in variables:
            link = getattr(var, "link", None) or (
                var.get("link") if isinstance(var, dict) else None
            )
            if link and "bonusattackdamage" in str(link):
                coeff = (
                    getattr(var, "coefficients", None)
                    or getattr(var, "coeff", None)
                    or getattr(var, "values", None)
                    or (var.get("coefficients") if isinstance(var, dict) else None)
                    or (var.get("coeff") if isinstance(var, dict) else None)
                    or (var.get("values") if isinstance(var, dict) else None)
                )
                if isinstance(coeff, Sequence) and len(coeff) == 5:
                    return list(coeff)
    return None

def _get_draven_q_values(champion) -> Tuple[Sequence[float], Sequence[float]]:
    q_spell = None
    for spell in champion.spells:
        if getattr(spell, "key", "") == CHAMPION_CONFIG["draven"]["q_spell_id"]:
            q_spell = spell
            break
        if getattr(spell, "name", "") == CHAMPION_CONFIG["draven"]["q_spell_name"]:
            q_spell = spell
            break
    if q_spell is None and champion.spells:
        q_spell = champion.spells[0]

    base_damage = _extract_base_damage(q_spell)
    bonus_scaling = _extract_bonus_ad_scaling(q_spell)

    if not base_damage or not bonus_scaling:
        print("Warning: Unable to extract Draven Q values from Cassiopeia data.")
        print("Falling back to hardcoded Draven Q values.")
        base_damage = DRAVEN_Q_FALLBACK["base_damage"]
        bonus_scaling = DRAVEN_Q_FALLBACK["bonus_ad_scaling"]

    return base_damage, bonus_scaling

def _get_cdragon_champion_stats(champ_name: str, champ_key: str) -> Tuple[float, float]:
    url = CDRAGON_CHAR_URL.format(key=champ_key)
    data = _fetch_json(url)
    root_key = f"Characters/{champ_name}/CharacterRecords/Root"
    root = data.get(root_key)
    if not root:
        raise ValueError(f"Missing CDragon root data at {root_key}")
    base_ad = float(root["baseDamage"])
    ad_growth = float(root["damagePerLevel"])
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
    if hassomething:
        # print(f"Processing: {item.name}")
        # map_ids = [m.id for m in item.maps]
        # map_names = [map_lookup.get(mid, f"Unknown({mid})") for mid in map_ids]
        # print(f"  Maps: {map_names}")

        # Download item image
        image_url = item.image.url
        
        # Debug: Print image properties for the first few items
        if len(items_by_name) < 3:
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

# not in ddragon for some reason
for it in item_defs:
    if it["name"] == "Lord Dominik's Regards":
        it["aliases"].append("ldr")
    elif it["name"] == "Yun Tal Wildarrows":
        it["aliases"].append("yuntal")
    elif it["name"] == "Mortal Reminder":
        it["aliases"].append("lw")
    it["aliases"] = _normalize_aliases(it["aliases"])

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
            print(f"Warning: CDragon Draven Q extraction failed: {e}")
            print("Warning: Using Cassiopeia fallback for Draven Q.")
            champion = cass.get_champion(config["name"], region="NA")
            draven_q_base, draven_q_scaling = _get_draven_q_values(champion)

if not draven_q_base or not draven_q_scaling:
    raise ValueError("Draven Q data missing; champions.ts not generated.")

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
