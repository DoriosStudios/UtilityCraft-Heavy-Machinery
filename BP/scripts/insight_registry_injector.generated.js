import { system } from "@minecraft/server";

const REGISTRATION_MARKER = "__insightNamespaceRegistry_utilitycraft_heavy_machinery";
const REGISTRATION_RETRY_TICKS = 20;
const MAX_REGISTRATION_ATTEMPTS = 180;

const ADDON_CONTENT = Object.freeze({
  "key": "utilitycraft_heavy_machinery",
  "name": "UtilityCraft: Heavy Machinery",
  "type": "expansion",
  "namespace": "utilitycraft",
  "content": [
    "utilitycraft:advanced_power_condenser_unit",
    "utilitycraft:autosieve_controller",
    "utilitycraft:basic_power_condenser_unit",
    "utilitycraft:bronze_block",
    "utilitycraft:bronze_bricks",
    "utilitycraft:bronze_case",
    "utilitycraft:bronze_controller_case",
    "utilitycraft:bronze_dust",
    "utilitycraft:bronze_energy_port",
    "utilitycraft:bronze_fluid_port",
    "utilitycraft:bronze_hazard_block",
    "utilitycraft:bronze_ingot",
    "utilitycraft:bronze_item_port",
    "utilitycraft:bronze_nugget",
    "utilitycraft:bronze_plate",
    "utilitycraft:bronze_plated_block",
    "utilitycraft:bronze_vent_panel",
    "utilitycraft:brute_bronze",
    "utilitycraft:brute_bronze_block",
    "utilitycraft:charged_darloonite_crystal",
    "utilitycraft:control_panel",
    "utilitycraft:controller_case",
    "utilitycraft:crusher_controller",
    "utilitycraft:darloonite_crystal",
    "utilitycraft:deepslate_uranium_chunk",
    "utilitycraft:deepslate_tin_chunk",
    "utilitycraft:efficiency_module",
    "utilitycraft:electro_press_controller",
    "utilitycraft:energy_cell",
    "utilitycraft:expert_power_condenser_unit",
    "utilitycraft:enriched_uranium_bar",
    "utilitycraft:enriched_uranium_pellet",
    "utilitycraft:fluid_cell",
    "utilitycraft:fluid_tank_saline_coolant",
    "utilitycraft:heat_conductor",
    "utilitycraft:incinerator_controller",
    "utilitycraft:infuser_controller",
    "utilitycraft:magmatic_chamber_controller",
    "utilitycraft:multiblock_machine",
    "utilitycraft:nuclear_reactor_controller",
    "utilitycraft:netherite_bricks",
    "utilitycraft:netherite_case",
    "utilitycraft:netherite_energy_port",
    "utilitycraft:netherite_fluid_port",
    "utilitycraft:netherite_hazard_block",
    "utilitycraft:netherite_item_port",
    "utilitycraft:netherite_plated_block",
    "utilitycraft:netherite_vent_panel",
    "utilitycraft:power_condenser",
    "utilitycraft:power_condenser_controller",
    "utilitycraft:processing_module",
    "utilitycraft:raw_uranium",
    "utilitycraft:raw_uranium_block",
    "utilitycraft:raw_tin",
    "utilitycraft:raw_tin_block",
    "utilitycraft:reaction_chamber_controller",
    "utilitycraft:reinforced_bronze_glass",
    "utilitycraft:reinforced_netherite_glass",
    "utilitycraft:reinforced_steel_glass",
    "utilitycraft:saline_coolant_00",
    "utilitycraft:saline_coolant_01",
    "utilitycraft:saline_coolant_02",
    "utilitycraft:saline_coolant_03",
    "utilitycraft:saline_coolant_04",
    "utilitycraft:saline_coolant_05",
    "utilitycraft:saline_coolant_06",
    "utilitycraft:saline_coolant_07",
    "utilitycraft:saline_coolant_08",
    "utilitycraft:saline_coolant_09",
    "utilitycraft:saline_coolant_10",
    "utilitycraft:saline_coolant_11",
    "utilitycraft:saline_coolant_12",
    "utilitycraft:saline_coolant_13",
    "utilitycraft:saline_coolant_14",
    "utilitycraft:saline_coolant_15",
    "utilitycraft:saline_coolant_16",
    "utilitycraft:saline_coolant_17",
    "utilitycraft:saline_coolant_18",
    "utilitycraft:saline_coolant_19",
    "utilitycraft:saline_coolant_20",
    "utilitycraft:saline_coolant_21",
    "utilitycraft:saline_coolant_22",
    "utilitycraft:saline_coolant_23",
    "utilitycraft:saline_coolant_24",
    "utilitycraft:saline_coolant_25",
    "utilitycraft:saline_coolant_26",
    "utilitycraft:saline_coolant_27",
    "utilitycraft:saline_coolant_28",
    "utilitycraft:saline_coolant_29",
    "utilitycraft:saline_coolant_30",
    "utilitycraft:saline_coolant_31",
    "utilitycraft:saline_coolant_32",
    "utilitycraft:saline_coolant_33",
    "utilitycraft:saline_coolant_34",
    "utilitycraft:saline_coolant_35",
    "utilitycraft:saline_coolant_36",
    "utilitycraft:saline_coolant_37",
    "utilitycraft:saline_coolant_38",
    "utilitycraft:saline_coolant_39",
    "utilitycraft:saline_coolant_40",
    "utilitycraft:saline_coolant_41",
    "utilitycraft:saline_coolant_42",
    "utilitycraft:saline_coolant_43",
    "utilitycraft:saline_coolant_44",
    "utilitycraft:saline_coolant_45",
    "utilitycraft:saline_coolant_46",
    "utilitycraft:saline_coolant_47",
    "utilitycraft:saline_coolant_48",
    "utilitycraft:saline_coolant_bucket",
    "utilitycraft:speed_module",
    "utilitycraft:stamped_netherite_plate",
    "utilitycraft:steel_bricks",
    "utilitycraft:steel_case",
    "utilitycraft:steel_energy_port",
    "utilitycraft:steel_fluid_port",
    "utilitycraft:steel_hazard_block",
    "utilitycraft:steel_item_port",
    "utilitycraft:steel_plated_block",
    "utilitycraft:steel_vent_panel",
    "utilitycraft:tempered_bronze_glass",
    "utilitycraft:tempered_netherite_glass",
    "utilitycraft:tempered_steel_glass",
    "utilitycraft:thermo_core",
    "utilitycraft:thermo_reactor",
    "utilitycraft:thermo_reactor_controller",
    "utilitycraft:tin_block",
    "utilitycraft:tin_chunk",
    "utilitycraft:tin_dust",
    "utilitycraft:tin_ingot",
    "utilitycraft:tin_nugget",
    "utilitycraft:tin_plate",
    "utilitycraft:tin_plated_block",
    "utilitycraft:uranium_bar",
    "utilitycraft:uranium_block",
    "utilitycraft:uranium_dust",
    "utilitycraft:uranium_ingot",
    "utilitycraft:uranium_pellet",
    "utilitycraft:ultimate_power_condenser_unit",
    "utilitycraft:utility_exo_boots",
    "utilitycraft:utility_exo_chestplate",
    "utilitycraft:utility_exo_helmet",
    "utilitycraft:utility_exo_leggings"
  ]
});

function tryRegisterAddonContent() {
    if (globalThis[REGISTRATION_MARKER]) {
        return true;
    }

    const api = globalThis.InsightNamespaceRegistry;
    if (!api || typeof api.registerAddonContent !== "function") {
        return false;
    }

    api.registerAddonContent(ADDON_CONTENT, false);
    globalThis[REGISTRATION_MARKER] = true;
    return true;
}

function registerAddonContentWithRetry(attempt = 0) {
    if (tryRegisterAddonContent() || attempt >= MAX_REGISTRATION_ATTEMPTS) {
        return;
    }

    system.runTimeout(() => {
        registerAddonContentWithRetry(attempt + 1);
    }, REGISTRATION_RETRY_TICKS);
}

registerAddonContentWithRetry();
