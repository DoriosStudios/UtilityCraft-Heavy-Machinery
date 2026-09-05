# Nuclear Reactor — Design and Planning

This is the living design document for the Nuclear Reactor and its fuel cycle. Values marked as **proposed** must be tested and balanced before they are considered final.

## Current Decisions

### Confirmed

- The Nuclear Reactor is a Netherite-casing multiblock.
- The Isotope Centrifuge will be a single-block machine.
- There will be two primary fuel routes: the Uranium Fuel Rod and the Enriched Uranium Rod.
- The existing Uranium Pellet and Enriched Uranium Pellet are the pressed intermediates used to craft the existing fuel rods.
- Enrichment will use gases and Uranium Hexafluoride (UF6).
- Inserted fuel is converted into Fuel Units (FU) and stored internally.
- Fuel Assemblies provide fuel capacity and maximum reaction speed.
- Each Rod Control efficiently manages up to four Fuel Assemblies.
- Heat Conductors remove heat by consuming coolant.
- Empty internal blocks determine coolant capacity.
- Normal water will not be accepted as an operational coolant.
- There will be no separate Fuel Rod Casing item. Plates will be ingredients in the final rod recipes.
- Lead will be added as a complete standard material family for controllers, machines, components, shielding, and future waste containment.
- Sulfuric Acid production will consume the existing Sulfur Spike directly from the Crushed Blackstone sieve route and will not require Sulfur Ore, Sulfur Dust, or a pressed Sulfur block.
- Nuclear fuel will use a dedicated typed storage with separate type, amount, and capacity values.
- The reactor will lock to the first loaded fuel type while any FU remains.
- A different rod will remain in the input slot until the current FU reaches zero, then it may load automatically.
- Both rods will create the same generic waste and use the same coolant system.
- Fuel profiles will differ only in FU density, maximum burn-rate multiplier, and energy-efficiency multiplier.
- The reactor will continue using the existing Netherite casing family; no additional nuclear casing family is planned for the current scope.
- Processing byproducts without a defined gameplay use will not be added to the current scope.
- Lead Chunks and Deepslate Lead Chunks will come from Sieve processing and reconstruct their corresponding ores.
- Fluorite will not have an ore block or world generation; Fluorite Crystals will come directly from filtering Crushed Cobbled Deepslate.
- The generic reactor waste item will be the Spent Uranium Pellet.
- The reusable centrifuge component will be named High-Speed Rotor.
- The Reaction Chamber will be extended to handle the item, liquid, and gas combinations required by nuclear chemistry.
- Radiation exposure will only be created by a Nuclear Reactor meltdown.
- The current scope will not add dedicated gas tanks, waste barrels, or fluid buckets; internal UI bar assets may be prepared before their machines are functional.
- Latex will not be added in the current scope; Rubber Sheets will be used for the Hazmat Suit and reusable machine components.

### Proposed

- Coolants will have separate cooling and neutron-moderation properties.
- Saline Coolant will prioritize cooling.
- Heavy Water will prioritize moderation.
- The first version will not add a second reactor tank or catalyst slot.
- Enrichment will create depleted material that cannot be deleted automatically.
- The reactor will eventually produce spent fuel instead of deleting consumed rods without a byproduct.
- The current milestone includes Spent Uranium Pellet generation and extraction.
- Depleted Uranium Hexafluoride remains part of the enrichment design, but its implementation and external storage are deferred until compatible generic gas storage exists.
- Reprocessing, plutonium extraction, liquid nuclear waste, and vitrification are deferred.

## Current Functional State

The implemented reactor currently accepts only utilitycraft:enriched_uranium_rod.

| Property | Current value |
|---|---:|
| FU per Enriched Uranium Rod | 1,000 FU |
| Capacity per Fuel Assembly | 4,000 FU |
| Burn rate per Fuel Assembly | 2 FU/t |
| Fuel Assemblies per Rod Control | 4 |
| Base energy per FU | 200,000 DE |
| Minimum temperature efficiency | 10% |
| Maximum temperature efficiency | 95% |
| Ambient temperature | 300 K |
| Overheat warning | 2,800 K |
| Meltdown temperature | 3,000 K |
| Coolant capacity per empty block | 64,000 mB |
| Energy transfer | 5% of capacity per tick |

At ideal efficiency, each FU produces 190,000 DE. One properly controlled Fuel Assembly can produce up to 380,000 DE/t.

