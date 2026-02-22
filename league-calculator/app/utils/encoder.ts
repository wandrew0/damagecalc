"use client";

import { Build } from "@/app/classes/Build";
import type { ChampionId } from "@/app/data/champions";

// Cassiopeia-generated item IDs are required

// Load Cassiopeia-generated item IDs (required)
import { ITEM_IDS } from "@/app/data/item-ids";
import { getItemIdForName, resolveItemById } from "@/app/utils/itemRegistry";

// Validate the imported data
if (!ITEM_IDS || Object.keys(ITEM_IDS).length === 0) {
    throw new Error(
        "Cassiopeia item IDs are required. Please run 'python createitems/cass.py' to generate them."
    );
}

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
        ad?: number; // AD shard count
    };
    d?: {
        // draven
        e?: boolean; // spinning axe enabled
        q?: number; // q level
        l?: boolean; // q level linked
    };
}

function getFiniteNumber(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }
    return value;
}

function sanitizeChampionLevel(value: unknown): number | undefined {
    const parsed = getFiniteNumber(value);
    if (parsed === null) {
        return undefined;
    }
    return Math.max(1, Math.min(18, Math.round(parsed)));
}

function sanitizeGatheringStormMinutes(value: unknown): number | undefined {
    const parsed = getFiniteNumber(value);
    if (parsed === null) {
        return undefined;
    }
    return Math.max(0, Math.round(parsed / 10) * 10);
}

function sanitizeCompressedBuild(raw: unknown): CompressedBuild | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const candidate = raw as Partial<CompressedBuild>;
    const itemIds = Array.isArray(candidate.i)
        ? candidate.i
              .map((itemId) => getFiniteNumber(itemId))
              .filter((itemId): itemId is number => itemId !== null)
              .map((itemId) => Math.floor(itemId))
              .filter((itemId) => itemId > 0)
        : [];

    const bonuses = Array.isArray(candidate.b) ? candidate.b : [];
    const bonusAD = getFiniteNumber(bonuses[0]) ?? 0;
    const bonusLethality = getFiniteNumber(bonuses[1]) ?? 0;
    const bonusCrit = getFiniteNumber(bonuses[2]) ?? 0;

    return {
        n: typeof candidate.n === "string" ? candidate.n : "",
        i: itemIds,
        b: [bonusAD, bonusLethality, bonusCrit],
    };
}

export function encodeBuilds(
    builds: Build[],
    championLevel?: number,
    absoluteFocus?: boolean,
    gatheringStormMinutes?: number,
    adShardCount?: number,
    championId?: ChampionId,
    dravenQEnabled?: boolean,
    dravenQLevel?: number,
    dravenQLevelLinked?: boolean
): string {
    const compressedBuilds: CompressedBuild[] = builds.map((build) => ({
        n: build.name,
        i: build.items.map((item) => getItemIdForName(item.name) ?? 0),
        b: [build.bonusAD, build.bonusLethality, build.bonusCrit],
    }));

    const data: CompressedData = {
        v: 1, // version
        c: championId,
        l: championLevel,
        b: compressedBuilds,
    };

    // Add rune data if provided
    if (
        absoluteFocus !== undefined ||
        gatheringStormMinutes !== undefined ||
        adShardCount !== undefined
    ) {
        data.r = {};
        if (absoluteFocus !== undefined) {
            data.r.af = absoluteFocus;
        }
        if (gatheringStormMinutes !== undefined) {
            data.r.gs = gatheringStormMinutes;
        }
        if (adShardCount !== undefined) {
            data.r.ad = adShardCount;
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
    adShardCount?: number;
    championId?: ChampionId;
    dravenQEnabled?: boolean;
    dravenQLevel?: number;
    dravenQLevelLinked?: boolean;
} {
    try {
        const rawData = JSON.parse(encoded) as Partial<CompressedData>;
        if (!rawData || typeof rawData !== "object") {
            throw new Error("Invalid build payload");
        }

        const rawBuilds = Array.isArray(rawData.b) ? rawData.b : [];
        const compressedBuilds = rawBuilds
            .map((rawBuild) => sanitizeCompressedBuild(rawBuild))
            .filter((build): build is CompressedBuild => build !== null);

        const builds: Build[] = compressedBuilds.map((compressedBuild, index) => {
            const build = new Build();
            build.setName(compressedBuild.n || `Build ${index + 1}`);
            build.setBonusAD(compressedBuild.b[0]);
            build.setBonusLethality(compressedBuild.b[1]);
            build.setBonusCrit(compressedBuild.b[2]);

            // Add items by ID
            compressedBuild.i.forEach((itemId) => {
                const item = resolveItemById(itemId);
                if (item) {
                    build.addItem(item);
                }
            });

            return build;
        });

        const championId =
            rawData.c === "aphelios" || rawData.c === "draven"
                ? rawData.c
                : undefined;
        const runeData =
            rawData.r && typeof rawData.r === "object" ? rawData.r : undefined;
        const dravenData =
            championId === "draven" &&
            rawData.d &&
            typeof rawData.d === "object"
                ? rawData.d
                : undefined;
        const championLevel = sanitizeChampionLevel(rawData.l);
        const parsedAdShardCount = getFiniteNumber(runeData?.ad);
        const adShardCount =
            parsedAdShardCount === null
                ? undefined
                : Math.max(0, Math.min(2, Math.round(parsedAdShardCount)));
        const dravenQEnabled =
            typeof dravenData?.e === "boolean" ? dravenData.e : undefined;
        const parsedDravenQLevel = getFiniteNumber(dravenData?.q);
        const dravenQLevel =
            parsedDravenQLevel === null
                ? undefined
                : Math.max(1, Math.min(5, Math.round(parsedDravenQLevel)));
        const dravenQLevelLinked =
            typeof dravenData?.l === "boolean" ? dravenData.l : undefined;

        return {
            builds,
            championId,
            championLevel,
            absoluteFocus:
                typeof runeData?.af === "boolean" ? runeData.af : undefined,
            gatheringStormMinutes: sanitizeGatheringStormMinutes(runeData?.gs),
            adShardCount,
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
