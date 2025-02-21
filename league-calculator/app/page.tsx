"use client"; // If you're using Next.js 13+ and want this file to be a client component

import React, { useState } from "react";
import "./page.css";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

// REGISTER CHART COMPONENTS
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

/* ==============================
   =         OOP CLASSES        =
   ============================== */

class Champion {
    name: string;
    level: number;
    baseADByLevel: number[];
    bonusAD: number;
    critChance: number;
    critDamageModifier: number;
    apheliosPassiveBonus: number;

    constructor(name: string, baseADByLevel: number[]) {
        this.name = name;
        this.level = 1;
        this.baseADByLevel = baseADByLevel;
        this.bonusAD = 0;
        this.critChance = 0;
        this.critDamageModifier = 1.75;
        this.apheliosPassiveBonus = 0;
    }

    getAD(): number {
        const baseAD = this.baseADByLevel[this.level - 1] || this.baseADByLevel[0];
        return baseAD + this.bonusAD + this.apheliosPassiveBonus;
    }
}

class Item {
    name: string;
    cost: number;
    flatAD: number;
    critChance: number;
    infinityEdgeBonus?: boolean;

    constructor(
        name: string,
        cost: number,
        flatAD: number,
        critChance: number,
        infinityEdgeBonus: boolean = false
    ) {
        this.name = name;
        this.cost = cost;
        this.flatAD = flatAD;
        this.critChance = critChance;
        this.infinityEdgeBonus = infinityEdgeBonus;
    }

    applyToChampion(champ: Champion) {
        champ.bonusAD += this.flatAD;
        champ.critChance = Math.min(champ.critChance + this.critChance, 1);

        // Infinity Edge logic (simplified example):
        // If champion has at least 40% crit, increase crit damage from 1.75 to 2.1
        if (this.infinityEdgeBonus && champ.critChance >= 0.4) {
            champ.critDamageModifier = 2.1;
        }
    }
}

class Build {
    items: Item[] = [];

    addItem(item: Item) {
        this.items.push(item);
    }

    getTotalCost(): number {
        return this.items.reduce((acc, it) => acc + it.cost, 0);
    }

    applyToChampion(champ: Champion) {
        for (const item of this.items) {
            item.applyToChampion(champ);
        }
    }
}

/* ==============================
   =     DAMAGE CALCULATOR      =
   ============================== */

function calculateSingleAutoDamage(champ: Champion, targetArmor: number): number {
    const rawAD = champ.getAD();
    const critMultiplier =
        1 - champ.critChance + champ.critChance * champ.critDamageModifier;
    const armorModifier = 100 / (100 + targetArmor);
    return rawAD * critMultiplier * armorModifier;
}

/* ==============================
   =          DATA SETS         =
   ============================== */

const apheliosBaseADByLevel = [
    57, 59.4, 61.8, 64.2, 66.6, 69, 71.4, 73.8, 76.2, 78.6, 81, 83.4, 85.8, 88.2, 90.6,
    93, 95.4, 97.8,
];

// Some example items
const ALL_ITEMS: Item[] = [
    new Item("Long Sword", 350, 10, 0),
    new Item("Pickaxe", 875, 25, 0),
    new Item("B. F. Sword", 1300, 40, 0),
    new Item("Cloak of Agility", 600, 0, 0.15),
    new Item("Infinity Edge", 3400, 70, 0.2, true),
];

/* ==============================
   =          COMPONENT         =
   ============================== */

