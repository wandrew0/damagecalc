"use client";

import React, { useEffect, useRef } from "react";

interface CollectorVisualizationProps {
    maxHp: number;
    autoDamage: number;
    threshold: number;
    isOverkill: boolean;
}

export default function CollectorVisualization({
    maxHp,
    autoDamage,
    threshold,
    isOverkill,
}: CollectorVisualizationProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Setup canvas scaling for high DPI
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        // Set actual size in memory (scaled to account for extra pixel density)
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // Normalize coordinate system to use css pixels
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Layout Constants
        const padding = 40;
        const graphY = height / 2;
        const barHeight = 40;
        
        // Calculate Scale
        // We want to show slightly below 0 to max(threshold + autoDamage) * 1.1
        const minVal = Math.min(0, threshold - autoDamage) - (autoDamage * 0.2);
        const maxVal = (threshold + autoDamage) * 1.1;
        const range = maxVal - minVal;

        const toX = (val: number) => {
            return padding + ((val - minVal) / range) * (width - (padding * 2));
        };

        // Draw Base Line (HP Axis)
        ctx.beginPath();
        ctx.moveTo(padding, graphY);
        ctx.lineTo(width - padding, graphY);
        ctx.strokeStyle = "#e5e5e5";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw 0 Line (Death)
        const xZero = toX(0);
        ctx.beginPath();
        ctx.moveTo(xZero, graphY - 30);
        ctx.lineTo(xZero, graphY + 30);
        ctx.strokeStyle = "#171717";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = "#171717";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("0 HP (Dead)", xZero, graphY + 45);

        // Draw 5% Threshold Line
        const xThreshold = toX(threshold);
        ctx.beginPath();
        ctx.moveTo(xThreshold, graphY - 40);
        ctx.lineTo(xThreshold, graphY + 40);
        ctx.strokeStyle = "#dc2626"; // Red
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#dc2626";
        ctx.fillText("5% Execute", xThreshold, graphY - 50);

        // Draw "Next Auto Will Kill" Range (Starting HP)
        // Range is [0.05H, 0.05H + A]
        // Wait, for visualization it might be clearer to show the Resulting HP
        // User's math analyzes the range [0.05H - A, 0.05H] (The resulting HP after the auto)
        
        const startResultHP = threshold - autoDamage;
        const endResultHP = threshold;

        // Draw the "Resulting HP" Bar
        const xStart = toX(startResultHP);
        const xEnd = toX(endResultHP);
        
        // Determine gradient based on case
        const gradient = ctx.createLinearGradient(xStart, 0, xEnd, 0);
        if (isOverkill) {
            // Case 2: Part of it is < 0 (Overkill)
            gradient.addColorStop(0, "rgba(147, 51, 234, 0.2)"); // Purple transparent
            gradient.addColorStop(1, "rgba(147, 51, 234, 0.6)"); // Purple solid
        } else {
            // Case 1: All within execute range
            gradient.addColorStop(0, "rgba(37, 99, 235, 0.2)"); // Blue transparent
            gradient.addColorStop(1, "rgba(37, 99, 235, 0.6)"); // Blue solid
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(xStart, graphY - barHeight/2, xEnd - xStart, barHeight);
        ctx.strokeStyle = isOverkill ? "#9333ea" : "#2563eb";
        ctx.lineWidth = 1;
        ctx.strokeRect(xStart, graphY - barHeight/2, xEnd - xStart, barHeight);

        // Labels for the Range
        ctx.fillStyle = isOverkill ? "#9333ea" : "#2563eb";
        ctx.font = "12px sans-serif";
        
        // Label the bar
        ctx.fillText(
            isOverkill ? "Possible Resulting HP (Case 2)" : "Possible Resulting HP (Case 1)", 
            xStart + (xEnd - xStart)/2, 
            graphY - barHeight/2 - 10
        );

        // Visualize Overkill portion if applicable
        if (startResultHP < 0) {
            const xOverkillEnd = xZero; // 0 HP
            
            // Hatching for overkill area
            ctx.save();
            ctx.beginPath();
            ctx.rect(xStart, graphY - barHeight/2, xOverkillEnd - xStart, barHeight);
            ctx.clip();
            
            ctx.beginPath();
            for (let i = xStart - barHeight; i < xOverkillEnd; i += 10) {
                ctx.moveTo(i, graphY + barHeight/2);
                ctx.lineTo(i + barHeight, graphY - barHeight/2);
            }
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = "#666";
            ctx.fillText("Overkill (0 Execute Dmg)", xStart + (xOverkillEnd - xStart)/2, graphY + barHeight + 15);
        }

        // Visualize Execute Value portion
        const xValidStart = Math.max(xStart, xZero);
        const xValidEnd = xEnd;
        
        // Bracket for execute value
        ctx.beginPath();
        ctx.moveTo(xValidStart, graphY + barHeight/2 + 5);
        ctx.lineTo(xValidStart, graphY + barHeight/2 + 15);
        ctx.lineTo(xValidEnd, graphY + barHeight/2 + 15);
        ctx.lineTo(xValidEnd, graphY + barHeight/2 + 5);
        ctx.strokeStyle = "#text-secondary";
        ctx.stroke();

        ctx.fillStyle = "#text-primary";
        ctx.fillText("Execute Value Range", xValidStart + (xValidEnd - xValidStart)/2, graphY + barHeight + 30);

    }, [maxHp, autoDamage, threshold, isOverkill]);

    return (
        <canvas 
            ref={canvasRef} 
            style={{ width: '100%', height: '250px' }}
        />
    );
}

