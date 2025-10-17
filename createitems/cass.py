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
images_dir = data_dir / "items"
images_dir.mkdir(exist_ok=True)

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

item_defs = []
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
        if len(item_defs) < 3:
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
        item_defs.append(data)

# not in ddragon for some reason
for it in item_defs:
    if it["name"] == "Lord Dominik's Regards":
        it["aliases"].append("ldr")
    elif it["name"] == "Yun Tal Wildarrows":
        it["aliases"].append("yuntal")
    elif it["name"] == "Mortal Reminder":
        it["aliases"].append("lw")

# Emit your TypeScript file
with open(data_dir / "Items.ts", "w", encoding="utf-8") as f:
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
