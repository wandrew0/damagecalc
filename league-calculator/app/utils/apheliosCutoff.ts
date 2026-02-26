import { Build } from "../classes/Build";
import { Champion } from "../classes/Champion";
import { Item } from "../classes/Item";
import { calculateSingleAutoDamage } from "../classes/Calculator";
import { ALL_ITEMS } from "../data/Items";
import { APHELIOS_PASSIVE, createChampion } from "../data/champions";
import type { EnemyArmorItem, EnemyArmorProfile } from "../data/enemyArmor";

const MAX_LEVEL = 18;
const MAX_RANK = 6;
const APHELIOS = createChampion("aphelios");

const APHELIOS_RANK_LEVELS = [1, 2, 3, 5, 7, 9];

const ALL_ITEMS_BY_NAME: Map<string, Item> = new Map(
    ALL_ITEMS.map((item) => [item.name, item])
);

export type PassiveChoice = "Q" | "E" | "W";

export interface TimelineEvent {
    level: number;
    add: string[];
    remove: string[];
}

export interface PassiveRankState {
    q: number;
    w: number;
    e: number;
}

export interface RecommendationInput {
    ownItemsByLevel: string[][];
    enemyArmorByLevel: number[];
    forcedWLevels?: number[];
    extraBonusAD?: number;
    extraBonusADByLevel?: number[];
    extraBonusLethality?: number;
}

export interface LevelRecommendation {
    level: number;
    enemyArmor: number;
    adBefore: number;
    lethalityBefore: number;
    stateBefore: PassiveRankState;
    stateAfter: PassiveRankState;
    choice: PassiveChoice;
    qOptionDamage: number | null;
    eOptionDamage: number | null;
    deltaQMinusE: number | null;
    forcedWApplied: boolean;
}

export interface DrilldownPoint {
    armor: number;
    qDamage: number | null;
    eDamage: number | null;
    deltaQMinusE: number | null;
}

export interface ExactDeltaPercentMinimum {
    armor: number;
    qDamage: number;
    eDamage: number;
    deltaPercent: number;
}

export interface ExactDeltaPercentTransitionPoint {
    armor: number;
    qDamage: number;
    eDamage: number;
    deltaPercent: number;
}

export interface RankedState {
    rank: number;
    state: PassiveRankState;
    damage: number;
}

export type GlobalOptimizerId = "greedy_norm" | "oracle_norm";

export interface GlobalPathResult {
    optimizer: GlobalOptimizerId;
    choicesByLevel: PassiveChoice[];
    statesAfterByLevel: PassiveRankState[];
    damageByLevel: number[];
    meanScore: number;
    forcedWAppliedLevels: number[];
    unappliedForcedWLevels: number[];
}

export type DamageEstimator = (
    level: number,
    state: PassiveRankState
) => number;

export function clampLevel(level: number): number {
    if (!Number.isFinite(level)) {
        return 1;
    }
    return Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
}

