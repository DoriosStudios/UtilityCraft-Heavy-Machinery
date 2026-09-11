# UtilityCraft: Heavy Machinery v0.5.3

## CHANGED
- Updated Reaction Chamber Controller textures and refreshed the Reaction Chamber, Chemical Processor and Isotope Centrifuge block textures.
- Heavy Water now consumes 4 Lapis Lazuli alongside 8,000 mB Water per 1,000 mB output, retaining its 64,000 DE base recipe cost. Updated the reaction chamber guide.
- Increased Netherite Casing recipes to use lead blocks and Stabilized Obsidian Dust instead of lead ingots and Diamond Dust; Netherite Controller Case additionally requires a compressed netherite block.
- Combustion Chamber now requires an Expert Furnator; Gas Turbine requires an Expert Gas Generator and two High-Speed Rotors in place of its charged crystals. Updated Workbench and Crafter recipes.
- Removed controller-side automatic IO processing from the Combustion Chamber and Gas Turbine; multiblock ports handle resource IO.
- Distributed sparse combustion flames throughout the chamber interior while burning, without block lookups, limiting emission to 3-5 particles per emission cycle.
- Lowered the General fuel progress indicator, removed its hover, and added a linked Remaining Fuel readout and manual feeding hint.
- Raised the Combustion Chamber fuel input slot by 7 pixels to align it with the fuel illustration.

- Removed the obsolete Fluid Controller block and its exclusive catalog entries, translations and textures. The functional Liquid Tank Controller remains the liquid-storage controller.

- Replaced the High-Speed Rotor item texture with the updated supplied sprite.
- Compacted the Combustion Chamber Info panel spacing and reduced its scroll content height.

## ADDED
- Added the Nuclear Reactor Controller recipe using two compressed netherite blocks, two Ultimate Chips, Netherite Controller Case, Control Panel, two Lead Blocks and Stabilized Obsidian Dust; available in Workbench and Crafter.
- Added Netherite Item, Fluid and Energy Port recipes; all four Netherite Ports now use Lead Plates instead of Tin Plates, with matching Workbench and Crafter recipes.
- Added Netherite Casing and Netherite Controller Case recipes using lead and netherite plates, with Workbench/Crafter support. Added the controller casing block with a temporary copy of the Netherite Casing texture.
- Removed the standalone Efficiency heading and value above the Combustion Chamber General panel.
- Added the bronze Combustion Chamber multiblock: shared register_fuel defaults and custom fuel support, 1.25x energy per fuel, size-based control allowing 128 BU/t per empty interior block (160 DE/t at 1.25x efficiency), Energy Cells and roof vents, persistent burn reserve, Item/Energy Ports, four-tab UI, controller textures and crafting recipe.
- Added independent turbine visual coverage for all 11 UC/HM gases, with Steam texture fallback for unknown gases. Gas identity is preserved; only Steam and Heated Saline Coolant generate energy.
- Added Thermal Reactor heat recovery: Water/Heavy Water produce Steam and Saline Coolant produces Heated Saline Coolant based on heat actually removed. Gas Cells provide 256,000 mB each; a full or incompatible output blocks active cooling. Added native gas output/IO, the General gas bar and updated illustrated guides.
- Gas Turbines now accept Heated Saline Coolant at 512 DE/mB and 1.25x impulse, with matching gas volume, particles and guide icons.
- Added sparse client-side turbine gas streaks matching each gas, with emission frequency and orbital motion tied to rotor speed. Short-lived particles stay inside the structure and fade out; emission stops at rest or with an empty tank.
- Added an experimental full-volume gas visual to the Gas Turbine: one inset entity with six faces, per-block repeated UC gas textures and reserve-based opacity configurable per gas. Empty tanks hide the shell; deactivation and controller removal clean it up.
- Added the bronze Gas Turbine multiblock: Steam/Hydrogen/Methane inputs, gas capacity from empty interior blocks, Energy Cells, configurable mB/t, progressive rotor startup and native gas/energy ports.
- Added an automatically sized vertical rotor entity with two animated vertical curved blades, lifecycle cleanup, a four-tab turbine UI, controller crafting recipe and the supplied four-face controller textures.
- Added generic DoriosCore TemperatureStorage with persistent thermal capacity, internal HU/t generation, simultaneous hot/cold contacts, exact time-based heat exchange, and native temperature display independent of machine limits.

