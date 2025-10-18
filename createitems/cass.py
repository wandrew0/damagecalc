"""
Fetches League of Legends items using Cassiopeia and generates TypeScript item definitions.

This script automatically deduplicates items with the same name by keeping only the one
with the lowest item ID. This prevents duplicate entries from special game modes or 
temporary variants introduced by Riot.
"""

import cassiopeia as cass
import requests
import os
import time
from pathlib import Path

maps = cass.get_maps(region="NA")
map_lookup = {int(m.id): m.name for m in maps}

all_items = cass.get_items(region="NA")

# Create data directory and images subdirectory
data_dir = Path("data")
data_dir.mkdir(exist_ok=True)

# Download images directly to league-calculator public directory
images_dir = Path("../league-calculator/public/images/items")
images_dir.mkdir(parents=True, exist_ok=True)

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

# Emit your TypeScript file directly to league-calculator
with open(Path("../league-calculator/app/data/Items.ts"), "w", encoding="utf-8") as f:
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
ts_output_path = Path("../league-calculator/app/data/item-ids.ts")
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