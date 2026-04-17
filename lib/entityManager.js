import * as Constants from './constants';

const { STATE_PROPERTY, STRUCTURE_PROPERTY, CONTAINER_REGISTRY_PROPERTY } =
  Constants;

/* ============================================================
   CLASS
============================================================ */

/**
 * EntityManager
 *
 * Responsible for storing and retrieving multiblock metadata
 * inside controller entities.
 *
 * This class does NOT:
 * - Detect structures
 * - Handle block events
 * - Perform validation
 *
 * It ONLY:
 * - Stores essential structure metadata
 * - Retrieves structure metadata
 * - Clears metadata safely
 *
 * Stored Data Model (single dynamic property):
 *
 * {
 *   bounds: { min, max },
 *   components: { id: count },
 *   ports: {
 *     energy: Vector3[],
 *     gas: Vector3[],
 *     fluid: Vector3[],
 *     input: Vector3[],
 *     output: Vector3[]
 *   }
 * }
 *
 * Casings are intentionally NOT stored to reduce dynamic property size.
 */
export class EntityManager {
  /* ============================================================
       STORE METHODS
  ============================================================ */

  /**
   * Stores essential structure data inside controller entity.
   *
   * Only stores:
   * - bounds
   * - components
   * - ports
   *
   * Casings are intentionally excluded.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {StructureData} data
   * @returns {void}
   */
  static storeStructure(entity, data) {
    const structureData = {
      bounds: data.bounds,
      components: data.components ?? {},
      ports: data.ports ?? {
        energy: [],
        gas: [],
        fluid: [],
        input: [],
        output: [],
      },
    };

    entity.setDynamicProperty(
      STRUCTURE_PROPERTY,
      JSON.stringify(structureData),
    );

    entity.setDynamicProperty(STATE_PROPERTY, 'formed');
  }

  /* ============================================================
       GET METHODS
  ============================================================ */

  /**
   * Returns existing controller entity at block location
   * or spawns a new one if none exists.
   *
   * Entity identifier equals block identifier.
   *
   * @param {import("@minecraft/server").Block} block
   * @returns {import("@minecraft/server").Entity | null}
   */
  static getOrSpawnEntity(block) {
    const dimension = block.dimension;

    const existing = dimension
      .getEntitiesAtBlockLocation(block.location)
      .find((e) => e.typeId === block.typeId);

    if (existing) return existing;

    try {
      const entity = dimension.spawnEntity(block.typeId, block.bottomCenter());
      entity.nameTag = block.typeId;

      entity.setDynamicProperty(STATE_PROPERTY, 'formed');

      return entity;
    } catch {
      return null;
    }
  }

  /**
   * Attempts to retrieve the controller entity at a block location.
   * Does NOT spawn a new one.
   *
   * @param {import("@minecraft/server").Block} block
   * @returns {import("@minecraft/server").Entity | undefined}
   */
  static tryGetEntity(block) {
    return block.dimension
      .getEntitiesAtBlockLocation(block.location)
      .find((e) => e.typeId === block.typeId);
  }

  /**
   * Returns full stored structure data.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @returns {StructureData | null}
   */
  static getStructureData(entity) {
    return this.#safeParse(entity.getDynamicProperty(STRUCTURE_PROPERTY));
  }

  /**
   * Returns stored structure bounds.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @returns {Bounds | null}
   */
  static getBounds(entity) {
    return this.getStructureData(entity)?.bounds ?? null;
  }

  /**
   * Returns stored component counts.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @returns {Object.<string, number>}
   */
  static getComponents(entity) {
    return this.getStructureData(entity)?.components ?? {};
  }

  /**
   * Returns stored port data.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @returns {Ports}
   */
  static getPorts(entity) {
    return (
      this.getStructureData(entity)?.ports ?? {
        energy: [],
        gas: [],
        fluid: [],
        input: [],
        output: [],
      }
    );
  }

  /**
   * Replaces the linked input/output container registry on the entity.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {{input: Vector3[], output: Vector3[]}} registry
   */
  static setContainers(
    entity,
    registry,
  ) {
    if (!entity) return;

    entity.setDynamicProperty(
      CONTAINER_REGISTRY_PROPERTY,
      JSON.stringify({
        input: registry?.input ?? [],
        output: registry?.output ?? [],
      }),
    );
  }