## CHANGED
- Simplified Nuclear, Thermal and Gas Turbine data caching through one generic HeavyCore map keyed by entity ID. State remains persisted in dynamic properties, reloads lazily after unload/restart, and rescans refresh cached stats. Storage instances are created per update.

- Standardized all Heavy Machinery block tick intervals to 4 ticks, reducing redundant controller callbacks while preserving scheduler-driven machine throughput.
- Thermal and Nuclear reactors skip thermal simulation while switched off at ambient temperature; energy export, nuclear fuel loading and open UI updates remain available. Hot reactors continue cooling and restart resumes simulation.
- Restricted the Gas Turbine to Steam and Heated Saline Coolant; removed Hydrogen/Methane conversion and turbine-only visuals, and renamed its gas tab Working Gas. Existing unsupported gas remains available to drain. UC Gas Generators retain their fuels.
- Reversed gas particle orbital motion to follow the reversed turbine rotor, preserving the increased emission frequency.
- Tripled Gas Turbine particle emission frequency for every gas, retaining speed scaling, particle lifetime and idle/empty shutoff.
- Reversed Gas Turbine rotor rotation while preserving RPM, acceleration and energy generation.
- Reduced Thermal Reactor direct generation from 2,000 to 1,500 DE/mB before efficiency (25% less), with turbine heat recovery providing the combined-cycle benefit. Existing structures must be rescanned with Gas Cells. Empty coolant tanks can accept a different coolant; fractional fuel/coolant/gas accounting survives scheduler changes.
- Replaced fixed per-gas turbine RPM with flow-dependent rotation capped at 240 RPM. Steam/Hydrogen/Methane impulse is 1/1.25/1.5, so higher-impulse gas reaches the cap at lower mB/t; Control clamps to each gas limit. Preserved independent DE/mB yields, smooth startup/coasting, UI gating and legacy saved RPM through migration. Updated gas labels and guides.
- Increased turbine rotor rotation by 25% (150 base RPM) and kept the RPM readout aligned with the animation, preserving gas multipliers, intake and energy output.
- Reworked Gas Turbine Info into compact illustrated sections matching the reactor guides, with bronze casing/Gas Port/Control icons and individual gas icons, yields and speed multipliers. Reduced section gaps while retaining readable body text and scrolling.
- Enlarged the Gas Turbine General Rotor heading and prefixed the dynamic RPM nameTag with a formatting reset followed by dark gray (section-sign r, then 8).
- Replaced turbine gas-texture streaks with the animated vanilla falling-dust sprite used by Vein Miner, tinted from each gas palette; retained sparse emission and speed-dependent orbital motion.
- Moved the six Creative Saline Coolant and nuclear gas tank blocks, Creative entries and names into UtilityCraft, preserving identifiers and removing duplicate ownership from Heavy Machinery.
- Refreshed turbine Methane opacity textures from UtilityCraft's current green sprite.
- Increased Gas Turbine gas opacity from 25% to 60% maximum for Steam/Methane and 80% for Hydrogen, retaining density changes as the tank empties.
- Added a configurable gas table to the turbine with per-gas DE/mB and rotor speed multipliers, including Steam. Updated gas intake/drain labels, RPM readouts and the gas guide.
- Replaced the turbine rotor with two opposing vertical curved scoops and a dedicated 32x32 texture using the Steel palette; preserved structure-based scaling and gradual spin-up/coasting.
- Added a persistent lower-left energy indicator to both reactors using UtilityCraft's energy icon and the existing energy-slot hover text, without drawing the energy bar or duplicating runtime logic.
- Top-aligned Apply and Clear with the first two keypad rows in both reactor Control tabs.
- Moved Power to a persistent lower-right side button in both reactor UIs, outside tab navigation, reusing the existing action index; removed the Control copy and kept Apply/Clear bottom-aligned.
- Centered the Nuclear Fuel slot, rod information and live uranium reserve bar as one horizontal group, reusing General's fuel display while retaining the inventory.
- Added a Nuclear Coolant tab between Fuel and Control with the fluid IO icon, live tank bar, Heavy Water/Tier 2+ requirements and concise cooling/supply guidance; Info now refers players to this tab.
- Moved both reactor Control action columns next to the keypad using the same column spacing, removing the intervening divider.
- Bottom-aligned both reactor Control action buttons with keypad spacing, moved temperature bars to the right, and centered Current T/readouts between the buttons and bars.
- Added Current T and a live kelvin readout above the temperature bar in both Control tabs, reusing the existing bar hover text without script changes.
- Replaced Apply, Clear and Start/stop captions in both reactor Control tabs with a live temperature bar using the same display slot as General; kept all action buttons and scripts unchanged.
- Removed player inventory from Thermo's Fuel & Coolant tab and added the live coolant bar, accepted coolant icons and cooling/supply explanations below the lava section.
- Redesigned Thermo Reactor with Nuclear-style General, Fuel & Coolant, Control and scrollable Info tabs; used the fluid IO icon for Fuel & Coolant, split telemetry into two columns, and added current/recommended mB/t readouts and a lava/coolant guide.
- Migrated Thermo Reactor to TemperatureStorage with structure-based thermal capacity, passive cooling, finite coolant exchange, and machine-owned meltdown handling. Preserved existing temperatures and event-driven InterfaceManager controls.
- Optimized Thermo background updates with shouldUpdateUI gating, cached structure/storage wrappers, batched resource writes, prepaid fractional lava/coolant, and throttled effects; removed unused form and legacy thermal paths.
- Standardized all Heavy Machinery JavaScript filenames and the recipe registration directory to camelCase, updating imports and test references.
- Moved all remaining liquid/gas resource definitions and visual assets to UtilityCraft for reuse by other addons, including nuclear gases. Heavy Machinery retains its production/processing recipes, coolant behavior, Saline Coolant Bucket and Creative Tanks, consuming the same shared resource IDs.
- Made the Nuclear Reactor General, Control and Fuel tab icons monochromatic across all four toggle states, preserving their sizes and shapes; Fuel uses separate toggle textures and retains the original colored item sprite.
- Migrated Nuclear Reactor to the generic thermal model with structure-based heat capacity, passive cooling, finite coolant heat absorption and burn-rate-driven heat; retained machine-owned overheat/meltdown rules and existing stored temperatures.
- Optimized Nuclear Reactor background updates: gate visual work on shouldUpdateUI, cache static structure/storage wrappers, batch resource writes, throttle vent particles, and keep keypad/power actions on InterfaceManager events.
- Moved only basic Uranium materials, their textures/localized names, Creative entries, ore drops and basic recipes to UtilityCraft. Enriched/spent pellets, rods, uranium chemistry, machinery and all other materials remain in Heavy Machinery with unchanged identifiers. Retained Uranium sieve-drop registration in Heavy Machinery for normal and compressed Crushed Cobbled Deepslate, with unchanged amounts, chance and tier.
- Renamed the Waste percentage label from Reserve to Filled to clarify tank occupancy.
- Used the supplied 12x12 reactor sprite for General and restored the compact calculator gray casing across all toggle states.
- Made the General and Control tab artwork more compact: a framed reactor core and a smaller calculator with 2x2 keys, centered across all four toggle states.
- Enlarged Nuclear Reactor toggle artwork to a centered 16x16 area inside the 18x18 buttons; Fuel uses its original 16x16 item sprite without downscaling.
- Added dedicated 18x18 General, Fuel and Control tab icons with all four native toggle states; retained Info artwork and updated the Control icon in the guide.
- Added energy-per-FU and maximum fuel yields to Reactor Info and aligned iconless labels with the left edge.
- Tightened Reactor Info section spacing and reduced scroll content height from 368 to 272 pixels without shrinking text or icons.
- Expanded Reactor Info into a scrollable illustrated guide covering fuel yields and maximum efficiencies, Heavy Water cooling, rate/temperature control, gas-port waste extraction, and clearly marked planned radioactive-leak warnings. Added a 16x16 Nuclear Waste Gas guide sprite.
- Added the standard empty gas-bar background to all 49 nuclear_waste_gas frames, replacing transparent gaps as the tank drains.
- Raised all four Nuclear Reactor tabs by 20 pixels to start at the same height as normal machine Upgrade tabs, preserving their spacing.
- Raised the Nuclear Reactor Recommended Rate label by 1 pixel.
- Moved all four external Nuclear Reactor tab toggles 1 pixel inward toward the main panel.
- Moved Recommended Rate from the Nuclear Fuel tooltip to Control, replacing the heat hint and aligning the new readout with the rate input.
- Updated Control with a fuller burn-rate explanation, Current Rate above the input, a lower input baseline and the previous keypad spacing; removed the right-hand applied-rate heading/readout.
- Redesigned Control into an aligned left-hand target display and complete calculator keypad, with the applied rate and Apply/Clear actions on the right and a separated start/stop control.
- Changed Nuclear Reactor control from percentage power to a direct FU/t rate with no 100% or assembly burn cap. General now shows Rate; existing percentages migrate to equivalent rates. Fuel tooltips show actual, nominal and cooling-based recommended rates; overdriving adds heat. Fuel, energy and waste capacity still constrain consumption.
- Reduced the Control input display height to 18 pixels and increased the input number font scale to 0.75.
- Replaced the Reactor Control display machine-screen artwork with a plain dark rectangle.
- Reorganized Reactor Control with a dark numeric display, applied-power readout, a bottom calculator keypad and labeled actions on the right.
- Renamed the waste resource and its bar/tank assets to nuclear_waste; gas storage and the Waste output remain unchanged.
- Replaced the custom Waste bar renderer with native GasStorage.display(24), aligned the fuel-mixing note with fuel icons, and lowered the supply hint by 1 pixel.
- Added a Fuel-tab hint below the title explaining fuel supply through Item Ports and Item Pipes.
- Aligned the Reactor fuel-mixing note to the left panel edge and matched its font scale to the item names (0.58).
- Shortened the Reactor Fuel note to clarify that fuel types cannot be mixed and increased its font scale from 0.5 to 0.7.
- Vertically centered the fuel icons, names and FU amounts as a group alongside the Reactor fuel slot.
- Simplified the Reactor Fuel tab by removing the insertion and accepted-fuels headings, restoring the original empty-slot fuel flipbook, and moving the slot up 8 pixels and right 3 pixels.
- Swapped Reactor Temperature and Waste bars: Temperature now sits beside Energy, with Waste at the far right.
- Nuclear fuel now produces Nuclear Waste (1 mB/FU, 256,000 mB per Gas Cell; at least one Gas Cell is required). Full waste storage pauses burning until extracted through gas ports using Any Output or Waste; fractional mB persist. Added external gas-tank support.
- Added the 49-level ochre Nuclear Waste bar to the Reactor UI, with gas-storage telemetry replacing mock values.
- Removed the extra Uranium bar border; its original texture provides the frame.
- Shortened telemetry headings to Reactor and Resources and prefixed each page title with Reactor while preserving native title sizing.
- Styled Reactor telemetry with a standalone status, red Power label, cyan energy data including capacity, and green tank labels with white values and reset codes on each line.
- Reorganized Reactor telemetry with separated status, operating data, energy and uptime; grouped tank data under yellow Fuel, Coolant and Waste headings.
- Enlarged the Reactor Information and Tanks Information headings and shifted both 2 pixels left.
- Added per-tab Reactor, Fuel, Control and Info titles using the original chest-title dimensions and font; removed the duplicate guide heading. Raised the Reactor bars and added Reactor Information / Tanks Information headings above the telemetry screen.
- Removed Reactor bar headings and centered the shared Thermo screen texture behind the two telemetry columns, with lighter text for contrast.
- Redesigned the Nuclear Reactor into Reactor, Fuel and Control tabs on the left and an in-panel Info tab on the right, reusing existing tab artwork. Removed side panels; only Fuel shows player inventory.
- Split reactor telemetry into two columns, moved keypad controls to a dedicated page, and separated editable power from the applied setpoint. Liquid waste is visibly reserved until its mechanics are implemented.
- Tin casings, glass, plated/hazard blocks, vents and all ports now use the same multiblock tier tags as their Steel counterparts, including active port states.
- Shortened the tank and Power Condenser Information panels in all three locales to focus on setup, storage and routing.
- Moved the High-Speed Rotor out of Components and Modules into the Items tab as an ungrouped item.
- Integrated all six Heavy Machinery creative tanks into UtilityCraft's shared Tanks group.
- Consolidated Tin, Bronze, Steel and Netherite casings, ports and related building blocks into one Casings & Ports creative group.
- Integrated Isotope Centrifuge, Reaction Chamber and Chemical Processor into UtilityCraft's shared Machines group instead of creating a separate Heavy Machinery group.
- Moved Oxygen, Hydrogen, Sulfuric Acid and Heavy Water bar/tank definitions and assets, plus the complete Lead material family and processing/drop registrations, to UtilityCraft. Existing resource IDs and HM chemistry/coolant behavior are preserved.
- Updated reactor documentation with the Fuel Integration checkpoint and selected liquid-waste direction, replacing the superseded direct-pellet plan and recording pending Chemical Processor treatment.
- Registered Heavy Water as tier 2 with twice Saline Coolant efficiency. Nuclear active cooling now requires tier 2 or higher, including addon-registered coolants; Thermo Reactor still accepts both.
- Reduced Heavy Water concentration to 64,000 DE per 1,000 mB while preserving its 8,000 mB water input and empty item slot. Registered it as coolant with twice the per-volume efficiency of Saline Coolant, without changing fuel yield or conductor limits.
- Renamed the Creative Nuclear Machinery group to Machines with a copper-colored (Heavy Machinery) subtitle on a second line and grouped all five single-block chemistry machines together.
- Replaced compact chemistry machine item descriptions with the Crusher-style accepted Speed/Energy upgrade glyphs in English, Spanish and Portuguese.
- Rebalanced enriched fuel production to 20.4192 MDE per rod before upgrades/recycling, with cheaper early chemistry and adjusted Converter, Processor, Electrolyzer and Centrifuge rates. Chamber coolant rates remain unchanged.
- Synchronized DoriosCore with UtilityCraft, preserving passive item IO, infinite energy transfer and consumed fluid/gas container fixes.
- Liquid and gas bar tooltips now identify their resource category, including empty tanks.

