# Nuclear Reactor — Design and Planning

This is the living design document for the Nuclear Reactor and its fuel cycle. Values marked as **proposed** must be tested and balanced before they are considered final.

## Current Decisions

### Confirmed

- The Nuclear Reactor is a Netherite-casing multiblock.
- The Isotope Centrifuge is a single-block machine.
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
- The existing Reaction Chamber multiblock keeps its current slots, liquid tanks, and item/liquid recipe format; it will not gain gas storage.
- A much slower single-block Reaction Chamber will share the multiblock's recipe hashmap and base recipe costs, with one item input, one liquid input, one item output, and one liquid output.
- The small Reaction Chamber serves compact, low-volume chemical lines; the multiblock remains the industrial option for batch processing and large coolant demand.
- Chemical Converter and Chemical Processor are implemented single-block machines with four visible resource stores each and initial balance values.
- Chemical Converter accepts one item type, one liquid, and one gas, and outputs one gas. Unused recipe inputs stay empty.
- Chemical Processor accepts one gas and one liquid, and outputs one item type and one gas.
- Sulfuric Acid is a liquid. Hydrogen Fluoride remains a gas; no liquid HF variant is planned.
- The Electrolyzer retains both inputs: liquid for Water electrolysis and gas for HF electrolysis, without requiring both simultaneously.
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
- Depleted Uranium Hexafluoride is produced by the Isotope Centrifuge and can be extracted into existing UtilityCraft gas tanks.
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

Saline Coolant is currently the only registered coolant and has a cooling efficiency of 1.0. Pellet and rod fabrication and the gas-processing chain are implemented. Reactor support for basic fuel and spent-fuel generation remain planned. Hydrogen, Oxygen, and Fluorine can now be produced by the Electrolyzer, and Heavy Water by the Reaction Chamber; Heavy Water coolant effects are not yet registered.

Complete 49-frame internal UI bar sets now exist for Sulfuric Acid, Heavy Water, Hydrogen, Oxygen, Fluorine, Hydrogen Fluoride, Natural UF6, Enriched UF6, and Depleted UF6. Hydrogen, Oxygen, and Fluorine have functional Electrolyzer outputs, and Hydrogen Fluoride is accepted as a gaseous input. All four gases support existing UtilityCraft gas tanks. Heavy Water has a Reaction Chamber recipe and support in existing liquid tanks. Natural, Enriched, and Depleted UF6 also have functional centrifuge storage and support in existing gas tanks. Sulfuric Acid has shared Reaction Chamber production, visible UI bars, and standard liquid-tank support.

The Isotope Centrifuge is functional as a single-block gas machine. Its crafting recipe uses a High-Speed Rotor, and the machine separates Natural UF6 into Enriched and Depleted UF6. Its three visible gas tanks, standard I/O, Speed/Energy upgrades, and existing UtilityCraft tank support are implemented. The small Reaction Chamber, Chemical Converter, and Chemical Processor implement upstream UF6 production and downstream oxide/HF recovery. Pellet pressing and rod crafting complete fabrication. Existing machine layouts are preserved.

### Electrolyzer — First Functional Version

- A normal single-block Machine using the standard UtilityCraft helper entity.
- Exactly four resource stores, all displayed: one 64,000 mB liquid input, one 32,000 mB gas input, and two 32,000 mB gas outputs.
- Storage types are unrestricted and clear naturally when empty. There are no alternate hidden reservoirs or machine-specific persistence.
- Recipes use an `electrolyzerRecipes` object keyed by `liquidType|gasType`, with `empty` for an unused input and `required_liquid`, `required_gas`, `output1`, `output2`, and `cost` fields.
- `water|empty`: 1,000 mB Water → 1,000 mB Hydrogen + 500 mB Oxygen, costing 512,000 DE.
- `empty|hydrogen_fluoride_gas`: 1,000 mB Hydrogen Fluoride → 400 mB Hydrogen + 400 mB Fluorine, costing 1,024,000 DE. The unused input must be empty.
- The block sets a base processing rate of 2,560 DE/t; the recipe carries no independent duration or process name.
- Processing starts automatically after checking the input and both output types/capacities. It preserves progress if energy runs out or an output fills.
- The standard I/O panel configures six relative faces in Default → custom liquid input/drain or gas input/output 1/2/input drain → Disabled order. Default allows passive access to the declared tanks, custom modes enable automatic transfers, and Disabled blocks that face. Existing UtilityCraft gas tanks can store both gases.
- The interface contains the four resource bars, energy, progress, standard machine status, and Information, I/O, and Upgrades tabs. It has no material slots or process selector.
- Two standard upgrade slots accept Speed and Energy upgrades. Processing uses Machine's shared speed and consumption boosts and completes multiple batches when input and output capacities permit.
- The block crafting recipe and upstream HF production are deferred.

