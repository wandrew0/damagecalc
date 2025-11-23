import React, { useState } from "react";
import { Build } from "../classes/Build";
import { decodeBuilds, decodeBuildsLegacy } from "../utils/encoder";

interface ImportModalProps {
    onImport: (
        builds: Build[],
        clearExisting: boolean,
        championLevel?: number,
        absoluteFocus?: boolean,
        gatheringStormMinutes?: number
    ) => void;
    onClose: () => void;
    initialBuilds?: Build[];
    initialChampionLevel?: number;
    initialAbsoluteFocus?: boolean;
    initialGatheringStormMinutes?: number;
    isUrlImport?: boolean;
}

const ImportModal: React.FC<ImportModalProps> = ({
    onImport,
    onClose,
    initialBuilds,
    initialChampionLevel,
    initialAbsoluteFocus,
    initialGatheringStormMinutes,
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
    const [importChampionLevel, setImportChampionLevel] = useState(true);
    const [importedAbsoluteFocus, setImportedAbsoluteFocus] = useState<
        boolean | undefined
    >(initialAbsoluteFocus);
    const [importAbsoluteFocus, setImportAbsoluteFocus] = useState(true);
    const [importedGatheringStormMinutes, setImportedGatheringStormMinutes] = useState<
        number | undefined
    >(initialGatheringStormMinutes);
    const [importGatheringStorm, setImportGatheringStorm] = useState(true);

    const handleParse = (code?: string) => {
        const codeToParse =
            code || (typeof importCode === "string" ? importCode : "") || "";
        if (!codeToParse.trim()) {
            setError("Please paste a builds code");
            return;
        }

        try {
            // Try new format first, fallback to legacy
            try {
                const { builds, championLevel, absoluteFocus, gatheringStormMinutes } =
                    decodeBuilds(codeToParse.trim());
                setParsedBuilds(builds);
                setImportedChampionLevel(championLevel);
                setImportedAbsoluteFocus(absoluteFocus);
                setImportedGatheringStormMinutes(gatheringStormMinutes);
                setSelectedIndices(new Set(builds.map((_: Build, i: number) => i)));
                setError("");
            } catch {
                // Fallback to legacy format
                const { builds, championLevel } = decodeBuildsLegacy(codeToParse.trim());
                setParsedBuilds(builds);
                setImportedChampionLevel(championLevel);
                setImportedAbsoluteFocus(undefined);
                setImportedGatheringStormMinutes(undefined);
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
    };

    const handleImport = () => {
        if (!parsedBuilds || selectedIndices.size === 0) {
            return;
        }

        const selectedBuilds = parsedBuilds.filter((_, i) => selectedIndices.has(i));
        onImport(
            selectedBuilds,
            clearExisting,
            importChampionLevel ? importedChampionLevel : undefined,
            importAbsoluteFocus ? importedAbsoluteFocus : undefined,
            importGatheringStorm ? importedGatheringStormMinutes : undefined
        );
        onClose();
    };

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
                            <p>Paste your builds code:</p>
                            <textarea
                                className="import-textarea"
                                value={importCode}
                                onChange={(e) => setImportCode(e.target.value)}
                                onPaste={handlePaste}
                                placeholder="Paste builds code here..."
                                rows={5}
                            />
                            {error && <div className="error-message">{error}</div>}
                        </>
                    ) : (
                        <>
                            <p>Select builds to import:</p>
                            {importedChampionLevel !== undefined && (
                                <label className="clear-builds-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={importChampionLevel}
                                        onChange={(e) =>
                                            setImportChampionLevel(e.target.checked)
                                        }
                                    />
                                    <span>
                                        Import champion level ({importedChampionLevel})
                                    </span>
                                </label>
                            )}
                            {importedAbsoluteFocus !== undefined && (
                                <label className="clear-builds-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={importAbsoluteFocus}
                                        onChange={(e) =>
                                            setImportAbsoluteFocus(e.target.checked)
                                        }
                                    />
                                    <span>
                                        Import Absolute Focus (
                                        {importedAbsoluteFocus ? "enabled" : "disabled"})
                                    </span>
                                </label>
                            )}
                            {importedGatheringStormMinutes !== undefined && (
                                <label className="clear-builds-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={importGatheringStorm}
                                        onChange={(e) =>
                                            setImportGatheringStorm(e.target.checked)
                                        }
                                    />
                                    <span>
                                        Import Gathering Storm (
                                        {importedGatheringStormMinutes} minutes)
                                    </span>
                                </label>
                            )}
                            <label className="clear-builds-checkbox">
                                <input
                                    type="checkbox"
                                    checked={clearExisting}
                                    onChange={(e) => setClearExisting(e.target.checked)}
                                />
                                <span>Clear existing builds before importing</span>
                            </label>
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
                        </>
                    )}
                </div>
                <div className="modal-footer">
                    {!parsedBuilds ? (
                        <>
                            <button
                                onClick={() => handleParse()}
                                className="modal-button-primary"
                            >
                                Parse Code
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
                            >
                                Import Selected
                            </button>
                            {isUrlImport && (
                                <button
                                    onClick={() => {
                                        setParsedBuilds(null);
                                        setError("");
                                    }}
                                    className="modal-button-secondary"
                                >
                                    Back
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
