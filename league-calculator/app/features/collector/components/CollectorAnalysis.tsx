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
                        <h3>Model</h3>
                        <p>
                            Collector&apos;s base stats suck, and its main benefit is of course
                            its passive. Sometimes when we don&apos;t go Collector, we wonder
                            if the missing execute would have secured a kill. However,
                            other times when we go Collector, we wonder if the extra
                            damage from IE or LDR would have been better. It&apos;s incredibly
                            difficult to quantify the value of this execute, but this is
                            an attempt to do so using averages (disclaimer at the bottom).
                            This model calculates the average % damage increase that
                            Collector does with its execute given various input variables.
                        </p>
                        <p>
                            <strong>Assumptions:</strong>
                            <br />
                            1. Target has <span className="math-var">H</span> max HP.
                            <br />
                            2. We start attacking at{" "}
                            <span className="math-inline">I &times; H</span> HP, where{" "}
                            <span className="math-var">I</span> is the initial percent HP.
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

                        <h4>The Logic</h4>
                        <p>
                            In the best case, Collector only needs to deal{" "}
                            <span className="math-inline">(I - 0.05)H</span> damage, while
                            other builds must deal <span className="math-inline">IH</span>
                            . However, we don&apos;t always land the target exactly on the 5%
                            threshold. The last auto leaves them somewhere between 0 and{" "}
                            <span className="math-inline">0.05H</span>.
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
                                    To kill the target without Collector, we must deal{" "}
                                    <span className="math-inline">
                                        (IH / Required) - 100%
                                    </span>{" "}
                                    more damage.
                                </p>
                                <div className="formula-block">
                                    Required Damage = IH - (0.05H - 0.5A)
                                </div>
                                <p>Thus, the required damage increase is:</p>
                                <div className="formula-block">
                                    % Diff = IH / (IH - (0.05H - 0.5A)) - 100%
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
                                    Required Damage = IH - (0.00125H² / A)
                                </div>
                                <p>The required damage increase for case 2 is:</p>
                                <div className="formula-block">
                                    % Diff = IH / (IH - (0.00125H² / A)) - 100%
                                </div>
                            </div>
                        </div>

                        <section className="collector-notes">
                            <div className="collector-note-block">
                                <h4>Why is the Uniform Assumption (mostly) Fair?</h4>
                                <p>
                                    This assumption holds because your Attack Damage (
                                    <span className="math-var">A</span>) is effectively
                                    uncorrelated with the exact current Health of the target
                                    at any given moment.
                                </p>
                                <p>
                                    Since there is no mechanism synchronizing the
                                    target&apos;s current HP to be a multiple of your damage,
                                    the remainder{" "}
                                    <span className="math-inline">(Current HP) mod A</span>{" "}
                                    (the HP remaining before the lethal hit) is effectively
                                    random. Across many scenarios, this &quot;alignment
                                    offset&quot; is uniformly distributed, meaning the kill
                                    shot is equally likely to land anywhere in the potential
                                    range.
                                </p>
                                <p>
                                    <strong>Note on Teamplay:</strong> In practice,{" "}
                                    <span className="math-inline">I &times; H</span>{" "}
                                    represents the total damage <em>you</em> need to
                                    contribute, not the target&apos;s initial HP. If the target
                                    starts at 100% HP and teammates damage the target, this
                                    reduces your <span className="math-var">I</span> below
                                    100%. However, the model assumes that teammates do not
                                    touch the target below 5% HP. Of course, collector is
                                    worse if teammates burst the target from above 5% HP to 0
                                    HP.
                                </p>
                            </div>

                            <div className="collector-note-block">
                                <h4>Caveats &amp; Limitations</h4>
                                <ul>
                                    <li>
                                        <strong>Constant Damage Assumption:</strong> Assuming
                                        constant damage <span className="math-var">A</span> is
                                        generous. In reality, Critical Strikes and abilities
                                        introduce variance (higher or lower damage). You also
                                        can and should deliberately last hit kills as ADC when
                                        possible, overriding the random distribution modeled
                                        here. If you&apos;re able to time your last auto to bring
                                        the target to exactly 5% HP with Collector, Collector
                                        becomes the most efficient.
                                    </li>
                                    <li>
                                        <strong>Averages Only:</strong> This analysis
                                        calculates the{" "}
                                        <strong>Expected Value (Average)</strong>. It
                                        describes long-term damage efficiency, not the
                                        specific probability distribution. It cannot tell you
                                        &quot;what % of kills Collector secures that you would
                                        otherwise miss&quot;; it only provides a high-level
                                        heuristic for how to value the execute damage.
                                    </li>
                                </ul>
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