### Heavy Water — Reaction Chamber

- `empty|water`: 8,000 mB Water → 1,000 mB Heavy Water, with no item input and a base recipe cost of 4,096,000 DE.
- Batch size is bounded by input liquid as well as processing modules and output space; this also fixes the existing Saline Coolant recipe.
- Heavy Water can be extracted into standard UtilityCraft liquid tanks. Its reactor cooling/moderation integration remains deferred.

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
                  └─ Chemical Converter + Fluorine Gas
                     └─ Natural Uranium Hexafluoride Gas
                        └─ Isotope Centrifuge
                           ├─ Enriched Uranium Hexafluoride Gas
                           └─ Depleted Uranium Hexafluoride Gas
~~~

Conversion and fabrication:

~~~text
Enriched Uranium Hexafluoride Gas
└─ Chemical Processor + Water
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
            └─ Chemical Converter + Sulfuric Acid
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
            └─ Reaction Chamber + Water
               └─ Sulfuric Acid
~~~

Crushed Blackstone currently has a 12% chance to produce one minecraft:sulfur_spike with a tier-2 Copper mesh. The existing Electro Press recipe combines four spikes into one minecraft:sulfur block.

The nuclear chemical chain consumes Sulfur Spikes directly. They do not need to be crushed or pressed. The existing Sulfur block recipe remains available for its other uses but is not part of this process.

Initial proposed batch:

~~~text
4 Sulfur Spikes + Water
→ Reaction Chamber
→ 1,000 mB Sulfuric Acid
~~~

Sulfuric Acid is stored and transported as a liquid. The recipe abstracts oxidation using ambient air; it does not consume piped Oxygen Gas or introduce hidden oxygen storage. The initial batch consumes four spikes and 1,000 mB Water for 1,000 mB Sulfuric Acid at 256,000 DE. Balance remains adjustable.

Both sizes of Reaction Chamber will offer this same recipe. The slow single-block version is suitable for a dedicated acid line. High-volume coolant production is the main reason to scale up to a multiblock.

### Fluorine Recovery

~~~text
Enriched UF6
└─ Chemical Processor + Water
   ├─ Enriched Uranium Oxide
   └─ Hydrogen Fluoride Gas
      └─ Electrolyzer
         └─ Reusable Fluorine Gas
~~~

Initial implemented recovery is 80%: 400 mB Fluorine produces 1,000 mB Natural UF6; its 250 mB enriched fraction produces 800 mB HF, equivalent to 320 mB Fluorine after electrolysis. Multiple recovery batches accumulate before the existing 1,000 mB HF electrolysis batch can run. Fluorite starts the line and compensates for losses.

## Chemical Machines - First Functional Version

These three new single-block machines complete the chain without changing the existing Reaction Chamber multiblock, Electrolyzer, or Isotope Centrifuge layouts. All three have registered blocks, temporary 16x16 textures, Workbench/Crafter recipes, and standard helper-entity inventories. Initial values remain subject to balancing.

| Machine | Material inputs | Material outputs | Role |
|---|---|---|---|
| Single-block Reaction Chamber | 1 item slot + 1 liquid bar | 1 item slot + 1 liquid bar | Slow, compact liquid chemistry |
| Chemical Converter | 1 item slot + 1 liquid bar + 1 gas bar | 1 gas bar | Convert solid reactants into process gases |
| Chemical Processor | 1 gas bar + 1 liquid bar | 1 item slot + 1 gas bar | Recover solid material and reusable gas |