- Updated the nuclear documentation with compact chemical machines, liquid Sulfuric Acid, fuel fabrication, and HF recycling.
- Uranium Ingots now press into Uranium Pellets; four pellets and two Steel Plates craft a fuel rod. Enriched Uranium Oxide presses into Enriched Uranium Pellets.

## ADDED
- Added Liquid and Gas Tank Controllers with five freely typed tanks, centered storage bars, per-tank port inputs/outputs and all-tank default routing. Steel multiblocks require matching cells and ports, with 256,000 mB per cell shared across five tanks and no energy or processing modules.
- Added Tin, Bronze, Steel and Netherite Gas Ports and Gas Cells, with purple accents, Workbench/Crafter recipes and localized creative entries.
- Migrated the Electrolyzer and Chemical Converter blocks, scripts, UI and assets into UtilityCraft. Heavy Machinery now registers HF electrolysis and HF/UF6 conversion recipes through the shared addon recipe APIs.
- Added concise source/use descriptions for metal plates, dusts, sieve chunks, uranium intermediates/pellets and fluorite materials in all three supported locales.
- Added brief crafting and reactor-use descriptions to both fuel rod tooltips in English, Spanish and Portuguese, using UtilityCraft item-description formatting.
- The reactor empty fuel slot now alternates basic and enriched rod icons once per second using the existing autosieve flipbook pattern.
- Added basic/enriched reactor fuel profiles with one shared input, persistent fuel-type locking and fuel-bar type/maximum efficiency/burn/power details. Enriched output is unchanged; waste processing remains deferred.
- Added a standalone Spanish fuel-tree dashboard with basic/enriched routes, recipe details, batch quantities and HF recycling connections.

