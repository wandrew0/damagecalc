import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import ApheliosCutoffAnalysis from "../features/aphelios-cutoff/components/ApheliosCutoffAnalysis";
import { absoluteUrl } from "../lib/seo";
import "../styles/ApheliosCutoffPage.css";

export const metadata: Metadata = {
    title: "Aphelios Q vs E Leveling Analysis",
    description:
        "Analyze Aphelios Q vs E leveling paths with timeline-based item purchases and target armor assumptions.",
    alternates: {
        canonical: "/aphelios-cutoff",
    },
    openGraph: {
        title: "Aphelios Q vs E Leveling Analysis",
        description:
            "Analyze Aphelios Q vs E leveling paths with timeline-based item purchases and target armor assumptions.",
        url: absoluteUrl("/aphelios-cutoff"),
    },
    twitter: {
        title: "Aphelios Q vs E Leveling Analysis",
        description:
            "Analyze Aphelios Q vs E leveling paths with timeline-based item purchases and target armor assumptions.",
    },
};

export default function ApheliosCutoffPage() {
    return (
        <div className="collector-page-wrapper">
            <AppHeader title="Aphelios Q vs E" />
            <main className="collector-page">
                <ApheliosCutoffAnalysis />
            </main>
        </div>
    );
}
