"use client";

import Link from "next/link";
import { useEffect } from "react";
import AppHeader from "../../components/AppHeader";

const DORANS_BLADE_BLUR_AVIF = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUEAAAD5bWV0YQAAAAAAAAAvaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAFBpY3R1cmVIYW5kbGVyAAAAAA5waXRtAAAAAAABAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAASEAAAEeAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAAGppcHJwAAAAS2lwY28AAAAUaXNwZQAAAAAAAACAAAAAgAAAABBwaXhpAAAAAAMICAgAAAAMYXYxQ4EgAAAAAAATY29scm5jbHgAAgACAACAAAAAF2lwbWEAAAAAAAAAAQABBAECgwQAAAEmbWRhdAoJOBm//2kBDQAgMpACEeACCCCBJZYAGHkpMdOXtGFo5Q6bDzg/znRMNHtwefvfG944I9j08moczi4saMtAnXn35V665KRL2DU2nbwpF6Gpb0nj83lVDN0LacF1ILtRCfbrtIjo36EFJ/+e/Y5Gxypo9C8gvf3l8Asx9o7GEb/Cwfl3Jya2+lJ7MUBezGzGSpmFZplJKtNuzYWfYU/7ieT1x9xxEwKnKiXtx3bzQWUTHnCIfLgH0lyIlMdD11fMv1Y7qNuqNoWP1GXSVTKI+XfgMgKjgTeyko3zIp2i7YLnr8jpEjfNTzshzzGS66u/eG5wFHSV0JgNlxYWmtDkHYG3g/gXXD6sxsES2CajsP0RA1Q3IrinnaShBkD2beA";
const STORMRAZOR_BLUR_AVIF = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUEAAAD5bWV0YQAAAAAAAAAvaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAFBpY3R1cmVIYW5kbGVyAAAAAA5waXRtAAAAAAABAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAASEAAADaAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAAGppcHJwAAAAS2lwY28AAAAUaXNwZQAAAAAAAACAAAAAgAAAABBwaXhpAAAAAAMICAgAAAAMYXYxQ4EgAAAAAAATY29scm5jbHgAAgACAACAAAAAF2lwbWEAAAAAAAAAAQABBAECgwQAAADibWRhdAoJOBm//2kBDQAgMswBEeABBCBBJZYAEz4HTb2RheG67ib6mqdhG7VKvKqyhBRXAmRd4+ml35rHwxpFmV9vEh5FCSPFs3dLM5Q/Y5ShRaLWaHLazi0xLkC7phCWaEUe74R8xqnKUQilfEV2apZgKIDgaxtDyJFHDRpwIPredXEjRoanudtNmYB+LBQb3MkgC13gsUhyO01gobKArMgwkBSAe2jQRYqrCY8Fa93m1bJsZBxsUuxs1v/L20f1AFWPy38mvJ0AxblWZ+SVjLQvUFwCnR1QRrzBJzyy";
const INFINITY_EDGE_BLUR_AVIF = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUEAAAD5bWV0YQAAAAAAAAAvaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAFBpY3R1cmVIYW5kbGVyAAAAAA5waXRtAAAAAAABAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAASEAAACqAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAAGppcHJwAAAAS2lwY28AAAAUaXNwZQAAAAAAAACAAAAAgAAAABBwaXhpAAAAAAMICAgAAAAMYXYxQ4EgAAAAAAATY29scm5jbHgAAgACAACAAAAAF2lwbWEAAAAAAAAAAQABBAECgwQAAACybWRhdAoJOBm//2kBDQAgMpwBRHgAQQQQSWWAEl70YNxmNkoI6HGJCdAt8dPFnydAvDSyQPUDyyEisG/7g3XKLbekaCFrVcS+ChhxUM29qLcmvdwH50Os9nxfFBOtvLeiozHRKah0Fr2Tj2VCjSqFBGIBLDf/0iSZgHE6iUe8+spmZJbkdguLeAjPmEeDb4JY7XrBCebzzUsEJz2+A/REHlYTPpb9AC/mTxht97zY";
const LORD_DOMINIKS_REGARDS_BLUR_AVIF = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUEAAAD5bWV0YQAAAAAAAAAvaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAFBpY3R1cmVIYW5kbGVyAAAAAA5waXRtAAAAAAABAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAASEAAADAAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAAGppcHJwAAAAS2lwY28AAAAUaXNwZQAAAAAAAACAAAAAgAAAABBwaXhpAAAAAAMICAgAAAAMYXYxQ4EgAAAAAAATY29scm5jbHgAAgACAACAAAAAF2lwbWEAAAAAAAAAAQABBAECgwQAAADIbWRhdAoJOBm//2kBDQAgMrIBEeABBBBBJZYAD/l6Jily8fD26brdCWYJO/20VHhmVpmn5l30lcuIht7GK36oFVBVACA5QiHeTB4COhUNhQvDEekN/Z0vQvLhEfwB/8PQ3kaiY8J8XgXPfxTpMaaHVOyFhmuz7BPbXsi5wjOjDshjBEAD78WkPzkNWF6qRl4B7Ctqj8n/IjWitILXV79lqlu0LYp0I/bmjAU7uHlKniMzCiIzDozLXpEYDC7RaEZ9bdG5QA";