- Added the single-block Reaction Chamber, Chemical Converter, and Chemical Processor with temporary 16x16 face textures, four visible material stores each, standard I/O, Speed/Energy upgrades, and Workbench/Crafter recipes.
- The small Reaction Chamber shares multiblock recipes at one tenth the base rate. Added Sulfuric Acid and Uranium Concentrate recipes to both sizes.
- Added HF/Natural UF6 production and enriched oxide/HF recovery, with initial 80% fluorine recovery through electrolysis.
- Added Sulfuric Acid support in standard liquid tanks and Crafting Table/Workbench/Crafter recipes for both fuel rods.

- Added Isotope Centrifuge crafting with a High-Speed Rotor as a construction ingredient, including UtilityCraft Crafter support.

- Added the functional single-block Isotope Centrifuge with three visible gas tanks, Speed/Energy upgrades, and standard I/O and Information panels.
- Added Natural UF6 separation: 1,000 mB produces 250 mB Enriched UF6 and 750 mB Depleted UF6 for 16.384 MDE. Both outputs must fit and can be extracted into UtilityCraft's existing gas tanks.

- Added Hydrogen Fluoride electrolysis: 1,000 mB gas produces 400 mB Hydrogen and 400 mB Fluorine for 1.024 MDE, using liquid/gas recipe keys and a visible gas input with I/O controls.
- Added Heavy Water concentration to the Reaction Chamber: 8,000 mB Water produces 1,000 mB Heavy Water with no item input and a base recipe cost of 4.096 MDE.
- Added Hydrogen Fluoride, Fluorine, and Heavy Water support in UtilityCraft's existing gas/liquid tanks.

