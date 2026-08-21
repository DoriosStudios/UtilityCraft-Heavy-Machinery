# UtilityCraft: Heavy Machinery v0.5.2

## FIXED

- Fixed Item and Liquid Port conflicts with UtilityCraft by sharing Heavy Machinery's link-node I/O registrations across every loaded DoriosCore runtime.
- Fixed multiblock controller and helper-entity resolution so connected ports consistently resolve their owning active structure.

---

# UtilityCraft: Heavy Machinery v0.5.1

## CHANGED

- Moved Link Node I/O interaction handling to the shared UtilityCraft runtime and removed the duplicate Heavy Machinery handler.
- Updated the Behavior Pack and Resource Pack icons.

## FIXED

- Removed obsolete `utilitycraft:special_container` mappings from seven multiblock controllers so automation uses their dedicated configured ports.

## COMPATIBILITY

- Registered all 42 Heavy Machinery recipes tagged `utilitycraft_workbench` with UtilityCraft's Crafter through DoriosLib.

---

# UtilityCraft: Heavy Machinery v0.5.0

This is the complete changelog for the changes introduced after v0.4.0.

## SUMMARY

- Completely redesigned Heavy Machinery interfaces to match the UtilityCraft 3.5.0 UI system.
- Added embedded Recipe Books and drop tables to supported multiblock machines.
- Added configurable item and liquid routing directly to multiblock ports through the new link-node I/O system.
- Added Information panels to every active machine and generator interface.
- Added multi-item processing to the Crusher, Incinerator, and Electro Press.
- Added three-stage Crusher modes for processing materials multiple times in one operation.
- Added new nuclear reactor components, uranium rods, and internal uranium-bar display assets.
- Migrated the addon from DoriosAPI to DoriosLib 2.0.0 and the latest DoriosCore systems.

## USER INTERFACE

### Machine UI Overhaul

- Redesigned the Crusher, Incinerator, Electro Press, Infuser, Autosieve, Reaction Chamber, and Magmatic Chamber interfaces.
- Redesigned the Power Condenser and Thermal Reactor interfaces.
- Added the shared UtilityCraft top bar and expandable right-side panels to supported screens.
- Added clearer layouts for machine status, energy, speed, efficiency, progress, inventories, tanks, and structure statistics.
- Added colored slot backgrounds for material inputs, catalysts, meshes, outputs, liquid tanks, and other machine-specific storage.
- Added dedicated Information tabs explaining each machine's operation, slots, tanks, structural modules, and special controls.
- Added clearer open, closed, selected, pressed, and hover states for tabs and buttons.
- Improved side-panel placement, connectors, overlays, labels, and spacing throughout the addon.
- Updated machine screens to remain usable while a Recipe Book or Information panel is open.
- Preserved the Thermal Reactor's power and burn-rate controls while integrating them into the new layout.

### Recipe Books and Drop Tables

- Added an embedded Crusher Recipe Book.
- Added an embedded Electro Press Recipe Book.
- Added an embedded Infuser Recipe Book.
- Added an Autosieve drop-table panel.
- Added a Magmatic Chamber recipe panel.
- Added machine and recipe tabs so players can switch views without closing the interface.
- Added animated ingredient displays, recipe inputs, outputs, quantities, separators, overlays, and hover information.
- Registered Heavy Machinery Crusher, Electro Press, and Infuser recipes with the shared UtilityCraft Recipe Book system.
- Added support for displaying compatible recipes and drop tables supplied by UtilityCraft's shared registries.

### Terminology and Localization

- Renamed player-facing `Fluid` terminology to `Liquid` across machine parts, ports, tanks, guides, and interface text.
- Added the Heavy Machinery addon name to item and block descriptions so content is easier to identify in inventories.
- Added and updated machine information text in English, Mexican Spanish, and Brazilian Portuguese.
- Updated localized names for the new nuclear components and uranium materials.

## MULTIBLOCK PORT I/O

- Reworked multiblock Item, Liquid, and Energy Ports as linked nodes connected to their active controller.
- Added an I/O configuration form that opens directly from supported Item and Liquid Ports.
- Added independent input and output selections for every physical port in a multiblock.
- Added a Disabled option so individual ports can be prevented from importing or exporting resources.
- Added machine-specific routing groups instead of exposing every internal slot or tank indiscriminately.
- Added Item Port routing for the Crusher, Incinerator, Electro Press, Autosieve, Infuser, Reaction Chamber, and Magmatic Chamber.
- Added separate Catalyst Grid and Material Grid input routes for the Infuser.
- Added separate Mesh Slot and Material Grid input routes for the Autosieve.
- Added item input and output grid routes for the Reaction Chamber.
- Added Liquid Port routing between the Reaction Chamber's Reactant Tank and Product Tank.
- Added Item Input Grid and Liquid Output Tank routes for the Magmatic Chamber.
- Added separate Coolant Tank and Lava Fuel Tank input routes for the Thermal Reactor.
- Added persistent per-port routing overrides with validation and automatic restoration when a multiblock is reactivated.
- Updated multiblock activation, deactivation, and structure detection to initialize and clean up linked ports safely.

