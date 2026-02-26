import React from "react";

interface ItemIconProps {
    itemName: string;
    iconPath?: string;
    className: string;
    imageClassName: string;
    fallbackClassName: string;
    fallbackText?: string;
    tooltipId?: string;
    title?: string;
}

function getItemInitials(itemName: string): string {
    return itemName
        .split(/\s+/)
        .map((word) => word[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export default function ItemIcon({
    itemName,
    iconPath,
    className,
    imageClassName,
    fallbackClassName,
    fallbackText,
    tooltipId,
    title,
}: ItemIconProps): React.ReactNode {
    const resolvedTitle = title ?? itemName;

    if (iconPath) {
        return (
            <span
                role="img"
                aria-label={itemName}
                title={resolvedTitle}
                className={className}
                data-tooltip-id={tooltipId}
            >
                <span
                    className={imageClassName}
                    aria-hidden="true"
                    style={{ backgroundImage: `url("${iconPath}")` }}
                />
            </span>
        );
    }

    return (
        <span className={fallbackClassName} title={resolvedTitle} aria-label={itemName}>
            {fallbackText ?? getItemInitials(itemName)}
        </span>
    );
}