- Added the functional single-block Electrolyzer with one liquid input, one gas input, two gas outputs, energy and progress bars, and Information, I/O, and Upgrades panels.
- Added automatic Water electrolysis: 1,000 mB Water produces 1,000 mB Hydrogen and 500 mB Oxygen for 512 kDE, with output compatibility checks and progress retained when energy runs out.
- Added per-face Electrolyzer liquid input/drain and separate gas output routing, plus Hydrogen/Oxygen support in UtilityCraft's existing gas tanks.
- Added standard Speed and Energy upgrade support to the Electrolyzer, including multiple batches per update when upgraded throughput allows.

## FIXED
- Fixed Gas Turbine visual entity loading by using an integer gas texture index instead of enum names exceeding Bedrock's 32-character limit. Preserved all gas textures, particles and Steam fallback.

- Removed the rejected explicit bind_to_actor=true field from turbine particle timelines, using default actor binding so all three gas animations can load.
- Fixed turbine gas texture selection by explicitly mapping synchronized gas enum names to numeric texture indices; Methane and Hydrogen no longer use an invalid string in the texture-array calculation.
- Fixed opaque Gas Turbine gas visuals by baking transparency levels into each gas texture instead of relying on render-controller alpha; preserved full-volume sizing and repeated 16x16 pixels.
- Filtered multiblock entity resolution and deactivation to live dorios:multiblock controllers, preventing hide events from targeting players, dropped items or visual rotors. Applied the same targeted fix to the workspace addon copies of DoriosCore that register multiblock listeners.
- Removed the unnecessary Gas Turbine controller client entity; only the separate rotor has visual resources. Guarded unsynchronized rotor properties in animations and reject unloaded BP property definitions without repeated script errors or orphaned rotors.
- Removed the trailing _liquid suffix from liquid bar display names and renamed Nuclear Waste assets and storage IDs to nuclear_waste_gas.
- Shortened the Nuclear Fuel tooltip to type, stored fuel/capacity and maximum efficiency, avoiding the 255-character nameTag limit.
- Removed the literal newline escape from the Nuclear Reactor heat hint and updated the Info keypad instructions from percentage power to FU/t in all three locales.
- Restored standard uc.text_label usage for Nuclear Reactor telemetry and power readouts, preserving the original telemetry (0.55) and keypad (0.67) text scales while removing custom inner controls and styling.

