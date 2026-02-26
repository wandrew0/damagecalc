interface HasSearchTerms {
    searchTerms: string[];
}

interface HasAdAndCrit {
    name?: string;
    AD: number;
    critChance: number;
}

function toSafeNumber(value: number): number {
    return Number.isFinite(value) ? value : 0;
}

export function normalizeSearchToken(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function buildSearchTerms(...parts: string[]): string[] {
    const tokens = new Set<string>();
    parts.forEach((part) => {
        const raw = part.trim().toLowerCase();
        if (!raw) return;
        tokens.add(raw);
        raw.split(/\s+/).forEach((piece) => {
            if (piece) tokens.add(piece);
        });
        const normalized = normalizeSearchToken(raw);
        if (normalized) tokens.add(normalized);
    });
    return [...tokens];
}

export function rankSearchOptions<T extends HasSearchTerms>(
    options: T[],
    rawInput: string
): T[] {
    const query = rawInput.trim().toLowerCase();
    if (!query) {
        return options;
    }
    const normalizedQuery = normalizeSearchToken(query);

    const getRank = (option: T): number => {
        if (
            option.searchTerms.some(
                (term) =>
                    term === query ||
                    (normalizedQuery.length > 0 && term === normalizedQuery)
            )
        ) {
            return 0;
        }
        if (
            option.searchTerms.some(
                (term) =>
                    term.startsWith(query) ||
                    (normalizedQuery.length > 0 && term.startsWith(normalizedQuery))
            )
        ) {
            return 1;
        }
        if (
            option.searchTerms.some(
                (term) =>
                    term.includes(query) ||
                    (normalizedQuery.length > 0 && term.includes(normalizedQuery))
            )
        ) {
            return 2;
        }
        return Number.POSITIVE_INFINITY;
    };

    return options
        .map((option, index) => ({
            option,
            index,
            rank: getRank(option),
        }))
        .filter((entry) => Number.isFinite(entry.rank))
        .sort((a, b) => {
            if (a.rank !== b.rank) {
                return a.rank - b.rank;
            }
            return a.index - b.index;
        })
        .map((entry) => entry.option);
}

export function sortItemsByAdAndCrit<T extends HasAdAndCrit>(items: T[]): T[] {
    const getCritWeightedAd = (item: T): number => {
        const hasCrit = toSafeNumber(item.critChance) > 0;
        const isYunTal = item.name === "Yun Tal Wildarrows";
        const critBonus = hasCrit || isYunTal ? 5 : 0;
        return toSafeNumber(item.AD) + critBonus;
    };

    return [...items].sort(
        (a, b) =>
            getCritWeightedAd(b) - getCritWeightedAd(a) ||
            toSafeNumber(b.critChance) - toSafeNumber(a.critChance)
    );
}