Each new machine has exactly four visible material stores. Energy and the standard Speed/Energy upgrade slots are separate from those material stores. Use the established single-block Machine behavior, energy/progress displays, Information, I/O, and Upgrades panels. No hidden resource tanks, catalyst slots, or rotor requirements are planned. Tank types clear naturally when emptied.

### Reaction Chamber — Two Production Scales

- Keep the existing multiblock unchanged: four item input slots and four item output slots provide bulk storage, while recipes use one input item type and one output item type, plus one liquid input and one liquid output.
- The small machine exposes one slot for each item side and the same two liquid directions. It does not accept gases or multiple distinct item ingredients in one recipe.
- Both machines use the same reactionRecipes hashmap keyed by itemId|liquidType, including empty for an unused input, and the existing required_items, required_liquid, output_item, output_liquid, and cost fields.
- Both sizes use the same recipe quantities and base recipe cost. Different processing rates, capacities, upgrades, and multiblock batch processing determine throughput; do not create cheaper duplicate recipes for the small version.
- The small chamber runs at 160 DE/t versus the multiblock base of 1,600 DE/t, before multiblock batching and upgrades. Standard Speed/Energy upgrades remain available.
- Both sizes offer Sulfuric Acid, Yellowcake, Heavy Water, and Saline Coolant recipes. All four recipes are implemented through the shared registry.
- One small chamber may be reused in stages. Dedicated small acid and Yellowcake lines avoid requiring two multiblocks just to start nuclear chemistry.

### Recipe Routing

The routes below are implemented. The following balance table records initial quantities and costs.

| Machine | Inputs | Outputs | Status |
|---|---|---|---|
| Reaction Chamber, either size | Sulfur Spike + Water | Sulfuric Acid (liquid) | Implemented |
| Reaction Chamber, either size | Uranium Dust + Sulfuric Acid | Yellowcake | Implemented |
| Chemical Converter | Fluorite Dust + Sulfuric Acid; gas input empty | Hydrogen Fluoride Gas | Implemented |
| Chemical Converter | Yellowcake + Fluorine Gas; liquid input empty | Natural UF6 Gas | Implemented |
| Electrolyzer | Water; gas input empty | Hydrogen Gas + Oxygen Gas | Implemented |
| Electrolyzer | HF Gas; liquid input empty | Hydrogen Gas + Fluorine Gas | Implemented |
| Isotope Centrifuge | Natural UF6 Gas | Enriched UF6 Gas + Depleted UF6 Gas | Implemented |
| Chemical Processor | Enriched UF6 Gas + Water | Enriched Uranium Oxide + HF Gas | Implemented |
| Electro Press | Enriched Uranium Oxide | Enriched Uranium Pellet | Implemented |
| Crafting / Crafter | Enriched Uranium Pellets + Steel Plates | Enriched Uranium Rod | Implemented |

The Converter's gas input is necessary for Yellowcake + Fluorine; an item/liquid-only design cannot perform that recipe. The Processor's two inputs and two outputs close the gas-to-solid route while recovering HF for the Electrolyzer. Do not add a productive Depleted UF6 recipe until its solid product has a defined gameplay use.

### Initial Chemistry Balance

Values are initial gameplay balance. Yellowcake uses the existing utilitycraft:uranium_concentrate item. Chamber quantities and base costs are shared between both machine sizes.

| Machine / recipe | Required inputs | Products | Base cost |
|---|---|---|---:|
| Reaction Chamber: acid | 4 Sulfur Spikes + 1,000 mB Water | 1,000 mB Sulfuric Acid | 256 kDE |
| Reaction Chamber: concentrate | 1 Uranium Dust + 250 mB Sulfuric Acid | 1 Uranium Concentrate | 512 kDE |
| Chemical Converter: HF | 1 Fluorite Dust + 250 mB Sulfuric Acid | 1,000 mB HF | 512 kDE |
| Chemical Converter: UF6 | 1 Uranium Concentrate + 400 mB Fluorine | 1,000 mB Natural UF6 | 2.048 MDE |
| Chemical Processor | 250 mB Enriched UF6 + 1,000 mB Water | 1 Enriched Uranium Oxide + 800 mB HF | 1.024 MDE |

