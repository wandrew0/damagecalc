"use client";

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
import { Line } from "react-chartjs-2"; // use visx instead maybe ? or desmos xd

// Import classes and data
import { Champion } from "./classes/Champion";
import { Build } from "./classes/Build";
import { calculateSingleAutoDamage } from "./classes/Calculator";
import { Item } from "./classes/Item";
import { ALL_ITEMS } from "./data/Items";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function App() {
    // support multiple builds i guess
    const [builds, setBuild] = useState([new Build()]);
    const [level, setLevel] = useState(1);
    const [champion, setChampion] = useState(new Champion("Aphelios", 55, 2.3));

    // Armor range for chart
    const [armorRange, setArmorRange] = useState<[number, number]>([0, 200]);
    const step = 1; // step for X-axis

    // Handlers
    function handleAddItem(buildIndex: number, item: Item) {
        builds[buildIndex].addItem(item);
        setBuild(builds);
    }

    function handleRemoveItem(buildIndex: number, index: number) {
        builds[buildIndex].removeItem(index);
        setBuild(builds);
    }

    function handleLevelChange(buildIndex: number, newLevel: number) {
        setLevel(newLevel);
    }

    // Generate damage data for each build
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

    // For the chart, each build is a separate dataset
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
                label: "hi",
                data: getDamageDataForBuild(index).map((d) => d.damage),
                borderColor: `hsl(${0 * 100}, 70%, 50%)`,
                backgroundColor: `hsl(${0 * 100}, 70%, 50%)`,
            };
        }),
    };

    // Quick check: damage at 100 armor
    const SINGLE_ARMOR_CHECK = 100;

    return (
        <div className="appContainer">
            <h1>Aphelios Damage Calculator</h1>

            <div className="buildPanelContainer">
                {builds.map((build, buildIndex) => {
                    return (
                        <div key={buildIndex} className="buildPanel">
                            <h2>{`build ${buildIndex}`}</h2>
                            <label>
                                Level:{" "}
                                <input
                                    type="number"
                                    min={1}
                                    max={18}
                                    value={level}
                                    onChange={(e) =>
                                        handleLevelChange(buildIndex, +e.target.value)
                                    }
                                />
                            </label>

                            <h3>Items:</h3>
                            <ul>
                                {build.items.map((item, idx2) => (
                                    <li key={idx2}>
                                        {item.name}{" "}
                                        <button
                                            onClick={() =>
                                                handleRemoveItem(buildIndex, idx2)
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
                                        handleAddItem(
                                            buildIndex,
                                            ALL_ITEMS.find(
                                                (it) => it.name === e.target.value
                                            )!
                                        );
                                        e.target.value = "";
                                    }
                                }}
                                defaultValue=""
                            >
                                <option value="" disabled>
                                    Select an item...
                                </option>
                                {ALL_ITEMS.map((item) => (
                                    <option key={item.name} value={item.name}>
                                        {item.name} ({item.cost}g)
                                    </option>
                                ))}
                            </select>

                            <div className="itemList">
                                <p>
                                    <strong>Total Gold:</strong> {build.totalCost}
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
                                    text: "Damage per Auto",
                                },
                            },
                        },
                    }}
                />
            </div>
        </div>
    );
}

export default App;