## MACHINE PROCESSING

### Crusher

- Added Crusher modes for one, two, or three chained crushing stages.
- Higher modes now continue crushing the result produced by the previous stage when another valid recipe exists.
- Added multi-item batch processing based on the multiblock's Processing Modules.
- Improved input aggregation and output-space planning across the full input and output grids.
- Updated the machine UI and information text to show the selected stage mode and processing capacity.

### Incinerator and Electro Press

- Added multi-item batch processing to the Incinerator.
- Added multi-item batch processing to the Electro Press.
- Processing Modules can now increase the number of valid operations completed during a cycle.
- Improved input aggregation, recipe planning, output distribution, and full-output detection.

### Other Machines

- Updated Autosieve processing and output routing for the new storage and port systems.
- Updated the Infuser to route catalyst inputs, material inputs, and products independently.
- Updated the Reaction Chamber to route its item and liquid inputs and outputs independently.
- Updated the Magmatic Chamber to route material input and molten-liquid output independently.
- Updated the Thermal Reactor to use the latest energy, liquid-storage, interface, and port-routing systems.
- Updated the Power Condenser to use the current DoriosCore generator and energy-storage APIs.

## NUCLEAR CONTENT

- Added the Liquid Controller multiblock component.
- Added the Fuel Assemblies multiblock component with active and inactive visuals.
- Added the Rod Control multiblock component with active and inactive visuals.
- Replaced Uranium Bars and Enriched Uranium Bars with Uranium Rods and Enriched Uranium Rods as crafting materials.
- Updated Electro Press recipe registration for the new uranium rods.
- Added a complete set of internal uranium-bar fill-state items and textures for reactor interface displays.
- Updated Nuclear Reactor and Thermal Reactor assets to support the expanded nuclear systems.

## CREATOR CHANGES

### DoriosLib

- Added DoriosLib 2.0.0 as the addon's shared creator library.
- Removed the deprecated DoriosAPI runtime and migrated Heavy Machinery to explicit DoriosLib module imports.
- Added public modules for blocks, containers, dependencies, entities, items, link nodes, math, messages, players, registries, text, time, utilities, and configuration.
- Added unified container helpers for resolving multiblock inventories, inserting and transferring items, and selecting configured input and output slots.
- Added link-node helpers for creating, locating, resolving, validating, and configuring multiblock ports.
- Added persistent link-node I/O overrides with per-resource input and output selections.
- Migrated Heavy Machinery recipe, drop, coolant, liquid, block-component, and item-component registration to DoriosLib registries.

### DoriosCore

- Added `ContainerSessionManager` for tracking active machine container sessions.
- Added `InterfaceManager` and the shared container-button interface system.
- Added `registerIOInterface()`, `registerIOInterfaceForBlockTag()`, `ensureBlockIOInterface()`, and `hasRegisteredIOInterface()`.
- Added `registerLinkNodeIO()`, `getLinkNodeIODefinition()`, and `openLinkNodeIOForm()` for configurable multiblock ports.
- Added item, liquid, and gas I/O definitions with persistent per-face modes and direction-aware resource resolution.
- Added shared item, liquid, and gas container helpers.
- Added `MachineUpgradeRegistry`, indexed progress, energy-cost tracking, output tracking, and resource-lore helpers.
- Expanded `EnergyStorage`, `FluidStorage`, `GasStorage`, `Machine`, `BasicMachine`, `MultiblockMachine`, and `MultiblockGenerator` APIs.
- Expanded multiblock activation, deactivation, detection, storage, and link-node integration.
- Added updated DoriosCore type declarations and editor configuration for the new runtime APIs.

## PERFORMANCE AND TECHNICAL CHANGES

