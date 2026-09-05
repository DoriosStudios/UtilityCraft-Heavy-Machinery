const TICKS_PER_SECOND = 20

/**
 * Moves a reactor core toward its thermal equilibrium.
 *
 * Conductors are rated at the ideal temperature. Cooling increases with the
 * difference from ambient, while a one-minute thermal time constant puts the
 * core within 1% of equilibrium in about five minutes.
 */
export function advanceReactorTemperature({
    temperature,
    ambientTemperature,
    maximumTemperature,
    idealTemperatureFraction,
    generatedHeat,
    conductorCoolingAtIdeal,
    tickDelta,
    hasCoolant,
    maximumCoolantHeat = Number.POSITIVE_INFINITY,
    responseTimeSeconds = 60,
    passiveCoolingFraction = 0.02,
    unsafeTargetFraction = 1.25,
}) {
    const ambient = Number.isFinite(ambientTemperature) ? ambientTemperature : 300
    const maximum = Math.max(ambient + 1, Number(maximumTemperature) || ambient + 1)
    const span = maximum - ambient
    const idealFraction = clamp(Number(idealTemperatureFraction) || 0.5, 0.01, 1)
    const heat = Math.max(0, Number(generatedHeat) || 0)
    const installedCooling = Math.max(0, Number(conductorCoolingAtIdeal) || 0)
    const coolantLimit = Math.max(0, Number(maximumCoolantHeat) || 0)
    const activeCooling = hasCoolant
        ? Math.min(installedCooling, coolantLimit)
        : installedCooling * Math.max(0, passiveCoolingFraction)

    let targetFraction = 0
    if (heat > 0) {
        targetFraction = activeCooling > 0
            ? heat / activeCooling * idealFraction
            : unsafeTargetFraction
    }
    targetFraction = clamp(targetFraction, 0, unsafeTargetFraction)

    const currentFraction = clamp(
        ((Number(temperature) || ambient) - ambient) / span,
        0,
        unsafeTargetFraction,
    )
    const representedTicks = Math.max(1, Number(tickDelta) || 1)
    const timeConstantTicks = Math.max(1, responseTimeSeconds * TICKS_PER_SECOND)
    const response = 1 - Math.exp(-representedTicks / timeConstantTicks)
    const nextFraction = currentFraction + (targetFraction - currentFraction) * response

    let coolantHeatRemoved = 0
    if (hasCoolant && installedCooling > 0 && coolantLimit > 0) {
        const averageFraction = Math.max(0, (currentFraction + nextFraction) / 2)
        coolantHeatRemoved = Math.min(
            installedCooling * averageFraction / idealFraction,
            coolantLimit,
        )
    }

    return {
        temperature: ambient + nextFraction * span,
        coolantHeatRemoved,
        equilibriumTemperature: ambient + targetFraction * span,
    }
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value))
}
