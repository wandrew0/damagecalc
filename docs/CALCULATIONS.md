# Calculations

These notes describe the implemented models. Generated stats and manually coded mechanics can change independently; a data refresh does not establish that every mechanic matches the current game patch.

## Expected auto damage

Sources: [Champion.ts](../league-calculator/app/classes/Champion.ts), [Build.ts](../league-calculator/app/classes/Build.ts), and [Calculator.ts](../league-calculator/app/classes/Calculator.ts).

Champion base AD at level `n` uses the generated starting AD and growth value:

```text
baseAD(n) = startingAD + growth × (n − 1) × (0.7025 + 0.0175 × (n − 1))
totalAD  = baseAD(n) + itemAD + manualBonusAD + runeAD
```

Build AD and lethality are additive. Crit chance is clamped to `[0, 1]`. For percent armor penetration, the model uses the largest item value in the build. The current crit multiplier is `2.0`, or `2.3` with Infinity Edge; these values are set in `Build.ts`.

For target armor `R`, percent penetration `p`, lethality `L`, crit chance `c`, and crit multiplier `m`:

```text
effectiveArmor = max(0, R × (1 − p) − L)
armorMultiplier = 100 / (100 + effectiveArmor)
expectedAuto = (totalAD × (1 − c + c × m) + axeBonus)
               × armorMultiplier × giantSlayer × hexoptics
```

`axeBonus` is zero unless Draven Q is enabled. `giantSlayer` and `hexoptics` are `1` without the corresponding items.

For example, with 220 AD, 50% crit, a `2.0` crit multiplier, 100 target armor, 30% penetration, and 10 lethality, effective armor is 60. With no other bonuses, expected damage is `220 × 1.5 × 100 / 160 = 206.25`.

### Champion and rune bonuses

- **Draven Q:** adds `baseDamage[rank] + bonusAdScaling[rank] × bonusAD`. The axe bonus is added separately from the crit-averaged base attack, then receives the same armor and item multipliers. Linked Q ranks follow champion levels 1, 4, 5, 7, and 9.
- **Aphelios in the build calculator:** passive bonuses are entered through the build's manual AD and lethality fields. The Q vs E page calculates passive ranks explicitly.
- **AD shards:** 0–2 shards, each worth `adaptiveForce.amount × adaptiveForce.adPerPoint` from the generated rune data.
- **Absolute Focus:** linear interpolation between its generated minimum and maximum AD over levels 1–18. Enabling it assumes the rune is active; player HP is not modeled.
- **Gathering Storm:** the UI uses 10-minute steps. For `k = minutes / 10`, the bonus is `2.4 × k × (k + 1)`. The calculation helper itself does not round to a 10-minute step.

Champion and rune constants live in [champions.ts](../league-calculator/app/data/champions.ts) and [runes.ts](../league-calculator/app/data/runes.ts).

### Modeled item effects

In addition to item AD, crit, lethality, and penetration:

| Effect | Implementation |
| --- | --- |
| Infinity Edge | Sets crit damage to `2.3` |
| Lord Dominik's Regards | `1 + 0.15 × min(targetBonusHP / 1500, 1)` for nonnegative bonus HP |
| Hexoptics C44 | `1 + 0.10 × clamp(distance, 0, 500) / 500` |

These mechanics are coded in TypeScript and need separate review after patches. An item being selectable does not mean its full passive is implemented. In particular, the main build chart does not include Collector executes, on-hit damage, item procs, or attack-speed effects. It also clamps effective armor to zero and does not model negative-armor amplification or every item-purchase restriction.

The output is an expected value per attack. It does not predict the crit sequence or number of attacks needed to kill a particular target.

## Aphelios Q vs E

Source: [apheliosCutoff.ts](../league-calculator/app/utils/apheliosCutoff.ts).

Own purchases and enemy armor purchases are resolved into a build for each level. Enemy armor combines a selected profile's base armor and growth with its timeline items. Q and E add the generated passive AD and lethality for their ranks. The page supplies rune AD by level to the shared damage model.

