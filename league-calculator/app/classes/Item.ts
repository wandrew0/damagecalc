export class Item {
    name: string;
    cost: number;
    AD: number;
    critChance: number;
    infinityEdgeBonus?: boolean; // Example passive for Infinity Edge

    constructor(
        name: string,
        cost: number,
        AD: number,
        critChance: number,
        infinityEdgeBonus: boolean = false
    ) {
        this.name = name;
        this.cost = cost;
        this.AD = AD;
        this.critChance = critChance;
        this.infinityEdgeBonus = infinityEdgeBonus;
    }
}