- Removed the unused side panel from both tank controllers. Their Information tabs and the Power Condenser Information tab now match Storage Drive position and size; tank information describes structure, capacity and port routing in all three locales.
- Gave all three liquid and seven gas tank entities their own 16x16 center-cropped bar textures and localized tank names, replacing water/steam placeholders.
- Fixed cropped reactor fuel icons by arranging both flipbook frames horizontally, matching the autosieve atlas layout.
- Restored the tracked Regolith data directory so watch mode starts on fresh checkouts.

- Matched the small Reaction Chamber material layout to the multiblock: liquid input, item input, progress, item output, liquid output, centered horizontally.

- Matched the five new machine/fuel-rod crafting recipes to the existing 1.20.80 format and ingredient-based unlock data, fixing recipe loading errors.
- Matched the High-Speed Rotor item category to its construction catalog group, removing the category reassignment warning.

- Updated HM item I/O to UtilityCraft's Default/Disabled behavior, fixing chemical-machine registration failing at startup. Default uses all declared passive input/output slots; explicit modes control automatic transfers and Disabled blocks the face.


- Positioned I/O resource tabs at the upper-left corner through UtilityCraft's shared control: gas first for the Isotope Centrifuge, and liquid followed by gas for the Electrolyzer, independent of panel height.