Saline Coolant is currently the only registered coolant and has a cooling efficiency of 1.0. The basic fuel route, Heavy Water, gases, and waste described below are still in planning.

Complete 49-frame internal UI bar sets now exist for Sulfuric Acid, Heavy Water, Hydrogen, Oxygen, Fluorine, Hydrogen Fluoride, Natural UF6, Enriched UF6, and Depleted UF6. These are visual assets and hidden UI items only; they do not register the corresponding liquid or gas mechanics.

The High-Speed Rotor now exists as a registered item. The Isotope Centrifuge and Electrolyzer now exist as placeable, horizontally orientable blocks with complete temporary six-face texture sets in both inactive and active states. Their interfaces, storage, recipes, and runtime processing logic remain pending.

## Reactor Components

### Nuclear Reactor Controller

- Validates and activates the multiblock.
- Stores temperature, fuel, requested power, and structure statistics.
- Contains the main interface.
- Allows the player to start, stop, and select a burn rate from 0% to 100%.

### Fuel Assembly

- Adds 4,000 FU of internal capacity.
- Adds a theoretical burn rate of 2 FU/t.
- Is waterloggable for the reactor fill visual.
- Its effective performance is limited by the available Rod Controls.

### Rod Control

- Efficiently controls up to four Fuel Assemblies.
- Adding assemblies beyond that ratio reduces the effective burn rate.
- Does not directly increase the energy obtained from each FU.

### Heat Conductor

- Removes heat from the core.
- Consumes coolant according to the amount of heat removed.
- Its effective cooling capacity depends on the coolant type.
- Only minimal passive cooling remains without coolant.

### Energy Cells

- Determine the reactor's internal energy capacity.
- Production stops when no storage space remains.
- Network transfer is separate from production and equals capacity / 20 per tick.

### Empty Blocks

- Each empty internal block adds 64,000 mB of coolant capacity.
- The reactor visually fills its interior in the same way as the Thermal Reactor.
- Visual water is removed when the structure stops, deactivates, or is destroyed.

### Ports and Vent Panels

- Item Ports insert rods and may later extract waste.
- Fluid Ports insert coolant.
- Energy Ports connect internal storage to the network.
- Ports must be compatible with Netherite casings and contain the utilitycraft:active state.
- Vent Panels emit steam while the running reactor removes heat.

## Operating Flow

~~~text
Fuel Rod in the input slot
└─ Converted into internal fuel
   └─ Stored as FU
      └─ Consumed according to the burn rate
         ├─ Produces Dorios Energy
         ├─ Generates heat
         ├─ Consumes coolant
         └─ May produce waste in the future
~~~

The first accepted rod sets the active fuel type. Additional rods of that type may load normally. A different rod is not consumed while FU remains, but it may stay in the input slot and load automatically as soon as the current reserve reaches zero.

### Typed Fuel Storage

Fuel is not represented as an item, liquid, or gas after loading. It uses a dedicated storage model:

~~~js
{
    type: uranium | enriched_uranium | empty,
    amount: 0,
    capacity: 0,
}
~~~

The item registry maps input items into a storage type and FU amount:

~~~js
{
    itemId,
    fuelType,
    fuelUnits,
}
~~~

The fuel-type registry defines runtime behavior:

~~~js
{
    burnRateMultiplier,
    efficiencyMultiplier,
    label,
}
~~~

Storage rules:

1. When type is empty, the first valid rod sets the type.
2. A matching rod adds its FU if the complete rod fits within capacity.
3. A mismatched rod remains untouched in the input slot.
4. When amount reaches zero, type resets to empty.
5. On the next loading pass, a waiting rod may establish the new type automatically.

Waste uses a separate amount/progress field and remains generic. It is calculated from consumed FU, so switching fuel types never requires separate waste storage.

## Fuel Summary

Initial proposed values:

| Fuel | FU per rod | Maximum burn rate | Energy efficiency | Waste type |
|---|---:|---:|---:|---|
| Uranium Fuel Rod | 250 FU | 35% | 60% | Spent Uranium Pellet |
| Enriched Uranium Rod | 2,000 FU | 100% | 100% | Spent Uranium Pellet |

The Enriched Uranium Rod is eight times as dense and supports the reactor's complete structural burn rate. The basic rod is intentionally limited to 35% of that burn rate and converts each FU into only 60% as much energy.

For a standard reactor with four properly controlled Fuel Assemblies:

