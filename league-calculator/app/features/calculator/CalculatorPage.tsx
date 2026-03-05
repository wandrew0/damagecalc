"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import "../../styles/CalculatorPage.css";
import { Tooltip } from "react-tooltip";

import { Build } from "../../classes/Build";
import { Item } from "../../classes/Item";

import BuildPanel from "./components/BuildPanel";
import DamageChart from "./components/DamageChart";
import AppHeader from "../../components/AppHeader";
import { decodeBuilds, decodeBuildsLegacy } from "../../utils/encoder";
import { ITEM_DATA_VERSION } from "../../utils/itemRegistry";
import { parseNumberInput, sanitizeAdShardCount } from "../../utils/numberUtils";
import useTouchDevice from "../../hooks/useTouchDevice";
import usePersistenceLifecycle from "../../hooks/usePersistenceLifecycle";
import {
    getAbsoluteFocusAD,
    getGatheringStormAD,
    getAdShardBonus,
} from "../../classes/Calculator";
import {
    ChampionId,
    CHAMPIONS,
    createChampion,
    getQRankFromChampLevel,
} from "../../data/champions";

function serializeBuilds(builds: Build[]) {
    return builds.map((b) => b.toJSON());
}

function deserializeBuilds(raw: unknown): Build[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    return raw
        .map((entry) => {
            if (!entry || typeof entry !== "object") {
                return null;
            }
            try {
                return Build.fromJSON(entry as Parameters<typeof Build.fromJSON>[0]);
            } catch {
                return null;
            }
        })
        .filter((build): build is Build => build !== null);
}

function parseFiniteNumber(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }
    return value;
}

function parseArmorRange(value: unknown): [number, number] | null {
    if (!Array.isArray(value) || value.length !== 2) {
        return null;
    }
    const start = parseFiniteNumber(value[0]);
    const end = parseFiniteNumber(value[1]);
    if (start === null || end === null) {
        return null;
    }
    return [start, end];
}

function clampHexopticsDistance(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(500, Math.round(value)));
}

