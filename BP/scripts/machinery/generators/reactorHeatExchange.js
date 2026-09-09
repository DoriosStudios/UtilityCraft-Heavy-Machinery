import { advanceTemperature } from '../../DoriosCore/machinery/temperatureModel.js'

/** Locate a rare coolant exhaustion or safety event without per-tick world work. */
function eventTime(duration, predicate) {
    let low = 0, high = duration
    for (let i = 0; i < 40; i++) {
        const mid = (low + high) / 2
        if (predicate(mid)) high = mid
        else low = mid
    }
    return low
}

export function advanceReactorHeat(temperature, ticks, heatRate, input, coolantBudget, config) {
    let remaining = ticks, elapsed = 0, coolantHeat = 0
    const passive = input.passiveConductance ?? 0
    // At most two pieces: before and after the finite cooling budget runs out.
    while (remaining > 0) {
        const active = coolantBudget > 1e-9 ? input.conductance : 0
        const contacts = [{ temperature: config.ambientTemperatureK, conductance: passive }]
        if (active > 0) contacts.push({ temperature: config.ambientTemperatureK, conductance: active })
        const step = duration => advanceTemperature({ temperature, heatCapacity: input.heatCapacity,
            ticks: duration, heatRate, contacts })
        let duration = remaining
        let result = step(duration)
        let exhausted = false, meltdown = false
        const removed = result => Math.max(0, -(result.contacts[1]?.heat ?? 0))
        if (active > 0 && removed(result) > coolantBudget) {
            duration = eventTime(duration, time => removed(step(time)) >= coolantBudget)
            result = step(duration)
            exhausted = true
        }
        if (result.temperature >= config.meltdownTemperatureK) {
            duration = eventTime(duration, time => step(time).temperature >= config.meltdownTemperatureK)
            result = step(duration)
            meltdown = true
        }
        const heat = Math.min(coolantBudget, removed(result))
        coolantHeat += heat
        coolantBudget = exhausted && !meltdown ? 0 : Math.max(0, coolantBudget - heat)
        temperature = result.temperature
        elapsed += duration
        remaining = Math.max(0, remaining - duration)
        if (meltdown) return { temperature: config.meltdownTemperatureK, elapsed, coolantHeat, meltdown: true }
        // No event: the complete requested interval has been processed.
        if (!exhausted) break
    }
    return { temperature, elapsed, coolantHeat, meltdown: false }
}