| Fuel | Maximum fuel burn | Ideal maximum production |
|---|---:|---:|
| Uranium Fuel Rod | 2.8 FU/t | About 319,200 DE/t |
| Enriched Uranium Rod | 8 FU/t | About 1,520,000 DE/t |

The enriched route therefore provides approximately 4.76 times the maximum DE/t and substantially more total energy per item.

## Route 1 — Uranium Fuel Rod

This is the basic alternative, but it still requires industrial processing.

~~~text
Deepslate Uranium Ore
└─ Mining
   └─ Raw Uranium
      └─ Crusher
         └─ Uranium Dust
            └─ Incinerator
               └─ Uranium Ingot
                  └─ Electro Press
                     └─ Uranium Pellet
                        └─ Crafting + 2 Steel Plates
                           └─ Uranium Fuel Rod
~~~

Proposed recipes:

~~~text
1 Uranium Ingot
→ Electro Press
→ 1 Uranium Pellet
~~~

~~~text
4 Uranium Pellets + 2 Steel Plates
→ Crafting Table / UtilityCraft Crafter
→ 1 Uranium Fuel Rod
~~~

Goals:

- Start a reactor without building the full chemical industry.
- Require the Crusher, Incinerator, and Electro Press.
- Provide low energy yield per unit of uranium.
- Serve small reactors, testing setups, and backup systems.
- Require eight times as many rods to provide the same internal FU as enriched fuel.

The direct Raw Uranium → Uranium Ingot and Uranium Ore → Uranium Ingot furnace recipes must be reviewed because they currently allow players to bypass the Crusher.

## Route 2 — Enriched Uranium Rod

This route includes purification, gas production, conversion to UF6, isotope separation, and enriched-pellet fabrication.

~~~text
Deepslate Uranium Ore
└─ Mining
   └─ Raw Uranium
      └─ Crusher
         └─ Uranium Dust
            └─ Reaction Chamber + Sulfuric Acid
               └─ Yellowcake (Uranium Concentrate)
                  └─ Reaction Chamber + Fluorine Gas
                     └─ Natural Uranium Hexafluoride Gas
                        └─ Isotope Centrifuge
                           ├─ Enriched Uranium Hexafluoride Gas
                           └─ Depleted Uranium Hexafluoride Gas
~~~

Conversion and fabrication:

~~~text
Enriched Uranium Hexafluoride Gas
└─ Reaction Chamber + Hydrogen Gas
   ├─ Enriched Uranium Oxide
   └─ Hydrogen Fluoride Gas
      └─ Recycled into the fluorine production chain

Enriched Uranium Oxide
└─ Electro Press
   └─ Enriched Uranium Pellet
      └─ Crafting + 2 Steel Plates
         └─ Enriched Uranium Rod
~~~

Proposed fabrication recipes:

~~~text
1 Enriched Uranium Oxide
→ Electro Press
→ 1 Enriched Uranium Pellet
~~~

~~~text
4 Enriched Uranium Pellets + 2 Steel Plates
→ Crafting Table / UtilityCraft Crafter
→ 1 Enriched Uranium Rod
~~~

Goals:

- Obtain substantially more energy from each unit of uranium.
- Require chemical and energy infrastructure.
- Generate depleted material that must be removed.
- Recover fluorine to avoid excessive repetitive mining.

## Fluorine, Hydrogen, and Sulfuric Acid Tree

### Fluorine

Fluorite Crystal will be the initial mineral source of fluorine. It is obtained directly from the Sieve rather than from an ore block.

~~~text
Crushed Cobbled Deepslate
└─ Sieve + Emerald-tier Mesh or better
   └─ Fluorite Crystal
      └─ Crusher
         └─ Fluorite Dust
            └─ Reaction Chamber + Sulfuric Acid
               └─ Hydrogen Fluoride Gas

Hydrogen Fluoride Gas
└─ Electrolyzer
   ├─ Fluorine Gas
   └─ Hydrogen Gas
~~~

The proposed base Sieve chance is 1.5%. Mesh chance multipliers still apply, and compressed input produces nine crystals on a successful roll. This is a gameplay-simplified industrial chain. Calcium sulfate is not represented because it has no defined use in the current progression; the machine only exposes Hydrogen Fluoride Gas as its output.

### Hydrogen and Oxygen

~~~text
Water + Energy
└─ Electrolyzer
   ├─ Hydrogen Gas
   └─ Oxygen Gas
