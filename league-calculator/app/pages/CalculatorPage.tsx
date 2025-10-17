"use client";

import React, { useEffect, useState } from "react";
import "../styles/CalculatorPage.css";

import { Champion } from "../classes/Champion";
import { Build } from "../classes/Build";
import { Item } from "../classes/Item";

import BuildPanel from "../components/BuildPanel";
import DamageChart from "../components/DamageChart";

function serializeBuilds(builds: Build[]) {
    return builds.map((b) => b.toJSON());
}

function deserializeBuilds(
    json: {
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
    }[]
) {
    return json.map(
        (b: {
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
        }) => Build.fromJSON(b)
    );
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
    const step = 1;

    // Only run client-side code
    useEffect(() => {
        setIsClient(true);
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
                } = JSON.parse(savedState);
                if (level) setLevel(level);
                if (armorRange) setArmorRange(armorRange);
                if (savedBuilds) setBuilds(deserializeBuilds(savedBuilds));
                if (savedShowMargin !== undefined) setShowMargin(savedShowMargin);
                if (savedStdDev) setStdDevMultiplier(savedStdDev);
                if (savedPercentile) setPercentileRange(savedPercentile);
                if (savedNumAutoAttacks) setNumAutoAttacks(savedNumAutoAttacks);
            } catch (error) {
                console.error("Error loading saved state:", error);
            }
        }
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
                    <h1>Aphelios Damage Calculator</h1>
                    <button className="reset-all-button" onClick={handleResetAll}>
                        Reset All
                    </button>
                </div>
            </div>

            <div className="mainContent">
                {/* Left Column: Champion Settings + Build Panel */}
                <div className="leftColumn">
                    <div className="globalSettings">
                        <label>
                            Level:{" "}
                            <input
                                type="number"
                                min={1}
                                max={18}
                                value={level}
                                onChange={(e) => handleLevelChange(+e.target.value)}
                                onFocus={(e) => e.target.select()}
                            />
                        </label>
                        <div className="champ-stats">
                            Base AD: {champion.getAD(level).toFixed(2)}
                        </div>
                    </div>
                    <BuildPanel builds={builds} setBuilds={setBuilds} />
                </div>

                {/* Right Column: Graph Section */}
                <div className="graphSection">
                    <div className="globalSettings">
                        <div className="armorRangeContainer">
                            <label className="armorInputLabel">
                                Armor Range Start:
                                <input
                                    className="armorInput"
                                    type="number"
                                    value={armorRange[0]}
                                    onChange={(e) =>
                                        setArmorRange(([, end]) => [+e.target.value, end])
                                    }
                                />
                            </label>
                            <label className="armorInputLabel">
                                Armor Range End:
                                <input
                                    className="armorInput"
                                    type="number"
                                    value={armorRange[1]}
                                    onChange={(e) =>
                                        setArmorRange(([start]) => [
                                            start,
                                            +e.target.value,
                                        ])
                                    }
                                />
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

                    <DamageChart
                        builds={builds}
                        champion={champion}
                        level={level}
                        armorRange={armorRange}
                        step={step}
                        showMargin={showMargin}
                        stdDevMultiplier={stdDevMultiplier}
                        numAutoAttacks={numAutoAttacks}
                    />
                </div>
            </div>
        </div>
    );
}

export default CalculatorPage;
