# v0.4.0-alpha (Draft)

Pre-release snapshot focused on multiblock expansion, clearer in-game guidance, and a much more interactive Thermal Reactor interface. This draft introduces the Magmatic Chamber multiblock, adds Heavy Machinery pages to `How to Play`, and reworks reactor controls with a proper numpad-driven burn-rate flow.

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
  - Shows machine status, progress, energy, fluid output, and the full input grid in a dedicated screen.
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
