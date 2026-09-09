# TemperatureStorage

Generic thermal body in DoriosCore. Import from `DoriosCore/index.js`.
No reactor thresholds, fuel/coolant rules, automatic ambient contact or physical
minimum/maximum temperature are imposed. Finite numeric inputs, nonnegative elapsed
time/conductance and strictly positive capacity are required for valid arithmetic.
Nuclear and Thermo Reactors both use this storage and solver with their own thermal balance.

## Units and model

- Temperature: K.
- Heat: fictional Heat Units (HU), independent of DE.
- Heat capacity: HU/K. This is thermal inertia, not a maximum temperature.
- Internal heat rate: HU/tick (positive adds heat, negative extracts heat).
- Contact conductance: HU/(tick K).
- Time: elapsed simulation ticks, including fractional or zero ticks.

The pure solver `advanceTemperature` integrates:

```text
C dT/dt = P + sum(Gi * (Ti - T))
```

For total conductance G > 0, the equilibrium is
`(P + sum(Gi * Ti)) / G` and the response time constant is `C / G` ticks.
The temperature approaches equilibrium exponentially. With G = 0 it changes
linearly by `P * ticks / C`; with no heat input it stays unchanged.

All contacts act simultaneously. A contact above the body's temperature heats it;
a colder one cools it. They represent reservoirs whose temperature stays constant
for the step. Calling separate `transfer` methods for simultaneous contacts would
instead simulate consecutive periods and is not equivalent to one `advance`.

The model has no numerical loop per tick. For unchanged coefficients, one step of
20 ticks matches twenty steps of 1 tick, including integrated contact heat.

## Persistent storage

```js
import { TemperatureStorage } from 'DoriosCore/index.js';

const temperature = new TemperatureStorage(entity, 0, {
    initialTemperature: 300,
    heatCapacity: 100
});

const result = temperature.advance({
    ticks: 4,
    heatRate: 600,
    contacts: [
        { id: 'source', temperature: 900, conductance: 2 },
        { id: 'sink', temperature: 300, conductance: 0.2 }
    ]
});

temperature.display(4, { minimum: 300, maximum: 3300 });
```

`id` is an optional caller-owned label and does not affect physics. Results retain
contact order. The storage persists `{temperature, heatCapacity}` in the dynamic
property `dorios:temperature_<index>`. Initial options only seed missing state;
recreating a wrapper never resets existing values. Separate indices are isolated.
Do not delete this property while its wrapper is in use.

The result contains:

- `temperature`: final K.
- `temperatureChange`: signed change in K.
- `generatedHeat`: signed internal heat over the interval, HU.
- `contacts`: one `{id, heat}` result per supplied contact. Positive heat entered
  the body; negative heat left it. The reservoir exchanges the opposite amount.
- `netHeat`: internal generation plus contact exchanges, equal to C times the
  temperature change (within floating-point precision).
- `equilibriumTemperature`: equilibrium under unchanged conditions, or `null` if
  isolated with nonzero generation. An isolated, unchanged body returns its current K.

At equilibrium the net heat can be zero while a hot contact still supplies heat
and a cold contact removes it. Account for each contact, not just the net change.

## Methods

| Method | Meaning |
| --- | --- |
| `get()` | Read K. |
| `set(kelvin)` | Set K directly. |
| `getHeatCapacity()` | Read HU/K. |
| `setHeatCapacity(capacity)` | Change HU/K while preserving K. |
| `addHeat(hu)` | Add signed HU immediately; returns resulting K. |
| `removeHeat(hu)` | Remove nonnegative HU immediately; returns resulting K. |
| `advance(options)` | Simulate simultaneous generation and contacts; return the heat balance. |
| `transfer(kelvin, ticks = 1, conductance = 1)` | Simulate one contact with no internal generation; return the same result. |
| `display(slot = 4, options = {})` | Display the native bar and actual K tooltip. |
| `TemperatureStorage.initializeSingle(entity, options)` | Create/reopen index zero. |

Capacity changes represent machine reconfiguration, not conservation-aware mixing
of matter. The machine decides how newly added/removed components affect its
energy and temperature. Doubling capacity alone doubles the thermal response time
but leaves equilibrium unchanged.

`display` defaults to a visual range of 0..4000 K and the existing
`utilitycraft:temperature_00` through `_31` items. Only the frame is clamped;
stored temperature and tooltip remain unchanged. The owning entity needs inventory
and normally the `utilitycraft:players` open-UI property. `force: true` can populate
an inventory before the UI opens. Unchanged display items are not rewritten.

## Machine responsibilities

The caller computes capacity from its structure, heat generation from actual
consumption, and conductances from available connections. A finite coolant or
other resource must not be represented as an unlimited contact beyond its lifetime.
The API does not consume resources or enforce heat budgets: split the time interval
when a resource runs out, a contact changes, or a machine event happens. Blindly
consuming the returned heat after a resource was already exhausted gives free cooling.

Likewise, the constant-input result does not make an entire machine interval-
independent if its generation depends on changing temperature/efficiency. Such
feedback and threshold events need caller-controlled time subdivisions. The model
never adds elapsed time for unloaded chunks automatically.

Contacts do not mutate other thermal bodies. Connecting two finite bodies requires
a coupled, energy-conserving exchange; treating one as a fixed reservoir and later
subtracting heat is not that solution. Finite-body exchange is outside this API.

## Pure calculation and verification

`advanceTemperature({temperature, heatCapacity, ticks, heatRate, contacts})` lives in
`temperatureModel.js`, imports no Minecraft code and has no persistence side effects.

Run the focused model/storage tests:

```sh
node --test tests/temperature-storage.cjs
```

They cover hot/cold contacts, conservation including simultaneous flows at
steady state, time batching, thermal inertia, independent numerical integration,
persistence, invalid inputs and display behavior.