- Fixed invalid nested I/O tab overrides causing Bedrock unknown-property errors in the Electrolyzer and Isotope Centrifuge screens.

- Centered the Isotope Centrifuge progress arrow between its input and first output, with I/O tabs independent of panel height.

- Reduced the Electrolyzer and Isotope Centrifuge I/O panel heights by 8 px.
- Removed the Isotope Centrifuge rotor slot and operating requirement; the machine processes gas without item inputs.

- Simplified Electrolyzer liquid and gas I/O labels to generic inputs, outputs, and input drains in all three languages.

- Centered the Electrolyzer's two input bars, progress arrow, and two output bars; moved energy to the Ultimate Crusher's right-side position.

- Limited Reaction Chamber batches by the available input liquid, preventing output generation without the full liquid cost.

- Matched the Electrolyzer I/O Default label color to UtilityCraft's standard gray in all three languages.

- Fixed Electrolyzer I/O modes to cycle from Default through custom routes to Disabled, matching UtilityCraft's passive access and explicit automatic transfer behavior.
- Increased the Electrolyzer I/O panel height and shortened its mode labels to prevent overlap with the face buttons.

---

# UtilityCraft: Heavy Machinery v0.5.2

## ADDED

- Added placeable, directional Electrolyzer and Isotope Centrifuge placeholder blocks with inactive and active visual states; their processing logic remains intentionally unimplemented.
- Added the registered High-Speed Rotor component and complete temporary active/inactive six-face texture sets for the planned Isotope Centrifuge and Electrolyzer.
- Added complete 49-frame internal UI bar sets and hidden UI items for Sulfuric Acid, Heavy Water, Hydrogen, Oxygen, Fluorine, Hydrogen Fluoride, Natural Uranium Hexafluoride, Enriched Uranium Hexafluoride, and Depleted Uranium Hexafluoride.
- Added a wearable four-piece Hazmat Suit adapted from the provided Project Horizon assets, including custom item sprites, equipped textures, per-piece geometry, armor stats, enchantability, and Rubber Sheet repairs.
- Added Uranium Concentrate, Enriched Uranium Oxide, Spent Uranium Pellet, Fluorite Crystal, Fluorite Dust, and Rubber Sheet items with localized names and inventory registration.
- Added Fluorite Crystal as a 1.5% Emerald-tier Sieve drop from Crushed Cobbled Deepslate, with compressed support and Crusher processing into Fluorite Dust.
- Added a complete Lead material family with Sieve-obtained chunks, reconstructable stone and deepslate ores, raw, dust, ingot, nugget, plate, and storage-block forms, plus dark blue Steel-derived textures and processing recipes.
- Added a living Nuclear Reactor design document covering reactor behavior, fuel routes, gas production, enrichment, coolant moderation, waste, and implementation phases.
- Added the first functional Nuclear Reactor multiblock, converting Enriched Uranium Rods into internal nuclear fuel and Dorios Energy.
- Added a dedicated Nuclear Reactor interface with solid-fuel input, uranium reserve, coolant, temperature, output, structure statistics, and 0–100% power controls.
- Added a Creative Saline Coolant Tank that provides infinite Saline Coolant to fluid networks and compatible containers.
- Added Tin Ore and Deepslate Tin Ore blocks with Silk Touch support and Raw Tin drops.
- Added Deepslate Uranium Ore with Silk Touch support and Raw Uranium drops.
- Added a complete Tin multiblock casing family with a casing, crystal, plated and hazard blocks, ventilation panel, and item, liquid, and energy ports.

## CHANGED
- Replaced Chemical Processor, Isotope Centrifuge and Reaction Chamber textures with the supplied 16x16 face sprites for off/on states; gave the Reaction Chamber Controller its own top, bottom, front and side textures.
- Updated the four Utility Exo Armor item icons with the supplied artwork.
- Updated the supplied Fluorite crystal/dust, Enriched Uranium Oxide, Spent Uranium Pellet and Rubber Sheet textures. Rubber Sheet remains available without a crafting recipe.
- Used the supplied 12x12 reactor sprite for General and restored the compact calculator gray casing across all toggle states.

