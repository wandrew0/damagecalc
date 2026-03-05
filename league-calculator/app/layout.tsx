import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./styles/BaseTheme.css";
import { Analytics } from "@vercel/analytics/next";
import {
    absoluteUrl,
    allowIndexing,
    defaultDescription,
    defaultOgImage,
    siteName,
    siteUrlObject,
} from "./lib/seo";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    metadataBase: siteUrlObject,
    title: {
        default: siteName,
        template: `%s | ${siteName}`,
    },
    description: defaultDescription,
    verification: {
        google: "usaS-bhX8KytxnIq95F_9j96OFcyxCeiLPLXoh3Dd1A",
    },
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        siteName,
        title: siteName,
        description: defaultDescription,
        url: "/",
        images: [
            {
                url: absoluteUrl(defaultOgImage),
                alt: `${siteName} preview`,
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: siteName,
        description: defaultDescription,
        images: [absoluteUrl(defaultOgImage)],
    },
    robots: allowIndexing
        ? {
              index: true,
              follow: true,
              googleBot: {
                  index: true,
                  follow: true,
                  "max-image-preview": "large",
                  "max-snippet": -1,
                  "max-video-preview": -1,
              },
          }
        : {
              index: false,
              follow: false,
          },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebSite",
                name: siteName,
                url: siteUrlObject.toString().replace(/\/$/, ""),
            },
            {
                "@type": "SoftwareApplication",
                name: siteName,
                applicationCategory: "GameApplication",
                operatingSystem: "Web",
                url: siteUrlObject.toString().replace(/\/$/, ""),
                description: defaultDescription,
            },
        ],
    };

    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />
                {children}
                {process.env.VERCEL ? <Analytics /> : null}
            </body>
        </html>
    );
}
