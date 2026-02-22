"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Select, { type FilterOptionOption } from "react-select";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { ALL_ITEMS } from "../data/Items";
import { APHELIOS_PASSIVE } from "../data/champions";
import { CURATED_ARMOR_ITEMS, ENEMY_ARMOR_PROFILES } from "../data/enemyArmor";
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
    estimateDamageAtLevelForState,
    findFirstEPreferenceLevel,
    getMaxPassiveRankForLevel,
    getReachableStatesAtLevel,
    rankStatesByDamage,
    resolveEnemyArmorByLevel,
    resolveTimeline,
    updateTimelineForLevel,
} from "../utils/apheliosCutoff";
import {
    getItemIdForName,
    ITEM_DATA_VERSION,
    normalizePersistedItemName,
} from "../utils/itemRegistry";
import "../styles/ApheliosCutoffPage.css";

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
}

type TimelineKind = "own" | "enemy";

interface TimelineEditorContext {
    kind: TimelineKind;
    level: number;
}

interface HelpHintProps {
    label: string;
    description: string;
}

type PassiveChoice = "Q" | "W" | "E";

interface PolicyComparisonRow {
    level: number;
    greedyPick: PassiveChoice;
    averageBestPick: PassiveChoice;
    flatDamageDiff: number;
    percentDamageDiff: number | null;
}

const CUTOFF_STORAGE_KEY = "aphelios_cutoff_state";
const CALCULATOR_STORAGE_KEY = "calculatorState";
const DEFAULT_ENEMY_PROFILE = ENEMY_ARMOR_PROFILES[0]?.id ?? "adc";
const DEFAULT_ARMOR_MIN = 0;
const DEFAULT_ARMOR_MAX = 100;
const DEFAULT_GLOBAL_OPTIMIZER: GlobalOptimizerId = "oracle_norm";

const OWN_ITEM_BY_NAME = new Map(ALL_ITEMS.map((item) => [item.name, item]));

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

