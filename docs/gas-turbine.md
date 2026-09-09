# Gas Turbine

Bronze multiblock generator, independent of reactor temperature logic. No DoriosCore or DoriosLib changes.

## Build and use

1. Build a closed bronze casing at least **5 x 4 x 5** (X, Y, Z), including the Gas Turbine controller, a Gas Port and an Energy Port. Glass of the bronze tier can reveal the rotor.
2. Put at least one **Energy Cell** in an interior corner. The remaining interior must be air; neither Gas Cells nor rotor components are required. Keep the central cylindrical rotor space clear from floor to ceiling.
3. Activate the controller with a wrench. A vertical shaft and two opposing curved blades appear automatically, sized to the interior. The formed turbine starts switched off.
4. Supply Steam, Hydrogen or Methane through a Gas Port configured as Gas Intake. Set a rate in Control and press the fixed Power button. Export energy through Energy Ports.
5. Use the Drain Gas output on a Gas Port to empty the tank before switching gases. A changed structure requires a new scan.

At minimum size, the interior contains 18 blocks. With one Energy Cell and 17 empty blocks it holds **1,088 B** of gas and supports **4.5 mB/t**. Each Energy Cell supplies the existing shared capacity of 4,000,000 DE.

## Initial balance

- Each empty interior block: 64,000 mB gas capacity.
- Each interior block (including Energy Cells): 0.25 mB/t maximum consumption.
- Gas balance lives in the `TURBINE_GASES` constant at the top of `BP/scripts/machinery/generators/gasTurbineSimulation.js`. Add a GasStorage type ID with `name`, `energy` (DE/mB) and `speedMultiplier` (0-4). Unsupported gases are not consumed.
- Initial values: Steam = 256 DE/mB, 1x speed; Hydrogen = 1,536 DE/mB, 0.5x speed; Methane = 4,096 DE/mB, 1.25x speed. Steam is a new starting balance; Hydrogen/Methane retain the existing UtilityCraft energy values.
- At full startup speed, 1x means 120 RPM. The multiplier changes rotor RPM, not the configured intake in mB/t or energy per mB. A larger structure increases maximum throughput. This is an abstract gas-flow generator: no combustion or pressure model is simulated.
- Rotor speed approaches its working speed with a 40-tick time constant. Actual consumption ramps up with speed.
- On shutdown, empty fuel, zero rate or full energy storage, conversion stops and the rotor coasts down. It does not generate free energy while coasting.
- Gas consumption is in whole mB with fractional intake progress retained between updates. A conversion only occurs when the full resulting energy fits in the buffer.
- No coolant, heat, pressure, gas cells or waste output.

## Integration

Controller: utilitycraft:gas_turbine_controller. Container: utilitycraft:gas_turbine. Visual entity: utilitycraft:gas_turbine_rotor.

The controller uses existing MultiblockGenerator, GasStorage, EnergyStorage, Link Node IO and InterfaceManager APIs. UI slots: energy 0, operation 1, gas 2, rotor speed 4, Power 5, typed rate 6, keypad/actions 7-20, gas information 22, current rate 23, maximum rate 25.

All simulation/rotor scripts are machine-local under machinery/generators/gasTurbine*.js. Rendering and labels run only when shouldUpdateUI is true. Rotor animation runs client-side; only quantized speed changes are synchronized. Rotor references persist and are reused after reload. A 20-tick visual sweep removes orphaned or deactivated rotors. Interior block changes invalidate the turbine without altering shared multiblock listeners.

The source texture was a 32 x 32 atlas: top-left top, top-right bottom, bottom-left front, bottom-right sides. Its four 16 x 16 faces were extracted without rescaling. The rotor uses its own 32 x 32 texture at `RP/textures/entity/gas_turbine_rotor.png`, with the six gray colors from the Steel plated block. Two opposing half-cylinder scoops form an S in top view; eight thin cube segments per scoop preserve a continuous vertical shape. The shaft and bearings occupy the remaining height. Rebuild these assets with `node tools/generateGasTurbineRotor.cjs`.

## Validation

Run node --test tests/gas-turbine.cjs. Tests cover rates, startup, scheduler equivalence, fuel/buffer exhaustion, fractional consumption, UI gating, event controls, gas changes, formation/clearance and rotor cleanup. JSON/resource links and both normal/minified bundles are checked separately. The original rotor initialization was confirmed working in game. The replacement steel scoops and per-gas speeds have local geometry/render checks and still need an in-game visual check.
