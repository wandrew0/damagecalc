"use client";

import { Champion } from "./Champion";
import { Build } from "./Build";

/**
 * TODO: Hexoptics C44 - Distance-based damage amplifier
 * - Up to 10% increased damage based on distance to target
 * - Max bonus at 700 units
 * - Need to confirm: Linear scaling? Threshold-based?
 * - Need to confirm: Affects abilities or just autos?
 * - Implement once wiki is updated with exact formula
 */

/**
 * Calculate Giant Slayer bonus damage multiplier from Lord Dominik's Regards
 * Formula: Up to 15% bonus physical damage based on target's bonus HP (max at 1500 bonus HP)
 * @param targetBonusHP - The target's bonus HP from items/runes/abilities
 * @param build - The build to check if it has LDR
 * @returns Damage multiplier (1.0 if no LDR, up to 1.15 with LDR and max bonus HP)
 */
export function getGiantSlayerMultiplier(targetBonusHP: number, build: Build): number {
    // Check if build has Lord Dominik's Regards
    const hasLDR = build.items.some(item => item.name === "Lord Dominik's Regards");
    if (!hasLDR) return 1.0;
    
    // Calculate bonus: 0% at 0 bonus HP, up to 15% at 1500+ bonus HP
    const bonusPercent = Math.min(15, (targetBonusHP / 1500) * 15);
    return 1 + (bonusPercent / 100);
}

/**
 * Calculate Absolute Focus AD bonus
 * Formula: 1.8 + 16.2 ÷ 17 × (level − 1), giving 1.8 AD at level 1 and 18 AD at level 18
 */
export function getAbsoluteFocusAD(champLevel: number): number {
    return 1.8 + (16.2 / 17) * (champLevel - 1);
}

/**
 * Calculate Gathering Storm AD bonus
 * Formula: 2.4 * m * (m - 1) where m = 1 + (1 per 10 minutes of game time)
 */
export function getGatheringStormAD(minutes: number): number {
    const m = 1 + minutes / 10;
    return 2.4 * m * (m - 1);
}

/**
 * Calculate total AD including rune bonuses
 */
export function getTotalAD(
    champ: Champion,
    champLevel: number,
    build: Build,
    absoluteFocus: boolean = false,
    gatheringStormMinutes: number = 0
): number {
    let AD = champ.getAD(champLevel) + build.AD;

    // Apply rune bonuses
    if (absoluteFocus) {
        AD += getAbsoluteFocusAD(champLevel);
    }
    if (gatheringStormMinutes > 0) {
        AD += getGatheringStormAD(gatheringStormMinutes);
    }

    return AD;
}

/**
 * Calculate maximum possible damage (crit damage at armor=0)
 * Useful for determining chart Y-axis range
 */
export function calculateMaxDamage(
    champ: Champion,
    champLevel: number,
    build: Build,
    absoluteFocus: boolean = false,
    gatheringStormMinutes: number = 0,
    targetBonusHP: number = 0
): number {
    const AD = getTotalAD(champ, champLevel, build, absoluteFocus, gatheringStormMinutes);
    const giantSlayerMultiplier = getGiantSlayerMultiplier(targetBonusHP, build);
    // At armor=0, armorModifier = 100/100 = 1
    // Maximum damage is crit damage with Giant Slayer
    return AD * build.critDamageModifier * giantSlayerMultiplier;
}

/**
 * Simplified physical auto-attack formula:
 * Damage = AD * [(1 - critChance) + critChance * critDamageModifier] * (100 / (100 + armor)) * giantSlayer
 */
export function calculateSingleAutoDamage(
    champ: Champion,
    targetArmor: number,
    champLevel: number,
    build: Build,
    absoluteFocus: boolean = false,
    gatheringStormMinutes: number = 0,
    targetBonusHP: number = 0
): number {
    const crit = build.critChance;
    const AD = getTotalAD(champ, champLevel, build, absoluteFocus, gatheringStormMinutes);
    const giantSlayerMultiplier = getGiantSlayerMultiplier(targetBonusHP, build);

    targetArmor *= 1 - build.armorPenetration;
    targetArmor -= build.lethality;
    const armorModifier = 100 / (100 + Math.max(0, targetArmor));

    return AD * (1 - crit + crit * build.critDamageModifier) * armorModifier * giantSlayerMultiplier;
}

export interface DamageRange {
    expected: number;
    lower: number;
    upper: number;
}

/**
 * Calculate damage with margin of error using standard deviation
 * @param numAutoAttacks - Number of auto-attacks to calculate margin for (uses standard error = σ/√n)
 */
export function calculateDamageWithMargin(
    champ: Champion,
    targetArmor: number,
    champLevel: number,
    build: Build,
    stdDevMultiplier: number,
    numAutoAttacks: number = 1,
    absoluteFocus: boolean = false,
    gatheringStormMinutes: number = 0,
    targetBonusHP: number = 0
): DamageRange {
    const crit = build.critChance;
    const AD = getTotalAD(champ, champLevel, build, absoluteFocus, gatheringStormMinutes);
    const giantSlayerMultiplier = getGiantSlayerMultiplier(targetBonusHP, build);

    let effectiveArmor = targetArmor * (1 - build.armorPenetration) - build.lethality;
    effectiveArmor = Math.max(0, effectiveArmor);
    const armorModifier = 100 / (100 + effectiveArmor);

    // Base damage values (including Giant Slayer)
    const nonCritDamage = AD * armorModifier * giantSlayerMultiplier;
    const critDamage = AD * build.critDamageModifier * armorModifier * giantSlayerMultiplier;
    const expectedDamage =
        AD * (1 - crit + crit * build.critDamageModifier) * armorModifier * giantSlayerMultiplier;

    // Calculate margin
    let lower = expectedDamage;
    let upper = expectedDamage;

    if (crit > 0 && crit < 1) {
        // Only show margin if there's actual variance (0 < crit < 1)
        const variance = crit * (1 - crit) * Math.pow(critDamage - nonCritDamage, 2);
        const stdDev = Math.sqrt(variance);

        // Standard error for n auto-attacks: SE = σ/√n
        const standardError = stdDev / Math.sqrt(numAutoAttacks);

        lower = expectedDamage - stdDevMultiplier * standardError;
        upper = expectedDamage + stdDevMultiplier * standardError;

        // Always clamp to realistic bounds - average per auto cannot exceed single-auto bounds
        lower = Math.max(nonCritDamage, lower);
        upper = Math.min(critDamage, upper);
    } else if (crit >= 1) {
        // 100% crit - no variance
        lower = upper = critDamage;
    } else {
        // 0% crit - no variance
        lower = upper = nonCritDamage;
    }

    return { expected: expectedDamage, lower, upper };
}
