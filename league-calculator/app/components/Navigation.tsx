"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavigationProps {
    className?: string;
}

export default function Navigation({ className }: NavigationProps) {
    const pathname = usePathname();
    const navClassName = ["nav", className].filter(Boolean).join(" ");

    return (
        <nav className={navClassName}>
            <Link
                href="/"
                prefetch={false}
                className={`nav-link ${pathname === "/" ? "active" : ""}`}
            >
                Home
            </Link>
            <Link
                href="/calculator"
                prefetch={false}
                className={`nav-link ${pathname === "/calculator" ? "active" : ""}`}
            >
                Calculator
            </Link>
            <Link
                href="/aphelios-cutoff"
                prefetch={false}
                className={`nav-link ${
                    pathname === "/aphelios-cutoff" ? "active" : ""
                }`}
            >
                Aphelios Q vs E
            </Link>
            <Link
                href="/collector"
                prefetch={false}
                className={`nav-link ${pathname === "/collector" ? "active" : ""}`}
            >
                Collector
            </Link>
        </nav>
    );
}
