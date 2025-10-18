import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Build } from "../classes/Build";
import { Champion } from "../classes/Champion";
import {
    calculateSingleAutoDamage,
    calculateDamageWithMargin,
} from "../classes/Calculator";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler
);

interface DamageChartProps {
    builds: Build[];
    champion: Champion;
    level: number;
    armorRange: [number, number];
    step: number;
    showMargin: boolean;
    stdDevMultiplier: number;
    numAutoAttacks: number;
}

const DamageChart: React.FC<DamageChartProps> = ({
    builds,
    champion,
    level,
    armorRange,
    step,
    showMargin,
    stdDevMultiplier,
    numAutoAttacks,
}) => {
    // Calculate max Y value for fixed axis range
    const maxYValue = useMemo(() => {
        if (builds.length === 0) return 100;

        // Find max damage at armor=0 (highest damage point) across all builds
        let maxDamage = 0;
        builds.forEach((build) => {
            const AD = champion.getAD(level) + build.AD;
            const armorModifier = 100 / 100; // armor=0
            const critDamage = AD * build.critDamageModifier * armorModifier;
            maxDamage = Math.max(maxDamage, critDamage);
        });

        // Add 10% padding to the top
        return maxDamage * 1.1;
    }, [builds, champion, level]);

    // Memoize calculations to ensure they recalculate when dependencies change
    const chartData = useMemo(() => {
        // Generate damage data for a build
        function getDamageDataForBuild(build: Build) {
            const results = [] as { armor: number; damage: number }[];
            for (let armor = armorRange[0]; armor <= armorRange[1]; armor += step) {
                const dmg = calculateSingleAutoDamage(champion, armor, level, build);
                results.push({ armor, damage: dmg });
            }
            return results;
        }

        // Generate damage data with margin for a build
        function getDamageDataWithMargin(build: Build) {
            const results = [] as {
                armor: number;
                expected: number;
                lower: number;
                upper: number;
            }[];
            for (let armor = armorRange[0]; armor <= armorRange[1]; armor += step) {
                const range = calculateDamageWithMargin(
                    champion,
                    armor,
                    level,
                    build,
                    stdDevMultiplier,
                    numAutoAttacks
                );
                results.push({ armor, ...range });
            }
            return results;
        }

        // Create labels for the x-axis
        const labels: number[] = [];
        for (let armor = armorRange[0]; armor <= armorRange[1]; armor += step) {
            labels.push(armor);
        }

        // Create datasets
        const datasets: Array<{
            label: string;
            data: number[];
            borderColor: string;
            backgroundColor: string;
            fill?: boolean | number;
            tension?: number;
            pointRadius?: number;
            pointHoverRadius?: number;
            pointHitRadius?: number;
            borderWidth?: number;
            hidden?: boolean;
            order?: number;
        }> = [];

        if (showMargin) {
            // When showing margin, create three datasets per build: upper bound, lower bound, main line
            builds.forEach((build, index) => {
                const data = getDamageDataWithMargin(build);
                const color = `hsl(${index * 100}, 70%, 50%)`;
                const colorTransparent = `hsla(${index * 100}, 70%, 50%, 0.15)`;
                const upperDatasetIndex = datasets.length;

                // Upper bound (invisible line - top of the band)
                datasets.push({
                    label: `${build.name} (upper)`,
                    data: data.map((d) => d.upper),
                    borderColor: "transparent",
                    backgroundColor: "transparent",
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointHitRadius: 0,
                    tension: 0,
                    fill: false,
                    hidden: false,
                    order: index * 3,
                });

                // Lower bound (invisible line - fills UP to upper bound creating the band)
                datasets.push({
                    label: `${build.name} (lower)`,
                    data: data.map((d) => d.lower),
                    borderColor: "transparent",
                    backgroundColor: colorTransparent,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointHitRadius: 0,
                    tension: 0,
                    fill: upperDatasetIndex, // Fill to the upper bound dataset
                    hidden: false,
                    order: index * 3 + 1,
                });

                // Expected damage (main visible line - SOLID, NO fill)
                datasets.push({
                    label: `${build.name}`,
                    data: data.map((d) => d.expected),
                    borderColor: color,
                    backgroundColor: color,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    tension: 0,
                    pointHitRadius: 40,
                    pointHoverRadius: 4,
                    fill: false,
                    order: index * 3 + 2,
                });
            });
        } else {
            // When not showing margin, use simple datasets
            builds.forEach((build, index) => {
                datasets.push({
                    label: `${build.name}`,
                    data: getDamageDataForBuild(build).map((d) => d.damage),
                    borderColor: `hsl(${index * 100}, 70%, 50%)`,
                    backgroundColor: `hsl(${index * 100}, 70%, 50%)`,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    tension: 0,
                    pointHitRadius: 40,
                    pointHoverRadius: 4,
                });
            });
        }

        return {
            labels,
            datasets,
        };
    }, [
        builds,
        champion,
        level,
        armorRange,
        step,
        showMargin,
        stdDevMultiplier,
        numAutoAttacks,
    ]);

    return (
        <div className="chartContainer">
            <Line
                data={chartData}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 300,
                    },
                    interaction: {
                        mode: "index",
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                filter: (item) => {
                                    // Hide upper/lower bound labels from legend
                                    return (
                                        !item.text.includes("(upper)") &&
                                        !item.text.includes("(lower)")
                                    );
                                },
                            },
                        },
                        title: {
                            display: true,
                            text: "Single-Auto Damage vs. Armor",
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const label = context.dataset.label || "";
                                    if (
                                        label.includes("(upper)") ||
                                        label.includes("(lower)")
                                    ) {
                                        return ""; // Don't show tooltip for bounds
                                    }
                                    return `${label}: ${context.parsed.y.toFixed(2)}`;
                                },
                            },
                            filter: (item) => {
                                // Only show tooltip for main lines
                                const label = item.dataset.label || "";
                                return (
                                    !label.includes("(upper)") &&
                                    !label.includes("(lower)")
                                );
                            },
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
                            max: maxYValue,
                            title: {
                                display: true,
                                text: "Expected Damage per Auto",
                            },
                            ticks: {
                                callback: function (value, index, ticks) {
                                    // Hide the last (top) tick label
                                    if (index === ticks.length - 1) {
                                        return "";
                                    }
                                    return value;
                                },
                            },
                        },
                    },
                }}
            />
        </div>
    );
};

export default DamageChart;