~~~

Water may be infinite in this process because it is not acting as free reactor coolant. Energy, processing time, and Electrolyzer throughput provide the cost of these gases.

### Sulfuric Acid

~~~text
Blackstone
└─ Crusher
   └─ Crushed Blackstone
      └─ Sieve + Copper-tier Mesh or better
         └─ Sulfur Spike
            └─ Reaction Chamber + Oxygen Gas + Water
               └─ Sulfuric Acid
~~~

Crushed Blackstone currently has a 12% chance to produce one minecraft:sulfur_spike with a tier-2 Copper mesh. The existing Electro Press recipe combines four spikes into one minecraft:sulfur block.

The nuclear chemical chain consumes Sulfur Spikes directly. They do not need to be crushed or pressed. The existing Sulfur block recipe remains available for its other uses but is not part of this process.

Initial proposed batch:

~~~text
4 Sulfur Spikes + Oxygen Gas + Water
→ Reaction Chamber
→ 1,000 mB Sulfuric Acid
~~~

### Fluorine Recovery

~~~text
Enriched UF6
└─ Conversion with Hydrogen Gas
   ├─ Enriched Uranium Oxide
   └─ Hydrogen Fluoride Gas
      └─ Electrolyzer
         └─ Reusable Fluorine Gas
~~~

Initial recovery target: 75–90%. Fluorite starts the system and compensates for losses rather than replacing all gas after every operation.

## Isotope Centrifuge

The Isotope Centrifuge will be a single-block machine.

### Storage

- One input tank for Natural Uranium Hexafluoride Gas.
- One output tank for Enriched Uranium Hexafluoride Gas.
- One output tank for Depleted Uranium Hexafluoride Gas.
- Internal energy storage.
- One component slot for a High-Speed Rotor.

### Proposed Operation

~~~text
1,000 units of Natural UF6
→ Isotope Centrifuge
→ 250 units of Enriched UF6
  + 750 units of Depleted UF6
~~~

This ratio is compressed for gameplay. The real process creates substantially more depleted material than enriched material.

| Property | Initial value |
|---|---:|
| Time per batch | 30–45 s |
| Energy per batch | 15–20 MDE |
| Coolant | None |
| Required component | High-Speed Rotor |

The High-Speed Rotor may reuse Netherite Plates and Heat Conductors. It is a generic high-speed rotating component that can later be reused by turbines, compressors, and pumps. It should initially be permanent because frequent wear could turn the process into tedious maintenance.

The machine stops if either output tank has no available space. Depleted gas must never disappear automatically. The two-output recipe will not be enabled until Depleted UF6 can be extracted into compatible generic gas storage.

## Coolant and Moderation

The first version will not have a separate moderator tank. Every coolant will define:

- coolingMultiplier: its ability to remove heat.
- moderationMultiplier: its effect on all consumed FU.

Initial values:

| Coolant | Moderation | Cooling | Purpose |
|---|---:|---:|---|
| Saline Coolant | 100% | 125% | Maximum cooling and stability |
| Heavy Water | 110% | 90% | Greater production with greater thermal risk |

Saline Coolant provides better cooling. Heavy Water provides better moderation. Their effects do not depend on which rods originally supplied the internal FU.

### Conceptual Formulas

~~~text
Fuel Burn =
Maximum Burn Rate
× Fuel Burn Rate Multiplier
× Power Setpoint
~~~

~~~text
Production =
Fuel Burn
× Energy per FU
× Fuel Efficiency Multiplier
× Coolant Moderation Multiplier
× Temperature Efficiency
~~~

~~~text
Generated Heat =
Fuel Burn
× Heat per FU
~~~

~~~text
Removed Heat =
Heat Conductors
× Conductor Dissipation
× Coolant Cooling Multiplier
× Thermal Difference
~~~

~~~text
Maximum Energy Transfer per Tick =
Energy Capacity / 20
~~~

## Temperature

- The core moves toward a thermal equilibrium.
- Temperature changes quickly at startup and slows as it approaches equilibrium.
- The system is intended to reach within 1% of equilibrium in approximately five minutes.
- If generated heat exceeds cooling, the equilibrium may lie above the meltdown temperature.
- Efficiency starts at 10%, reaches 95% near the ideal temperature, and decreases again when the core overheats.

## Capacity and Control

~~~text
Fuel Capacity =
Fuel Assemblies × 4,000 FU
~~~

