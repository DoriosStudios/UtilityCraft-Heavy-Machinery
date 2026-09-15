/**
 * Spend one scheduler interval's work budget, completing paid batches immediately.
 * prepare() must re-read inputs and output space after each completed batch.
 * Speed controls work/tick; energyMultiplier only changes the DE paid for that work.
 * UI updates belong to the caller and run once, not once per batch.
 *
 * @param {import('../../DoriosCore/multiblock/multiblockMachine.js').MultiblockMachine} controller
 * @param {{ energyMultiplier: number, cost?: number }} data
 * @param {() => { cost?: number, recipe?: object, craft?: () => void, status?: string, resetProgress?: boolean }} prepare
 */
export function processFactory(controller, data, prepare) {
    const multiplier = data.energyMultiplier;
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
        return { status: '\u00a7eRescan Structure' };
    }
    let budget = controller.rate / multiplier;
    if (!Number.isFinite(budget) || budget < 0) return { status: '\u00a7eInvalid Rate' };
    const initialProgress = controller.getProgress();
    let progress = initialProgress;
    let currentCost;
    const finish = result => {
        if (progress !== initialProgress) controller.setProgress(progress, { display: false });
        return result;
    };

    while (true) {
        const plan = prepare();
        if (plan.status) {
            if (plan.resetProgress) progress = 0;
            return finish(plan);
        }
        const cost = plan.cost;
        if (!Number.isFinite(cost) || cost <= 0 || !plan.craft) {
            return finish({ status: '\u00a7eInvalid Recipe', recipe: plan.recipe });
        }
        data.cost = cost;
        if (cost !== currentCost) controller.setEnergyCost(cost);
        currentCost = cost;
        const remaining = Math.max(0, cost - progress);
        const work = Math.min(remaining, budget, controller.energy.get() / multiplier);
        if (work > 0) {
            controller.energy.consume(work * multiplier);
            progress += work;
            budget = Math.max(0, budget - work);
        }

        // Complete even when paying the last DE emptied the battery.
        if (progress + 1e-9 >= cost) {
            plan.craft();
            progress = Math.max(0, progress - cost);
        } else {
            return finish({ status: controller.energy.get() <= 0 ? '\u00a7eNo Energy' : '\u00a7aRunning', recipe: plan.recipe });
        }
        // Recheck inputs/output space once more to show the actual final status.
        // A zero budget cannot charge another batch, but may finish saved paid progress.
    }
}

/** Reserve simultaneous potential outputs without dropping overflowing loot. */
export function canFitFactoryOutputs(container, slots, outputs) {
    const space = slots.map(slot => {
        const item = container.getItem(slot);
        return item ? { typeId: item.typeId, amount: item.amount, maxAmount: item.maxAmount } : null;
    });
    for (const output of outputs) {
        let remaining = output.amount;
        for (const item of space) {
            if (!item || item.typeId !== output.typeId) continue;
            const added = Math.min(item.maxAmount - item.amount, remaining);
            item.amount += added;
            remaining -= added;
        }
        for (let i = 0; i < space.length && remaining > 0; i++) {
            if (space[i]) continue;
            const added = Math.min(64, remaining);
            space[i] = { typeId: output.typeId, amount: added, maxAmount: 64 };
            remaining -= added;
        }
        if (remaining > 0) return false;
    }
    return true;
}
