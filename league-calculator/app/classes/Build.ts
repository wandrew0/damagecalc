import { Item } from "./Item";

export class Build {
    items: Item[] = [];
    critChance: number = 0;
    critDamageModifier: number = 1.75;
    AD: number = 0;

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
        this.critChance = this.items.reduce((acc, it) => acc + it.critChance, 0);
        this.AD = this.items.reduce((acc, it) => acc + it.AD, 0);

        if (this.items.some((it) => it.infinityEdgeBonus)) {
            this.critDamageModifier = 2.15;
        } else {
            this.critDamageModifier = 1.75;
        }
    }

    getTotalCost(): number {
        return this.items.reduce((acc, it) => acc + it.cost, 0);
    }
}
