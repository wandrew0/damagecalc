import { Item } from "../classes/Item";
import { ALL_ITEMS } from "../data/Items";
import { ITEM_IDS } from "../data/item-ids";

export interface PersistedItemData {
    id?: number;
    itemId?: number;
    name?: string;
    cost?: number;
    AD?: number;
    critChance?: number;
    infinityEdgeBonus?: boolean;
    lethality?: number;
    armorPenetration?: number;
    aliases?: string[];
    imagePath?: string;
}

const ITEM_TEMPLATE_BY_NAME = new Map<string, Item>(
    ALL_ITEMS.map((item) => [item.name, item])
);
const ITEM_ID_BY_NAME = new Map<string, number>(Object.entries(ITEM_IDS));
const ITEM_NAME_BY_ID = new Map<number, string>(
    Object.entries(ITEM_IDS).map(([name, id]) => [id, name])
);

function cloneItem(template: Item): Item {
    return new Item(
        template.name,
        template.cost,
        template.AD,
        template.critChance,
        template.infinityEdgeBonus ?? false,
        template.lethality,
        template.armorPenetration,
        [...template.aliases],
        template.imagePath
    );
}

function tryGetPersistedId(item: PersistedItemData): number | null {
    const raw = item.id ?? item.itemId;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
        return null;
    }
    return Math.floor(raw);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function toLegacyItem(item: PersistedItemData): Item | null {
    if (
        typeof item.name !== "string" ||
        typeof item.cost !== "number" ||
        !Number.isFinite(item.cost) ||
        typeof item.AD !== "number" ||
        !Number.isFinite(item.AD) ||
        typeof item.critChance !== "number" ||
        !Number.isFinite(item.critChance) ||
        typeof item.lethality !== "number" ||
        !Number.isFinite(item.lethality) ||
        typeof item.armorPenetration !== "number" ||
        !Number.isFinite(item.armorPenetration) ||
        !isStringArray(item.aliases)
    ) {
        return null;
    }

    return Item.fromJSON({
        name: item.name,
        cost: item.cost,
        AD: item.AD,
        critChance: item.critChance,
        infinityEdgeBonus: item.infinityEdgeBonus,
        lethality: item.lethality,
        armorPenetration: item.armorPenetration,
        aliases: item.aliases,
        imagePath: item.imagePath,
    });
}

function buildItemDataFingerprint(): string {
    const rows = ALL_ITEMS.map((item) => {
        const id = ITEM_ID_BY_NAME.get(item.name) ?? -1;
        return [
            id,
            item.name,
            item.cost,
            item.AD,
            item.critChance,
            item.infinityEdgeBonus ? 1 : 0,
            item.lethality,
            item.armorPenetration,
            item.imagePath,
        ].join("|");
    }).sort();

    const payload = rows.join(";");
    let hash = 0x811c9dc5;
    for (let i = 0; i < payload.length; i++) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return `items-${rows.length}-${(hash >>> 0).toString(16)}`;
}

export const ITEM_DATA_VERSION = buildItemDataFingerprint();

export function getItemIdForName(name: string): number | undefined {
    return ITEM_ID_BY_NAME.get(name);
}

export function getItemNameForId(id: number): string | undefined {
    const normalized = Number.isFinite(id) ? Math.floor(id) : NaN;
    if (!Number.isFinite(normalized)) {
        return undefined;
    }
    return ITEM_NAME_BY_ID.get(normalized);
}

export function resolveItemByName(name: string): Item | null {
    const template = ITEM_TEMPLATE_BY_NAME.get(name);
    return template ? cloneItem(template) : null;
}

export function resolveItemById(id: number): Item | null {
    const itemName = getItemNameForId(id);
    if (!itemName) {
        return null;
    }
    return resolveItemByName(itemName);
}

export function serializeItemReference(item: Item): { id?: number; name: string } {
    const id = getItemIdForName(item.name);
    return id ? { id, name: item.name } : { name: item.name };
}

export function deserializePersistedItem(raw: unknown): Item | null {
    if (typeof raw === "string" && raw.length > 0) {
        return resolveItemByName(raw);
    }

    if (!raw || typeof raw !== "object") {
        return null;
    }

    const persisted = raw as PersistedItemData;
    const itemId = tryGetPersistedId(persisted);
    if (itemId !== null) {
        const byId = resolveItemById(itemId);
        if (byId) {
            return byId;
        }
    }

    if (typeof persisted.name === "string" && persisted.name.length > 0) {
        const byName = resolveItemByName(persisted.name);
        if (byName) {
            return byName;
        }
    }

    return toLegacyItem(persisted);
}

export function normalizePersistedItemName(raw: unknown): string | null {
    const item = deserializePersistedItem(raw);
    return item?.name ?? null;
}
