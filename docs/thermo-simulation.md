# Thermo Reactor thermal runtime

Thermo uses DoriosCore `TemperatureStorage` and the pure thermal solver, with
machine-specific coefficients in `thermoSimulation.js`. Finite cooling and safety
crossing calculations are shared with Nuclear through `reactorHeatExchange.js`.
The old reactorThermalModel helper has been removed after both migrations.

## Balance

- Heat: 16 HU per mB of lava, multiplied by `2 - efficiency`.
- Energy: the existing 2,000 DE/mB times thermal efficiency (10%..80%).
- Each Heat Conductor: 0.2 HU/(tick K) active conductance and 2% passive conductance.
- Coolant: 40 HU/mB times registered efficiency. Tier 0+ remains accepted, including
  Saline Coolant and Heavy Water. Contacts use the reactor's 300 K ambient.
- Capacity: 20 HU/K base, 1 per shell/ordinary component, 4 per Thermo Core and 2
  per Heat Conductor. Internal air and pre-existing liquids do not count as mass.
- The existing 1200 K meltdown threshold remains a machine rule. The 300..1273.15 K
  UI range does not clamp stored temperature. Low rates may be passively sustainable.

These coefficients are an initial gameplay balance and need in-game tuning.

## Integration and persistence

The runtime performs combustion in four-tick mathematical slices to keep changing
efficiency consistent across the 4/20/40/80 scheduler profiles. Fuel exhaustion,
energy headroom, exhausted coolant and threshold crossings shorten a slice as
needed. Off/starved cooling is advanced through the remaining time analytically.
No inventory or scoreboard operations occur inside those mathematical slices.

Whole-mB lava/coolant payments retain fractional prepaid credit. This prevents
fractional consumption from being rounded up on every update. Changing coolant
types discards old unused coolant credit. Temperature, resources and reactor state
are committed once per scheduled update, outside UI work. Storage/network rounding
and external transfers are not simulated by the pure thermal model.

Old saved temperatures initialize TemperatureStorage only once. Legacy conductor
counts are recovered from the former 0.05 K/t statistic. Revalidation updates
capacity for filled tanks as well as empty tanks and retains existing temperature.
Old structures use their bounds and known components to estimate thermal mass
until scanned again. Reactor state no longer duplicates the full static stats.

## UI and events

All bar/label formatting and updates are gated by `shouldUpdateUI`. Native fluid,
energy and temperature displays preserve the existing slots and visual layout.
The main information label is rewritten only when its text/lore changes.

InterfaceManager already handled the keypad and power buttons by event. Those
callbacks remain, with the backing entity linked too. Missing rate labels are
initialized on container-open. Activation now displays the saved applied rate,
instead of displaying zero while the actual rate remains nonzero. An unused modal
form and old per-update sound property were removed. Smoke/sound are throttled in
memory, independently of whether the UI is open.

Steam capacity, pressure and vent-rate metadata are preserved. There was no active
steam/pressure simulation in this script before migration, and none was introduced.
The existing meltdown deactivation/explosion remains, guarded against repeated
scheduling or restarting while an explosion is pending.

## Validation

```sh
node --test tests/thermo-reactor.cjs tests/reactor-fuels.cjs tests/temperature-storage.cjs
```

Tests run the real thermal solvers/storage with mocked Minecraft entities. They
cover closed/open UI, event callbacks, old saves, capacity refresh, fractional
resources, finite cooling, scheduler consistency, efficiency and meltdown. Real
Minecraft performance and balance remain to be checked in game.

## Four-tab UI

General, Fuel & Coolant, Control and Info reuse Nuclear tab geometry and native assets. Fuel
uses the fluid IO toggle icon. General shows coolant/lava, energy, temperature and
two telemetry columns. Only Fuel shows player inventory; fuel itself enters through
fluid IO. Info has a scrollable lava/coolant/rate/safety guide.

The entity has 26 UI slots: 0 energy, 1 operation telemetry, 2 coolant, 3 lava,
4 temperature, 5 power, 6 input rate, 7..20 keypad/actions, 22 resources,
23 current rate, 25 recommended rate. Slots 21 and 24 are reserved.
