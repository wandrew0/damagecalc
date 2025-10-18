import React, { useState } from "react";
import Image from "next/image";
import Select from "react-select";
import { Tooltip } from "react-tooltip";
import { Build } from "../classes/Build";
import { Item } from "../classes/Item";
import { ALL_ITEMS } from "../data/Items";
import ShareModal from "./ShareModal";
import ImportModal from "./ImportModal";

// sort items by AD and crit
ALL_ITEMS.sort((a, b) => b.AD - a.AD || b.critChance - a.critChance);

// Prepare item options for the Select component
const itemOptions = ALL_ITEMS.map((item) => ({
    value: item,
    label: `${item.name} (${item.cost}g)`,
}));

interface BuildPanelProps {
    builds: Build[];
    setBuilds: React.Dispatch<React.SetStateAction<Build[]>>;
    championLevel?: number;
    urlImportBuilds?: Build[] | null;
    urlImportChampionLevel?: number | null;
    onUrlImportHandled?: () => void;
    onChampionLevelImport?: (level: number) => void;
    autoImported?: boolean;
}

const BuildPanel: React.FC<BuildPanelProps> = ({
    builds,
    setBuilds,
    championLevel,
    urlImportBuilds,
    urlImportChampionLevel,
    onUrlImportHandled,
    onChampionLevelImport,
    autoImported,
}) => {
    const [showShareModal, setShowShareModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Auto-open import modal if there are URL imports (but not if auto-imported)
    React.useEffect(() => {
        if (urlImportBuilds && urlImportBuilds.length > 0 && !autoImported) {
            setShowImportModal(true);
        }
    }, [urlImportBuilds, autoImported]);

    function onAddBuild() {
        const newBuild = new Build();
        newBuild.setName(`Build ${builds.length + 1}`);
        setBuilds([...builds, newBuild]);
    }

    function onRemoveBuild(index: number) {
        if (builds.length > 0) {
            setBuilds(builds.filter((_, i) => i !== index));
        }
    }

    function onAddItem(buildIndex: number, item: Item) {
        const newBuilds = [...builds];
        newBuilds[buildIndex].addItem(item);
        setBuilds(newBuilds);
    }

    function onRemoveItem(buildIndex: number, itemIndex: number) {
        const newBuilds = [...builds];
        newBuilds[buildIndex].removeItem(itemIndex);
        setBuilds(newBuilds);
    }

    function duplicateBuild(buildIndex: number) {
        const originalJSON = builds[buildIndex].toJSON();
        const newBuild = Build.fromJSON(originalJSON);
        newBuild.setName(newBuild.name + " Copy");
        // Add the new build to the builds list
        setBuilds([...builds, newBuild]);
    }

    function handleImportBuilds(
        importedBuilds: Build[],
        clearExisting: boolean,
        importedChampionLevel?: number
    ) {
        if (clearExisting) {
            setBuilds(importedBuilds);
        } else {
            setBuilds([...builds, ...importedBuilds]);
        }

        // Handle champion level import
        if (importedChampionLevel && onChampionLevelImport) {
            onChampionLevelImport(importedChampionLevel);
        }
    }

    return (
        <div className="buildPanelContainer">
            {builds.map((build, buildIndex) => (
                <div key={buildIndex} className="buildPanel">
                    <div className="buildHeader">
                        <input
                            className="buildName"
                            onChange={(s) => {
                                build.setName(s.target.value);
                                setBuilds([...builds]);
                            }}
                            value={build.name}
                        />
                        <div className="build-header-buttons">
                            <button
                                className="duplicate-build-button"
                                onClick={() => duplicateBuild(buildIndex)}
                            >
                                Duplicate
                            </button>
                            <button
                                className="remove-build-button"
                                onClick={() => onRemoveBuild(buildIndex)}
                            >
                                Remove
                            </button>
                        </div>
                    </div>

                    {/* Bonus Stats Section */}
                    <div className="bonusStats">
                        <label>
                            Bonus AD
                            <input
                                type="number"
                                value={build.bonusAD === 0 ? "" : build.bonusAD}
                                onChange={(e) => {
                                    build.setBonusAD(+e.target.value);
                                    setBuilds([...builds]);
                                }}
                            />
                        </label>
                        <label>
                            Bonus Lethality
                            <input
                                type="number"
                                value={
                                    build.bonusLethality === 0 ? "" : build.bonusLethality
                                }
                                onChange={(e) => {
                                    build.setBonusLethality(+e.target.value);
                                    setBuilds([...builds]);
                                }}
                            />
                        </label>
                        <label>
                            Bonus Crit
                            <input
                                type="number"
                                value={build.bonusCrit === 0 ? "" : build.bonusCrit * 100}
                                onChange={(e) => {
                                    build.setBonusCrit(+e.target.value / 100);
                                    setBuilds([...builds]);
                                }}
                            />
                        </label>
                    </div>

                    <h3>Items:</h3>
                    <div className="items-grid">
                        {build.items.map((item, idx) => (
                            <div
                                key={idx}
                                className="item-slot"
                                onClick={() => onRemoveItem(buildIndex, idx)}
                                title="Click to remove item"
                            >
                                <div className="item-image-container">
                                    <Image
                                        src={
                                            item.imagePath ||
                                            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAzNkMzMC42MjcgMzYgMzYgMzAuNjI3IDM2IDI0QzM2IDE3LjM3MyAzMC42MjcgMTIgMjQgMTJDMTcuMzczIDEyIDEyIDE3LjM3MyAxMiAyNEMxMiAzMC42MjcgMTcuMzczIDM2IDI0IDM2WiIgZmlsbD0iI0U1RTdFQiIvPgo8cGF0aCBkPSJNMjQgMjhDMjUuMTA0NiAyOCAyNiAyNy4xMDQ2IDI2IDI2QzI2IDI0Ljg5NTQgMjUuMTA0NiAyNCAyNCAyNEMyMi44OTU0IDI0IDIyIDI0Ljg5NTQgMjIgMjZDMjIgMjcuMTA0NiAyMi44OTU0IDI4IDI0IDI4WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K"
                                        }
                                        alt={item.name}
                                        width={52}
                                        height={52}
                                        className="item-image"
                                        data-tooltip-id={`item-tooltip-${buildIndex}-${idx}`}
                                    />
                                    <Tooltip
                                        id={`item-tooltip-${buildIndex}-${idx}`}
                                        place="top-start"
                                        variant="light"
                                        border="1px solid var(--border-light)"
                                        offset={10}
                                        positionStrategy="fixed"
                                        opacity={1}
                                        style={{
                                            backgroundColor:
                                                "var(--bg-primary) !important",
                                            color: "var(--text-primary) !important",
                                            borderRadius: "var(--radius)",
                                            padding: "8px",
                                            fontSize: "12px",
                                            maxWidth: "250px",
                                            zIndex: 10000,
                                            opacity: "1 !important",
                                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                marginBottom: "6px",
                                                borderBottom:
                                                    "1px solid var(--border-light)",
                                                paddingBottom: "4px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontWeight: "600",
                                                    fontSize: "13px",
                                                    color: "var(--text-primary)",
                                                }}
                                            >
                                                {item.name}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "12px",
                                                    color: "#B8860B",
                                                    fontWeight: "500",
                                                }}
                                            >
                                                {item.cost}g
                                            </div>
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "2px",
                                            }}
                                        >
                                            {item.AD > 0 && (
                                                <div
                                                    style={{
                                                        fontSize: "11px",
                                                        color: "var(--text-secondary)",
                                                        padding: "2px 0",
                                                    }}
                                                >
                                                    AD: {item.AD}
                                                </div>
                                            )}
                                            {item.critChance > 0 && (
                                                <div
                                                    style={{
                                                        fontSize: "11px",
                                                        color: "var(--text-secondary)",
                                                        padding: "2px 0",
                                                    }}
                                                >
                                                    Crit:{" "}
                                                    {(item.critChance * 100).toFixed(0)}%
                                                </div>
                                            )}
                                            {item.armorPenetration > 0 && (
                                                <div
                                                    style={{
                                                        fontSize: "11px",
                                                        color: "var(--text-secondary)",
                                                        padding: "2px 0",
                                                    }}
                                                >
                                                    Armor Pen:{" "}
                                                    {(
                                                        item.armorPenetration * 100
                                                    ).toFixed(0)}
                                                    %
                                                </div>
                                            )}
                                            {item.lethality > 0 && (
                                                <div
                                                    style={{
                                                        fontSize: "11px",
                                                        color: "var(--text-secondary)",
                                                        padding: "2px 0",
                                                    }}
                                                >
                                                    Lethality: {item.lethality}
                                                </div>
                                            )}
                                            {item.infinityEdgeBonus && (
                                                <div
                                                    style={{
                                                        fontSize: "11px",
                                                        color: "var(--text-secondary)",
                                                        padding: "2px 0",
                                                    }}
                                                >
                                                    +40% Crit Damage
                                                </div>
                                            )}
                                        </div>
                                    </Tooltip>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Select
                        options={itemOptions}
                        value={null}
                        blurInputOnSelect={false}
                        closeMenuOnSelect={false}
                        onChange={(e) => {
                            if (e) {
                                onAddItem(buildIndex, e.value);
                            }
                        }}
                        menuPortalTarget={
                            typeof document !== "undefined" ? document.body : null
                        }
                        menuPosition="fixed"
                        styles={{
                            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                            menu: (base) => ({ ...base, zIndex: 9999 }),
                        }}
                    />
                    <div className="itemList">
                        <p>
                            <strong>Build Stats:</strong> AD: {build.AD} | Crit:{" "}
                            {(build.critChance * 100).toFixed(0)}% | Armor Pen:{" "}
                            {(build.armorPenetration * 100).toFixed(0)}% | Lethality:{" "}
                            {build.lethality} | Crit Damage:{" "}
                            {(build.critDamageModifier * 100).toFixed(0)}%
                        </p>
                        <p>
                            <strong>Total Cost:</strong>{" "}
                            <span style={{ color: "#B8860B" }}>{build.totalCost}g</span>
                        </p>
                    </div>
                </div>
            ))}
            <div className="build-actions">
                <button
                    className="add-build-button build-action-button"
                    onClick={onAddBuild}
                >
                    Add Build
                </button>
                <button
                    className="share-button build-action-button"
                    onClick={() => setShowShareModal(true)}
                    disabled={builds.length === 0}
                >
                    Share Builds
                </button>
                <button
                    className="import-button build-action-button"
                    onClick={() => setShowImportModal(true)}
                >
                    Import Builds
                </button>
            </div>

            {showShareModal && (
                <ShareModal
                    builds={builds}
                    championLevel={championLevel}
                    onClose={() => setShowShareModal(false)}
                />
            )}
            {showImportModal && (
                <ImportModal
                    onImport={handleImportBuilds}
                    onClose={() => {
                        setShowImportModal(false);
                        if (urlImportBuilds && onUrlImportHandled) {
                            onUrlImportHandled();
                        }
                    }}
                    initialBuilds={urlImportBuilds || undefined}
                    initialChampionLevel={urlImportChampionLevel || undefined}
                    isUrlImport={!!urlImportBuilds}
                />
            )}
        </div>
    );
};

export default BuildPanel;
