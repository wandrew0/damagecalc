import type { MetadataRoute } from "next";
import { absoluteUrl } from "./lib/seo";

const indexableRoutes = ["/", "/calculator", "/aphelios-cutoff", "/collector"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
    const lastModified = new Date();

    return indexableRoutes.map((route) => ({
        url: absoluteUrl(route),
        lastModified,
        changeFrequency: route === "/" ? "daily" : "weekly",
        priority: route === "/" ? 1 : 0.8,
    }));
}
