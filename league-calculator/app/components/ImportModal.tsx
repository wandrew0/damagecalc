import React, { useState } from "react";
import { Build } from "../classes/Build";

interface ImportModalProps {
    onImport: (builds: Build[], clearExisting: boolean) => void;
    onClose: () => void;
    initialBuilds?: Build[];
}

const ImportModal: React.FC<ImportModalProps> = ({
    onImport,
    onClose,
    initialBuilds,
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

    const handleParse = () => {
        if (!importCode.trim()) {
            setError("Please paste a builds code");
            return;
        }

        try {
            const decoded = JSON.parse(atob(importCode.trim()));
            const builds = decoded.map((b: Record<string, unknown>) =>
                Build.fromJSON(b as Parameters<typeof Build.fromJSON>[0])
            );
            setParsedBuilds(builds);
            setSelectedIndices(new Set(builds.map((_: Build, i: number) => i)));
            setError("");
        } catch {
            setError("Invalid builds code. Please check and try again.");
            setParsedBuilds(null);
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
        onImport(selectedBuilds, clearExisting);
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
                                placeholder="Paste builds code here..."
                                rows={5}
                            />
                            {error && <div className="error-message">{error}</div>}
                        </>
                    ) : (
                        <>
                            <p>Select builds to import:</p>
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
                                onClick={handleParse}
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
                            <button
                                onClick={() => {
                                    setParsedBuilds(null);
                                    setError("");
                                }}
                                className="modal-button-secondary"
                            >
                                Back
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
