"use client";

export class Champion {
    name: string;
    startAD: number;
    perLevelAD: number;

    constructor(name: string, startAD: number, perLevelAD: number) {
        this.name = name;
        this.startAD = startAD;
        this.perLevelAD = perLevelAD;
    }

    getAD(level: number): number {
        // Formula: Statistic = base + bonus + g × (n − 1) × (0.7025 + 0.0175 × (n − 1))
        return (
            this.startAD + this.perLevelAD * (level - 1) * (0.7025 + 0.0175 * (level - 1))
        );
    }
}
