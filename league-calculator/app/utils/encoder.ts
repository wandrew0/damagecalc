"use client";

import { Build } from "@/app/classes/Build";
import { Item } from "@/app/classes/Item";
import { ALL_ITEMS } from "@/app/data/Items";
import type { ChampionId } from "@/app/data/champions";

// Cassiopeia-generated item IDs are required

// Load Cassiopeia-generated item IDs (required)
import { ITEM_IDS } from "@/app/data/item-ids";

// Validate the imported data
if (!ITEM_IDS || Object.keys(ITEM_IDS).length === 0) {
    throw new Error(
        "Cassiopeia item IDs are required. Please run 'python createitems/cass.py' to generate them."
    );
}

console.log("Loaded Cassiopeia item IDs for encoding");

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
    c?: ChampionId; // champion id
    l?: number; // champion level
    b: CompressedBuild[]; // builds
    r?: {
        // runes
        af?: boolean; // absolute focus
        gs?: number; // gathering storm minutes
    };
    d?: {
        // draven
        e?: boolean; // spinning axe enabled
        q?: number; // q level
        l?: boolean; // q level linked
    };
}

export function encodeBuilds(
    builds: Build[],
    championLevel?: number,
    absoluteFocus?: boolean,
    gatheringStormMinutes?: number,
    championId?: ChampionId,
    dravenQEnabled?: boolean,
    dravenQLevel?: number,
    dravenQLevelLinked?: boolean
): string {
    const compressedBuilds: CompressedBuild[] = builds.map((build) => ({
        n: build.name,
        i: build.items.map((item) => ITEM_IDS[item.name] || 0),
        b: [build.bonusAD, build.bonusLethality, build.bonusCrit],
    }));

    const data: CompressedData = {
        v: 1, // version
        c: championId,
        l: championLevel,
        b: compressedBuilds,
    };

    // Add rune data if provided
    if (absoluteFocus !== undefined || gatheringStormMinutes !== undefined) {
        data.r = {};
        if (absoluteFocus !== undefined) {
            data.r.af = absoluteFocus;
        }
        if (gatheringStormMinutes !== undefined) {
            data.r.gs = gatheringStormMinutes;
        }
    }

    if (
        championId === "draven" &&
        (dravenQEnabled !== undefined ||
            dravenQLevel !== undefined ||
            dravenQLevelLinked !== undefined)
    ) {
        data.d = {};
        if (dravenQEnabled !== undefined) {
            data.d.e = dravenQEnabled;
        }
        if (dravenQLevel !== undefined) {
            data.d.q = dravenQLevel;
        }
        if (dravenQLevelLinked !== undefined) {
            data.d.l = dravenQLevelLinked;
        }
    }

    // Convert to compact JSON (no base64 encoding)
    return JSON.stringify(data);
}

export function decodeBuilds(encoded: string): {
    builds: Build[];
    championLevel?: number;
    absoluteFocus?: boolean;
    gatheringStormMinutes?: number;
    championId?: ChampionId;
    dravenQEnabled?: boolean;
    dravenQLevel?: number;
    dravenQLevelLinked?: boolean;
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

        const championId =
            data.c === "aphelios" || data.c === "draven" ? data.c : undefined;
        const dravenData = championId === "draven" ? data.d : undefined;
        const dravenQEnabled =
            typeof dravenData?.e === "boolean" ? dravenData.e : undefined;
        const dravenQLevel =
            typeof dravenData?.q === "number" &&
            dravenData.q >= 1 &&
            dravenData.q <= 5
                ? dravenData.q
                : undefined;
        const dravenQLevelLinked =
            typeof dravenData?.l === "boolean" ? dravenData.l : undefined;

        return {
            builds,
            championId,
            championLevel: data.l,
            absoluteFocus: data.r?.af,
            gatheringStormMinutes: data.r?.gs,
            dravenQEnabled,
            dravenQLevel,
            dravenQLevelLinked,
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
