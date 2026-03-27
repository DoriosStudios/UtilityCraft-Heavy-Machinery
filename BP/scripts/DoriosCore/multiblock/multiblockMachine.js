import { ItemStack, system } from "@minecraft/server";
import { BasicMachine } from "../machinery/basicMachine.js";
import { EnergyStorage } from "../machinery/energyStorage.js";
import { FluidStorage } from "../machinery/fluidStorage.js";
import { MultiblockManager } from "./multiblock.js";
import * as Utils from "../utils/entity.js";

export class MultiblockMachine extends BasicMachine {
  constructor(block, settings) {
    super(block, settings?.machine?.rate_speed_base ?? 0);
    if (!this.valid) return;
    this.settings = settings;
  }

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

  static async activateMachineController(e, settings, entity, config = {}) {
    const {
      requirements = {},
      onActivate,
      successMessages = [],
    } = config;
    const { block, player } = e;

    MultiblockManager.deactivateMultiblock(block, player);

    const structure = await MultiblockManager.detectFromController(e, settings.required_case);
    if (!structure) return;

    const failure = this.validateRequirements(structure.components, requirements);
    if (failure) {
      player.sendMessage(failure.warning);
      MultiblockManager.deactivateMultiblock(block, player);
      return;
    }

    const energyCap = MultiblockManager.activateMultiblock(entity, structure);
    const factoryData = this.computeMachineStats(structure.components);
    entity.setDynamicProperty("components", JSON.stringify(factoryData));

    const context = {
      block,
      components: structure.components,
      energyCap,
      entity,
      factoryData,
      player,
      settings,
      structure,
    };

    if (onActivate) {
      const result = await onActivate(context);
      if (result === false) {
        MultiblockManager.deactivateMultiblock(block, player);
        return;
      }
    }

    const messages =
      typeof successMessages === "function" ? successMessages(context) : successMessages;
    for (const message of messages) {
      if (message) player.sendMessage(message);
    }

    return context;
  }

  static validateRequirements(components, requirements) {
    for (const [componentId, requirement] of Object.entries(requirements)) {
      const amount = components[componentId] ?? 0;
      if (amount < requirement.amount) {
        return requirement;
      }
    }
  }

  static distributeOutput(controller, outputSlots, itemId, amount, options = {}) {
    const { suppressErrors = false } = options;
    let remaining = amount;
    const entity = controller.entity;

    for (const slot of outputSlots) {
      if (remaining <= 0) break;

      const writeOutput = () => {
        const out = controller.container.getItem(slot);

        if (!out) {
          const add = Math.min(64, remaining);
          entity.setItem(slot, itemId, add);
          remaining -= add;
          return;
        }

        if (out.typeId === itemId && out.amount < out.maxAmount) {
          const add = Math.min(out.maxAmount - out.amount, remaining);
          entity.changeItemAmount(slot, add);
          remaining -= add;
        }
      };

      if (suppressErrors) {
        try {
          writeOutput();
        } catch {}
      } else {
        writeOutput();
      }
    }
  }

  setProgress(value, slot = 2, type = "arrow_right", display = true, index = 0) {
    super.setProgress(value, { slot, type, display, index });
  }

  displayProgress(slot = 2, type = "arrow_right", index = 0) {
    const energyCost = this.getEnergyCost(index);
    if (!energyCost || energyCost <= 0) return;

    super.displayProgress(energyCost, { slot, type, index, scale: 16 });
  }

  setEnergyCost(value, index = 0) {
    this.entity.setDynamicProperty(`dorios:energy_cost_${index}`, Math.max(1, value));
  }

  getEnergyCost(index = 0) {
    return this.entity.getDynamicProperty(`dorios:energy_cost_${index}`) ?? 800;
  }

  static computeMachineStats(components) {
    const processing = Math.max(1, components.processing_module | 0);
    const speed = Math.max(0, components.speed_module | 0);
    const efficiency = Math.max(0, components.efficiency_module | 0);

    const processAmount = 2 * processing;
    const processingPenalty = 1 + 2.25 * (processing - 1);

    const maxSpeedBonus = 999;
    const speedK = 3200;
    const speedMultiplier = 1 + (maxSpeedBonus * speed) / (speedK + speed);

    const maxSpeedPenalty = 99;
    const speedPenaltyK = 640;
    const speedPenalty = 1 + (maxSpeedPenalty * speed) / (speedPenaltyK + speed);

    const minEfficiency = 0.01;
    const efficiencyRate = 0.15;
    const efficiencyMultiplier =
      minEfficiency + (1 - minEfficiency) * Math.exp(-efficiencyRate * efficiency);

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