function App() {
    const [builds, setBuilds] = useState<
        { buildName: string; level: number; selectedItemNames: string[] }[]
    >([
        { buildName: "Build A", level: 1, selectedItemNames: [] },
        { buildName: "Build B", level: 1, selectedItemNames: [] },
    ]);

    const [armorRange, setArmorRange] = useState<[number, number]>([0, 200]);

    function handleAddItem(buildIndex: number, itemName: string) {
        setBuilds((prev) => {
            const newBuilds = [...prev];
            newBuilds[buildIndex].selectedItemNames.push(itemName);
            return newBuilds;
        });
    }

    function handleRemoveItem(buildIndex: number, itemName: string) {
        setBuilds((prev) => {
            const newBuilds = [...prev];
            newBuilds[buildIndex].selectedItemNames = newBuilds[
                buildIndex
            ].selectedItemNames.filter((name) => name !== itemName);
            return newBuilds;
        });
    }

    function handleLevelChange(buildIndex: number, newLevel: number) {
        setBuilds((prev) => {
            const newBuilds = [...prev];
            newBuilds[buildIndex].level = newLevel;
            return newBuilds;
        });
    }

    function getDamageDataForBuild(buildData: {
        buildName: string;
        level: number;
        selectedItemNames: string[];
    }) {
        const champ = new Champion("Aphelios", apheliosBaseADByLevel);
        champ.level = buildData.level;

        const b = new Build();
        for (const itemName of buildData.selectedItemNames) {
            const foundItem = ALL_ITEMS.find((i) => i.name === itemName);
            if (foundItem) b.addItem(foundItem);
        }
        b.applyToChampion(champ);

        const results: { armor: number; damage: number }[] = [];
        const [startArmor, endArmor] = armorRange;
        const step = 20;

        for (let armor = startArmor; armor <= endArmor; armor += step) {
            results.push({ armor, damage: calculateSingleAutoDamage(champ, armor) });
        }

        return results;
    }

    const chartData = {
        labels: (() => {
            const [startArmor, endArmor] = armorRange;
            const step = 20;
            const labels: number[] = [];
            for (let armor = startArmor; armor <= endArmor; armor += step) {
                labels.push(armor);
            }
            return labels;
        })(),
        datasets: builds.map((build, idx) => {
            const damageData = getDamageDataForBuild(build);
            return {
                label: build.buildName,
                data: damageData.map((point) => point.damage),
                borderColor: `hsl(${idx * 100}, 70%, 50%)`,
                backgroundColor: `hsl(${idx * 100}, 70%, 50%)`,
            };
        }),
    };

    // For the "Damage at 100 Armor" & "Damage per Gold" display
    const SINGLE_ARMOR_CHECK = 100;

    return (
        <div className="appContainer">
            <h1>Aphelios Damage Calculator</h1>

            <div className="buildPanelContainer">
                {builds.map((build, buildIndex) => {
                    const champ = new Champion("Aphelios", apheliosBaseADByLevel);
                    champ.level = build.level;

                    const b = new Build();
                    for (const itemName of build.selectedItemNames) {
                        const foundItem = ALL_ITEMS.find((i) => i.name === itemName);
                        if (foundItem) b.addItem(foundItem);
                    }
                    b.applyToChampion(champ);

                    const dmgAt100Armor = calculateSingleAutoDamage(
                        champ,
                        SINGLE_ARMOR_CHECK
                    );
                    const totalGold = b.getTotalCost();
                    const dmgPerGold = totalGold > 0 ? dmgAt100Armor / totalGold : 0;

                    return (
                        <div key={buildIndex} className="buildPanel">
                            <h2>{build.buildName}</h2>

                            <label>
                                Level:{" "}
                                <input
                                    type="number"
                                    min={1}
                                    max={18}
                                    value={build.level}
                                    onChange={(e) =>
                                        handleLevelChange(buildIndex, +e.target.value)
                                    }
                                />
                            </label>

                            <h3>Items:</h3>
                            <ul>
                                {build.selectedItemNames.map((itemName, idx2) => (
                                    <li key={idx2}>
                                        {itemName}{" "}
                                        <button
                                            onClick={() =>
                                                handleRemoveItem(buildIndex, itemName)
                                            }
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            <select
                                onChange={(e) => {
                                    if (e.target.value !== "") {
                                        handleAddItem(buildIndex, e.target.value);
                                        e.target.value = "";
                                    }
                                }}
                                defaultValue=""
                            >
                                <option value="" disabled>
                                    Select an item...
                                </option>
                                {ALL_ITEMS.map((item, iidx) => (
                                    <option key={iidx} value={item.name}>
                                        {item.name} ({item.cost}g)
                                    </option>
                                ))}
                            </select>

                            <div className="itemList">
                                <p>
                                    <strong>Total Gold:</strong> {totalGold}
                                </p>
                                <p>
                                    <strong>Damage @ 100 Armor:</strong>{" "}
                                    {dmgAt100Armor.toFixed(2)}
                                </p>
                                <p>
                                    <strong>Damage per Gold:</strong>{" "}
                                    {dmgPerGold > 0 ? dmgPerGold.toFixed(3) : "0.000"}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <hr className="divider" />

            <div className="armorRangeContainer">
                <label className="armorInputLabel">
                    Armor Range Start:
                    <input
                        className="armorInput"
                        type="number"
                        value={armorRange[0]}
                        onChange={(e) =>
                            setArmorRange((prev) => [+e.target.value, prev[1]])
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
                            setArmorRange((prev) => [prev[0], +e.target.value])
                        }
                    />
                </label>
            </div>

            <div className="chartContainer">
                <Line
                    data={chartData}
                    options={{
                        responsive: true,
                        plugins: {
                            legend: { position: "bottom" as const },
                            title: {
                                display: true,
                                text: "Single-Auto Damage vs. Armor",
                            },
                        },
                        scales: {
                            x: {
                                title: { display: true, text: "Target Armor" },
                            },
                            y: {
                                beginAtZero: true,
                                title: { display: true, text: "Damage per Auto" },
                            },
                        },
                    }}
                />
            </div>
        </div>
    );
}

export default App;
