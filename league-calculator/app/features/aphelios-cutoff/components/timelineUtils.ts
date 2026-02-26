export interface TimelineSegmentPreview {
    startLevel: number;
    endLevel: number;
    items: string[];
}

export function areItemListsEqual(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function levelBuildChanged(timelineByLevel: string[][], levelIndex: number): boolean {
    const current = timelineByLevel[levelIndex] ?? [];
    const previous = levelIndex === 0 ? [] : timelineByLevel[levelIndex - 1] ?? [];
    return !areItemListsEqual(current, previous);
}

export function buildTimelineSegments(
    timelineByLevel: string[][],
    totalLevels: number = 18
): TimelineSegmentPreview[] {
    const segments: TimelineSegmentPreview[] = [];
    let segmentStart = 1;
    let segmentItems = timelineByLevel[0] ?? [];

    for (let level = 2; level <= totalLevels; level++) {
        const currentItems = timelineByLevel[level - 1] ?? [];
        if (areItemListsEqual(currentItems, segmentItems)) {
            continue;
        }
        segments.push({
            startLevel: segmentStart,
            endLevel: level - 1,
            items: segmentItems,
        });
        segmentStart = level;
        segmentItems = currentItems;
    }

    segments.push({
        startLevel: segmentStart,
        endLevel: totalLevels,
        items: segmentItems,
    });

    return segments;
}

export function buildTimelineSegmentRenderKeys(
    segments: TimelineSegmentPreview[],
    prefix: string
): string[] {
    const seenBySignature = new Map<string, number>();
    return segments.map((segment) => {
        const signature = segment.items.join("||") || "__empty__";
        const seenCount = seenBySignature.get(signature) ?? 0;
        seenBySignature.set(signature, seenCount + 1);
        return `${prefix}-${signature}-${seenCount}`;
    });
}