  /**
   * Returns the linked input/output container registry.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @returns {{input: Vector3[], output: Vector3[]}}
   */
  static getContainerRegistry(entity) {
    if (!entity) {
      return { input: [], output: [] };
    }

    return this.#safeParse(
      entity.getDynamicProperty(CONTAINER_REGISTRY_PROPERTY),
      {
        input: [],
        output: [],
      },
    );
  }

  /**
   * Adds a container location to a registry group if missing.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {'input' | 'output'} group
   * @param {Vector3} location
   */
  static registerContainer(entity, group, location) {
    if (!entity || !group || !location) return;

    const registry = this.getContainerRegistry(entity);
    const groupEntries = registry[group] ?? [];

    if (
      groupEntries.some(
        (entry) =>
          entry.x === location.x &&
          entry.y === location.y &&
          entry.z === location.z,
      )
    ) {
      return;
    }

    groupEntries.push({
      x: Math.floor(location.x),
      y: Math.floor(location.y),
      z: Math.floor(location.z),
    });
    registry[group] = groupEntries;
    this.setContainers(entity, registry);
  }

  /**
   * Removes a container location from a registry group.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {'input' | 'output'} group
   * @param {Vector3} location
   */
  static deleteContainer(entity, group, location) {
    if (!entity || !group || !location) return;

    const registry = this.getContainerRegistry(entity);
    registry[group] = (registry[group] ?? []).filter(
      (entry) =>
        !(
          entry.x === Math.floor(location.x) &&
          entry.y === Math.floor(location.y) &&
          entry.z === Math.floor(location.z)
        ),
    );

    this.setContainers(entity, registry);
  }

  /**
   * Clears the linked input/output container registry.
   *
   * @param {import("@minecraft/server").Entity} entity
   */
  static resetContainers(entity) {
    if (!entity) return;

    this.setContainers(entity, {
      input: [],
      output: [],
    });
  }

  /**
   * Backward-compatible alias for container replacement.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {{input: Vector3[], output: Vector3[]}} registry
   */
  static setContainerRegistry(entity, registry) {
    this.setContainers(entity, registry);
  }

  /**
   * Backward-compatible alias for container registration.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {'input' | 'output'} group
   * @param {Vector3} location
   */
  static addContainer(entity, group, location) {
    this.registerContainer(entity, group, location);
  }

  /**
   * Backward-compatible alias for container deletion.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {'input' | 'output'} group
   * @param {Vector3} location
   */
  static removeContainer(entity, group, location) {
    this.deleteContainer(entity, group, location);
  }

  /**
   * Backward-compatible alias for clearing linked containers.
   *
   * @param {import("@minecraft/server").Entity} entity
   */
  static clearContainerRegistry(entity) {
    this.resetContainers(entity);
  }

  /**
   * Returns current multiblock state.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @returns {string | undefined}
   */
  static getState(entity) {
    return entity.getDynamicProperty(STATE_PROPERTY);
  }

  /* ============================================================
       UPDATE METHODS
  ============================================================ */

  /**
   * Updates component counts inside stored structure data.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {Object.<string, number>} components
   */
  static updateComponents(entity, components) {
    const data = this.getStructureData(entity);
    if (!data) return;

    data.components = components;

    entity.setDynamicProperty(STRUCTURE_PROPERTY, JSON.stringify(data));
  }

  /**
   * Sets structure state.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {string} state
   */
  static setState(entity, state) {
    entity.setDynamicProperty(STATE_PROPERTY, state);
  }

  /* ============================================================
    STORAGE CAPS
  ============================================================ */

  /**
   * Replaces all storage caps on the entity.
   *
   * This overwrites any previously stored caps.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {Object.<string, number>} caps
   * @returns {void}
   */
  static setStorageCaps(entity, caps) {
    if (!entity) return;

    entity.setDynamicProperty(
      Constants.STORAGE_PROPERTY_ID,
      JSON.stringify(caps ?? {}),
    );
  }

  /**
   * Sets or updates a single storage cap for a given type.
   *
   * If the type already exists, it is overwritten.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {string} type Storage type (energy, lava, water, etc.)
   * @param {number} value Maximum cap for this storage type
   * @returns {void}
   */
  static setStorageCap(entity, type, value) {
    if (!entity || !type) return;

    const caps = this.getStorageCaps(entity);
    caps[type] = value;

    entity.setDynamicProperty(
      Constants.STORAGE_PROPERTY_ID,
      JSON.stringify(caps),
    );
  }

  /**
   * Returns all defined storage caps for this entity.
   *
   * If no caps are defined, returns an empty object.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @returns {Object.<string, number>}
   */
  static getStorageCaps(entity) {
    if (!entity) return {};

    return this.#safeParse(
      entity.getDynamicProperty(Constants.STORAGE_PROPERTY_ID),
      {},
    );
  }

  /**
   * Returns the storage cap for a specific type.
   *
   * If the type is not defined, returns STORAGE_CAP_DEFAULT.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {string} type
   * @returns {number}
   */
  static getStorageCap(entity, type) {
    if (!entity || !type) return Constants.STORAGE_CAP_DEFAULT;

    const caps = this.getStorageCaps(entity);

    return caps[type] ?? Constants.STORAGE_CAP_DEFAULT;
  }

  /**
   * Removes a specific storage cap from the entity.
   *
   * If the type does not exist, nothing happens.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @param {string} type
   * @returns {void}
   */
  static clearStorageCap(entity, type) {
    if (!entity || !type) return;

    const caps = this.getStorageCaps(entity);

    if (!(type in caps)) return;

    delete caps[type];

    entity.setDynamicProperty(
      Constants.STORAGE_PROPERTY_ID,
      JSON.stringify(caps),
    );
  }

  /* ============================================================
       CLEAR METHODS
  ============================================================ */

  /**
   * Clears all multiblock metadata from entity.
   *
   * @param {import("@minecraft/server").Entity} entity
   * @returns {void}
   */
  static clearStructure(entity) {
    entity.setDynamicProperty(STRUCTURE_PROPERTY, undefined);
    entity.setDynamicProperty(CONTAINER_REGISTRY_PROPERTY, undefined);
    entity.setDynamicProperty(STATE_PROPERTY, 'invalid');
  }

  /* ============================================================
       INTERNAL UTIL
  ============================================================ */

  /**
   * Safely parses JSON dynamic properties.
   *
   * @private
   * @param {any} raw
   * @param {any} fallback
   * @returns {any}
   */
  static #safeParse(raw, fallback = null) {
    if (!raw) return fallback;

    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
}

/* ============================================================
   TYPEDEFS
============================================================ */

/**
 * @typedef {Object} Vector3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} Bounds
 * @property {Vector3} min
 * @property {Vector3} max
 */

/**
 * @typedef {Object} Ports
 * @property {Vector3[]} energy
 * @property {Vector3[]} gas
 * @property {Vector3[]} fluid
 * @property {Vector3[]} input
 * @property {Vector3[]} output
 */

/**
 * @typedef {Object} StructureData
 * @property {Bounds} bounds
 * @property {Object.<string, number>} components
 * @property {Ports} ports
 */
