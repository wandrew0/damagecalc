"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "../styles/Navigation.css";

interface NavigationProps {
    className?: string;
}

export default function Navigation({ className }: NavigationProps) {
    const pathname = usePathname();
    const navClassName = ["nav", className].filter(Boolean).join(" ");

    return (
        <nav className={navClassName}>
            <Link href="/" className={`nav-link ${pathname === "/" ? "active" : ""}`}>
                Calculator
            </Link>
            <Link
                href="/collector"
                className={`nav-link ${pathname === "/collector" ? "active" : ""}`}
            >
                Collector
            </Link>
        </nav>
    );
}
