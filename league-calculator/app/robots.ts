import type { MetadataRoute } from "next";
import { allowIndexing, absoluteUrl } from "./lib/seo";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: allowIndexing
            ? {
                  userAgent: "*",
                  allow: "/",
              }
            : {
                  userAgent: "*",
                  disallow: "/",
              },
        sitemap: absoluteUrl("/sitemap.xml"),
        host: absoluteUrl("/"),
    };
}