function CalculatorPreview() {
    const chartLeft = 176;
    const chartRight = 286;
    const chartTop = 44;
    const chartBottom = 138;
    const armorMax = 200;

    const redPremitDamage = 375;
    const greenPremitDamage = 283;
    const redArmorPen = 0;
    const greenArmorPen = 0.35;
    const greenVisualLiftPx = 2.5;
    const lineBottomInsetPx = 15;

    const damageMin = 120;
    const damageMax = 380;
    const armorSamples = Array.from({ length: 21 }, (_, sampleIndex) => sampleIndex * 10);

    const toDamage = (armorValue: number, premitDamage: number, armorPen: number) =>
        premitDamage * (100 / (100 + armorValue * (1 - armorPen)));

    const toChartPoint = (armorValue: number, damageValue: number, yOffsetPx = 0) => {
        const x =
            chartLeft + ((chartRight - chartLeft) * Math.max(0, Math.min(armorMax, armorValue))) / armorMax;
        const normalized = (damageValue - damageMin) / (damageMax - damageMin);
        const curveBottom = chartBottom - lineBottomInsetPx;
        const y =
            curveBottom -
            (curveBottom - chartTop) * Math.max(0, Math.min(1, normalized)) -
            yOffsetPx;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    // Approximate the real calculator slope/crossover with sampled armor values.
    const redPoints = armorSamples
        .map((armorValue) =>
            toChartPoint(armorValue, toDamage(armorValue, redPremitDamage, redArmorPen))
        )
        .join(" ");
    const greenPoints = armorSamples
        .map((armorValue) =>
            toChartPoint(
                armorValue,
                toDamage(armorValue, greenPremitDamage, greenArmorPen),
                greenVisualLiftPx
            )
        )
        .join(" ");

    return (
        <svg
            viewBox="0 0 320 180"
            role="img"
            aria-label="Calculator preview"
            xmlnsXlink="http://www.w3.org/1999/xlink"
        >
            <defs>
                <linearGradient id="home-chart-grid" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#e2e8f0" />
                    <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>
                <clipPath id="home-chip-26-48" clipPathUnits="userSpaceOnUse">
                    <rect x="26" y="48" width="28" height="28" rx="4" />
                </clipPath>
                <clipPath id="home-chip-58-48" clipPathUnits="userSpaceOnUse">
                    <rect x="58" y="48" width="28" height="28" rx="4" />
                </clipPath>
                <clipPath id="home-chip-90-48" clipPathUnits="userSpaceOnUse">
                    <rect x="90" y="48" width="28" height="28" rx="4" />
                </clipPath>
                <clipPath id="home-chip-34-103" clipPathUnits="userSpaceOnUse">
                    <rect x="34" y="103" width="28" height="28" rx="4" />
                </clipPath>
                <clipPath id="home-chip-66-103" clipPathUnits="userSpaceOnUse">
                    <rect x="66" y="103" width="28" height="28" rx="4" />
                </clipPath>
                <clipPath id="home-chip-98-103" clipPathUnits="userSpaceOnUse">
                    <rect x="98" y="103" width="28" height="28" rx="4" />
                </clipPath>
            </defs>
            <g transform="translate(0 -3)">
                <image
                    href={DORANS_BLADE_BLUR_AVIF}
                    xlinkHref={DORANS_BLADE_BLUR_AVIF}
                    x="26"
                    y="48"
                    width="28"
                    height="28"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="url(#home-chip-26-48)"
                />
                <rect x="26" y="48" width="28" height="28" rx="4" fill="none" stroke="#0f172a" strokeOpacity="0.16" />
                <image
                    href={STORMRAZOR_BLUR_AVIF}
                    xlinkHref={STORMRAZOR_BLUR_AVIF}
                    x="58"
                    y="48"
                    width="28"
                    height="28"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="url(#home-chip-58-48)"
                />
                <rect x="58" y="48" width="28" height="28" rx="4" fill="none" stroke="#0f172a" strokeOpacity="0.16" />
                <image
                    href={INFINITY_EDGE_BLUR_AVIF}
                    xlinkHref={INFINITY_EDGE_BLUR_AVIF}
                    x="90"
                    y="48"
                    width="28"
                    height="28"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="url(#home-chip-90-48)"
                />
                <rect x="90" y="48" width="28" height="28" rx="4" fill="none" stroke="#0f172a" strokeOpacity="0.15" />

                <image
                    href={DORANS_BLADE_BLUR_AVIF}
                    xlinkHref={DORANS_BLADE_BLUR_AVIF}
                    x="34"
                    y="103"
                    width="28"
                    height="28"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="url(#home-chip-34-103)"
                />
                <rect x="34" y="103" width="28" height="28" rx="4" fill="none" stroke="#0f172a" strokeOpacity="0.16" />
                <image
                    href={STORMRAZOR_BLUR_AVIF}
                    xlinkHref={STORMRAZOR_BLUR_AVIF}
                    x="66"
                    y="103"
                    width="28"
                    height="28"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="url(#home-chip-66-103)"
                />
                <rect x="66" y="103" width="28" height="28" rx="4" fill="none" stroke="#0f172a" strokeOpacity="0.16" />
                <image
                    href={LORD_DOMINIKS_REGARDS_BLUR_AVIF}
                    xlinkHref={LORD_DOMINIKS_REGARDS_BLUR_AVIF}
                    x="98"
                    y="103"
                    width="28"
                    height="28"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="url(#home-chip-98-103)"
                />
                <rect x="98" y="103" width="28" height="28" rx="4" fill="none" stroke="#0f172a" strokeOpacity="0.15" />

                <line x1="174" y1="138" x2="286" y2="138" stroke="#94a3b8" />
                <line x1="174" y1="44" x2="174" y2="138" stroke="#94a3b8" />
                <line x1="174" y1="115" x2="286" y2="115" stroke="url(#home-chart-grid)" strokeDasharray="3 3" />
                <line x1="174" y1="88" x2="286" y2="88" stroke="url(#home-chart-grid)" strokeDasharray="3 3" />
                <line x1="174" y1="61" x2="286" y2="61" stroke="url(#home-chart-grid)" strokeDasharray="3 3" />

                <polyline
                    points={redPoints}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <polyline
                    points={greenPoints}
                    fill="none"
                    stroke="#52c41a"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>
        </svg>
    );
}

function ApheliosPreview() {
    const columns = Array.from({ length: 11 }, (_, index) => index);
    const svgWidth = 320;
    const svgHeight = 180;
    const colStep = 24;
    const cellWidth = 20;
    const rowHeight = 20;
    const gridWidth = (columns.length - 1) * colStep + cellWidth;
    const gridHeight = colStep * 2 + rowHeight;
    const baseX = (svgWidth - gridWidth) / 2;
    const rowStartY = (svgHeight - gridHeight) / 2;

    const pathQ = new Set([1, 2, 3, 4, 6, 8]);
    const pathW = new Set([0]);
    const pathE = new Set([5, 7, 9, 10]);

    const columnX = (column: number) => baseX + column * colStep;

    const renderBaseRow = (rowY: number, rowKey: string) =>
        columns.map((column) => (
            <rect
                key={`${rowKey}-base-${column}`}
                x={columnX(column)}
                y={rowY}
                width={cellWidth}
                height={rowHeight}
                rx="4"
                fill="#f3f4f6"
                stroke="#e5e7eb"
            />
        ));

    const renderFilledRow = (rowY: number, rowKey: string, activeColumns: Set<number>, fillColor: string) =>
        columns
            .filter((column) => activeColumns.has(column))
            .map((column) => (
                <rect
                    key={`${rowKey}-fill-${column}`}
                    x={columnX(column)}
                    y={rowY}
                    width={cellWidth}
                    height={rowHeight}
                    rx="4"
                    fill={fillColor}
                />
            ));

    return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Aphelios Q versus E preview">
            {renderBaseRow(rowStartY, "path-q")}
            {renderBaseRow(rowStartY + colStep, "path-w")}
            {renderBaseRow(rowStartY + colStep * 2, "path-e")}

            {renderFilledRow(rowStartY, "path-q", pathQ, "#f2a617")}
            {renderFilledRow(rowStartY + colStep, "path-w", pathW, "#e6df88")}
            {renderFilledRow(rowStartY + colStep * 2, "path-e", pathE, "#f0674a")}
        </svg>
    );
}

