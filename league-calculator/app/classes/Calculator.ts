"use client";

import { Champion } from "./Champion";
import { Build } from "./Build";
import { SPINNING_AXE } from "../data/champions";
import { RUNE_DATA } from "../data/runes";

/**
 * TODO: Hexoptics C44 - Distance-based damage amplifier
 * - Up to 10% increased damage based on distance to target
 * - Max bonus at 700 units
 * - Need to confirm: Linear scaling? Threshold-based?
 * - Need to confirm: Affects abilities or just autos?
 * - Implement once wiki is updated with exact formula
 */

/**
 * Draven Spinning Axe bonus damage
 * Formula: 40/45/50/55/60 (+ 75/85/95/105/115% bonus AD)
 * @param qLevel - Spinning Axe level (1-5)
 * @param bonusAD - Bonus AD from items/runes (not base AD)
 * @returns Bonus physical damage added to auto attack
 */
export function getSpinningAxeDamage(qLevel: number, bonusAD: number): number {
    if (qLevel < 1 || qLevel > 5) return 0;
    const baseDamage = SPINNING_AXE.baseDamage[qLevel - 1];
    const scaling = SPINNING_AXE.bonusAdScaling[qLevel - 1];
    return baseDamage + scaling * bonusAD;
}

/**
 * Calculate Giant Slayer bonus damage multiplier from Lord Dominik's Regards
 * Formula: Up to 15% bonus physical damage based on target's bonus HP (max at 1500 bonus HP)
 * @param targetBonusHP - The target's bonus HP from items/runes/abilities
 * @param build - The build to check if it has LDR
 * @returns Damage multiplier (1.0 if no LDR, up to 1.15 with LDR and max bonus HP)
 */
export function getGiantSlayerMultiplier(targetBonusHP: number, build: Build): number {
    // Check if build has Lord Dominik's Regards
    const hasLDR = build.items.some((item) => item.name === "Lord Dominik's Regards");
    if (!hasLDR) return 1.0;

    // Calculate bonus: 0% at 0 bonus HP, up to 15% at 1500+ bonus HP
    const bonusPercent = Math.min(15, (targetBonusHP / 1500) * 15);
    return 1 + bonusPercent / 100;
}

/**
 * Calculate Absolute Focus AD bonus
 * Formula: 1.8 + 16.2 ÷ 17 × (level − 1), giving 1.8 AD at level 1 and 18 AD at level 18
 */
export function getAbsoluteFocusAD(champLevel: number): number {
    const minAd = RUNE_DATA.absoluteFocus.minAd;
    const maxAd = RUNE_DATA.absoluteFocus.maxAd;
    return minAd + ((maxAd - minAd) / 17) * (champLevel - 1);
}

/**
 * Calculate Gathering Storm AD bonus
 * Formula: 2.4 * m * (m - 1) where m = 1 + (1 per 10 minutes of game time)
 * Clamps minutes to 0 minimum
 */
export function getGatheringStormAD(minutes: number): number {
    const clampedMinutes = Math.max(0, minutes);
    const m = 1 + clampedMinutes / 10;
    return 2.4 * m * (m - 1);
}

/**
 * Calculate AD shard bonus from rune shards (0-2 shards).
 */
export function getAdShardBonus(adShardCount: number): number {
    const normalizedCount = Math.max(0, Math.min(2, Math.round(adShardCount)));
    const adPerShard =
        RUNE_DATA.adaptiveForce.amount * RUNE_DATA.adaptiveForce.adPerPoint;
    return normalizedCount * adPerShard;
}

/**
 * Calculate total AD including rune bonuses
 */
export function getTotalAD(
    champ: Champion,
    champLevel: number,
    build: Build,
    absoluteFocus: boolean = false,
    gatheringStormMinutes: number = 0,
    adShardCount: number = 0
): number {
    const AD =
        champ.getAD(champLevel) +
        getBonusAD(champLevel, build, absoluteFocus, gatheringStormMinutes, adShardCount);
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
    adShardCount: number = 0,
    targetBonusHP: number = 0
): number {
    const AD = getTotalAD(
        champ,
        champLevel,
        build,
        absoluteFocus,
        gatheringStormMinutes,
        adShardCount
    );
    const giantSlayerMultiplier = getGiantSlayerMultiplier(targetBonusHP, build);
    // At armor=0, armorModifier = 100/100 = 1
    // Maximum damage is crit damage with Giant Slayer
    return AD * build.critDamageModifier * giantSlayerMultiplier;
}

