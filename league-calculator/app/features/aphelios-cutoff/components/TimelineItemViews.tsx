import React from "react";
import ItemIconGrid from "../../../components/ItemIconGrid";

interface TimelineIconOption {
    iconPath?: string;
}

interface TimelinePreviewItemsProps {
    items: string[];
    optionByName: Map<string, TimelineIconOption>;
    emptyLabel: string;
}

interface TimelineSegmentItemsProps {
    items: string[];
    optionByName: Map<string, TimelineIconOption>;
}

export function TimelinePreviewItems({
    items,
    optionByName,
    emptyLabel,
}: TimelinePreviewItemsProps): React.ReactNode {
    const filled = items.slice(0, 6);
    const previewEntries = filled.map((itemName, index) => ({
        key: `${itemName}-${index}`,
        itemName,
        iconPath: optionByName.get(itemName)?.iconPath,
    }));

    return (
        <div className="timeline-preview-items">
            {filled.length > 0 ? (
                <ItemIconGrid
                    entries={previewEntries}
                    gridClassName="timeline-icon-list"
                    iconClassName="timeline-item-icon"
                    iconImageClassName="timeline-item-icon-image"
                    iconFallbackClassName="timeline-item-icon-fallback"
                />
            ) : (
                <span className="timeline-preview-empty timeline-preview-empty-cta">
                    + {emptyLabel}
                </span>
            )}
        </div>
    );
}

export function TimelineSegmentItems({
    items,
    optionByName,
}: TimelineSegmentItemsProps): React.ReactNode {
    const segmentEntries = Array.from({ length: 6 }, (_, index) => {
        const itemName = items[index] ?? null;
        return {
            key: `segment-slot-${index}-${itemName ?? "empty"}`,
            itemName,
            iconPath: itemName ? optionByName.get(itemName)?.iconPath : undefined,
        };
    });

    return (
        <div className="timeline-preview-items timeline-preview-items-segment">
            <ItemIconGrid
                entries={segmentEntries}
                gridClassName="timeline-icon-list timeline-icon-list-segment"
                iconClassName="timeline-item-icon"
                iconImageClassName="timeline-item-icon-image"
                iconFallbackClassName="timeline-item-icon-fallback"
                emptySlotClassName="timeline-item-icon-empty"
            />
        </div>
    );
}
