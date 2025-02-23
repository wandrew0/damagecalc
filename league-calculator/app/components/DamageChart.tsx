import React from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
} from "chart.js";
import { Build } from "../classes/Build";
import { Champion } from "../classes/Champion";
import { calculateSingleAutoDamage } from "../classes/Calculator";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface DamageChartProps {
    builds: Build[];
    champion: Champion;
    level: number;
    armorRange: [number, number];
    step: number;
}

const DamageChart: React.FC<DamageChartProps> = ({
    builds,
    champion,
    level,
    armorRange,
    step,
}) => {
    // Generate damage data for a build
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

    // Create labels for the x-axis
    const labels: number[] = [];
    for (let armor = armorRange[0]; armor <= armorRange[1]; armor += step) {
        labels.push(armor);
    }

    const chartData = {
        labels,
        datasets: builds.map((_, index) => ({
            label: `Build ${index + 1}`,
            data: getDamageDataForBuild(index).map((d) => d.damage),
            borderColor: `hsl(${index * 100}, 70%, 50%)`,
            backgroundColor: `hsl(${index * 100}, 70%, 50%)`,
            pointRadius: 0,
            tension: 0,
            pointHitRadius: 40,
            pointHoverRadius: 4,
            animation: { duration: 0 },
        })),
    };

    return (
        <div className="chartContainer">
            <Line
                data={chartData}
                options={{
                    responsive: true,
                    plugins: {
                        legend: { position: "bottom" },
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
    );
};

export default DamageChart;
