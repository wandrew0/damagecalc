import type { Metadata } from "next";
import HomePage from "./features/home/HomePage";
import "./styles/HomePage.css";
import {
    absoluteUrl,
    defaultDescription,
    defaultOgImage,
    homePageDescription,
    siteName,
} from "./lib/seo";

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
        images: [
            {
                url: absoluteUrl(defaultOgImage),
                alt: `${siteName} preview`,
            },
        ],
    },
    twitter: {
        title: "Aphelios Calculator",
        description: defaultDescription,
        images: [absoluteUrl(defaultOgImage)],
    },
};

export default function Page() {
    return <HomePage />;
}
