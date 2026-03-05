"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Select from "react-select";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    type Plugin,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
    getAbsoluteFocusAD,
    getAdShardBonus,
} from "../../../classes/Calculator";
import { ALL_ITEMS } from "../../../data/Items";
import { APHELIOS_PASSIVE } from "../../../data/champions";
import { CURATED_ARMOR_ITEMS, ENEMY_ARMOR_PROFILES } from "../../../data/enemyArmor";
import {
    GlobalOptimizerId,
    PassiveRankState,
    TimelineEvent,
    buildDamageEstimator,
    buildDrilldownPoints,
    calculateGlobalOptimalPathNormalizedBy,
    calculateLevelRecommendations,
    calculateOracleBestDamageByLevel,
    clampLevel,
    estimateBeforeStatsAtLevelForState,
    estimateDamageAtLevelForState,
    findExactDeltaPercentMinimum,
    findExactDeltaPercentTransitionPoints,
    getMaxPassiveRankForLevel,
    getReachableStatesAtLevel,
    rankStatesByDamage,
    resolveEnemyArmorByLevel,
    resolveTimeline,
    updateTimelineForLevel,
} from "../../../utils/apheliosCutoff";
import {
    getItemIdForName,
    ITEM_DATA_VERSION,
    normalizePersistedItemName,
} from "../../../utils/itemRegistry";
import {
    sanitizeAdShardCount,
    sanitizeStoredNumber,
} from "../../../utils/numberUtils";
import {
    buildSearchTerms,
    rankSearchOptions,
    sortItemsByAdAndCrit,
} from "../../../utils/itemSearch";
import usePersistenceLifecycle from "../../../hooks/usePersistenceLifecycle";
import { greedyVsBestAverageDescription } from "../../../lib/seo";
import HelpHint from "./HelpHint";
import {
    ContextValueGuide,
    LevelDiffGuide,
    LevelGuide,
    type ContextValueGuideRow,
    type LevelDiffGuideRow,
    type LevelGuideRow,
} from "./LevelGuides";
import ControlCard from "./ControlCard";
import useCutoffResponsive from "./useCutoffResponsive";
import useInspectorPanelHeight from "./useInspectorPanelHeight";
import useTimelineModalFocusTrap from "./useTimelineModalFocusTrap";
import {
    TimelinePreviewItems,
    TimelineSegmentItems,
} from "./TimelineItemViews";
import {
    buildTimelineSegmentRenderKeys,
    buildTimelineSegments,
    levelBuildChanged,
} from "./timelineUtils";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface SelectOption {
    value: string;
    label: string;
    iconPath?: string;
    searchTerms: string[];
}

interface StoredTimelineEvent {
    level?: number;
    add?: unknown[];
    remove?: unknown[];
}

interface StoredCutoffState {
    startChoice?: "q" | "w";
    forcedWLevels?: number[];
    selectedLevel: number | null;
    enemyProfileId: string;
    ownEvents: StoredTimelineEvent[];
    enemyEvents: StoredTimelineEvent[];
    armorMin: number;
    armorMax: number;
    extraBonusAD: number;
    extraBonusLethality: number;
    adShardCount?: number;
    absoluteFocus?: boolean;
    globalOptimizerId?: GlobalOptimizerId;
    itemDataVersion?: string;
}

interface SeedCutoffState {
    selectedLevel: number | null;
    ownEvents: TimelineEvent[];
    armorMin: number;
    armorMax: number;
    extraBonusAD: number;
    extraBonusLethality: number;
    adShardCount: number;
    absoluteFocus: boolean;
}

type TimelineKind = "own" | "enemy";
type CompactCardSection = "passive" | "force_w" | "extra_stats" | "armor_model";

interface TimelineEditorContext {
    kind: TimelineKind;
    level: number;
}

const CUTOFF_STORAGE_KEY = "aphelios_cutoff_state";
const CALCULATOR_STORAGE_KEY = "calculatorState";
const DEFAULT_ENEMY_PROFILE = ENEMY_ARMOR_PROFILES[0]?.id ?? "adc";
const DEFAULT_ARMOR_MIN = 0;
const DEFAULT_ARMOR_MAX = 100;
const DEFAULT_AD_SHARD_COUNT = 2;
const DEFAULT_GLOBAL_OPTIMIZER: GlobalOptimizerId = "oracle_norm";
const COMPACT_LAYOUT_QUERY = "(max-width: 900px)";

const ARMOR_ITEM_ALIASES: Record<string, string[]> = {
    "Cloth Armor": ["cloth"],
    "Plated Steelcaps": ["tabi", "steelcaps", "plated", "boots"],
    "Chain Vest": ["chain"],
    "Warden's Mail": ["wardens", "warden"],
    "Bramble Vest": ["bramble"],
    "Frozen Heart": ["fh"],
    Thornmail: ["thorn"],
    "Randuin's Omen": ["randuins", "randuin"],
    "Sunfire Aegis": ["sunfire"],
    "Dead Man's Plate": ["deadmans", "dmp"],
    "Guardian Angel": ["ga"],
};

const ARMOR_ITEM_NAME_SET = new Set(CURATED_ARMOR_ITEMS.map((item) => item.name));
const ARMOR_ITEM_ID_TO_NAME = new Map(
    CURATED_ARMOR_ITEMS.map((item) => [String(item.id), item.name])
);

const ITEM_OPTIONS: SelectOption[] = sortItemsByAdAndCrit(ALL_ITEMS).map((item) => ({
    value: item.name,
    label: `${item.name} (${item.cost}g)`,
    iconPath: item.imagePath,
    searchTerms: buildSearchTerms(item.name, ...(item.aliases ?? [])),
}));

const ARMOR_ITEM_OPTIONS: SelectOption[] = CURATED_ARMOR_ITEMS.map((item) => ({
    value: item.name,
    label: `${item.name} (+${item.armor} armor)`,
    iconPath: item.imagePath,
    searchTerms: buildSearchTerms(item.name, ...(ARMOR_ITEM_ALIASES[item.name] ?? [])),
}));

const ITEM_OPTION_BY_NAME = new Map(ITEM_OPTIONS.map((option) => [option.value, option]));
const ARMOR_ITEM_OPTION_BY_NAME = new Map(
    ARMOR_ITEM_OPTIONS.map((option) => [option.value, option])
);

function sanitizeTimelineEvents(
    events: unknown,
    normalizeItem: (value: unknown) => string | null
): TimelineEvent[] {
    if (!Array.isArray(events)) return [];

    const byLevel = new Map<number, TimelineEvent>();

    events.forEach((event) => {
        const storedEvent = event as StoredTimelineEvent;
        const level = clampLevel(Number(storedEvent.level || 1));
        const add = Array.isArray(storedEvent.add)
            ? storedEvent.add
                  .map((value) => normalizeItem(value))
                  .filter((value): value is string => typeof value === "string")
            : [];
        const remove = Array.isArray(storedEvent.remove)
            ? storedEvent.remove
                  .map((value) => normalizeItem(value))
                  .filter((value): value is string => typeof value === "string")
            : [];

        if (add.length === 0 && remove.length === 0) {
            byLevel.delete(level);
            return;
        }

        // Keep only one change event per level; the latest persisted edit wins.
        byLevel.set(level, { level, add, remove });
    });

    return [...byLevel.values()].sort((a, b) => a.level - b.level);
}

function normalizeEnemyTimelineItem(value: unknown): string | null {
    if (typeof value === "string") {
        return ARMOR_ITEM_NAME_SET.has(value) ? value : null;
    }
    if (value && typeof value === "object") {
        const maybeId = (value as { id?: unknown }).id;
        if (maybeId !== undefined && maybeId !== null) {
            const byId = ARMOR_ITEM_ID_TO_NAME.get(String(maybeId));
            if (byId) return byId;
        }
        const maybeName = (value as { name?: unknown }).name;
        if (typeof maybeName === "string" && ARMOR_ITEM_NAME_SET.has(maybeName)) {
            return maybeName;
        }
    }
    return null;
}

function getUniqueSortedLevels(events: TimelineEvent[]): number[] {
    return [...new Set(events.map((event) => clampLevel(event.level)))].sort((a, b) => a - b);
}

function sanitizeForcedWLevels(levels: unknown): number[] {
    if (!Array.isArray(levels)) return [];
    const normalized = levels
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 18);
    return [...new Set(normalized)].sort((a, b) => a - b);
}

function sanitizeGlobalOptimizerId(value: unknown): GlobalOptimizerId {
    if (value === "greedy_norm" || value === "oracle_norm") {
        return value;
    }
    return DEFAULT_GLOBAL_OPTIMIZER;
}

function normalizeEnemyProfileId(value: unknown): string {
    // Backward compatibility for persisted profile IDs.
    if (value === "squishy") {
        return "adc";
    }
    if (value === "fighter") {
        return "ranged_support";
    }
    if (value === "tank") {
        return "melee_support";
    }
    if (
        typeof value === "string" &&
        ENEMY_ARMOR_PROFILES.some((profile) => profile.id === value)
    ) {
        return value;
    }
    return DEFAULT_ENEMY_PROFILE;
}

function sanitizeStoredBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function trimFixed(value: number, digits: number): string {
    return value.toFixed(digits).replace(/\.?0+$/, "");
}

function buildSeedFromCalculatorState(): Partial<SeedCutoffState> {
    const raw = localStorage.getItem(CALCULATOR_STORAGE_KEY);
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw);
        const level = clampLevel(Number(parsed.level || 1));

        const firstBuild = Array.isArray(parsed.builds) ? parsed.builds[0] : null;
        const buildItems =
            firstBuild && Array.isArray(firstBuild.items)
                ? firstBuild.items
                      .map((item: unknown) => normalizePersistedItemName(item))
                      .filter((name: unknown): name is string => typeof name === "string")
                      .slice(0, 6)
                : [];

        const ownEvents =
            buildItems.length > 0
                ? [
                      {
                          level,
                          add: buildItems,
                          remove: [],
                      },
                  ]
                : [];

        return {
            selectedLevel: level,
            ownEvents,
            armorMin: DEFAULT_ARMOR_MIN,
            armorMax: DEFAULT_ARMOR_MAX,
            extraBonusAD: sanitizeStoredNumber(firstBuild?.bonusAD, 0),
            extraBonusLethality: sanitizeStoredNumber(firstBuild?.bonusLethality, 0),
            adShardCount: DEFAULT_AD_SHARD_COUNT,
            absoluteFocus: false,
        };
    } catch (error) {
        console.warn("Failed to parse calculator state for cutoff seeding:", error);
        return {};
    }
}

