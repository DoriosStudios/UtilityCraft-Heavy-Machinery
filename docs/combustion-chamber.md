# Combustion Chamber

A bronze multiblock generator using UtilityCraft's live Furnator fuel registry.

- Controller: utilitycraft:combustion_chamber_controller.
- Build a closed bronze casing with at least one Energy Cell inside, one empty interior block, and one roof vent. Other interior components are rejected.
- Activate with a wrench. Supply slot 21 through Item Ports/Item Pipes and export energy through Energy Ports.
- Every empty interior block permits 128 BU/t. Energy Cells provide storage and occupy chamber space.
- One BU represents one DE of the Furnator's original fuel value. The chamber converts each BU to 1.25 DE; default coal yields 10,000 DE.
- Control accepts a burn rate up to the structure maximum. Power starts/stops generation; full energy storage pauses burning.
- Items are consumed in bulk as needed from the input stack. The unused value of the last item persists in hm:combustionChamber, including fractional BU.
- General, Fuel, Control and Info reuse the established HM UI. Only Fuel shows player inventory.
- Smoke and sparse flame particles use the machine update, with no additional interval or visual entity.

## Runtime and registry

HeavyCore caches plain data by controller entity ID. Persistent state and structural stats load on first use and survive cache loss. Rescanning refreshes stats without discarding burn reserve. Changes inside the structure require a new scan.

UC starts with an empty solid-fuel list and queues its defaults through DoriosLib.registry.registerFuel. UC and HM both listen to utilitycraft:register_fuel, preserving the same ordered wildcard/substring lookup and add-or-replace behavior for custom registrations. There are no query or snapshot events and HM contains no duplicate default list. Export the updated UC behavior pack as well as HM so the default fuels are broadcast.

## Texture layout

The provided 32x32 atlas was split without resampling into four 16x16 sprites: top/bottom on the upper row, front/side on the lower row.

## Validation

Run node --test tests/combustion-chamber.cjs for registry synchronization, fuel accounting, scheduler batching, activation, persistence, controls and asset wiring. In-game validation is still required for native UI and particles.
