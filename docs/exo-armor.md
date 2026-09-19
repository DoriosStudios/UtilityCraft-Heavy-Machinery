# Utility Exo Armor

Each piece has 10,200 maximum durability and the `utilitycraft:energy_container`
tag. ItemEnergyStorage derives its 1,000,000,000 DE capacity from that durability,
using 100,000 DE per point and reserving 100 points at both ends. Remaining
visible durability runs from 100 (empty) to 10,100 (full). New Exo pieces start
empty when UtilityCraft's global UtilityCore inventory-change handler sees the
energy-container tag and zero damage. Initialization
sets 100 remaining durability. There is no interval, migration, item ID or world
dynamic-property storage.

The single `equipment/exoArmor.js` handler reads the four equipment slots and
recognizes the `utilitycraft:exo_armor` tag, without a list of item identifiers.
Powered pieces absorb these shares of the original damage: helmet 12.5%,
chestplate 40%, leggings 30%, boots 12.5%, for 95% total. Each piece pays
100,000 DE per point of its own absorbed share, rounded up by ItemEnergyStorage's
energy unit. Damage is reduced by the sum of the powered pieces' shares. Insufficiently charged
pieces do not contribute partial protection. Capacity and durability conversion
belong exclusively to ItemEnergyStorage.

Boots with the tag cancel fall damage when they can pay 100,000 DE per incoming
damage point. A temporary same-tick batch prevents spending the same energy twice
before the deferred equipment write. Changed equipment is never overwritten;
there is no persistent debt, scanning, interval or legacy migration.

The Reinforced Induction Anvil charges the central-slot item at 1,000,000 DE/t
base, converting 1 machine DE into 1 stored DE. A full Exo piece takes 50 seconds
at base rate with adequate power. Speed upgrades increase throughput. A buffer of
640,000,000 DE and energy upgrades support its input supply. Normal equipment is
repaired at 128x the basic Induction Anvil's base rate, at the ordinary repair cost.
The block retains the original anvil model and the graphite/violet texture.

The previous generator-interaction and normal-anvil charging paths are removed.
See item-energy-storage.md for vanilla-repair limitations and the generic API.

Checks: `node tests/exo-armor.cjs`, `node tests/item-energy-storage.cjs`, and
`node tests/reinforced-induction-anvil.cjs`. Minecraft checks must still cover
native wear, UI, cable input, enchantment rejection and vanilla item combining.

Native armor points match netherite: helmet 3, chestplate 8, leggings 6, boots 3.
These remain active without energy and combine with the scripted reduction.

Paid fall cancellation emits `utilitycraft:exo_fall_absorption` at the captured
landing position: a blue expanding effect about two blocks wide, lasting 0.7
seconds, adapted from the supplied Weapons & Armor hammer effect.
