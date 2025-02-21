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
}
