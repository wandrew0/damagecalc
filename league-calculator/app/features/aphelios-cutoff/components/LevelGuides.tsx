import React from "react";

export interface LevelGuideRow {
    key: "Q" | "W" | "E";
    label: string;
    levels: number[];
}

export interface LevelDiffGuideRow {
    level: number;
    flatDiff: number;
    percentDiff: number | null;
    winner: "greedy" | "average" | "tie";
}

export interface ContextValueGuideRow {
    key: string;
    label: string;
    values: number[];
}

interface LevelGuideCommonProps {
    highlightedLevels?: number[];
    showLevelHeader?: boolean;
    inspectorLevel?: number | null;
    onSelectLevel?: ((level: number) => void) | null;
    hoveredInspectorLevel: number | null;
    setHoveredInspectorLevel: (level: number | null) => void;
}

interface LevelGuideProps extends LevelGuideCommonProps {
    rows: LevelGuideRow[];
    showCellNumbers?: boolean;
}

interface LevelDiffGuideProps extends LevelGuideCommonProps {
    rows: LevelDiffGuideRow[];
}

interface ContextValueGuideProps extends LevelGuideCommonProps {
    rows: ContextValueGuideRow[];
}

function trimFixed(value: number, digits: number): string {
    return value.toFixed(digits).replace(/\.?0+$/, "");
}

