import type { Metadata } from "next";
import HomePage from "./features/home/HomePage";
import "./styles/HomePage.css";
import { absoluteUrl, defaultDescription, homePageDescription, siteName } from "./lib/seo";

export const metadata: Metadata = {
    title: "Aphelios Calculator",
    description: homePageDescription,
    alternates: {
        canonical: "/",
    },
    openGraph: {
        siteName,
        title: "Aphelios Calculator",
        description: defaultDescription,
        url: absoluteUrl("/"),
    },
    twitter: {
        title: "Aphelios Calculator",
        description: defaultDescription,
    },
};

export default function Page() {
    return <HomePage />;
}
