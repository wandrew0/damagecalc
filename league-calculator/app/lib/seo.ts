const FALLBACK_SITE_URL = "https://damagecalc.vercel.app";

function normalizeSiteUrl(value: string | undefined): string {
    if (!value) {
        return FALLBACK_SITE_URL;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return FALLBACK_SITE_URL;
    }

    return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const siteName = "Aphelios Calculator";
export const homePageDescription =
    "Compare League of Legends item builds, analyze Aphelios Q vs E breakpoints, and model Collector execute value.";
export const calculatorPageDescription =
    "Compare damage output across League of Legends item builds and armor ranges with shareable build setups.";
export const collectorPageDescription =
    "Estimate expected damage contributed by The Collector execute effect as target HP and attack damage change.";
export const apheliosCutoffPageDescription =
    "Analyze Aphelios Q vs E leveling paths with timeline-based item purchases and target armor assumptions.";
export const greedyVsBestAverageDescription =
    "Greedy picks the best upgrade level by level, while Best Average finds the path with the strongest average performance across all levels.";
export const defaultDescription = homePageDescription;
export const defaultOgImage = "/images/items/Infinity_Edge.png";

export const allowIndexing = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === "production"
    : process.env.NODE_ENV === "production";

export const siteUrlObject = (() => {
    try {
        return new URL(siteUrl);
    } catch {
        return new URL(FALLBACK_SITE_URL);
    }
})();

export function absoluteUrl(path: string): string {
    return new URL(path, `${siteUrlObject.toString().replace(/\/$/, "")}/`).toString();
}
