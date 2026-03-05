import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import ApheliosCutoffAnalysis from "../features/aphelios-cutoff/components/ApheliosCutoffAnalysis";
import { absoluteUrl, apheliosCutoffPageDescription, siteName } from "../lib/seo";
import "../styles/ApheliosCutoffPage.css";

export const metadata: Metadata = {
    title: "Aphelios Q vs E Leveling Analysis",
    description: apheliosCutoffPageDescription,
    alternates: {
        canonical: "/aphelios-cutoff",
    },
    openGraph: {
        siteName,
        title: "Aphelios Q vs E Leveling Analysis",
        description: apheliosCutoffPageDescription,
        url: absoluteUrl("/aphelios-cutoff"),
    },
    twitter: {
        title: "Aphelios Q vs E Leveling Analysis",
        description: apheliosCutoffPageDescription,
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
