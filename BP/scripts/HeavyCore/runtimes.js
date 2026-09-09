import { world } from '@minecraft/server';

// Each machine owns its data shape and persists changes in dynamic properties.
export const runtimes = new Map();

// Removal also includes chunk unloading. Only discard memory, never saved data.
world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    runtimes.delete(removedEntityId);
});