| Machine | Base rate | Energy capacity | Each material tank | Upgrades |
|---|---:|---:|---:|---|
| Small Reaction Chamber | 160 DE/t | 4.096 MDE | 32,000 mB | Speed, Energy |
| Chemical Converter | 2,560 DE/t | 8.192 MDE | 32,000 mB | Speed, Energy |
| Chemical Processor | 5,120 DE/t | 8.192 MDE | 32,000 mB | Speed, Energy |

At base rate, acid takes 80 seconds in the small chamber versus 8 seconds per multiblock processing cycle before batch scaling. Heavy Water takes 1,280 seconds in the small chamber, motivating industrial coolant production in the multiblock. Existing multiblock batching semantics are unchanged.

Each new machine has one runtime script. UI slots 0-2 hold energy, label, and progress; material slots are 3-6; upgrades are 7-8. Item I/O uses 9-14, liquid I/O 15-20, and gas I/O 21-26 where present. The small chamber has 21 inventory slots; Converter and Processor have 27.

Uranium Ingots now press into Uranium Pellets instead of directly into rods. Enriched Uranium Oxide presses into Enriched Uranium Pellets. Four matching pellets plus two Steel Plates craft the respective rod through the Crafting Table, Workbench, or Crafter. Reactor fuel profiles remain separate work; the reactor still accepts only the enriched rod.

### Recipe and Runtime Conventions

- One runtime script per new machine, plus its recipe configuration; no separate storage-configuration script or machine-specific persistent resource state.
- Recipes remain exported objects with direct hashmap lookup, not arrays or process selectors. No per-recipe names or ticks; cost and the machine's processing rate determine duration.
- Converter lookup: itemId|liquidType|gasType. Processor lookup: gasType|liquidType. Use empty for unused inputs and require those stores to be empty.
- Use the established required_items, required_liquid, required_gas, cost, and typed output conventions. Converter recipes use output_gas; Processor recipes use output_item and output_gas. The Reaction Chamber keeps its existing schema.
- Validate required inputs, output types, and complete output capacity before consuming a batch. Both Processor products must fit; never silently discard its recovered gas.
- Preserve generic I/O labels, Default first and Disabled last, and expose only the stores shown in the machine UI.

### Gameplay Chemistry Boundary

These recipes deliberately summarize industrial treatment rather than reproduce every reaction. Sulfuric Acid abstracts oxidation from ambient air; Uranium Dust to Yellowcake summarizes purification; Yellowcake to UF6 summarizes fluorination. Enriched UF6 plus water to oxide and HF summarizes the complete conversion treatment, including the omitted hydrogen-reduction/intermediate stages. Water alone is not a literal complete chemical route to the final oxide. There is no hidden hydrogen tank or consumption.

Mekanism's Chemical Crystallizer is a role reference for recovering solids from chemicals, not the source of HM's specific UF6 recipe. The Processor also recovers gas, which is why it is treated as a processing machine rather than simple crystallization.

## Isotope Centrifuge

The Isotope Centrifuge is a single-block machine.

### Storage

- One 32,000 mB input tank for Natural Uranium Hexafluoride Gas.
- One 32,000 mB output tank for Enriched Uranium Hexafluoride Gas.
- One 32,000 mB output tank for Depleted Uranium Hexafluoride Gas.
- Internal energy storage: 65,536,000 DE.
- No item input or component slot; the High-Speed Rotor is a crafting ingredient only.

### Implemented Operation

~~~text
1,000 units of Natural UF6
→ Isotope Centrifuge
→ 250 units of Enriched UF6
  + 750 units of Depleted UF6
~~~

This ratio is compressed for gameplay. The real process creates substantially more depleted material than enriched material.

