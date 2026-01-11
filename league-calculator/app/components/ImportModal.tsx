import React, { useState } from "react";
import { Build } from "../classes/Build";
import { decodeBuilds, decodeBuildsLegacy } from "../utils/encoder";
import { CHAMPIONS } from "../data/champions";
import type { ChampionId } from "../data/champions";

interface ImportModalProps {
    onImport: (
        builds: Build[],
        clearExisting: boolean,
        championLevel?: number,
        absoluteFocus?: boolean,
        gatheringStormMinutes?: number,
        adShardCount?: number,
        championId?: ChampionId,
        dravenQEnabled?: boolean,
        dravenQLevel?: number,
        dravenQLevelLinked?: boolean
    ) => void;
    onClose: () => void;
    initialBuilds?: Build[];
    initialChampionLevel?: number;
    initialAbsoluteFocus?: boolean;
    initialGatheringStormMinutes?: number;
    initialAdShardCount?: number;
    initialChampionId?: ChampionId;
    initialDravenQEnabled?: boolean;
    initialDravenQLevel?: number;
    initialDravenQLevelLinked?: boolean;
    isUrlImport?: boolean;
}

const extractBuildCode = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) {
        return "";
    }

    const buildsMatch = trimmed.match(/(?:#|\?|&)builds=([^&]+)/);
    if (buildsMatch?.[1]) {
        const encoded = buildsMatch[1];
        try {
            return decodeURIComponent(encoded);
        } catch {
            return encoded;
        }
    }

    if (trimmed.startsWith("builds=")) {
        return trimmed.slice("builds=".length).trim();
    }

    return trimmed;
};

const ImportModal: React.FC<ImportModalProps> = ({
    onImport,
    onClose,
    initialBuilds,
    initialChampionLevel,
    initialAbsoluteFocus,
    initialGatheringStormMinutes,
    initialAdShardCount,
    initialChampionId,
    initialDravenQEnabled,
    initialDravenQLevel,
    initialDravenQLevelLinked,
    isUrlImport = false,
}) => {
    const [importCode, setImportCode] = useState("");
    const [parsedBuilds, setParsedBuilds] = useState<Build[] | null>(
        initialBuilds || null
    );
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
        new Set(initialBuilds ? initialBuilds.map((_, i) => i) : [])
    );
    const [clearExisting, setClearExisting] = useState(false);
    const [error, setError] = useState("");
    const [importedChampionLevel, setImportedChampionLevel] = useState<
        number | undefined
    >(initialChampionLevel);
    const [importChampionLevel, setImportChampionLevel] = useState(
        initialChampionLevel !== undefined
    );
    const [importedAbsoluteFocus, setImportedAbsoluteFocus] = useState<
        boolean | undefined
    >(initialAbsoluteFocus);
    const [importAbsoluteFocus, setImportAbsoluteFocus] = useState(
        initialAbsoluteFocus !== undefined
    );
    const [importedGatheringStormMinutes, setImportedGatheringStormMinutes] = useState<
        number | undefined
    >(initialGatheringStormMinutes);
    const [importGatheringStorm, setImportGatheringStorm] = useState(
        initialGatheringStormMinutes !== undefined
    );
    const [importedAdShardCount, setImportedAdShardCount] = useState<
        number | undefined
    >(initialAdShardCount);
    const [importAdShardCount, setImportAdShardCount] = useState(
        initialAdShardCount !== undefined
    );
    const [importedChampionId, setImportedChampionId] = useState<
        ChampionId | undefined
    >(initialChampionId);
    const [importChampion, setImportChampion] = useState(
        initialChampionId !== undefined
    );
    const [importedDravenQEnabled, setImportedDravenQEnabled] = useState<
        boolean | undefined
    >(initialChampionId === "draven" ? initialDravenQEnabled : undefined);
    const [importDravenQEnabled, setImportDravenQEnabled] = useState(
        initialChampionId === "draven" && initialDravenQEnabled !== undefined
    );
    const [importedDravenQLevel, setImportedDravenQLevel] = useState<
        number | undefined
    >(initialChampionId === "draven" ? initialDravenQLevel : undefined);
    const [importDravenQLevel, setImportDravenQLevel] = useState(
        initialChampionId === "draven" && initialDravenQLevel !== undefined
    );
    const [importedDravenQLevelLinked, setImportedDravenQLevelLinked] = useState<
        boolean | undefined
    >(initialChampionId === "draven" ? initialDravenQLevelLinked : undefined);
    const [importDravenQLevelLinked, setImportDravenQLevelLinked] = useState(
        initialChampionId === "draven" && initialDravenQLevelLinked !== undefined
    );

    const totalBuilds = parsedBuilds?.length ?? 0;
    const selectedCount = selectedIndices.size;
    const hasSelectedBuilds = selectedCount > 0;
    const hasImportedChampionLevel = importedChampionLevel !== undefined;
    const hasImportedAbsoluteFocus = importedAbsoluteFocus !== undefined;
    const hasImportedGatheringStorm = importedGatheringStormMinutes !== undefined;
    const hasImportedAdShardCount = importedAdShardCount !== undefined;
    const hasImportedChampion = importedChampionId !== undefined;
    const isImportedDraven = importedChampionId === "draven";
    const hasImportedDravenQEnabled = importedDravenQEnabled !== undefined;
    const hasImportedDravenQLevel = importedDravenQLevel !== undefined;
    const hasImportedDravenQLevelLinked = importedDravenQLevelLinked !== undefined;
    const canImportDravenSettings = importChampion && isImportedDraven;

    const handleParse = (code?: string) => {
        const rawInput =
            code || (typeof importCode === "string" ? importCode : "") || "";
        const codeToParse = extractBuildCode(rawInput);
        if (!codeToParse.trim()) {
            setError("Please paste a builds code or share URL.");
            setParsedBuilds(null);
            return;
        }

        try {
            // Try new format first, fallback to legacy
            try {
                const {
                    builds,
                    championLevel,
                    absoluteFocus,
                    gatheringStormMinutes,
                    adShardCount,
                    championId,
                    dravenQEnabled,
                    dravenQLevel,
                    dravenQLevelLinked,
                } = decodeBuilds(codeToParse.trim());
                setParsedBuilds(builds);
                setImportedChampionLevel(championLevel);
                setImportedAbsoluteFocus(absoluteFocus);
                setImportedGatheringStormMinutes(gatheringStormMinutes);
                setImportChampionLevel(championLevel !== undefined);
                setImportAbsoluteFocus(absoluteFocus !== undefined);
                setImportGatheringStorm(gatheringStormMinutes !== undefined);
                setImportedAdShardCount(adShardCount);
                setImportAdShardCount(adShardCount !== undefined);
                setImportedChampionId(championId);
                setImportChampion(championId !== undefined);
                if (championId === "draven") {
                    setImportedDravenQEnabled(dravenQEnabled);
                    setImportedDravenQLevel(dravenQLevel);
                    setImportedDravenQLevelLinked(dravenQLevelLinked);
                    setImportDravenQEnabled(dravenQEnabled !== undefined);
                    setImportDravenQLevel(dravenQLevel !== undefined);
                    setImportDravenQLevelLinked(dravenQLevelLinked !== undefined);
                } else {
                    setImportedDravenQEnabled(undefined);
                    setImportedDravenQLevel(undefined);
                    setImportedDravenQLevelLinked(undefined);
                    setImportDravenQEnabled(false);
                    setImportDravenQLevel(false);
                    setImportDravenQLevelLinked(false);
                }
                setSelectedIndices(new Set(builds.map((_: Build, i: number) => i)));
                setError("");
            } catch {
                // Fallback to legacy format
                const { builds, championLevel } = decodeBuildsLegacy(codeToParse.trim());
                setParsedBuilds(builds);
                setImportedChampionLevel(championLevel);
                setImportedAbsoluteFocus(undefined);
                setImportedGatheringStormMinutes(undefined);
                setImportChampionLevel(championLevel !== undefined);
                setImportAbsoluteFocus(false);
                setImportGatheringStorm(false);
                setImportedAdShardCount(undefined);
                setImportAdShardCount(false);
                setImportedChampionId(undefined);
                setImportChampion(false);
                setImportedDravenQEnabled(undefined);
                setImportedDravenQLevel(undefined);
                setImportedDravenQLevelLinked(undefined);
                setImportDravenQEnabled(false);
                setImportDravenQLevel(false);
                setImportDravenQLevelLinked(false);
                setSelectedIndices(new Set(builds.map((_: Build, i: number) => i)));
                setError("");
            }
        } catch {
            setError("Invalid builds code. Please check and try again.");
            setParsedBuilds(null);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const pastedText = e.clipboardData.getData("text");
        if (pastedText.trim()) {
            setImportCode(pastedText);
            // Auto-parse on paste
            handleParse(pastedText);
        }
    };

    const toggleBuild = (index: number) => {
        const newSelected = new Set(selectedIndices);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedIndices(newSelected);
        if (error) {
            setError("");
        }
    };

    const selectAllBuilds = () => {
        if (!parsedBuilds) {
            return;
        }
        setSelectedIndices(new Set(parsedBuilds.map((_: Build, i: number) => i)));
        if (error) {
            setError("");
        }
    };

    const clearSelectedBuilds = () => {
        setSelectedIndices(new Set());
        if (error) {
            setError("");
        }
    };

    const handleImport = () => {
        if (!parsedBuilds || selectedIndices.size === 0) {
            setError("Select at least one build to import.");
            return;
        }

        const selectedBuilds = parsedBuilds.filter((_, i) => selectedIndices.has(i));
        onImport(
            selectedBuilds,
            clearExisting,
            importChampionLevel ? importedChampionLevel : undefined,
            importAbsoluteFocus ? importedAbsoluteFocus : undefined,
            importGatheringStorm ? importedGatheringStormMinutes : undefined,
            importAdShardCount ? importedAdShardCount : undefined,
            importChampion ? importedChampionId : undefined,
            canImportDravenSettings && importDravenQEnabled
                ? importedDravenQEnabled
                : undefined,
            canImportDravenSettings && importDravenQLevel
                ? importedDravenQLevel
                : undefined,
            canImportDravenSettings && importDravenQLevelLinked
                ? importedDravenQLevelLinked
                : undefined
        );
        onClose();
    };

    const importButtonLabel = hasSelectedBuilds
        ? `Import ${selectedCount} Build${selectedCount === 1 ? "" : "s"}`
        : "Import Builds";

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Import Builds</h2>
                    <button className="modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="modal-body">
                    {!parsedBuilds ? (
                        <>
                            <p>Paste a share URL or builds code:</p>
                            <textarea
                                className="import-textarea"
                                value={importCode}
                                onChange={(e) => setImportCode(e.target.value)}
                                onPaste={handlePaste}
                                placeholder="Paste share URL or builds code here..."
                                rows={5}
                            />
                        </>
                    ) : (
                        <>
                            <p>Choose what to import from this code:</p>
                            <div className="modal-section modal-section--first">
                                <div className="modal-section-title">Builds</div>
                                <div className="modal-actions-row">
                                    <button
                                        type="button"
                                        className="modal-inline-button"
                                        onClick={selectAllBuilds}
                                        disabled={selectedCount === totalBuilds}
                                    >
                                        Select all
                                    </button>
                                    <button
                                        type="button"
                                        className="modal-inline-button"
                                        onClick={clearSelectedBuilds}
                                        disabled={!hasSelectedBuilds}
                                    >
                                        Clear
                                    </button>
                                    <span className="modal-selection-count">
                                        {selectedCount} of {totalBuilds} selected
                                    </span>
                                </div>
                                <div className="build-select-list">
                                    {parsedBuilds.map((build, index) => (
                                        <label key={index} className="build-select-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedIndices.has(index)}
                                                onChange={() => toggleBuild(index)}
                                            />
                                            <span>{build.name}</span>
                                            <span className="build-summary">
                                                {build.items.length} items,{" "}
                                                <span style={{ color: "#B8860B" }}>
                                                    {build.totalCost}g
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {!hasSelectedBuilds && (
                                    <div className="modal-hint">
                                        Select at least one build to enable import.
                                    </div>
                                )}
                            </div>
                            <div className="modal-section">
                                <div className="modal-section-title">Champion</div>
                                <label
                                    className={`clear-builds-checkbox ${
                                        hasImportedChampion ? "" : "option-disabled"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={hasImportedChampion && importChampion}
                                        disabled={!hasImportedChampion}
                                        onChange={(e) =>
                                            setImportChampion(e.target.checked)
                                        }
                                    />
                                    <span>
                                        {hasImportedChampion && importedChampionId
                                            ? `Import champion (${CHAMPIONS[importedChampionId].name})`
                                            : "Champion not included"}
                                    </span>
                                </label>
                                <label
                                    className={`clear-builds-checkbox ${
                                        hasImportedChampionLevel ? "" : "option-disabled"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            hasImportedChampionLevel &&
                                            importChampionLevel
                                        }
                                        disabled={!hasImportedChampionLevel}
                                        onChange={(e) =>
                                            setImportChampionLevel(e.target.checked)
                                        }
                                    />
                                    <span>
                                        {hasImportedChampionLevel
                                            ? `Import champion level (${importedChampionLevel})`
                                            : "Champion level not included"}
                                    </span>
                                </label>
                                {isImportedDraven && (
                                    <>
                                        <label
                                            className={`clear-builds-checkbox ${
                                                hasImportedDravenQEnabled &&
                                                canImportDravenSettings
                                                    ? ""
                                                    : "option-disabled"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={
                                                    hasImportedDravenQEnabled &&
                                                    canImportDravenSettings &&
                                                    importDravenQEnabled
                                                }
                                                disabled={
                                                    !hasImportedDravenQEnabled ||
                                                    !canImportDravenSettings
                                                }
                                                onChange={(e) =>
                                                    setImportDravenQEnabled(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                            <span>
                                                {hasImportedDravenQEnabled
                                                    ? `Import Draven axes (${
                                                          importedDravenQEnabled
                                                              ? "enabled"
                                                              : "disabled"
                                                      })`
                                                    : "Draven axes not included"}
                                            </span>
                                        </label>
                                        <label
                                            className={`clear-builds-checkbox ${
                                                hasImportedDravenQLevel &&
                                                canImportDravenSettings
                                                    ? ""
                                                    : "option-disabled"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={
                                                    hasImportedDravenQLevel &&
                                                    canImportDravenSettings &&
                                                    importDravenQLevel
                                                }
                                                disabled={
                                                    !hasImportedDravenQLevel ||
                                                    !canImportDravenSettings
                                                }
                                                onChange={(e) =>
                                                    setImportDravenQLevel(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                            <span>
                                                {hasImportedDravenQLevel
                                                    ? `Import Draven Q level (${importedDravenQLevel})`
                                                    : "Draven Q level not included"}
                                            </span>
                                        </label>
                                        <label
                                            className={`clear-builds-checkbox ${
                                                hasImportedDravenQLevelLinked &&
                                                canImportDravenSettings
                                                    ? ""
                                                    : "option-disabled"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={
                                                    hasImportedDravenQLevelLinked &&
                                                    canImportDravenSettings &&
                                                    importDravenQLevelLinked
                                                }
                                                disabled={
                                                    !hasImportedDravenQLevelLinked ||
                                                    !canImportDravenSettings
                                                }
                                                onChange={(e) =>
                                                    setImportDravenQLevelLinked(
                                                        e.target.checked
                                                    )
                                                }
                                            />
                                            <span>
                                                {hasImportedDravenQLevelLinked
                                                    ? `Link Draven Q to champion level (${
                                                          importedDravenQLevelLinked
                                                              ? "linked"
                                                              : "unlinked"
                                                      })`
                                                    : "Draven Q link not included"}
                                            </span>
                                        </label>
                                    </>
                                )}
                            </div>
                            <div className="modal-section">
                                <div className="modal-section-title">Runes</div>
                                <label
                                    className={`clear-builds-checkbox ${
                                        hasImportedAdShardCount ? "" : "option-disabled"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            hasImportedAdShardCount && importAdShardCount
                                        }
                                        disabled={!hasImportedAdShardCount}
                                        onChange={(e) =>
                                            setImportAdShardCount(e.target.checked)
                                        }
                                    />
                                    <span>
                                        {hasImportedAdShardCount
                                            ? `Import AD shards (${importedAdShardCount})`
                                            : "AD shards not included"}
                                    </span>
                                </label>
                                <label
                                    className={`clear-builds-checkbox ${
                                        hasImportedAbsoluteFocus ? "" : "option-disabled"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            hasImportedAbsoluteFocus &&
                                            importAbsoluteFocus
                                        }
                                        disabled={!hasImportedAbsoluteFocus}
                                        onChange={(e) =>
                                            setImportAbsoluteFocus(e.target.checked)
                                        }
                                    />
                                    <span>
                                        {hasImportedAbsoluteFocus
                                            ? `Import Absolute Focus (${
                                                  importedAbsoluteFocus
                                                      ? "enabled"
                                                      : "disabled"
                                              })`
                                            : "Absolute Focus not included"}
                                    </span>
                                </label>
                                <label
                                    className={`clear-builds-checkbox ${
                                        hasImportedGatheringStorm ? "" : "option-disabled"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            hasImportedGatheringStorm &&
                                            importGatheringStorm
                                        }
                                        disabled={!hasImportedGatheringStorm}
                                        onChange={(e) =>
                                            setImportGatheringStorm(e.target.checked)
                                        }
                                    />
                                    <span>
                                        {hasImportedGatheringStorm
                                            ? `Import Gathering Storm (${importedGatheringStormMinutes} minutes)`
                                            : "Gathering Storm not included"}
                                    </span>
                                </label>
                            </div>
                            <div className="modal-section">
                                <div className="modal-section-title">
                                    Import Behavior
                                </div>
                                <label className="clear-builds-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={clearExisting}
                                        onChange={(e) =>
                                            setClearExisting(e.target.checked)
                                        }
                                    />
                                    <span>Replace existing builds</span>
                                </label>
                            </div>
                        </>
                    )}
                    {error && <div className="error-message">{error}</div>}
                </div>
                <div className="modal-footer">
                    {!parsedBuilds ? (
                        <>
                            <button
                                onClick={() => handleParse()}
                                className="modal-button-primary"
                            >
                                Parse
                            </button>
                            <button onClick={onClose} className="modal-button-secondary">
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={handleImport}
                                className="modal-button-primary"
                                disabled={!hasSelectedBuilds}
                            >
                                {importButtonLabel}
                            </button>
                            <button
                                onClick={() => {
                                    setParsedBuilds(null);
                                    setError("");
                                }}
                                className="modal-button-secondary"
                            >
                                {isUrlImport ? "Paste Different Code" : "Edit Code"}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
