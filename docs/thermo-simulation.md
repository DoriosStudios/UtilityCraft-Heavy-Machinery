# Thermo Reactor thermal runtime

Thermo uses DoriosCore `TemperatureStorage` and the pure thermal solver, with
machine-specific coefficients in `thermoSimulation.js`. Finite cooling and safety
crossing calculations are shared with Nuclear through `reactorHeatExchange.js`.
The old reactorThermalModel helper has been removed after both migrations.

## Balance

- Heat: 16 HU per mB of lava, multiplied by `2 - efficiency`.
- Energy: 1,500 DE/mB times thermal efficiency (10%..80%).
- Each Heat Conductor: 0.2 HU/(tick K) active conductance and 2% passive conductance.
- Coolant: 40 HU/mB times registered efficiency. Supported Tier 0+ fluids are Water,
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

Gas capacity comes from Gas Cells, not empty blocks. Full or incompatible exhaust
blocks active cooling, leaving passive cooling and the existing meltdown rules.
Old structures must be rescanned with at least one Gas Cell before burning.
Reducing gas capacity below stored gas is rejected; gases must be drained first.

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
uses the fluid IO toggle icon. General shows coolant/lava, energy, heated gas, temperature and
two telemetry columns. No tab shows player inventory; fuel enters through
fluid IO. Info has a scrollable lava/coolant/rate/safety guide.

The entity has 26 UI slots: 0 energy, 1 operation telemetry, 2 coolant, 3 lava,
4 temperature, 5 power, 6 input rate, 7..20 keypad/actions, 22 resources,
23 current rate, 24 native gas output, 25 recommended rate. Slot 21 is reserved.

## Heat recovery

The output map associates coolant IDs with gases. Cooling efficiency is read only
from the global coolant registry; Water is registered once by UC at 0.5,
Saline Coolant at 1 and Heavy Water at 2.

| Coolant | Heat removed per mB | Output per mB actually used |
| --- | ---: | --- |
| Water | 20 HU | 2.5 mB Steam |
| Heavy Water | 80 HU | 10 mB Steam |
| Saline Coolant | 40 HU | 2.5 mB Heated Saline Coolant |

Steam carries 8 HU/mB and yields 256 DE/mB in the turbine. Heated Saline Coolant
carries 16 HU/mB and yields 512 DE/mB, so both recover 32 DE per removed HU.
Cooling budget is limited by coolant AND compatible output headroom before solving
heat exchange. The integer gas payment is rounded down; a persisted fractional
mB carries into the next update. Switching an empty tank to another output discards
only the old sub-mB remainder. Cooling a stopped hot reactor can still produce gas.

At steady ideal efficiency (80%), each mB of lava yields 1,200 direct DE and
19.2 HU. With 2% passive conductance relative to active conductance, approximately
18.824 HU reaches coolant: about 602.35 turbine DE, or 1,802.35 DE total. This is
about 12.6% above the old ideal 1,600 DE/mB, before startup/storage/transport losses.
No coolant recovers heat that was lost passively. These are initial gameplay values.

Block callbacks now run every 4 ticks, matching the scheduler base cadence.
Thermal and Nuclear skip the thermal solver when powered off within 0.000001 K
of ambient, settling only that numerical residue to 300 K. Energy transfer and
open UI updates remain active; Nuclear can still load fuel. Restarting or changing
the stored temperature above ambient resumes normal simulation automatically.