export default function ApheliosCutoffAnalysis() {
    const TOP_STATES_LIMIT = 5;

    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const modalRef = useRef<HTMLElement | null>(null);
    const lastFocusedElementRef = useRef<HTMLElement | null>(null);
    const inspectorPanelRef = useRef<HTMLElement | null>(null);
    const skipNextOutsideClickRef = useRef(false);
    const suppressDocumentClickUntilRef = useRef(0);
    const suppressTimelineOpenUntilRef = useRef(0);

    const [forcedWLevels, setForcedWLevels] = useState<number[]>([1]);
    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
    const [hoveredInspectorLevel, setHoveredInspectorLevel] = useState<number | null>(null);
    const [enemyProfileId, setEnemyProfileId] = useState(DEFAULT_ENEMY_PROFILE);
    const [ownEvents, setOwnEvents] = useState<TimelineEvent[]>([]);
    const [enemyEvents, setEnemyEvents] = useState<TimelineEvent[]>([]);
    const [editorContext, setEditorContext] = useState<TimelineEditorContext | null>(null);
    const [isModalSelectMenuOpen, setIsModalSelectMenuOpen] = useState(false);
    const [modalSearchInput, setModalSearchInput] = useState("");
    const [armorMin, setArmorMin] = useState(DEFAULT_ARMOR_MIN);
    const [armorMax, setArmorMax] = useState(DEFAULT_ARMOR_MAX);
    const [extraBonusAD, setExtraBonusAD] = useState(0);
    const [adShardCount, setAdShardCount] = useState(DEFAULT_AD_SHARD_COUNT);
    const [absoluteFocus, setAbsoluteFocus] = useState(false);
    const [globalOptimizerId, setGlobalOptimizerId] = useState<GlobalOptimizerId>(
        DEFAULT_GLOBAL_OPTIMIZER
    );
    const [compactOpenSections, setCompactOpenSections] = useState<Set<CompactCardSection>>(
        () => new Set<CompactCardSection>(["force_w"])
    );
    const [mobileAddPickerKind, setMobileAddPickerKind] =
        useState<TimelineKind | null>(null);
    const ensureCompactLevelSelection = useCallback(() => {
        setSelectedLevel((current) => current ?? 1);
    }, []);

    const { isTouchDevice, modalSelectPortalTarget, isCompactLayout } = useCutoffResponsive({
        compactLayoutQuery: COMPACT_LAYOUT_QUERY,
        onCompactLayoutEnabled: ensureCompactLevelSelection,
    });

    const safeArmorMin = Number.isFinite(armorMin) ? armorMin : DEFAULT_ARMOR_MIN;
    const safeArmorMax = Number.isFinite(armorMax) ? armorMax : DEFAULT_ARMOR_MAX;
    const safeExtraBonusAD = Number.isFinite(extraBonusAD) ? extraBonusAD : 0;
    const safeExtraBonusLethality = 0;
    const safeAdShardCount = sanitizeAdShardCount(adShardCount, DEFAULT_AD_SHARD_COUNT);
    const safeAbsoluteFocus = Boolean(absoluteFocus);
    const runeBonusADByLevel = useMemo(
        () =>
            Array.from({ length: 18 }, (_unused, index) => {
                const level = index + 1;
                let bonus = getAdShardBonus(safeAdShardCount);
                if (safeAbsoluteFocus) {
                    bonus += getAbsoluteFocusAD(level);
                }
                return bonus;
            }),
        [safeAdShardCount, safeAbsoluteFocus]
    );
    const totalExtraBonusADByLevel = useMemo(
        () => runeBonusADByLevel.map((value) => value + safeExtraBonusAD),
        [runeBonusADByLevel, safeExtraBonusAD]
    );

    const formatPassiveValue = (value: number): string => `${Number(value.toFixed(2))}`;

    const buildPerRankIncrements = (totals: number[]): number[] =>
        totals.map((value, index) => {
            if (index === 0) return value;
            return value - totals[index - 1];
        });

    const qTotals = APHELIOS_PASSIVE.qBonusAdByRank;
    const eTotals = APHELIOS_PASSIVE.eBonusLethalityByRank;
    const qIncrements = buildPerRankIncrements(qTotals);
    const eIncrements = buildPerRankIncrements(eTotals);
    const qStep = formatPassiveValue(qIncrements[0] ?? 0);
    const eStep = formatPassiveValue(eIncrements[0] ?? 0);
    const qMax = formatPassiveValue(qTotals[qTotals.length - 1] ?? 0);
    const eMax = formatPassiveValue(eTotals[eTotals.length - 1] ?? 0);

    const passiveRankUnlockLevels = useMemo(() => {
        const levels: number[] = [];
        let previousMax = 0;
        for (let level = 1; level <= 18; level++) {
            const currentMax = getMaxPassiveRankForLevel(level);
            if (currentMax > previousMax) {
                levels.push(level);
                previousMax = currentMax;
            }
        }
        return levels;
    }, []);

    const loadPersistedState = useCallback(() => {
        const savedState = localStorage.getItem(CUTOFF_STORAGE_KEY);
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState) as Partial<StoredCutoffState>;
                const hasForcedWField = Array.isArray(parsed.forcedWLevels);
                const normalizedForcedW = hasForcedWField
                    ? sanitizeForcedWLevels(parsed.forcedWLevels)
                    : parsed.startChoice === "w"
                      ? [1]
                      : [1];
                setForcedWLevels(normalizedForcedW);
                setSelectedLevel(null);
                setEnemyProfileId(normalizeEnemyProfileId(parsed.enemyProfileId));
                const savedOwnEvents = sanitizeTimelineEvents(
                    parsed.ownEvents,
                    (value) => normalizePersistedItemName(value)
                );
                const savedEnemyEvents = sanitizeTimelineEvents(
                    parsed.enemyEvents,
                    normalizeEnemyTimelineItem
                );
                setOwnEvents(savedOwnEvents);
                setEnemyEvents(savedEnemyEvents);
                setArmorMin(sanitizeStoredNumber(parsed.armorMin, DEFAULT_ARMOR_MIN));
                setArmorMax(sanitizeStoredNumber(parsed.armorMax, DEFAULT_ARMOR_MAX));
                setExtraBonusAD(sanitizeStoredNumber(parsed.extraBonusAD, 0));
                setAdShardCount(
                    sanitizeAdShardCount(parsed.adShardCount, DEFAULT_AD_SHARD_COUNT)
                );
                setAbsoluteFocus(sanitizeStoredBoolean(parsed.absoluteFocus, false));
                setGlobalOptimizerId(
                    sanitizeGlobalOptimizerId(parsed.globalOptimizerId)
                );
                return;
            } catch (error) {
                console.warn("Failed to parse cutoff state:", error);
            }
        }

        const seed = buildSeedFromCalculatorState();
        setForcedWLevels([1]);
        setSelectedLevel(null);
        setOwnEvents(seed.ownEvents ?? []);
        setArmorMin(sanitizeStoredNumber(seed.armorMin, DEFAULT_ARMOR_MIN));
        setArmorMax(sanitizeStoredNumber(seed.armorMax, DEFAULT_ARMOR_MAX));
        setExtraBonusAD(sanitizeStoredNumber(seed.extraBonusAD, 0));
        setAdShardCount(
            sanitizeAdShardCount(seed.adShardCount, DEFAULT_AD_SHARD_COUNT)
        );
        setAbsoluteFocus(sanitizeStoredBoolean(seed.absoluteFocus, false));
        setGlobalOptimizerId(DEFAULT_GLOBAL_OPTIMIZER);
    }, []);

    const persistCutoffState = useCallback(() => {
        const toStoredItemRef = (itemName: string): { id?: number; name: string } => {
            const id = getItemIdForName(itemName);
            return id ? { id, name: itemName } : { name: itemName };
        };
        const ownEventsForStorage: StoredTimelineEvent[] = ownEvents.map((event) => ({
            level: event.level,
            add: event.add.map((itemName) => toStoredItemRef(itemName)),
            remove: event.remove.map((itemName) => toStoredItemRef(itemName)),
        }));
        const enemyEventsForStorage: StoredTimelineEvent[] = enemyEvents.map((event) => ({
            level: event.level,
            add: [...event.add],
            remove: [...event.remove],
        }));
        const payload: StoredCutoffState = {
            forcedWLevels,
            selectedLevel,
            enemyProfileId,
            ownEvents: ownEventsForStorage,
            enemyEvents: enemyEventsForStorage,
            armorMin: safeArmorMin,
            armorMax: safeArmorMax,
            extraBonusAD: safeExtraBonusAD,
            extraBonusLethality: safeExtraBonusLethality,
            adShardCount: safeAdShardCount,
            absoluteFocus: safeAbsoluteFocus,
            globalOptimizerId,
            itemDataVersion: ITEM_DATA_VERSION,
        };
        localStorage.setItem(CUTOFF_STORAGE_KEY, JSON.stringify(payload));
    }, [
        forcedWLevels,
        selectedLevel,
        enemyProfileId,
        ownEvents,
        enemyEvents,
        safeArmorMin,
        safeArmorMax,
        safeExtraBonusAD,
        safeExtraBonusLethality,
        safeAdShardCount,
        safeAbsoluteFocus,
        globalOptimizerId,
    ]);

    const isLoaded = usePersistenceLifecycle({
        loadState: loadPersistedState,
        saveState: persistCutoffState,
    });

    const ownItemsByLevel = useMemo(() => resolveTimeline(ownEvents), [ownEvents]);
    const enemyArmorItemsByLevel = useMemo(
        () => resolveTimeline(enemyEvents),
        [enemyEvents]
    );

    const enemyProfile = useMemo(
        () =>
            ENEMY_ARMOR_PROFILES.find((profile) => profile.id === enemyProfileId) ??
            ENEMY_ARMOR_PROFILES[0],
        [enemyProfileId]
    );

    const enemyArmorByLevel = useMemo(
        () =>
            resolveEnemyArmorByLevel(
                enemyProfile,
                enemyArmorItemsByLevel,
                CURATED_ARMOR_ITEMS
            ),
        [enemyProfile, enemyArmorItemsByLevel]
    );

    const recommendationInput = useMemo(
        () => ({
            forcedWLevels,
            ownItemsByLevel,
            enemyArmorByLevel,
            extraBonusAD: safeExtraBonusAD,
            extraBonusADByLevel: totalExtraBonusADByLevel,
            extraBonusLethality: safeExtraBonusLethality,
        }),
        [
            forcedWLevels,
            ownItemsByLevel,
            enemyArmorByLevel,
            safeExtraBonusAD,
            totalExtraBonusADByLevel,
            safeExtraBonusLethality,
        ]
    );

    const recommendations = useMemo(
        () => calculateLevelRecommendations(recommendationInput),
        [recommendationInput]
    );

    const damageEstimator = useMemo(
        () => buildDamageEstimator(recommendationInput),
        [recommendationInput]
    );

    const forcedWAppliedLevels = useMemo(
        () =>
            recommendations
                .filter((entry) => entry.forcedWApplied)
                .map((entry) => entry.level),
        [recommendations]
    );

    const unappliedForcedWLevels = useMemo(() => {
        const applied = new Set(forcedWAppliedLevels);
        return forcedWLevels.filter((level) => !applied.has(level));
    }, [forcedWAppliedLevels, forcedWLevels]);
    const unappliedForcedWSet = useMemo(
        () => new Set(unappliedForcedWLevels),
        [unappliedForcedWLevels]
    );

    const selectedDecision = useMemo(
        () =>
            selectedLevel
                ? recommendations.find((entry) => entry.level === selectedLevel) ?? null
                : null,
        [recommendations, selectedLevel]
    );
    const selectedExtraBonusAD = useMemo(() => {
        if (!selectedLevel) {
            return safeExtraBonusAD + (runeBonusADByLevel[0] ?? 0);
        }
        return totalExtraBonusADByLevel[selectedLevel - 1] ?? safeExtraBonusAD;
    }, [
        selectedLevel,
        totalExtraBonusADByLevel,
        safeExtraBonusAD,
        runeBonusADByLevel,
    ]);

    const greedyDamageByLevel = useMemo(
        () =>
            recommendations.map((entry) =>
                estimateDamageAtLevelForState(
                    entry.level,
                    ownItemsByLevel[entry.level - 1] ?? [],
                    enemyArmorByLevel[entry.level - 1] ?? 0,
                    entry.stateAfter,
                    totalExtraBonusADByLevel[entry.level - 1] ?? safeExtraBonusAD,
                    safeExtraBonusLethality
                )
            ),
        [
            recommendations,
            ownItemsByLevel,
            enemyArmorByLevel,
            totalExtraBonusADByLevel,
            safeExtraBonusAD,
            safeExtraBonusLethality,
        ]
    );

    const oracleDamageByLevel = useMemo(
        () =>
            calculateOracleBestDamageByLevel(
                recommendationInput,
                damageEstimator
            ),
        [recommendationInput, damageEstimator]
    );

    const globalOptimalPath = useMemo(
        () =>
            calculateGlobalOptimalPathNormalizedBy(
                recommendationInput,
                globalOptimizerId === "greedy_norm"
                    ? greedyDamageByLevel
                    : oracleDamageByLevel,
                globalOptimizerId,
                damageEstimator
            ),
        [
            recommendationInput,
            globalOptimizerId,
            greedyDamageByLevel,
            oracleDamageByLevel,
            damageEstimator,
        ]
    );

    const greedyLevelGuideRows = useMemo<LevelGuideRow[]>(() => {
        const picksByChoice: Record<"Q" | "W" | "E", number[]> = {
            Q: [],
            W: [],
            E: [],
        };

        recommendations.forEach((entry) => {
            picksByChoice[entry.choice].push(entry.level);
        });

        return [
            { key: "Q" as const, label: "AD", levels: picksByChoice.Q },
            { key: "W" as const, label: "AS", levels: picksByChoice.W },
            { key: "E" as const, label: "Lethality", levels: picksByChoice.E },
        ];
    }, [recommendations]);

    const globalLevelGuideRows = useMemo<LevelGuideRow[]>(() => {
        const picksByChoice: Record<"Q" | "W" | "E", number[]> = {
            Q: [],
            W: [],
            E: [],
        };

        globalOptimalPath.choicesByLevel.forEach((choice, index) => {
            const level = index + 1;
            if (choice === "Q" || choice === "W" || choice === "E") {
                picksByChoice[choice].push(level);
            }
        });

        return [
            { key: "Q" as const, label: "AD", levels: picksByChoice.Q },
            { key: "W" as const, label: "AS", levels: picksByChoice.W },
            { key: "E" as const, label: "Lethality", levels: picksByChoice.E },
        ];
    }, [globalOptimalPath]);

    const globalDiffLevels = useMemo(() => {
        const levels: number[] = [];
        recommendations.forEach((entry, index) => {
            const globalChoice = globalOptimalPath.choicesByLevel[index];
            if (globalChoice && globalChoice !== entry.choice) {
                levels.push(entry.level);
            }
        });
        return levels;
    }, [recommendations, globalOptimalPath]);

    const perLevelDiffGuideRows = useMemo<LevelDiffGuideRow[]>(
        () =>
            recommendations.map((entry, index) => {
                const greedyDamage = greedyDamageByLevel[index] ?? 0;
                const averageDamage = globalOptimalPath.damageByLevel[index] ?? greedyDamage;
                const flatDiff = averageDamage - greedyDamage;
                const percentDiff =
                    Math.abs(greedyDamage) > 1e-9 ? (flatDiff / greedyDamage) * 100 : null;

                const winner: "greedy" | "average" | "tie" =
                    flatDiff < -1e-9 ? "greedy" : flatDiff > 1e-9 ? "average" : "tie";

                return {
                    level: entry.level,
                    flatDiff,
                    percentDiff,
                    winner,
                };
            }),
        [recommendations, greedyDamageByLevel, globalOptimalPath]
    );

    const hasAnyPerLevelDelta = useMemo(
        () => perLevelDiffGuideRows.some((row) => row.winner !== "tie"),
        [perLevelDiffGuideRows]
    );

    const arePathsIdentical = useMemo(() => globalDiffLevels.length === 0, [globalDiffLevels]);

    const bestAverageAdBeforeByLevel = useMemo(() => {
        return Array.from({ length: 18 }, (_unused, index) => {
            const level = index + 1;
            const stateBeforeAtLevel =
                level === 1
                    ? { q: 0, w: 0, e: 0 }
                    : globalOptimalPath.statesAfterByLevel[level - 2] ??
                      recommendations[index]?.stateBefore ?? { q: 0, w: 0, e: 0 };
            return estimateBeforeStatsAtLevelForState(
                level,
                ownItemsByLevel[index] ?? [],
                stateBeforeAtLevel,
                totalExtraBonusADByLevel[index] ?? safeExtraBonusAD,
                safeExtraBonusLethality
            ).adBefore;
        });
    }, [
        globalOptimalPath.statesAfterByLevel,
        recommendations,
        ownItemsByLevel,
        totalExtraBonusADByLevel,
        safeExtraBonusAD,
        safeExtraBonusLethality,
    ]);

    const contextGuideRows = useMemo<ContextValueGuideRow[]>(
        () => [
            {
                key: "enemy_armor",
                label: "Target Armor",
                values: recommendations.map((entry) => entry.enemyArmor),
            },
            {
                key: "greedy_ad",
                label: "Greedy AD (pre-pick)",
                values: recommendations.map((entry) => entry.adBefore),
            },
            {
                key: "best_average_ad",
                label: "Best Avg AD (pre-pick)",
                values: bestAverageAdBeforeByLevel,
            },
        ],
        [recommendations, bestAverageAdBeforeByLevel]
    );

    const globalVsGreedyStats = useMemo(() => {
        const epsilon = 1e-9;
        const levelCount = Math.min(
            globalOptimalPath.damageByLevel.length,
            greedyDamageByLevel.length
        );
        if (levelCount === 0) {
            return { geomPercent: 0, totalPercent: 0 };
        }

        let logSum = 0;
        let globalTotal = 0;
        let greedyTotal = 0;

        for (let index = 0; index < levelCount; index++) {
            const globalDamage = Math.max(globalOptimalPath.damageByLevel[index] ?? 0, epsilon);
            const greedyDamage = Math.max(greedyDamageByLevel[index] ?? 0, epsilon);
            const ratio = globalDamage / greedyDamage;
            logSum += Math.log(ratio);
            globalTotal += globalDamage;
            greedyTotal += greedyDamage;
        }

        const geomPercent = (Math.exp(logSum / levelCount) - 1) * 100;
        const totalPercent = ((globalTotal / Math.max(greedyTotal, epsilon)) - 1) * 100;
        return { geomPercent, totalPercent };
    }, [globalOptimalPath, greedyDamageByLevel]);

    const oracleEfficiencyStats = useMemo(() => {
        const epsilon = 1e-9;
        const levelCount = Math.min(
            globalOptimalPath.damageByLevel.length,
            oracleDamageByLevel.length
        );
        if (levelCount === 0) {
            return { geomPercent: 0, meanPercent: 0 };
        }

        let logSum = 0;
        let meanSum = 0;
        for (let index = 0; index < levelCount; index++) {
            const globalDamage = Math.max(globalOptimalPath.damageByLevel[index] ?? 0, epsilon);
            const oracleDamage = Math.max(oracleDamageByLevel[index] ?? 0, epsilon);
            const ratio = globalDamage / oracleDamage;
            logSum += Math.log(ratio);
            meanSum += ratio;
        }

        const geomPercent = Math.exp(logSum / levelCount) * 100;
        const meanPercent = (meanSum / levelCount) * 100;
        return { geomPercent, meanPercent };
    }, [globalOptimalPath, oracleDamageByLevel]);

    type DrilldownContext = "greedy" | "best_average";
    const [drilldownContext, setDrilldownContext] =
        useState<DrilldownContext>("greedy");

    const drilldownStateBefore = useMemo(() => {
        if (!selectedLevel) return null;
        if (drilldownContext === "greedy") {
            return selectedDecision?.stateBefore ?? null;
        }
        if (selectedLevel === 1) {
            return { q: 0, w: 0, e: 0 };
        }
        return (
            globalOptimalPath.statesAfterByLevel[selectedLevel - 2] ?? {
                q: 0,
                w: 0,
                e: 0,
            }
        );
    }, [drilldownContext, globalOptimalPath, selectedDecision, selectedLevel]);

    const drilldownPointsForContext = useMemo(() => {
        if (!selectedLevel || !drilldownStateBefore) return [];
        return buildDrilldownPoints(
            selectedLevel,
            drilldownStateBefore,
            ownItemsByLevel[selectedLevel - 1] ?? [],
            Math.floor(Math.min(safeArmorMin, safeArmorMax)),
            Math.ceil(Math.max(safeArmorMin, safeArmorMax)),
            selectedExtraBonusAD,
            safeExtraBonusLethality
        );
    }, [
        selectedLevel,
        drilldownStateBefore,
        ownItemsByLevel,
        safeArmorMin,
        safeArmorMax,
        selectedExtraBonusAD,
        safeExtraBonusLethality,
    ]);

    const exactDeltaPercentMinimumForContext = useMemo(() => {
        if (!selectedLevel || !drilldownStateBefore) return null;
        return findExactDeltaPercentMinimum(
            selectedLevel,
            drilldownStateBefore,
            ownItemsByLevel[selectedLevel - 1] ?? [],
            safeArmorMin,
            safeArmorMax,
            selectedExtraBonusAD,
            safeExtraBonusLethality
        );
    }, [
        selectedLevel,
        drilldownStateBefore,
        ownItemsByLevel,
        safeArmorMin,
        safeArmorMax,
        selectedExtraBonusAD,
        safeExtraBonusLethality,
    ]);

    const exactDeltaPercentTransitionPointsForContext = useMemo(() => {
        if (!selectedLevel || !drilldownStateBefore) return [];
        return findExactDeltaPercentTransitionPoints(
            selectedLevel,
            drilldownStateBefore,
            ownItemsByLevel[selectedLevel - 1] ?? [],
            safeArmorMin,
            safeArmorMax,
            selectedExtraBonusAD,
            safeExtraBonusLethality
        );
    }, [
        selectedLevel,
        drilldownStateBefore,
        ownItemsByLevel,
        safeArmorMin,
        safeArmorMax,
        selectedExtraBonusAD,
        safeExtraBonusLethality,
    ]);

    const drilldownPointsForChart = useMemo(() => {
        const points = [...drilldownPointsForContext];
        const analyticPoints = [...exactDeltaPercentTransitionPointsForContext];
        if (exactDeltaPercentMinimumForContext) {
            analyticPoints.push(exactDeltaPercentMinimumForContext);
        }

        for (const analyticPoint of analyticPoints) {
            const hasExactArmorPoint = points.some(
                (point) => Math.abs(point.armor - analyticPoint.armor) <= 1e-9
            );
            if (hasExactArmorPoint) {
                continue;
            }
            points.push({
                armor: analyticPoint.armor,
                qDamage: analyticPoint.qDamage,
                eDamage: analyticPoint.eDamage,
                deltaQMinusE: analyticPoint.qDamage - analyticPoint.eDamage,
            });
        }

        points.sort((left, right) => left.armor - right.armor);
        return points;
    }, [
        drilldownPointsForContext,
        exactDeltaPercentTransitionPointsForContext,
        exactDeltaPercentMinimumForContext,
    ]);

    const expectedArmorAtSelectedLevel = useMemo(() => {
        if (!selectedLevel) return null;
        return enemyArmorByLevel[selectedLevel - 1] ?? 0;
    }, [enemyArmorByLevel, selectedLevel]);

    const expectedArmorLinePlugin = useMemo((): Plugin<"line"> => {
        return {
            id: "expectedArmorLine",
            afterDraw: (chart, _args, opts) => {
                const xValue =
                    typeof (opts as { xValue?: unknown }).xValue === "number"
                        ? ((opts as { xValue: number }).xValue as number)
                        : null;
                if (xValue === null) return;
                const xScale = chart.scales.x;
                if (!xScale || typeof xScale.getPixelForValue !== "function") return;
                const xScaleBounds = xScale as { min?: unknown; max?: unknown };
                const min =
                    typeof xScaleBounds.min === "number" ? xScaleBounds.min : null;
                const max =
                    typeof xScaleBounds.max === "number" ? xScaleBounds.max : null;
                if (min !== null && xValue < min) return;
                if (max !== null && xValue > max) return;

                const x = xScale.getPixelForValue(xValue);
                const { ctx, chartArea } = chart;
                ctx.save();
                ctx.strokeStyle = "rgba(37, 99, 235, 0.35)";
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 6]);
                ctx.beginPath();
                ctx.moveTo(x, chartArea.top);
                ctx.lineTo(x, chartArea.bottom);
                ctx.stroke();
                ctx.restore();
            },
        };
    }, []);
    const drilldownChartPlugins = useMemo<Plugin<"line">[]>(
        () => [expectedArmorLinePlugin],
        [expectedArmorLinePlugin]
    );

    const rankedSelectedLevelStates = useMemo(() => {
        if (!selectedLevel) return [];
        const states = getReachableStatesAtLevel(selectedLevel, forcedWLevels);
        return rankStatesByDamage(
            selectedLevel,
            states,
            ownItemsByLevel[selectedLevel - 1] ?? [],
            enemyArmorByLevel[selectedLevel - 1] ?? 0,
            selectedExtraBonusAD,
            safeExtraBonusLethality,
            states.length
        );
    }, [
        selectedLevel,
        forcedWLevels,
        ownItemsByLevel,
        enemyArmorByLevel,
        selectedExtraBonusAD,
        safeExtraBonusLethality,
    ]);

    const topStates = useMemo(
        () => rankedSelectedLevelStates.slice(0, TOP_STATES_LIMIT),
        [rankedSelectedLevelStates]
    );
    const topStateRows = useMemo(
        () =>
            Array.from({ length: TOP_STATES_LIMIT }, (_unused, index) => {
                return topStates[index] ?? null;
            }),
        [topStates]
    );

    const areStatesEqual = (left: PassiveRankState, right: PassiveRankState): boolean =>
        left.q === right.q && left.w === right.w && left.e === right.e;

    const planStateRank = useMemo(() => {
        if (!selectedDecision) return null;
        const match = rankedSelectedLevelStates.find((entry) =>
            areStatesEqual(entry.state, selectedDecision.stateAfter)
        );
        return match ?? null;
    }, [selectedDecision, rankedSelectedLevelStates]);

    const globalStateAtSelectedLevel = useMemo(() => {
        if (!selectedLevel) return null;
        return globalOptimalPath.statesAfterByLevel[selectedLevel - 1] ?? null;
    }, [selectedLevel, globalOptimalPath]);

    const globalStateRank = useMemo(() => {
        if (!globalStateAtSelectedLevel) return null;
        const match = rankedSelectedLevelStates.find((entry) =>
            areStatesEqual(entry.state, globalStateAtSelectedLevel)
        );
        return match ?? null;
    }, [globalStateAtSelectedLevel, rankedSelectedLevelStates]);

    const hasInspectorSelection = Boolean(selectedDecision && selectedLevel);
    const mobileSelectedIndex = selectedLevel ? selectedLevel - 1 : null;
    const mobileSelectedRecommendation =
        mobileSelectedIndex === null ? null : recommendations[mobileSelectedIndex] ?? null;
    const mobileSelectedDiff =
        mobileSelectedIndex === null
            ? null
            : perLevelDiffGuideRows[mobileSelectedIndex] ?? null;
    const mobileSelectedBestAverageAdBefore =
        mobileSelectedIndex === null
            ? null
            : bestAverageAdBeforeByLevel[mobileSelectedIndex] ?? null;
    const mobileDeltaPercentText =
        !mobileSelectedDiff ||
        mobileSelectedDiff.winner === "tie" ||
        mobileSelectedDiff.percentDiff === null
            ? "—"
            : `${trimFixed(Math.abs(mobileSelectedDiff.percentDiff), 1)}%`;
    const mobileDeltaClass = mobileSelectedDiff
        ? mobileSelectedDiff.winner === "greedy"
            ? "delta-greedy"
            : mobileSelectedDiff.winner === "average"
              ? "delta-average"
              : "delta-tie"
        : "delta-tie";
    const mobileDeltaMeaningText =
        mobileSelectedIndex === null
            ? "No level selected"
            : !mobileSelectedDiff || mobileSelectedDiff.winner === "tie"
            ? "Tie"
            : mobileSelectedDiff.winner === "greedy"
              ? "Greedy better"
              : "Best Average better";
    const lastSelectedPanelHeight = useInspectorPanelHeight({
        hasInspectorSelection,
        inspectorPanelRef,
    });

    const drilldownChartData = useMemo(
        () => ({
            datasets: [
                {
                    label: "Q dmg",
                    data: drilldownPointsForChart.map((point) => ({
                        x: point.armor,
                        y: point.qDamage,
                    })),
                    borderColor: "orange",
                    backgroundColor: "rgba(255, 165, 0, 0.2)",
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 40,
                    pointHoverRadius: 5,
                    tension: 0.1,
                },
                {
                    label: "E dmg",
                    data: drilldownPointsForChart.map((point) => ({
                        x: point.armor,
                        y: point.eDamage,
                    })),
                    borderColor: "tomato",
                    backgroundColor: "rgba(255, 99, 71, 0.2)",
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 40,
                    pointHoverRadius: 5,
                    tension: 0.1,
                },
                {
                    label: "Δ% (right)",
                    data: drilldownPointsForChart.map((point) => ({
                        x: point.armor,
                        y:
                            point.deltaQMinusE === null
                                ? null
                                : (point.deltaQMinusE /
                                      Math.max(point.eDamage ?? 0, 1e-9)) *
                                  100,
                    })),
                    borderColor: "#8E24AA",
                    backgroundColor: "rgba(142, 36, 170, 0.2)",
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHitRadius: 40,
                    pointHoverRadius: 5,
                    tension: 0.1,
                    yAxisID: "deltaAxis",
                },
                {
                    label: "Q = E",
                    data: drilldownPointsForChart.map((point) => ({
                        x: point.armor,
                        y: 0,
                    })),
                    borderColor: "#6b7280",
                    borderWidth: 1,
                    borderDash: [6, 5],
                    pointRadius: 0,
                    pointHitRadius: 0,
                    tension: 0,
                    yAxisID: "deltaAxis",
                },
            ],
        }),
        [drilldownPointsForChart]
    );

    const drilldownChartOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0,
            },
            interaction: {
                mode: "index" as const,
                intersect: false,
            },
            layout: {
                padding: {
                    top: 2,
                    left: 0,
                    right: 0,
                    bottom: 0,
                },
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top" as const,
                    align: "start" as const,
                    labels: {
                        color: "#5f5f5f",
                        boxWidth: 14,
                        boxHeight: 8,
                        padding: 6,
                        usePointStyle: true,
                        font: {
                            size: 10,
                        },
                        filter: (legendItem: { text: string }) => legendItem.text !== "Q = E",
                    },
                },
                expectedArmorLine: {
                    xValue: expectedArmorAtSelectedLevel ?? undefined,
                },
                tooltip: {
                    mode: "index" as const,
                    intersect: false,
                    backgroundColor: "rgba(22, 22, 22, 0.9)",
                    titleColor: "#ffffff",
                    bodyColor: "#f3f3f3",
                    padding: 10,
                },
                title: {
                    display: false,
                },
            },
            scales: {
                x: {
                    type: "linear" as const,
                    title: {
                        display: true,
                        text: "Armor",
                        color: "#666666",
                    },
                    ticks: {
                        color: "#666666",
                        autoSkip: true,
                        maxTicksLimit: 18,
                    },
                    grid: {
                        color: "rgba(0, 0, 0, 0.08)",
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: "Expected damage",
                        color: "#666666",
                    },
                    ticks: {
                        color: "#666666",
                    },
                    grid: {
                        color: "rgba(0, 0, 0, 0.08)",
                    },
                },
                deltaAxis: {
                    position: "right" as const,
                    title: {
                        display: true,
                        text: "Δ% (right)",
                        color: "#666666",
                    },
                    ticks: {
                        color: "#666666",
                        callback: (value: string | number) => `${value}%`,
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
            },
        }),
        [expectedArmorAtSelectedLevel]
    );

    const formatRankState = (q: number, w: number, e: number) => `${q}Q / ${w}W / ${e}E`;
    const ownChangeLevels = getUniqueSortedLevels(ownEvents);
    const enemyChangeLevels = getUniqueSortedLevels(enemyEvents);
    const modalLevel = editorContext ? clampLevel(editorContext.level) : null;
    const modalKind = editorContext?.kind ?? null;
    const isOwnModal = modalKind === "own";
    const modalItems =
        modalLevel === null
            ? []
            : isOwnModal
              ? ownItemsByLevel[modalLevel - 1] ?? []
              : enemyArmorItemsByLevel[modalLevel - 1] ?? [];
    const modalHasChangePoint =
        modalLevel === null
            ? false
            : isOwnModal
              ? ownChangeLevels.includes(modalLevel)
              : enemyChangeLevels.includes(modalLevel);
    const modalOptionByName = isOwnModal ? ITEM_OPTION_BY_NAME : ARMOR_ITEM_OPTION_BY_NAME;
    const modalOptions = isOwnModal ? ITEM_OPTIONS : ARMOR_ITEM_OPTIONS;
    const rankedModalOptions = useMemo(
        () => rankSearchOptions(modalOptions, modalSearchInput),
        [modalOptions, modalSearchInput]
    );
    const modalTitle =
        modalLevel === null
            ? ""
            : isOwnModal
              ? `Edit My Build - Level ${modalLevel}`
              : `Edit Target Build - Level ${modalLevel}`;
    const modalPlaceholder = isOwnModal ? "Add item..." : "Add armor item...";

    const getItemInitials = (itemName: string): string =>
        itemName
            .split(/\s+/)
            .map((word) => word[0] ?? "")
            .join("")
            .slice(0, 2)
            .toUpperCase();

    const ownTimelineSegments = buildTimelineSegments(ownItemsByLevel);
    const enemyTimelineSegments = buildTimelineSegments(enemyArmorItemsByLevel);
    const ownTimelineSegmentRenderKeys = useMemo(
        () => buildTimelineSegmentRenderKeys(ownTimelineSegments, "own-segment"),
        [ownTimelineSegments]
    );
    const enemyTimelineSegmentRenderKeys = useMemo(
        () => buildTimelineSegmentRenderKeys(enemyTimelineSegments, "enemy-segment"),
        [enemyTimelineSegments]
    );

    const toggleForcedWLevel = (level: number) => {
        const clamped = clampLevel(level);
        setForcedWLevels((current) => {
            if (current.includes(clamped)) {
                return current.filter((entry) => entry !== clamped);
            }
            return [...current, clamped].sort((a, b) => a - b);
        });
    };

    const selectLevelForInspector = (level: number) => {
        const clamped = clampLevel(level);
        if (isCompactLayout) {
            setHoveredInspectorLevel(null);
        }
        setSelectedLevel((current) => (current === clamped ? null : clamped));
    };

    const formatLevelRange = (startLevel: number, endLevel: number): string =>
        startLevel === endLevel ? `Lv ${startLevel}` : `Lv ${startLevel}-${endLevel}`;

    const openTimelineEditorAtLevel = (kind: TimelineKind, rawLevel: number) => {
        if (performance.now() <= suppressTimelineOpenUntilRef.current) {
            return;
        }
        const level = clampLevel(rawLevel);
        setMobileAddPickerKind(null);
        setSelectedLevel(level);
        openTimelineEditor(kind, level);
    };

    const toggleCompactSection = useCallback((section: CompactCardSection) => {
        setCompactOpenSections((current) => {
            const next = new Set(current);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    }, []);

    const removeChangePoint = (events: TimelineEvent[], level: number): TimelineEvent[] =>
        events
            .filter((event) => clampLevel(event.level) !== clampLevel(level))
            .sort((a, b) => a.level - b.level);

    const setChangePointItems = (
        events: TimelineEvent[],
        timelineByLevel: string[][],
        level: number,
        nextItems: string[]
    ): TimelineEvent[] => {
        const clampedLevel = clampLevel(level);
        const baseline = clampedLevel === 1 ? [] : timelineByLevel[clampedLevel - 2] ?? [];
        return updateTimelineForLevel(events, clampedLevel, baseline, nextItems.slice(0, 6));
    };

    const openTimelineEditor = (kind: TimelineKind, level: number) => {
        if (performance.now() <= suppressTimelineOpenUntilRef.current) {
            return;
        }
        const clamped = clampLevel(level);
        const activeElement = document.activeElement;
        lastFocusedElementRef.current =
            activeElement instanceof HTMLElement ? activeElement : null;
        setModalSearchInput("");
        setEditorContext({ kind, level: clamped });
    };

    const closeTimelineEditor = useCallback(
        (options?: { suppressNextClick?: boolean; restoreFocus?: boolean }) => {
            const shouldRestoreFocus = options?.restoreFocus ?? true;
            if (options?.suppressNextClick) {
                const suppressUntil = performance.now() + 300;
                suppressDocumentClickUntilRef.current = suppressUntil;
                suppressTimelineOpenUntilRef.current = suppressUntil;
            }
            skipNextOutsideClickRef.current = false;
            setIsModalSelectMenuOpen(false);
            setModalSearchInput("");
            setEditorContext(null);
            const previouslyFocused = lastFocusedElementRef.current;
            if (shouldRestoreFocus && previouslyFocused) {
                window.requestAnimationFrame(() => previouslyFocused.focus());
            }
        },
        []
    );

    useEffect(() => {
        const handleDocumentClickCapture = (event: MouseEvent) => {
            if (performance.now() > suppressDocumentClickUntilRef.current) return;
            suppressDocumentClickUntilRef.current = 0;
            event.preventDefault();
            event.stopPropagation();
        };

        document.addEventListener("click", handleDocumentClickCapture, true);
        return () =>
            document.removeEventListener("click", handleDocumentClickCapture, true);
    }, []);

    useEffect(() => {
        if (!editorContext) return;

        const handleOutsideInteractionCapture = (event: MouseEvent | TouchEvent) => {
            const modalElement = modalRef.current;
            if (!modalElement) return;

            const target = event.target;
            if (!(target instanceof Node)) return;
            if (modalElement.contains(target)) return;

            if (target instanceof Element) {
                if (
                    target.closest(".cutoff-select__menu") ||
                    target.closest(".cutoff-select__control")
                ) {
                    return;
                }
            }

            if (event.type === "click" && skipNextOutsideClickRef.current) {
                skipNextOutsideClickRef.current = false;
                if (event.cancelable) {
                    event.preventDefault();
                }
                event.stopPropagation();
                return;
            }

            if (event.cancelable) {
                event.preventDefault();
            }
            event.stopPropagation();

            const activeElement = document.activeElement;
            const isSelectMenuOpen = !!document.querySelector(".cutoff-select__menu");
            const isModalSelectInputActive =
                activeElement instanceof HTMLElement &&
                Boolean(activeElement.closest(".timeline-modal .timeline-select"));
            const isSelectControlFocused = !!document.querySelector(
                ".timeline-modal .cutoff-select__control--is-focused"
            );

            if (
                isCompactLayout &&
                (isSelectMenuOpen ||
                    isModalSelectInputActive ||
                    isSelectControlFocused ||
                    isModalSelectMenuOpen)
            ) {
                skipNextOutsideClickRef.current = event.type !== "click";
                if (activeElement instanceof HTMLElement) {
                    activeElement.blur();
                }
                return;
            }

            closeTimelineEditor({ suppressNextClick: true, restoreFocus: false });
        };

        document.addEventListener("mousedown", handleOutsideInteractionCapture, true);
        document.addEventListener("touchstart", handleOutsideInteractionCapture, {
            capture: true,
            passive: false,
        });
        if (isCompactLayout) {
            document.addEventListener("click", handleOutsideInteractionCapture, true);
        }
        return () => {
            document.removeEventListener("mousedown", handleOutsideInteractionCapture, true);
            document.removeEventListener("touchstart", handleOutsideInteractionCapture, true);
            if (isCompactLayout) {
                document.removeEventListener("click", handleOutsideInteractionCapture, true);
            }
        };
    }, [
        closeTimelineEditor,
        editorContext,
        isCompactLayout,
        isModalSelectMenuOpen,
    ]);

    const updateOwnItemsAtLevel = (level: number, nextItems: string[]) =>
        setOwnEvents((current) => {
            const timeline = resolveTimeline(current);
            return setChangePointItems(current, timeline, level, nextItems);
        });

    const updateEnemyItemsAtLevel = (level: number, nextItems: string[]) =>
        setEnemyEvents((current) => {
            const timeline = resolveTimeline(current);
            return setChangePointItems(current, timeline, level, nextItems);
        });

    const deleteChangePoint = (kind: TimelineKind, level: number) => {
        const clamped = clampLevel(level);
        if (kind === "own") {
            setOwnEvents((current) => removeChangePoint(current, clamped));
        } else {
            setEnemyEvents((current) => removeChangePoint(current, clamped));
        }
        if (
            editorContext &&
            editorContext.kind === kind &&
            clampLevel(editorContext.level) === clamped
        ) {
            closeTimelineEditor();
        }
    };

    const moveChangePoint = (
        kind: TimelineKind,
        fromLevel: number,
        direction: -1 | 1
    ) => {
        const clampedFrom = clampLevel(fromLevel);
        const targetLevel = clampedFrom + direction;
        if (targetLevel < 1 || targetLevel > 18) return;

        const applyMove = (events: TimelineEvent[]): TimelineEvent[] => {
            const changeLevelSet = new Set(getUniqueSortedLevels(events));
            if (!changeLevelSet.has(clampedFrom)) return events;
            if (changeLevelSet.has(targetLevel)) return events;

            const timelineBeforeMove = resolveTimeline(events);
            const desiredItemsAtFromLevel = timelineBeforeMove[clampedFrom - 1] ?? [];
            const withoutFromLevel = removeChangePoint(events, clampedFrom);
            const timelineAfterRemoval = resolveTimeline(withoutFromLevel);
            return setChangePointItems(
                withoutFromLevel,
                timelineAfterRemoval,
                targetLevel,
                desiredItemsAtFromLevel
            );
        };

        if (kind === "own") {
            setOwnEvents(applyMove);
        } else {
            setEnemyEvents(applyMove);
        }
    };

    const setModalItems = (nextItems: string[]) => {
        if (modalLevel === null || modalKind === null) return;
        const next = nextItems.slice(0, 6);
        if (modalKind === "own") {
            updateOwnItemsAtLevel(modalLevel, next);
            return;
        }
        updateEnemyItemsAtLevel(modalLevel, next);
    };

    const addModalItem = (itemName: string) => {
        if (modalLevel === null || modalKind === null || modalItems.length >= 6) return;
        setModalItems([...modalItems, itemName]);
    };

    const removeModalItemAt = (index: number) => {
        if (modalLevel === null || modalKind === null) return;
        const nextItems = modalItems.filter((_, slotIndex) => slotIndex !== index);
        setModalItems(nextItems);
    };

    useTimelineModalFocusTrap({
        isOpen: Boolean(editorContext),
        modalRef,
        closeButtonRef,
        onRequestClose: closeTimelineEditor,
    });

    if (!isLoaded) {
        return null;
    }

    return (
        <div className="aphelios-cutoff-analysis">
            <div className="cutoff-controls-grid">
                <ControlCard
                    sectionId="passive"
                    title="Passive Ranks"
                    isCompactLayout={isCompactLayout}
                    isOpen={!isCompactLayout || compactOpenSections.has("passive")}
                    onToggle={() => toggleCompactSection("passive")}
                >
                    <div className="passive-stat-list">
                        <p className="muted-note passive-stat-line passive-stat-line-q">
                            <strong>Q (AD)</strong>
                            : +{qStep} / {qMax} max
                        </p>
                        <p className="muted-note passive-stat-line passive-stat-line-e">
                            <strong>E (Lethality)</strong>
                            : +{eStep} / {eMax} max
                        </p>
                        <p className="muted-note">
                            Ranks unlock at levels{" "}
                            <strong>{passiveRankUnlockLevels.join(", ")}</strong>
                        </p>
                    </div>
                </ControlCard>

                <ControlCard
                    sectionId="force_w"
                    title="Force W Levels"
                    isCompactLayout={isCompactLayout}
                    isOpen={!isCompactLayout || compactOpenSections.has("force_w")}
                    onToggle={() => toggleCompactSection("force_w")}
                    compactSummary={
                        <>
                            W levels:{" "}
                            <strong>
                                {forcedWLevels.length > 0 ? forcedWLevels.join(", ") : "none"}
                            </strong>
                        </>
                    }
                >
                    <div className="forced-w-head">
                        <div className="muted-note passive-stat-line passive-stat-line-w">
                            Force W at levels
                            <HelpHint
                                label="W (AS)"
                                description="Forced levels always spend points into W (AS) when allowed."
                            />
                        </div>
                        <div className="forced-w-actions">
                            <button
                                type="button"
                                className="timeline-action-button"
                                onClick={() => setForcedWLevels([])}
                                disabled={forcedWLevels.length === 0}
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                    <div className="forced-w-grid">
                        {Array.from({ length: 18 }, (_, index) => {
                            const level = index + 1;
                            const active = forcedWLevels.includes(level);
                            const blocked = active && unappliedForcedWSet.has(level);
                            return (
                                <button
                                    key={`force-w-${level}`}
                                    type="button"
                                    className={`forced-level-chip ${active ? "active" : ""} ${
                                        blocked ? "blocked" : ""
                                    }`}
                                    onClick={() => toggleForcedWLevel(level)}
                                    aria-pressed={active}
                                    title={
                                        blocked
                                            ? "Selected, but W cannot be forced at this level."
                                            : undefined
                                    }
                                >
                                    {level}
                                </button>
                            );
                        })}
                    </div>
                    <p className="muted-note">
                        Forced W levels:{" "}
                        <strong>
                            {forcedWAppliedLevels.length > 0
                                ? forcedWAppliedLevels.join(", ")
                                : "none"}
                        </strong>
                    </p>
                    <p
                        className={`muted-note force-w-status-note ${
                            unappliedForcedWLevels.length > 0 ? "" : "is-empty"
                        }`}
                        title={
                            unappliedForcedWLevels.length > 0
                                ? `Could not force W at: ${unappliedForcedWLevels.join(", ")}`
                                : undefined
                        }
                        aria-hidden={unappliedForcedWLevels.length === 0}
                    >
                        Could not force W at: <strong>{unappliedForcedWLevels.join(", ")}</strong>
                    </p>
                </ControlCard>

                <ControlCard
                    sectionId="extra_stats"
                    title="Extra Stats"
                    isCompactLayout={isCompactLayout}
                    isOpen={!isCompactLayout || compactOpenSections.has("extra_stats")}
                    onToggle={() => toggleCompactSection("extra_stats")}
                    compactSummary={
                        <>
                            AD Shards <strong>{safeAdShardCount}</strong> · Abs Focus{" "}
                            <strong>{safeAbsoluteFocus ? "On" : "Off"}</strong> · Extra AD{" "}
                            <strong>{trimFixed(safeExtraBonusAD, 1)}</strong>
                        </>
                    }
                >
                    <label className="field-label">
                        <span className="field-label-title">AD Shards</span>
                        <div className="cutoff-shard-buttons" role="group" aria-label="AD shards">
                            {[0, 1, 2].map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    className={`cutoff-shard-button ${
                                        safeAdShardCount === count ? "active" : ""
                                    }`}
                                    onClick={() => setAdShardCount(count)}
                                    aria-pressed={safeAdShardCount === count}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                    </label>
                    <label className="field-label checkbox-field-label">
                        <span className="field-label-title">Absolute Focus</span>
                        <input
                            id="cutoff-absolute-focus"
                            name="absolute_focus"
                            type="checkbox"
                            checked={safeAbsoluteFocus}
                            onChange={(e) => setAbsoluteFocus(e.target.checked)}
                        />
                    </label>
                    <label className="field-label">
                        <span className="field-label-title">Extra AD</span>
                        <input
                            id="cutoff-bonus-ad"
                            name="bonus_ad"
                            type="number"
                            value={extraBonusAD}
                            onChange={(e) => {
                                const parsedBonusAD = Number(e.target.value);
                                if (Number.isFinite(parsedBonusAD)) {
                                    setExtraBonusAD(parsedBonusAD);
                                }
                            }}
                        />
                    </label>
                </ControlCard>

                <ControlCard
                    sectionId="armor_model"
                    title="Target Armor Model"
                    isCompactLayout={isCompactLayout}
                    isOpen={!isCompactLayout || compactOpenSections.has("armor_model")}
                    onToggle={() => toggleCompactSection("armor_model")}
                    compactSummary={
                        <>
                            <strong>{enemyProfile.name}</strong> · Base {enemyProfile.baseArmor} ·
                            Growth {enemyProfile.armorGrowth}
                        </>
                    }
                >
                    <label className="field-label">
                        Target profile
                        <select
                            id="cutoff-target-profile"
                            name="target_profile"
                            value={enemyProfile.id}
                            onChange={(e) => setEnemyProfileId(e.target.value)}
                        >
                            {ENEMY_ARMOR_PROFILES.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                    {profile.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <p className="muted-note">
                        Base armor {enemyProfile.baseArmor} · growth {enemyProfile.armorGrowth}
                    </p>
                    {enemyProfile.includedChampions &&
                    enemyProfile.includedChampions.length > 0 ? (
                        <details className="profile-included-details">
                            <summary>
                                Included champions ({enemyProfile.includedChampions.length})
                            </summary>
                            <p className="muted-note profile-included-list">
                                {enemyProfile.includedChampions.join(", ")}
                            </p>
                        </details>
                    ) : null}
                </ControlCard>
            </div>

            <section className="cutoff-card timeline-combined-card">
                <h3>Build Timeline</h3>
                <p className="muted-note">
                    Add only levels where your inventory changes; everything persists forward until the next change.
                </p>

                {isCompactLayout ? (
                    <div className="timeline-mobile-lanes">
                        <div className="timeline-mobile-lane">
                            <div className="timeline-mobile-lane-head">
                                <h4>My Build</h4>
                                <button
                                    type="button"
                                    className="timeline-action-button timeline-mobile-add-button"
                                    onClick={() =>
                                        setMobileAddPickerKind((current) =>
                                            current === "own" ? null : "own"
                                        )
                                    }
                                >
                                    + Add change
                                </button>
                            </div>
                            {mobileAddPickerKind === "own" && (
                                <div className="timeline-mobile-add-picker">
                                    <p className="muted-note">Choose level</p>
                                    <div className="timeline-mobile-add-grid">
                                        {Array.from({ length: 18 }, (_, index) => {
                                            const level = index + 1;
                                            return (
                                                <button
                                                    key={`own-add-level-${level}`}
                                                    type="button"
                                                    className="timeline-mobile-add-chip"
                                                    onClick={() =>
                                                        openTimelineEditorAtLevel("own", level)
                                                    }
                                                >
                                                    {level}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="timeline-mobile-segment-list">
                                {ownTimelineSegments.map((segment, index) => {
                                    const hasChangePoint = ownChangeLevels.includes(
                                        segment.startLevel
                                    );
                                    const canMoveEarlier =
                                        hasChangePoint &&
                                        segment.startLevel > 1 &&
                                        !ownChangeLevels.includes(segment.startLevel - 1);
                                    const canMoveLater =
                                        hasChangePoint &&
                                        segment.startLevel < 18 &&
                                        !ownChangeLevels.includes(segment.startLevel + 1);
                                    const isEditingTarget =
                                        editorContext?.kind === "own" &&
                                        modalLevel === segment.startLevel;
                                    return (
                                        <div
                                            key={ownTimelineSegmentRenderKeys[index]}
                                            className={`timeline-mobile-segment ${
                                                isEditingTarget ? "editing-target" : ""
                                            }`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() =>
                                                openTimelineEditorAtLevel("own", segment.startLevel)
                                            }
                                            onKeyDown={(event) => {
                                                if (event.target !== event.currentTarget) {
                                                    return;
                                                }
                                                if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                ) {
                                                    event.preventDefault();
                                                    openTimelineEditorAtLevel(
                                                        "own",
                                                        segment.startLevel
                                                    );
                                                }
                                            }}
                                            aria-label={`Edit build change at ${formatLevelRange(
                                                segment.startLevel,
                                                segment.endLevel
                                            )}`}
                                        >
                                            <div className="timeline-mobile-segment-head">
                                                <span className="timeline-mobile-segment-level">
                                                    {formatLevelRange(
                                                        segment.startLevel,
                                                        segment.endLevel
                                                    )}
                                                </span>
                                            </div>
                                            <div className="timeline-mobile-segment-content">
                                                <TimelineSegmentItems
                                                    items={segment.items}
                                                    optionByName={ITEM_OPTION_BY_NAME}
                                                />
                                                <div
                                                    className={`timeline-mobile-segment-side ${
                                                        hasChangePoint ? "" : "is-baseline"
                                                    }`}
                                                >
                                                    {hasChangePoint ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="timeline-action-button timeline-mobile-segment-shift-button"
                                                                disabled={!canMoveEarlier}
                                                                title="Move this change 1 level earlier"
                                                                aria-label="Move this change 1 level earlier"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    moveChangePoint(
                                                                        "own",
                                                                        segment.startLevel,
                                                                        -1
                                                                    );
                                                                }}
                                                            >
                                                                -Level
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="timeline-action-button timeline-mobile-segment-shift-button"
                                                                disabled={!canMoveLater}
                                                                title="Move this change 1 level later"
                                                                aria-label="Move this change 1 level later"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    moveChangePoint(
                                                                        "own",
                                                                        segment.startLevel,
                                                                        1
                                                                    );
                                                                }}
                                                            >
                                                                +Level
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="timeline-action-button danger timeline-mobile-segment-delete"
                                                                title="Delete this change point"
                                                                aria-label="Delete this change point"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    deleteChangePoint(
                                                                        "own",
                                                                        segment.startLevel
                                                                    );
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="timeline-mobile-segment-badge">
                                                            Baseline
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="timeline-mobile-lane">
                            <div className="timeline-mobile-lane-head">
                                <h4>
                                    Target Build
                                    <span className="timeline-target-build-note-inline">
                                        (armor only, no item passives)
                                    </span>
                                </h4>
                                <button
                                    type="button"
                                    className="timeline-action-button timeline-mobile-add-button"
                                    onClick={() =>
                                        setMobileAddPickerKind((current) =>
                                            current === "enemy" ? null : "enemy"
                                        )
                                    }
                                >
                                    + Add change
                                </button>
                            </div>
                            {mobileAddPickerKind === "enemy" && (
                                <div className="timeline-mobile-add-picker">
                                    <p className="muted-note">Choose level</p>
                                    <div className="timeline-mobile-add-grid">
                                        {Array.from({ length: 18 }, (_, index) => {
                                            const level = index + 1;
                                            return (
                                                <button
                                                    key={`enemy-add-level-${level}`}
                                                    type="button"
                                                    className="timeline-mobile-add-chip"
                                                    onClick={() =>
                                                        openTimelineEditorAtLevel("enemy", level)
                                                    }
                                                >
                                                    {level}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="timeline-mobile-segment-list">
                                {enemyTimelineSegments.map((segment, index) => {
                                    const hasChangePoint = enemyChangeLevels.includes(
                                        segment.startLevel
                                    );
                                    const canMoveEarlier =
                                        hasChangePoint &&
                                        segment.startLevel > 1 &&
                                        !enemyChangeLevels.includes(segment.startLevel - 1);
                                    const canMoveLater =
                                        hasChangePoint &&
                                        segment.startLevel < 18 &&
                                        !enemyChangeLevels.includes(segment.startLevel + 1);
                                    const isEditingTarget =
                                        editorContext?.kind === "enemy" &&
                                        modalLevel === segment.startLevel;
                                    return (
                                        <div
                                            key={enemyTimelineSegmentRenderKeys[index]}
                                            className={`timeline-mobile-segment ${
                                                isEditingTarget ? "editing-target" : ""
                                            }`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() =>
                                                openTimelineEditorAtLevel(
                                                    "enemy",
                                                    segment.startLevel
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (event.target !== event.currentTarget) {
                                                    return;
                                                }
                                                if (
                                                    event.key === "Enter" ||
                                                    event.key === " "
                                                ) {
                                                    event.preventDefault();
                                                    openTimelineEditorAtLevel(
                                                        "enemy",
                                                        segment.startLevel
                                                    );
                                                }
                                            }}
                                            aria-label={`Edit build change at ${formatLevelRange(
                                                segment.startLevel,
                                                segment.endLevel
                                            )}`}
                                        >
                                            <div className="timeline-mobile-segment-head">
                                                <span className="timeline-mobile-segment-level">
                                                    {formatLevelRange(
                                                        segment.startLevel,
                                                        segment.endLevel
                                                    )}
                                                </span>
                                            </div>
                                            <div className="timeline-mobile-segment-content">
                                                <TimelineSegmentItems
                                                    items={segment.items}
                                                    optionByName={ARMOR_ITEM_OPTION_BY_NAME}
                                                />
                                                <div
                                                    className={`timeline-mobile-segment-side ${
                                                        hasChangePoint ? "" : "is-baseline"
                                                    }`}
                                                >
                                                    {hasChangePoint ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="timeline-action-button timeline-mobile-segment-shift-button"
                                                                disabled={!canMoveEarlier}
                                                                title="Move this change 1 level earlier"
                                                                aria-label="Move this change 1 level earlier"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    moveChangePoint(
                                                                        "enemy",
                                                                        segment.startLevel,
                                                                        -1
                                                                    );
                                                                }}
                                                            >
                                                                -Level
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="timeline-action-button timeline-mobile-segment-shift-button"
                                                                disabled={!canMoveLater}
                                                                title="Move this change 1 level later"
                                                                aria-label="Move this change 1 level later"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    moveChangePoint(
                                                                        "enemy",
                                                                        segment.startLevel,
                                                                        1
                                                                    );
                                                                }}
                                                            >
                                                                +Level
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="timeline-action-button danger timeline-mobile-segment-delete"
                                                                title="Delete this change point"
                                                                aria-label="Delete this change point"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    deleteChangePoint(
                                                                        "enemy",
                                                                        segment.startLevel
                                                                    );
                                                                }}
                                                            >
                                                                Delete
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="timeline-mobile-segment-badge">
                                                            Baseline
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="timeline-build-stack">
                        <div className="timeline-resolved-group">
                            <h4>My Build</h4>
                            <div className="timeline-preview-rows">
                                {Array.from({ length: 18 }, (_, index) => {
                                    const level = index + 1;
                                    const items = ownItemsByLevel[index] ?? [];
                                    const changed = levelBuildChanged(ownItemsByLevel, index);
                                    const hasChangePoint = ownChangeLevels.includes(level);
                                    return (
                                        <div
                                            key={`own-preview-${level}`}
                                            className={`timeline-preview-card ${changed ? "changed" : "unchanged"} ${
                                                editorContext?.kind === "own" &&
                                                modalLevel === level
                                                    ? "editing-target"
                                                    : ""
                                            } ${items.length === 0 ? "empty-level" : ""}`}
                                        >
                                            <button
                                                type="button"
                                                className="timeline-preview-main"
                                                onClick={() =>
                                                    openTimelineEditorAtLevel("own", level)
                                                }
                                            >
                                                <span className="timeline-level">Lv {level}</span>
                                                <TimelinePreviewItems
                                                    items={items}
                                                    optionByName={ITEM_OPTION_BY_NAME}
                                                    emptyLabel="Item"
                                                />
                                            </button>
                                            {hasChangePoint && (
                                                <button
                                                    type="button"
                                                    className="timeline-preview-delete"
                                                    title={`Delete own-item change point at level ${level}`}
                                                    aria-label={`Delete own-item change point at level ${level}`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        deleteChangePoint("own", level);
                                                    }}
                                                >
                                                    Del
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="timeline-resolved-group">
                            <h4>
                                Target Build
                                <span className="timeline-target-build-note-inline">
                                    (armor only, no item passives)
                                </span>
                            </h4>
                            <div className="timeline-preview-rows">
                                {Array.from({ length: 18 }, (_, index) => {
                                    const level = index + 1;
                                    const items = enemyArmorItemsByLevel[index] ?? [];
                                    const changed = levelBuildChanged(
                                        enemyArmorItemsByLevel,
                                        index
                                    );
                                    const hasChangePoint = enemyChangeLevels.includes(level);
                                    return (
                                        <div
                                            key={`enemy-preview-${level}`}
                                            className={`timeline-preview-card ${changed ? "changed" : "unchanged"} ${
                                                editorContext?.kind === "enemy" &&
                                                modalLevel === level
                                                    ? "editing-target"
                                                    : ""
                                            } ${items.length === 0 ? "empty-level" : ""}`}
                                        >
                                            <button
                                                type="button"
                                                className="timeline-preview-main"
                                                onClick={() =>
                                                    openTimelineEditorAtLevel("enemy", level)
                                                }
                                            >
                                                <span className="timeline-level">Lv {level}</span>
                                                <TimelinePreviewItems
                                                    items={items}
                                                    optionByName={ARMOR_ITEM_OPTION_BY_NAME}
                                                    emptyLabel="Item"
                                                />
                                            </button>
                                            {hasChangePoint && (
                                                <button
                                                    type="button"
                                                    className="timeline-preview-delete"
                                                    title={`Delete target change point at level ${level}`}
                                                    aria-label={`Delete target change point at level ${level}`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        deleteChangePoint("enemy", level);
                                                    }}
                                                >
                                                    Del
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <section className="cutoff-card">
                <div className="global-optimal-head">
                    <div className="global-optimal-title-group">
                        <h3>Greedy vs Best Average</h3>
                        <p className="muted-note global-optimal-subtitle">
                            {greedyVsBestAverageDescription}
                        </p>
                    </div>
                    <label className="field-label global-optimizer-select">
                        <span className="global-optimizer-label">Optimizer</span>
                        <select
                            id="cutoff-global-optimizer"
                            name="global_optimizer"
                            value={globalOptimizerId}
                            onChange={(event) =>
                                setGlobalOptimizerId(
                                    sanitizeGlobalOptimizerId(event.target.value)
                                )
                            }
                        >
                            <option value="greedy_norm">
                                Greedy-normalized (mean D / Greedy)
                            </option>
                            <option value="oracle_norm">
                                Upper-bound normalized (mean D / per-level max)
                            </option>
                        </select>
                    </label>
                </div>
                <div className="results-primary-layout">
                    <div className="results-primary-grid-column">
                        {isCompactLayout ? (
                            <div className="mobile-results-stack">
                                <div className="mobile-context-summary">
                                    <div className="mobile-context-item">
                                        <span className="mobile-context-label">
                                            Enemy Armor
                                        </span>
                                        <strong className="mobile-context-value">
                                            {mobileSelectedRecommendation
                                                ? trimFixed(
                                                      mobileSelectedRecommendation.enemyArmor,
                                                      1
                                                  )
                                                : "—"}
                                        </strong>
                                    </div>
                                    <div className="mobile-context-item">
                                        <span className="mobile-context-label">
                                            Greedy AD (pre)
                                        </span>
                                        <strong className="mobile-context-value">
                                            {mobileSelectedRecommendation
                                                ? trimFixed(
                                                      mobileSelectedRecommendation.adBefore,
                                                      1
                                                  )
                                                : "—"}
                                        </strong>
                                    </div>
                                    <div className="mobile-context-item">
                                        <span className="mobile-context-label">
                                            Best Avg AD (pre)
                                        </span>
                                        <strong className="mobile-context-value">
                                            {mobileSelectedBestAverageAdBefore !== null
                                                ? trimFixed(
                                                      mobileSelectedBestAverageAdBefore,
                                                      1
                                                  )
                                                : "—"}
                                        </strong>
                                    </div>
                                    <div className="mobile-context-item">
                                        <span className="mobile-context-label">
                                            % Δ (Greedy vs Best Avg)
                                        </span>
                                        <strong
                                            className={`mobile-context-value mobile-delta-value ${mobileDeltaClass}`}
                                        >
                                            {mobileDeltaPercentText}
                                        </strong>
                                        <span className="mobile-context-note">
                                            {mobileDeltaMeaningText}
                                        </span>
                                    </div>
                                </div>

                                <div className="mobile-path-grid-stack">
                                    <div className="mobile-path-grid-clickstack">
                                        <div
                                            className="path-guides-column-clickzones"
                                            aria-hidden="true"
                                        >
                                            {Array.from({ length: 18 }, (_, index) => {
                                                const level = index + 1;
                                                return (
                                                    <span
                                                        key={`mobile-stack-click-${level}`}
                                                        className="path-guides-column-clickzone"
                                                        style={
                                                            {
                                                                "--guide-band-index": level,
                                                            } as React.CSSProperties
                                                        }
                                                        onClick={() =>
                                                            selectLevelForInspector(level)
                                                        }
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div className="path-guide-panel path-guide-panel-mobile">
                                            <h4>Greedy</h4>
                                            <LevelGuide
                                                rows={greedyLevelGuideRows}
                                                highlightedLevels={globalDiffLevels}
                                                showLevelHeader={false}
                                                inspectorLevel={selectedLevel}
                                                onSelectLevel={selectLevelForInspector}
                                                hoveredInspectorLevel={hoveredInspectorLevel}
                                                setHoveredInspectorLevel={setHoveredInspectorLevel}
                                            />
                                        </div>
                                        <div className="path-guide-panel path-guide-panel-mobile">
                                            <h4>Best Average</h4>
                                            <LevelGuide
                                                rows={globalLevelGuideRows}
                                                highlightedLevels={globalDiffLevels}
                                                showLevelHeader={false}
                                                inspectorLevel={selectedLevel}
                                                onSelectLevel={selectLevelForInspector}
                                                hoveredInspectorLevel={hoveredInspectorLevel}
                                                setHoveredInspectorLevel={setHoveredInspectorLevel}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <p className="muted-note results-grid-summary">
                                    {selectedLevel
                                        ? `Selected level: ${selectedLevel}. Tap again to clear.`
                                        : "No level selected. Tap any level column to inspect."}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="cutoff-level-guides-scroll">
                                    <div className="path-guides-stack">
                                        <div
                                            className="path-guides-column-clickzones"
                                            aria-hidden="true"
                                        >
                                            {Array.from({ length: 18 }, (_, index) => {
                                                const level = index + 1;
                                                return (
                                                    <span
                                                        key={`stack-click-${level}`}
                                                        className="path-guides-column-clickzone"
                                                        style={
                                                            {
                                                                "--guide-band-index": level,
                                                            } as React.CSSProperties
                                                        }
                                                        onMouseEnter={() =>
                                                            setHoveredInspectorLevel(level)
                                                        }
                                                        onMouseLeave={() =>
                                                            setHoveredInspectorLevel(null)
                                                        }
                                                        onClick={() =>
                                                            selectLevelForInspector(level)
                                                        }
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div className="path-guide-panel path-guide-panel-stacked">
                                            <h4>Per-Level Context</h4>
                                            <ContextValueGuide
                                                rows={contextGuideRows}
                                                highlightedLevels={globalDiffLevels}
                                                showLevelHeader
                                                inspectorLevel={selectedLevel}
                                                onSelectLevel={selectLevelForInspector}
                                                hoveredInspectorLevel={hoveredInspectorLevel}
                                                setHoveredInspectorLevel={setHoveredInspectorLevel}
                                            />
                                        </div>
                                        <div className="path-guide-panel path-guide-panel-stacked">
                                            <h4>Greedy</h4>
                                            <LevelGuide
                                                rows={greedyLevelGuideRows}
                                                highlightedLevels={globalDiffLevels}
                                                showLevelHeader={false}
                                                inspectorLevel={selectedLevel}
                                                onSelectLevel={selectLevelForInspector}
                                                hoveredInspectorLevel={hoveredInspectorLevel}
                                                setHoveredInspectorLevel={setHoveredInspectorLevel}
                                            />
                                        </div>
                                        <div className="path-guide-panel path-guide-panel-stacked">
                                            {hasAnyPerLevelDelta ? (
                                                <LevelDiffGuide
                                                    rows={perLevelDiffGuideRows}
                                                    highlightedLevels={globalDiffLevels}
                                                    showLevelHeader={false}
                                                    inspectorLevel={selectedLevel}
                                                    onSelectLevel={selectLevelForInspector}
                                                    hoveredInspectorLevel={hoveredInspectorLevel}
                                                    setHoveredInspectorLevel={
                                                        setHoveredInspectorLevel
                                                    }
                                                />
                                            ) : (
                                                <p className="muted-note path-delta-empty">
                                                    {arePathsIdentical
                                                        ? "Paths are identical (Greedy = Best Average)."
                                                        : "No per-level delta at expected armor."}
                                                </p>
                                            )}
                                        </div>
                                        <div className="path-guide-panel path-guide-panel-stacked">
                                            <h4>Best Average</h4>
                                            <LevelGuide
                                                rows={globalLevelGuideRows}
                                                highlightedLevels={globalDiffLevels}
                                                showLevelHeader={false}
                                                inspectorLevel={selectedLevel}
                                                onSelectLevel={selectLevelForInspector}
                                                hoveredInspectorLevel={hoveredInspectorLevel}
                                                setHoveredInspectorLevel={setHoveredInspectorLevel}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <p className="muted-note results-grid-summary">
                                    {selectedLevel
                                        ? `Selected level: ${selectedLevel}. Click again to clear.`
                                        : "No level selected. Click any level column to inspect."}
                                </p>
                            </>
                        )}
                    </div>
	                    <aside
                            className="results-inspector-panel"
                            ref={inspectorPanelRef}
                            style={
                                !hasInspectorSelection && lastSelectedPanelHeight > 0
                                    ? { minHeight: `${lastSelectedPanelHeight}px` }
                                    : undefined
                            }
                        >
	                        {hasInspectorSelection ? (
	                            <div className="inspector-header">
	                                <div className="inspector-top-grid">
	                                    <div className="inspector-top-left">
                                            <div className="inspector-summary">
                                                <p className="muted-note inspector-insight">
                                                    <strong>Level {selectedLevel}</strong>{" "}
                                                    <span className="inspector-summary-sep">·</span>{" "}
                                                    cross-armor sweep and rank sanity check
                                                </p>
                                            </div>

                                            <div className="inspector-chart-context inspector-sweep-context">
                                                <span className="muted-note inspector-chart-context-label">
                                                    Sweep path:
                                                </span>
                                                <div
                                                    className="inspector-segmented"
                                                    role="group"
                                                    aria-label="Sweep path"
                                                >
                                                    <button
                                                        type="button"
                                                        className={[
                                                            "inspector-segment",
                                                            drilldownContext === "greedy"
                                                                ? "is-active"
                                                                : "",
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" ")}
                                                        onClick={() =>
                                                            setDrilldownContext("greedy")
                                                        }
                                                    >
                                                        Greedy path
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={[
                                                            "inspector-segment",
                                                            drilldownContext === "best_average"
                                                                ? "is-active"
                                                                : "",
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" ")}
                                                        onClick={() =>
                                                            setDrilldownContext("best_average")
                                                        }
                                                    >
                                                        Best Average path
                                                    </button>
	                                                </div>
	                                            </div>
	                                        </div>

	                                        <div className="inspector-top-right">
	                                            <div className="armor-range-row inspector-armor-range">
	                                                <label className="field-label">
	                                                    <span className="inspector-armor-label">
	                                                        Min armor
	                                                    </span>
	                                                    <input
	                                                        id="cutoff-armor-min"
	                                                        name="armor_min"
	                                                        type="number"
	                                                        value={armorMin}
	                                                        onChange={(e) => {
	                                                            const parsedArmorMin = Number(
	                                                                e.target.value
	                                                            );
	                                                            if (Number.isFinite(parsedArmorMin)) {
	                                                                setArmorMin(parsedArmorMin);
	                                                            }
	                                                        }}
	                                                    />
	                                                </label>
	                                                <label className="field-label">
	                                                    <span className="inspector-armor-label">
	                                                        Max armor
	                                                    </span>
	                                                    <input
	                                                        id="cutoff-armor-max"
	                                                        name="armor_max"
	                                                        type="number"
	                                                        value={armorMax}
	                                                        onChange={(e) => {
	                                                            const parsedArmorMax = Number(
	                                                                e.target.value
	                                                            );
	                                                            if (Number.isFinite(parsedArmorMax)) {
	                                                                setArmorMax(parsedArmorMax);
	                                                            }
	                                                        }}
	                                                    />
	                                                </label>
	                                            </div>
	                                        </div>
	                                    </div>
	                            </div>
	                        ) : null}

	                        <div className="inspector-scroll-body">
	                            {!hasInspectorSelection ? (
	                                <>
	                                    <p className="muted-note inspector-empty-optimizer-note">
	                                        Optimizer:{" "}
	                                        <strong>
	                                            {globalOptimizerId === "greedy_norm"
	                                                ? "Greedy-normalized"
	                                                : "Upper-bound normalized"}
	                                        </strong>
	                                        {" — "}
	                                        {globalOptimizerId === "greedy_norm"
	                                            ? "scores paths by how much they beat Greedy."
	                                            : "scores paths by how close they are to each level's best possible damage."}
	                                    </p>
	                                    <div className="inspector-empty-stats">
	                                        <div className="global-stat-block">
	                                            <h4>Greedy vs Best Average</h4>
	                                            <p className="muted-note inspector-empty-stat-subtitle">
	                                                How much Best Average beats Greedy overall.
	                                            </p>
	                                            <p className="muted-note">
	                                                Geom:{" "}
	                                                <strong>
	                                                    {globalVsGreedyStats.geomPercent.toFixed(2)}
	                                                    %
	                                                </strong>
	                                            </p>
	                                            <p className="muted-note">
	                                                Total:{" "}
	                                                <strong>
	                                                    {globalVsGreedyStats.totalPercent.toFixed(2)}
	                                                    %
	                                                </strong>
	                                            </p>
	                                        </div>
	                                        <div className="global-stat-block">
	                                            <h4>Per-Level Upper-Bound Efficiency</h4>
	                                            <p className="muted-note inspector-empty-stat-subtitle">
	                                                How close the path is to per-level best damage.
	                                            </p>
	                                            <p className="muted-note">
	                                                Geom:{" "}
	                                                <strong>
	                                                    {oracleEfficiencyStats.geomPercent.toFixed(2)}
	                                                    %
	                                                </strong>
	                                            </p>
	                                            <p className="muted-note">
	                                                Mean:{" "}
	                                                <strong>
	                                                    {oracleEfficiencyStats.meanPercent.toFixed(2)}
	                                                    %
	                                                </strong>
	                                            </p>
	                                        </div>
	                                        <div className="global-stat-block">
	                                            <h4>Path Delta</h4>
	                                            <p className="muted-note inspector-empty-stat-subtitle">
	                                                Where Best Average differs from Greedy.
	                                            </p>
	                                            <p className="muted-note">
	                                                Differs at levels:{" "}
	                                                <strong>
	                                                    {globalDiffLevels.length > 0
	                                                        ? globalDiffLevels.join(", ")
	                                                        : "none"}
	                                                </strong>
	                                            </p>
	                                            <p className="muted-note">
	                                                Objective score:{" "}
	                                                <strong>
	                                                    {globalOptimalPath.meanScore.toFixed(4)}
	                                                </strong>
	                                            </p>
	                                        </div>
	                                    </div>
	                                </>
	                            ) : (
	                                <>
	                                    <div className="drilldown-chart-wrap">
	                                        <Line
	                                            data={drilldownChartData}
	                                            options={drilldownChartOptions}
	                                            plugins={drilldownChartPlugins}
	                                        />
	                                    </div>

	                                    <div className="inspector-top-states">
	                                        <p className="muted-note inspector-rank-summary">
	                                            <span className="inspector-rank-greedy">
	                                                Greedy ranks{" "}
	                                                <strong>
	                                                    #{planStateRank?.rank ?? "—"}
	                                                </strong>{" "}
	                                                <span className="inspector-rank-state">
	                                                    {formatRankState(
	                                                        selectedDecision!.stateAfter.q,
	                                                        selectedDecision!.stateAfter.w,
	                                                        selectedDecision!.stateAfter.e
	                                                    )}
	                                                </span>
	                                            </span>
	                                            <span className="inspector-rank-dot">·</span>
	                                            <span className="inspector-rank-best-average">
	                                                Best Average ranks{" "}
	                                                <strong>
	                                                    #{globalStateRank?.rank ?? "—"}
	                                                </strong>{" "}
	                                                {globalStateAtSelectedLevel && (
	                                                    <span className="inspector-rank-state">
	                                                        {formatRankState(
	                                                            globalStateAtSelectedLevel.q,
	                                                            globalStateAtSelectedLevel.w,
	                                                            globalStateAtSelectedLevel.e
	                                                        )}
	                                                    </span>
	                                                )}
	                                            </span>
	                                        </p>
	                                        <table className="recommendations-table top-states-table">
	                                            <thead>
	                                                <tr>
	                                                    <th>Rank</th>
	                                                    <th>Q / W / E</th>
	                                                    <th>Damage at expected armor</th>
	                                                </tr>
	                                            </thead>
	                                            <tbody>
	                                                {topStateRows.map((entry, index) => {
	                                                    if (!entry) {
	                                                        return (
	                                                            <tr
	                                                                key={`top-state-empty-${index + 1}`}
	                                                                className="top-states-empty-row"
	                                                            >
	                                                                <td>#{index + 1}</td>
	                                                                <td>-- / -- / --</td>
	                                                                <td>--</td>
	                                                            </tr>
	                                                        );
	                                                    }
	                                                    const isPlanState =
	                                                        !!selectedDecision &&
	                                                        areStatesEqual(
	                                                            entry.state,
	                                                            selectedDecision.stateAfter
	                                                        );
	                                                    const isGlobalState =
	                                                        !!globalStateAtSelectedLevel &&
	                                                        areStatesEqual(
	                                                            entry.state,
	                                                            globalStateAtSelectedLevel
	                                                        );
	                                                    return (
	                                                        <tr
	                                                            key={`${entry.rank}-${entry.state.q}-${entry.state.w}-${entry.state.e}`}
	                                                            className={[
	                                                                isPlanState
	                                                                    ? "plan-state-row"
	                                                                    : "",
	                                                                isGlobalState
	                                                                    ? "global-state-row"
	                                                                    : "",
	                                                            ]
	                                                                .filter(Boolean)
	                                                                .join(" ")}
	                                                        >
	                                                            <td>#{entry.rank}</td>
	                                                            <td>
	                                                                {formatRankState(
	                                                                    entry.state.q,
	                                                                    entry.state.w,
	                                                                    entry.state.e
	                                                                )}
	                                                            </td>
	                                                            <td>{entry.damage.toFixed(2)}</td>
	                                                        </tr>
	                                                    );
	                                                })}
	                                            </tbody>
	                                        </table>
	                                    </div>
	                                </>
	                            )}
	                        </div>
	                    </aside>
                </div>
            </section>

            {editorContext && modalLevel !== null && modalKind !== null && (
                <div
                    className={`timeline-modal-backdrop ${
                        isTouchDevice && isModalSelectMenuOpen ? "menu-open" : ""
                    }`}
                >
                    <section
                        ref={modalRef}
                        className={`timeline-modal ${
                            isTouchDevice && isModalSelectMenuOpen ? "menu-open" : ""
                        }`}
                        role="dialog"
                        aria-modal="true"
                        aria-label={modalTitle}
                        tabIndex={-1}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="timeline-modal-head">
                            <h4>{modalTitle}</h4>
                            <button
                                ref={closeButtonRef}
                                type="button"
                                className="timeline-action-button"
                                onClick={() => closeTimelineEditor()}
                            >
                                Close
                            </button>
                        </div>

                        <p className="muted-note">
                            Add items with search. Click an equipped item to remove it.
                        </p>

                        <Select<SelectOption, false>
                            className="timeline-select"
                            classNamePrefix="cutoff-select"
                            inputId={`cutoff-${modalKind}-search-level-${modalLevel}`}
                            name={`cutoff_${modalKind}_search`}
                            options={rankedModalOptions}
                            value={null}
                            inputValue={modalSearchInput}
                            filterOption={() => true}
                            blurInputOnSelect={false}
                            closeMenuOnSelect={false}
                            placeholder={modalPlaceholder}
                            isDisabled={modalItems.length >= 6}
                            menuPortalTarget={modalSelectPortalTarget ?? undefined}
                            menuPosition={isTouchDevice ? "absolute" : "fixed"}
                            menuPlacement="bottom"
                            maxMenuHeight={260}
                            menuShouldBlockScroll={false}
                            menuShouldScrollIntoView={false}
                            closeMenuOnScroll={false}
                            onMenuOpen={() => setIsModalSelectMenuOpen(true)}
                            onMenuClose={() => setIsModalSelectMenuOpen(false)}
                            onInputChange={(value, { action }) => {
                                if (action === "input-change") {
                                    setModalSearchInput(value);
                                } else if (action === "set-value") {
                                    setModalSearchInput("");
                                }
                            }}
                            onChange={(selected) => {
                                if (!selected) return;
                                addModalItem(selected.value);
                                setModalSearchInput("");
                            }}
                        />

                        <div className="timeline-item-slots timeline-item-slots-modal">
                            {Array.from({ length: 6 }, (_, index) => {
                                const itemName = modalItems[index];
                                if (!itemName) {
                                    return (
                                        <span
                                            key={`modal-slot-empty-${index}`}
                                            className="timeline-item-slot empty"
                                            aria-hidden="true"
                                        />
                                    );
                                }
                                const option = modalOptionByName.get(itemName);
                                return (
                                    <button
                                        key={`modal-slot-${itemName}-${index}`}
                                        type="button"
                                        className="timeline-item-slot"
                                        onClick={() => removeModalItemAt(index)}
                                        title={`Remove ${itemName}`}
                                        aria-label={`Remove ${itemName}`}
                                    >
                                        {option?.iconPath ? (
                                            <span
                                                className="timeline-slot-image"
                                                role="img"
                                                aria-label={itemName}
                                            >
                                                <span
                                                    className="timeline-slot-image-inner"
                                                    aria-hidden="true"
                                                    style={{
                                                        backgroundImage: `url("${option.iconPath}")`,
                                                    }}
                                                />
                                            </span>
                                        ) : (
                                            <span className="timeline-slot-fallback">
                                                {getItemInitials(itemName)}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="timeline-modal-actions">
                            <button
                                type="button"
                                className="timeline-action-button danger"
                                onClick={() => deleteChangePoint(modalKind, modalLevel)}
                                disabled={!modalHasChangePoint}
                            >
                                Delete change point
                            </button>
                            <button
                                type="button"
                                className="timeline-action-button"
                                onClick={() => closeTimelineEditor()}
                            >
                                Done
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
