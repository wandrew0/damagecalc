"use client";

import { Build } from "../classes/Build";
import { Item } from "../classes/Item";
import { ALL_ITEMS } from "../data/Items";

// Cassiopeia-generated item IDs are required

// Load Cassiopeia-generated item IDs (required)
let ITEM_IDS: { [key: string]: number };

try {
    // This loads the Cassiopeia-generated item IDs
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ITEM_IDS: cassiopeiaIds } = require("../data/item-ids");
    if (!cassiopeiaIds || Object.keys(cassiopeiaIds).length === 0) {
        throw new Error("No Cassiopeia data found");
    }
    ITEM_IDS = cassiopeiaIds;
    console.log("Loaded Cassiopeia item IDs for encoding");
} catch (error) {
    console.error("Failed to load Cassiopeia item IDs:", error);
    throw new Error(
        "Cassiopeia item IDs are required. Please run 'python createitems/cass.py' to generate them."
    );
}

const ID_TO_ITEM: { [key: number]: string } = Object.fromEntries(
    Object.entries(ITEM_IDS).map(([name, id]) => [id, name])
);

// Create item lookup by name
const ITEM_BY_NAME: { [key: string]: Item } = {};
ALL_ITEMS.forEach((item) => {
    ITEM_BY_NAME[item.name] = item;
});

interface CompressedBuild {
    n: string; // name
    i: number[]; // item IDs
    b: [number, number, number]; // bonus [AD, lethality, crit]
}

interface CompressedData {
    v: number; // version
    l?: number; // champion level
    b: CompressedBuild[]; // builds
}

export function encodeBuilds(builds: Build[], championLevel?: number): string {
    const compressedBuilds: CompressedBuild[] = builds.map((build) => ({
        n: build.name,
        i: build.items.map((item) => ITEM_IDS[item.name] || 0),
        b: [build.bonusAD, build.bonusLethality, build.bonusCrit],
    }));

    const data: CompressedData = {
        v: 1, // version
        l: championLevel,
        b: compressedBuilds,
    };

    // Convert to compact JSON (no base64 encoding)
    return JSON.stringify(data);
}

export function decodeBuilds(encoded: string): {
    builds: Build[];
    championLevel?: number;
} {
    try {
        const data: CompressedData = JSON.parse(encoded);

        const builds: Build[] = data.b.map((compressedBuild) => {
            const build = new Build();
            build.setName(compressedBuild.n);
            build.setBonusAD(compressedBuild.b[0]);
            build.setBonusLethality(compressedBuild.b[1]);
            build.setBonusCrit(compressedBuild.b[2]);

            // Add items by ID
            compressedBuild.i.forEach((itemId) => {
                const itemName = ID_TO_ITEM[itemId];
                if (itemName && ITEM_BY_NAME[itemName]) {
                    // Clone the item from the database
                    const originalItem = ITEM_BY_NAME[itemName];
                    const item = new Item(
                        originalItem.name,
                        originalItem.cost,
                        originalItem.AD,
                        originalItem.critChance,
                        originalItem.infinityEdgeBonus,
                        originalItem.lethality,
                        originalItem.armorPenetration,
                        originalItem.aliases,
                        originalItem.imagePath
                    );
                    build.addItem(item);
                }
            });

            return build;
        });

        return {
            builds,
            championLevel: data.l,
        };
    } catch (error) {
        console.error("Error decoding builds:", error);
        throw new Error("Invalid build data");
    }
}

// Fallback to old format for backward compatibility
export function decodeBuildsLegacy(encoded: string): {
    builds: Build[];
    championLevel?: number;
} {
    try {
        const decoded = JSON.parse(encoded);

        if (Array.isArray(decoded)) {
            // Old format - just builds array
            const builds = decoded.map((b: Record<string, unknown>) =>
                Build.fromJSON(b as Parameters<typeof Build.fromJSON>[0])
            );
            return { builds };
        }

        throw new Error("Invalid legacy format");
    } catch (error) {
        console.error("Error decoding legacy builds:", error);
        throw new Error("Invalid build data");
    }
}
