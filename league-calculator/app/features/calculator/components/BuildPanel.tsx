import React, { useMemo, useState } from "react";
import Select from "react-select";
import { Tooltip } from "react-tooltip";
import { Build } from "../../../classes/Build";
import { Item } from "../../../classes/Item";
import { Champion } from "../../../classes/Champion";
import { ALL_ITEMS } from "../../../data/Items";
import ItemIcon from "../../../components/ItemIcon";
import ShareModal from "./ShareModal";
import ImportModal from "./ImportModal";
import { getTotalAD } from "../../../classes/Calculator";
import type { ChampionId } from "../../../data/champions";
import useTouchDevice from "../../../hooks/useTouchDevice";
import {
    buildSearchTerms,
    rankSearchOptions,
    sortItemsByAdAndCrit,
} from "../../../utils/itemSearch";
import { parseNumberInput } from "../../../utils/numberUtils";

interface ItemOption {
    value: Item;
    label: string;
    searchTerms: string[];
}

// Prepare item options for the Select component
const itemOptions: ItemOption[] = sortItemsByAdAndCrit(ALL_ITEMS).map((item) => ({
    value: item,
    label: `${item.name} (${item.cost}g)`,
    searchTerms: buildSearchTerms(item.name, ...(item.aliases ?? [])),
}));

interface BuildPanelProps {
    builds: Build[];
    setBuilds: React.Dispatch<React.SetStateAction<Build[]>>;
    championLevel?: number;
    championId?: ChampionId;
    champion?: Champion;
    absoluteFocus?: boolean;
    gatheringStormMinutes?: number;
    adShardCount?: number;
    dravenQEnabled?: boolean;
    dravenQLevel?: number;
    dravenQLevelLinked?: boolean;
    urlImportBuilds?: Build[] | null;
    urlImportChampionLevel?: number | null;
    urlImportAbsoluteFocus?: boolean | null;
    urlImportGatheringStormMinutes?: number | null;
    urlImportAdShardCount?: number | null;
    urlImportChampionId?: ChampionId | null;
    urlImportDravenQEnabled?: boolean | null;
    urlImportDravenQLevel?: number | null;
    urlImportDravenQLevelLinked?: boolean | null;
    onUrlImportHandled?: () => void;
    onChampionLevelImport?: (level: number) => void;
    onAbsoluteFocusImport?: (absoluteFocus: boolean) => void;
    onGatheringStormImport?: (minutes: number) => void;
    onAdShardCountImport?: (adShardCount: number) => void;
    onChampionImport?: (championId: ChampionId) => void;
    onDravenQEnabledImport?: (enabled: boolean) => void;
    onDravenQLevelImport?: (level: number) => void;
    onDravenQLevelLinkedImport?: (linked: boolean) => void;
}

