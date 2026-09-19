# Factory processing and balance

## Throughput target

A minimum factory with one Processing Module, no Speed/Efficiency Modules and full batches provides **20x standard base throughput**, equivalent to **two standard machines with maximum speed upgrades**. Standard UC speed upgrades reach 10x base speed. Reaction Chamber is compared with the standard HM Reaction Chamber instead.

These comparisons assume the same recipe, enough continuous energy/materials, matching mesh for Autosieve, and sufficient output extraction. Partial batches, catalyst storage, fluid cells and port throughput can limit actual production.

| Factory | Base work per tick | Standard base work per tick |
|---|---:|---:|
| Crusher | 200 | 20 |
| Electro Press | 200 | 20 |
| Incinerator | 200 | 20 |
| Infuser | 400 | 40 |
| Autosieve | 400 | 40 |
| Magmatic Chamber | 400 | 40 |
| Reaction Chamber | 1600 | 160 |

The former x4 factory recipe penalty is removed. Magmatic's fallback recipe cost is 8000 DE, matching UC. Other recipe costs and recipe outputs remain unchanged.

## Modules

For P Processing, S Speed and E Efficiency Modules:

- Parallel operations per batch: `L = ceil(2 * sqrt(P))`.
- Work speed: `sqrt(max(1, S)) * 2 * sqrt(P) / L`.
- Batch energy multiplier: `(L / 2) * (0.25 + 0.75 * exp(-0.15 * E))`.
- Full-batch throughput relative to one maximum-speed standard machine: `2 * sqrt(P * max(1, S))`.

Both Processing and Speed have square-root returns. Doubling both doubles throughput, rather than quadrupling it. Parallel lanes are rounded to whole operations; work speed compensates that rounding so it grants no extra throughput. Zero Speed Modules use the same baseline as one Speed Module. Efficiency only reduces energy use, approaching a maximum 75% discount; it does not increase speed.

Examples with continuous supply:

| Processing | Speed | Equivalent maximum-speed standard machines |
|---:|---:|---:|
| 1 | 0 | 2 |
| 2 | 2 | 4 |
| 8 | 8 | 16 |
| 16 | 16 | 32 |
| 32 | 32 | 64 |
| 64 | 64 | 128 |

With no Efficiency Modules, a full batch costs half the standard recipe energy per operation, matching a standard UC machine with both eight Speed and eight Energy Upgrades. Partial batches still pay the batch cost; fill the lanes to obtain the stated efficiency. Mixed-recipe batches use the most expensive recipe in the batch, as before.

**Existing factories must be rescanned with the wrench** to refresh their saved module statistics. New activations use the new formula immediately. The shared stats and cost-label code is synchronized in HM and UC.

## Processing correctness

All seven controllers use `factoryProcessing.js`. Each update receives the work budget for its scheduler interval. It pays only for missing progress, finishes the batch immediately, then replans against the updated inventory/tanks before spending the remaining budget. A fully paid batch can finish with an empty energy buffer.

Blocked outputs preserve paid progress. Missing/invalid recipe inputs retain the existing reset behavior. Input/output changes are synchronous during the update; excess work is not charged when the machine cannot continue. Progress persistence and UI rendering happen once per update rather than once per batch. No new interval or player/machine scan was introduced.

Autosieve reserves enough room for the maximum possible simultaneous loot roll before consuming the batch. This is deliberately conservative: it can wait for more space even if a lucky roll would have fitted.

The shared energy label reports the maximum draw per tick with the current modules, and the batch cost includes module modifiers.

## Validation

`node tests/factory-processing.cjs` exercises the actual seven controller scripts with simulated inventories and tanks. The 41 checks cover scheduler intervals 4/20/40/80, baseline throughput, module scaling, depleted batteries, partial progress, blocked/partial item outputs, incompatible/full fluid outputs, and Autosieve output reservations. Tests replace rendering and Bedrock services, so an in-game run is still required to measure real-world port throughput and frame/tick performance.