The model grants one passive point per level. Each stat has six ranks, unlocked at levels `1, 2, 3, 5, 7, 9`. User-selected W levels are respected when legal. W's attack speed is not included in damage per auto, so this is a Q/E comparison conditional on the W schedule.

Two approaches are shown:

- **Greedy:** choose the legal Q or E upgrade with the higher expected auto damage at the current level. Exact ties choose Q.
- **Best Average:** use dynamic programming over reachable `(Q, W, E)` rank states to maximize the sum of normalized damage across levels 1–18. Each level contributes equally.

For path `P`, the objective is:

```text
score(P) = (1 / 18) × sum(damage(P, level) / reference(level))
```

The reference is either the greedy path's damage or the highest damage among legal states at that individual level. The latter is the default. Those per-level maxima need not form one playable path; they provide a reference for scoring complete paths. The selected-level inspector changes what is displayed, not the optimizer's 1–18 scoring range.

Expected crit damage is suitable for this comparison because adding Q or E does not change crit chance or the crit multiplier at a given level. The shared crit factor cancels when comparing their ratio. That does not extend the result to abilities with different scaling, weapon effects, or kill breakpoints.

The optimizer uses the supplied purchase and armor timelines. It does not weight levels by time spent, fights taken, or attack count. Its damage calls use zero target bonus HP and zero Hexoptics distance, so those conditional multipliers do not contribute here.

## Collector

Sources: [collectorMath.ts](../league-calculator/app/features/collector/lib/collectorMath.ts) and [CollectorEfficiencyChart.tsx](../league-calculator/app/features/collector/components/CollectorEfficiencyChart.tsx).

Let `H` be maximum HP, `S = I × H` starting HP, `A` the fixed damage per attack after mitigation, and `T = 0.05 × H` the execute threshold. Assume positive HP and attack damage, with no healing, shields, spells, or other damage sources.

### Average execute contribution

The smooth model assumes a uniform last-hit phase: the attack that crosses the threshold overshoots it by a uniformly distributed amount `U` in `[0, A)`. Useful execute damage is `max(T − U, 0)`; a hit that kills outright contributes zero execute damage.

Integrating over that one-attack interval gives:

```text
averageExecute = T − A / 2          when A <= T
averageExecute = T² / (2 × A)       when A > T
contributionPercent = 100 × averageExecute / (S − averageExecute)
```

The percentage compares estimated execute damage with the remaining useful attack damage. It is not a damage multiplier that reproduces the same kill timing. The uniform phase is an assumption, not a measured distribution of fights or an average of starting HP from zero to `S`.

This approximation does not explicitly account for starting near the execute threshold or the requirement to land at least one hit. Its ratio requires `S > averageExecute`. The chart starts at `max(T + A / 2, A)` and ends at `H`; the headline result uses full HP.

### Damage to match a fixed hit count

The discrete model instead uses a specific starting HP:

```text
hitsWithout = max(1, ceil(S / A))
hitsWith    = max(1, ceil((S − T) / A))

matchPercent = 0                              if hitsWith >= hitsWithout
matchPercent = 100 × (S / (hitsWith × A) − 1)  otherwise
```

This is the minimum increase to every fixed-damage attack needed to kill in the same number of hits without the execute. The implementation treats reaching exactly 5% HP as sufficient for execution; boundary results follow that inclusive convention.

With `H = S = 2000` and `A = 200`:

| Measure | Result |
| --- | --- |
| Average execute under the phase assumption | 25 HP |
| Execute contribution ratio | `25 / 1975 = 1.27%` |
| Fixed hits, without / with execute | 10 / 10 |
| Damage increase to match those hits | 0% |

The two curves answer different questions. The fixed-hit curve is not an unsmoothed version of the contribution ratio. Neither is a universal in-game damage buff or a comparison of Collector against another item's complete stats and effects.