| Property | Initial value |
|---|---:|
| Base rate | 20,480 DE/t (40 seconds per batch without upgrades) |
| Energy per batch | 16.384 MDE |
| Coolant | None |
| Crafting component | High-Speed Rotor (no operating item requirement) |

The High-Speed Rotor may reuse Netherite Plates and Heat Conductors. It is a generic high-speed rotating component that can later be reused by turbines, compressors, and pumps. It is consumed when crafting the centrifuge and is not inserted into its interface.

The machine stops if either output tank cannot fit a complete batch or contains an incompatible gas. Depleted gas is never discarded automatically. All three gases can be extracted into existing UtilityCraft gas tanks. Progress is retained while energy is missing or output space is insufficient.

Recipes use an `isotopeCentrifugeRecipes` object keyed by gas type, with `required_gas`, `output1`, `output2`, and `cost`. The High-Speed Rotor is used only in the machine crafting recipe, not in the processing key. There are no per-recipe names, durations, or arrays.

The interface has three gas bars, centered progress, and the Ultimate Crusher energy position. Its gas I/O modes are Default → Input → Output 1 → Output 2 → Drain Input → Disabled. Speed and Energy upgrades use the standard Machine system. Upgrade slots are excluded from item automation.

The UtilityCraft Workbench crafting recipe uses one High-Speed Rotor, one Machine Case, two Lead Plates, two Expert Chips, two Netherite Plates, and one Energy Cell. The same recipe is registered with the Crafter.

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
- Dedicated tanks are deferred; existing UtilityCraft gas tanks support its external storage.
- The centrifuge recipe is enabled with generic gas-tank extraction support.
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

The design contains two waste outputs; centrifuge gas waste is implemented and reactor item waste remains planned:

| Stage | Material | State | Reason |
|---|---|---|---|
| Reactor output | Spent Uranium Pellet | Item | Planned; generated proportionally from burned FU |
| Enrichment output | Depleted Uranium Hexafluoride | Gas | Implemented with generic gas-tank storage |

The Nuclear Reactor does not directly produce liquid or gaseous waste during normal operation. It outputs generic solid spent uranium. The Isotope Centrifuge separately outputs depleted UF6 gas into compatible existing gas storage.

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
- Sulfuric Acid (liquid).
- Heavy Water (liquid).

### Deferred Fluids and Gases

- High-Level Nuclear Waste.

## Machines

### Existing Machines to Reuse

- Crusher.
- Incinerator.
- Electro Press.
- Reaction Chamber multiblock, preserving its existing item/liquid interface.
- UtilityCraft Crafter or Crafting Table.

### New Machines

- Electrolyzer (implemented): retains liquid and gas inputs and two gas outputs.
- Isotope Centrifuge (implemented): separates Natural UF6 into enriched and depleted gases.
- Single-block Reaction Chamber (implemented): much slower compact counterpart sharing the multiblock recipes and base costs.
- Chemical Converter (implemented): item + liquid + gas inputs, one gas output; produces HF and Natural UF6.
- Chemical Processor (implemented): gas + liquid inputs, item + gas outputs; recovers enriched oxide and HF.

### Possible Expansions

- Fuel Reprocessor: separates useful material from spent uranium and produces High-Level Nuclear Waste.
- Waste Vitrifier if the Reaction Chamber should not stabilize liquid waste.
- Moderator Assembly slot.
- MOX Fuel.

## Process Complexity

Machine types describe distinct functions, not the number of blocks that must be built. Either Reaction Chamber size provides the same chemistry function.

| Fuel route | Machine types, including Sieve and excluding crafting | Production scale |
|---|---|---|
| Uranium Rod | 4: Sieve, Crusher, Incinerator, Electro Press | Basic solid-material route |
| Enriched Uranium Rod | 8: Sieve, Crusher, Reaction Chamber, Chemical Converter, Electrolyzer, Isotope Centrifuge, Chemical Processor, Electro Press | Chemical processing and HF recycling |

The enriched route combines Uranium purification, Sulfur Spike and liquid acid production, and Fluorite-to-HF-to-Fluorine production. Oxygen is no longer a required piped input for acid; Hydrogen is no longer a required piped input for UF6 treatment in the simplified gameplay recipes. Both gases remain Electrolyzer products.

