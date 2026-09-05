/**
 * Changes a reactor's powered state and starts or clears its wall-clock timer.
 */
export function setReactorRunning(data, running, now = Date.now()) {
    delete data.time
    data.state = running ? 'on' : 'off'
    data.startedAtMs = running ? now : 0
}

/**
 * Initializes legacy running reactors and clears stale timestamps while off.
 */
export function synchronizeReactorTimer(data, now = Date.now()) {
    delete data.time

    if (data.state === 'off') {
        data.startedAtMs = 0
        return
    }

    const startedAtMs = Number(data.startedAtMs)
    if (!Number.isFinite(startedAtMs) || startedAtMs <= 0 || startedAtMs > now) {
        data.startedAtMs = now
    }
}

/**
 * Formats the real elapsed time since the reactor was switched on.
 */
export function formatReactorOnTime(data, now = Date.now()) {
    if (data.state === 'off') return '00:00:00'

    const startedAtMs = Number(data.startedAtMs)
    if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return '00:00:00'

    const totalSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor(totalSeconds % 3600 / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds]
        .map(value => String(value).padStart(2, '0'))
        .join(':')
}

/**
 * Spawns the same tall-smoke effect over a random sample of reactor vents.
 */
export function spawnReactorVentSmoke(entity, ratio = 0.1, center = true) {
    let vents = []
    const rawVents = entity.getDynamicProperty('ventBlocks')
    try {
        vents = rawVents ? JSON.parse(rawVents) : []
    } catch {
        vents = []
    }

    const ventCount = vents.length
    if (ventCount < 2) return

    const sampleCount = Math.max(1, Math.floor(ventCount * ratio))
    for (let index = ventCount - 1; index > ventCount - 1 - sampleCount; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1))
        ;[vents[index], vents[swapIndex]] = [vents[swapIndex], vents[index]]
    }

    for (let index = ventCount - sampleCount; index < ventCount; index++) {
        const vent = vents[index]
        const position = center
            ? { x: vent.x + 0.5, y: vent.y + 0.5, z: vent.z + 0.5 }
            : vent
        try {
            entity.dimension.spawnParticle('minecraft:campfire_tall_smoke_particle', position)
        } catch { }
    }
}