~~~text
Control Efficiency =
min(1, Rod Controls × 4 / Fuel Assemblies)
~~~

~~~text
Maximum Burn Rate =
Fuel Assemblies
× 2 FU/t
× Control Efficiency
~~~

Adding assemblies without enough Rod Controls increases capacity but does not provide their full theoretical burn rate.

## Lead Industry

**Status: Confirmed.** Lead will be added to the addon.

Lead is a structural and shielding material for the nuclear technology branch. It is not fuel, cladding, a Heat Conductor material, or a High-Speed Rotor material.

### Processing Tree

~~~text
Gravel
└─ Sieve + Golden-tier Mesh or better
   └─ Lead Chunk
      └─ 4 chunks
         └─ Lead Ore

Crushed Cobbled Deepslate
└─ Sieve + Golden-tier Mesh or better
   └─ Deepslate Lead Chunk
      └─ 4 chunks
         └─ Deepslate Lead Ore

Lead Ore / Deepslate Lead Ore
└─ Mining
   └─ Raw Lead
      ├─ Incinerator
      │  └─ Lead Ingot
      └─ Crusher
         └─ 2 Lead Dust
            └─ Incinerator
               └─ Lead Ingots
                  └─ Electro Press
                     └─ Lead Plate
~~~

Lead Chunk and Deepslate Lead Chunk each have a proposed base Sieve chance of 4%. Mesh chance multipliers still apply. Compressed Gravel and Compressed Crushed Cobbled Deepslate produce nine matching chunks on a successful roll.

Additional standard conversions:

~~~text
9 Lead Ingots ↔ 1 Lead Block
9 Raw Lead ↔ 1 Raw Lead Block
1 Lead Ingot ↔ 9 Lead Nuggets
~~~

### Primary Uses

- Nuclear Reactor Controller.
- Fuel Assemblies and other shielded reactor components.
- Isotope Centrifuge housing.
- Electrolyzer and future nuclear-chemistry machine controllers.
- Future generic gas-storage and waste-containment equipment.
- Future lead-acid batteries, giving Lead a use outside the nuclear branch.

### Nuclear Casing Direction

The Nuclear Reactor will continue using the existing Netherite casing family in the current scope. Lead remains part of controller, reactor-component, and nuclear-machine recipes, but no Lead-Lined Netherite casing variants or additional casing assets will be added for now.

## Waste and Byproducts

### Enrichment Waste

- Depleted Uranium Hexafluoride is the waste branch of isotope separation.
- It has no productive recipe in the current scope.
- Its purpose is to occupy an output and prevent enrichment from deleting depleted material for free.
- Dedicated tanks and its external storage are deferred.
- The centrifuge recipe must not be enabled until the gas can be extracted into compatible generic storage.
- Future deconversion may produce Depleted Uranium Dioxide, recover Hydrogen Fluoride, and enable dense shielding or heavy components.

### Reactor Waste

Rods are currently consumed without producing waste. The planned system will generate one generic Spent Uranium Pellet for every 250 FU burned:

~~~text
250 FU consumed
→ 1 Spent Uranium Pellet
~~~

This gives both fuels exactly the same waste ratio:

- 1 Uranium Fuel Rod = 250 FU = 1 Spent Uranium Pellet.
- 1 Enriched Uranium Rod = 2,000 FU = 8 Spent Uranium Pellets.

The reactor tracks activeFuelType for burn behavior and a separate numeric waste-progress counter. Waste generation does not depend on activeFuelType. A stack-sized output buffer connects to Item Ports, and fuel burn stops if that buffer becomes full.

### Waste Physical States

The design contains two waste outputs, but only the reactor waste item is part of the current implementation scope:

| Stage | Material | State | Reason |
|---|---|---|---|
| Reactor output | Spent Uranium Pellet | Item | Current scope; generated proportionally from burned FU |
| Enrichment output | Depleted Uranium Hexafluoride | Gas | Designed but deferred until generic gas storage exists |

The Nuclear Reactor does not directly produce liquid or gaseous waste during normal operation. It outputs generic solid spent uranium. The enrichment industry will separately output depleted UF6 gas once compatible storage exists.

The current gameplay loop stops at item extraction:

~~~text
Reactor
└─ Spent Uranium Pellets
   └─ Item Port
      └─ Ordinary item storage
~~~

Spent Uranium Pellets do not emit radiation during normal handling. Dedicated waste barrels are not required in the current scope.

