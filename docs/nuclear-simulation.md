# Nuclear Reactor thermal runtime

Nuclear uses DoriosCore `TemperatureStorage` for persisted K/capacity and its native
display. `nuclearSimulation.js` uses the same pure `advanceTemperature` solver for
in-memory calculations. Thermo keeps `reactorThermalModel.js` unchanged.

## Initial thermal balance

These are tunable gameplay coefficients, independent of the reactor's safety limit:

| Parameter | Value |
| --- | --- |
| Nominal heat per FU | 100 HU/FU |
| Active conductance per Heat Conductor | 1/15 HU/(tick K) |
| Passive conductance | 2% of installed active conductance |
| Coolant heat absorption | 200 HU/mB times coolant efficiency |
| Ambient/contact temperature | 300 K |
| Base heat capacity | 20 HU/K |
| Shell block / ordinary internal component | 1 HU/K |
| Fuel Assembly | 4 HU/K |
| Heat Conductor | 2 HU/K |

Capacity counts the shell and solid components from the activation scan, excluding
internal air and pre-existing liquid. Old saves derive an estimate from their
saved bounds/known component counts until the next scan. Revalidation updates
capacity while preserving temperature.

Fuel at the selected FU/t rate generates heat. Above installed nominal rate,
heat per FU increases by `rate / nominalRate`, preserving the overdrive penalty.
Coolant tier/efficiency rules remain in Nuclear; DoriosCore only receives thermal
numbers. A small rate may stabilize safely with passive dissipation alone.

Temperature itself is not clamped to the display range. Nuclear locates its
meltdown threshold crossing, stops burning at that time, deactivates, and schedules
its existing explosion. No generic thermal limit or coolant logic was added to
DoriosCore.

## Time and finite resources

Active combustion uses in-memory four-tick slices, matching the native minimum
scheduler interval. This recomputes efficiency as temperature changes and gives
consistent results for 4/20/40/80-tick profiles with identical initial resources and
no external changes between updates. Closed updates do not do extra Minecraft
inventory/scoreboard work per slice. Off or starved cooling advances analytically
through the remaining interval in one step.

Fuel, energy headroom and waste room limit burn duration. Exhausted resources stop
combustion while remaining time continues cooling. Coolant exhaustion splits a
thermal interval into active/passive portions. Threshold searches run only when
an exhaustion/meltdown event actually crosses the current interval.

Coolant is paid in whole mB, with less than one prepaid mB retained as typed credit.
The model can only absorb the heat paid for by available coolant plus that credit.
Changing coolant types discards unused old credit. Waste still yields 1 mB/FU and
retains fractional output until a whole mB can be stored. Energy, coolant, waste
and temperature are committed once per scheduled update (at most once per resource).
Scoreboard rounding and externally arriving resources remain properties of the
underlying storage/network layer, not of the mathematical solver.

## Runtime work

- UI formatting and display calls sit behind `reactor.shouldUpdateUI`.
- Dynamic labels and the custom fuel bar are only rewritten when changed.
- Native temperature, liquid, gas and energy displays retain their established UI.
- The fuel input remains polled to support item-port/pipe automation.
- Keypad, accept/reset/delete and power controls run through InterfaceManager events.
- Legacy rate input labels migrate on container-open; applying a rate updates the
  Current Rate label in the event callback.
- Static structure JSON is cached until its raw property changes. Runtime storage
  wrappers use a WeakMap keyed by entity; mutable tank values are always read live.
- Tank capacity writes occur at initialization or structure changes, not each tick.
- Repeated reactor-side IO initialization was removed; BasicMachine already ensures it.
- Nuclear state no longer duplicates the static structure/bounds record.
- Vent particles are emitted at most once per 20 ticks per loaded runtime.

The original temperature seeds the new storage once. Thereafter TemperatureStorage
is authoritative; the nuclear state keeps a compatibility/telemetry mirror.
InterfaceManager was already event-driven before this migration; its existing
callbacks were retained and the backing entity type was additionally linked.

## Checks

```sh
node --test tests/reactor-fuels.cjs tests/temperature-storage.cjs
```

Tests use the real thermal solver/storage with mocked Minecraft entities and
containers. They cover fuel compatibility, UI gating, callback-only controls,
legacy migration, finite cooling, fractional waste, time batching, thermal mass,
resource stops, and meltdown. They do not replace an in-game balance/performance
check under actual network and particle load.
