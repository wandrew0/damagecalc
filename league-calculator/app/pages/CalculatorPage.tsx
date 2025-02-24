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
    const step = 1;

    // Only run client-side code
    useEffect(() => {
        setIsClient(true);
        const savedState = localStorage.getItem("calculatorState");
        if (savedState) {
            try {
                const { level, builds: savedBuilds, armorRange } = JSON.parse(savedState);
                if (level) setLevel(level);
                if (armorRange) setArmorRange(armorRange);
                if (savedBuilds) setBuilds(deserializeBuilds(savedBuilds));
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
            };
            localStorage.setItem("calculatorState", JSON.stringify(stateToSave));
        }
    }, [level, armorRange, builds, isClient]);

    // Functions to update state
    function handleLevelChange(newLevel: number) {
        if (newLevel < 1 || newLevel > 18) return;
        setLevel(newLevel);
    }

    function handleResetAll() {
        setLevel(1);
        setBuilds([]);
        setArmorRange([0, 200]);
        localStorage.removeItem("calculatorState");
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
                        <span className="base-ad">Base AD: {champion.getAD(level)}</span>
                    </div>
                </div>
            </div>

            <div className="mainContent">
                {/* Left-side: Build Panel */}
                <BuildPanel builds={builds} setBuilds={setBuilds} />

                {/* Right-side: Chart / Graph Section */}
                <div className="graphSection globalSettings">
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
                                    setArmorRange(([start]) => [start, +e.target.value])
                                }
                            />
                        </label>
                    </div>
                    <DamageChart
                        builds={builds}
                        champion={champion}
                        level={level}
                        armorRange={armorRange}
                        step={step}
                    />
                </div>
            </div>
        </div>
    );
}

export default CalculatorPage;
