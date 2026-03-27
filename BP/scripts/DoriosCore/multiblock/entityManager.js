import { MAX_SIZE } from "./constants.js";

export function getCenter(min, max) {
  return {
    x: (min.x + max.x) / 2,
    y: (min.y + max.y) / 2,
    z: (min.z + max.z) / 2,
  };
}

export function getVolume(bounds) {
  return (
    (bounds.max.x - bounds.min.x + 1) *
    (bounds.max.y - bounds.min.y + 1) *
    (bounds.max.z - bounds.min.z + 1)
  );
}

export function isInsideBounds(pos, bounds) {
  return (
    pos.x >= bounds.min.x &&
    pos.x <= bounds.max.x &&
    pos.y >= bounds.min.y &&
    pos.y <= bounds.max.y &&
    pos.z >= bounds.min.z &&
    pos.z <= bounds.max.z
  );
}

export function getEntityFromBlock(block) {
  if (!block) return;

  const directEntity = block.dimension.getEntitiesAtBlockLocation(block.location)[0];
  if (directEntity) return directEntity;

  return block.dimension
    .getEntities({
      location: block.location,
      maxDistance: MAX_SIZE,
      families: ["dorios:multiblock"],
    })
    .find((entity) => {
      const raw = entity.getDynamicProperty("dorios:bounds");
      if (!raw) return false;

      try {
        const bounds = JSON.parse(raw);
        return isInsideBounds(block.location, bounds);
      } catch {
        return false;
      }
    });
}
