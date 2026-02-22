export interface EnemyArmorProfile {
    id: string;
    name: string;
    baseArmor: number;
    armorGrowth: number;
    includedChampions?: string[];
}

export interface EnemyArmorItem {
    id: string;
    name: string;
    armor: number;
}

export const ENEMY_ARMOR_PROFILES: EnemyArmorProfile[] = [
    {
        id: "adc",
        name: "Profile: ADC",
        baseArmor: 26,
        armorGrowth: 4.3,
        includedChampions: [
            "Aphelios",
            "Ashe",
            "Caitlyn",
            "Corki",
            "Draven",
            "Ezreal",
            "Jhin",
            "Jinx",
            "Kai'Sa",
            "Kalista",
            "Kog'Maw",
            "Lucian",
            "Miss Fortune",
            "Samira",
            "Senna",
            "Sivir",
            "Smolder",
            "Tristana",
            "Twitch",
            "Varus",
            "Vayne",
            "Xayah",
            "Yunara",
            "Zeri",
        ],
    },
    {
        id: "ranged_support",
        name: "Profile: Ranged Support",
        baseArmor: 25,
        armorGrowth: 4.6,
        includedChampions: [
            "Annie",
            "Ashe",
            "Bard",
            "Brand",
            "Heimerdinger",
            "Hwei",
            "Ivern",
            "Janna",
            "Karma",
            "Lulu",
            "Lux",
            "Mel",
            "Milio",
            "Morgana",
            "Nami",
            "Neeko",
            "Orianna",
            "Rakan",
            "Renata Glasc",
            "Senna",
            "Seraphine",
            "Sona",
            "Soraka",
            "Swain",
            "Taliyah",
            "Vel'Koz",
            "Xerath",
            "Zilean",
            "Zyra",
        ],
    },
    {
        id: "melee_support",
        name: "Profile: Melee Support",
        baseArmor: 38,
        armorGrowth: 4.7,
        includedChampions: [
            "Alistar",
            "Amumu",
            "Blitzcrank",
            "Braum",
            "Leona",
            "Maokai",
            "Nautilus",
            "Pyke",
            "Rell (dismounted)",
            "Tahm Kench",
            "Taric",
        ],
    },
];

export const CURATED_ARMOR_ITEMS: EnemyArmorItem[] = [
    { id: "cloth-armor", name: "Cloth Armor", armor: 15 },
    { id: "plated-steelcaps", name: "Plated Steelcaps", armor: 25 },
    { id: "chain-vest", name: "Chain Vest", armor: 40 },
    { id: "wardens-mail", name: "Warden's Mail", armor: 40 },
    { id: "bramble-vest", name: "Bramble Vest", armor: 40 },
    { id: "frozen-heart", name: "Frozen Heart", armor: 75 },
    { id: "thornmail", name: "Thornmail", armor: 75 },
    { id: "randuins-omen", name: "Randuin's Omen", armor: 75 },
    { id: "sunfire-aegis", name: "Sunfire Aegis", armor: 50 },
    { id: "dead-mans-plate", name: "Dead Man's Plate", armor: 45 },
    { id: "guardian-angel", name: "Guardian Angel", armor: 40 },
];
