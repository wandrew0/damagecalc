import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import {
    calculateCollectorEfficiency,
    calculateDiscreteEfficiency,
} from "../utils/collectorMath";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface CollectorEfficiencyChartProps {
    maxHp: number;
    autoDamage: number;
}

export default function CollectorEfficiencyChart({
    maxHp,
    autoDamage,
}: CollectorEfficiencyChartProps) {
    const data = useMemo(() => {
        const labels: number[] = [];
        const avgPercentDiffs: number[] = [];
        const discretePercentDiffs: number[] = [];

        // Constants
        const threshold = 0.05 * maxHp;

        // Start range: 5% + A/2
        const startThreshold = threshold + autoDamage / 2;
        const minDamage = Math.max(startThreshold, autoDamage);

        // Calculate the range and use 0.2% of it as step size
        const range = maxHp - minDamage;
        const step = Math.max(1, range * 0.002); // 0.2% of range

        for (let d = minDamage; d <= maxHp; d += step) {
            labels.push(d);

            const percent = Math.min(1, d / maxHp);

            // Average Model
            const avgResult = calculateCollectorEfficiency({
                maxHp,
                initialHpPercent: percent,
                autoDamage,
            });
            avgPercentDiffs.push(avgResult.percentDiff);

            // Discrete Model
            const discreteDiff = calculateDiscreteEfficiency({
                maxHp,
                initialHpPercent: percent,
                autoDamage,
            });
            discretePercentDiffs.push(discreteDiff);
        }

        return {
            labels,
            datasets: [
                {
                    label: "Average Efficiency",
                    data: avgPercentDiffs,
                    borderColor: "rgba(255, 99, 132, 0.8)",
                    backgroundColor: "rgba(255, 99, 132, 0.5)",
                    borderWidth: 3,
                    yAxisID: "y",
                    tension: 0.3, // Smooth curve
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHitRadius: 10,
                    order: 1,
                },
                {
                    label: "True Breakpoint Efficiency",
                    data: discretePercentDiffs,
                    borderColor: "rgba(53, 162, 235, 0.8)",
                    backgroundColor: "rgba(53, 162, 235, 0.5)",
                    borderWidth: 2,
                    yAxisID: "y",
                    tension: 0, // Sharp lines for sawtooth
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHitRadius: 10,
                    order: 2,
                },
            ],
        };
    }, [maxHp, autoDamage]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 0,
        },
        interaction: {
            mode: "index" as const,
            intersect: false,
        },
        stacked: false,
        plugins: {
            title: {
                display: true,
                text: "Collector Efficiency vs Damage Dealt",
            },
            tooltip: {
                callbacks: {
                    title: (context: any) => {
                        return `Damage Share: ${Math.round(context[0].label)}`;
                    },
                    label: (context: any) => {
                        return `${context.dataset.label}: ${context.parsed.y.toFixed(
                            2
                        )}%`;
                    },
                },
            },
            legend: {
                labels: {
                    usePointStyle: true,
                },
            },
        },
        scales: {
            x: {
                type: "linear" as const,
                title: {
                    display: true,
                    text: "Total Damage Share (I × H)",
                },
                ticks: {
                    maxTicksLimit: 10,
                },
                min: Math.floor(Math.max(0.05 * maxHp + autoDamage / 2, autoDamage)),
                max: maxHp,
            },
            y: {
                type: "linear" as const,
                display: true,
                position: "left" as const,
                title: {
                    display: true,
                    text: "% Damage Increase",
                },
                beginAtZero: true,
            },
        },
    };

    return (
        <div className="chart-wrapper" style={{ width: "100%", marginBottom: "0px" }}>
            <div className="chart-container" style={{ height: "400px", width: "100%" }}>
                <Line options={options} data={data} />
            </div>
            <div
                style={{
                    fontSize: "12px",
                    color: "#666",
                    marginTop: "16px",
                    marginBottom: "8px",
                    textAlign: "center",
                    fontStyle: "italic",
                    paddingBottom: "0px",
                }}
            >
                * <strong>Blue Line (Sawtooth):</strong> Represents the exact efficiency
                based on discrete auto-attack breakpoints. For sanity checking. <br />*{" "}
                <strong>Red Line (Smooth):</strong> Represents the average expected
                efficiency (uniform distribution model).
            </div>
        </div>
    );
}
