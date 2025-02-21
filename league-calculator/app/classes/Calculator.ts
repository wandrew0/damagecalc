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
    const armorModifier = 100 / (100 + targetArmor);

    return AD * (1 - crit + crit * build.critDamageModifier) * armorModifier;
}
