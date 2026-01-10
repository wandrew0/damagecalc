"use client";

import React, { useEffect, useState, useRef } from "react";
import "../styles/CalculatorPage.css";

import { Build } from "../classes/Build";
import { Item } from "../classes/Item";

import BuildPanel from "../components/BuildPanel";
import DamageChart from "../components/DamageChart";
import Navigation from "../components/Navigation";
import { decodeBuilds, decodeBuildsLegacy } from "../utils/encoder";
import { getAbsoluteFocusAD, getGatheringStormAD } from "../classes/Calculator";
import {
    ChampionId,
    CHAMPIONS,
    createChampion,
    getQRankFromChampLevel,
} from "../data/champions";

function serializeBuilds(builds: Build[]) {
    return builds.map((b) => b.toJSON());
}

interface BuildJSON {
    items: Item[];
    critChance: number;
    critDamageModifier: number;
    AD: number;
    armorPenetration: number;
    lethality: number;
    totalCost: number;
    bonusAD: number;
    bonusLethality: number;
    bonusCrit: number;
    name: string;
}

function deserializeBuilds(json: BuildJSON[]) {
    return json.map((b) => Build.fromJSON(b));
}

function CalculatorPage() {
    // Global state
    const [level, setLevel] = useState(1);
    const [builds, setBuilds] = useState<Build[]>([]);
    const [championId, setChampionId] = useState<ChampionId>("aphelios");
    const [champion, setChampion] = useState(() => createChampion("aphelios"));
    const [armorRange, setArmorRange] = useState<[number, number]>([0, 200]);
    const [isClient, setIsClient] = useState(false);
    const [showMargin, setShowMargin] = useState(false);
    const [stdDevMultiplier, setStdDevMultiplier] = useState(1);
    const [percentileRange, setPercentileRange] = useState(34); // ±34% for 1 std dev
    const [numAutoAttacks, setNumAutoAttacks] = useState(5); // Realistic for typical engagement
    const [absoluteFocus, setAbsoluteFocus] = useState(false);
    const [gatheringStormMinutes, setGatheringStormMinutes] = useState(0);
    const [targetBonusHP, setTargetBonusHP] = useState(0); // For LDR Giant Slayer calculation
    const [targetBonusHPRangeMode, setTargetBonusHPRangeMode] = useState(false); // Toggle for range mode
    const [targetBonusHPMax, setTargetBonusHPMax] = useState(1500); // Max value for range mode
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

    // Only run client-side code
    useEffect(() => {
        setIsClient(true);

        // Helper function to handle imported builds
        const handleImportedBuilds = (
            importedBuilds: Build[],
            importedLevel?: number,
            importedAbsoluteFocus?: boolean,
            importedGatheringStormMinutes?: number,
            importedChampionId?: ChampionId,
            importedDravenQEnabled?: boolean,
            importedDravenQLevel?: number,
            importedDravenQLevelLinked?: boolean
        ) => {
            setUrlImportBuilds(importedBuilds);
            setUrlImportChampionLevel(importedLevel ?? null);
            setUrlImportAbsoluteFocus(importedAbsoluteFocus ?? null);
            setUrlImportGatheringStormMinutes(importedGatheringStormMinutes ?? null);
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
                const {
                    level,
                    builds: savedBuilds,
                    armorRange,
                    showMargin: savedShowMargin,
                    stdDevMultiplier: savedStdDev,
                    percentileRange: savedPercentile,
                    numAutoAttacks: savedNumAutoAttacks,
                    absoluteFocus: savedAbsoluteFocus,
                    gatheringStormMinutes: savedGatheringStormMinutes,
                    targetBonusHP: savedTargetBonusHP,
                    targetBonusHPRangeMode: savedTargetBonusHPRangeMode,
                    targetBonusHPMax: savedTargetBonusHPMax,
                    championId: savedChampionId,
                    dravenQEnabled: savedDravenQEnabled,
                    dravenQLevel: savedDravenQLevel,
                    dravenQLevelLinked: savedDravenQLevelLinked,
                    championPanelCompact: savedChampionPanelCompact,
                } = JSON.parse(savedState);
                // Only load level if we didn't auto-import from URL
                if (level && !autoImportedRef.current) {
                    setLevel(level);
                }
                if (armorRange) setArmorRange(armorRange);
                // Only load builds if we didn't auto-import from URL
                if (savedBuilds && !autoImportedRef.current) {
                    setBuilds(deserializeBuilds(savedBuilds));
                }
                if (savedShowMargin !== undefined) setShowMargin(savedShowMargin);
                if (savedStdDev) setStdDevMultiplier(savedStdDev);
                if (savedPercentile) setPercentileRange(savedPercentile);
                if (savedNumAutoAttacks) setNumAutoAttacks(savedNumAutoAttacks);
                if (savedAbsoluteFocus !== undefined)
                    setAbsoluteFocus(savedAbsoluteFocus);
                if (savedGatheringStormMinutes !== undefined)
                    setGatheringStormMinutes(savedGatheringStormMinutes);
                if (savedTargetBonusHP !== undefined)
                    setTargetBonusHP(savedTargetBonusHP);
                if (savedTargetBonusHPRangeMode !== undefined)
                    setTargetBonusHPRangeMode(savedTargetBonusHPRangeMode);
                if (savedTargetBonusHPMax !== undefined)
                    setTargetBonusHPMax(savedTargetBonusHPMax);
                // Load champion
                if (
                    savedChampionId &&
                    (savedChampionId === "aphelios" || savedChampionId === "draven")
                ) {
                    setChampionId(savedChampionId);
                    setChampion(createChampion(savedChampionId));
                }
                // Load Draven Q settings
                if (savedDravenQEnabled !== undefined)
                    setDravenQEnabled(savedDravenQEnabled);
                if (savedDravenQLevel !== undefined) setDravenQLevel(savedDravenQLevel);
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

    // Save state to localStorage whenever level, builds, or armorRange changes.
    useEffect(() => {
        if (isClient) {
            const stateToSave = {
                level,
                armorRange,
                builds: serializeBuilds(builds),
                showMargin,
                stdDevMultiplier,
                percentileRange,
                numAutoAttacks,
                absoluteFocus,
                gatheringStormMinutes,
                targetBonusHP,
                targetBonusHPRangeMode,
                targetBonusHPMax,
                championId,
                dravenQEnabled,
                dravenQLevel: dravenQLevelLinked
                    ? getQRankFromChampLevel(level)
                    : dravenQLevel,
                dravenQLevelLinked,
                championPanelCompact,
            };
            localStorage.setItem("calculatorState", JSON.stringify(stateToSave));
        }
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
        targetBonusHP,
        targetBonusHPRangeMode,
        targetBonusHPMax,
        championId,
        dravenQEnabled,
        dravenQLevel,
        dravenQLevelLinked,
        championPanelCompact,
        isClient,
    ]);

    // Functions to update state
    function handleLevelChange(newLevel: number) {
        if (newLevel < 1 || newLevel > 18) return;
        setLevel(newLevel);
        // Update Draven Q level if linked
        if (dravenQLevelLinked) {
            setDravenQLevel(getQRankFromChampLevel(newLevel));
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
        setTargetBonusHP(0);
        setTargetBonusHPRangeMode(false);
        setTargetBonusHPMax(1500);
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

    if (!isClient) return null;

    return (
        <div className="appContainer">
            <div className="headerContainer">
                <div className="headerTop">
                    <div className="headerTitleRow">
                        <Navigation className="header-nav" />
                        <h1>{CHAMPIONS[championId].name} Damage Calculator</h1>
                    </div>
                    <div className="headerActions">
                        <button className="reset-all-button" onClick={handleResetAll}>
                            Reset All
                        </button>
                    </div>
                </div>
            </div>

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
                                <div className="compactControls" onClick={(e) => e.stopPropagation()}>
                                    <label className="levelLabelCompact">
                                        Lvl
                                        <input
                                            type="number"
                                            min={1}
                                            max={18}
                                            value={level}
                                            onChange={(e) => handleLevelChange(+e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="numberInputCompact"
                                        />
                                    </label>
                                    {championId === "draven" && (
                                        <label className="dravenCheckboxLabelCompact">
                                            Axe
                                            <input
                                                type="checkbox"
                                                checked={dravenQEnabled}
                                                onChange={(e) => setDravenQEnabled(e.target.checked)}
                                            />
                                        </label>
                                    )}
                                    <label className="runeCheckboxLabelCompact">
                                        AF
                                        <input
                                            type="checkbox"
                                            checked={absoluteFocus}
                                            onChange={(e) =>
                                                setAbsoluteFocus(e.target.checked)
                                            }
                                        />
                                    </label>
                                    <label className="runeInputLabelCompact">
                                        GS
                                        <input
                                            type="number"
                                            step={10}
                                            value={gatheringStormMinutes}
                                            onChange={(e) => {
                                                const value = Number(e.target.value) || 0;
                                                setGatheringStormMinutes(value);
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className="numberInputCompact"
                                        />
                                    </label>
                                </div>
                            )}
                            <span className="compactIndicator">
                                {championPanelCompact ? "▼" : "▲"}
                            </span>
                        </div>
                        {!championPanelCompact && (
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
                                        onChange={(e) =>
                                            handleLevelChange(+e.target.value)
                                        }
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
                                                    setDravenQLevel(
                                                        Number(e.target.value)
                                                    );
                                                    setDravenQLevelLinked(false);
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
                        )}
                        {!championPanelCompact && (
                            <div className="runeSettings">
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
                                                const value = Math.max(
                                                    0,
                                                    Number(e.target.value)
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
                        )}
                    </div>
                    <BuildPanel
                        builds={builds}
                        setBuilds={setBuildsWithAnimationControl}
                        championLevel={level}
                        championId={championId}
                        champion={champion}
                        absoluteFocus={absoluteFocus}
                        gatheringStormMinutes={gatheringStormMinutes}
                        dravenQEnabled={dravenQEnabled}
                        dravenQLevel={effectiveDravenQLevel}
                        dravenQLevelLinked={dravenQLevelLinked}
                        urlImportBuilds={urlImportBuilds}
                        urlImportChampionLevel={urlImportChampionLevel}
                        urlImportAbsoluteFocus={urlImportAbsoluteFocus}
                        urlImportGatheringStormMinutes={urlImportGatheringStormMinutes}
                        urlImportChampionId={urlImportChampionId}
                        urlImportDravenQEnabled={urlImportDravenQEnabled}
                        urlImportDravenQLevel={urlImportDravenQLevel}
                        urlImportDravenQLevelLinked={urlImportDravenQLevelLinked}
                        onUrlImportHandled={() => {
                            setUrlImportBuilds(null);
                            setUrlImportChampionLevel(null);
                            setUrlImportAbsoluteFocus(null);
                            setUrlImportGatheringStormMinutes(null);
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
                            setGatheringStormMinutes(importedMinutes);
                        }}
                        onChampionImport={(importedChampionId) => {
                            handleChampionChange(importedChampionId);
                        }}
                        onDravenQEnabledImport={(importedDravenQEnabled) => {
                            setDravenQEnabled(importedDravenQEnabled);
                        }}
                        onDravenQLevelImport={(importedDravenQLevel) => {
                            setDravenQLevel(importedDravenQLevel);
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
                        targetBonusHP={targetBonusHP}
                        targetBonusHPRangeMode={targetBonusHPRangeMode}
                        targetBonusHPMax={targetBonusHPMax}
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
                                        onChange={(e) =>
                                            setArmorRange(([, end]) => [
                                                +e.target.value,
                                                end,
                                            ])
                                        }
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
                                        onChange={(e) =>
                                            setArmorRange(([start]) => [
                                                start,
                                                +e.target.value,
                                            ])
                                        }
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

                        <div className="targetBonusHPContainer">
                            <div className="targetBonusHPSingleLine">
                                <span className="targetBonusHPTitle">
                                    Target HP
                                    <span
                                        className="tooltipIcon"
                                        title="HP items typically give 300-400 HP each. Giant Slayer deals up to 15% bonus physical damage based on target's bonus HP (max at 1500)."
                                    >
                                        ⓘ
                                    </span>
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
                                {targetBonusHPRangeMode ? (
                                    <>
                                        <input
                                            type="number"
                                            min={0}
                                            max={1500}
                                            value={targetBonusHP}
                                            onChange={(e) => {
                                                const newMin = Math.max(
                                                    0,
                                                    Math.min(1500, Number(e.target.value))
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
                                                    const newMin = Number(e.target.value);
                                                    setTargetBonusHP(
                                                        Math.min(newMin, targetBonusHPMax)
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
                                                    const newMax = Number(e.target.value);
                                                    setTargetBonusHPMax(
                                                        Math.max(newMax, targetBonusHP)
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
                                                const newMax = Math.max(
                                                    0,
                                                    Math.min(1500, Number(e.target.value))
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
                                            onChange={(e) =>
                                                setTargetBonusHP(Number(e.target.value))
                                            }
                                            className="targetBonusHPSlider singleSlider"
                                        />
                                        <input
                                            type="number"
                                            min={0}
                                            max={1500}
                                            value={targetBonusHP}
                                            onChange={(e) =>
                                                setTargetBonusHP(
                                                    Math.max(
                                                        0,
                                                        Math.min(
                                                            1500,
                                                            Number(e.target.value)
                                                        )
                                                    )
                                                )
                                            }
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
