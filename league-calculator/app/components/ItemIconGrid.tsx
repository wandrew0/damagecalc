import React from "react";
import ItemIcon from "./ItemIcon";

interface ItemIconGridEntry {
    key: string;
    itemName?: string | null;
    iconPath?: string;
}

interface ItemIconGridProps {
    entries: ItemIconGridEntry[];
    gridClassName: string;
    iconClassName: string;
    iconImageClassName: string;
    iconFallbackClassName: string;
    emptySlotClassName?: string;
}

export default function ItemIconGrid({
    entries,
    gridClassName,
    iconClassName,
    iconImageClassName,
    iconFallbackClassName,
    emptySlotClassName,
}: ItemIconGridProps): React.ReactNode {
    return (
        <div className={gridClassName}>
            {entries.map((entry) => {
                if (!entry.itemName) {
                    if (!emptySlotClassName) {
                        return null;
                    }
                    return (
                        <span
                            key={entry.key}
                            className={emptySlotClassName}
                            aria-hidden="true"
                        />
                    );
                }

                return (
                    <ItemIcon
                        key={entry.key}
                        itemName={entry.itemName}
                        iconPath={entry.iconPath}
                        className={iconClassName}
                        imageClassName={iconImageClassName}
                        fallbackClassName={iconFallbackClassName}
                    />
                );
            })}
        </div>
    );
}
