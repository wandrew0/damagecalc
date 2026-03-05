import type { Metadata } from "next";
import CalculatorPage from "../features/calculator/CalculatorPage";
import { absoluteUrl, calculatorPageDescription, siteName } from "../lib/seo";

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
    },
    twitter: {
        title: "LoL Build Damage Calculator",
        description: calculatorPageDescription,
    },
};

export default function CalculatorRoutePage() {
    return (
        <main>
            <CalculatorPage />
        </main>
    );
}