Future expansions may add additional states:

| Deferred stage | Material | State |
|---|---|---|
| Reprocessing output | High-Level Nuclear Waste | Liquid |
| Optional off-gas | Radioactive Off-Gas | Gas |
| Final stabilized waste | Vitrified Nuclear Waste | Item |

### Deferred: Fuel Reprocessing

Spent Uranium Pellets may be stored safely or processed in a Fuel Reprocessor. Reprocessing is optional and must never be required to keep an ordinary reactor running.

Proposed batch:

~~~text
9 Spent Uranium Pellets + Sulfuric Acid
→ Fuel Reprocessor
├─ Plutonium Compound
├─ Recovered Uranium
├─ Recovered Steel Scrap
└─ High-Level Nuclear Waste
~~~

The input is generic, so reprocessing yields never depend on the original rod type. Recipes should be deterministic rather than using random plutonium drops.

- Recovered Uranium returns to the Yellowcake stage or the basic fuel route.
- Steel Scrap returns a small part of the rod construction cost.
- Plutonium Compound is a rare progression material.
- High-Level Nuclear Waste is the final hazardous byproduct.

### Deferred: Plutonium Uses

Plutonium will not initially create a third primary reactor fuel. Planned uses include:

- Radioisotope Heat Source.
- Radioisotope Generator or RTG for slow, constant power.
- Neutron Source component that improves reactor startup or cold operation.
- Advanced nuclear-machine controllers.
- High-tier scientific or energy components.
- Optional MOX fuel in a later expansion.

This makes reprocessing valuable without invalidating the two-fuel design.

### Deferred: Waste Stabilization

High-Level Nuclear Waste should be a fluid produced by reprocessing. It cannot be placed directly in the world or discarded through ordinary fluid outputs.

~~~text
High-Level Nuclear Waste + Glass / Stabilized Obsidian Dust
→ Reaction Chamber or Waste Vitrifier
→ Vitrified Nuclear Waste
~~~

Vitrified Nuclear Waste is a solid item that may eventually be placed in dedicated waste storage:

~~~text
Steel Case + Lead Plates + Reinforced Material
→ Future Waste Container
~~~

Dedicated waste containment is deferred. Under the current radiation rule, handling or destroying stored waste does not create radiation; only a Nuclear Reactor meltdown does.

## Radiation and Meltdown

Radiation is an accident mechanic rather than a constant inventory or waste-handling simulation.

- A valid reactor contains all radiation.
- Breaking a casing or internal component immediately deactivates the multiblock, preserves controller storage, and does not create radiation.
- A controller containing fuel or waste should not be manually breakable, preventing stored data from being deleted.
- Spent Uranium Pellets do not irradiate players while held, dropped, transported, or stored.
- Depleted UF6 does not create a radiation zone during ordinary machine operation or storage.
- Only a reactor meltdown creates a temporary radiation source and contaminated area.

Proposed accident scale:

~~~text
Exposed Material =
Stored Spent Uranium Pellets
+ ceil(Remaining FU / 250)

Radiation Radius =
clamp(6 + floor(sqrt(Exposed Material) × 2), 8, 24) blocks
~~~

The exact radius, duration, and player effects remain balance values. A small meltdown should persist for roughly five minutes, while a severe fuel-loaded meltdown may persist for up to twenty minutes. Radiation exposure may escalate through Nausea, Weakness, Mining Fatigue, Poison, and Wither.

## Hazmat Suit and Rubber

The Hazmat Suit exists to protect players who enter a radiation zone after a meltdown. It does not protect against the explosion itself, fire, or extreme reactor temperature.

- The armor set contains a helmet, chestplate, leggings, and boots.
- Radiation protection requires the complete set.
- Latex is not added because it would require a separate extraction and fluid-processing chain.
- Rubber Sheet is the finished reusable material for the suit, cable insulation, machine seals, and future gas equipment.

Initial simplified material route:

~~~text
Slimeballs + Sulfur Spike
→ Rubber Sheets
~~~

The exact ingredient ratio and whether this uses crafting or a machine remain to be balanced.

## Planned Interface

- Status.
- Power setpoint.
- Temperature.
- Efficiency.
- On Time.
- Producing.
- Energy stored and capacity.
- Fuel type.
- Fuel stored and capacity.
- Coolant type.
- Coolant stored and capacity.
- Moderation effect.
- Waste storage when implemented.