function CalculatorPage() {
    const targetHpTooltipText =
        "Items that give HP (but not only HP) typically give 300-400 HP each. Giant Slayer deals up to 15% bonus physical damage based on target's bonus HP (max at 1500).";
    const targetHpTooltipId = "target-hp-tooltip";
    const isTouchDevice = useTouchDevice();

    // Global state
    const [level, setLevel] = useState(1);
    const [builds, setBuilds] = useState<Build[]>([]);
    const [championId, setChampionId] = useState<ChampionId>("aphelios");
    const [champion, setChampion] = useState(() => createChampion("aphelios"));
    const [armorRange, setArmorRange] = useState<[number, number]>([0, 200]);
    const [showMargin, setShowMargin] = useState(false);
    const [stdDevMultiplier, setStdDevMultiplier] = useState(1);
    const [percentileRange, setPercentileRange] = useState(34); // ±34% for 1 std dev
    const [numAutoAttacks, setNumAutoAttacks] = useState(5); // Realistic for typical engagement
    const [absoluteFocus, setAbsoluteFocus] = useState(false);
    const [gatheringStormMinutes, setGatheringStormMinutes] = useState(0);
    const [adShardCount, setAdShardCount] = useState(0);
    const [targetBonusHP, setTargetBonusHP] = useState(0); // For LDR Giant Slayer calculation
    const [targetBonusHPRangeMode, setTargetBonusHPRangeMode] = useState(false); // Toggle for range mode
    const [targetBonusHPMax, setTargetBonusHPMax] = useState(1500); // Max value for range mode
    const [hexopticsDistance, setHexopticsDistance] = useState(0);
    // Draven Spinning Axe settings
    const [dravenQEnabled, setDravenQEnabled] = useState(true); // Default on for Draven
    const [dravenQLevel, setDravenQLevel] = useState(() => getQRankFromChampLevel(1)); // Linked to champion level by default
    const [dravenQLevelLinked, setDravenQLevelLinked] = useState(true); // Whether Q level auto-updates with champion level
    const [championPanelCompact, setChampionPanelCompact] = useState(false);
    const [urlImportBuilds, setUrlImportBuilds] = useState<Build[] | null>(null);
    const [urlImportChampionLevel, setUrlImportChampionLevel] = useState<number | null>(
        null
    );
    const [urlImportAbsoluteFocus, setUrlImportAbsoluteFocus] = useState<boolean | null>(
        null
    );
    const [urlImportGatheringStormMinutes, setUrlImportGatheringStormMinutes] = useState<
        number | null
    >(null);
    const [urlImportAdShardCount, setUrlImportAdShardCount] = useState<number | null>(
        null
    );
    const [urlImportChampionId, setUrlImportChampionId] = useState<ChampionId | null>(
        null
    );
    const [urlImportDravenQEnabled, setUrlImportDravenQEnabled] = useState<
        boolean | null
    >(null);
    const [urlImportDravenQLevel, setUrlImportDravenQLevel] = useState<
        number | null
    >(null);
    const [urlImportDravenQLevelLinked, setUrlImportDravenQLevelLinked] = useState<
        boolean | null
    >(null);
    const [disableChartAnimation, setDisableChartAnimation] = useState(false);
    const autoImportedRef = useRef(false);
    const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const previousBuildsRef = useRef<Build[]>([]);
    const step = 1;
    const effectiveDravenQLevel = dravenQLevelLinked
        ? getQRankFromChampLevel(level)
        : dravenQLevel;
    const isGatheringStormActive = gatheringStormMinutes >= 10;
    const hasLDRBuild = builds.some((build) =>
        build.items.some((item) => item.name === "Lord Dominik's Regards")
    );
    const hasHexopticsBuild = builds.some((build) =>
        build.items.some((item) => item.name === "Hexoptics C44")
    );
    // Helper function to compare items by content, not order
    const compareItems = (items1: Item[], items2: Item[]): boolean => {
        if (items1.length !== items2.length) return false;

        // Create sorted copies for comparison to handle reordering
        const sorted1 = [...items1].sort((a, b) => a.name.localeCompare(b.name));
        const sorted2 = [...items2].sort((a, b) => a.name.localeCompare(b.name));

        return sorted1.every((item1, index) => {
            const item2 = sorted2[index];
            return (
                item1.name === item2.name &&
                item1.cost === item2.cost &&
                item1.AD === item2.AD &&
                item1.critChance === item2.critChance &&
                item1.infinityEdgeBonus === item2.infinityEdgeBonus &&
                item1.lethality === item2.lethality &&
                item1.armorPenetration === item2.armorPenetration &&
                JSON.stringify(item1.aliases) === JSON.stringify(item2.aliases) &&
                item1.imagePath === item2.imagePath
            );
        });
    };

    // Helper function to compare builds (excluding names)
    const compareBuildsExcludingNames = (build1: Build, build2: Build): boolean => {
        return (
            build1.items.length === build2.items.length &&
            compareItems(build1.items, build2.items) &&
            build1.critChance === build2.critChance &&
            build1.critDamageModifier === build2.critDamageModifier &&
            build1.AD === build2.AD &&
            build1.armorPenetration === build2.armorPenetration &&
            build1.lethality === build2.lethality &&
            build1.totalCost === build2.totalCost &&
            build1.bonusAD === build2.bonusAD &&
            build1.bonusLethality === build2.bonusLethality &&
            build1.bonusCrit === build2.bonusCrit
        );
    };

    // Custom setBuilds function that detects name-only changes
    const setBuildsWithAnimationControl = (newBuilds: React.SetStateAction<Build[]>) => {
        const resolvedBuilds =
            typeof newBuilds === "function"
                ? newBuilds(previousBuildsRef.current)
                : newBuilds;

        // Check if only names changed by comparing all properties except names
        const onlyNamesChanged =
            previousBuildsRef.current.length === resolvedBuilds.length &&
            previousBuildsRef.current.every((oldBuild, index) => {
                const newBuild = resolvedBuilds[index];
                if (!newBuild) return false;

                // Compare all properties except name
                return compareBuildsExcludingNames(oldBuild, newBuild);
            });

        if (onlyNamesChanged) {
            // Clear any existing timeout to prevent race conditions
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }

            setDisableChartAnimation(true);
            // Reset animation control after a short delay
            animationTimeoutRef.current = setTimeout(() => {
                setDisableChartAnimation(false);
                animationTimeoutRef.current = null;
            }, 100);
        }

        // Update the ref with the new builds before setting state
        previousBuildsRef.current = resolvedBuilds;
        setBuilds(newBuilds);
    };

    // Sync ref with builds state
    useEffect(() => {
        previousBuildsRef.current = builds;
    }, [builds]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (animationTimeoutRef.current) {
                clearTimeout(animationTimeoutRef.current);
            }
        };
    }, []);

    const loadPersistedState = useCallback(() => {
        // Helper function to handle imported builds
        const handleImportedBuilds = (
            importedBuilds: Build[],
            importedLevel?: number,
            importedAbsoluteFocus?: boolean,
            importedGatheringStormMinutes?: number,
            importedAdShardCount?: number,
            importedChampionId?: ChampionId,
            importedDravenQEnabled?: boolean,
            importedDravenQLevel?: number,
            importedDravenQLevelLinked?: boolean
        ) => {
            setUrlImportBuilds(importedBuilds);
            setUrlImportChampionLevel(importedLevel ?? null);
            setUrlImportAbsoluteFocus(importedAbsoluteFocus ?? null);
            setUrlImportGatheringStormMinutes(importedGatheringStormMinutes ?? null);
            setUrlImportAdShardCount(importedAdShardCount ?? null);
            setUrlImportChampionId(importedChampionId ?? null);
            setUrlImportDravenQEnabled(importedDravenQEnabled ?? null);
            setUrlImportDravenQLevel(importedDravenQLevel ?? null);
            setUrlImportDravenQLevelLinked(importedDravenQLevelLinked ?? null);
        };

        // Handle hash changes
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash && hash.includes("builds=")) {
                try {
                    const encoded = decodeURIComponent(hash.split("builds=")[1]);

                    // Try new format first, fallback to legacy
                    try {
                        const {
                            builds: importedBuilds,
                            championLevel: importedLevel,
                            absoluteFocus: importedAbsoluteFocus,
                            gatheringStormMinutes: importedGatheringStormMinutes,
                            adShardCount: importedAdShardCount,
                            championId: importedChampionId,
                            dravenQEnabled: importedDravenQEnabled,
                            dravenQLevel: importedDravenQLevel,
                            dravenQLevelLinked: importedDravenQLevelLinked,
                        } = decodeBuilds(encoded);
                        handleImportedBuilds(
                            importedBuilds,
                            importedLevel,
                            importedAbsoluteFocus,
                            importedGatheringStormMinutes,
                            importedAdShardCount,
                            importedChampionId,
                            importedDravenQEnabled,
                            importedDravenQLevel,
                            importedDravenQLevelLinked
                        );
                    } catch (error) {
                        console.log("New format failed, trying legacy format:", error);
                        const { builds: importedBuilds, championLevel: importedLevel } =
                            decodeBuildsLegacy(encoded);
                        handleImportedBuilds(importedBuilds, importedLevel);
                    }

                    // Clear hash after loading
                    window.history.replaceState(null, "", window.location.pathname);
                } catch (error) {
                    console.error("Error loading builds from URL:", error);
                }
            }
        };

        // Listen for hash changes
        window.addEventListener("hashchange", handleHashChange);

        // Also check initial hash
        handleHashChange();

        // Load from localStorage (but don't overwrite if auto-import happened)
        const savedState = localStorage.getItem("calculatorState");
        if (savedState) {
            try {
                const parsedState = JSON.parse(savedState) as Record<string, unknown>;
                const savedLevel = parseFiniteNumber(parsedState.level);
                const savedBuilds = parsedState.builds;
                const savedArmorRange = parseArmorRange(parsedState.armorRange);
                const savedShowMargin =
                    typeof parsedState.showMargin === "boolean"
                        ? parsedState.showMargin
                        : undefined;
                const savedStdDev = parseFiniteNumber(parsedState.stdDevMultiplier);
                const savedPercentile = parseFiniteNumber(parsedState.percentileRange);
                const savedNumAutoAttacks = parseFiniteNumber(
                    parsedState.numAutoAttacks
                );
                const savedAbsoluteFocus =
                    typeof parsedState.absoluteFocus === "boolean"
                        ? parsedState.absoluteFocus
                        : undefined;
                const savedGatheringStormMinutes = parseFiniteNumber(
                    parsedState.gatheringStormMinutes
                );
                const savedAdShardCount = parseFiniteNumber(parsedState.adShardCount);
                const savedTargetBonusHP = parseFiniteNumber(parsedState.targetBonusHP);
                const savedTargetBonusHPRangeMode =
                    typeof parsedState.targetBonusHPRangeMode === "boolean"
                        ? parsedState.targetBonusHPRangeMode
                        : undefined;
                const savedTargetBonusHPMax = parseFiniteNumber(
                    parsedState.targetBonusHPMax
                );
                const savedHexopticsDistance = parseFiniteNumber(
                    parsedState.hexopticsDistance
                );
                const savedChampionId = parsedState.championId;
                const savedDravenQEnabled =
                    typeof parsedState.dravenQEnabled === "boolean"
                        ? parsedState.dravenQEnabled
                        : undefined;
                const savedDravenQLevel = parseFiniteNumber(parsedState.dravenQLevel);
                const savedDravenQLevelLinked =
                    typeof parsedState.dravenQLevelLinked === "boolean"
                        ? parsedState.dravenQLevelLinked
                        : undefined;
                const savedChampionPanelCompact =
                    typeof parsedState.championPanelCompact === "boolean"
                        ? parsedState.championPanelCompact
                        : undefined;
                const savedItemDataVersionRaw = parsedState.itemDataVersion;
                const savedItemDataVersion =
                    typeof savedItemDataVersionRaw === "string"
                        ? savedItemDataVersionRaw
                        : null;
                // Only load level if we didn't auto-import from URL
                if (savedLevel !== null && !autoImportedRef.current) {
                    setLevel(Math.max(1, Math.min(18, Math.round(savedLevel))));
                }
                if (savedArmorRange) {
                    setArmorRange(savedArmorRange);
                }
                // Only load builds if we didn't auto-import from URL
                if (savedBuilds && !autoImportedRef.current) {
                    const normalizedBuilds = deserializeBuilds(savedBuilds);
                    setBuilds(normalizedBuilds);

                    // Migrate old/stale saved item payloads onto canonical item data.
                    if (savedItemDataVersion !== ITEM_DATA_VERSION) {
                        const migratedState = {
                            ...parsedState,
                            builds: serializeBuilds(normalizedBuilds),
                            itemDataVersion: ITEM_DATA_VERSION,
                        };
                        localStorage.setItem(
                            "calculatorState",
                            JSON.stringify(migratedState)
                        );
                    }
                }
                if (savedShowMargin !== undefined) {
                    setShowMargin(savedShowMargin);
                }
                if (savedStdDev !== null && savedStdDev > 0) {
                    setStdDevMultiplier(savedStdDev);
                }
                if (savedPercentile !== null) {
                    setPercentileRange(Math.max(0, Math.min(50, savedPercentile)));
                }
                if (savedNumAutoAttacks !== null) {
                    setNumAutoAttacks(Math.max(1, Math.round(savedNumAutoAttacks)));
                }
                if (savedAbsoluteFocus !== undefined)
                    setAbsoluteFocus(savedAbsoluteFocus);
                if (savedGatheringStormMinutes !== null) {
                    setGatheringStormMinutes(
                        Math.max(0, Math.round(savedGatheringStormMinutes / 10) * 10)
                    );
                }
                if (savedAdShardCount !== null)
                    setAdShardCount(sanitizeAdShardCount(savedAdShardCount));
                const normalizedTargetBonusHP =
                    savedTargetBonusHP === null
                        ? null
                        : Math.max(0, Math.min(1500, savedTargetBonusHP));
                const normalizedTargetBonusHPMaxBase =
                    savedTargetBonusHPMax === null
                        ? null
                        : Math.max(0, Math.min(1500, savedTargetBonusHPMax));
                const normalizedTargetBonusHPMax =
                    normalizedTargetBonusHPMaxBase === null
                        ? null
                        : normalizedTargetBonusHP === null
                          ? normalizedTargetBonusHPMaxBase
                          : Math.max(
                                normalizedTargetBonusHPMaxBase,
                                normalizedTargetBonusHP
                            );
                if (normalizedTargetBonusHP !== null)
                    setTargetBonusHP(normalizedTargetBonusHP);
                if (savedTargetBonusHPRangeMode !== undefined)
                    setTargetBonusHPRangeMode(savedTargetBonusHPRangeMode);
                if (normalizedTargetBonusHPMax !== null)
                    setTargetBonusHPMax(normalizedTargetBonusHPMax);
                if (savedHexopticsDistance !== null) {
                    setHexopticsDistance(
                        clampHexopticsDistance(savedHexopticsDistance)
                    );
                }
                // Load champion
                if (savedChampionId === "aphelios" || savedChampionId === "draven") {
                    setChampionId(savedChampionId);
                    setChampion(createChampion(savedChampionId));
                }
                // Load Draven Q settings
                if (savedDravenQEnabled !== undefined)
                    setDravenQEnabled(savedDravenQEnabled);
                if (savedDravenQLevel !== null)
                    setDravenQLevel(
                        Math.max(1, Math.min(5, Math.round(savedDravenQLevel)))
                    );
                if (savedDravenQLevelLinked !== undefined)
                    setDravenQLevelLinked(savedDravenQLevelLinked);
                if (savedChampionPanelCompact !== undefined)
                    setChampionPanelCompact(savedChampionPanelCompact);
            } catch (error) {
                console.error("Error loading saved state:", error);
            }
        }

        // Cleanup event listener
        return () => {
            window.removeEventListener("hashchange", handleHashChange);
        };
    }, []);

    const persistState = useCallback(() => {
        const stateToSave = {
            level,
            armorRange,
            builds: serializeBuilds(builds),
            itemDataVersion: ITEM_DATA_VERSION,
            showMargin,
            stdDevMultiplier,
            percentileRange,
            numAutoAttacks,
            absoluteFocus,
            gatheringStormMinutes,
            adShardCount,
            targetBonusHP,
            targetBonusHPRangeMode,
            targetBonusHPMax,
            hexopticsDistance,
            championId,
            dravenQEnabled,
            dravenQLevel: dravenQLevelLinked
                ? getQRankFromChampLevel(level)
                : dravenQLevel,
            dravenQLevelLinked,
            championPanelCompact,
        };
        localStorage.setItem("calculatorState", JSON.stringify(stateToSave));
    }, [
        level,
        armorRange,
        builds,
        showMargin,
        stdDevMultiplier,
        percentileRange,
        numAutoAttacks,
        absoluteFocus,
        gatheringStormMinutes,
        adShardCount,
        targetBonusHP,
        targetBonusHPRangeMode,
        targetBonusHPMax,
        hexopticsDistance,
        championId,
        dravenQEnabled,
        dravenQLevel,
        dravenQLevelLinked,
        championPanelCompact,
    ]);

    usePersistenceLifecycle({
        loadState: loadPersistedState,
        saveState: persistState,
    });

    // Functions to update state
    function handleLevelChange(newLevel: number) {
        if (!Number.isFinite(newLevel)) {
            return;
        }
        const normalizedLevel = Math.round(newLevel);
        if (normalizedLevel < 1 || normalizedLevel > 18) return;
        setLevel(normalizedLevel);
        // Update Draven Q level if linked
        if (dravenQLevelLinked) {
            setDravenQLevel(getQRankFromChampLevel(normalizedLevel));
        }
    }

    useEffect(() => {
        if (!dravenQLevelLinked) {
            return;
        }
        const linkedLevel = getQRankFromChampLevel(level);
        if (dravenQLevel !== linkedLevel) {
            setDravenQLevel(linkedLevel);
        }
    }, [dravenQLevelLinked, level, dravenQLevel]);

    function handleChampionChange(newChampionId: ChampionId) {
        setChampionId(newChampionId);
        setChampion(createChampion(newChampionId));
    }

    function handleResetAll() {
        setLevel(1);
        setBuilds([]);
        setArmorRange([0, 200]);
        setShowMargin(false);
        setStdDevMultiplier(1);
        setPercentileRange(34);
        setNumAutoAttacks(5);
        setAbsoluteFocus(false);
        setGatheringStormMinutes(0);
        setAdShardCount(0);
        setTargetBonusHP(0);
        setTargetBonusHPRangeMode(false);
        setTargetBonusHPMax(1500);
        setHexopticsDistance(0);
        setChampionId("aphelios");
        setChampion(createChampion("aphelios"));
        setDravenQEnabled(true);
        setDravenQLevel(getQRankFromChampLevel(1)); // Reset to level 1 Q rank
        setDravenQLevelLinked(true);
        setChampionPanelCompact(false);
        localStorage.removeItem("calculatorState");
    }

    // Margin of error functions - hidden for now, LDR damage variance is more important
    // Convert std dev to approximate percentile range
    // function stdDevToPercentile(stdDev: number): number {
    //     // For normal distribution approximation
    //     // 1σ ≈ 68% CI → ±34%
    //     // 2σ ≈ 95% CI → ±47.5%
    //     // 3σ ≈ 99.7% CI → ±49.85%
    //     const percentage = (1 - Math.exp((-stdDev * stdDev) / 2)) * 50;
    //     return Math.round(percentage);
    // }

    // // Convert percentile range to approximate std dev
    // function percentileToStdDev(percentile: number): number {
    //     // Inverse of above - approximate
    //     const ratio = percentile / 50;
    //     const stdDev = Math.sqrt(-2 * Math.log(1 - ratio));
    //     return stdDev;
    // }

    // function handleStdDevChange(newStdDev: number) {
    //     setStdDevMultiplier(newStdDev);
    //     setPercentileRange(stdDevToPercentile(newStdDev));
    // }

    // function handlePercentileChange(newPercentile: number) {
    //     setPercentileRange(newPercentile);
    //     setStdDevMultiplier(percentileToStdDev(newPercentile));
    // }

    return (
        <div className="appContainer">
            <AppHeader
                title={`${CHAMPIONS[championId].name} Auto Calculator`}
                keepActionsWithTitle
                actions={
                    <button className="reset-all-button" onClick={handleResetAll}>
                        Reset All
                    </button>
                }
            />

            <div className="mainContent">
                {/* Left Column: Champion Settings + Build Panel */}
                <div className="leftColumn">
                    <div className={`globalSettings ${championPanelCompact ? "compact" : ""}`}>
                        <div 
                            className="championHeader"
                            onClick={() => setChampionPanelCompact(!championPanelCompact)}
                            title={championPanelCompact ? "Click to expand" : "Click to collapse"}
                        >
                            <div className="championSelector" onClick={(e) => e.stopPropagation()}>
                                <select
                                    value={championId}
                                    onChange={(e) => handleChampionChange(e.target.value as ChampionId)}
                                    className="championSelect"
                                >
                                    <option value="aphelios">Aphelios</option>
                                    <option value="draven">Draven</option>
                                </select>
                            </div>
                            {championPanelCompact && (
                                <div className="compactSummary">
                                    <span className="compactSummaryItem compactSummaryToggle is-on">
                                        <span className="compactSummaryLabel">Lvl</span>
                                        <span className="compactSummaryValue">{level}</span>
                                    </span>
                                    <span
                                        className={`compactSummaryItem compactSummaryToggle ${
                                            adShardCount > 0 ? "is-on" : "is-off"
                                        }`}
                                    >
                                        <span className="compactSummaryLabel">AD</span>
                                        <span className="compactSummaryValue">
                                            x{adShardCount}
                                        </span>
                                    </span>
                                    <span
                                        className={`compactSummaryItem compactSummaryToggle ${
                                            absoluteFocus ? "is-on" : "is-off"
                                        }`}
                                    >
                                        <span className="compactSummaryLabel">AF</span>
                                        <span className="compactSummaryValue">
                                            {absoluteFocus ? "On" : "Off"}
                                        </span>
                                    </span>
                                    <span
                                        className={`compactSummaryItem compactSummaryToggle ${
                                            isGatheringStormActive ? "is-on" : "is-off"
                                        }`}
                                    >
                                        <span className="compactSummaryLabel">GS</span>
                                        <span className="compactSummaryValue">
                                            {isGatheringStormActive
                                                ? `${gatheringStormMinutes}m`
                                                : "Off"}
                                        </span>
                                    </span>
                                    {championId === "draven" && (
                                        <span
                                            className={`compactSummaryItem compactSummaryToggle ${
                                                dravenQEnabled ? "is-on" : "is-off"
                                            }`}
                                        >
                                            <span className="compactSummaryLabel">Axe</span>
                                            <span className="compactSummaryValue compactSummaryValueAxe">
                                                <span className="compactSummaryValueState">
                                                    {dravenQEnabled ? "On" : "Off"}
                                                </span>
                                                <span className="compactSummaryValueDivider">
                                                    ·
                                                </span>
                                                <span className="compactSummaryValueLevel">
                                                    {effectiveDravenQLevel}
                                                </span>
                                            </span>
                                        </span>
                                    )}
                                </div>
                            )}
                            <span className="compactIndicator">
                                {championPanelCompact ? "▼" : "▲"}
                            </span>
                        </div>
                        <div
                            className={`championPanelBody ${
                                championPanelCompact ? "is-collapsed" : ""
                            }`}
                            aria-hidden={championPanelCompact}
                        >
                            <div className="championPanelBodyInner">
                                <div className="levelRow">
                            <label className="levelLabel">
                                Lvl
                                <div className="numberInputGroup">
                                    <button
                                        type="button"
                                        className="numberInputButton"
                                        onClick={() =>
                                            handleLevelChange(Math.max(1, level - 1))
                                        }
                                        aria-label="Decrease level"
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={18}
                                        value={level}
                                        onChange={(e) => {
                                            const parsedLevel = parseNumberInput(
                                                e.target.value
                                            );
                                            if (parsedLevel !== null) {
                                                handleLevelChange(parsedLevel);
                                            }
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        className="numberInput"
                                    />
                                    <button
                                        type="button"
                                        className="numberInputButton"
                                        onClick={() =>
                                            handleLevelChange(Math.min(18, level + 1))
                                        }
                                        aria-label="Increase level"
                                    >
                                        +
                                    </button>
                                </div>
                            </label>
                            <span className="champ-stats">
                                AD: {champion.getAD(level).toFixed(0)}
                            </span>
                            {/* Draven Spinning Axe settings - inline with level */}
                            {championId === "draven" && (
                                <>
                                    <label className="dravenCheckboxLabel">
                                        Axe
                                        <input
                                            type="checkbox"
                                            checked={dravenQEnabled}
                                            onChange={(e) =>
                                                setDravenQEnabled(e.target.checked)
                                            }
                                        />
                                    </label>
                                    {dravenQEnabled && (
                                        <>
                                            <select
                                                value={effectiveDravenQLevel}
                                                onChange={(e) => {
                                                    const parsedQLevel =
                                                        parseNumberInput(
                                                            e.target.value
                                                        );
                                                    if (parsedQLevel !== null) {
                                                        setDravenQLevel(
                                                            Math.max(
                                                                1,
                                                                Math.min(
                                                                    5,
                                                                    Math.round(
                                                                        parsedQLevel
                                                                    )
                                                                )
                                                            )
                                                        );
                                                        setDravenQLevelLinked(
                                                            false
                                                        );
                                                    }
                                                }}
                                                className={`qLevelSelect ${
                                                    dravenQLevelLinked ? "linked" : ""
                                                }`}
                                                disabled={dravenQLevelLinked}
                                            >
                                                {[1, 2, 3, 4, 5].map((lvl) => (
                                                    <option key={lvl} value={lvl}>
                                                        {lvl}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                className={`linkToggle ${
                                                    dravenQLevelLinked ? "linked" : ""
                                                }`}
                                                onClick={() => {
                                                    const newLinked = !dravenQLevelLinked;
                                                    setDravenQLevelLinked(newLinked);
                                                    if (newLinked) {
                                                        setDravenQLevel(
                                                            getQRankFromChampLevel(level)
                                                        );
                                                    }
                                                }}
                                                title="Link Q level to champion level (max Q first)"
                                            >
                                                🔗
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                            <div className="runeSettings">
                            <div className="runeRow">
                                <label className="runeInputLabel">
                                    AD Shards:
                                    <div
                                        className="runeShardButtons"
                                        role="group"
                                        aria-label="AD shards"
                                    >
                                        {[0, 1, 2].map((count) => (
                                            <button
                                                key={count}
                                                type="button"
                                                className={`runeShardButton ${
                                                    adShardCount === count
                                                        ? "active"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    setAdShardCount(count)
                                                }
                                                aria-pressed={
                                                    adShardCount === count
                                                }
                                            >
                                                {count}
                                            </button>
                                        ))}
                                    </div>
                                </label>
                                <span
                                    className={`runeADValue ${
                                        adShardCount > 0
                                            ? "runeADValueActive"
                                            : "runeADValueInactive"
                                    }`}
                                >
                                    (+{getAdShardBonus(adShardCount).toFixed(1)} AD)
                                </span>
                            </div>
                            <div className="runeRow">
                                <label className="runeCheckboxLabel">
                                    Absolute Focus
                                    <input
                                        type="checkbox"
                                        checked={absoluteFocus}
                                        onChange={(e) =>
                                            setAbsoluteFocus(e.target.checked)
                                        }
                                    />
                                </label>
                                <span
                                    className={`runeADValue ${
                                        absoluteFocus
                                            ? "runeADValueActive"
                                            : "runeADValueInactive"
                                    }`}
                                >
                                    (+{getAbsoluteFocusAD(level).toFixed(1)} AD)
                                </span>
                            </div>
                            <div className="runeRow">
                                <label className="runeInputLabel">
                                    Gathering Storm (minutes):
                                    <div className="numberInputGroup">
                                        <button
                                            type="button"
                                            className="numberInputButton"
                                            onClick={() => {
                                                setGatheringStormMinutes(
                                                    Math.max(
                                                        0,
                                                        gatheringStormMinutes - 10
                                                    )
                                                );
                                            }}
                                            aria-label="Decrease minutes"
                                        >
                                            −
                                        </button>
                                        <input
                                            type="number"
                                            min={0}
                                            step={10}
                                            value={gatheringStormMinutes}
                                            onChange={(e) => {
                                                const parsedValue =
                                                    parseNumberInput(
                                                        e.target.value
                                                    );
                                                if (parsedValue === null) {
                                                    return;
                                                }
                                                const value = Math.max(
                                                    0,
                                                    parsedValue
                                                );
                                                // Round to nearest 10
                                                setGatheringStormMinutes(
                                                    Math.round(value / 10) * 10
                                                );
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className="numberInput"
                                        />
                                        <button
                                            type="button"
                                            className="numberInputButton"
                                            onClick={() => {
                                                setGatheringStormMinutes(
                                                    gatheringStormMinutes + 10
                                                );
                                            }}
                                            aria-label="Increase minutes"
                                        >
                                            +
                                        </button>
                                    </div>
                                </label>
                                <span
                                    className={`runeADValue ${
                                        gatheringStormMinutes > 0
                                            ? "runeADValueActive"
                                            : "runeADValueInactive"
                                    }`}
                                >
                                    (+
                                    {getGatheringStormAD(gatheringStormMinutes).toFixed(
                                        1
                                    )}{" "}
                                    AD)
                                </span>
                            </div>
                        </div>
                            </div>
                        </div>
                    </div>
                    <BuildPanel
                        builds={builds}
                        setBuilds={setBuildsWithAnimationControl}
                        championLevel={level}
                        championId={championId}
                        champion={champion}
                        absoluteFocus={absoluteFocus}
                        gatheringStormMinutes={gatheringStormMinutes}
                        adShardCount={adShardCount}
                        dravenQEnabled={dravenQEnabled}
                        dravenQLevel={effectiveDravenQLevel}
                        dravenQLevelLinked={dravenQLevelLinked}
                        urlImportBuilds={urlImportBuilds}
                        urlImportChampionLevel={urlImportChampionLevel}
                        urlImportAbsoluteFocus={urlImportAbsoluteFocus}
                        urlImportGatheringStormMinutes={urlImportGatheringStormMinutes}
                        urlImportAdShardCount={urlImportAdShardCount}
                        urlImportChampionId={urlImportChampionId}
                        urlImportDravenQEnabled={urlImportDravenQEnabled}
                        urlImportDravenQLevel={urlImportDravenQLevel}
                        urlImportDravenQLevelLinked={urlImportDravenQLevelLinked}
                        onUrlImportHandled={() => {
                            setUrlImportBuilds(null);
                            setUrlImportChampionLevel(null);
                            setUrlImportAbsoluteFocus(null);
                            setUrlImportGatheringStormMinutes(null);
                            setUrlImportAdShardCount(null);
                            setUrlImportChampionId(null);
                            setUrlImportDravenQEnabled(null);
                            setUrlImportDravenQLevel(null);
                            setUrlImportDravenQLevelLinked(null);
                        }}
                        onChampionLevelImport={(importedLevel) => {
                            handleLevelChange(importedLevel);
                        }}
                        onAbsoluteFocusImport={(importedAbsoluteFocus) => {
                            setAbsoluteFocus(importedAbsoluteFocus);
                        }}
                        onGatheringStormImport={(importedMinutes) => {
                            if (!Number.isFinite(importedMinutes)) {
                                return;
                            }
                            setGatheringStormMinutes(
                                Math.max(0, Math.round(importedMinutes / 10) * 10)
                            );
                        }}
                        onAdShardCountImport={(importedAdShardCount) => {
                            setAdShardCount(sanitizeAdShardCount(importedAdShardCount));
                        }}
                        onChampionImport={(importedChampionId) => {
                            handleChampionChange(importedChampionId);
                        }}
                        onDravenQEnabledImport={(importedDravenQEnabled) => {
                            setDravenQEnabled(importedDravenQEnabled);
                        }}
                        onDravenQLevelImport={(importedDravenQLevel) => {
                            if (!Number.isFinite(importedDravenQLevel)) {
                                return;
                            }
                            setDravenQLevel(
                                Math.max(1, Math.min(5, Math.round(importedDravenQLevel)))
                            );
                        }}
                        onDravenQLevelLinkedImport={(importedLinked) => {
                            setDravenQLevelLinked(importedLinked);
                        }}
                    />
                </div>

                {/* Right Column: Graph Section */}
                <div className="graphSection">
                    <DamageChart
                        builds={builds}
                        champion={champion}
                        level={level}
                        armorRange={armorRange}
                        step={step}
                        showMargin={showMargin}
                        stdDevMultiplier={stdDevMultiplier}
                        numAutoAttacks={numAutoAttacks}
                        absoluteFocus={absoluteFocus}
                        gatheringStormMinutes={gatheringStormMinutes}
                        adShardCount={adShardCount}
                        targetBonusHP={targetBonusHP}
                        targetBonusHPRangeMode={targetBonusHPRangeMode}
                        targetBonusHPMax={targetBonusHPMax}
                        hexopticsDistance={hexopticsDistance}
                        disableAnimation={disableChartAnimation}
                        dravenQ={{
                            enabled: championId === "draven" && dravenQEnabled,
                            qLevel: effectiveDravenQLevel,
                        }}
                    />

                    <div className="globalSettings">
                        <div className="armorRangeContainer">
                            <label className="armorInputLabel">
                                Armor Range Start:
                                <div className="numberInputGroup">
                                    <button
                                        type="button"
                                        className="numberInputButton"
                                        onClick={() =>
                                            setArmorRange(([, end]) => [
                                                Math.max(0, armorRange[0] - 10),
                                                end,
                                            ])
                                        }
                                        aria-label="Decrease armor start"
                                    >
                                        −
                                    </button>
                                    <input
                                        className="armorInput numberInput"
                                        type="number"
                                        value={armorRange[0]}
                                        onChange={(e) => {
                                            const parsedArmorStart =
                                                parseNumberInput(e.target.value);
                                            if (parsedArmorStart === null) {
                                                return;
                                            }
                                            setArmorRange(([, end]) => [
                                                parsedArmorStart,
                                                end,
                                            ]);
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="numberInputButton"
                                        onClick={() =>
                                            setArmorRange(([, end]) => [
                                                armorRange[0] + 10,
                                                end,
                                            ])
                                        }
                                        aria-label="Increase armor start"
                                    >
                                        +
                                    </button>
                                </div>
                            </label>
                            <label className="armorInputLabel">
                                Armor Range End:
                                <div className="numberInputGroup">
                                    <button
                                        type="button"
                                        className="numberInputButton"
                                        onClick={() =>
                                            setArmorRange(([start]) => [
                                                start,
                                                Math.max(0, armorRange[1] - 10),
                                            ])
                                        }
                                        aria-label="Decrease armor end"
                                    >
                                        −
                                    </button>
                                    <input
                                        className="armorInput numberInput"
                                        type="number"
                                        value={armorRange[1]}
                                        onChange={(e) => {
                                            const parsedArmorEnd = parseNumberInput(
                                                e.target.value
                                            );
                                            if (parsedArmorEnd === null) {
                                                return;
                                            }
                                            setArmorRange(([start]) => [
                                                start,
                                                parsedArmorEnd,
                                            ]);
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="numberInputButton"
                                        onClick={() =>
                                            setArmorRange(([start]) => [
                                                start,
                                                armorRange[1] + 10,
                                            ])
                                        }
                                        aria-label="Increase armor end"
                                    >
                                        +
                                    </button>
                                </div>
                            </label>
                        </div>

                        {(hasLDRBuild || hasHexopticsBuild) && (
                            <div className="targetBonusHPContainer">
                                {hasLDRBuild && (
                                    <div className="targetBonusHPSingleLine">
                                        <span className="targetBonusHPTitle">
                                            Target HP
                                            <span className="help-hint-wrap">
                                                <button
                                                    type="button"
                                                    className="help-hint"
                                                    data-tooltip-id={targetHpTooltipId}
                                                    aria-label={targetHpTooltipText}
                                                >
                                                    ?
                                                </button>
                                            </span>
                                            <Tooltip
                                                id={targetHpTooltipId}
                                                place="top-start"
                                                variant="light"
                                                border="1px solid var(--border-light)"
                                                offset={10}
                                                positionStrategy="fixed"
                                                events={isTouchDevice ? ["click"] : ["hover"]}
                                                opacity={1}
                                                style={{
                                                    backgroundColor: "var(--bg-primary)",
                                                    color: "var(--text-primary)",
                                                    borderRadius: "8px",
                                                    padding: "8px 10px",
                                                    fontSize: "12px",
                                                    fontWeight: 500,
                                                    minWidth: "190px",
                                                    maxWidth: "min(280px, calc(100vw - 24px))",
                                                    whiteSpace: "normal",
                                                    zIndex: 10000,
                                                    opacity: 1,
                                                    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
                                                }}
                                            >
                                                {targetHpTooltipText}
                                            </Tooltip>
                                        </span>
                                        <label
                                            className="rangeModeCheckbox"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={targetBonusHPRangeMode}
                                                onChange={(e) =>
                                                    setTargetBonusHPRangeMode(e.target.checked)
                                                }
                                            />
                                            Range
                                        </label>
                                        <div
                                            className={`targetBonusHPControls ${
                                                targetBonusHPRangeMode
                                                    ? "is-range"
                                                    : "is-single"
                                            }`}
                                        >
                                            {targetBonusHPRangeMode ? (
                                                <>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={1500}
                                                        value={targetBonusHP}
                                                        onChange={(e) => {
                                                            const parsedTargetBonusHP =
                                                                parseNumberInput(
                                                                    e.target.value
                                                                );
                                                            if (parsedTargetBonusHP === null) {
                                                                return;
                                                            }
                                                            const newMin = Math.max(
                                                                0,
                                                                Math.min(
                                                                    1500,
                                                                    parsedTargetBonusHP
                                                                )
                                                            );
                                                            setTargetBonusHP(
                                                                Math.min(newMin, targetBonusHPMax)
                                                            );
                                                        }}
                                                        onFocus={(e) => e.target.select()}
                                                        className="targetBonusHPInput numberInput rangeInput"
                                                    />
                                                    <div className="dualSliderContainer">
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={1500}
                                                            step={50}
                                                            value={targetBonusHP}
                                                            onChange={(e) => {
                                                                const parsedTargetBonusHP =
                                                                    parseNumberInput(
                                                                        e.target.value
                                                                    );
                                                                if (parsedTargetBonusHP === null) {
                                                                    return;
                                                                }
                                                                setTargetBonusHP(
                                                                    Math.min(
                                                                        parsedTargetBonusHP,
                                                                        targetBonusHPMax
                                                                    )
                                                                );
                                                            }}
                                                            className="targetBonusHPSlider dualSlider"
                                                        />
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={1500}
                                                            step={50}
                                                            value={targetBonusHPMax}
                                                            onChange={(e) => {
                                                                const parsedTargetBonusHPMax =
                                                                    parseNumberInput(
                                                                        e.target.value
                                                                    );
                                                                if (
                                                                    parsedTargetBonusHPMax ===
                                                                    null
                                                                ) {
                                                                    return;
                                                                }
                                                                setTargetBonusHPMax(
                                                                    Math.max(
                                                                        parsedTargetBonusHPMax,
                                                                        targetBonusHP
                                                                    )
                                                                );
                                                            }}
                                                            className="targetBonusHPSlider dualSlider"
                                                        />
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={1500}
                                                        value={targetBonusHPMax}
                                                        onChange={(e) => {
                                                            const parsedTargetBonusHPMax =
                                                                parseNumberInput(
                                                                    e.target.value
                                                                );
                                                            if (parsedTargetBonusHPMax === null) {
                                                                return;
                                                            }
                                                            const newMax = Math.max(
                                                                0,
                                                                Math.min(
                                                                    1500,
                                                                    parsedTargetBonusHPMax
                                                                )
                                                            );
                                                            setTargetBonusHPMax(
                                                                Math.max(newMax, targetBonusHP)
                                                            );
                                                        }}
                                                        onFocus={(e) => e.target.select()}
                                                        className="targetBonusHPInput numberInput rangeInput"
                                                    />
                                                    <span className="giantSlayerBonus">
                                                        +
                                                        {Math.min(
                                                            15,
                                                            (targetBonusHP / 1500) * 15
                                                        ).toFixed(1)}
                                                        %–
                                                        {Math.min(
                                                            15,
                                                            (targetBonusHPMax / 1500) * 15
                                                        ).toFixed(1)}
                                                        %
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={1500}
                                                        step={50}
                                                        value={targetBonusHP}
                                                        onChange={(e) => {
                                                            const parsedTargetBonusHP =
                                                                parseNumberInput(
                                                                    e.target.value
                                                                );
                                                            if (parsedTargetBonusHP !== null) {
                                                                setTargetBonusHP(
                                                                    parsedTargetBonusHP
                                                                );
                                                            }
                                                        }}
                                                        className="targetBonusHPSlider singleSlider"
                                                    />
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={1500}
                                                        value={targetBonusHP}
                                                        onChange={(e) => {
                                                            const parsedTargetBonusHP =
                                                                parseNumberInput(
                                                                    e.target.value
                                                                );
                                                            if (parsedTargetBonusHP === null) {
                                                                return;
                                                            }
                                                            setTargetBonusHP(
                                                                Math.max(
                                                                    0,
                                                                    Math.min(
                                                                        1500,
                                                                        parsedTargetBonusHP
                                                                    )
                                                                )
                                                            );
                                                        }}
                                                        onFocus={(e) => e.target.select()}
                                                        className="targetBonusHPInput numberInput rangeInput"
                                                    />
                                                    <span className="giantSlayerBonus">
                                                        +
                                                        {Math.min(
                                                            15,
                                                            (targetBonusHP / 1500) * 15
                                                        ).toFixed(1)}
                                                        %
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {hasHexopticsBuild && (
                                    <div className="targetBonusHPSingleLine">
                                        <span className="targetBonusHPTitle">
                                            Hexoptics Distance
                                        </span>
                                        <div className="targetBonusHPControls is-single">
                                            <input
                                                type="range"
                                                min={0}
                                                max={500}
                                                step={10}
                                                value={hexopticsDistance}
                                                onChange={(e) => {
                                                    const parsedDistance =
                                                        parseNumberInput(e.target.value);
                                                    if (parsedDistance !== null) {
                                                        setHexopticsDistance(
                                                            clampHexopticsDistance(
                                                                parsedDistance
                                                            )
                                                        );
                                                    }
                                                }}
                                                className="targetBonusHPSlider singleSlider"
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                max={500}
                                                value={hexopticsDistance}
                                                onChange={(e) => {
                                                    const parsedDistance =
                                                        parseNumberInput(e.target.value);
                                                    if (parsedDistance !== null) {
                                                        setHexopticsDistance(
                                                            clampHexopticsDistance(
                                                                parsedDistance
                                                            )
                                                        );
                                                    }
                                                }}
                                                onFocus={(e) => e.target.select()}
                                                className="targetBonusHPInput numberInput rangeInput"
                                            />
                                            <span className="giantSlayerBonus">
                                                +
                                                {(
                                                    (clampHexopticsDistance(
                                                        hexopticsDistance
                                                    ) /
                                                        500) *
                                                    10
                                                ).toFixed(1)}
                                                %
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Margin of error hidden for now - LDR damage variance is more important
                        <div className="marginErrorContainer">
                            <label className="marginCheckboxLabel">
                                <input
                                    type="checkbox"
                                    checked={showMargin}
                                    onChange={(e) => setShowMargin(e.target.checked)}
                                />
                                Show Margin of Error
                            </label>

                            {showMargin && (
                                <div className="marginControls">
                                    <label className="marginTypeLabel">
                                        ±{" "}
                                        <input
                                            type="number"
                                            value={stdDevMultiplier}
                                            onChange={(e) =>
                                                handleStdDevChange(Number(e.target.value))
                                            }
                                            onFocus={(e) => e.target.select()}
                                            min="0.1"
                                            max="10"
                                            step="0.1"
                                            className="marginTypeSelect"
                                        />{" "}
                                        σ
                                    </label>
                                    <label className="marginTypeLabel">
                                        ±{" "}
                                        <input
                                            type="number"
                                            value={percentileRange}
                                            onChange={(e) =>
                                                handlePercentileChange(
                                                    Number(e.target.value)
                                                )
                                            }
                                            onFocus={(e) => e.target.select()}
                                            min="0"
                                            max="50"
                                            step="1"
                                            className="marginTypeSelect"
                                        />{" "}
                                        %
                                    </label>
                                    <label className="marginTypeLabel">
                                        n ={" "}
                                        <input
                                            type="number"
                                            value={numAutoAttacks}
                                            onChange={(e) =>
                                                setNumAutoAttacks(
                                                    Math.max(1, Number(e.target.value))
                                                )
                                            }
                                            onFocus={(e) => e.target.select()}
                                            min="1"
                                            max="100"
                                            step="1"
                                            className="marginTypeSelect"
                                        />{" "}
                                        autos
                                    </label>
                                </div>
                            )}
                        </div>
                        */}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CalculatorPage;
