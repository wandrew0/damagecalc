import type { Metadata } from "next";
import HomePage from "./features/home/HomePage";
import "./styles/HomePage.css";
import { absoluteUrl, defaultDescription } from "./lib/seo";

export const metadata: Metadata = {
    title: "League Auto Calculator",
    description:
        "Compare League of Legends item builds, analyze Aphelios Q vs E breakpoints, and model Collector execute value.",
    alternates: {
        canonical: "/",
    },
    openGraph: {
        title: "League Auto Calculator",
        description: defaultDescription,
        url: absoluteUrl("/"),
    },
    twitter: {
        title: "League Auto Calculator",
        description: defaultDescription,
    },
};

export default function Page() {
    return <HomePage />;
}