The fuel input remains beside the visual uranium bar. The bar represents internal FU rather than the number of items in the slot.

## Items

### Keep or Reuse

- Raw Uranium.
- Uranium Dust.
- Uranium Ingot.
- Uranium Pellet.
- Enriched Uranium Pellet.
- Uranium Rod, displayed as Uranium Fuel Rod if its existing identifier is preserved.
- Enriched Uranium Rod.

### Add in the Current Scope

- Lead Ore.
- Deepslate Lead Ore.
- Lead Chunk.
- Deepslate Lead Chunk.
- Raw Lead.
- Raw Lead Block.
- Lead Dust.
- Lead Ingot.
- Lead Nugget.
- Lead Plate.
- Lead Block.
- Yellowcake (Uranium Concentrate).
- Enriched Uranium Oxide.
- Fluorite Crystal.
- Fluorite Dust.
- High-Speed Rotor.
- Spent Uranium Pellet.
- Rubber Sheet.
- Hazmat Helmet.
- Hazmat Chestplate.
- Hazmat Leggings.
- Hazmat Boots.

### Deferred Items

- Lead-Lined Gas Tank or another compatible generic gas-storage block.
- Shielded Waste Barrel or another dedicated waste container.
- Recovered Uranium.
- Depleted Uranium Dioxide.
- Plutonium Compound.
- Steel Scrap.
- Vitrified Nuclear Waste.

### Planned Gases and Liquids

- Fluorine Gas.
- Hydrogen Gas.
- Oxygen Gas.
- Hydrogen Fluoride Gas.
- Natural Uranium Hexafluoride Gas.
- Enriched Uranium Hexafluoride Gas.
- Depleted Uranium Hexafluoride Gas.
- Sulfuric Acid.
- Heavy Water.

### Deferred Fluids and Gases

- High-Level Nuclear Waste.

## Machines

### Existing Machines to Reuse

- Crusher.
- Incinerator.
- Electro Press.
- Reaction Chamber.
- UtilityCraft Crafter or Crafting Table.

### New Machines

- Electrolyzer: produces and separates gases.
- Isotope Centrifuge: separates Natural UF6.

### Possible Expansions

- Fuel Reprocessor: separates useful material from spent uranium and produces High-Level Nuclear Waste.
- Waste Vitrifier if the Reaction Chamber should not stabilize liquid waste.
- Moderator Assembly slot.
- MOX Fuel.

## Process Complexity

The counts below describe distinct transformations, not the number of machine blocks that must be built. The same Reaction Chamber, Electrolyzer, Crusher, and Electro Press may be reused for multiple recipes.

| Fuel route | From Raw Uranium | Full route from Sieve resources | Machine types |
|---|---:|---:|---:|
| Uranium Rod | 4 transformations | About 7 stages | 4 including Sieve |
| Enriched Uranium Rod | 7 direct fuel transformations | About 18 stages including supporting chemistry | 6 including Sieve |

The basic route uses the Sieve, Crusher, Incinerator, and Electro Press, followed by ordinary crafting. It is a single linear production chain.

The enriched route uses the Sieve, Crusher, Electrolyzer, Reaction Chamber, Isotope Centrifuge, and Electro Press, followed by ordinary crafting. Its complete startup chain combines three branches:

1. Uranium recovery and concentration.
2. Sulfur Spike, Oxygen, and Sulfuric Acid production.
3. Fluorite, Hydrogen Fluoride, Fluorine, and Hydrogen production.

Hydrogen Fluoride recovered from enriched UF6 conversion returns to the Electrolyzer, reducing later Fluorite consumption. One machine of each type can run the chain sequentially; additional Reaction Chambers and Electrolyzers only improve continuous throughput.

## Proposed Implementation Order

### Phase 1 — Lead and Nuclear Construction

- Add Lead Chunk and Deepslate Lead Chunk to the Sieve at a proposed 4% base chance with a Golden-tier Mesh or better.
- Reconstruct Lead Ore and Deepslate Lead Ore from four matching chunks.
- Add Lead Ore and its standard material-processing chain.
- Add Lead Plates.
- Update reactor components and nuclear-machine recipes to use Lead.
- Keep the existing Netherite casing family as the Nuclear Reactor shell.

### Phase 2 — Two Fuels