function countItems(items: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const name of items) {
        const key = String(name);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

export function getMaxPassiveRankForLevel(level: number): number {
    const clamped = clampLevel(level);
    let allowed = 0;
    for (const rankLevel of APHELIOS_RANK_LEVELS) {
        if (clamped >= rankLevel) {
            allowed += 1;
        }
    }
    return Math.min(MAX_RANK, allowed);
}

export function resolveTimeline(events: TimelineEvent[]): string[][] {
    const byLevel = new Map<number, TimelineEvent>();
    for (const event of events) {
        const level = clampLevel(event.level);
        byLevel.set(level, {
            level,
            add: event.add.filter((name) => typeof name === "string"),
            remove: event.remove.filter((name) => typeof name === "string"),
        });
    }

    const result: string[][] = [];
    const runningItems: string[] = [];

    for (let level = 1; level <= MAX_LEVEL; level++) {
        const event = byLevel.get(level);
        if (event) {
            for (const name of event.remove) {
                const removeIndex = runningItems.indexOf(name);
                if (removeIndex >= 0) {
                    runningItems.splice(removeIndex, 1);
                }
            }
            for (const name of event.add) {
                runningItems.push(name);
            }
        }
        result.push([...runningItems]);
    }

    return result;
}

export function updateTimelineForLevel(
    events: TimelineEvent[],
    level: number,
    previousLevelItems: string[],
    desiredItemsAtLevel: string[]
): TimelineEvent[] {
    const clampedLevel = clampLevel(level);
    const prevCounts = countItems(previousLevelItems);
    const nextCounts = countItems(desiredItemsAtLevel);

    const names = new Set([...prevCounts.keys(), ...nextCounts.keys()]);
    const addCounts = new Map<string, number>();
    const removeCounts = new Map<string, number>();

    for (const name of names) {
        const prev = prevCounts.get(name) ?? 0;
        const next = nextCounts.get(name) ?? 0;
        if (next > prev) {
            addCounts.set(name, next - prev);
        } else if (prev > next) {
            removeCounts.set(name, prev - next);
        }
    }

    const remove: string[] = [];
    for (const name of previousLevelItems) {
        const count = removeCounts.get(name) ?? 0;
        if (count > 0) {
            remove.push(name);
            removeCounts.set(name, count - 1);
        }
    }

    const add: string[] = [];
    for (const name of desiredItemsAtLevel) {
        const count = addCounts.get(name) ?? 0;
        if (count > 0) {
            add.push(name);
            addCounts.set(name, count - 1);
        }
    }

    const withoutLevel = events.filter((event) => clampLevel(event.level) !== clampedLevel);
    if (add.length === 0 && remove.length === 0) {
        return withoutLevel.sort((a, b) => a.level - b.level);
    }

    return [
        ...withoutLevel,
        {
            level: clampedLevel,
            add,
            remove,
        },
    ].sort((a, b) => a.level - b.level);
}

export function getPassiveQBonusAd(qRank: number): number {
    if (qRank <= 0) {
        return 0;
    }
    const index = Math.min(MAX_RANK, Math.floor(qRank)) - 1;
    return APHELIOS_PASSIVE.qBonusAdByRank[index] ?? 0;
}

export function getPassiveELethality(eRank: number): number {
    if (eRank <= 0) {
        return 0;
    }
    const index = Math.min(MAX_RANK, Math.floor(eRank)) - 1;
    return APHELIOS_PASSIVE.eBonusLethalityByRank[index] ?? 0;
}

function canLevelSkill(currentRank: number, level: number): boolean {
    return currentRank < MAX_RANK && currentRank < getMaxPassiveRankForLevel(level);
}

function getValidChoices(state: PassiveRankState, level: number): PassiveChoice[] {
    const choices: PassiveChoice[] = [];
    if (canLevelSkill(state.q, level)) {
        choices.push("Q");
    }
    if (canLevelSkill(state.w, level)) {
        choices.push("W");
    }
    if (canLevelSkill(state.e, level)) {
        choices.push("E");
    }
    return choices;
}

function cloneItem(item: Item): Item {
    return new Item(
        item.name,
        item.cost,
        item.AD,
        item.critChance,
        item.infinityEdgeBonus,
        item.lethality,
        item.armorPenetration,
        item.aliases,
        item.imagePath
    );
}

function buildForState(
    itemNames: string[],
    state: PassiveRankState,
    extraBonusAD: number,
    extraBonusLethality: number
): Build {
    const build = new Build();
    for (const name of itemNames.slice(0, 6)) {
        const item = ALL_ITEMS_BY_NAME.get(name);
        if (item) {
            build.addItem(cloneItem(item));
        }
    }

    build.setBonusAD(extraBonusAD + getPassiveQBonusAd(state.q));
    build.setBonusLethality(extraBonusLethality + getPassiveELethality(state.e));
    build.setBonusCrit(0);
    return build;
}

function getExtraBonusADForLevel(input: RecommendationInput, level: number): number {
    const clampedLevel = clampLevel(level);
    const byLevel = input.extraBonusADByLevel;
    if (Array.isArray(byLevel)) {
        const value = byLevel[clampedLevel - 1];
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
    }
    const fallback = input.extraBonusAD ?? 0;
    return Number.isFinite(fallback) ? fallback : 0;
}

function estimateDamage(
    champ: Champion,
    level: number,
    armor: number,
    itemNames: string[],
    state: PassiveRankState,
    extraBonusAD: number,
    extraBonusLethality: number
): number {
    const build = buildForState(
        itemNames,
        state,
        extraBonusAD,
        extraBonusLethality
    );
    return calculateSingleAutoDamage(
        champ,
        armor,
        level,
        build,
        false,
        0,
        0,
        0,
        { enabled: false, qLevel: 1 }
    );
}

function estimateBeforeStats(
    champ: Champion,
    level: number,
    itemNames: string[],
    state: PassiveRankState,
    extraBonusAD: number,
    extraBonusLethality: number
): { adBefore: number; lethalityBefore: number } {
    const build = buildForState(
        itemNames,
        state,
        extraBonusAD,
        extraBonusLethality
    );
    return {
        adBefore: champ.getAD(level) + build.AD,
        lethalityBefore: build.lethality,
    };
}

function applyChoice(state: PassiveRankState, choice: PassiveChoice): PassiveRankState {
    if (choice === "Q") {
        return { ...state, q: state.q + 1 };
    }
    if (choice === "E") {
        return { ...state, e: state.e + 1 };
    }
    return { ...state, w: state.w + 1 };
}

function stateKey(state: PassiveRankState): string {
    return `${state.q}-${state.w}-${state.e}`;
}

function parseStateKey(key: string): PassiveRankState {
    const [q, w, e] = key.split("-").map((value) => Number(value));
    return {
        q: Number.isFinite(q) ? q : 0,
        w: Number.isFinite(w) ? w : 0,
        e: Number.isFinite(e) ? e : 0,
    };
}

function getStableChoices(
    state: PassiveRankState,
    level: number,
    forcedW: Set<number>
): PassiveChoice[] {
    const valid = getValidChoices(state, level);
    if (forcedW.has(level) && valid.includes("W")) {
        return ["W"];
    }

    const validSet = new Set(valid);
    const preferredOrder: PassiveChoice[] = ["Q", "E", "W"];
    return preferredOrder.filter((choice) => validSet.has(choice));
}

export function buildDamageEstimator(
    input: RecommendationInput
): DamageEstimator {
    const extraBonusLethality = input.extraBonusLethality ?? 0;
    const cache = new Map<string, number>();

    return (level: number, state: PassiveRankState): number => {
        const clampedLevel = clampLevel(level);
        const key = `${clampedLevel}:${stateKey(state)}`;
        const cached = cache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const damage = estimateDamage(
            APHELIOS,
            clampedLevel,
            input.enemyArmorByLevel[clampedLevel - 1] ?? 0,
            input.ownItemsByLevel[clampedLevel - 1] ?? [],
            state,
            getExtraBonusADForLevel(input, clampedLevel),
            extraBonusLethality
        );
        cache.set(key, damage);
        return damage;
    };
}

export function calculateLevelRecommendations(
    input: RecommendationInput
): LevelRecommendation[] {
    const extraBonusLethality = input.extraBonusLethality ?? 0;
    const forcedWLevels = new Set(
        (input.forcedWLevels ?? []).map((level) => clampLevel(level))
    );

    let state: PassiveRankState = { q: 0, w: 0, e: 0 };
    const output: LevelRecommendation[] = [];

    for (let level = 1; level <= MAX_LEVEL; level++) {
        const ownItems = input.ownItemsByLevel[level - 1] ?? [];
        const enemyArmor = input.enemyArmorByLevel[level - 1] ?? 0;
        const extraBonusAD = getExtraBonusADForLevel(input, level);
        const before = { ...state };
        const { adBefore, lethalityBefore } = estimateBeforeStats(
            APHELIOS,
            level,
            ownItems,
            before,
            extraBonusAD,
            extraBonusLethality
        );

        const valid = getValidChoices(before, level);
        const canQ = valid.includes("Q");
        const canE = valid.includes("E");
        const canW = valid.includes("W");
        const forcedWApplied = forcedWLevels.has(level) && canW;

        let choice: PassiveChoice;
        let qOptionDamage: number | null = null;
        let eOptionDamage: number | null = null;
        let deltaQMinusE: number | null = null;

        if (canQ) {
            qOptionDamage = estimateDamage(
                APHELIOS,
                level,
                enemyArmor,
                ownItems,
                { ...before, q: before.q + 1 },
                extraBonusAD,
                extraBonusLethality
            );
        }

        if (canE) {
            eOptionDamage = estimateDamage(
                APHELIOS,
                level,
                enemyArmor,
                ownItems,
                { ...before, e: before.e + 1 },
                extraBonusAD,
                extraBonusLethality
            );
        }

        if (qOptionDamage !== null && eOptionDamage !== null) {
            deltaQMinusE = qOptionDamage - eOptionDamage;
        }

        if (forcedWApplied) {
            choice = "W";
        } else if (qOptionDamage !== null && eOptionDamage !== null) {
            choice = qOptionDamage >= eOptionDamage ? "Q" : "E";
        } else if (qOptionDamage !== null) {
            choice = "Q";
        } else if (eOptionDamage !== null) {
            choice = "E";
        } else {
            choice = canW ? "W" : "Q";
        }

        const after = applyChoice(before, choice);
        output.push({
            level,
            enemyArmor,
            adBefore,
            lethalityBefore,
            stateBefore: before,
            stateAfter: after,
            choice,
            qOptionDamage,
            eOptionDamage,
            deltaQMinusE,
            forcedWApplied,
        });
        state = after;
    }

    return output;
}

export function getReachableStatesAtLevel(
    level: number,
    forcedWLevels: number[] = []
): PassiveRankState[] {
    const clampedLevel = clampLevel(level);
    const forcedW = new Set(forcedWLevels.map((value) => clampLevel(value)));
    let states: PassiveRankState[] = [{ q: 0, w: 0, e: 0 }];

    for (let currentLevel = 1; currentLevel <= clampedLevel; currentLevel++) {
        const nextMap = new Map<string, PassiveRankState>();

        for (const state of states) {
            const valid = getValidChoices(state, currentLevel);
            const choices: PassiveChoice[] =
                forcedW.has(currentLevel) && valid.includes("W")
                    ? ["W"]
                    : valid;

            for (const choice of choices) {
                const next = applyChoice(state, choice);
                nextMap.set(stateKey(next), next);
            }
        }

        states = [...nextMap.values()];
    }

    return states.sort((a, b) => {
        if (a.q !== b.q) return b.q - a.q;
        if (a.e !== b.e) return b.e - a.e;
        return b.w - a.w;
    });
}

export function rankStatesByDamage(
    level: number,
    states: PassiveRankState[],
    ownItemsAtLevel: string[],
    enemyArmor: number,
    extraBonusAD: number,
    extraBonusLethality: number,
    topN: number = 3
): RankedState[] {
    const ranked = states
        .map((state) => ({
            state,
            damage: estimateDamage(
                APHELIOS,
                clampLevel(level),
                enemyArmor,
                ownItemsAtLevel,
                state,
                extraBonusAD,
                extraBonusLethality
            ),
        }))
        .sort((a, b) => b.damage - a.damage)
        .slice(0, Math.max(1, topN))
        .map((entry, index) => ({
            rank: index + 1,
            state: entry.state,
            damage: entry.damage,
        }));

    return ranked;
}

export function estimateDamageAtLevelForState(
    level: number,
    ownItemsAtLevel: string[],
    enemyArmor: number,
    state: PassiveRankState,
    extraBonusAD: number,
    extraBonusLethality: number
): number {
    return estimateDamage(
        APHELIOS,
        clampLevel(level),
        enemyArmor,
        ownItemsAtLevel,
        state,
        extraBonusAD,
        extraBonusLethality
    );
}

export function estimateBeforeStatsAtLevelForState(
    level: number,
    ownItemsAtLevel: string[],
    state: PassiveRankState,
    extraBonusAD: number,
    extraBonusLethality: number
): { adBefore: number; lethalityBefore: number } {
    return estimateBeforeStats(
        APHELIOS,
        clampLevel(level),
        ownItemsAtLevel,
        state,
        extraBonusAD,
        extraBonusLethality
    );
}

export function calculateOracleBestDamageByLevel(
    input: RecommendationInput,
    estimator?: DamageEstimator
): number[] {
    const forcedWLevels = input.forcedWLevels ?? [];
    const estimate = estimator ?? buildDamageEstimator(input);
    const values: number[] = [];

    for (let level = 1; level <= MAX_LEVEL; level++) {
        const states = getReachableStatesAtLevel(level, forcedWLevels);
        let best = Number.NEGATIVE_INFINITY;
        for (const state of states) {
            best = Math.max(best, estimate(level, state));
        }
        values.push(Number.isFinite(best) ? best : 0);
    }

    return values;
}

export function calculateGlobalOptimalPathNormalizedBy(
    input: RecommendationInput,
    denominatorsByLevel: number[],
    optimizer: GlobalOptimizerId,
    estimator?: DamageEstimator
): GlobalPathResult {
    const epsilon = 1e-9;
    const tieEpsilon = 1e-12;
    const forcedW = new Set(
        (input.forcedWLevels ?? []).map((level) => clampLevel(level))
    );
    const estimate = estimator ?? buildDamageEstimator(input);

    type StepNode = {
        score: number;
        state: PassiveRankState;
        prevKey: string | null;
        choice: PassiveChoice | null;
    };

    const layers: Array<Map<string, StepNode>> = [];
    const startState: PassiveRankState = { q: 0, w: 0, e: 0 };
    const startKey = stateKey(startState);
    const startLayer = new Map<string, StepNode>();
    startLayer.set(startKey, {
        score: 0,
        state: startState,
        prevKey: null,
        choice: null,
    });
    layers.push(startLayer);

    for (let level = 1; level <= MAX_LEVEL; level++) {
        const prevLayer = layers[level - 1];
        const nextLayer = new Map<string, StepNode>();
        const denominator = Math.max(
            denominatorsByLevel[level - 1] ?? 0,
            epsilon
        );

        for (const [prevKey, prevNode] of prevLayer.entries()) {
            const choices = getStableChoices(prevNode.state, level, forcedW);
            for (const choice of choices) {
                const nextState = applyChoice(prevNode.state, choice);
                const damage = estimate(level, nextState);
                const nextScore = prevNode.score + damage / denominator;
                const key = stateKey(nextState);
                const existing = nextLayer.get(key);

                if (!existing || nextScore > existing.score + tieEpsilon) {
                    nextLayer.set(key, {
                        score: nextScore,
                        state: nextState,
                        prevKey,
                        choice,
                    });
                }
            }
        }

        layers.push(nextLayer);
    }

    const finalLayer = layers[MAX_LEVEL];
    let bestKey: string | null = null;
    let bestNode: StepNode | null = null;
    const sortedFinalKeys = [...finalLayer.keys()].sort((left, right) => {
        const a = parseStateKey(left);
        const b = parseStateKey(right);
        if (a.q !== b.q) return b.q - a.q;
        if (a.e !== b.e) return b.e - a.e;
        return b.w - a.w;
    });

    for (const key of sortedFinalKeys) {
        const node = finalLayer.get(key);
        if (!node) continue;
        if (!bestNode || node.score > bestNode.score + tieEpsilon) {
            bestNode = node;
            bestKey = key;
        }
    }

    if (!bestNode || !bestKey) {
        return {
            optimizer,
            choicesByLevel: [],
            statesAfterByLevel: [],
            damageByLevel: [],
            meanScore: 0,
            forcedWAppliedLevels: [],
            unappliedForcedWLevels: [],
        };
    }

    const choicesByLevel: Array<PassiveChoice | null> = new Array(MAX_LEVEL).fill(
        null
    );
    const statesAfterByLevel: Array<PassiveRankState | null> = new Array(
        MAX_LEVEL
    ).fill(null);

    let walkKey: string | null = bestKey;
    for (let level = MAX_LEVEL; level >= 1; level--) {
        if (!walkKey) break;
        const layer = layers[level];
        const node = layer.get(walkKey);
        if (!node || !node.choice) break;
        choicesByLevel[level - 1] = node.choice;
        statesAfterByLevel[level - 1] = node.state;
        walkKey = node.prevKey;
    }

    if (
        choicesByLevel.some((choice) => choice === null) ||
        statesAfterByLevel.some((state) => state === null)
    ) {
        return {
            optimizer,
            choicesByLevel: [],
            statesAfterByLevel: [],
            damageByLevel: [],
            meanScore: 0,
            forcedWAppliedLevels: [],
            unappliedForcedWLevels: [],
        };
    }

    const damageByLevel: number[] = [];
    const forcedWAppliedLevels: number[] = [];
    const unappliedForcedWLevels: number[] = [];
    let state: PassiveRankState = { q: 0, w: 0, e: 0 };

    for (let level = 1; level <= MAX_LEVEL; level++) {
        const choice = choicesByLevel[level - 1];
        if (!choice) {
            continue;
        }
        const canW = canLevelSkill(state.w, level);
        if (forcedW.has(level)) {
            if (canW && choice === "W") {
                forcedWAppliedLevels.push(level);
            } else if (!canW) {
                unappliedForcedWLevels.push(level);
            }
        }

        state = applyChoice(state, choice);
        const resolvedState = statesAfterByLevel[level - 1] ?? state;
        statesAfterByLevel[level - 1] = resolvedState;
        damageByLevel.push(estimate(level, resolvedState));
    }

    const totalScore = bestNode.score;
    return {
        optimizer,
        choicesByLevel: choicesByLevel.filter(
            (choice): choice is PassiveChoice => choice !== null
        ),
        statesAfterByLevel: statesAfterByLevel.filter(
            (nextState): nextState is PassiveRankState => nextState !== null
        ),
        damageByLevel,
        meanScore: totalScore / MAX_LEVEL,
        forcedWAppliedLevels,
        unappliedForcedWLevels,
    };
}

export function buildDrilldownPoints(
    level: number,
    stateBeforeLevelChoice: PassiveRankState,
    ownItemsAtLevel: string[],
    armorMin: number,
    armorMax: number,
    extraBonusAD: number,
    extraBonusLethality: number
): DrilldownPoint[] {
    const low = Math.min(armorMin, armorMax);
    const high = Math.max(armorMin, armorMax);
    const points: DrilldownPoint[] = [];

    const canQ = canLevelSkill(stateBeforeLevelChoice.q, level);
    const canE = canLevelSkill(stateBeforeLevelChoice.e, level);

    for (let armor = low; armor <= high; armor++) {
        const qDamage = canQ
            ? estimateDamage(
                  APHELIOS,
                  level,
                  armor,
                  ownItemsAtLevel,
                  { ...stateBeforeLevelChoice, q: stateBeforeLevelChoice.q + 1 },
                  extraBonusAD,
                  extraBonusLethality
              )
            : null;

        const eDamage = canE
            ? estimateDamage(
                  APHELIOS,
                  level,
                  armor,
                  ownItemsAtLevel,
                  { ...stateBeforeLevelChoice, e: stateBeforeLevelChoice.e + 1 },
                  extraBonusAD,
                  extraBonusLethality
              )
            : null;

        const deltaQMinusE =
            qDamage !== null && eDamage !== null ? qDamage - eDamage : null;

        points.push({ armor, qDamage, eDamage, deltaQMinusE });
    }

    return points;
}

function getArmorClampBreakpoint(build: Build): number | null {
    const slope = 1 - build.armorPenetration;
    if (!Number.isFinite(slope) || slope <= 0) {
        return null;
    }
    const breakpoint = build.lethality / slope;
    return Number.isFinite(breakpoint) ? breakpoint : null;
}

function evaluateExactDeltaPercentPoint(
    level: number,
    armor: number,
    ownItemsAtLevel: string[],
    qState: PassiveRankState,
    eState: PassiveRankState,
    extraBonusAD: number,
    extraBonusLethality: number
): ExactDeltaPercentTransitionPoint | null {
    const qDamage = estimateDamage(
        APHELIOS,
        level,
        armor,
        ownItemsAtLevel,
        qState,
        extraBonusAD,
        extraBonusLethality
    );
    const eDamage = estimateDamage(
        APHELIOS,
        level,
        armor,
        ownItemsAtLevel,
        eState,
        extraBonusAD,
        extraBonusLethality
    );
    if (!(eDamage > 0)) {
        return null;
    }
    return {
        armor,
        qDamage,
        eDamage,
        deltaPercent: ((qDamage - eDamage) / eDamage) * 100,
    };
}

export function findExactDeltaPercentTransitionPoints(
    level: number,
    stateBeforeLevelChoice: PassiveRankState,
    ownItemsAtLevel: string[],
    armorMin: number,
    armorMax: number,
    extraBonusAD: number,
    extraBonusLethality: number
): ExactDeltaPercentTransitionPoint[] {
    const low = Math.min(armorMin, armorMax);
    const high = Math.max(armorMin, armorMax);
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
        return [];
    }

    const canQ = canLevelSkill(stateBeforeLevelChoice.q, level);
    const canE = canLevelSkill(stateBeforeLevelChoice.e, level);
    if (!canQ || !canE) {
        return [];
    }

    const qState = { ...stateBeforeLevelChoice, q: stateBeforeLevelChoice.q + 1 };
    const eState = { ...stateBeforeLevelChoice, e: stateBeforeLevelChoice.e + 1 };
    const qBuild = buildForState(
        ownItemsAtLevel,
        qState,
        extraBonusAD,
        extraBonusLethality
    );
    const eBuild = buildForState(
        ownItemsAtLevel,
        eState,
        extraBonusAD,
        extraBonusLethality
    );

    const candidateSet = new Set<number>();
    const addCandidate = (armor: number | null) => {
        if (armor === null || !Number.isFinite(armor)) return;
        if (armor < low || armor > high) return;
        candidateSet.add(Number(armor.toFixed(9)));
    };

    addCandidate(getArmorClampBreakpoint(qBuild));
    addCandidate(getArmorClampBreakpoint(eBuild));

    return [...candidateSet]
        .sort((a, b) => a - b)
        .map((armor) =>
            evaluateExactDeltaPercentPoint(
                level,
                armor,
                ownItemsAtLevel,
                qState,
                eState,
                extraBonusAD,
                extraBonusLethality
            )
        )
        .filter((point): point is ExactDeltaPercentTransitionPoint => point !== null);
}

