import * as DoriosLib from "DoriosLib/index.js";

/**
 * Registers every Heavy Machinery recipe tagged `utilitycraft_workbench`
 * with UtilityCraft's Crafter through the shared DoriosLib registry.
 */
const crafterRecipeBatches = [
  {
    "bronze_plated_block,bronze_plated_block,air,bronze_plated_block,bronze_plated_block,air,air,air,air": {
      output: "utilitycraft:bronze_bricks",
      amount: 4,
    },
    "bronze_plate,diamond_dust,bronze_plate,diamond_dust,tin_ingot,diamond_dust,bronze_plate,diamond_dust,bronze_plate": {
      output: "utilitycraft:bronze_case",
      amount: 1,
    },
    "tin_plate,energy_cable,tin_plate,energy_cable,bronze_case,energy_cable,tin_plate,energy_cable,tin_plate": {
      output: "utilitycraft:bronze_energy_port",
      amount: 1,
    },
    "tin_plate,fluid_pipe,tin_plate,fluid_pipe,bronze_case,fluid_pipe,tin_plate,fluid_pipe,tin_plate": {
      output: "utilitycraft:bronze_fluid_port",
      amount: 1,
    },
    "black_dye,bronze_plated_block,yellow_dye,air,air,air,air,air,air": {
      output: "utilitycraft:bronze_hazard_block",
      amount: 1,
    },
    "tin_plate,item_conduit,tin_plate,item_conduit,bronze_case,item_conduit,tin_plate,item_conduit,tin_plate": {
      output: "utilitycraft:bronze_item_port",
      amount: 1,
    },
    "bronze_plate,tin_ingot,bronze_plate,tin_ingot,bronze_plate,tin_ingot,bronze_plate,tin_ingot,bronze_plate": {
      output: "utilitycraft:bronze_plated_block",
      amount: 1,
    },
    "bronze_plate,tin_ingot,bronze_plate,tin_ingot,air,tin_ingot,bronze_plate,tin_ingot,bronze_plate": {
      output: "utilitycraft:bronze_vent_panel",
      amount: 1,
    },
    "bronze_ingot,tin_ingot,bronze_ingot,tin_ingot,glass,tin_ingot,bronze_ingot,tin_ingot,bronze_ingot": {
      output: "utilitycraft:reinforced_bronze_glass",
      amount: 1,
    },
    "steel_ingot,tin_ingot,steel_ingot,tin_ingot,glass,tin_ingot,steel_ingot,tin_ingot,steel_ingot": {
      output: "utilitycraft:reinforced_steel_glass",
      amount: 1,
    },
    "steel_plated_block,steel_plated_block,air,steel_plated_block,steel_plated_block,air,air,air,air": {
      output: "utilitycraft:steel_bricks",
      amount: 4,
    },
    "steel_plate,diamond_dust,steel_plate,diamond_dust,tin_ingot,diamond_dust,steel_plate,diamond_dust,steel_plate": {
      output: "utilitycraft:steel_case",
      amount: 1,
    },
    "tin_plate,energy_cable,tin_plate,energy_cable,steel_case,energy_cable,tin_plate,energy_cable,tin_plate": {
      output: "utilitycraft:steel_energy_port",
      amount: 1,
    },
    "tin_plate,fluid_pipe,tin_plate,fluid_pipe,steel_case,fluid_pipe,tin_plate,fluid_pipe,tin_plate": {
      output: "utilitycraft:steel_fluid_port",
      amount: 1,
    },
    "black_dye,steel_plated_block,yellow_dye,air,air,air,air,air,air": {
      output: "utilitycraft:steel_hazard_block",
      amount: 1,
    },
    "tin_plate,item_conduit,tin_plate,item_conduit,steel_case,item_conduit,tin_plate,item_conduit,tin_plate": {
      output: "utilitycraft:steel_item_port",
      amount: 1,
    },
    "steel_plate,tin_ingot,steel_plate,tin_ingot,steel_plate,tin_ingot,steel_plate,tin_ingot,steel_plate": {
      output: "utilitycraft:steel_plated_block",
      amount: 1,
    },
    "steel_plate,tin_ingot,steel_plate,tin_ingot,air,tin_ingot,steel_plate,tin_ingot,steel_plate": {
      output: "utilitycraft:steel_vent_panel",
      amount: 1,
    },
    "steel_plate,control_panel,steel_plate,charged_darloonite_crystal,controller_case,charged_darloonite_crystal,steel_plate,autosieve,steel_plate": {
      output: "utilitycraft:autosieve_controller",
      amount: 1,
    },
    "bronze_ingot,bronze_plate,bronze_ingot,bronze_plate,steel_case,bronze_plate,bronze_ingot,diamond_dust,bronze_ingot": {
      output: "utilitycraft:bronze_controller_case",
      amount: 1,
    },
    "gold_ingot,redstone,gold_ingot,steel_plate,basic_chip,steel_plate,redstone,gold_ingot,redstone": {
      output: "utilitycraft:control_panel",
      amount: 1,
    },
  },
  {
    "tin_ingot,tin_plate,tin_ingot,tin_plate,steel_case,tin_plate,tin_ingot,diamond_dust,tin_ingot": {
      output: "utilitycraft:controller_case",
      amount: 1,
    },
    "steel_plate,control_panel,steel_plate,charged_darloonite_crystal,controller_case,charged_darloonite_crystal,steel_plate,crusher,steel_plate": {
      output: "utilitycraft:crusher_controller",
      amount: 1,
    },
    "steel_plate,control_panel,steel_plate,charged_darloonite_crystal,controller_case,charged_darloonite_crystal,steel_plate,electro_press,steel_plate": {
      output: "utilitycraft:electro_press_controller",
      amount: 1,
    },
    "charged_darloonite_crystal,expert_battery,charged_darloonite_crystal,expert_battery,steel_case,expert_battery,charged_darloonite_crystal,expert_battery,charged_darloonite_crystal": {
      output: "utilitycraft:energy_cell",
      amount: 1,
    },
    "steel_plate,control_panel,steel_plate,charged_darloonite_crystal,controller_case,charged_darloonite_crystal,steel_plate,incinerator,steel_plate": {
      output: "utilitycraft:incinerator_controller",
      amount: 1,
    },
    "steel_plate,control_panel,steel_plate,charged_darloonite_crystal,controller_case,charged_darloonite_crystal,steel_plate,infuser,steel_plate": {
      output: "utilitycraft:infuser_controller",
      amount: 1,
    },
    "bronze_plate,control_panel,bronze_plate,charged_darloonite_crystal,bronze_controller_case,charged_darloonite_crystal,bronze_plate,magmatic_chamber,bronze_plate": {
      output: "utilitycraft:magmatic_chamber_controller",
      amount: 1,
    },
    "tin_plate,emerald_dust,tin_plate,energy_upgrade,steel_case,energy_upgrade,tin_plate,charged_darloonite_crystal,tin_plate": {
      output: "utilitycraft:efficiency_module",
      amount: 1,
    },
    "tin_plate,fluid_pipe,tin_plate,expert_fluid_tank,steel_fluid_port,expert_fluid_tank,tin_plate,fluid_pipe,tin_plate": {
      output: "utilitycraft:fluid_cell",
      amount: 1,
    },
    "netherite_plate,tin_ingot,netherite_plate,netherite_plate,steel_case,netherite_plate,netherite_plate,tin_ingot,netherite_plate": {
      output: "utilitycraft:heat_conductor",
      amount: 1,
    },
    "tin_plate,expert_chip,tin_plate,charged_darloonite_crystal,controller_case,charged_darloonite_crystal,tin_plate,expert_chip,tin_plate": {
      output: "utilitycraft:processing_module",
      amount: 1,
    },
    "tin_plate,emerald_dust,tin_plate,speed_upgrade,steel_case,speed_upgrade,tin_plate,charged_darloonite_crystal,tin_plate": {
      output: "utilitycraft:speed_module",
      amount: 1,
    },
    "tin_plate,control_panel,tin_plate,netherite_plate,steel_case,netherite_plate,tin_plate,netherite_plate,tin_plate": {
      output: "utilitycraft:thermo_core",
      amount: 1,
    },
    "steel_plate,control_panel,steel_plate,tin_ingot,controller_case,tin_ingot,steel_plate,charged_darloonite_crystal,steel_plate": {
      output: "utilitycraft:power_condenser_controller",
      amount: 1,
    },
    "steel_plate,control_panel,steel_plate,stabilized_obsidian_dust,controller_case,stabilized_obsidian_dust,steel_plate,charged_darloonite_crystal,steel_plate": {
      output: "utilitycraft:reaction_chamber_controller",
      amount: 1,
    },
    "ultimate_chip,control_panel,ultimate_chip,charged_darloonite_crystal,bronze_controller_case,charged_darloonite_crystal,tin_ingot,charged_darloonite_crystal,tin_ingot": {
      output: "utilitycraft:thermo_reactor_controller",
      amount: 1,
    },
    "charged_darloonite_crystal,basic_power_condenser_unit,charged_darloonite_crystal,basic_power_condenser_unit,advanced_chip,basic_power_condenser_unit,advanced_chip,charged_darloonite_crystal,advanced_chip": {
      output: "utilitycraft:advanced_power_condenser_unit",
      amount: 1,
    },
    "charged_darloonite_crystal,energy_cell,charged_darloonite_crystal,energy_cell,basic_chip,energy_cell,basic_chip,charged_darloonite_crystal,basic_chip": {
      output: "utilitycraft:basic_power_condenser_unit",
      amount: 1,
    },
    "charged_darloonite_crystal,advanced_power_condenser_unit,charged_darloonite_crystal,advanced_power_condenser_unit,expert_chip,advanced_power_condenser_unit,expert_chip,charged_darloonite_crystal,expert_chip": {
      output: "utilitycraft:expert_power_condenser_unit",
      amount: 1,
    },
    "charged_darloonite_crystal,expert_power_condenser_unit,charged_darloonite_crystal,expert_power_condenser_unit,ultimate_chip,expert_power_condenser_unit,ultimate_chip,charged_darloonite_crystal,ultimate_chip": {
      output: "utilitycraft:ultimate_power_condenser_unit",
      amount: 1,
    },
    "tin_plate,tin_ingot,tin_plate,tin_ingot,tin_plate,tin_ingot,tin_plate,tin_ingot,tin_plate": {
      output: "utilitycraft:tin_plated_block",
      amount: 1,
    },
  },
];

for (const batch of crafterRecipeBatches) {
  DoriosLib.registry.registerCrafterRecipe(batch);
}