- Register the Uranium Fuel Rod.
- Add FU, burn-rate, and efficiency values to each fuel profile.
- Lock the reactor to its active fuel while stored FU remains.
- Leave mismatched rods in the input slot and switch automatically when stored FU reaches zero.
- Keep waste generic and coolant behavior shared between fuels.
- Press Uranium Ingots into the existing Uranium Pellets and craft them with Steel Plates into the existing Uranium Rod.

### Phase 3 — Coolants

- Define Saline Coolant and Heavy Water.
- Add cooling and moderation multipliers.
- Reject normal water.
- Display coolant effects in the interface.

### Phase 4 — Fluorine Industry

- Add Fluorite Crystal directly to Crushed Cobbled Deepslate filtering at a proposed 1.5% base chance with an Emerald-tier Mesh or better.
- Crush Fluorite Crystals into Fluorite Dust; do not add Fluorite Ore or world generation.
- Add the Electrolyzer.
- Register Hydrogen, Oxygen, Hydrogen Fluoride, and Fluorine.
- Implement Sulfuric Acid.

### Phase 5 — Enrichment

- Register natural, enriched, and depleted UF6 as gas types.
- Implement the single-block Isotope Centrifuge.
- Add the reusable High-Speed Rotor.
- Implement enriched UF6 conversion into Enriched Uranium Oxide and press it into the existing Enriched Uranium Pellet.
- Enable the centrifuge recipe and complete the Enriched Uranium Rod route after compatible generic storage can extract Depleted UF6.

### Phase 6 — Waste

- Generate one Spent Uranium Pellet for every 250 FU burned.
- Add a stack-sized waste buffer and Item Port output.
- Allow ordinary item storage because spent pellets do not emit radiation during routine handling.

### Phase 7 — Meltdown Protection

- Create radiation zones only when a Nuclear Reactor melts down.
- Prevent manual destruction of a controller that still contains fuel or waste.
- Add Rubber Sheets without adding Latex.
- Add the four-piece Hazmat Suit and require the full set for meltdown-radiation protection.

### Deferred Phase — Gas and Waste Storage

- Add compatible generic gas storage before enabling Depleted UF6 output.
- Evaluate dedicated Lead-Lined Gas Tanks and Shielded Waste Barrels later; they are not required in the current scope.
- Add a productive Depleted UF6 route only when its downstream materials have defined uses.

### Deferred Phase — Reprocessing

- Implement the Fuel Reprocessor.
- Add Plutonium Compound, Recovered Uranium, and High-Level Nuclear Waste.
- Add waste vitrification.
- Add functional uses for Depleted Uranium.
- Evaluate an RTG, Neutron Source component, and MOX as optional expansions.

## Open Questions

- Will the proposed 4% Lead Chunk and 1.5% Fluorite Crystal base Sieve chances remain after balance testing?
- Which compatible generic gas-storage solution will unlock Depleted UF6 output?
- Will the centrifuge ratio remain 25/75?
- How much total energy should one Enriched Uranium Rod cost to manufacture?
- What percentage of fluorine should be recoverable?
- Will Heavy Water have a different consumption rate from Saline Coolant?
- Should Spent Uranium Pellets compact into a larger spent-fuel item or block for storage?
- How large should the reactor's internal waste buffer be?
- What exact recipe and output count should produce Rubber Sheets?
- How much radiation protection and durability should the Hazmat Suit provide?
- What duration and status-effect thresholds should meltdown radiation use?
- Will High-Level Nuclear Waste use the Reaction Chamber or a dedicated Waste Vitrifier?
- Should the Fuel Reprocessor produce Radioactive Off-Gas, or should gases remain exclusive to accidents and leaks?
- Will the direct Raw Uranium and Uranium Ore furnace recipes be removed?

## Technical References

- U.S. NRC — Radiation Protection and Shielding: https://www.nrc.gov/about-nrc/radiation/protects-you/protection-principles
- U.S. NRC — Uranium Conversion: https://www.nrc.gov/materials/fuel-cycle-fac/ur-conversion
- U.S. NRC — Uranium Enrichment: https://www.nrc.gov/materials/fuel-cycle-fac/ur-enrichment
- U.S. NRC — Fuel Fabrication: https://www.nrc.gov/materials/fuel-cycle-fac/fuel-fab
- U.S. NRC — Deconversion of Depleted Uranium: https://www.nrc.gov/materials/fuel-cycle-fac/ur-deconversion
- U.S. NRC — Radiation Shielding Principles: https://www.nrc.gov/about-nrc/radiation/protects-you/protection-principles