export function findExactDeltaPercentMinimum(
    level: number,
    stateBeforeLevelChoice: PassiveRankState,
    ownItemsAtLevel: string[],
    armorMin: number,
    armorMax: number,
    extraBonusAD: number,
    extraBonusLethality: number
): ExactDeltaPercentMinimum | null {
    const low = Math.min(armorMin, armorMax);
    const high = Math.max(armorMin, armorMax);
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
        return null;
    }

    const canQ = canLevelSkill(stateBeforeLevelChoice.q, level);
    const canE = canLevelSkill(stateBeforeLevelChoice.e, level);
    if (!canQ || !canE) {
        return null;
    }

    const qState = { ...stateBeforeLevelChoice, q: stateBeforeLevelChoice.q + 1 };
    const eState = { ...stateBeforeLevelChoice, e: stateBeforeLevelChoice.e + 1 };
    const qBuild = buildForState(
        ownItemsAtLevel,
        qState,
        extraBonusAD,
        extraBonusLethality
    );
    const eBuild = buildForState(
        ownItemsAtLevel,
        eState,
        extraBonusAD,
        extraBonusLethality
    );

    const candidateSet = new Set<number>();
    const addCandidate = (armor: number) => {
        if (!Number.isFinite(armor)) return;
        if (armor < low || armor > high) return;
        candidateSet.add(Number(armor.toFixed(9)));
    };

    addCandidate(low);
    addCandidate(high);
    addCandidate(getArmorClampBreakpoint(qBuild) ?? Number.NaN);
    addCandidate(getArmorClampBreakpoint(eBuild) ?? Number.NaN);

    const candidates = [...candidateSet].sort((a, b) => a - b);
    let best: ExactDeltaPercentMinimum | null = null;

    for (const armor of candidates) {
        const point = evaluateExactDeltaPercentPoint(
            level,
            armor,
            ownItemsAtLevel,
            qState,
            eState,
            extraBonusAD,
            extraBonusLethality
        );
        if (!point) {
            continue;
        }
        const current: ExactDeltaPercentMinimum = point;

        if (
            best === null ||
            current.deltaPercent < best.deltaPercent ||
            (current.deltaPercent === best.deltaPercent && current.armor < best.armor)
        ) {
            best = current;
        }
    }

    return best;
}

export function findFirstEPreferenceLevel(
    recommendations: LevelRecommendation[]
): number | null {
    const first = recommendations.find(
        (entry) => entry.choice === "E" && entry.deltaQMinusE !== null
    );
    return first ? first.level : null;
}

function getScaledStat(base: number, perLevel: number, level: number): number {
    const n = clampLevel(level);
    return base + perLevel * (n - 1) * (0.7025 + 0.0175 * (n - 1));
}

export function resolveEnemyArmorByLevel(
    profile: EnemyArmorProfile,
    enemyArmorItemsByLevel: string[][],
    armorItems: EnemyArmorItem[]
): number[] {
    const armorByName = new Map<string, number>(
        armorItems.map((item) => [item.name, item.armor])
    );

    const values: number[] = [];
    for (let level = 1; level <= MAX_LEVEL; level++) {
        const baseArmor = getScaledStat(profile.baseArmor, profile.armorGrowth, level);
        const armorFromItems = (enemyArmorItemsByLevel[level - 1] ?? []).reduce(
            (sum, name) => sum + (armorByName.get(name) ?? 0),
            0
        );
        values.push(Math.max(0, baseArmor + armorFromItems));
    }
    return values;
}
