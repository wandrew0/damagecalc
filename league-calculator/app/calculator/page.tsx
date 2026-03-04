import type { Metadata } from "next";
import CalculatorPage from "../features/calculator/CalculatorPage";
import { absoluteUrl } from "../lib/seo";

export const metadata: Metadata = {
    title: "LoL Build Damage Calculator",
    description:
        "Compare damage output across League of Legends item builds and armor ranges with shareable build setups.",
    alternates: {
        canonical: "/calculator",
    },
    openGraph: {
        title: "LoL Build Damage Calculator",
        description:
            "Compare damage output across League of Legends item builds and armor ranges with shareable build setups.",
        url: absoluteUrl("/calculator"),
    },
    twitter: {
        title: "LoL Build Damage Calculator",
        description:
            "Compare damage output across League of Legends item builds and armor ranges with shareable build setups.",
    },
};

export default function CalculatorRoutePage() {
    return (
        <main>
            <CalculatorPage />
        </main>
    );
}