/**
 * Draven Q configuration for damage calculations
 */
export interface DravenQConfig {
    enabled: boolean;
    qLevel: number; // 1-5
}

/**
 * Calculate bonus AD (AD from items/runes, not base champion AD)
 */
export function getBonusAD(
    champLevel: number,
    build: Build,
    absoluteFocus: boolean = false,
    gatheringStormMinutes: number = 0,
    adShardCount: number = 0
): number {
    let bonusAD = build.AD; // Item AD
    bonusAD += getAdShardBonus(adShardCount);
    if (absoluteFocus) {
        bonusAD += getAbsoluteFocusAD(champLevel);
    }
    if (gatheringStormMinutes > 0) {
        bonusAD += getGatheringStormAD(gatheringStormMinutes);
    }
    return bonusAD;
}

/**
 * Simplified physical auto-attack formula:
 * Damage = AD * [(1 - critChance) + critChance * critDamageModifier] * (100 / (100 + armor)) * giantSlayer
 * For Draven with Spinning Axe: adds flat bonus damage that also crits
 */
export function calculateSingleAutoDamage(
    champ: Champion,
    targetArmor: number,
    champLevel: number,
    build: Build,
    absoluteFocus: boolean = false,
    gatheringStormMinutes: number = 0,
    adShardCount: number = 0,
    targetBonusHP: number = 0,
    dravenQ: DravenQConfig = { enabled: false, qLevel: 1 }
): number {
    const crit = build.critChance;
    const AD = getTotalAD(
        champ,
        champLevel,
        build,
        absoluteFocus,
        gatheringStormMinutes,
        adShardCount
    );
    const giantSlayerMultiplier = getGiantSlayerMultiplier(targetBonusHP, build);

    let effectiveArmor = targetArmor * (1 - build.armorPenetration) - build.lethality;
    effectiveArmor = Math.max(0, effectiveArmor);
    const armorModifier = 100 / (100 + effectiveArmor);

    // Base auto attack damage (with crit averaging)
    let damage =
        AD *
        (1 - crit + crit * build.critDamageModifier) *
        armorModifier *
        giantSlayerMultiplier;

    // Add Draven Spinning Axe damage if enabled
    // Spinning Axe can crit, so it also uses the crit averaging formula
    if (dravenQ.enabled && dravenQ.qLevel >= 1) {
        const bonusAD = getBonusAD(
            champLevel,
            build,
            absoluteFocus,
            gatheringStormMinutes,
            adShardCount
        );
        const spinningAxeBase = getSpinningAxeDamage(dravenQ.qLevel, bonusAD);
        // Spinning Axe damage can crit, applying the same crit modifier
        const spinningAxeDamage =
            spinningAxeBase *
            (1 - crit + crit * build.critDamageModifier) *
            armorModifier *
            giantSlayerMultiplier;
        damage += spinningAxeDamage;
    }

    return damage;
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
    adShardCount: number = 0,
    targetBonusHP: number = 0
): DamageRange {
    const crit = build.critChance;
    const AD = getTotalAD(
        champ,
        champLevel,
        build,
        absoluteFocus,
        gatheringStormMinutes,
        adShardCount
    );
    const giantSlayerMultiplier = getGiantSlayerMultiplier(targetBonusHP, build);

    let effectiveArmor = targetArmor * (1 - build.armorPenetration) - build.lethality;
    effectiveArmor = Math.max(0, effectiveArmor);
    const armorModifier = 100 / (100 + effectiveArmor);

    // Base damage values (including Giant Slayer)
    const nonCritDamage = AD * armorModifier * giantSlayerMultiplier;
    const critDamage =
        AD * build.critDamageModifier * armorModifier * giantSlayerMultiplier;
    const expectedDamage =
        AD *
        (1 - crit + crit * build.critDamageModifier) *
        armorModifier *
        giantSlayerMultiplier;

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
