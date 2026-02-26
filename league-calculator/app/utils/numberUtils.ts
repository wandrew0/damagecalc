interface ParseNumberInputOptions {
    emptyAs?: number | null;
}

export function parseNumberInput(
    rawValue: string,
    options: ParseNumberInputOptions = {}
): number | null {
    if (rawValue.trim() === "") {
        return options.emptyAs ?? null;
    }
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
}

export function sanitizeStoredNumber(value: unknown, fallback: number): number {
    if (value === null || value === undefined || value === "") {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function sanitizeAdShardCount(value: unknown, fallback = 0): number {
    const parsed = sanitizeStoredNumber(value, fallback);
    return Math.max(0, Math.min(2, Math.round(parsed)));
}
