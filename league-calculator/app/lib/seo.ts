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
export const siteName = "League Auto Calculator";
export const defaultDescription =
    "League of Legends damage analysis tools for comparing builds, evaluating Aphelios Q vs E leveling, and understanding Collector execute value.";
export const defaultOgImage = "/images/previews/stormrazor-blur.png";

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
