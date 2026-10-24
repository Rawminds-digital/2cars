const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function loadGame(path) {
  const noop = () => {};
  const ctx = new Proxy({}, { get: () => noop });
  const element = () => ({
    style: {}, classList: { add: noop, remove: noop },
    addEventListener: noop, appendChild: noop,
    width: 400, height: 600, getContext: () => ctx
  });
  const context = vm.createContext({
    document: { getElementById: element, createElement: element,
      querySelectorAll: () => [], addEventListener: noop },
    localStorage: { getItem: () => null, setItem: noop },
    window: {}, requestAnimationFrame: noop
  });
  vm.runInContext(readFileSync(path, 'utf8') +
    '\n globalThis.api = { startRun, endRun, update, drawEntities, state, get game() { return game; } };', context);
  return context.api;
}

for (const path of ['app.js', 'dist/app.js']) {
  test(`${path}: restarting restores the first spawn interval`, () => {
    const api = loadGame(path);
    api.startRun();
    api.game.time = 30;
    api.game.lastSpawn = 29.8;
    api.endRun();
    api.startRun();
    assert.equal(api.game.time, 0);
    assert.equal(api.game.lastSpawn, 0);
    api.update(0.4);
    assert.equal(api.game.entities.length, 0);
    api.update(0.42);
    assert.equal(api.game.entities.length, 1);
  });

  test(`${path}: fatal overlap awards one run and stops later coin processing`, () => {
    const api = loadGame(path);
    api.startRun();
    api.game.score = 100;
    api.game.entities = [
      { type: 'obstacle', lane: 0, y: 520, spin: 0 },
      { type: 'obstacle', lane: 0, y: 520, spin: 0 },
      { type: 'coin', lane: 0, y: 520, spin: 0 }
    ];
    api.drawEntities(0);
    assert.equal(api.game.running, false);
    assert.equal(api.state.totalRuns, 1);
    assert.equal(api.state.coins, 20);
    assert.equal(api.state.xp, 22);
    assert.deepEqual(Array.from(api.state.leaderboard), [100]);
    assert.equal(api.game.score, 100);
  });

  test(`${path}: shield absorbs one hit before the next hit ends the run`, () => {
    const api = loadGame(path);
    api.startRun();
    api.game.shieldUsed = true;
    api.game.entities = [
      { type: 'obstacle', lane: 0, y: 520, spin: 0 },
      { type: 'obstacle', lane: 0, y: 520, spin: 0 },
      { type: 'obstacle', lane: 0, y: 520, spin: 0 }
    ];
    api.drawEntities(0);
    assert.equal(api.game.shieldUsed, false);
    assert.equal(api.game.entities[0].y, 700);
    assert.equal(api.game.running, false);
    assert.equal(api.state.totalRuns, 1);
    assert.equal(api.state.coins, 1);
  });
}
