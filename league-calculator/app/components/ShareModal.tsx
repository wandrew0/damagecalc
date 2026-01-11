import React, { useState } from "react";
import { Build } from "../classes/Build";
import { encodeBuilds } from "../utils/encoder";
import { CHAMPIONS } from "../data/champions";
import type { ChampionId } from "../data/champions";

interface ShareModalProps {
    builds: Build[];
    championLevel?: number;
    absoluteFocus?: boolean;
    gatheringStormMinutes?: number;
    adShardCount?: number;
    championId?: ChampionId;
    dravenQEnabled?: boolean;
    dravenQLevel?: number;
    dravenQLevelLinked?: boolean;
    onClose: () => void;
}

const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (navigator?.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall back to manual copy below.
        }
    }

    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textArea);
        return success;
    } catch {
        return false;
    }
};

const ShareModal: React.FC<ShareModalProps> = ({
    builds,
    championLevel,
    absoluteFocus,
    gatheringStormMinutes,
    adShardCount,
    championId,
    dravenQEnabled,
    dravenQLevel,
    dravenQLevelLinked,
    onClose,
}) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
        new Set(builds.map((_, i) => i))
    );
    const [includeChampionLevel, setIncludeChampionLevel] = useState(
        championLevel !== undefined
    );
    const [includeAbsoluteFocus, setIncludeAbsoluteFocus] = useState(
        absoluteFocus !== undefined
    );
    const [includeGatheringStorm, setIncludeGatheringStorm] = useState(
        gatheringStormMinutes !== undefined
    );
    const [includeAdShardCount, setIncludeAdShardCount] = useState(
        adShardCount !== undefined
    );
    const [includeChampion, setIncludeChampion] = useState(championId !== undefined);
    const [includeDravenQEnabled, setIncludeDravenQEnabled] = useState(
        championId === "draven" && dravenQEnabled !== undefined
    );
    const [includeDravenQLevel, setIncludeDravenQLevel] = useState(
        championId === "draven" && dravenQLevel !== undefined
    );
    const [includeDravenQLevelLinked, setIncludeDravenQLevelLinked] = useState(
        championId === "draven" && dravenQLevelLinked !== undefined
    );
    const [copyStatus, setCopyStatus] = useState("");
    const [copyError, setCopyError] = useState("");

    const totalBuilds = builds.length;
    const selectedCount = selectedIndices.size;
    const hasSelectedBuilds = selectedCount > 0;
    const canIncludeChampionLevel = championLevel !== undefined;
    const canIncludeAbsoluteFocus = absoluteFocus !== undefined;
    const canIncludeGatheringStorm = gatheringStormMinutes !== undefined;
    const canIncludeAdShardCount = adShardCount !== undefined;
    const canIncludeChampion = championId !== undefined;
    const isDraven = championId === "draven";
    const canIncludeDravenQEnabled = isDraven && dravenQEnabled !== undefined;
    const canIncludeDravenQLevel = isDraven && dravenQLevel !== undefined;
    const canIncludeDravenQLevelLinked =
        isDraven && dravenQLevelLinked !== undefined;
    const canIncludeDravenSettings = includeChampion && isDraven;

    const toggleBuild = (index: number) => {
        const newSelected = new Set(selectedIndices);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedIndices(newSelected);
        if (copyStatus || copyError) {
            setCopyStatus("");
            setCopyError("");
        }
    };

    const selectAllBuilds = () => {
        setSelectedIndices(new Set(builds.map((_, i) => i)));
        if (copyStatus || copyError) {
            setCopyStatus("");
            setCopyError("");
        }
    };

    const clearSelectedBuilds = () => {
        setSelectedIndices(new Set());
        if (copyStatus || copyError) {
            setCopyStatus("");
            setCopyError("");
        }
    };

    const handleCopy = async (format: "url" | "code") => {
        if (!hasSelectedBuilds) {
            setCopyError("Select at least one build to share.");
            return;
        }

        const selectedBuilds = builds.filter((_, i) => selectedIndices.has(i));
        const encoded = encodeBuilds(
            selectedBuilds,
            includeChampionLevel ? championLevel : undefined,
            includeAbsoluteFocus ? absoluteFocus : undefined,
            includeGatheringStorm ? gatheringStormMinutes : undefined,
            includeAdShardCount ? adShardCount : undefined,
            includeChampion ? championId : undefined,
            canIncludeDravenSettings && includeDravenQEnabled
                ? dravenQEnabled
                : undefined,
            canIncludeDravenSettings && includeDravenQLevel ? dravenQLevel : undefined,
            canIncludeDravenSettings && includeDravenQLevelLinked
                ? dravenQLevelLinked
                : undefined
        );
        const textToCopy =
            format === "url"
                ? `${window.location.origin}${window.location.pathname}#builds=${encodeURIComponent(
                      encoded
                  )}`
                : encoded;

        setCopyStatus("");
        setCopyError("");
        const success = await copyTextToClipboard(textToCopy);
        if (success) {
            setCopyStatus(format === "url" ? "URL copied to clipboard." : "Code copied to clipboard.");
        } else {
            setCopyError("Could not copy to clipboard. Please try again.");
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Share Builds</h2>
                    <button className="modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="modal-body">
                    <p>Select builds and options to share:</p>
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
                        {builds.map((build, index) => (
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
                            Select at least one build to enable sharing.
                        </div>
                    )}
                    <div className="modal-section">
                        <div className="modal-section-title">Include Settings</div>
                        <label
                            className={`clear-builds-checkbox ${
                                canIncludeChampion ? "" : "option-disabled"
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={canIncludeChampion && includeChampion}
                                disabled={!canIncludeChampion}
                                onChange={(e) => setIncludeChampion(e.target.checked)}
                            />
                            <span>
                                {canIncludeChampion && championId
                                    ? `Champion (${CHAMPIONS[championId].name})`
                                    : "Champion unavailable"}
                            </span>
                        </label>
                        <label
                            className={`clear-builds-checkbox ${
                                canIncludeChampionLevel ? "" : "option-disabled"
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={canIncludeChampionLevel && includeChampionLevel}
                                disabled={!canIncludeChampionLevel}
                                onChange={(e) =>
                                    setIncludeChampionLevel(e.target.checked)
                                }
                            />
                            <span>
                                {canIncludeChampionLevel
                                    ? `Champion level (${championLevel})`
                                    : "Champion level unavailable"}
                            </span>
                        </label>
                        <label
                            className={`clear-builds-checkbox ${
                                canIncludeAdShardCount ? "" : "option-disabled"
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={canIncludeAdShardCount && includeAdShardCount}
                                disabled={!canIncludeAdShardCount}
                                onChange={(e) =>
                                    setIncludeAdShardCount(e.target.checked)
                                }
                            />
                            <span>
                                {canIncludeAdShardCount
                                    ? `AD shards (${adShardCount})`
                                    : "AD shards unavailable"}
                            </span>
                        </label>
                        <label
                            className={`clear-builds-checkbox ${
                                canIncludeAbsoluteFocus ? "" : "option-disabled"
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={canIncludeAbsoluteFocus && includeAbsoluteFocus}
                                disabled={!canIncludeAbsoluteFocus}
                                onChange={(e) =>
                                    setIncludeAbsoluteFocus(e.target.checked)
                                }
                            />
                            <span>
                                {canIncludeAbsoluteFocus
                                    ? `Absolute Focus (${absoluteFocus ? "enabled" : "disabled"})`
                                    : "Absolute Focus unavailable"}
                            </span>
                        </label>
                        <label
                            className={`clear-builds-checkbox ${
                                canIncludeGatheringStorm ? "" : "option-disabled"
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={canIncludeGatheringStorm && includeGatheringStorm}
                                disabled={!canIncludeGatheringStorm}
                                onChange={(e) =>
                                    setIncludeGatheringStorm(e.target.checked)
                                }
                            />
                            <span>
                                {canIncludeGatheringStorm
                                    ? `Gathering Storm (${gatheringStormMinutes} minutes)`
                                    : "Gathering Storm unavailable"}
                            </span>
                        </label>
                        {isDraven && (
                            <>
                                <label
                                    className={`clear-builds-checkbox ${
                                        canIncludeDravenQEnabled && canIncludeDravenSettings
                                            ? ""
                                            : "option-disabled"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            canIncludeDravenQEnabled &&
                                            canIncludeDravenSettings &&
                                            includeDravenQEnabled
                                        }
                                        disabled={
                                            !canIncludeDravenQEnabled ||
                                            !canIncludeDravenSettings
                                        }
                                        onChange={(e) =>
                                            setIncludeDravenQEnabled(e.target.checked)
                                        }
                                    />
                                    <span>
                                        {canIncludeDravenQEnabled
                                            ? `Draven axes (${dravenQEnabled ? "enabled" : "disabled"})`
                                            : "Draven axes unavailable"}
                                    </span>
                                </label>
                                <label
                                    className={`clear-builds-checkbox ${
                                        canIncludeDravenQLevel && canIncludeDravenSettings
                                            ? ""
                                            : "option-disabled"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            canIncludeDravenQLevel &&
                                            canIncludeDravenSettings &&
                                            includeDravenQLevel
                                        }
                                        disabled={
                                            !canIncludeDravenQLevel ||
                                            !canIncludeDravenSettings
                                        }
                                        onChange={(e) =>
                                            setIncludeDravenQLevel(e.target.checked)
                                        }
                                    />
                                    <span>
                                        {canIncludeDravenQLevel
                                            ? `Draven Q level (${dravenQLevel})`
                                            : "Draven Q level unavailable"}
                                    </span>
                                </label>
                                <label
                                    className={`clear-builds-checkbox ${
                                        canIncludeDravenQLevelLinked &&
                                        canIncludeDravenSettings
                                            ? ""
                                            : "option-disabled"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={
                                            canIncludeDravenQLevelLinked &&
                                            canIncludeDravenSettings &&
                                            includeDravenQLevelLinked
                                        }
                                        disabled={
                                            !canIncludeDravenQLevelLinked ||
                                            !canIncludeDravenSettings
                                        }
                                        onChange={(e) =>
                                            setIncludeDravenQLevelLinked(
                                                e.target.checked
                                            )
                                        }
                                    />
                                    <span>
                                        {canIncludeDravenQLevelLinked
                                            ? `Link Draven Q to champion level (${
                                                  dravenQLevelLinked ? "linked" : "unlinked"
                                              })`
                                            : "Draven Q link unavailable"}
                                    </span>
                                </label>
                            </>
                        )}
                    </div>
                    {copyStatus && <div className="success-message">{copyStatus}</div>}
                    {copyError && <div className="error-message">{copyError}</div>}
                </div>
                <div className="modal-footer">
                    <button
                        onClick={() => handleCopy("url")}
                        className="modal-button-primary"
                        disabled={!hasSelectedBuilds}
                    >
                        Copy URL
                    </button>
                    <button
                        onClick={() => handleCopy("code")}
                        className="modal-button-secondary"
                        disabled={!hasSelectedBuilds}
                    >
                        Copy Code
                    </button>
                    <button onClick={onClose} className="modal-button-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