- Reworked batch planning so machines validate all required inputs and output space before committing an operation.
- Improved output distribution across multiblock inventory grids.
- Optimized repeated labels and machine status updates.
- Updated entity handling and marked machine entities as inanimate.
- Updated block geometry, material instances, and per-face textures across multiblock casings, components, controllers, and generators.
- Updated build aliases and bundling configuration for DoriosCore and DoriosLib.
- Removed obsolete DoriosAPI files and other unused assets.
- Updated the Behavior Pack and Resource Pack manifests for UtilityCraft 3.5.0 and the current scripting modules.

## BUG FIXES

- Fixed incorrect input and output slot definitions on multiblock machines.
- Fixed batch-processing plans consuming inputs when the required outputs could not be inserted.
- Fixed Crusher chained modes failing to reserve enough output space for the final result.
- Fixed several controller, casing, component, entity, and manifest definitions during the runtime migration.
- Fixed Recipe Book registration, output overlays, panel toggles, and screen routing.
- Fixed UI layout and button conflicts in the Incinerator, Electro Press, Thermal Reactor, and other redesigned screens.
- Fixed linked-port configuration state after multiblock activation and deactivation.

## COMPATIBILITY

- Requires UtilityCraft 3.5.0 or newer.
- Updated for the current DoriosCore and DoriosLib runtime used by UtilityCraft 3.5.0.

---

# v0.4.0

Update focused on multiblock expansion, clearer in-game guidance, and a much more interactive Thermal Reactor interface. This release introduced the Magmatic Chamber multiblock, added Heavy Machinery pages to `How to Play`, and reworked reactor controls with a numpad-driven burn-rate flow.

## BLOCKS

### Machines

- Added Magmatic Chamber Controller:
  - Added a new multiblock machine with its own controller, activation flow, and dedicated machine screen;
  - Uses a different structure profile than the standard simple-machine multiblock layout.

## RECIPES

### General

- Added missing recipe coverage for remaining machine parts and progression blocks:
  - Added `Bronze Vent Panel`;
  - Added `Steel Vent Panel`;
  - Added `Bronze Controller Case`;
  - Added `Tin Plated Block`;
  - Added Uranium storage conversion recipes.
- Added Magmatic Chamber Controller recipe.
- Updated recipe coverage across Heavy Machinery:
  - Most machine blocks and progression parts now have crafting recipes;
  - Netherite casing blocks are still the main exception.

## UI/UX

### General

- Added Heavy Machinery entries to `How to Play`:
  - Added a multiblock overview page;
  - Added a step-by-step Crusher build guide with reference images, materials, and activation notes.
- Added Magmatic Chamber machine interface:
  - Shows machine status, progress, energy, liquid output, and the full input grid in a dedicated screen.
- Updated Thermal Reactor UI:
  - Added an on/off button directly in the machine screen;
  - Added a numpad input flow for burn-rate control;
  - Added accept, cancel, and delete controls for burn-rate editing;
  - Improved reactor readouts so configuration and status are easier to read while the machine is running.

## TECHNICAL CHANGES

### General

- Added the button handling system used by the new reactor controls.
- Extended Heavy Machinery UI registration to include the Magmatic Chamber screen and the new `How to Play` pages.
- Expanded the machinery scripts to support the Magmatic Chamber multiblock and its recipe registration flow.

---

# v0.3.0

Thermal Reactor progression received a small but important survival pass with new bronze casing recipes, better coolant extensibility, and safer handling of very large energy values. This release is focused on rounding out systems introduced in earlier versions rather than adding a full new machine set.

## RECIPES
### General
- Added bronze casing recipes for reactor progression:
  - Bronze Bricks;
  - Bronze Case;
  - Bronze Energy Port;
  - Bronze Fluid Port;
  - Bronze Hazard Block;
  - Bronze Item Port;
  - Bronze Plated Block;
  - Reinforced Bronze Glass.
- Updated Power Condenser Unit progression:
  - **Advanced Power Condenser Unit:** Increased energy contribution to `320 MDE`;
  - **Expert Power Condenser Unit:** Increased energy contribution to `2.56 GDE`;
  - **Ultimate Power Condenser Unit:** Increased energy contribution to `64 GDE`.

## FLUIDS
### General
- Updated coolant registration behavior:
  - Coolants can now be registered through `ScriptEvents`, making reactor coolant integration easier for advanced setups and add-on compatibility.

## BUG FIXES
### General
- Fixed missing bronze recipe coverage for multiple reactor-related parts.
- Fixed very large energy values so they no longer stop scaling correctly after `TDE`.

## TECHNICAL CHANGES
### General
- Added `PDE` support to the energy formatting and parsing helpers.
- Added the `utilitycraft:register_coolant` `ScriptEvent` flow for coolant registration.
- Modified multiblock scan pacing to reduce structure validation spikes on larger machines.
- Updated unsafe reactor behavior to support destructive failure handling.

