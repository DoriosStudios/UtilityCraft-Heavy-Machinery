# Gas Turbine

Bronze multiblock generator, independent of reactor temperature logic. No DoriosCore or DoriosLib changes.

## Build and use

1. Build a closed bronze casing at least **5 x 4 x 5** (X, Y, Z), including the Gas Turbine controller, a Gas Port and an Energy Port. Glass of the bronze tier can reveal the rotor.
2. Put at least one **Energy Cell** in an interior corner. The remaining interior must be air; neither Gas Cells nor rotor components are required. Keep the central cylindrical rotor space clear from floor to ceiling.
3. Activate the controller with a wrench. A vertical shaft and two opposing curved blades appear automatically, sized to the interior. The formed turbine starts switched off.
4. Supply Steam or Heated Saline Coolant through a Gas Port configured as Gas Intake. Set a rate in Control and press the fixed Power button. Export energy through Energy Ports.
5. Use the Drain Gas output on a Gas Port to empty the tank before switching gases. A changed structure requires a new scan.

At minimum size, the interior contains 18 blocks. With one Energy Cell and 17 empty blocks it holds **1,088 B** of gas and supports **4.5 mB/t Steam or 3.6 mB/t Heated Saline Coolant**. Each Energy Cell supplies the existing shared capacity of 4,000,000 DE.

## Initial balance

- Each empty interior block: 64,000 mB gas capacity.
- Each interior block (including Energy Cells): 0.25 mB/t base effective-flow capacity. Maximum gas intake is base capacity / gas impulse.
- Gas balance lives in TURBINE_GASES at the top of BP/scripts/machinery/generators/gasTurbineSimulation.js. Each working gas has name, energy (DE/mB) and impulse. Visual profiles are separate in gasTurbineVisuals.js. Unsupported gases are not consumed.
- Initial values: Steam = 256 DE/mB, impulse 1; Heated Saline Coolant = 512 DE/mB, impulse 1.25. Energy yield and mechanical impulse are independent.
- All gases share a 240 RPM ceiling. Target RPM = 240 * clamp(selected flow * impulse / base capacity, 0, 1). A half-limit flow settles at 120 RPM. Stored gas determines operating duration, not target RPM. Larger structures need proportionally more flow for the same RPM.
- Rotor speed approaches the flow-dependent target with a 40-tick time constant. During acceleration, admitted flow ramps with speed; lowering the rate immediately caps consumption to the new setting while rotation slows smoothly. Integrated fuel demand is solved exactly across tick batches.
- On shutdown, empty fuel, zero rate or full energy storage, conversion stops and the rotor coasts down. It does not generate free energy while coasting.
- Gas consumption is in whole mB with fractional intake progress retained between updates. A conversion only occurs when the full resulting energy fits in the buffer.
- No coolant, heat, pressure, gas cells or waste output.

## Integration

Controller: utilitycraft:gas_turbine_controller. Container: utilitycraft:gas_turbine. Visual entity: utilitycraft:gas_turbine_rotor.

The controller uses existing MultiblockGenerator, GasStorage, EnergyStorage, Link Node IO and InterfaceManager APIs. UI slots: energy 0, operation 1, gas 2, rotor speed 4, Power 5, typed rate 6, keypad/actions 7-20, gas information 22, current rate 23, maximum rate 25.

All simulation/rotor scripts are machine-local under machinery/generators/gasTurbine*.js. Rendering and labels run only when shouldUpdateUI is true. Rotor animation runs client-side; only quantized speed changes are synchronized. Saved speed from the old 150 RPM multiplier model migrates once to the normalized 240 RPM model, preserving physical RPM. The selected rate is clamped when the gas changes, and Control shows the current gas-specific maximum. Rotor references persist and are reused after reload. A 20-tick visual sweep removes orphaned or deactivated rotors. Interior block changes invalidate the turbine without altering shared multiblock listeners.

The source texture was a 32 x 32 atlas: top-left top, top-right bottom, bottom-left front, bottom-right sides. Its four 16 x 16 faces were extracted without rescaling. The rotor uses its own 32 x 32 texture at `RP/textures/entity/gas_turbine_rotor.png`, with the six gray colors from the Steel plated block. Two opposing half-cylinder scoops form an S in top view; eight thin cube segments per scoop preserve a continuous vertical shape. The shaft and bearings occupy the remaining height. Rebuild these assets with `node tools/generateGasTurbineRotor.cjs`.

## Validation

