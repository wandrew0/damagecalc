import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import CollectorAnalysis from "../features/collector/components/CollectorAnalysis";
import {
    absoluteUrl,
    collectorPageDescription,
    defaultOgImage,
    siteName,
} from "../lib/seo";

export const metadata: Metadata = {
    title: "Collector Analysis",
    description: collectorPageDescription,
    alternates: {
        canonical: "/collector",
    },
    openGraph: {
        siteName,
        title: "Collector Analysis",
        description: collectorPageDescription,
        url: absoluteUrl("/collector"),
        images: [
            {
                url: absoluteUrl(defaultOgImage),
                alt: `${siteName} preview`,
            },
        ],
    },
    twitter: {
        title: "Collector Analysis",
        description: collectorPageDescription,
        images: [absoluteUrl(defaultOgImage)],
    },
};

export default function CollectorPage() {
    return (
        <div className="collector-page-wrapper collector-page-wrapper--collector">
            <AppHeader title="Average Collector Value" />
            <main className="collector-page collector-page-columns collector-page--collector">
                <CollectorAnalysis />
            </main>
        </div>
    );
}
