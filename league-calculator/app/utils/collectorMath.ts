export interface CollectorInput {
    maxHp: number; // H
    initialHpPercent: number; // I (0.0 to 1.0)
    autoDamage: number; // A
}

export interface CollectorResult {
    case: "1" | "2";
    avgExecuteDamage: number;
    damageNeededWithCollector: number; // The amount of damage the collector user actually deals (excluding execute)
    damageNeededWithoutCollector: number; // IH
    damageMultiplier: number; // How much more damage a non-collector build needs
    percentDiff: number; // (Multiplier - 1) * 100
}

export function calculateCollectorEfficiency(input: CollectorInput): CollectorResult {
    const { maxHp, initialHpPercent, autoDamage } = input;

    // Constants
    const H = maxHp;
    const I = initialHpPercent;
    const A = autoDamage;
    const THRESHOLD = 0.05 * H; // 5% max HP

    const totalHealthToDeal = I * H; // IH

    // Case 1: Auto Damage <= 5% Max HP (A <= .05H)
    if (A <= THRESHOLD) {
        // Avg execute dmg = .05H - .5A
        const avgExecuteDamage = THRESHOLD - 0.5 * A;

        // Damage we do ourselves = (I - .05)H + .5A
        // Which is equivalent to: Total - AvgExecute
        const damageNeededWithCollector = totalHealthToDeal - avgExecuteDamage;

        // Multiplier = IH / ((I - .05)H + .5A)
        const damageMultiplier = totalHealthToDeal / damageNeededWithCollector;

        return {
            case: "1",
            avgExecuteDamage,
            damageNeededWithCollector,
            damageNeededWithoutCollector: totalHealthToDeal,
            damageMultiplier,
            percentDiff: (damageMultiplier - 1) * 100,
        };
    }
    // Case 2: Auto Damage > 5% Max HP (A > .05H)
    else {
        // Avg execute dmg = .00125H^2 / A
        // Derived from: .025H * .05H / A
        const avgExecuteDamage = (0.00125 * H * H) / A;

        // Damage we do ourselves = IH - .00125H^2 / A
        const damageNeededWithCollector = totalHealthToDeal - avgExecuteDamage;

        // Multiplier = IH / (IH - .00125H^2 / A)
        const damageMultiplier = totalHealthToDeal / damageNeededWithCollector;

        return {
            case: "2",
            avgExecuteDamage,
            damageNeededWithCollector,
            damageNeededWithoutCollector: totalHealthToDeal,
            damageMultiplier,
            percentDiff: (damageMultiplier - 1) * 100,
        };
    }
}

export function calculateDiscreteEfficiency(input: CollectorInput): number {
    const { maxHp, initialHpPercent, autoDamage } = input;
    const H = maxHp;
    const startHp = initialHpPercent * H;
    const A = autoDamage;
    const threshold = 0.05 * H;

    // Autos needed without collector to reduce startHp to <= 0
    // ceil(StartHP / A)
    const autosNoCol = Math.ceil(startHp / A);

    // Autos needed WITH collector to reduce startHp to <= 0.05H
    // We need to deal (StartHP - 0.05H) damage effectively.
    // But strictly: we stop when currentHP <= Threshold.
    // So we need to deal D damage such that StartHP - D <= Threshold
    // D >= StartHP - Threshold.
    // D must be a multiple of A (k * A).
    // k * A >= StartHP - Threshold
    // k >= (StartHP - Threshold) / A
    // k = ceil((StartHP - Threshold) / A)

    // Edge case: if StartHP <= Threshold, we need 0 autos?
    // Or 1 if we assume we are attacking.
    // Let's assume if we are already in execute range, 1 auto kills immediately due to collector?
    // If startHP <= 0.05H, collector executes instantly on damage?
    // The item says "If you deal damage that leaves an enemy below 5%...".
    // So if they are AT 4%, and you hit them, they die.
    // So 1 auto.
    // If without collector, 1 auto might not kill if A < 4% HP.

    let autosCol = Math.ceil((startHp - threshold) / A);
    // If the result is 0 or less (meaning we started below threshold), we still need at least 1 hit to trigger it?
    // Actually, if we start below threshold, any damage triggers execute.
    // So 1 auto.
    if (autosCol < 1) autosCol = 1;

    // Recalculate autosNoCol for consistency in the very low HP case
    // If startHp > 0, autosNoCol >= 1.
    const effectiveAutosNo = Math.max(1, autosNoCol);

    // If Collector takes SAME or MORE autos, efficiency is 0% (no benefit).
    if (autosCol >= effectiveAutosNo) {
        return 0;
    }

    // If Collector takes FEWER autos, we calculate how much damage buff we'd need to kill in autosCol hits.

    // To kill in `autosCol` hits without collector, we need:
    // DamagePerHit * autosCol >= StartHP
    // DamagePerHit >= StartHP / autosCol
    // Current DamagePerHit = A
    // Ratio = (StartHP / autosCol) / A

    const neededDamagePerHit = startHp / autosCol;
    const ratio = neededDamagePerHit / A;

    return (ratio - 1) * 100;
}
