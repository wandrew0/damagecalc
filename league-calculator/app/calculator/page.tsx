import type { Metadata } from "next";
import CalculatorPage from "../features/calculator/CalculatorPage";
import {
    absoluteUrl,
    calculatorPageDescription,
    defaultOgImage,
    siteName,
} from "../lib/seo";

export const metadata: Metadata = {
    title: "Build Calculator",
    description: calculatorPageDescription,
    alternates: {
        canonical: "/calculator",
    },
    openGraph: {
        siteName,
        title: "Build Calculator",
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
        title: "Build Calculator",
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
