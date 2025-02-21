export class Champion {
    name: string;
    startAD: number;
    perLevelAD: number;

    constructor(name: string, startAD: number, perLevelAD: number) {
        this.name = name;
        this.startAD = startAD;
        this.perLevelAD = perLevelAD;
    }

    getAD(level: number): number {
        return this.startAD + this.perLevelAD * (level - 1);
    }
}
