"use client";

import React, { useEffect, useState, useRef } from "react";
import "../styles/CalculatorPage.css";

import { Champion } from "../classes/Champion";
import { Build } from "../classes/Build";
import { Item } from "../classes/Item";

import BuildPanel from "../components/BuildPanel";
import DamageChart from "../components/DamageChart";
import Navigation from "../components/Navigation";
import { decodeBuilds, decodeBuildsLegacy } from "../utils/encoder";
import {
    getAbsoluteFocusAD,
    getGatheringStormAD,
    getTotalAD,
} from "../classes/Calculator";

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
    const [champion] = useState(new Champion("Aphelios", 55, 2.3));
    const [armorRange, setArmorRange] = useState<[number, number]>([0, 200]);
    const [isClient, setIsClient] = useState(false);
    const [showMargin, setShowMargin] = useState(false);
    const [stdDevMultiplier, setStdDevMultiplier] = useState(1);
    const [percentileRange, setPercentileRange] = useState(34); // ±34% for 1 std dev
    const [numAutoAttacks, setNumAutoAttacks] = useState(5); // Realistic for typical engagement
    const [absoluteFocus, setAbsoluteFocus] = useState(false);
    const [gatheringStormMinutes, setGatheringStormMinutes] = useState(0);
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
    const [disableChartAnimation, setDisableChartAnimation] = useState(false);
    const autoImportedRef = useRef(false);
    const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const previousBuildsRef = useRef<Build[]>([]);
    const step = 1;

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

        // Helper function to check if user has existing builds
        const hasExistingBuildsInStorage = (): boolean => {
            const savedState = localStorage.getItem("calculatorState");
            if (!savedState) return false;

            try {
                const { builds: savedBuilds } = JSON.parse(savedState);
                return savedBuilds && savedBuilds.length > 0;
            } catch (error) {
                console.error("Error parsing saved state:", error);
                return false;
            }
        };

        // Helper function to handle imported builds
        const handleImportedBuilds = (
            importedBuilds: Build[],
            importedLevel?: number
        ) => {
            if (!hasExistingBuildsInStorage()) {
                setBuilds(importedBuilds);
                if (importedLevel) {
                    setLevel(importedLevel);
                }
                autoImportedRef.current = true;
            } else {
                setUrlImportBuilds(importedBuilds);
                setUrlImportChampionLevel(importedLevel || null);
            }
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
                        } = decodeBuilds(encoded);
                        handleImportedBuilds(importedBuilds, importedLevel);
                        if (importedAbsoluteFocus !== undefined) {
                            setUrlImportAbsoluteFocus(importedAbsoluteFocus);
                        }
                        if (importedGatheringStormMinutes !== undefined) {
                            setUrlImportGatheringStormMinutes(
                                importedGatheringStormMinutes
                            );
                        }
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
        isClient,
    ]);

    // Functions to update state
    function handleLevelChange(newLevel: number) {
        if (newLevel < 1 || newLevel > 18) return;
        setLevel(newLevel);
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
        localStorage.removeItem("calculatorState");
    }

    // Convert std dev to approximate percentile range
    function stdDevToPercentile(stdDev: number): number {
        // For normal distribution approximation
        // 1σ ≈ 68% CI → ±34%
        // 2σ ≈ 95% CI → ±47.5%
        // 3σ ≈ 99.7% CI → ±49.85%
        const percentage = (1 - Math.exp((-stdDev * stdDev) / 2)) * 50;
        return Math.round(percentage);
    }

    // Convert percentile range to approximate std dev
    function percentileToStdDev(percentile: number): number {
        // Inverse of above - approximate
        const ratio = percentile / 50;
        const stdDev = Math.sqrt(-2 * Math.log(1 - ratio));
        return stdDev;
    }

    function handleStdDevChange(newStdDev: number) {
        setStdDevMultiplier(newStdDev);
        setPercentileRange(stdDevToPercentile(newStdDev));
    }

    function handlePercentileChange(newPercentile: number) {
        setPercentileRange(newPercentile);
        setStdDevMultiplier(percentileToStdDev(newPercentile));
    }

    if (!isClient) return null;

    return (
        <div className="appContainer">
            <div className="headerContainer">
                <div className="headerTop">
                    <div className="headerTitleRow">
                        <Navigation className="header-nav" />
                        <h1>Aphelios Damage Calculator</h1>
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
                    <div className="globalSettings">
                        <label>
                            Level:{" "}
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
                                    onChange={(e) => handleLevelChange(+e.target.value)}
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
                        <div className="champ-stats">
                            Base AD: {champion.getAD(level).toFixed(2)}
                        </div>
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
                    </div>
                    <BuildPanel
                        builds={builds}
                        setBuilds={setBuildsWithAnimationControl}
                        championLevel={level}
                        champion={champion}
                        absoluteFocus={absoluteFocus}
                        gatheringStormMinutes={gatheringStormMinutes}
                        urlImportBuilds={urlImportBuilds}
                        urlImportChampionLevel={urlImportChampionLevel}
                        urlImportAbsoluteFocus={urlImportAbsoluteFocus}
                        urlImportGatheringStormMinutes={urlImportGatheringStormMinutes}
                        autoImported={autoImportedRef.current}
                        onUrlImportHandled={() => {
                            setUrlImportBuilds(null);
                            setUrlImportChampionLevel(null);
                            setUrlImportAbsoluteFocus(null);
                            setUrlImportGatheringStormMinutes(null);
                        }}
                        onChampionLevelImport={(importedLevel) => {
                            setLevel(importedLevel);
                        }}
                        onAbsoluteFocusImport={(importedAbsoluteFocus) => {
                            setAbsoluteFocus(importedAbsoluteFocus);
                        }}
                        onGatheringStormImport={(importedMinutes) => {
                            setGatheringStormMinutes(importedMinutes);
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
                        disableAnimation={disableChartAnimation}
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
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CalculatorPage;
