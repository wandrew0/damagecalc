import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import CollectorAnalysis from "../features/collector/components/CollectorAnalysis";
import { absoluteUrl } from "../lib/seo";

export const metadata: Metadata = {
    title: "Collector Execute Damage Calculator",
    description:
        "Estimate expected damage contributed by The Collector execute effect as target HP and attack damage change.",
    alternates: {
        canonical: "/collector",
    },
    openGraph: {
        title: "Collector Execute Damage Calculator",
        description:
            "Estimate expected damage contributed by The Collector execute effect as target HP and attack damage change.",
        url: absoluteUrl("/collector"),
    },
    twitter: {
        title: "Collector Execute Damage Calculator",
        description:
            "Estimate expected damage contributed by The Collector execute effect as target HP and attack damage change.",
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
