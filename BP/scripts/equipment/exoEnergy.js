export const EXO_CAPACITY = 1_000_000_000;
export const EXO_ENERGY_PER_DAMAGE = 1_000_000;
export const EXO_ABSORPTION = 0.225;
export const EXO_MAX_DURABILITY = 100_000;
export const EXO_VISUAL_MIN = 1_000;
export const EXO_VISUAL_MAX = 99_000;
export const EXO_ENERGY_PROPERTY = 'utilitycraft:exo_energy';
export const EXO_ID_PROPERTY = 'utilitycraft:exo_id';
export const EXO_ITEMS = Object.freeze({
    Head: 'utilitycraft:utility_exo_helmet',
    Chest: 'utilitycraft:utility_exo_chestplate',
    Legs: 'utilitycraft:utility_exo_leggings',
    Feet: 'utilitycraft:utility_exo_boots',
});

export function isExo(item) {
    return item && Object.values(EXO_ITEMS).includes(item.typeId);
}

export function readExoEnergy(item) {
    const value = item.getDynamicProperty(EXO_ENERGY_PROPERTY);
    return Number.isFinite(value) ? Math.max(0, Math.min(EXO_CAPACITY, value)) : 0;
}

export function exoVisualDamage(energy) {
    const fraction = Math.max(0, Math.min(1, energy / EXO_CAPACITY));
    return EXO_MAX_DURABILITY - Math.round(EXO_VISUAL_MIN + fraction * (EXO_VISUAL_MAX - EXO_VISUAL_MIN));
}

// All shares use the event's incoming damage, never the previous piece's remainder.
export function absorbExoDamage(damage, energies, fall = false) {
    const spent = energies.map(() => 0);
    if (!Number.isFinite(damage) || damage <= 0) return { damage, spent, cancel: false };
    if (fall && energies[3] >= damage * EXO_ENERGY_PER_DAMAGE) {
        spent[3] = damage * EXO_ENERGY_PER_DAMAGE;
        return { damage: 0, spent, cancel: true };
    }
    let absorbed = 0;
    for (let i = 0; i < energies.length; i++) {
        spent[i] = Math.min(Math.max(0, energies[i]), damage * EXO_ABSORPTION * EXO_ENERGY_PER_DAMAGE);
        absorbed += spent[i] / EXO_ENERGY_PER_DAMAGE;
    }
    return { damage: Math.max(0, damage - absorbed), spent, cancel: false };
}

export function writeExoEnergy(item, energy) {
    energy = Math.max(0, Math.min(EXO_CAPACITY, energy));
    item.setDynamicProperty(EXO_ENERGY_PROPERTY, energy);
    const durability = item.getComponent('minecraft:durability');
    if (durability) durability.damage = exoVisualDamage(energy);
    const prefix = '\u00a7r\u00a7bEnergy: ';
    const lore = item.getLore().filter(line => !line.startsWith(prefix));
    lore.push(`${prefix}${(energy / EXO_CAPACITY * 100).toFixed(1)}% (${Math.floor(energy).toLocaleString('en-US')} / 1,000,000,000 DE)`);
    item.setLore(lore);
}
