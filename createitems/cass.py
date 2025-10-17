import cassiopeia as cass

maps = cass.get_maps(region="NA")
map_lookup = {int(m.id): m.name for m in maps}

all_items = cass.get_items(region="NA")

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
with open("Items.ts", "w", encoding="utf-8") as f:
    f.write('import { Item } from "../classes/Item";\n\nexport const ALL_ITEMS = [\n')
    for it in item_defs:
        f.write(
            f"    new Item("
            f'"{it["name"]}", {it["cost"]}, {it["attack_damage"]}, '
            f'{it["crit_chance"]}, {"true" if it["has_crit"] else "false"}, '
            f'{it["lethality"]}, {it["armor_pen"]}, '
            f'{it["aliases"]!r}'
            "),\n"
        )
    f.write("];\n")