function CollectorPreview() {
    const chartLeft = 34;
    const chartRight = 286;
    const chartTop = 80;
    const baseY = 150;
    const smoothAmplitude = 17;
    const smoothTau = 50;
    const sawtoothCount = 8;
    const sawtoothSpan = (chartRight - chartLeft) / sawtoothCount;
    const sawtoothPeakRatio = 0.22;
    const sawtoothInitialAmp = 64;
    const sawtoothDecay = 0.58;
    const smoothPoints = Array.from({ length: 33 }, (_, sampleIndex) => {
        const ratio = sampleIndex / 32;
        const x = chartLeft + (chartRight - chartLeft) * ratio;
        const y = baseY - smoothAmplitude * Math.exp(-(x - chartLeft) / smoothTau);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const sawtoothPoints: string[] = [`${chartLeft.toFixed(1)},${baseY.toFixed(1)}`];
    for (let tooth = 0; tooth < sawtoothCount; tooth++) {
        const toothStartX = chartLeft + tooth * sawtoothSpan;
        const toothPeakX = toothStartX + sawtoothSpan * sawtoothPeakRatio;
        const toothEndX = toothStartX + sawtoothSpan;
        const amplitude = sawtoothInitialAmp * Math.pow(sawtoothDecay, tooth);
        const toothPeakY = baseY - amplitude;

        sawtoothPoints.push(
            `${toothPeakX.toFixed(1)},${toothPeakY.toFixed(1)}`,
            `${toothPeakX.toFixed(1)},${baseY.toFixed(1)}`,
            `${toothEndX.toFixed(1)},${baseY.toFixed(1)}`
        );
    }

    return (
        <svg viewBox="0 0 320 180" role="img" aria-label="Collector execute preview">
            <line x1="34" y1="34" x2="98" y2="34" stroke="#f2b61f" strokeWidth="8" strokeLinecap="butt" />
            <line x1="98" y1="34" x2="286" y2="34" stroke="#22c55e" strokeWidth="8" strokeLinecap="butt" />
            <line x1="34" y1="21" x2="34" y2="47" stroke="#111827" strokeWidth="6" />
            <line x1="98" y1="21" x2="98" y2="47" stroke="#dc2626" strokeWidth="6" />

            <line x1={chartLeft} y1={baseY} x2={chartRight} y2={baseY} stroke="#94a3b8" />
            <line x1={chartLeft} y1={chartTop} x2={chartLeft} y2={baseY} stroke="#94a3b8" />
            <polyline
                points={smoothPoints}
                fill="none"
                stroke="#ee7f9f"
                strokeWidth="3.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            <polyline
                points={sawtoothPoints.join(" ")}
                fill="none"
                stroke="#69aef1"
                strokeWidth="3.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function HomePage() {
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.location.hash.includes("builds=")) {
            window.location.replace(`/calculator${window.location.hash}`);
        }
    }, []);

    return (
        <div className="collector-page-wrapper">
            <AppHeader title="League Auto Calculator" />
            <main className="collector-page home-page">
                <section className="home-tools-grid">
                    <article className="home-tool-card">
                        <Link href="/calculator" className="home-tool-card-link">
                            <div className="home-tool-visual">
                                <CalculatorPreview />
                            </div>
                            <h3>Calculator</h3>
                            <p>Compare builds with different item combinations across a range of armor.</p>
                        </Link>
                    </article>

                    <article className="home-tool-card">
                        <Link href="/aphelios-cutoff" className="home-tool-card-link">
                            <div className="home-tool-visual">
                                <ApheliosPreview />
                            </div>
                            <h3>Aphelios Q vs E</h3>
                            <p>Explore Q vs E leveling with different recall timings and purchases.</p>
                        </Link>
                    </article>

                    <article className="home-tool-card">
                        <Link href="/collector" className="home-tool-card-link">
                            <div className="home-tool-visual">
                                <CollectorPreview />
                            </div>
                            <h3>Collector</h3>
                            <p>Learn the expected bonus damage from Collector as HP and damage change.</p>
                        </Link>
                    </article>
                </section>
            </main>
        </div>
    );
}
