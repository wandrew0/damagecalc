import React from "react";
import Select from "react-select";
import { Build } from "../classes/Build";
import { Item } from "../classes/Item";
import { ALL_ITEMS } from "../data/Items";

// sort items by AD and crit
ALL_ITEMS.sort((a, b) => b.AD - a.AD || b.critChance - a.critChance);

// Prepare item options for the Select component
const itemOptions = ALL_ITEMS.map((item) => ({
    value: item,
    label: `${item.name} (${item.cost}g)`,
}));

interface BuildPanelProps {
    builds: Build[];
    onAddBuild: () => void;
    onRemoveBuild: (index: number) => void;
    onAddItem: (buildIndex: number, item: Item) => void;
    onRemoveItem: (buildIndex: number, itemIndex: number) => void;
    setBuilds: React.Dispatch<React.SetStateAction<Build[]>>;
}

const BuildPanel: React.FC<BuildPanelProps> = ({
    builds,
    onAddBuild,
    onRemoveBuild,
    onAddItem,
    onRemoveItem,
    setBuilds,
}) => {
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
                        {/* {`Build ${buildIndex + 1}`} */}
                        {builds.length >= 1 && (
                            <button
                                className="remove-build-button"
                                onClick={() => onRemoveBuild(buildIndex)}
                            >
                                Remove Build
                            </button>
                        )}
                    </div>

                    {/* Bonus Stats Section */}
                    <div className="bonusStats">
                        <div>
                            <label>
                                Bonus AD:{" "}
                                <input
                                    type="number"
                                    value={build.bonusAD === 0 ? "" : build.bonusAD}
                                    onChange={(e) => {
                                        build.setBonusAD(+e.target.value);
                                        setBuilds([...builds]);
                                    }}
                                />
                            </label>
                        </div>
                        <div>
                            <label>
                                Bonus Lethality:{" "}
                                <input
                                    type="number"
                                    value={
                                        build.bonusLethality === 0
                                            ? ""
                                            : build.bonusLethality
                                    }
                                    onChange={(e) => {
                                        build.setBonusLethality(+e.target.value);
                                        setBuilds([...builds]);
                                    }}
                                />
                            </label>
                        </div>
                        <div>
                            <label>
                                Bonus Crit:{" "}
                                <input
                                    type="number"
                                    value={
                                        build.bonusCrit === 0 ? "" : build.bonusCrit * 100
                                    }
                                    onChange={(e) => {
                                        build.setBonusCrit(+e.target.value / 100);
                                        setBuilds([...builds]);
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    <h3>Items:</h3>
                    <ul>
                        {build.items.map((item, idx) => (
                            <li key={idx} className="item-entry">
                                <div className="item-info">
                                    <div className="item-header">
                                        <div className="item-name">{item.name}</div>
                                        <div className="item-cost">{item.cost}g</div>
                                    </div>
                                    <div className="item-stats">
                                        <span className="item-ad">AD: {item.AD}</span>
                                        <span className="item-crit">
                                            Crit: {(item.critChance * 100).toFixed(0)}%
                                        </span>
                                        <span className="item-armorPen">
                                            Armor Pen:{" "}
                                            {(item.armorPenetration * 100).toFixed(0)}%
                                        </span>
                                        <span className="item-lethality">
                                            Lethality: {item.lethality}
                                        </span>
                                        {item.infinityEdgeBonus && (
                                            <span className="item-IE">
                                                +40% Crit Damage
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    className="remove-button"
                                    onClick={() => onRemoveItem(buildIndex, idx)}
                                >
                                    Remove
                                </button>
                            </li>
                        ))}
                    </ul>
                    <Select
                        options={itemOptions}
                        value={null}
                        onChange={(e) => {
                            if (e) {
                                onAddItem(buildIndex, e.value);
                            }
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
                            <strong>Total Gold:</strong> {build.totalCost}
                        </p>
                    </div>
                </div>
            ))}
            <button className="add-build-button" onClick={onAddBuild}>
                Add Build
            </button>
        </div>
    );
};

export default BuildPanel;
