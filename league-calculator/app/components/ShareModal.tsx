import React, { useState } from "react";
import { Build } from "../classes/Build";

interface ShareModalProps {
    builds: Build[];
    onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ builds, onClose }) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
        new Set(builds.map((_, i) => i))
    );

    const toggleBuild = (index: number) => {
        const newSelected = new Set(selectedIndices);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedIndices(newSelected);
    };

    const handleCopyToClipboard = () => {
        if (selectedIndices.size === 0) {
            return;
        }

        const selectedBuilds = builds.filter((_, i) => selectedIndices.has(i));
        const encoded = btoa(JSON.stringify(selectedBuilds.map((b) => b.toJSON())));
        navigator.clipboard.writeText(encoded);
        onClose();
    };

    const handleCopyURL = () => {
        if (selectedIndices.size === 0) {
            return;
        }

        const selectedBuilds = builds.filter((_, i) => selectedIndices.has(i));
        const encoded = btoa(JSON.stringify(selectedBuilds.map((b) => b.toJSON())));
        const url = `${window.location.origin}${window.location.pathname}#builds=${encoded}`;
        navigator.clipboard.writeText(url);
        onClose();
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
                    <p>Select builds to share:</p>
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
                </div>
                <div className="modal-footer">
                    <button
                        onClick={handleCopyToClipboard}
                        className="modal-button-primary"
                    >
                        Copy Code
                    </button>
                    <button onClick={handleCopyURL} className="modal-button-primary">
                        Copy URL
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