function normalizeSearchToken(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildSearchTerms(...parts: string[]): string[] {
    const tokens = new Set<string>();
    parts.forEach((part) => {
        const raw = part.trim().toLowerCase();
        if (!raw) return;
        tokens.add(raw);
        raw.split(/\s+/).forEach((piece) => {
            if (piece) tokens.add(piece);
        });
        const normalized = normalizeSearchToken(raw);
        if (normalized) tokens.add(normalized);
    });
    return [...tokens];
}

function filterSelectOption(
    option: FilterOptionOption<SelectOption>,
    rawInput: string
): boolean {
    const query = rawInput.trim().toLowerCase();
    if (!query) return true;
    const normalizedQuery = normalizeSearchToken(query);
    return option.data.searchTerms.some(
        (term) =>
            term.includes(query) ||
            (normalizedQuery.length > 0 && term.includes(normalizedQuery))
    );
}

function HelpHint({ label, description }: HelpHintProps): React.ReactNode {
    const tooltip = `${label}: ${description}`;
    return (
        <span className="help-hint" title={tooltip} aria-label={tooltip}>
            ?
        </span>
    );
}

const ITEM_OPTIONS: SelectOption[] = ALL_ITEMS.map((item) => ({
    value: item.name,
    label: `${item.name} (${item.cost}g)`,
    iconPath: item.imagePath,
    searchTerms: buildSearchTerms(item.name, ...(item.aliases ?? [])),
}));

const ARMOR_ITEM_OPTIONS: SelectOption[] = CURATED_ARMOR_ITEMS.map((item) => ({
    value: item.name,
    label: `${item.name} (+${item.armor} armor)`,
    iconPath: OWN_ITEM_BY_NAME.get(item.name)?.imagePath,
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

function sanitizeStoredLevel(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? clampLevel(parsed) : null;
}

function sanitizeStoredNumber(value: unknown, fallback: number): number {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function buildSeedFromCalculatorState(): Partial<SeedCutoffState> {
    const raw = localStorage.getItem(CALCULATOR_STORAGE_KEY);
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw);
        const level = clampLevel(Number(parsed.level || 1));
        const armorRange = Array.isArray(parsed.armorRange)
            ? parsed.armorRange
            : [DEFAULT_ARMOR_MIN, DEFAULT_ARMOR_MAX];

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
            armorMin: sanitizeStoredNumber(armorRange[0], DEFAULT_ARMOR_MIN),
            armorMax: sanitizeStoredNumber(armorRange[1], DEFAULT_ARMOR_MAX),
            extraBonusAD: sanitizeStoredNumber(firstBuild?.bonusAD, 0),
            extraBonusLethality: sanitizeStoredNumber(firstBuild?.bonusLethality, 0),
        };
    } catch (error) {
        console.error("Failed to parse calculator state for cutoff seeding:", error);
        return {};
    }
}

export default function ApheliosCutoffAnalysis() {
    const TOP_STATES_LIMIT = 10;

    const [isLoaded, setIsLoaded] = useState(false);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const modalRef = useRef<HTMLElement | null>(null);
    const lastFocusedElementRef = useRef<HTMLElement | null>(null);

    const [forcedWLevels, setForcedWLevels] = useState<number[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
    const [enemyProfileId, setEnemyProfileId] = useState(DEFAULT_ENEMY_PROFILE);
    const [ownEvents, setOwnEvents] = useState<TimelineEvent[]>([]);
    const [enemyEvents, setEnemyEvents] = useState<TimelineEvent[]>([]);
    const [editorContext, setEditorContext] = useState<TimelineEditorContext | null>(null);
    const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
    const [modalSelectPortalTarget, setModalSelectPortalTarget] =
        useState<HTMLElement | null>(null);
    const [armorMin, setArmorMin] = useState(DEFAULT_ARMOR_MIN);
    const [armorMax, setArmorMax] = useState(DEFAULT_ARMOR_MAX);
    const [extraBonusAD, setExtraBonusAD] = useState(0);
    const [extraBonusLethality, setExtraBonusLethality] = useState(0);
    const [globalOptimizerId, setGlobalOptimizerId] = useState<GlobalOptimizerId>(
        DEFAULT_GLOBAL_OPTIMIZER
    );

    const safeArmorMin = Number.isFinite(armorMin) ? armorMin : DEFAULT_ARMOR_MIN;
    const safeArmorMax = Number.isFinite(armorMax) ? armorMax : DEFAULT_ARMOR_MAX;
    const safeExtraBonusAD = Number.isFinite(extraBonusAD) ? extraBonusAD : 0;
    const safeExtraBonusLethality = Number.isFinite(extraBonusLethality)
        ? extraBonusLethality
        : 0;

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

    useEffect(() => {
        setModalSelectPortalTarget(document.body);
    }, []);

    useEffect(() => {
        const savedState = localStorage.getItem(CUTOFF_STORAGE_KEY);
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState) as Partial<StoredCutoffState>;
                const hasForcedWField = Array.isArray(parsed.forcedWLevels);
                const normalizedForcedW = hasForcedWField
                    ? sanitizeForcedWLevels(parsed.forcedWLevels)
                    : parsed.startChoice === "w"
                      ? [1]
                      : [];
                setForcedWLevels(normalizedForcedW);
                setSelectedLevel(sanitizeStoredLevel(parsed.selectedLevel));
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
                setExtraBonusLethality(sanitizeStoredNumber(parsed.extraBonusLethality, 0));
                setGlobalOptimizerId(
                    sanitizeGlobalOptimizerId(parsed.globalOptimizerId)
                );
                setIsLoaded(true);
                return;
            } catch (error) {
                console.error("Failed to parse cutoff state:", error);
            }
        }

        const seed = buildSeedFromCalculatorState();
        setForcedWLevels([]);
        setSelectedLevel(sanitizeStoredLevel(seed.selectedLevel));
        setOwnEvents(seed.ownEvents ?? []);
        setArmorMin(sanitizeStoredNumber(seed.armorMin, DEFAULT_ARMOR_MIN));
        setArmorMax(sanitizeStoredNumber(seed.armorMax, DEFAULT_ARMOR_MAX));
        setExtraBonusAD(sanitizeStoredNumber(seed.extraBonusAD, 0));
        setExtraBonusLethality(sanitizeStoredNumber(seed.extraBonusLethality, 0));
        setGlobalOptimizerId(DEFAULT_GLOBAL_OPTIMIZER);
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isDrilldownOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsDrilldownOpen(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isDrilldownOpen]);

    useEffect(() => {
        if (!isDrilldownOpen) return;

        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            const computedPaddingRight =
                Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
            document.body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
        }
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.paddingRight = previousBodyPaddingRight;
        };
    }, [isDrilldownOpen]);

    useEffect(() => {
        if (!isLoaded) return;
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
            globalOptimizerId,
            itemDataVersion: ITEM_DATA_VERSION,
        };
        localStorage.setItem(CUTOFF_STORAGE_KEY, JSON.stringify(payload));
    }, [
        isLoaded,
        forcedWLevels,
        selectedLevel,
        enemyProfileId,
        ownEvents,
        enemyEvents,
        safeArmorMin,
        safeArmorMax,
        safeExtraBonusAD,
        safeExtraBonusLethality,
        globalOptimizerId,
    ]);

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
            extraBonusLethality: safeExtraBonusLethality,
        }),
        [
            forcedWLevels,
            ownItemsByLevel,
            enemyArmorByLevel,
            safeExtraBonusAD,
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

    const firstELevel = useMemo(
        () => findFirstEPreferenceLevel(recommendations),
        [recommendations]
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

    const greedyDamageByLevel = useMemo(
        () =>
            recommendations.map((entry) =>
                estimateDamageAtLevelForState(
                    entry.level,
                    ownItemsByLevel[entry.level - 1] ?? [],
                    enemyArmorByLevel[entry.level - 1] ?? 0,
                    entry.stateAfter,
                    safeExtraBonusAD,
                    safeExtraBonusLethality
                )
            ),
        [
            recommendations,
            ownItemsByLevel,
            enemyArmorByLevel,
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
    const globalDiffLevelSet = useMemo(() => new Set(globalDiffLevels), [globalDiffLevels]);

    const policyComparisonRows = useMemo<PolicyComparisonRow[]>(
        () =>
            recommendations.map((entry, index) => {
                const greedyDamage = greedyDamageByLevel[index] ?? 0;
                const averageBestDamage =
                    globalOptimalPath.damageByLevel[index] ?? greedyDamage;
                const flatDamageDiff = averageBestDamage - greedyDamage;
                const percentDamageDiff =
                    Math.abs(greedyDamage) > 1e-9
                        ? (flatDamageDiff / greedyDamage) * 100
                        : null;

                return {
                    level: entry.level,
                    greedyPick: entry.choice as PassiveChoice,
                    averageBestPick:
                        ((globalOptimalPath.choicesByLevel[index] as PassiveChoice | null) ??
                            entry.choice) as PassiveChoice,
                    flatDamageDiff,
                    percentDamageDiff,
                };
            }),
        [recommendations, greedyDamageByLevel, globalOptimalPath]
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

    const drilldownPoints = useMemo(() => {
        if (!selectedDecision || !selectedLevel) return [];
        return buildDrilldownPoints(
            selectedLevel,
            selectedDecision.stateBefore,
            ownItemsByLevel[selectedLevel - 1] ?? [],
            Math.floor(Math.min(safeArmorMin, safeArmorMax)),
            Math.ceil(Math.max(safeArmorMin, safeArmorMax)),
            safeExtraBonusAD,
            safeExtraBonusLethality
        );
    }, [
        selectedDecision,
        selectedLevel,
        ownItemsByLevel,
        safeArmorMin,
        safeArmorMax,
        safeExtraBonusAD,
        safeExtraBonusLethality,
    ]);

    const crossoverArmors = useMemo(() => {
        const crossings: number[] = [];
        for (let i = 1; i < drilldownPoints.length; i++) {
            const prev = drilldownPoints[i - 1].deltaQMinusE;
            const curr = drilldownPoints[i].deltaQMinusE;
            if (prev === null || curr === null) continue;
            if (curr === 0) {
                crossings.push(drilldownPoints[i].armor);
                continue;
            }
            if ((prev < 0 && curr > 0) || (prev > 0 && curr < 0)) {
                crossings.push(drilldownPoints[i].armor);
            }
        }
        return crossings;
    }, [drilldownPoints]);

    const rankedSelectedLevelStates = useMemo(() => {
        if (!selectedLevel) return [];
        const states = getReachableStatesAtLevel(selectedLevel, forcedWLevels);
        return rankStatesByDamage(
            selectedLevel,
            states,
            ownItemsByLevel[selectedLevel - 1] ?? [],
            enemyArmorByLevel[selectedLevel - 1] ?? 0,
            safeExtraBonusAD,
            safeExtraBonusLethality,
            states.length
        );
    }, [
        selectedLevel,
        forcedWLevels,
        ownItemsByLevel,
        enemyArmorByLevel,
        safeExtraBonusAD,
        safeExtraBonusLethality,
    ]);

    const topStates = useMemo(
        () => rankedSelectedLevelStates.slice(0, TOP_STATES_LIMIT),
        [rankedSelectedLevelStates]
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

    const isSameGreedyAndBestAverageState =
        !!selectedDecision &&
        !!globalStateAtSelectedLevel &&
        areStatesEqual(selectedDecision.stateAfter, globalStateAtSelectedLevel);

    const topStatesWithHighlights = useMemo(() => {
        const merged = [...topStates];
        const maybeAppend = (
            candidate: (typeof rankedSelectedLevelStates)[number] | null
        ) => {
            if (!candidate) return;
            const alreadyIncluded = merged.some((entry) =>
                areStatesEqual(entry.state, candidate.state)
            );
            if (!alreadyIncluded) {
                merged.push(candidate);
            }
        };

        maybeAppend(planStateRank);
        maybeAppend(globalStateRank);
        return merged.sort((a, b) => a.rank - b.rank);
    }, [topStates, planStateRank, globalStateRank]);

    const drilldownChartData = useMemo(
        () => ({
            labels: drilldownPoints.map((point) => point.armor),
            datasets: [
                {
                    label: "+Q damage",
                    data: drilldownPoints.map((point) => point.qDamage),
                    borderColor: "#2E8B57",
                    backgroundColor: "rgba(46, 139, 87, 0.2)",
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 40,
                    pointHoverRadius: 5,
                    tension: 0.2,
                },
                {
                    label: "+E damage",
                    data: drilldownPoints.map((point) => point.eDamage),
                    borderColor: "#1E88E5",
                    backgroundColor: "rgba(30, 136, 229, 0.2)",
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHitRadius: 40,
                    pointHoverRadius: 5,
                    tension: 0.2,
                },
                {
                    label: "Q - E delta",
                    data: drilldownPoints.map((point) => point.deltaQMinusE),
                    borderColor: "#8E24AA",
                    backgroundColor: "rgba(142, 36, 170, 0.2)",
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHitRadius: 40,
                    pointHoverRadius: 5,
                    tension: 0.2,
                    yAxisID: "deltaAxis",
                },
                {
                    label: "Q = E",
                    data: drilldownPoints.map(() => 0),
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
        [drilldownPoints]
    );

    const drilldownChartOptions = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index" as const,
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: "#5f5f5f",
                    },
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
                    display: true,
                    text: "Selected Level: +Q vs +E across armor",
                    color: "#242424",
                    font: {
                        size: 14,
                    },
                },
            },
            scales: {
                x: {
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
                        text: "Q - E",
                        color: "#666666",
                    },
                    ticks: {
                        color: "#666666",
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
            },
        }),
        []
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

    const areItemListsEqual = (left: string[], right: string[]): boolean =>
        left.length === right.length && left.every((item, index) => item === right[index]);

    const levelBuildChanged = (timelineByLevel: string[][], levelIndex: number): boolean => {
        const current = timelineByLevel[levelIndex] ?? [];
        const previous = levelIndex === 0 ? [] : timelineByLevel[levelIndex - 1] ?? [];
        return !areItemListsEqual(current, previous);
    };

    const CHOICE_ORDER: PassiveChoice[] = ["Q", "W", "E"];

    const getChoiceColorClass = (choice: PassiveChoice): string => {
        if (choice === "Q") return "choice-q";
        if (choice === "E") return "choice-e";
        return "choice-w";
    };

    const renderPolicyPickRail = (
        title: string,
        side: "left" | "right",
        pickKey: "greedyPick" | "averageBestPick"
    ): React.ReactNode => (
        <div className={`policy-pick-rail policy-pick-rail-${side}`}>
            <div className="policy-pick-rail-caption">{title}</div>
            <div className="policy-pick-rail-head">
                <span className="policy-pick-rail-level-head">Lv</span>
                <span className="policy-pick-rail-choice-head">Q</span>
                <span className="policy-pick-rail-choice-head">W</span>
                <span className="policy-pick-rail-choice-head">E</span>
            </div>
            <div className="policy-pick-rail-rows">
                {policyComparisonRows.map((entry) => {
                    const selected = isDrilldownOpen && selectedLevel === entry.level;
                    const pick = entry[pickKey];
                    return (
                        <div
                            key={`${side}-rail-${entry.level}`}
                            role="button"
                            aria-label={`Open level ${entry.level} details`}
                            tabIndex={0}
                            className={`policy-pick-rail-row ${selected ? "selected-row" : ""} ${
                                globalDiffLevelSet.has(entry.level) ? "diff-level" : ""
                            }`}
                            onClick={() => openDrilldownForLevel(entry.level)}
                            onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                openDrilldownForLevel(entry.level);
                            }}
                        >
                            <span className="policy-pick-rail-level">{entry.level}</span>
                            {CHOICE_ORDER.map((choice) => {
                                const isActive = pick === choice;
                                return (
                                    <span
                                        key={`${side}-${entry.level}-${choice}`}
                                        className={`policy-pick-rail-choice ${
                                            isActive
                                                ? `active ${getChoiceColorClass(choice)}`
                                                : ""
                                        }`}
                                    >
                                        {isActive ? choice : ""}
                                    </span>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderTimelinePreviewItems = (
        items: string[],
        optionByName: Map<string, SelectOption>,
        emptyLabel: string
    ): React.ReactNode => {
        const filled = items.slice(0, 6);
        return (
            <div className="timeline-preview-items">
                {filled.length > 0 ? (
                    <div className="timeline-icon-list">
                        {filled.map((itemName, index) => {
                            const iconPath = optionByName.get(itemName)?.iconPath;
                            if (iconPath) {
                                return (
                                    <Image
                                        key={`${itemName}-${index}`}
                                        src={iconPath}
                                        alt={itemName}
                                        title={itemName}
                                        className="timeline-item-icon"
                                        width={20}
                                        height={20}
                                    />
                                );
                            }
                            return (
                                <span
                                    key={`${itemName}-${index}`}
                                    className="timeline-item-icon-fallback"
                                    title={itemName}
                                    aria-label={itemName}
                                >
                                    {getItemInitials(itemName)}
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <span className="timeline-preview-empty timeline-preview-empty-cta">
                        + {emptyLabel}
                    </span>
                )}
            </div>
        );
    };

    const toggleForcedWLevel = (level: number) => {
        const clamped = clampLevel(level);
        setForcedWLevels((current) => {
            if (current.includes(clamped)) {
                return current.filter((entry) => entry !== clamped);
            }
            return [...current, clamped].sort((a, b) => a - b);
        });
    };

    const openDrilldownForLevel = (level: number) => {
        setSelectedLevel(clampLevel(level));
        setIsDrilldownOpen(true);
    };

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
        const clamped = clampLevel(level);
        const activeElement = document.activeElement;
        lastFocusedElementRef.current =
            activeElement instanceof HTMLElement ? activeElement : null;
        setEditorContext({ kind, level: clamped });
    };

    const closeTimelineEditor = () => {
        setEditorContext(null);
        const previouslyFocused = lastFocusedElementRef.current;
        if (previouslyFocused) {
            window.requestAnimationFrame(() => previouslyFocused.focus());
        }
    };

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

    useEffect(() => {
        if (!editorContext || !modalRef.current) return;

        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            const computedPaddingRight =
                Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
            document.body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
        }
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!modalRef.current) return;

            if (event.key === "Escape") {
                event.preventDefault();
                setEditorContext(null);
                const previouslyFocused = lastFocusedElementRef.current;
                if (previouslyFocused) {
                    window.requestAnimationFrame(() => previouslyFocused.focus());
                }
                return;
            }

            if (event.key !== "Tab") return;

            const focusableElements = Array.from(
                modalRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter(
                (node) =>
                    node.tabIndex !== -1 &&
                    node.getAttribute("aria-hidden") !== "true" &&
                    node.offsetParent !== null
            );

            if (focusableElements.length === 0) {
                event.preventDefault();
                modalRef.current.focus();
                return;
            }

            const first = focusableElements[0];
            const last = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement as HTMLElement | null;

            if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
                return;
            }

            if (event.shiftKey && activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.paddingRight = previousBodyPaddingRight;
        };
    }, [editorContext]);

    if (!isLoaded) {
        return null;
    }

    return (
        <div className="aphelios-cutoff-analysis">
            <div className="cutoff-controls-grid">
                <section className="cutoff-card cutoff-card-path-rules">
                    <h3>Path Rules</h3>
                    <div className="path-rules-layout">
                        <div className="path-rules-pane">
                            <p className="muted-note">
                                Greedy first E pick:{" "}
                                <strong>
                                    {firstELevel ? `level ${firstELevel}` : "no E breakpoint yet"}
                                </strong>
                            </p>
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
                        </div>

                        <div className="path-rules-pane">
                            <div className="forced-w-head">
                                <p className="muted-note passive-stat-line passive-stat-line-w">
                                    Force W at levels
                                    <HelpHint
                                        label="W rank"
                                        description="W is the passive Attack Speed rank. Forced levels always spend points into W when allowed."
                                    />
                                </p>
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
                                Could not force W at:{" "}
                                <strong>{unappliedForcedWLevels.join(", ")}</strong>
                            </p>
                        </div>
                    </div>
                </section>

                <section className="cutoff-card">
                    <h3>Extra Stats</h3>
                    <label className="field-label">
                        <span className="field-label-title">
                            Bonus AD
                            <HelpHint
                                label="Bonus AD"
                                description="Flat Attack Damage added on top of item and passive values."
                            />
                        </span>
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
                    <label className="field-label">
                        <span className="field-label-title">
                            Bonus Lethality
                            <HelpHint
                                label="Bonus Lethality"
                                description="Flat armor reduction value added on top of item and passive lethality."
                            />
                        </span>
                        <input
                            id="cutoff-bonus-lethality"
                            name="bonus_lethality"
                            type="number"
                            value={extraBonusLethality}
                            onChange={(e) => {
                                const parsedBonusLethality = Number(e.target.value);
                                if (Number.isFinite(parsedBonusLethality)) {
                                    setExtraBonusLethality(parsedBonusLethality);
                                }
                            }}
                        />
                    </label>
                </section>

                <section className="cutoff-card">
                    <h3>Target Armor Model</h3>
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
                    {enemyProfile.includedChampions && enemyProfile.includedChampions.length > 0 ? (
                        <details className="profile-included-details">
                            <summary>
                                Included champions ({enemyProfile.includedChampions.length})
                            </summary>
                            <p className="muted-note profile-included-list">
                                {enemyProfile.includedChampions.join(", ")}
                            </p>
                        </details>
                    ) : null}
                </section>

            </div>

            <section className="cutoff-card timeline-combined-card">
                <h3>Items Timelines</h3>
                <p className="muted-note">
                    Add only levels where your inventory changes; everything persists forward until the next change.
                </p>

                <div className="timeline-build-stack">
                    <div className="timeline-resolved-group">
                        <h4>My Build by Level</h4>
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
                                            onClick={() => {
                                                setSelectedLevel(level);
                                                openTimelineEditor("own", level);
                                            }}
                                        >
                                            <span className="timeline-level">Lv {level}</span>
                                            {renderTimelinePreviewItems(
                                                items,
                                                ITEM_OPTION_BY_NAME,
                                                "Item"
                                            )}
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
                        <p className="timeline-scroll-hint">Scroll horizontally for levels 1-18.</p>
                    </div>

                    <div className="timeline-resolved-group">
                        <h4>Target Build by Level</h4>
                        <div className="timeline-preview-rows">
                            {Array.from({ length: 18 }, (_, index) => {
                                const level = index + 1;
                                const items = enemyArmorItemsByLevel[index] ?? [];
                                const changed = levelBuildChanged(enemyArmorItemsByLevel, index);
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
                                            onClick={() => {
                                                setSelectedLevel(level);
                                                openTimelineEditor("enemy", level);
                                            }}
                                        >
                                            <span className="timeline-level">Lv {level}</span>
                                            {renderTimelinePreviewItems(
                                                items,
                                                ARMOR_ITEM_OPTION_BY_NAME,
                                                "Item"
                                            )}
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
                        <p className="timeline-scroll-hint">Scroll horizontally for levels 1-18.</p>
                    </div>
                </div>
            </section>

            <section className="cutoff-card">
                <div className="global-optimal-head">
                    <h3>Average Best vs Greedy</h3>
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
                <div className="global-stats-grid">
                    <div className="global-stat-block">
                        <h4>Average Best vs Greedy</h4>
                        <p className="muted-note">
                            Geom: <strong>{globalVsGreedyStats.geomPercent.toFixed(2)}%</strong>
                        </p>
                        <p className="muted-note">
                            Total: <strong>{globalVsGreedyStats.totalPercent.toFixed(2)}%</strong>
                        </p>
                    </div>
                    <div className="global-stat-block">
                        <h4>Per-Level Upper-Bound Efficiency</h4>
                        <p className="muted-note">
                            Geom:{" "}
                            <strong>{oracleEfficiencyStats.geomPercent.toFixed(2)}%</strong>
                        </p>
                        <p className="muted-note">
                            Mean:{" "}
                            <strong>{oracleEfficiencyStats.meanPercent.toFixed(2)}%</strong>
                        </p>
                    </div>
                    <div className="global-stat-block">
                        <h4>Path Delta</h4>
                        <p className="muted-note">
                            Differs from greedy at levels:{" "}
                            <strong>
                                {globalDiffLevels.length > 0
                                    ? globalDiffLevels.join(", ")
                                    : "none"}
                            </strong>
                        </p>
                        <p className="muted-note">
                            Objective score:{" "}
                            <strong>{globalOptimalPath.meanScore.toFixed(4)}</strong>
                        </p>
                    </div>
                </div>
            </section>

            <section className="cutoff-card cutoff-card-policy-table">
                <h3>Greedy vs Average Best by Level</h3>
                <div className="policy-comparison-layout">
                    {renderPolicyPickRail("Greedy Path Grid", "left", "greedyPick")}
                    <div className="policy-triad-wrap">
                        <div className="policy-triad">
                            <div className="policy-triad-caption">Greedy vs Average Best</div>
                            <div className="policy-triad-head">
                                <div className="policy-triad-head-left">
                                    <span className="policy-level-head">Level</span>
                                    <span className="policy-pick-head">Greedy Pick</span>
                                </div>
                                <div className="policy-triad-head-diff">
                                    <span className="policy-diff-direction policy-diff-direction-head">
                                        <span
                                            className="policy-diff-arrow left hidden"
                                            aria-hidden="true"
                                        >
                                            ◀
                                        </span>
                                        <span className="policy-diff-values">
                                            <span className="policy-diff-flat">Flat Δ</span>
                                            <span
                                                className="policy-diff-separator"
                                                aria-hidden="true"
                                            >
                                                |
                                            </span>
                                            <span className="policy-diff-percent">% Δ</span>
                                        </span>
                                        <span
                                            className="policy-diff-arrow right hidden"
                                            aria-hidden="true"
                                        >
                                            ▶
                                        </span>
                                    </span>
                                </div>
                                <div className="policy-triad-head-right">
                                    <span className="policy-pick-head">Average Best Pick</span>
                                </div>
                            </div>
                            <div className="policy-triad-rows">
                                {policyComparisonRows.map((entry) => (
                                    <div
                                        key={entry.level}
                                        role="button"
                                        aria-label={`Open level ${entry.level} details`}
                                        tabIndex={0}
                                        className={`policy-triad-row ${
                                            isDrilldownOpen && selectedLevel === entry.level
                                                ? "selected-row"
                                                : ""
                                        }`}
                                        onClick={() => openDrilldownForLevel(entry.level)}
                                        onKeyDown={(event) => {
                                            if (event.key !== "Enter" && event.key !== " ") return;
                                            event.preventDefault();
                                            openDrilldownForLevel(entry.level);
                                        }}
                                    >
                                        <div className="policy-triad-cell policy-triad-cell-left">
                                            <span className="policy-level-cell">{entry.level}</span>
                                            <span
                                                className={`choice-cell policy-pick-cell ${getChoiceColorClass(
                                                    entry.greedyPick
                                                )}`}
                                            >
                                                {entry.greedyPick}
                                            </span>
                                        </div>
                                        <div
                                            className={`policy-triad-cell policy-triad-cell-diff policy-diff-cell ${
                                                entry.flatDamageDiff < 0
                                                    ? "winner-greedy"
                                                    : entry.flatDamageDiff > 0
                                                      ? "winner-average-best"
                                                      : "winner-tie"
                                            }`}
                                        >
                                            <span className="policy-diff-direction">
                                                <span
                                                    className={`policy-diff-arrow left ${
                                                        entry.flatDamageDiff < 0
                                                            ? "active"
                                                            : "hidden"
                                                    }`}
                                                    aria-hidden="true"
                                                >
                                                    ◀
                                                </span>
                                                <span className="policy-diff-values">
                                                    <span className="policy-diff-flat">
                                                        {Math.abs(entry.flatDamageDiff).toFixed(2)}
                                                    </span>
                                                    <span
                                                        className="policy-diff-separator"
                                                        aria-hidden="true"
                                                    >
                                                        |
                                                    </span>
                                                    <span className="policy-diff-percent">
                                                        {entry.percentDamageDiff === null
                                                            ? "—"
                                                            : `${Math.abs(entry.percentDamageDiff).toFixed(2)}%`}
                                                    </span>
                                                </span>
                                                <span
                                                    className={`policy-diff-arrow right ${
                                                        entry.flatDamageDiff > 0
                                                            ? "active"
                                                            : "hidden"
                                                    }`}
                                                    aria-hidden="true"
                                                >
                                                    ▶
                                                </span>
                                            </span>
                                        </div>
                                        <div className="policy-triad-cell policy-triad-cell-right">
                                            <span
                                                className={`choice-cell policy-pick-cell ${getChoiceColorClass(
                                                    entry.averageBestPick
                                                )}`}
                                            >
                                                {entry.averageBestPick}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {renderPolicyPickRail("Average Best Path Grid", "right", "averageBestPick")}
                </div>
                <p className="table-scroll-hint">Scroll horizontally to see all columns.</p>
            </section>

            {isDrilldownOpen && selectedDecision && selectedLevel && (
                <div
                    className="timeline-modal-backdrop"
                    onClick={() => setIsDrilldownOpen(false)}
                >
                    <section
                        className="timeline-modal drilldown-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Level ${selectedLevel} details`}
                        tabIndex={-1}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="timeline-modal-head">
                            <h4>Level {selectedLevel} Details</h4>
                            <button
                                type="button"
                                className="timeline-action-button"
                                onClick={() => setIsDrilldownOpen(false)}
                            >
                                Close
                            </button>
                        </div>

                        <div className="armor-range-row">
                            <label className="field-label">
                                Armor min
                                <input
                                    id="cutoff-armor-min"
                                    name="armor_min"
                                    type="number"
                                    value={armorMin}
                                    onChange={(e) => {
                                        const parsedArmorMin = Number(e.target.value);
                                        if (Number.isFinite(parsedArmorMin)) {
                                            setArmorMin(parsedArmorMin);
                                        }
                                    }}
                                />
                            </label>
                            <label className="field-label">
                                Armor max
                                <input
                                    id="cutoff-armor-max"
                                    name="armor_max"
                                    type="number"
                                    value={armorMax}
                                    onChange={(e) => {
                                        const parsedArmorMax = Number(e.target.value);
                                        if (Number.isFinite(parsedArmorMax)) {
                                            setArmorMax(parsedArmorMax);
                                        }
                                    }}
                                />
                            </label>
                        </div>

                        <p className="muted-note">
                            Expected armor at this level:{" "}
                            <strong>{(enemyArmorByLevel[selectedLevel - 1] ?? 0).toFixed(1)}</strong>.
                            Recommended pick at expected armor:{" "}
                            <strong>{selectedDecision.choice}</strong>.
                        </p>
                        <p className="muted-note">
                            Crossover armor values:{" "}
                            <strong>
                                {crossoverArmors.length > 0 ? crossoverArmors.join(", ") : "none"}
                            </strong>
                        </p>

                        <div className="drilldown-chart-wrap">
                            <Line data={drilldownChartData} options={drilldownChartOptions} />
                        </div>

                        <div className="top-states-wrap">
                            <h4>Average Best Rank States at Level {selectedLevel}</h4>
                            <p className="muted-note">
                                <span
                                    className={
                                        isSameGreedyAndBestAverageState
                                            ? "state-label-both"
                                            : "state-label-greedy"
                                    }
                                >
                                    Greedy
                                </span>{" "}
                                state{" "}
                                {formatRankState(
                                    selectedDecision.stateAfter.q,
                                    selectedDecision.stateAfter.w,
                                    selectedDecision.stateAfter.e
                                )}{" "}
                                {planStateRank
                                    ? (
                                          <>
                                              ranks <strong>#{planStateRank.rank}</strong> at
                                              expected armor.
                                          </>
                                      )
                                    : "is outside the ranked candidate set at expected armor."}{" "}
                                {globalStateAtSelectedLevel && (
                                    <>
                                        {" "}
                                        <span
                                            className={
                                                isSameGreedyAndBestAverageState
                                                    ? "state-label-both"
                                                    : "state-label-best-average"
                                            }
                                        >
                                            Average Best
                                        </span>{" "}
                                        state{" "}
                                        {formatRankState(
                                            globalStateAtSelectedLevel.q,
                                            globalStateAtSelectedLevel.w,
                                            globalStateAtSelectedLevel.e
                                        )}{" "}
                                        {globalStateRank
                                            ? (
                                                  <>
                                                      ranks{" "}
                                                      <strong>#{globalStateRank.rank}</strong>.
                                                  </>
                                              )
                                            : "is outside the ranked candidate set."}
                                    </>
                                )}
                                {isSameGreedyAndBestAverageState && (
                                    <>
                                        {" "}
                                        <span className="state-label-both">
                                            Blue + red = purple (same state).
                                        </span>
                                    </>
                                )}
                            </p>
                            <table className="recommendations-table top-states-table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Q / W / E</th>
                                        <th>Damage at expected armor</th>
                                        <th>Highlight</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topStatesWithHighlights.map((entry) => {
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
                                        const rowHighlightLabel =
                                            isPlanState && isGlobalState
                                                ? "Greedy + Average Best"
                                                : isPlanState
                                                  ? "Greedy"
                                                  : isGlobalState
                                                    ? "Average Best"
                                                    : "—";
                                        return (
                                            <tr
                                                key={`${entry.rank}-${entry.state.q}-${entry.state.w}-${entry.state.e}`}
                                                className={[
                                                    isPlanState ? "plan-state-row" : "",
                                                    isGlobalState ? "global-state-row" : "",
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
                                                <td>
                                                    <span
                                                        className={[
                                                            "state-highlight-pill",
                                                            isPlanState && isGlobalState
                                                                ? "both"
                                                                : isPlanState
                                                                  ? "greedy"
                                                                  : isGlobalState
                                                                    ? "best-average"
                                                                    : "none",
                                                        ].join(" ")}
                                                    >
                                                        {rowHighlightLabel}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}

            {editorContext && modalLevel !== null && modalKind !== null && (
                <div
                    className="timeline-modal-backdrop"
                    onClick={closeTimelineEditor}
                >
                    <section
                        ref={modalRef}
                        className="timeline-modal"
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
                                onClick={closeTimelineEditor}
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
                            options={modalOptions}
                            value={null}
                            blurInputOnSelect={false}
                            closeMenuOnSelect={false}
                            placeholder={modalPlaceholder}
                            filterOption={filterSelectOption}
                            isDisabled={modalItems.length >= 6}
                            menuPortalTarget={modalSelectPortalTarget ?? undefined}
                            menuPosition="fixed"
                            onChange={(selected) => {
                                if (!selected) return;
                                addModalItem(selected.value);
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
                                            <Image
                                                src={option.iconPath}
                                                alt={itemName}
                                                width={40}
                                                height={40}
                                                className="timeline-slot-image"
                                            />
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
                                onClick={closeTimelineEditor}
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
