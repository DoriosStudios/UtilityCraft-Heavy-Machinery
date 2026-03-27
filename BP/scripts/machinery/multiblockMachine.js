import { ItemStack, system } from "@minecraft/server";
import { BasicMachine, EnergyStorage, FluidStorage } from "DoriosCore/index.js";
import * as Utils from "../DoriosCore/utils/entity.js";

export class MultiblockMachine extends BasicMachine {
  /**
   * Creates a new multiblock machine wrapper over DoriosCore's BasicMachine.
   *
   * This keeps the old multiblock-controller API surface without pulling in the
   * upgrade and transfer helpers from the full Machine class.
   *
   * @param {Block} block
   * @param {MachineSettings} settings
   */
  constructor(block, settings) {
    super(block, settings?.machine?.rate_speed_base ?? 0);
    if (!this.valid) return;
    this.settings = settings;
  }

  /**
   * Spawns a multiblock machine entity and restores stored block data.
   *
   * @param {{
   *   block: import("@minecraft/server").Block,
   *   player: import("@minecraft/server").Player,
   *   permutationToPlace: import("@minecraft/server").BlockPermutation,
   * }} e
   * @param {MachineSettings} config
   * @param {(entity: import("@minecraft/server").Entity) => void} [callback]
   */
  static spawnEntity(e, config, callback) {
    const { block, player, permutationToPlace } = e;
    const mainHand = player.getComponent("equippable").getEquipment("Mainhand");
    const { energy, fluid } = Utils.getEnergyAndFluidFromItem(mainHand);

    system.run(() => {
      const entity = Utils.spawnEntity(block, config);
      const energyManager = new EnergyStorage(entity);
      energyManager.setCap(config?.machine?.energy_cap ?? 0);
      energyManager.set(energy);

      if (config?.machine?.fluid_cap) {
        const fluidManager = new FluidStorage(entity);
        fluidManager.setCap(config.machine.fluid_cap);

        if (fluid && fluid.amount > 0) {
          fluidManager.setType(fluid.type);
          fluidManager.set(fluid.amount);
        }
      }

      system.runTimeout(() => {
        if (callback) {
          try {
            callback(entity);
          } catch {
            system.runTimeout(() => callback(entity), 2);
          }
        }
      }, 2);
    });

    Utils.updateAdjacentNetwork(block, permutationToPlace);
  }

  /**
   * Handles multiblock-machine destruction using the same lore/drop flow as the
   * DoriosCore Machine class, without depending on that class directly.
   *
   * @param {{ block: Block, brokenBlockPermutation: BlockPermutation, player: Player, dimension: Dimension }} e
   */
  static onDestroy(e) {
    const { block, brokenBlockPermutation, player, dimension: dim } = e;
    const entity = dim.getEntitiesAtBlockLocation(block.location)[0];
    if (!entity) return false;

    const energy = new EnergyStorage(entity);
    const fluid = new FluidStorage(entity);
    const blockItemId = brokenBlockPermutation.type.id;
    const blockItem = new ItemStack(blockItemId);
    const lore = [];

    if (energy.get() > 0) {
      lore.push(
        `§r§7  Energy: ${EnergyStorage.formatEnergyToText(energy.get())}/${EnergyStorage.formatEnergyToText(energy.cap)}`,
      );
    }

    if (fluid.type != "empty") {
      const liquidName = DoriosAPI.utils.capitalizeFirst(fluid.type);
      lore.push(
        `§r§7  ${liquidName}: ${FluidStorage.formatFluid(fluid.get())}/${FluidStorage.formatFluid(fluid.cap)}`,
      );
    }

    if (lore.length > 0) {
      blockItem.setLore(lore);
    }

    system.run(() => {
      if (player?.isInSurvival()) {
        const oldItemEntity = dim
          .getEntities({
            type: "item",
            maxDistance: 3,
            location: block.center(),
          })
          .find((item) => item.getComponent("minecraft:item")?.itemStack?.typeId === blockItemId);
        oldItemEntity?.remove();
      }

      Utils.dropAllItems(entity);
      entity.remove();
      dim.spawnItem(blockItem, block.center());
    });

    return true;
  }

