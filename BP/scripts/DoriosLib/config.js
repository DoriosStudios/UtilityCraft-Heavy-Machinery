// @ts-check

/**
 * Metadata announced by this DoriosLib installation to other addons in the
 * world through `dorios:dependency_checker`.
 *
 * Heavy Machinery depends on the matching UtilityCraft base runtime.
 *
 * @type {import("./dependencies/index.js").AddonMetadata}
 */
export const ADDON_METADATA = {
  name: "UtilityCraft: Heavy Machinery",
  author: "Dorios Studios",
  identifier: "uc_heavy_machinery",
  version: "0.4.0",
  dependencies: {
    utilitycraft: {
      version: "3.5.0",
      name: "UtilityCraft",
      warning: "Please update to UtilityCraft 3.5.0 or newer.",
    },
  },
};

/** @type {import("./dependencies/index.js").InitializeOptions} */
export const DEPENDENCY_OPTIONS = {
  validationDelayTicks: 300,
  announceSuccess: true,
};