export function LevelGuide({
    rows,
    highlightedLevels = [],
    showLevelHeader = true,
    inspectorLevel = null,
    onSelectLevel = null,
    showCellNumbers = true,
    hoveredInspectorLevel,
    setHoveredInspectorLevel,
}: LevelGuideProps): React.ReactNode {
    const highlightedLevelSet = new Set(highlightedLevels);
    const isSelectable = !!onSelectLevel;

    return (
        <div className="cutoff-level-guide">
            <div
                className="cutoff-level-guide-grid-wrap"
                onMouseLeave={isSelectable ? () => setHoveredInspectorLevel(null) : undefined}
            >
                <div className="cutoff-level-guide-bands" aria-hidden="true">
                    {highlightedLevels.map((level) => (
                        <span
                            key={`guide-band-${level}`}
                            className="cutoff-level-guide-band"
                            style={
                                {
                                    "--guide-band-index": level,
                                } as React.CSSProperties
                            }
                        />
                    ))}
                    {hoveredInspectorLevel !== null && hoveredInspectorLevel !== inspectorLevel && (
                        <span
                            key={`guide-hover-${hoveredInspectorLevel}`}
                            className="cutoff-level-guide-band cutoff-level-guide-band-hover"
                            style={
                                {
                                    "--guide-band-index": hoveredInspectorLevel,
                                } as React.CSSProperties
                            }
                        />
                    )}
                    {inspectorLevel !== null && (
                        <span
                            key={`guide-selected-${inspectorLevel}`}
                            className="cutoff-level-guide-band cutoff-level-guide-band-selected"
                            style={
                                {
                                    "--guide-band-index": inspectorLevel,
                                } as React.CSSProperties
                            }
                        />
                    )}
                </div>
                <div className="cutoff-level-guide-grid">
                    {showLevelHeader && (
                        <>
                            <div className="cutoff-level-guide-corner">Stat</div>
                            {Array.from({ length: 18 }, (_, index) => {
                                const level = index + 1;
                                const isDiffLevel = highlightedLevelSet.has(level);
                                const isSelectedLevel = inspectorLevel === level;
                                return (
                                    <div
                                        key={`guide-col-${level}`}
                                        className={`cutoff-level-guide-col ${
                                            isDiffLevel ? "diff-level" : ""
                                        } ${isSelectable ? "level-selectable" : ""} ${
                                            isSelectedLevel ? "selected-level" : ""
                                        }`}
                                        role={isSelectable ? "button" : undefined}
                                        tabIndex={isSelectable ? 0 : undefined}
                                        onClick={
                                            isSelectable && onSelectLevel
                                                ? () => onSelectLevel(level)
                                                : undefined
                                        }
                                        onMouseEnter={
                                            isSelectable
                                                ? () => setHoveredInspectorLevel(level)
                                                : undefined
                                        }
                                        onKeyDown={
                                            isSelectable && onSelectLevel
                                                ? (event) => {
                                                      if (
                                                          event.key !== "Enter" &&
                                                          event.key !== " "
                                                      ) {
                                                          return;
                                                      }
                                                      event.preventDefault();
                                                      onSelectLevel(level);
                                                  }
                                                : undefined
                                        }
                                    >
                                        {level}
                                    </div>
                                );
                            })}
                        </>
                    )}
                    {rows.map((row) => {
                        const rowLevels = new Set(row.levels);
                        return (
                            <React.Fragment key={row.key}>
                                <div
                                    className={`cutoff-level-guide-row-label cutoff-level-guide-row-label-${row.key.toLowerCase()}`}
                                >
                                    <span className="cutoff-level-guide-row-key">{row.key}</span>
                                    <span>{row.label}</span>
                                </div>
                                {Array.from({ length: 18 }, (_, index) => {
                                    const level = index + 1;
                                    const active = rowLevels.has(level);
                                    const isSelectedLevel = inspectorLevel === level;
                                    return (
                                        <div
                                            key={`${row.key}-${level}`}
                                            className={`cutoff-level-guide-cell ${
                                                active ? `active active-${row.key.toLowerCase()}` : ""
                                            } ${isSelectable ? "level-selectable" : ""} ${
                                                isSelectedLevel ? "selected-level" : ""
                                            }`}
                                            role={isSelectable ? "button" : undefined}
                                            tabIndex={isSelectable ? 0 : undefined}
                                            onClick={
                                                isSelectable && onSelectLevel
                                                    ? () => onSelectLevel(level)
                                                    : undefined
                                            }
                                            onMouseEnter={
                                                isSelectable
                                                    ? () => setHoveredInspectorLevel(level)
                                                    : undefined
                                            }
                                            onKeyDown={
                                                isSelectable && onSelectLevel
                                                    ? (event) => {
                                                          if (
                                                              event.key !== "Enter" &&
                                                              event.key !== " "
                                                          ) {
                                                              return;
                                                          }
                                                          event.preventDefault();
                                                          onSelectLevel(level);
                                                      }
                                                    : undefined
                                            }
                                        >
                                            {active && showCellNumbers ? level : ""}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export function LevelDiffGuide({
    rows,
    highlightedLevels = [],
    showLevelHeader = true,
    inspectorLevel = null,
    onSelectLevel = null,
    hoveredInspectorLevel,
    setHoveredInspectorLevel,
}: LevelDiffGuideProps): React.ReactNode {
    const byLevel = new Map(rows.map((row) => [row.level, row]));
    const highlightedLevelSet = new Set(highlightedLevels);
    const isSelectable = !!onSelectLevel;

    const renderDiffCell = (level: number) => {
        const row = byLevel.get(level);
        const isSelectedLevel = inspectorLevel === level;
        const selectionClass = isSelectable ? "level-selectable" : "";
        const selectedClass = isSelectedLevel ? "selected-level" : "";
        if (!row) {
            return (
                <div
                    className={`cutoff-level-guide-cell-delta delta-tie ${selectionClass} ${selectedClass}`}
                    role={isSelectable ? "button" : undefined}
                    tabIndex={isSelectable ? 0 : undefined}
                    onClick={
                        isSelectable && onSelectLevel ? () => onSelectLevel(level) : undefined
                    }
                    onMouseEnter={
                        isSelectable ? () => setHoveredInspectorLevel(level) : undefined
                    }
                    onKeyDown={
                        isSelectable && onSelectLevel
                            ? (event) => {
                                  if (event.key !== "Enter" && event.key !== " ") {
                                      return;
                                  }
                                  event.preventDefault();
                                  onSelectLevel(level);
                              }
                            : undefined
                    }
                >
                    —
                </div>
            );
        }

        const arrow = row.winner === "greedy" ? "▲" : row.winner === "average" ? "▼" : "";
        const value =
            row.winner === "tie" || row.percentDiff === null
                ? "—"
                : trimFixed(Math.abs(row.percentDiff), 1);

        return (
            <div
                className={`cutoff-level-guide-cell-delta delta-${row.winner} ${
                    highlightedLevelSet.has(level) ? "is-diff-level" : ""
                } ${selectionClass} ${selectedClass}`}
                role={isSelectable ? "button" : undefined}
                tabIndex={isSelectable ? 0 : undefined}
                onClick={isSelectable && onSelectLevel ? () => onSelectLevel(level) : undefined}
                onMouseEnter={isSelectable ? () => setHoveredInspectorLevel(level) : undefined}
                onKeyDown={
                    isSelectable && onSelectLevel
                        ? (event) => {
                              if (event.key !== "Enter" && event.key !== " ") {
                                  return;
                              }
                              event.preventDefault();
                              onSelectLevel(level);
                          }
                        : undefined
                }
            >
                {arrow && (
                    <span className="cutoff-level-guide-delta-arrow" aria-hidden="true">
                        {arrow}
                    </span>
                )}
                <span className="cutoff-level-guide-delta-value">{value}</span>
            </div>
        );
    };

    return (
        <div className="cutoff-level-guide cutoff-level-guide-diff">
            <div
                className="cutoff-level-guide-grid-wrap"
                onMouseLeave={isSelectable ? () => setHoveredInspectorLevel(null) : undefined}
            >
                <div className="cutoff-level-guide-bands" aria-hidden="true">
                    {highlightedLevels.map((level) => (
                        <span
                            key={`diff-band-${level}`}
                            className="cutoff-level-guide-band"
                            style={
                                {
                                    "--guide-band-index": level,
                                } as React.CSSProperties
                            }
                        />
                    ))}
                    {hoveredInspectorLevel !== null && hoveredInspectorLevel !== inspectorLevel && (
                        <span
                            key={`diff-hover-${hoveredInspectorLevel}`}
                            className="cutoff-level-guide-band cutoff-level-guide-band-hover"
                            style={
                                {
                                    "--guide-band-index": hoveredInspectorLevel,
                                } as React.CSSProperties
                            }
                        />
                    )}
                    {inspectorLevel !== null && (
                        <span
                            key={`diff-selected-${inspectorLevel}`}
                            className="cutoff-level-guide-band cutoff-level-guide-band-selected"
                            style={
                                {
                                    "--guide-band-index": inspectorLevel,
                                } as React.CSSProperties
                            }
                        />
                    )}
                </div>
                <div className="cutoff-level-guide-grid">
                    {showLevelHeader && (
                        <>
                            <div className="cutoff-level-guide-corner">Metric</div>
                            {Array.from({ length: 18 }, (_, index) => {
                                const level = index + 1;
                                const isDiffLevel = highlightedLevelSet.has(level);
                                const isSelectedLevel = inspectorLevel === level;
                                return (
                                    <div
                                        key={`diff-col-${level}`}
                                        className={`cutoff-level-guide-col ${
                                            isDiffLevel ? "diff-level" : ""
                                        } ${isSelectable ? "level-selectable" : ""} ${
                                            isSelectedLevel ? "selected-level" : ""
                                        }`}
                                        role={isSelectable ? "button" : undefined}
                                        tabIndex={isSelectable ? 0 : undefined}
                                        onClick={
                                            isSelectable && onSelectLevel
                                                ? () => onSelectLevel(level)
                                                : undefined
                                        }
                                        onMouseEnter={
                                            isSelectable
                                                ? () => setHoveredInspectorLevel(level)
                                                : undefined
                                        }
                                        onKeyDown={
                                            isSelectable && onSelectLevel
                                                ? (event) => {
                                                      if (
                                                          event.key !== "Enter" &&
                                                          event.key !== " "
                                                      ) {
                                                          return;
                                                      }
                                                      event.preventDefault();
                                                      onSelectLevel(level);
                                                  }
                                                : undefined
                                        }
                                    >
                                        {level}
                                    </div>
                                );
                            })}
                        </>
                    )}

                    <div className="cutoff-level-guide-row-label cutoff-level-guide-row-label-delta">
                        % Δ
                    </div>
                    {Array.from({ length: 18 }, (_, index) => (
                        <React.Fragment key={`pct-diff-${index + 1}`}>
                            {renderDiffCell(index + 1)}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ContextValueGuide({
    rows,
    highlightedLevels = [],
    showLevelHeader = true,
    inspectorLevel = null,
    onSelectLevel = null,
    hoveredInspectorLevel,
    setHoveredInspectorLevel,
}: ContextValueGuideProps): React.ReactNode {
    const highlightedLevelSet = new Set(highlightedLevels);
    const isSelectable = !!onSelectLevel;

    const formatValue = (value: number | null | undefined): string => {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return "—";
        }
        return trimFixed(value, 1);
    };

    return (
        <div className="cutoff-level-guide cutoff-level-guide-context">
            <div
                className="cutoff-level-guide-grid-wrap"
                onMouseLeave={isSelectable ? () => setHoveredInspectorLevel(null) : undefined}
            >
                <div className="cutoff-level-guide-bands" aria-hidden="true">
                    {highlightedLevels.map((level) => (
                        <span
                            key={`context-band-${level}`}
                            className="cutoff-level-guide-band"
                            style={
                                {
                                    "--guide-band-index": level,
                                } as React.CSSProperties
                            }
                        />
                    ))}
                    {hoveredInspectorLevel !== null && hoveredInspectorLevel !== inspectorLevel && (
                        <span
                            key={`context-hover-${hoveredInspectorLevel}`}
                            className="cutoff-level-guide-band cutoff-level-guide-band-hover"
                            style={
                                {
                                    "--guide-band-index": hoveredInspectorLevel,
                                } as React.CSSProperties
                            }
                        />
                    )}
                    {inspectorLevel !== null && (
                        <span
                            key={`context-selected-${inspectorLevel}`}
                            className="cutoff-level-guide-band cutoff-level-guide-band-selected"
                            style={
                                {
                                    "--guide-band-index": inspectorLevel,
                                } as React.CSSProperties
                            }
                        />
                    )}
                </div>
                <div className="cutoff-level-guide-grid">
                    {showLevelHeader && (
                        <>
                            <div className="cutoff-level-guide-corner">Metric</div>
                            {Array.from({ length: 18 }, (_, index) => {
                                const level = index + 1;
                                const isDiffLevel = highlightedLevelSet.has(level);
                                const isSelectedLevel = inspectorLevel === level;
                                return (
                                    <div
                                        key={`context-col-${level}`}
                                        className={`cutoff-level-guide-col ${
                                            isDiffLevel ? "diff-level" : ""
                                        } ${isSelectable ? "level-selectable" : ""} ${
                                            isSelectedLevel ? "selected-level" : ""
                                        }`}
                                        role={isSelectable ? "button" : undefined}
                                        tabIndex={isSelectable ? 0 : undefined}
                                        onClick={
                                            isSelectable && onSelectLevel
                                                ? () => onSelectLevel(level)
                                                : undefined
                                        }
                                        onMouseEnter={
                                            isSelectable
                                                ? () => setHoveredInspectorLevel(level)
                                                : undefined
                                        }
                                        onKeyDown={
                                            isSelectable && onSelectLevel
                                                ? (event) => {
                                                      if (
                                                          event.key !== "Enter" &&
                                                          event.key !== " "
                                                      ) {
                                                          return;
                                                      }
                                                      event.preventDefault();
                                                      onSelectLevel(level);
                                                  }
                                                : undefined
                                        }
                                    >
                                        {level}
                                    </div>
                                );
                            })}
                        </>
                    )}
                    {rows.map((row) => (
                        <React.Fragment key={row.key}>
                            <div className="cutoff-level-guide-row-label cutoff-level-guide-row-label-context">
                                {row.label}
                            </div>
                            {Array.from({ length: 18 }, (_, index) => {
                                const level = index + 1;
                                const isSelectedLevel = inspectorLevel === level;
                                return (
                                    <div
                                        key={`${row.key}-${level}`}
                                        className={`cutoff-level-guide-cell cutoff-level-guide-cell-context ${
                                            isSelectable ? "level-selectable" : ""
                                        } ${isSelectedLevel ? "selected-level" : ""}`}
                                        role={isSelectable ? "button" : undefined}
                                        tabIndex={isSelectable ? 0 : undefined}
                                        onClick={
                                            isSelectable && onSelectLevel
                                                ? () => onSelectLevel(level)
                                                : undefined
                                        }
                                        onMouseEnter={
                                            isSelectable
                                                ? () => setHoveredInspectorLevel(level)
                                                : undefined
                                        }
                                        onKeyDown={
                                            isSelectable && onSelectLevel
                                                ? (event) => {
                                                      if (
                                                          event.key !== "Enter" &&
                                                          event.key !== " "
                                                      ) {
                                                          return;
                                                      }
                                                      event.preventDefault();
                                                      onSelectLevel(level);
                                                  }
                                                : undefined
                                        }
                                    >
                                        {formatValue(row.values[index])}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
}
