"use client";

import dynamic from "next/dynamic";
import React, { useEffect, useState } from "react";
import "./CalculatorPage.css";

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

import { Champion } from "./classes/Champion";
import { Build } from "./classes/Build";
import { calculateSingleAutoDamage } from "./classes/Calculator";
import { Item } from "./classes/Item";
import { ALL_ITEMS } from "./data/Items";

import Select from "react-select";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

ALL_ITEMS.sort((a, b) => b.AD - a.AD || b.critChance - a.critChance);
const itemOptions = ALL_ITEMS.map((item) => ({
    value: item,
    label: `${item.name} (${item.cost}g)`,
}));

function CalculatorPage() {
    // Global state for level
    const [level, setLevel] = useState(1);
    const [builds, setBuild] = useState([new Build()]);
    const [champion, setChampion] = useState(new Champion("Aphelios", 55, 2.3));
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const [armorRange, setArmorRange] = useState<[number, number]>([0, 200]);
    const step = 1;

    function handleAddItem(buildIndex: number, item: Item) {
        const newbuilds = [...builds];
        newbuilds[buildIndex].addItem(item);
        setBuild(newbuilds);
    }

    function handleRemoveItem(buildIndex: number, index: number) {
        const newbuilds = [...builds];
        newbuilds[buildIndex].removeItem(index);
        setBuild(newbuilds);
    }

    function handleLevelChange(newLevel: number) {
        setLevel(newLevel);
    }

    function getDamageDataForBuild(buildIndex: number) {
        const results = [] as { armor: number; damage: number }[];

        for (let armor = armorRange[0]; armor <= armorRange[1]; armor += step) {
            const dmg = calculateSingleAutoDamage(
                champion,
                armor,
                level,
                builds[buildIndex]
            );
            results.push({ armor, damage: dmg });
        }

        return results;
    }

    const chartData = {
        labels: (() => {
            const labels: number[] = [];
            for (let armor = armorRange[0]; armor <= armorRange[1]; armor += step) {
                labels.push(armor);
            }
            return labels;
        })(),
        datasets: builds.map((build, index) => {
            return {
                label: `Build ${index}`,
                data: getDamageDataForBuild(index).map((d) => d.damage),
                borderColor: `hsl(${index * 100}, 70%, 50%)`,
                backgroundColor: `hsl(${index * 100}, 70%, 50%)`,
                pointRadius: 0,
                pointHitRadius: 30,
                pointHoverRadius: 3,
                tension: 0,
                animation: {
                    duration: 0,
                },
            };
        }),
    };

    return (
        <div className="appContainer">
            <h1>Aphelios Damage Calculator</h1>
            {/* Global Level Setting */}
            <div className="globalSettings">
                <label>
                    Level:{" "}
                    <input
                        type="number"
                        min={1}
                        max={18}
                        value={level}
                        onChange={(e) => handleLevelChange(+e.target.value)}
                    />
                </label>
                <div className="champ-stats">
                    <span className="base-ad">Base AD: {champion.getAD(level)}</span>
                </div>
            </div>

            <div className="mainContent">
                {/* Build Panel on the Left */}
                <div className="buildPanelContainer">
                    {builds.map((build, buildIndex) => (
                        <div key={buildIndex} className="buildPanel">
                            <h1>{`Build ${buildIndex}`}</h1>
                            {/* Bonus Stats Section */}
                            <div className="bonusStats">
                                <h3>Bonus Stats</h3>
                                <div>
                                    <label>
                                        Bonus AD:{" "}
                                        <input
                                            type="number"
                                            value={build.bonusAD}
                                            onChange={(e) => {
                                                build.setBonusAD(+e.target.value);
                                                setBuild([...builds]);
                                            }}
                                        />
                                    </label>
                                </div>
                                <div>
                                    <label>
                                        Bonus Lethality:{" "}
                                        <input
                                            type="number"
                                            value={build.bonusLethality}
                                            onChange={(e) => {
                                                build.setBonusLethality(+e.target.value);
                                                setBuild([...builds]);
                                            }}
                                        />
                                    </label>
                                </div>
                                <div>
                                    <label>
                                        Bonus Crit:{" "}
                                        <input
                                            type="number"
                                            value={build.bonusCrit}
                                            onChange={(e) => {
                                                build.setBonusCrit(+e.target.value);
                                                setBuild([...builds]);
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                            <h3>Items:</h3>
                            <ul>
                                {build.items.map((item, idx2) => (
                                    <li key={idx2} className="item-entry">
                                        <div className="item-info">
                                            <div className="item-header">
                                                <div className="item-name">
                                                    {item.name}
                                                </div>
                                                <div className="item-cost">
                                                    {item.cost}g
                                                </div>
                                            </div>
                                            <div className="item-stats">
                                                <span className="item-ad">
                                                    AD: {item.AD}
                                                </span>
                                                <span className="item-crit">
                                                    Crit:{" "}
                                                    {(item.critChance * 100).toFixed(0)}%
                                                </span>
                                                <span className="item-armorPen">
                                                    Armor Pen: {item.armorPenetration}
                                                </span>
                                                <span className="item-lethality">
                                                    Lethality: {item.lethality}
                                                </span>
                                                {item.infinityEdgeBonus && (
                                                    <span className="item-IE">
                                                        +40% Crit Damage
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            className="remove-button"
                                            onClick={() =>
                                                handleRemoveItem(buildIndex, idx2)
                                            }
                                        >
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {isClient && (
                                <Select
                                    options={itemOptions}
                                    value={null}
                                    onChange={(e) => {
                                        if (e) {
                                            handleAddItem(buildIndex, e.value);
                                        }
                                    }}
                                />
                            )}
                            <div className="itemList">
                                <p>
                                    <strong>Build Stats:</strong> AD:{" "}
                                    {build.items.reduce((sum, item) => sum + item.AD, 0)}{" "}
                                    | Crit: {(build.critChance * 100).toFixed(0)}% | Armor
                                    Pen: {(build.armorPenetration * 100).toFixed(0)}% |
                                    Lethality: {build.lethality} | Crit Damage:{" "}
                                    {(build.critDamageModifier * 100).toFixed(0)}%
                                </p>
                                <p>
                                    <strong>Total Gold:</strong> {build.totalCost}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Graph Section on the Right */}
                <div className="graphSection globalSettings">
                    <div className="armorRangeContainer">
                        <label className="armorInputLabel">
                            Armor Range Start:
                            <input
                                className="armorInput"
                                type="number"
                                value={armorRange[0]}
                                onChange={(e) =>
                                    setArmorRange(([_, end]) => [+e.target.value, end])
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
                                        title: {
                                            display: true,
                                            text: "Target Armor",
                                        },
                                    },
                                    y: {
                                        beginAtZero: true,
                                        title: {
                                            display: true,
                                            text: "Expected Damage per Auto",
                                        },
                                    },
                                },
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CalculatorPage;