---

# v0.2.0

Large content update centered on machine expansion, reactor support systems, and the first serious survival progression pass. This release adds new multiblock content, coolant presentation, more recipes, and broader infrastructure for future machinery updates.

## BLOCKS
### Generators
- Added Saline Coolant Fluid Tank:
  - Introduced a dedicated fluid entity for Saline Coolant storage and display.
### Machines
- Added Autosieve Controller:
  - Added block, recipe, texture, and dedicated machine UI support.
- Added Reaction Chamber Controller:
  - Added block, recipe, texture, and dedicated machine UI support.

## ITEMS
### General
- Added Control Panel.
- Added Saline Coolant Bucket.
### Armor
- Added Utility Exo Armor Set:
  - **Helmet:** Added wearable head protection for the Exo set;
  - **Chestplate:** Added wearable chest protection for the Exo set;
  - **Leggings:** Added wearable leg protection for the Exo set;
  - **Boots:** Added wearable foot protection for the Exo set.

## RECIPES
### General
- Added bronze progression recipes for machinery support parts:
  - Bronze Bricks;
  - Bronze Case;
  - Bronze Controller Case;
  - Bronze Energy Port;
  - Bronze Fluid Port;
  - Bronze Hazard Block;
  - Bronze Item Port;
  - Bronze Plated Block;
  - Reinforced Bronze Glass.
- Added machine and controller recipe support for:
  - Autosieve Controller;
  - Crusher Controller;
  - Electro Press Controller;
  - Incinerator Controller;
  - Infuser Controller;
  - Power Condenser Controller;
  - Reaction Chamber Controller;
  - Thermal Reactor Controller.
- Added support-component recipes for:
  - Fluid Cell;
  - Heat Conductor;
  - Thermo Core.
- Added module recipes for:
  - Efficiency Module;
  - Processing Module;
  - Speed Module.

## UI/UX
### General
- Added Autosieve machine interface.
- Added Reaction Chamber machine interface.
- Added Saline Coolant bar visuals for reactor feedback.
- Updated shared machine screen routing to support the new interfaces.

## FLUIDS
### General
- Added Saline Coolant support for reactor systems:
  - Added bucket handling, UI assets, fluid textures, and storage entities for the coolant workflow.

## BUG FIXES
### General
- Fixed Assembler upgrade handling.
- Fixed multiple multiblock support issues across machine controllers.

## TECHNICAL CHANGES
### General
- Expanded the machinery core and multiblock systems to support a wider machine set.
- Rebalanced machine energy costs and module values for smoother progression.
- Updated manifests, localization, textures, and registry definitions for the new machines, armor, and coolant systems.
- Renamed and normalized controller assets related to the Reaction Chamber content set.

---

# v0.1.1

First survival-oriented follow-up to the initial creative test release. This update begins recipe support, rounds out early material content, and stabilizes the first multiblock systems.

## ITEMS
### General
- Added Bronze and Tin material support for early machinery progression.

## RECIPES
### General
- Added the first survival recipe pass for machinery and power condenser related content.
- Added more recipe coverage for early Bronze and Tin progression.

## BUG FIXES
### General
- Fixed controller port tag issues.
- Fixed early Thermo Reactor script issues during the first stabilization pass.
- Fixed the GitHub Actions workflow path so automated builds resolve correctly from `.github/workflows`.

## TECHNICAL CHANGES
### General
- Improved the multiblock activation flow.
- Modified controller geometry naming to match the updated project structure.
- Removed obsolete scripts and early shared machinery helpers during cleanup.

---

# v0.1.0

Initial creative-test release for Heavy Machinery. Introduces the first multiblock generators and lays the groundwork for later survival progression, recipe support, and reactor systems.

## BLOCKS
### Generators
- Added Power Condenser Matrix:
  - Uses Steel Casing;
  - Accepts Energy Cells and all tiers of Power Condenser Units;
  - Requires Energy Ports for energy input and output.
- Added Thermal Reactor:
  - Uses Bronze Casing;
  - Uses lava as fuel and water as coolant in this initial version;
  - Allows burn-rate control directly from the controller;
  - Requires Heat Conduits, Fluid Cells, Energy Cells or Power Condenser Units, Vents, and a Thermo Core.

## RECIPES
### General
- No survival recipes were included in this release:
  - This version was intended for creative testing and early validation.

## TECHNICAL CHANGES
### General
- Requires `UtilityCraft v3.3.0+`.
