import React, { useMemo, useRef } from "react";
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
    // calculateDamageWithMargin, // COMMENTED OUT: Crit variance margin of error feature
    // calculateMaxDamage, // COMMENTED OUT: Was using 100% crit for Y-axis, now using expected damage
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
    absoluteFocus?: boolean;
    gatheringStormMinutes?: number;
    targetBonusHP?: number;
    targetBonusHPRangeMode?: boolean;
    targetBonusHPMax?: number;
    disableAnimation?: boolean;
}

const DamageChart: React.FC<DamageChartProps> = ({
    builds,
    champion,
    level,
    armorRange,
    step,
    // COMMENTED OUT: Crit variance margin of error feature
    showMargin: _showMargin,
    stdDevMultiplier: _stdDevMultiplier,
    numAutoAttacks: _numAutoAttacks,
    absoluteFocus = false,
    gatheringStormMinutes = 0,
    targetBonusHP = 0,
    targetBonusHPRangeMode = false,
    targetBonusHPMax = 1500,
    disableAnimation = false,
}) => {
    // Suppress unused variable warnings for commented-out crit variance feature
    void _showMargin;
    void _stdDevMultiplier;
    void _numAutoAttacks;
    // Ref for the custom comparison tooltip
    const comparisonTooltipRef = useRef<HTMLDivElement | null>(null);

    // Calculate max Y value for fixed axis range
    const maxYValue = useMemo(() => {
        if (builds.length === 0) return 100;

        // Find max expected damage (at armor=0) across all builds
        // Use the higher HP value (either single or max of range) for max damage calculation
        const hpForMaxCalc = targetBonusHPRangeMode ? targetBonusHPMax : targetBonusHP;
        let maxDamage = 0;
        builds.forEach((build) => {
            // Use expected damage at armor=0, not max crit damage
            const expectedDamage = calculateSingleAutoDamage(
                champion,
                0, // armor = 0 for max damage
                level,
                build,
                absoluteFocus,
                gatheringStormMinutes,
                hpForMaxCalc
            );
            maxDamage = Math.max(maxDamage, expectedDamage);
        });

        // Add 10% padding to the top
        return maxDamage * 1.1;
    }, [builds, champion, level, absoluteFocus, gatheringStormMinutes, targetBonusHP, targetBonusHPRangeMode, targetBonusHPMax]);

    // Memoize calculations to ensure they recalculate when dependencies change
    const chartData = useMemo(() => {
        // Generate damage data for a build at a specific bonus HP
        function getDamageDataForBuild(build: Build, bonusHP: number) {
            const results = [] as { armor: number; damage: number }[];
            for (let armor = armorRange[0]; armor <= armorRange[1]; armor += step) {
                const dmg = calculateSingleAutoDamage(
                    champion,
                    armor,
                    level,
                    build,
                    absoluteFocus,
                    gatheringStormMinutes,
                    bonusHP
                );
                results.push({ armor, damage: dmg });
            }
            return results;
        }

        // COMMENTED OUT: Crit variance margin of error feature - shows damage range based on crit RNG over N auto attacks
        // function getDamageDataWithMargin(build: Build) {
        //     const results = [] as {
        //         armor: number;
        //         expected: number;
        //         lower: number;
        //         upper: number;
        //     }[];
        //     for (let armor = armorRange[0]; armor <= armorRange[1]; armor += step) {
        //         const range = calculateDamageWithMargin(
        //             champion,
        //             armor,
        //             level,
        //             build,
        //             stdDevMultiplier,
        //             numAutoAttacks,
        //             absoluteFocus,
        //             gatheringStormMinutes,
        //             targetBonusHP
        //         );
        //         results.push({ armor, ...range });
        //     }
        //     return results;
        // }

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
            fill?: boolean | number | string;
            tension?: number;
            pointRadius?: number;
            pointHoverRadius?: number;
            pointHitRadius?: number;
            borderWidth?: number;
            hidden?: boolean;
            order?: number;
            borderDash?: number[];
        }> = [];

        // COMMENTED OUT: Crit variance margin of error feature - shows damage range based on crit RNG over N auto attacks
        // if (showMargin) {
        //     // When showing margin, create three datasets per build: upper bound, lower bound, main line
        //     builds.forEach((build, index) => {
        //         const data = getDamageDataWithMargin(build);
        //         const color = `hsl(${index * 100}, 70%, 50%)`;
        //         const colorTransparent = `hsla(${index * 100}, 70%, 50%, 0.15)`;
        //         const upperDatasetIndex = datasets.length;

        //         // Upper bound (invisible line - top of the band)
        //         datasets.push({
        //             label: `${build.name} (upper)`,
        //             data: data.map((d) => d.upper),
        //             borderColor: "transparent",
        //             backgroundColor: "transparent",
        //             pointRadius: 0,
        //             pointHoverRadius: 0,
        //             pointHitRadius: 0,
        //             tension: 0,
        //             fill: false,
        //             hidden: false,
        //             order: index * 3,
        //         });

        //         // Lower bound (invisible line - fills UP to upper bound creating the band)
        //         datasets.push({
        //             label: `${build.name} (lower)`,
        //             data: data.map((d) => d.lower),
        //             borderColor: "transparent",
        //             backgroundColor: colorTransparent,
        //             pointRadius: 0,
        //             pointHoverRadius: 0,
        //             pointHitRadius: 0,
        //             tension: 0,
        //             fill: upperDatasetIndex, // Fill to the upper bound dataset
        //             hidden: false,
        //             order: index * 3 + 1,
        //         });

        //         // Expected damage (main visible line - SOLID, NO fill)
        //         datasets.push({
        //             label: `${build.name}`,
        //             data: data.map((d) => d.expected),
        //             borderColor: color,
        //             backgroundColor: color,
        //             borderWidth: 2.5,
        //             pointRadius: 0,
        //             tension: 0,
        //             pointHitRadius: 40,
        //             pointHoverRadius: 4,
        //             fill: false,
        //             order: index * 3 + 2,
        //         });
        //     });
        // } else
        if (targetBonusHPRangeMode) {
            // Range mode: show shaded region between min and max HP damage
            // Only for builds with LDR - builds without LDR get single line
            builds.forEach((build, index) => {
                const hasLDR = build.items.some(item => item.name === "Lord Dominik's Regards");
                const color = `hsl(${index * 100}, 70%, 50%)`;

                if (hasLDR) {
                    // Build has LDR - show range with shading
                    const dataMin = getDamageDataForBuild(build, targetBonusHP);
                    const dataMax = getDamageDataForBuild(build, targetBonusHPMax);
                    const colorTransparent = `hsla(${index * 100}, 70%, 50%, 0.2)`;
                    const upperDatasetIndex = datasets.length;

                    // Upper bound (max HP - higher damage, visible line)
                    datasets.push({
                        label: `${build.name} (max HP)`,
                        data: dataMax.map((d) => d.damage),
                        borderColor: color,
                        backgroundColor: "transparent",
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 20,
                        tension: 0,
                        fill: false,
                        hidden: false,
                        order: index * 3,
                    });

                    // Lower bound (min HP - lower damage, fills UP to upper bound)
                    datasets.push({
                        label: `${build.name} (min HP)`,
                        data: dataMin.map((d) => d.damage),
                        borderColor: color,
                        backgroundColor: colorTransparent,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 20,
                        tension: 0,
                        fill: upperDatasetIndex, // Fill to the upper bound dataset
                        hidden: false,
                        order: index * 3 + 1,
                    });

                    // Legend-only entry (invisible line, just for showing build name in legend)
                    datasets.push({
                        label: `${build.name}`,
                        data: [], // Empty data - won't render anything
                        borderColor: color,
                        backgroundColor: color,
                        borderWidth: 2,
                        pointRadius: 0,
                        hidden: false,
                        order: index * 3 + 2,
                    });
                } else {
                    // Build doesn't have LDR - single line (Giant Slayer doesn't apply)
                    datasets.push({
                        label: `${build.name}`,
                        data: getDamageDataForBuild(build, 0).map((d) => d.damage),
                        borderColor: color,
                        backgroundColor: color,
                        borderWidth: 2.5,
                        pointRadius: 0,
                        tension: 0,
                        pointHitRadius: 40,
                        pointHoverRadius: 4,
                    });
                }
            });
        } else {
            // When not showing margin, use simple datasets
            builds.forEach((build, index) => {
                datasets.push({
                    label: `${build.name}`,
                    data: getDamageDataForBuild(build, targetBonusHP).map((d) => d.damage),
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
        // showMargin, stdDevMultiplier, numAutoAttacks - COMMENTED OUT: Crit variance margin of error feature
        absoluteFocus,
        gatheringStormMinutes,
        targetBonusHP,
        targetBonusHPRangeMode,
        targetBonusHPMax,
    ]);

    return (
        <div className="chartContainer" style={{ position: "relative" }}>
            <div
                style={{ position: "relative", height: "100%" }}
                onMouseLeave={() => {
                    if (comparisonTooltipRef.current) {
                        comparisonTooltipRef.current.style.opacity = "0";
                    }
                }}
            >
                <Line
                    data={chartData}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: disableAnimation
                            ? false
                            : {
                                  duration: 300,
                              },
                        interaction: {
                            mode: "index",
                            intersect: false,
                        },
                        onHover: (event, activeElements) => {
                            const tooltipEl = comparisonTooltipRef.current;
                            if (!tooltipEl) return;

                            if (activeElements.length === 0 || builds.length === 0) {
                                tooltipEl.style.opacity = "0";
                                return;
                            }

                            const dataIndex = activeElements[0].index;
                            const armor = armorRange[0] + dataIndex * step;

                            // Build HTML content
                            let innerHtml = `
                            <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.3); padding-bottom: 6px;">
                                At ${armor} Armor
                            </div>
                        `;

                            if (targetBonusHPRangeMode) {
                                // Range mode: show min and max damage for builds with LDR, single value for others
                                const buildDamagesRange: Array<{
                                    name: string;
                                    damageMin: number;
                                    damageMax: number;
                                    hasLDR: boolean;
                                    color: string;
                                }> = [];

                                builds.forEach((build, index) => {
                                    const hasLDR = build.items.some(item => item.name === "Lord Dominik's Regards");
                                    
                                    if (hasLDR) {
                                        const damageMin = calculateSingleAutoDamage(
                                            champion,
                                            armor,
                                            level,
                                            build,
                                            absoluteFocus,
                                            gatheringStormMinutes,
                                            targetBonusHP
                                        );
                                        const damageMax = calculateSingleAutoDamage(
                                            champion,
                                            armor,
                                            level,
                                            build,
                                            absoluteFocus,
                                            gatheringStormMinutes,
                                            targetBonusHPMax
                                        );
                                        buildDamagesRange.push({
                                            name: build.name,
                                            damageMin,
                                            damageMax,
                                            hasLDR: true,
                                            color: `hsl(${index * 100}, 70%, 50%)`,
                                        });
                                    } else {
                                        // No LDR - single damage value (Giant Slayer doesn't apply)
                                        const damage = calculateSingleAutoDamage(
                                            champion,
                                            armor,
                                            level,
                                            build,
                                            absoluteFocus,
                                            gatheringStormMinutes,
                                            0 // No bonus HP effect without LDR
                                        );
                                        buildDamagesRange.push({
                                            name: build.name,
                                            damageMin: damage,
                                            damageMax: damage,
                                            hasLDR: false,
                                            color: `hsl(${index * 100}, 70%, 50%)`,
                                        });
                                    }
                                });

                                // Find lowest min damage for baseline
                                const lowestMinDamage = Math.min(
                                    ...buildDamagesRange.map((b) => b.damageMin)
                                );

                                // Sort by max damage (descending)
                                const comparisons = buildDamagesRange
                                    .map((bd) => ({
                                        buildName: bd.name,
                                        damageMin: bd.damageMin,
                                        damageMax: bd.damageMax,
                                        hasLDR: bd.hasLDR,
                                        percentDiffMin:
                                            ((bd.damageMin - lowestMinDamage) / lowestMinDamage) * 100,
                                        percentDiffMax:
                                            ((bd.damageMax - lowestMinDamage) / lowestMinDamage) * 100,
                                        color: bd.color,
                                    }))
                                    .sort((a, b) => b.damageMax - a.damageMax);

                                comparisons.forEach((comp) => {
                                    const isBaseline = comp.percentDiffMin === 0 && comp.percentDiffMax === 0;
                                    const isSingleValue = !comp.hasLDR || comp.percentDiffMin === comp.percentDiffMax;
                                    innerHtml += `
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; gap: 16px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 12px; height: 12px; background-color: ${
                                                comp.color
                                            }; border-radius: 2px; flex-shrink: 0;"></div>
                                            <span style="font-size: 13px;">${
                                                comp.buildName
                                            }</span>
                                        </div>
                                        <span style="font-weight: bold; color: ${
                                            isBaseline ? "#888" : "#4ade80"
                                        }; font-size: 13px; white-space: nowrap;">
                                            ${
                                                isBaseline
                                                    ? "baseline"
                                                    : isSingleValue
                                                        ? `+${comp.percentDiffMin.toFixed(1)}%`
                                                        : `+${comp.percentDiffMin.toFixed(1)}%–${comp.percentDiffMax.toFixed(1)}%`
                                            }
                                        </span>
                                    </div>
                                `;
                                });
                            } else {
                                // Single value mode
                                const buildDamages: Array<{
                                    name: string;
                                    damage: number;
                                    color: string;
                                }> = [];

                                builds.forEach((build, index) => {
                                    // COMMENTED OUT: Crit variance margin of error feature
                                    // if (showMargin) {
                                    //     const range = calculateDamageWithMargin(
                                    //         champion,
                                    //         armor,
                                    //         level,
                                    //         build,
                                    //         stdDevMultiplier,
                                    //         numAutoAttacks,
                                    //         absoluteFocus,
                                    //         gatheringStormMinutes,
                                    //         targetBonusHP
                                    //     );
                                    //     damage = range.expected;
                                    // } else {
                                    const damage = calculateSingleAutoDamage(
                                        champion,
                                        armor,
                                        level,
                                        build,
                                        absoluteFocus,
                                        gatheringStormMinutes,
                                        targetBonusHP
                                    );
                                    // }

                                    buildDamages.push({
                                        name: build.name,
                                        damage,
                                        color: `hsl(${index * 100}, 70%, 50%)`,
                                    });
                                });

                                // Find lowest damage
                                const lowestDamage = Math.min(
                                    ...buildDamages.map((b) => b.damage)
                                );

                                // Calculate percentage differences and sort by damage (descending)
                                const comparisons = buildDamages
                                    .map((bd) => ({
                                        buildName: bd.name,
                                        damage: bd.damage,
                                        percentDiff:
                                            ((bd.damage - lowestDamage) / lowestDamage) * 100,
                                        color: bd.color,
                                    }))
                                    .sort((a, b) => b.damage - a.damage);

                                comparisons.forEach((comp) => {
                                    innerHtml += `
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; gap: 16px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div style="width: 12px; height: 12px; background-color: ${
                                                comp.color
                                            }; border-radius: 2px; flex-shrink: 0;"></div>
                                            <span style="font-size: 13px;">${
                                                comp.buildName
                                            }</span>
                                        </div>
                                        <span style="font-weight: bold; color: ${
                                            comp.percentDiff === 0 ? "#888" : "#4ade80"
                                        }; font-size: 13px; white-space: nowrap;">
                                            ${
                                                comp.percentDiff === 0
                                                    ? "baseline"
                                                    : `+${comp.percentDiff.toFixed(1)}%`
                                            }
                                        </span>
                                    </div>
                                `;
                                });
                            }

                            tooltipEl.innerHTML = innerHtml;
                            tooltipEl.style.opacity = "1";
                        },
                        plugins: {
                            legend: {
                                position: "bottom",
                                labels: {
                                    filter: (item) => {
                                        // Hide upper/lower bound labels and HP range labels from legend
                                        return (
                                            !item.text.includes("(upper)") &&
                                            !item.text.includes("(lower)") &&
                                            !item.text.includes("(max HP)") &&
                                            !item.text.includes("(min HP)")
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
                                        // For HP range mode, show both values
                                        if (label.includes("(max HP)")) {
                                            const baseName = label.replace(" (max HP)", "");
                                            return `${baseName} (max HP): ${context.parsed.y.toFixed(2)}`;
                                        }
                                        if (label.includes("(min HP)")) {
                                            const baseName = label.replace(" (min HP)", "");
                                            return `${baseName} (min HP): ${context.parsed.y.toFixed(2)}`;
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
                                itemSort: (a, b) => {
                                    // Sort by damage value (y) descending
                                    return (b.parsed?.y ?? 0) - (a.parsed?.y ?? 0);
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
                <div
                    ref={comparisonTooltipRef}
                    style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        backgroundColor: "rgba(0, 0, 0, 0.85)",
                        color: "white",
                        padding: "12px 16px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        zIndex: 1000,
                        pointerEvents: "none",
                        minWidth: "200px",
                        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                        opacity: 0,
                        transition: "opacity 0.15s ease-in-out",
                    }}
                ></div>
            </div>
        </div>
    );
};

export default DamageChart;
