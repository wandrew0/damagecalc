import type { Metadata } from "next";
import CalculatorPage from "../features/calculator/CalculatorPage";
import {
    absoluteUrl,
    calculatorPageDescription,
    defaultOgImage,
    siteName,
} from "../lib/seo";

export const metadata: Metadata = {
    title: "LoL Build Damage Calculator",
    description: calculatorPageDescription,
    alternates: {
        canonical: "/calculator",
    },
    openGraph: {
        siteName,
        title: "LoL Build Damage Calculator",
        description: calculatorPageDescription,
        url: absoluteUrl("/calculator"),
        images: [
            {
                url: absoluteUrl(defaultOgImage),
                alt: `${siteName} preview`,
            },
        ],
    },
    twitter: {
        title: "LoL Build Damage Calculator",
        description: calculatorPageDescription,
        images: [absoluteUrl(defaultOgImage)],
    },
};

export default function CalculatorRoutePage() {
    return (
        <main>
            <CalculatorPage />
        </main>
    );
}
