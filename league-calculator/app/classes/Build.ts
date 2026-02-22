"use client";

import { Item } from "./Item";
import {
    deserializePersistedItem,
    PersistedItemData,
    serializeItemReference,
} from "../utils/itemRegistry";

interface BuildJSON {
    items?: PersistedItemData[];
    bonusAD?: number;
    bonusLethality?: number;
    bonusCrit?: number;
    name?: string;
}

export class Build {
    items: Item[] = [];
    critChance: number = 0;
    critDamageModifier: number = 2.0; // Season 16: base crit is now 200%
    AD: number = 0;
    armorPenetration: number = 0;
    lethality: number = 0;
    totalCost: number = 0;

    bonusAD: number = 0;
    bonusLethality: number = 0;
    bonusCrit: number = 0;

    name: string = "";

    setName(name: string) {
        this.name = name;
    }

    setBonusAD(bonusAD: number) {
        this.bonusAD = bonusAD;
        this.update();
    }

    setBonusLethality(bonusLethality: number) {
        this.bonusLethality = bonusLethality;
        this.update();
    }

    setBonusCrit(bonusCrit: number) {
        this.bonusCrit = bonusCrit;
        this.update();
    }

    addItem(item: Item) {
        if (this.items.length >= 6) {
            return;
        }
        this.items.push(item);
        this.update();
    }

    removeItem(index: number) {
        if (index < 0 || index >= this.items.length) {
            return;
        }
        this.items.splice(index, 1);
        this.update();
    }

    update() {
        this.critChance = Math.max(0, Math.min(1,
            this.items.reduce((acc, it) => acc + it.critChance, 0) + this.bonusCrit
        ));
        this.AD = this.items.reduce((acc, it) => acc + it.AD, 0) + this.bonusAD;
        this.lethality =
            this.items.reduce((acc, it) => acc + it.lethality, 0) + this.bonusLethality;
        this.armorPenetration = this.items.reduce(
            (acc, it) => Math.max(acc, it.armorPenetration),
            0
        );

        if (this.items.some((it) => it.infinityEdgeBonus)) {
            this.critDamageModifier = 2.30; // 200% base + 30% IE amp
        } else {
            this.critDamageModifier = 2.0; // Season 16: base crit is now 200%
        }

        this.totalCost = this.items.reduce((acc, it) => acc + it.cost, 0);
    }

    toJSON() {
        return {
            items: this.items.map((it) => serializeItemReference(it)),
            critChance: this.critChance,
            critDamageModifier: this.critDamageModifier,
            AD: this.AD,
            armorPenetration: this.armorPenetration,
            lethality: this.lethality,
            totalCost: this.totalCost,
            bonusAD: this.bonusAD,
            bonusLethality: this.bonusLethality,
            bonusCrit: this.bonusCrit,
            name: this.name,
        };
    }

    static fromJSON(json: BuildJSON) {
        const build = new Build();
        const persistedItems = Array.isArray(json.items) ? json.items : [];
        build.items = persistedItems
            .map((item) => deserializePersistedItem(item))
            .filter((item): item is Item => item !== null);
        // Don't use saved critDamageModifier - it may be from an old season
        // Instead, set bonus values and call update() to recalculate everything
        build.bonusAD =
            typeof json.bonusAD === "number" && Number.isFinite(json.bonusAD)
                ? json.bonusAD
                : 0;
        build.bonusLethality =
            typeof json.bonusLethality === "number" &&
            Number.isFinite(json.bonusLethality)
                ? json.bonusLethality
                : 0;
        build.bonusCrit =
            typeof json.bonusCrit === "number" && Number.isFinite(json.bonusCrit)
                ? json.bonusCrit
                : 0;
        build.name = typeof json.name === "string" ? json.name : "";
        // Recalculate all stats including critDamageModifier based on current season values
        build.update();
        return build;
    }
}
