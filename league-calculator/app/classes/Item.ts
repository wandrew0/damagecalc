"use client";

export class Item {
    name: string;
    cost: number;
    AD: number;
    critChance: number;
    infinityEdgeBonus?: boolean; // Example passive for Infinity Edge
    lethality: number = 0;
    armorPenetration: number = 0;

    constructor(
        name: string,
        cost: number,
        AD: number,
        critChance: number,
        infinityEdgeBonus: boolean = false,
        lethality: number = 0,
        armorPenetration: number = 0
    ) {
        this.name = name;
        this.cost = cost;
        this.AD = AD;
        this.critChance = critChance;
        this.infinityEdgeBonus = infinityEdgeBonus;
        this.lethality = lethality;
        this.armorPenetration = armorPenetration;
    }

    toJSON() {
        return {
            name: this.name,
            cost: this.cost,
            AD: this.AD,
            critChance: this.critChance,
            infinityEdgeBonus: this.infinityEdgeBonus,
            lethality: this.lethality,
            armorPenetration: this.armorPenetration,
        };
    }

    static fromJSON(json: {
        name: string;
        cost: number;
        AD: number;
        critChance: number;
        infinityEdgeBonus?: boolean;
        lethality: number;
        armorPenetration: number;
    }): Item {
        return new Item(
            json.name,
            json.cost,
            json.AD,
            json.critChance,
            json.infinityEdgeBonus,
            json.lethality,
            json.armorPenetration
        );
    }
}
