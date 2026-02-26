"use client";

import React from "react";

interface CollectorConceptVizProps {
    caseNumber: "1" | "2";
}

export default function CollectorConceptViz({ caseNumber }: CollectorConceptVizProps) {
    if (caseNumber === "1") {
        return (
            <div className="concept-viz-single">
                <div className="concept-case">
                    <svg viewBox="0 0 500 150" className="concept-svg">
                        {/* HP Bar Line */}
                        <line
                            x1="50"
                            y1="75"
                            x2="450"
                            y2="75"
                            stroke="#e5e5e5"
                            strokeWidth="3"
                        />

                        {/* 0 HP Marker */}
                        <line
                            x1="100"
                            y1="65"
                            x2="100"
                            y2="85"
                            stroke="#171717"
                            strokeWidth="2"
                        />
                        <text
                            x="100"
                            y="105"
                            textAnchor="middle"
                            fontSize="12"
                            fill="#171717"
                            fontWeight="600"
                        >
                            0 HP
                        </text>

                        {/* 5% Threshold Marker */}
                        <line
                            x1="300"
                            y1="65"
                            x2="300"
                            y2="85"
                            stroke="#dc2626"
                            strokeWidth="2"
                        />
                        <text
                            x="300"
                            y="55"
                            textAnchor="middle"
                            fontSize="12"
                            fill="#dc2626"
                            fontWeight="600"
                        >
                            5% HP
                        </text>

                        {/* 5% + A Marker */}
                        <line
                            x1="380"
                            y1="65"
                            x2="380"
                            y2="85"
                            stroke="#171717"
                            strokeWidth="2"
                        />
                        <text
                            x="380"
                            y="55"
                            textAnchor="middle"
                            fontSize="12"
                            fill="#171717"
                            fontWeight="600"
                        >
                            5% + A
                        </text>

                        {/* Animated Execute Damage - thick gold line from 0 HP to arrow tip */}
                        <line
                            x1="100"
                            y1="75"
                            stroke="#eab308"
                            strokeWidth="6"
                            opacity="0.7"
                        >
                            <animate
                                attributeName="x2"
                                values="220;300;220"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                            <animate
                                attributeName="y2"
                                values="75;75;75"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                        </line>

                        <text
                            textAnchor="middle"
                            y="35"
                            fontSize="11"
                            fill="#854d0e"
                            fontWeight="500"
                        >
                            <animate
                                attributeName="x"
                                values="220;300;220"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                            Execute Damage
                        </text>

                        {/* Animated Auto Damage Arrow - arrowhead at left end, line extends right */}
                        <g>
                            {/* Arrowhead - tip at execute damage endpoint, base extends right */}
                            <polygon fill="#171717">
                                <animate
                                    attributeName="points"
                                    values="220,75 230,70 230,80;300,75 310,70 310,80;220,75 230,70 230,80"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                            </polygon>

                            {/* Arrow line - starts just after arrowhead, extends to right */}
                            <line y1="75" y2="75" stroke="#171717" strokeWidth="3">
                                <animate
                                    attributeName="x1"
                                    values="230;310;230"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                                <animate
                                    attributeName="x2"
                                    values="300;380;300"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                            </line>

                            <text
                                textAnchor="middle"
                                y="125"
                                fontSize="11"
                                fill="#171717"
                                fontWeight="500"
                            >
                                <animate
                                    attributeName="x"
                                    values="260;340;260"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                                Auto Damage (A)
                            </text>
                        </g>
                    </svg>
                </div>
            </div>
        );
    } else {
        return (
            <div className="concept-viz-single">
                <div className="concept-case">
                    <svg viewBox="0 0 500 150" className="concept-svg">
                        <defs>
                            <pattern
                                id="hatch-pattern"
                                width="4"
                                height="4"
                                patternUnits="userSpaceOnUse"
                                patternTransform="rotate(45)"
                            >
                                <rect
                                    width="2"
                                    height="4"
                                    transform="translate(0,0)"
                                    fill="rgba(107, 114, 128, 0.3)"
                                />
                            </pattern>
                        </defs>

                        {/* HP Bar Line */}
                        <line
                            x1="50"
                            y1="75"
                            x2="450"
                            y2="75"
                            stroke="#e5e5e5"
                            strokeWidth="3"
                        />

                        {/* -(A - 5% HP) Marker */}
                        <line
                            x1="70"
                            y1="65"
                            x2="70"
                            y2="85"
                            stroke="#171717"
                            strokeWidth="2"
                        />
                        <text
                            x="70"
                            y="55"
                            textAnchor="middle"
                            fontSize="12"
                            fill="#171717"
                            fontWeight="600"
                        >
                            -(A - 5%)
                        </text>

                        {/* 0 HP Marker */}
                        <line
                            x1="150"
                            y1="65"
                            x2="150"
                            y2="85"
                            stroke="#171717"
                            strokeWidth="2"
                        />
                        <text
                            x="150"
                            y="105"
                            textAnchor="middle"
                            fontSize="12"
                            fill="#171717"
                            fontWeight="600"
                        >
                            0 HP
                        </text>

                        {/* 5% Threshold Marker */}
                        <line
                            x1="250"
                            y1="65"
                            x2="250"
                            y2="85"
                            stroke="#dc2626"
                            strokeWidth="2"
                        />
                        <text
                            x="250"
                            y="55"
                            textAnchor="middle"
                            fontSize="12"
                            fill="#dc2626"
                            fontWeight="600"
                        >
                            5% HP
                        </text>

                        {/* 5% + A Marker */}
                        <line
                            x1="430"
                            y1="65"
                            x2="430"
                            y2="85"
                            stroke="#171717"
                            strokeWidth="2"
                        />
                        <text
                            x="430"
                            y="55"
                            textAnchor="middle"
                            fontSize="12"
                            fill="#171717"
                            fontWeight="600"
                        >
                            5% + A
                        </text>

                        {/* Animated Overkill Bar - from arrow tip to 0 HP, disappears when > 0 HP */}
                        <line
                            x2="150"
                            y1="75"
                            y2="75"
                            stroke="#6b7280"
                            strokeWidth="6"
                            opacity="0.7"
                        >
                            {/* x1 tracks arrow tip (20->100), then stays at 100 */}
                            <animate
                                attributeName="x1"
                                values="70; 150; 150; 150; 70"
                                keyTimes="0; 0.22; 0.5; 0.78; 1"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                            {/* Hide when length is 0 (arrow > 0 HP) - Instant switch */}
                            <animate
                                attributeName="strokeWidth"
                                values="6; 6; 0; 0; 6; 6"
                                keyTimes="0; 0.22; 0.221; 0.779; 0.78; 1"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                        </line>
                        <text
                            textAnchor="middle"
                            y="125"
                            fontSize="11"
                            fill="#6b7280"
                            fontWeight="500"
                        >
                            {/* Text follows tip of overkill bar (20->100) */}
                            <animate
                                attributeName="x"
                                values="70; 150; 150; 150; 70"
                                keyTimes="0; 0.22; 0.5; 0.78; 1"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                            {/* Instant switch: Visible when < 0.22, Hidden when > 0.22 */}
                            <animate
                                attributeName="opacity"
                                values="1; 1; 0; 0; 1; 1"
                                keyTimes="0; 0.22; 0.221; 0.779; 0.78; 1"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                            Overkill
                        </text>

                        {/* Animated Execute Damage - matches arrowhead tip position, clamped at 0 HP (100) */}
                        <line
                            x1="150"
                            y1="75"
                            stroke="#eab308"
                            strokeWidth="6"
                            opacity="0.7"
                        >
                            {/* x2 stays at 100 (0 HP) while arrow is < 100, then matches arrow to 200 */}
                            <animate
                                attributeName="x2"
                                values="150; 150; 250; 150; 150"
                                keyTimes="0; 0.22; 0.5; 0.78; 1"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                            <animate
                                attributeName="y2"
                                values="75;75;75"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                            {/* Stroke width becomes 0 when clamped at 0 HP (arrowhead below 0), 6 when above */}
                            <animate
                                attributeName="strokeWidth"
                                values="0; 0; 6; 0; 0"
                                keyTimes="0; 0.22; 0.5; 0.78; 1"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                        </line>
                        <text
                            textAnchor="middle"
                            y="35"
                            fontSize="11"
                            fill="#854d0e"
                            fontWeight="500"
                        >
                            {/* Text follows tip of execute bar (100->200) */}
                            <animate
                                attributeName="x"
                                values="150; 150; 250; 150; 150"
                                keyTimes="0; 0.22; 0.5; 0.78; 1"
                                dur="3s"
                                repeatCount="indefinite"
                            />
                            Execute Damage
                        </text>

                        {/* Animated Auto Damage Arrow - constant length, arrowhead at left end, line extends right */}
                        <g>
                            {/* Arrowhead - tip at left end of arrow */}
                            <polygon fill="#171717">
                                <animate
                                    attributeName="points"
                                    values="70,75 80,70 80,80;250,75 260,70 260,80;70,75 80,70 80,80"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                            </polygon>

                            {/* Arrow line - constant length (A = 180 pixels, bigger than 5% = 100 pixels) */}
                            <line y1="75" y2="75" stroke="#171717" strokeWidth="3">
                                <animate
                                    attributeName="x1"
                                    values="80;260;80"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                                <animate
                                    attributeName="x2"
                                    values="250;430;250"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                            </line>

                            <text
                                textAnchor="middle"
                                y="125"
                                fontSize="11"
                                fill="#171717"
                                fontWeight="500"
                            >
                                <animate
                                    attributeName="x"
                                    values="165;345;165"
                                    dur="3s"
                                    repeatCount="indefinite"
                                />
                                Auto Damage (A)
                            </text>
                        </g>
                    </svg>
                </div>
            </div>
        );
    }
}
