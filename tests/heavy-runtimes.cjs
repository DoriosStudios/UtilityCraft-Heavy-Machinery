const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.resolve(__dirname, '../BP/scripts/HeavyCore/runtimes.js'), 'utf8')
    .replace(/^import .*;$/gm, '').replace('export const', 'const');
function load() {
    let remove;
    const context = vm.createContext({ world: { afterEvents: { entityRemove: { subscribe(fn) { remove = fn; } } } } });
    vm.runInContext(source + '\nthis.cache = runtimes;', context);
    return { cache: context.cache, remove };
}
test('Generic runtime accepts arbitrary data and removes only the unloaded entity', () => {
    const { cache, remove } = load();
    const first = { anyField: 25 }, second = { completelyDifferent: ['value'] };
    cache.set('one', first); cache.set('two', second);
    assert.strictEqual(cache.get('one'), first);
    remove({ removedEntityId: 'one' });
    assert.equal(cache.has('one'), false); assert.strictEqual(cache.get('two'), second);
    remove({ removedEntityId: 'unrelated' }); assert.equal(cache.size, 1);
});
test('Restarting the module starts with an empty map', () => {
    const previous = load(); previous.cache.set('machine', { rate: 5 });
    assert.equal(load().cache.size, 0);
});
