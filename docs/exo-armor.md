# Utility Exo Armor

Each piece stores 1,000,000,000 DE and starts empty. The Induction Anvil in the
matching UtilityCraft working version transfers its available energy into the
piece at 1 DE per stored DE. Its buffer and incoming power limit charging speed;
ordinary repair-speed and repair-efficiency calculations do not apply.

Each charged piece absorbs 22.5% of the damage supplied to the before-hurt event,
calculated independently from the same incoming value. Four pieces absorb 90%.
Absorption costs 1,000,000 DE per damage point absorbed (one point is half a heart).
A piece with insufficient energy only absorbs what it can afford. Empty pieces
provide no protection. For example, a 20-point hit costs each piece 4,500,000 DE
and leaves 2 points for the player with a fully powered set.

Boots cancel fall damage entirely when they can pay 1,000,000 DE per incoming
point. Other pieces are not charged for that fall. If the boots cannot pay for full
cancellation, the normal partial-absorption calculation applies instead.

All pieces have 100,000 maximum durability and no enchantable component or native
protection/wear. Remaining durability is a display only: 99,000 at full charge,
1,000 at empty. Actual DE is an item dynamic property, never inferred from repair
damage. Thus native repairs cannot recharge armor, and the item is not destroyed
when its charge runs out. The lore shows the exact DE and charge percentage.

The hurt callback reserves energy immediately and defers item writes to normal
execution. Reservations follow item IDs across equipment/inventory moves and are
retained in world properties if the item becomes unavailable before settlement.
The Induction Anvil sends a charging request to Heavy Machinery, which owns the
item dynamic properties and debits the anvil's shared scoreboard energy storage.

Validation: `node tests/exo-armor.cjs`. Minecraft verification should cover native
wear, enchanting-table/anvil rejection, cross-pack charging, falling and death/drop
handling; mocked API tests cannot verify engine-specific behavior.