  /**
   * Old multiblock-machine compatibility signature.
   *
   * @param {number} value
   * @param {number} [slot=2]
   * @param {string} [type="arrow_right"]
   * @param {boolean} [display=true]
   * @param {number} [index=0]
   */
  setProgress(value, slot = 2, type = "arrow_right", display = true, index = 0) {
    super.setProgress(value, { slot, type, display, index });
  }

  /**
   * Old multiblock-machine compatibility signature.
   *
   * @param {number} [slot=2]
   * @param {string} [type="arrow_right"]
   * @param {number} [index=0]
   */
  displayProgress(slot = 2, type = "arrow_right", index = 0) {
    const energyCost = this.getEnergyCost(index);
    if (!energyCost || energyCost <= 0) return;

    super.displayProgress(energyCost, { slot, type, index, scale: 16 });
  }

  /**
   * Sets the machine's energy cost (maximum progress).
   *
   * @param {number} value
   * @param {number} [index=0]
   */
  setEnergyCost(value, index = 0) {
    this.entity.setDynamicProperty(`dorios:energy_cost_${index}`, Math.max(1, value));
  }

  /**
   * Gets the machine's energy cost (maximum progress).
   *
   * @param {number} [index=0]
   */
  getEnergyCost(index = 0) {
    return this.entity.getDynamicProperty(`dorios:energy_cost_${index}`) ?? 800;
  }

  /**
   * Computes all effective machine statistics from installed components.
   *
   * @param {MachineComponents} components
   * @returns {MachineStats}
   */
  static computeMachineStats(components) {
    const processing = Math.max(1, components.processing_module | 0);
    const speed = Math.max(0, components.speed_module | 0);
    const efficiency = Math.max(0, components.efficiency_module | 0);

    const processAmount = 2 * processing;
    const processingPenalty = 1 + 2.25 * (processing - 1);

    const MAX_SPEED_BONUS = 999;
    const SPEED_K = 3200;
    const speedMultiplier = 1 + (MAX_SPEED_BONUS * speed) / (SPEED_K + speed);

    const MAX_SPEED_PENALTY = 99;
    const SPEED_PENALTY_K = 640;
    const speedPenalty = 1 + (MAX_SPEED_PENALTY * speed) / (SPEED_PENALTY_K + speed);

    const MIN_EFFICIENCY = 0.01;
    const EFFICIENCY_RATE = 0.15;
    const efficiencyMultiplier =
      MIN_EFFICIENCY + (1 - MIN_EFFICIENCY) * Math.exp(-EFFICIENCY_RATE * efficiency);

    return {
      raw: {
        processing,
        speed,
        efficiency,
      },

      processing: {
        amount: Math.floor(processAmount),
        penalty: processingPenalty,
      },

      speed: {
        multiplier: speedMultiplier,
        penalty: speedPenalty,
      },

      efficiency: {
        multiplier: efficiencyMultiplier,
      },

      energyMultiplier: processingPenalty * speedPenalty * efficiencyMultiplier,
    };
  }

  /**
   * Updates the main machine information label (slot 1).
   *
   * @param {MultiblockMachine} controller
   * @param {MachineStats} data
   * @param {string} [status="§aRunning"]
   * @returns {string}
   */
  static setMachineInfoLabel(controller, data, status = "§aRunning") {
    const infoText = `§r§7Status: ${status}

§r§eMachine Information

§r§aInput Capacity §fx${data.processing.amount}
§r§aCost §f${data.cost ? EnergyStorage.formatEnergyToText(data.cost * data.processing.amount) : "---"}
§r§aSpeed §fx${data.speed.multiplier.toFixed(2)}
§r§aEfficiency §f${((data.processing.amount / data.energyMultiplier) * 100).toFixed(2)}%%
`;

    controller.setLabel(infoText, 1);
    return "\n".repeat(infoText.split("\n").length - 1);
  }
}
