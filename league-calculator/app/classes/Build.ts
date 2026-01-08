"use client";

import { Item } from "./Item";

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
            items: this.items.map((it) => it.toJSON()),
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

    static fromJSON(json: {
        items: {
            name: string;
            cost: number;
            AD: number;
            critChance: number;
            infinityEdgeBonus?: boolean;
            lethality: number;
            armorPenetration: number;
            aliases: string[];
        }[];
        critChance: number;
        critDamageModifier: number;
        AD: number;
        armorPenetration: number;
        lethality: number;
        totalCost: number;
        bonusAD: number;
        bonusLethality: number;
        bonusCrit: number;
        name: string;
    }) {
        const build = new Build();
        build.items = json.items.map((it) => Item.fromJSON(it));
        build.critChance = Math.max(0, Math.min(1, json.critChance));
        build.critDamageModifier = json.critDamageModifier;
        build.AD = json.AD;
        build.armorPenetration = json.armorPenetration;
        build.lethality = json.lethality;
        build.totalCost = json.totalCost;
        build.bonusAD = json.bonusAD;
        build.bonusLethality = json.bonusLethality;
        build.bonusCrit = json.bonusCrit;
        build.name = json.name;
        return build;
    }
}
