"use client";

import React, { useState, useMemo, useCallback } from "react";
import { calculateCollectorEfficiency } from "../lib/collectorMath";
import CollectorConceptViz from "./CollectorConceptViz";
import CollectorEfficiencyChart from "./CollectorEfficiencyChart";
import "../../../styles/CollectorAnalysis.css";
import { parseNumberInput } from "../../../utils/numberUtils";
import usePersistenceLifecycle from "../../../hooks/usePersistenceLifecycle";

function clampMaxHp(value: number) {
    return Math.max(100, Math.min(10000, Math.round(value)));
}

function clampAutoDamage(value: number) {
    return Math.max(1, Math.min(2000, Math.round(value)));
}

export default function CollectorAnalysis() {
    // State for inputs
    const [maxHp, setMaxHp] = useState(2000);
    const [autoDamage, setAutoDamage] = useState(200);

    const loadPersistedState = useCallback(() => {
        const savedMaxHp = localStorage.getItem("collector_maxHp");
        const savedAutoDamage = localStorage.getItem("collector_autoDamage");

        const parsedMaxHp = savedMaxHp === null ? null : parseNumberInput(savedMaxHp);
        const parsedAutoDamage =
            savedAutoDamage === null ? null : parseNumberInput(savedAutoDamage);
        if (parsedMaxHp !== null) {
            setMaxHp(clampMaxHp(parsedMaxHp));
        }
        if (parsedAutoDamage !== null) {
            setAutoDamage(clampAutoDamage(parsedAutoDamage));
        }
    }, []);

    const persistState = useCallback(() => {
        localStorage.setItem("collector_maxHp", maxHp.toString());
        localStorage.setItem("collector_autoDamage", autoDamage.toString());
    }, [maxHp, autoDamage]);

    const isLoaded = usePersistenceLifecycle({
        loadState: loadPersistedState,
        saveState: persistState,
    });

    // Calculate results
    const result = useMemo(() => {
        return calculateCollectorEfficiency({
            maxHp,
            initialHpPercent: 1, // 100% - Only needed for avgExecuteDamage calculation which is constant
            autoDamage,
        });
    }, [maxHp, autoDamage]);

    const threshold = 0.05 * maxHp;
    const isOverkillCase = autoDamage > threshold;

    // Prevent flash of default content by hiding until loaded
    if (!isLoaded) {
        return null;
    }

    return (
        <div className="collector-analysis">
            <div className="analysis-layout">
                {/* Left Column: Explanation */}
                <div className="explanation-column">
                    <div className="writeup-section">
                        <h3>Execute contribution</h3>
                        <p>
                            This model estimates average execute damage under a uniform
                            last-hit assumption. The smooth percentage compares that
                            execute damage with useful attack damage. It is not the
                            damage buff needed to match attack counts or kill speed.
                        </p>
                        <p>
                            <strong>Assumptions:</strong>
                            <br />
                            1. Target has <span className="math-var">H</span> max HP.
                            <br />
                            2. Assume a total damage contribution of{" "}
                            <span className="math-inline">I &times; H</span> HP, where{" "}
                            <span className="math-var">I</span> is your share of maximum HP, including execute damage.
                            <br />
                            3. We deal constant damage <span className="math-var">
                                A
                            </span>{" "}
                            per auto attack (for simplicity).
                            <br />
                            4. Uniformly random HP distribution in the range of &quot;Next Auto
                            Will Kill&quot; (between <span className="math-inline">
                                0.05H
                            </span>{" "}
                            and <span className="math-inline">0.05H + A</span>).
                        </p>

                        <h4>The calculation</h4>
                        <p>
                            After crossing the execute threshold, the assumed residual
                            HP ranges from 0.05H - A to 0.05H. Positive residual HP is
                            execute damage; an attack that already kills adds zero.
                        </p>

                        <div className="cases-explanation">
                            <div className="case-text">
                                <p>
                                    <strong>Case 1: Auto Damage &le; 5% Max HP</strong>
                                </p>
                                <CollectorConceptViz caseNumber="1" />
                                <p>
                                    When <span className="math-inline">A &le; 0.05H</span>
                                    , the lethal auto always lands the target within the
                                    execute range. The resulting HP follows a uniform
                                    distribution:
                                    <br />
                                    <span className="math-inline">
                                        HP<sub>final</sub> ~ U(0.05H - A, 0.05H)
                                    </span>
                                </p>
                                <p>
                                    The execute damage is simply the remaining HP. The
                                    expected value is the midpoint of this range:
                                </p>
                                <div className="formula-block">
                                    E[Execute] = (Lower + Upper) / 2
                                    <br />
                                    = ((0.05H - A) + 0.05H) / 2
                                    <br />= <strong>0.05H - 0.5A</strong>
                                </div>
                                <p>
                                    Useful attack contribution excludes the expected execute
                                    damage. Their ratio describes damage accounting.
                                </p>
                                <div className="formula-block">
                                    Attack contribution = IH - (0.05H - 0.5A)
                                </div>
                                <p>Execute relative to useful attack contribution:</p>
                                <div className="formula-block">
                                    Contribution % = (IH / (IH - (0.05H - 0.5A)) - 1) × 100%
                                </div>
                            </div>

                            <div className="case-text">
                                <p>
                                    <strong>Case 2: Auto Damage &gt; 5% Max HP</strong>
                                </p>
                                <CollectorConceptViz caseNumber="2" />
                                <p>
                                    When <span className="math-inline">A &gt; 0.05H</span>
                                    , the lethal auto might &quot;overkill&quot; the execute
                                    threshold (landing below 0 HP directly), in which case
                                    the execute deals 0 damage.
                                </p>
                                <p>
                                    The resulting HP follows the distribution{" "}
                                    <span className="math-inline">
                                        U(0.05H - A, 0.05H)
                                    </span>
                                    . Since{" "}
                                    <span className="math-inline">A &gt; 0.05H</span>, the
                                    lower bound is negative (labeled as{" "}
                                    <strong>-(A - 5%)</strong> in the diagram), and the
                                    execute damage is 0 for all of the negative range.
                                </p>
                                <p>
                                    The lethal auto range is length{" "}
                                    <span className="math-var">A</span>. The &quot;Execute
                                    Window&quot; is length{" "}
                                    <span className="math-inline">0.05H</span>. The
                                    &quot;Overkill Window&quot; is remaining length{" "}
                                    <span className="math-inline">A - 0.05H</span>.
                                </p>
                                <div className="formula-derivation">
                                    <p>Using the Law of Total Expectation:</p>
                                    <span className="math-inline">
                                        E[X] = E[X | Overkill] &times; P(Overkill) + E[X |
                                        Execute] &times; P(Execute)
                                    </span>
                                    <ul>
                                        <li>
                                            P(Overkill) = (A - 0.05H) / A &rarr; Execute
                                            Dmg = 0
                                        </li>
                                        <li>
                                            P(Execute) = 0.05H / A &rarr; Execute Dmg ~
                                            U(0, 0.05H)
                                        </li>
                                    </ul>
                                    <p>
                                        The average damage <em>given</em> it executes is
                                        the midpoint of 0 and 0.05H:{" "}
                                        <span className="math-inline">0.025H</span>.
                                    </p>
                                </div>
                                <div className="formula-block">
                                    E[Execute] = 0 &times; P(Overkill) + 0.025H &times;
                                    P(Execute)
                                    <br />
                                    = 0 + 0.025H &times; (0.05H / A)
                                    <br />= <strong>0.00125H² / A</strong>
                                </div>
                                <div className="formula-block">
                                    Attack contribution = IH - (0.00125H² / A)
                                </div>
                                <p>Execute relative to useful attack contribution:</p>
                                <div className="formula-block">
                                    Contribution % = (IH / (IH - (0.00125H² / A)) - 1) × 100%
                                </div>
                            </div>
                        </div>

                        <section className="collector-notes">
                            <div className="collector-note-block">
                                <h4>What this assumes</h4>
                                <p>
                                    A uniform last-hit phase is an assumption, not something
                                    implied by unrelated HP and attack damage. This model
                                    does not establish how frequently these situations occur
                                    in games. The assumed pre-hit HP range must fit within
                                    maximum HP, and the contribution must exceed mean execute
                                    damage for the ratio to be defined.
                                </p>
                                <p>
                                    Crits, spells, allies, healing, shields, and unfinished
                                    trades are excluded. Average execute damage does not
                                    measure attacks saved, kill probability, or overall item
                                    strength. The breakpoint curve answers a separate question:
                                    extra damage per fixed hit needed to match an attack count.
                                </p>
                            </div>
                        </section>
                    </div>
                </div>

                {/* Right Column: Interactive Calculator */}
                <div className="calculator-column">
                    <div className="controls-section">
                        <div className="control-group">
                            <div className="label-row">
                                <label>Target Max HP (H):</label>
                                <input
                                    type="number"
                                    className="number-input"
                                    value={maxHp}
                                    onChange={(e) => {
                                        const parsedMaxHp = parseNumberInput(
                                            e.target.value
                                        );
                                        if (parsedMaxHp !== null) {
                                            setMaxHp(clampMaxHp(parsedMaxHp));
                                        }
                                    }}
                                    min="100"
                                    max="10000"
                                />
                            </div>
                            <input
                                type="range"
                                min="500"
                                max="5000"
                                step="50"
                                value={maxHp}
                                onChange={(e) => {
                                    const parsedMaxHp = parseNumberInput(
                                        e.target.value
                                    );
                                    if (parsedMaxHp !== null) {
                                        setMaxHp(clampMaxHp(parsedMaxHp));
                                    }
                                }}
                            />
                            <div className="range-labels">
                                <span>500</span>
                                <span>5000</span>
                            </div>
                        </div>

                        <div className="control-group">
                            <div className="label-row">
                                <label>Auto Attack Damage (A):</label>
                                <input
                                    type="number"
                                    className="number-input"
                                    value={autoDamage}
                                    onChange={(e) => {
                                        const parsedAutoDamage = parseNumberInput(
                                            e.target.value
                                        );
                                        if (parsedAutoDamage !== null) {
                                            setAutoDamage(
                                                clampAutoDamage(parsedAutoDamage)
                                            );
                                        }
                                    }}
                                    min="1"
                                    max="2000"
                                />
                            </div>
                            <input
                                type="range"
                                min="50"
                                max="1000"
                                step="1"
                                value={autoDamage}
                                onChange={(e) => {
                                    const parsedAutoDamage = parseNumberInput(
                                        e.target.value
                                    );
                                    if (parsedAutoDamage !== null) {
                                        setAutoDamage(
                                            clampAutoDamage(parsedAutoDamage)
                                        );
                                    }
                                }}
                            />
                            <div className="range-labels">
                                <span>50</span>
                                <span>1000</span>
                            </div>
                        </div>
                    </div>

                    <div className="results-section">
                        <div className="chart-section">
                            <CollectorEfficiencyChart
                                maxHp={maxHp}
                                autoDamage={autoDamage}
                            />
                        </div>

                        <div className="result-card">
                            <div
                                className="variable-summary"
                                style={{
                                    marginTop: 0,
                                    paddingTop: 0,
                                    borderTop: "none",
                                    marginBottom: "0",
                                }}
                            >
                                <div className="stat-box">
                                    <span className="stat-label">5% Threshold</span>
                                    <span className="stat-value">
                                        {threshold.toFixed(0)} HP
                                    </span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-label">Avg Execute Dmg</span>
                                    <span className="stat-value">
                                        {result.avgExecuteDamage.toFixed(1)}
                                    </span>
                                </div>
                                <div className="stat-box">
                                    <span className="stat-label">Current Case</span>
                                    <span
                                        className={`stat-value ${
                                            isOverkillCase ? "case-2" : "case-1"
                                        }`}
                                        style={{ fontSize: "14px" }}
                                    >
                                        {isOverkillCase
                                            ? "Case 2 (A > 5% HP)"
                                            : "Case 1 (A ≤ 5% HP)"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