const BuildPanel: React.FC<BuildPanelProps> = ({
    builds,
    setBuilds,
    championLevel,
    championId,
    champion,
    absoluteFocus = false,
    gatheringStormMinutes = 0,
    adShardCount = 0,
    dravenQEnabled,
    dravenQLevel,
    dravenQLevelLinked,
    urlImportBuilds,
    urlImportChampionLevel,
    urlImportAbsoluteFocus,
    urlImportGatheringStormMinutes,
    urlImportAdShardCount,
    urlImportChampionId,
    urlImportDravenQEnabled,
    urlImportDravenQLevel,
    urlImportDravenQLevelLinked,
    onUrlImportHandled,
    onChampionLevelImport,
    onAbsoluteFocusImport,
    onGatheringStormImport,
    onAdShardCountImport,
    onChampionImport,
    onDravenQEnabledImport,
    onDravenQLevelImport,
    onDravenQLevelLinkedImport,
}) => {
    const [showShareModal, setShowShareModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [itemSearchByBuild, setItemSearchByBuild] = useState<Record<number, string>>(
        {}
    );
    const isTouchDevice = useTouchDevice();

    // Auto-open import modal if there are URL imports
    React.useEffect(() => {
        if (urlImportBuilds && urlImportBuilds.length > 0) {
            setShowImportModal(true);
        }
    }, [urlImportBuilds]);

    const selectMenuPortalTarget = useMemo(() => {
        if (isTouchDevice || typeof document === "undefined") {
            return undefined;
        }
        return document.body;
    }, [isTouchDevice]);

    const selectMenuPosition: "absolute" | "fixed" = isTouchDevice
        ? "absolute"
        : "fixed";

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

    function setBuildSearchInput(buildIndex: number, inputValue: string) {
        setItemSearchByBuild((prev) => ({
            ...prev,
            [buildIndex]: inputValue,
        }));
    }

    function handleImportBuilds(
        importedBuilds: Build[],
        clearExisting: boolean,
        importedChampionLevel?: number,
        importedAbsoluteFocus?: boolean,
        importedGatheringStormMinutes?: number,
        importedAdShardCount?: number,
        importedChampionId?: ChampionId,
        importedDravenQEnabled?: boolean,
        importedDravenQLevel?: number,
        importedDravenQLevelLinked?: boolean
    ) {
        if (clearExisting) {
            setBuilds(importedBuilds);
        } else {
            setBuilds([...builds, ...importedBuilds]);
        }

        if (importedChampionId && onChampionImport) {
            onChampionImport(importedChampionId);
        }

        if (importedChampionLevel !== undefined && onChampionLevelImport) {
            onChampionLevelImport(importedChampionLevel);
        }

        if (importedAbsoluteFocus !== undefined && onAbsoluteFocusImport) {
            onAbsoluteFocusImport(importedAbsoluteFocus);
        }

        if (importedGatheringStormMinutes !== undefined && onGatheringStormImport) {
            onGatheringStormImport(importedGatheringStormMinutes);
        }

        if (importedAdShardCount !== undefined && onAdShardCountImport) {
            onAdShardCountImport(importedAdShardCount);
        }

        if (importedChampionId === "draven") {
            if (importedDravenQEnabled !== undefined && onDravenQEnabledImport) {
                onDravenQEnabledImport(importedDravenQEnabled);
            }
            if (
                importedDravenQLevelLinked !== undefined &&
                onDravenQLevelLinkedImport
            ) {
                onDravenQLevelLinkedImport(importedDravenQLevelLinked);
            }
            if (
                importedDravenQLevel !== undefined &&
                onDravenQLevelImport &&
                !importedDravenQLevelLinked
            ) {
                onDravenQLevelImport(importedDravenQLevel);
            }
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
                                    const parsedBonusAD = parseNumberInput(
                                        e.target.value,
                                        { emptyAs: 0 }
                                    );
                                    if (parsedBonusAD === null) {
                                        return;
                                    }
                                    build.setBonusAD(parsedBonusAD);
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
                                    const parsedBonusLethality = parseNumberInput(
                                        e.target.value,
                                        { emptyAs: 0 }
                                    );
                                    if (parsedBonusLethality === null) {
                                        return;
                                    }
                                    build.setBonusLethality(parsedBonusLethality);
                                    setBuilds([...builds]);
                                }}
                            />
                        </label>
                        <label>
                            Bonus Crit
                            <input
                                type="number"
                                value={
                                    build.bonusCrit === 0
                                        ? ""
                                        : Math.round(build.bonusCrit * 100)
                                }
                                onChange={(e) => {
                                    const inputValue = e.target.value;
                                    if (inputValue === "") {
                                        build.setBonusCrit(0);
                                    } else {
                                        const intValue = parseInt(inputValue, 10);
                                        if (!isNaN(intValue)) {
                                            build.setBonusCrit(intValue / 100);
                                        }
                                    }
                                    setBuilds([...builds]);
                                }}
                            />
                        </label>
                    </div>

                    <h3>Items:</h3>
                    <div className="items-grid">
                        {build.items.map((item, idx) => {
                            const itemImageSrc =
                                item.imagePath ||
                                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNCAzNkMzMC42MjcgMzYgMzYgMzAuNjI3IDM2IDI0QzM2IDE3LjM3MyAzMC42MjcgMTIgMjQgMTJDMTcuMzczIDEyIDEyIDE3LjM3MyAxMiAyNEMxMiAzMC42MjcgMTcuMzczIDM2IDI0IDM2WiIgZmlsbD0iI0U1RTdFQiIvPgo8cGF0aCBkPSJNMjQgMjhDMjUuMTA0NiAyOCAyNiAyNy4xMDQ2IDI2IDI2QzI2IDI0Ljg5NTQgMjUuMTA0NiAyNCAyNCAyNEMyMi44OTU0IDI0IDIyIDI0Ljg5NTQgMjIgMjZDMjIgMjcuMTA0NiAyMi44OTU0IDI4IDI0IDI4WiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K";

                            return (
                                <div
                                    key={idx}
                                    className="item-slot"
                                    onClick={() => onRemoveItem(buildIndex, idx)}
                                    title="Click to remove item"
                                >
                                    <div className="item-image-container">
                                        <ItemIcon
                                            itemName={item.name}
                                            iconPath={itemImageSrc}
                                            className="item-image"
                                            imageClassName="item-image-inner"
                                            fallbackClassName="item-image-fallback"
                                            tooltipId={`item-tooltip-${buildIndex}-${idx}`}
                                        />
                                    <Tooltip
                                        id={`item-tooltip-${buildIndex}-${idx}`}
                                        place="top-start"
                                        variant="light"
                                        border="1px solid var(--border-light)"
                                        offset={10}
                                        positionStrategy="fixed"
                                        events={isTouchDevice ? ["click"] : ["hover"]}
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
                            );
                        })}
                    </div>
                    <Select
                        options={rankSearchOptions(
                            itemOptions,
                            itemSearchByBuild[buildIndex] ?? ""
                        )}
                        value={null}
                        inputValue={itemSearchByBuild[buildIndex] ?? ""}
                        filterOption={() => true}
                        blurInputOnSelect={false}
                        closeMenuOnSelect={false}
                        onChange={(e) => {
                            if (e) {
                                onAddItem(buildIndex, e.value);
                                setBuildSearchInput(buildIndex, "");
                            }
                        }}
                        onInputChange={(value, { action }) => {
                            if (action === "input-change") {
                                setBuildSearchInput(buildIndex, value);
                            } else if (action === "set-value") {
                                setBuildSearchInput(buildIndex, "");
                            }
                        }}
                        menuPortalTarget={selectMenuPortalTarget}
                        menuPosition={selectMenuPosition}
                        menuShouldBlockScroll={isTouchDevice}
                        menuShouldScrollIntoView={!isTouchDevice}
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
                        {champion && championLevel && (
                            <p>
                                <strong>Total AD:</strong>{" "}
                                {getTotalAD(
                                    champion,
                                    championLevel,
                                    build,
                                    absoluteFocus,
                                    gatheringStormMinutes,
                                    adShardCount
                                ).toFixed(1)}
                            </p>
                        )}
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
                    championId={championId}
                    absoluteFocus={absoluteFocus}
                    gatheringStormMinutes={gatheringStormMinutes}
                    adShardCount={adShardCount}
                    dravenQEnabled={dravenQEnabled}
                    dravenQLevel={dravenQLevel}
                    dravenQLevelLinked={dravenQLevelLinked}
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
                    initialAbsoluteFocus={
                        urlImportAbsoluteFocus !== null &&
                        urlImportAbsoluteFocus !== undefined
                            ? urlImportAbsoluteFocus
                            : undefined
                    }
                    initialGatheringStormMinutes={
                        urlImportGatheringStormMinutes !== null &&
                        urlImportGatheringStormMinutes !== undefined
                            ? urlImportGatheringStormMinutes
                            : undefined
                    }
                    initialAdShardCount={
                        urlImportAdShardCount !== null &&
                        urlImportAdShardCount !== undefined
                            ? urlImportAdShardCount
                            : undefined
                    }
                    initialChampionId={
                        urlImportChampionId !== null &&
                        urlImportChampionId !== undefined
                            ? urlImportChampionId
                            : undefined
                    }
                    initialDravenQEnabled={
                        urlImportDravenQEnabled !== null &&
                        urlImportDravenQEnabled !== undefined
                            ? urlImportDravenQEnabled
                            : undefined
                    }
                    initialDravenQLevel={
                        urlImportDravenQLevel !== null &&
                        urlImportDravenQLevel !== undefined
                            ? urlImportDravenQLevel
                            : undefined
                    }
                    initialDravenQLevelLinked={
                        urlImportDravenQLevelLinked !== null &&
                        urlImportDravenQLevelLinked !== undefined
                            ? urlImportDravenQLevelLinked
                            : undefined
                    }
                    isUrlImport={!!urlImportBuilds}
                />
            )}
        </div>
    );
};

export default BuildPanel;
