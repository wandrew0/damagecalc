import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import CollectorAnalysis from "../features/collector/components/CollectorAnalysis";
import { absoluteUrl, collectorPageDescription, siteName } from "../lib/seo";

export const metadata: Metadata = {
    title: "Collector Execute Damage Calculator",
    description: collectorPageDescription,
    alternates: {
        canonical: "/collector",
    },
    openGraph: {
        siteName,
        title: "Collector Execute Damage Calculator",
        description: collectorPageDescription,
        url: absoluteUrl("/collector"),
    },
    twitter: {
        title: "Collector Execute Damage Calculator",
        description: collectorPageDescription,
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