- Reworked all planned nuclear liquid and gas UI bars with material-specific water, steam, lava, XP, milk, and bubble motifs derived from Ascendant Technology instead of flat single-color fills.
- Updated Nuclear Reactor planning with Sieve-based Lead and Fluorite acquisition, final nuclear material names, deferred custom storage, meltdown-only radiation, Hazmat protection, Rubber Sheets, and fuel-route complexity.
- Revised the planned nuclear fuel routes to reuse the existing Uranium and Enriched Uranium Pellets, removed unnecessary Fuel Core intermediates and Gypsum byproduct, and kept the reactor on the existing Netherite casing family.
- Rebalanced Nuclear Reactor fuel for a clear endgame advantage: substantially higher per-tick production, shorter rod lifetime, lower total energy per rod, and twice the full-power cooling demand per Fuel Assembly.
- Reworked both reactor temperature simulations around thermal equilibrium and inertia: cores now heat quickly at startup, slow naturally near their stable temperature, and settle to within 1% in about five minutes instead of drifting indefinitely or stabilizing instantly.
- Fixed both reactor On Time labels to use a persisted real-world start timestamp instead of scheduler ticks, preventing inaccurate or inconsistent elapsed times.
- Matched the Nuclear Reactor's active visuals to the Thermal Reactor: its internal air fills with water, hot coolant emits tall smoke from vent panels, and the visual water is removed when the multiblock deactivates or melts down.
- Fixed filled multiblock cleanup to use the generic stored structure bounds, allowing non-Thermal reactors to remove their visual fill correctly.
- Made Fuel Assemblies waterloggable and added a reusable `dorios:waterloggable` block tag; reactor fill and drain operations now automatically set or clear waterlogging on tagged internal components.
- Power Condenser, Thermal Reactor, and Nuclear Reactor transfer rates are now standardized at 5% of their internal energy capacity per tick.
- Nuclear Reactor efficiency now follows core temperature, ranges from 10% to a 95% ideal peak, and uses higher Netherite-class overheat and meltdown limits.
- Nuclear Reactors now require a Netherite casing shell and accept all compatible Netherite casing variants and ports.
- Fuel Assemblies now increase nuclear-fuel capacity and theoretical reaction speed, while each Rod Control efficiently manages up to four assemblies.
- Nuclear Reactor empty space now determines coolant capacity, and Heat Conductors remove heat by consuming any registered coolant.
- Changed Tin and Uranium chunks to reconstruct their ore blocks from four chunks at a crafting table or in the Electro Press.
- Changed Tin and Uranium ore processing to produce one ingot in furnaces or two dust in the Crusher.
- Link Nodes now start in `Default`, can select a machine-specific IO group, and retain `Disabled` as an explicit fully blocked state.

## FIXED

- Fixed the Nuclear Reactor cancel button restoring the active power instead of clearing the input to zero, and removed the unnecessary full fuel-storage warning.
- Fixed Netherite Item and Liquid Ports missing their active block state and active I/O permutations, which prevented Netherite multiblocks from forming.
- Fixed the Nuclear Reactor interface layout by moving the fuel input beside the gauges, adding an Enriched Uranium overlay, shortening the status panel, and matching the Thermal Reactor keypad header.
- Fixed repeated machine watcher registration restoring pressed interface buttons before their actions could be detected.
- Fixed Tin and Uranium ores so they only drop from pickaxes, correctly support Silk Touch, and gain additional Raw Ore drops from Fortune.
- Fixed Item and Liquid Port conflicts with UtilityCraft by sharing Heavy Machinery's link-node I/O registrations across every loaded DoriosCore runtime.
- Fixed multiblock controller and helper-entity resolution so connected ports consistently resolve their owning active structure.
- Fixed default Link Node inputs for the Thermal Reactor, Auto Sieve and Infuser so they expose their intended tanks or material slots without requiring manual node configuration.

---

# UtilityCraft: Heavy Machinery v0.5.1

## CHANGED
- Used the supplied 12x12 reactor sprite for General and restored the compact calculator gray casing across all toggle states.

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
