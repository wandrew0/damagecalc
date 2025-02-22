"use client";

import { Item } from "./Item";

export class Build {
    items: Item[] = [];
    critChance: number = 0;
    critDamageModifier: number = 1.75;
    AD: number = 0;
    armorPenetration: number = 0;
    lethality: number = 0;
    totalCost: number = 0;

    bonusAD: number = 0;
    bonusLethality: number = 0;
    bonusCrit: number = 0;

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
        this.critChance =
            this.items.reduce((acc, it) => acc + it.critChance, 0) + this.bonusCrit;
        this.AD = this.items.reduce((acc, it) => acc + it.AD, 0) + this.bonusAD;
        this.lethality =
            this.items.reduce((acc, it) => acc + it.lethality, 0) + this.bonusLethality;
        this.armorPenetration = this.items.reduce(
            (acc, it) => Math.max(acc, it.armorPenetration),
            0
        );

        if (this.items.some((it) => it.infinityEdgeBonus)) {
            this.critDamageModifier = 2.15;
        } else {
            this.critDamageModifier = 1.75;
        }

        this.totalCost = this.items.reduce((acc, it) => acc + it.cost, 0);
    }
}