Recovered HF returns from the Chemical Processor to the Electrolyzer. One machine of each type can be reused sequentially; separate small Reaction Chambers for acid and Yellowcake, and separate Converters for HF and UF6, support continuous production without requiring multiple multiblocks. High coolant demand and bulk processing motivate upgrading to the Reaction Chamber multiblock.

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

### Chemistry Milestone - Implemented, Balance Follow-up

1. Implement the slow single-block Reaction Chamber using the existing recipe hashmap, preserving the multiblock layout.
2. Define liquid Sulfuric Acid storage support and shared acid/Yellowcake recipes.
3. Implement Chemical Converter and its HF/Natural UF6 recipes.
4. Implement Chemical Processor, oxide recovery, and HF recycling; finish pellet and rod fabrication.
5. Balance new quantities, costs, capacities, crafting recipes, and small-chamber throughput versus multiblock batches and coolant demand.

Steps 1-4 above are implemented with initial values; step 5 remains ongoing balance work. The broader phases also include the completed Electrolyzer, centrifuge, and generic UF6 storage.

### Phase 4 — Fluorine Industry

- Add Fluorite Crystal directly to Crushed Cobbled Deepslate filtering at a proposed 1.5% base chance with an Emerald-tier Mesh or better.
- Crush Fluorite Crystals into Fluorite Dust; do not add Fluorite Ore or world generation.
- Preserve the implemented Electrolyzer layout, Water/HF recipes, and registered gas support.
- Implement the slow single-block Reaction Chamber with shared recipes and standard upgrades.
- Add liquid Sulfuric Acid from Sulfur Spikes + Water to both chamber sizes.
- Implement Chemical Converter: Fluorite Dust + Sulfuric Acid to HF Gas.

### Phase 5 — Enrichment

- Reuse the implemented UF6 gas types, generic tank support, and Isotope Centrifuge.
- Keep the High-Speed Rotor in the centrifuge crafting recipe only.
- Add Uranium Dust + Sulfuric Acid to Yellowcake in the shared Reaction Chamber registry.
- Add Yellowcake + Fluorine Gas to Natural UF6 in the Chemical Converter.
- Add Enriched UF6 + Water to Enriched Uranium Oxide + HF Gas in the Chemical Processor.
- Press oxide into Enriched Uranium Pellets and complete rod crafting.
- Balance HF recovery against existing centrifuge and Electrolyzer yields; preserve mandatory Depleted UF6 extraction.

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

- Generic gas storage and Depleted UF6 output are implemented; dedicated storage remains deferred.
- Evaluate dedicated Lead-Lined Gas Tanks and Shielded Waste Barrels later; they are not required in the current scope.
- Add a productive Depleted UF6 route only when its downstream materials have defined uses.

### Deferred Phase — Reprocessing

- Implement the Fuel Reprocessor.
- Add Plutonium Compound, Recovered Uranium, and High-Level Nuclear Waste.
- Add waste vitrification.
- Add functional uses for Depleted Uranium.
- Evaluate an RTG, Neutron Source component, and MOX as optional expansions.

## Open Questions

- What base rate and capacities keep the small Reaction Chamber much slower than industrial multiblock production, including upgrades?
- What quantities, energy costs, capacities, and crafting recipes should the new chemistry machines use?

- Will the proposed 4% Lead Chunk and 1.5% Fluorite Crystal base Sieve chances remain after balance testing?
- Existing UtilityCraft gas tanks now support Depleted UF6; should dedicated storage be added later?
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

- Mekanism — Chemical Crystallizer (machine-role reference): https://wiki.aidancbrady.com/wiki/Chemical_Crystallizer
- World Nuclear Association — Fuel Fabrication (conversion stages summarized for gameplay): https://world-nuclear.org/information-library/Nuclear-Fuel-Cycle/Conversion-Enrichment-and-Fabrication/Fuel-Fabrication
- U.S. EPA — Sulfuric Acid Supply Chain Profile: https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P1017QFW.txt