Run node --test tests/gas-turbine.cjs. Tests cover rates, startup, scheduler equivalence, fuel/buffer exhaustion, fractional consumption, UI gating, event controls, gas changes, formation/clearance and rotor cleanup. JSON/resource links and both normal/minified bundles are checked separately. The original rotor initialization was confirmed working in game. The replacement steel scoops and per-gas speeds have local geometry/render checks and still need an in-game visual check.


## Gas volume visual

The separate utilitycraft:gas_turbine_gas entity covers the full interior with a 1/16-block inset from every face. It does not rise or shrink as the tank empties. Its alpha is maxOpacity * sqrt(stored / capacity), rounded to 0.001; zero contents hides it. The maxOpacity and texture paths are in TURBINE_GAS_VISUALS, independent of TURBINE_GASES energy conversion. Maximum alpha per face is 0.6, except Hydrogen at 0.8. The client explicitly maps each synchronized gas enum string to its texture-array index, then selects a baked PNG alpha level, rounded up to the nearest 1/64; full tanks select level 39 (155/255 alpha), for fully opaque source pixels.

Only six outer faces are drawn, split into three render controllers so X/Y/Z faces each repeat their UVs with the corresponding dimensions. The original 16x16 UC sprite repeats once per block. The builder preserves its RGB pixels and multiplies its existing alpha into 65 local PNG variants per gas. The material derives from entity_alphablend, enables UV animation and requests point sampling with Repeat wrapping. It disables depth writes. Transparency comes directly from texture alpha: render-controller color alpha was not effective in the in-game test and is no longer used. Repetition was confirmed in game; the baked-alpha correction still needs a visual check. This is an outer shell, not a voxel simulation, and overlapping visible faces compound their opacity.

The entity persists while hidden to avoid respawning during intermittent supply. Property writes occur only when quantized opacity or gas type changes. Unloaded-center retries are throttled; a failed visual definition does not stop electricity generation. Both direct controller events and shared deactivation remove the visual. No DoriosCore changes are required.

After adding gas types or changing source sprites/texture paths, run node tools/generateGasTurbineGas.cjs to regenerate the texture variants, client texture array and synchronized enum. Source sprites are read from the neighboring UtilityCraft/RP directory; UC_RESOURCE_PACK can override that path. Generated textures are included in HM, so normal pack builds do not need to run this tool. Changing maxOpacity alone needs only the script export. Export BP and RP and reopen the world to register the new entity and material.

## Sparse gas flow particles

Each gas has a client-side particle effect using the vanilla falling-dust flipbook in textures/particle/particles (eight 8x8 frames, starting at [56,0]). This matches the sprite used by ATA Vein Miner. Its tint is the alpha-weighted average RGB of the gas source sprite, computed by the asset generator. Small square camera-facing particles replace the stretched gas-texture strips. The gas visual receives the existing rotor speed as a quantized property only when it changes. Animation time scales with speed at 3x the original emission frequency: one streak per 0.4 animation seconds, or 7.5 emissions/second at full rotor speed (defensive cap: 11.25). Streaks last 0.65 seconds (about five alive at full speed), orbit inside the interior, drift slightly upward and fade in/out. Empty gas or speed at/below 0.02 disables emission. No server particle-spawn loop or new visual entities are used. Updated BP and RP must be loaded; appearance still needs an in-game check.

## Thermal heat recovery

Heated Saline Coolant (`heated_saline_coolant_gas`) joins the gas table with
512 DE/mB, 1.25x impulse and 60% maximum shell opacity. It reaches the common
240 RPM limit at 80% of the Steam flow. UC owns its tank and bar resources;
HM owns the thermal production and turbine conversion.

The Working Gas tab lists only Steam and Heated Saline Coolant. Hydrogen and
Methane remain fuels for UC Gas Generators; they are not consumed by the turbine.
Existing unsupported gas can be recovered through the Drain Gas output.

## Gas visual coverage

TURBINE_GAS_VISUALS covers all 11 UC/HM tank gases: Steam, Heated Saline Coolant,
Hydrogen, Methane, Oxygen, Fluorine, Hydrogen Fluoride, Natural/Enriched/Depleted
Uranium Hexafluoride and Nuclear Waste. Their source textures are owned by UC;
the generator also accepts machine-local HM textures. It bakes 65 opacity levels
per texture and matching particle tints. Rebuild with node tools/generateGasTurbineGas.cjs.

Unknown types resolve to DEFAULT_TURBINE_GAS_VISUAL (Steam) before synchronizing
the visual enum. This does not modify the stored gas type or TURBINE_GASES: only
Steam and Heated Saline Coolant power the turbine. Unsupported gas remains visible
while stationary and can be drained. Particles still follow actual rotor speed.

Block callbacks now run every 4 ticks, matching the scheduler base cadence.
