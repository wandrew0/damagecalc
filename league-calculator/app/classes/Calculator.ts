"use client";

import { Champion } from "./Champion";
import { Build } from "./Build";

/**
 * Simplified physical auto-attack formula:
 * Damage = AD * [(1 - critChance) + critChance * critDamageModifier] * (100 / (100 + armor))
 */
export function calculateSingleAutoDamage(
    champ: Champion,
    targetArmor: number,
    champLevel: number,
    build: Build
): number {
    const crit = build.critChance;
    const AD = champ.getAD(champLevel) + build.AD;
    targetArmor *= 1 - build.armorPenetration;
    targetArmor -= build.lethality;
    const armorModifier = 100 / (100 + Math.max(0, targetArmor));

    return AD * (1 - crit + crit * build.critDamageModifier) * armorModifier;
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
    numAutoAttacks: number = 1
): DamageRange {
    const crit = build.critChance;
    const AD = champ.getAD(champLevel) + build.AD;
    let effectiveArmor = targetArmor * (1 - build.armorPenetration) - build.lethality;
    effectiveArmor = Math.max(0, effectiveArmor);
    const armorModifier = 100 / (100 + effectiveArmor);

    // Base damage values
    const nonCritDamage = AD * armorModifier;
    const critDamage = AD * build.critDamageModifier * armorModifier;
    const expectedDamage =
        AD * (1 - crit + crit * build.critDamageModifier) * armorModifier;

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
