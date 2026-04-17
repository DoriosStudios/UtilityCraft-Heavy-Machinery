import { ItemStack, system } from "@minecraft/server";
import { Generator } from "../machinery/generator.js";
import { EnergyStorage } from "../machinery/energyStorage.js";
import { FluidStorage } from "../machinery/fluidStorage.js";
import { ActivationManager } from "./activationManager.js";
import { DeactivationManager } from "./deactivationManager.js";
import { StructureDetector } from "./structureDetection.js";
import * as Utils from "../utils/entity.js";

export class MultiblockGenerator extends Generator {
  /**
   * Creates a multiblock generator runtime bound to a controller block.
   *
   * Unlike multiblock machines, generators may still need to tick while their
   * state is `off`, so validity is inherited directly from {@link Generator}.
   *
   * @param {Block} block Controller block representing the generator.
   * @param {GeneratorSettings} settings Multiblock generator configuration.
   */
  constructor(block, settings) {
    super(block, settings);
    if (!this.valid) return;

    this.settings = settings;
  }

  /**
   * Spawns a multiblock generator controller entity and reapplies its localized
   * container title after the base generator initialization finishes.
   *
   * Some generator initialization paths can leave the name tag unset or with an
   * unexpected value, so multiblock generators normalize it here using the
   * configured entity name.
   *
   * @param {{
   *   block: Block,
   *   player: Player,
   *   permutationToPlace: BlockPermutation,
   * }} e Placement event data used to create the entity.
   * @param {GeneratorSettings} config Multiblock generator configuration.
   * @param {(entity: Entity) => void} [callback]
   * Optional callback invoked after the entity has been created.
   */
  static spawnEntity(e, config, callback) {
    const { block, player } = e;

    const mainHand = player.getComponent("equippable").getEquipment("Mainhand")
    const { energy, fluid } = Utils.getEnergyAndFluidFromItem(mainHand);

    system.run(() => {
      const entity = Utils.spawnEntity(block, config)
      const energyManager = new EnergyStorage(entity)
      energyManager.setCap(config?.generator?.energy_cap);
      energyManager.set(energy);
      energyManager.display();
      if (config.generator.fluid_cap) {
        const fluidManager = new FluidStorage(entity);
        fluidManager.setCap(config.generator.fluid_cap);
        fluidManager.display();

        if (fluid && fluid.amount > 0) {
          fluidManager.setType(fluid.type);
          fluidManager.set(fluid.amount);
        }
      }
      system.run(() => {
        if (callback) {
          callback(entity);
        }
      });
    })
  }

  /**
   * Shared interaction pipeline for multiblock generator controller blocks.
   *
   * @param {{ block: Block, player: Player }} e Player interaction event.
   * @param {GeneratorSettings} settings Controller generator configuration.
   * @param {{
   *   initializeEntity?: (entity: Entity, context: { e: object, player: Player, settings: GeneratorSettings }) => void,
   *   onInteractWithoutWrench?: (context: { e: object, entity?: Entity, player: Player, settings: GeneratorSettings }) => unknown,
   *   requirements?: Record<string, { amount: number, warning: string }>,
   *   onActivate?: (context: object) => unknown,
   *   successMessages?: string[] | ((context: object) => string[]),
   *   deactivateConfig?: { blockId?: string },
   *   fillBlocksConfig?: { blockId?: string },
   *   missingEnergyWarning?: string,
   * }} [config={}] Per-generator interaction and activation configuration.
   * @returns {Promise<unknown>}
   */
  static async handlePlayerInteract(e, settings, config = {}) {
    const {
      initializeEntity,
      onInteractWithoutWrench,
      ...activationConfig
    } = config;
    const { block, player } = e;
    const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
    const mainHandTypeId = player.getEquipment("Mainhand")?.typeId ?? "";
    const isUsingWrench = mainHandTypeId.includes("wrench");

    if (!isUsingWrench) {
      return onInteractWithoutWrench?.({ e, entity, player, settings });
    }

    const activate = (targetEntity) =>
      this.activateGeneratorController(e, settings, targetEntity, activationConfig);

    if (!entity) {
      this.spawnEntity(e, settings, (spawnedEntity) => {
        initializeEntity?.(spawnedEntity, { e, player, settings });
        void activate(spawnedEntity);
      });
      return;
    }

    return await activate(entity);
  }

  /**
   * Detects, validates, and activates a multiblock generator controller.
   *
   * @param {{ block: Block, player: Player }} e Interaction event data.
   * @param {GeneratorSettings} settings Controller generator configuration.
   * @param {Entity} entity Controller entity to activate.
   * @param {{
   *   requirements?: Record<string, { amount: number, warning: string }>,
   *   onActivate?: (context: {
   *     block: Block,
   *     components: Record<string, number>,
   *     energyCap: number,
   *     entity: Entity,
   *     player: Player,
   *     settings: GeneratorSettings,
   *     structure: object,
   *   }) => unknown,
   *   successMessages?: string[] | ((context: object) => string[]),
   *   deactivateConfig?: { blockId?: string },
   *   fillBlocksConfig?: { blockId?: string },
   *   missingEnergyWarning?: string,
   * }} [config={}] Activation behavior for the generator.
   * @returns {Promise<object | undefined>} Activation context when successful.
   */
  static async activateGeneratorController(e, settings, entity, config = {}) {
    const {
      requirements = {},
      onActivate,
      successMessages = [],
      deactivateConfig,
      fillBlocksConfig,
      missingEnergyWarning,
    } = config;
    const { block, player } = e;

    DeactivationManager.deactivateMultiblock(block, player, deactivateConfig);

    const structure = await StructureDetector.detectFromController(e, settings.required_case);
    if (!structure) return;

    const failure = this.validateRequirements(structure.components ?? {}, requirements);
    if (failure) {
      player.sendMessage(failure.warning);
      DeactivationManager.deactivateMultiblock(block, player, deactivateConfig);
      return;
    }

    const energyCap = ActivationManager.activateMultiblock(entity, structure, fillBlocksConfig);
    if (missingEnergyWarning && energyCap <= 0) {
      player.sendMessage(missingEnergyWarning);
      DeactivationManager.deactivateMultiblock(block, player, deactivateConfig);
      return;
    }

    const context = {
      block,
      components: structure.components,
      energyCap,
      entity,
      player,
      settings,
      structure,
    };

    if (onActivate) {
      const result = await onActivate(context);
      if (result === false) {
        DeactivationManager.deactivateMultiblock(block, player, deactivateConfig);
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

  /**
   * Validates that the detected structure satisfies all component requirements.
   *
   * @param {Record<string, number>} components Detected component counts.
   * @param {Record<string, { amount: number, warning: string }>} requirements
   * Required component counts keyed by component id.
   * @returns {{ amount: number, warning: string } | undefined}
   * The first failed requirement, if any.
   */
  static validateRequirements(components, requirements) {
    for (const [componentId, requirement] of Object.entries(requirements)) {
      const amount = components[componentId] ?? 0;
      if (amount < requirement.amount) {
        return requirement;
      }
    }
  }
}
