import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";
import ApheliosCutoffAnalysis from "../features/aphelios-cutoff/components/ApheliosCutoffAnalysis";
import {
    absoluteUrl,
    apheliosCutoffPageDescription,
    defaultOgImage,
    siteName,
} from "../lib/seo";
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
        images: [
            {
                url: absoluteUrl(defaultOgImage),
                alt: `${siteName} preview`,
            },
        ],
    },
    twitter: {
        title: "Aphelios Q vs E Leveling Analysis",
        description: apheliosCutoffPageDescription,
        images: [absoluteUrl(defaultOgImage)],
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
