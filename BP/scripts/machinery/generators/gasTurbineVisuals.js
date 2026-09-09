// Visual coverage is independent of the two gases that power the turbine.
// Unknown gases use Steam without changing their stored type or energy eligibility.
export const DEFAULT_TURBINE_GAS_VISUAL = 'steam';
export const TURBINE_GAS_VISUALS = Object.freeze({
    steam: Object.freeze({ texture: "textures/entity/steam_gas", maxOpacity: 0.6 }),
    heated_saline_coolant_gas: Object.freeze({ texture: "textures/entity/heated_saline_coolant_gas", maxOpacity: 0.6 }),
    hydrogen_gas: Object.freeze({ texture: "textures/entity/hydrogen_gas", maxOpacity: 0.8 }),
    methane_gas: Object.freeze({ texture: "textures/entity/methane_gas", maxOpacity: 0.6 }),
    oxygen_gas: Object.freeze({ texture: "textures/entity/oxygen_gas", maxOpacity: 0.6 }),
    fluorine_gas: Object.freeze({ texture: "textures/entity/fluorine_gas", maxOpacity: 0.6 }),
    hydrogen_fluoride_gas: Object.freeze({ texture: "textures/entity/hydrogen_fluoride_gas", maxOpacity: 0.6 }),
    natural_uranium_hexafluoride_gas: Object.freeze({ texture: "textures/entity/natural_uranium_hexafluoride_gas", maxOpacity: 0.6 }),
    enriched_uranium_hexafluoride_gas: Object.freeze({ texture: "textures/entity/enriched_uranium_hexafluoride_gas", maxOpacity: 0.6 }),
    depleted_uranium_hexafluoride_gas: Object.freeze({ texture: "textures/entity/depleted_uranium_hexafluoride_gas", maxOpacity: 0.6 }),
    nuclear_waste_gas: Object.freeze({ texture: "textures/entity/nuclear_waste_gas", maxOpacity: 0.6 }),
});
