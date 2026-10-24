const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function loadGame(path, options = {}) {
  const noop = () => {};
  const events = {};
  const ctx = new Proxy({}, { get: () => noop });
  const element = () => ({
    style: {}, classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: noop, appendChild: noop, setAttribute: noop,
    width: 400, height: 600, getContext: () => ctx
  });
  const context = vm.createContext({
    document: { getElementById: element, createElement: element,
      querySelectorAll: () => [], addEventListener: (name, handler) => { events[name] = handler; } },
    localStorage: { getItem: () => { if (options.blockStorage) throw new Error('blocked'); return options.saved || null; }, setItem: () => { if (options.blockStorage) throw new Error('blocked'); } },
    window: {}, events, requestAnimationFrame: noop
  });
  vm.runInContext(readFileSync(path, 'utf8') +
    '\n globalThis.api = { events, document, startRun, endRun, update, drawEntities, buyOrEquip, togglePause, dom, canvas, currentSpeed, state, get game() { return game; } };', context);
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
    assert.equal(api.state.coins, 0);
  });
}

for (const path of ['app.js', 'dist/app.js']) {
  test(`${path}: start cannot discard an active run and settlement is idempotent`, () => {
    const api = loadGame(path);
    api.startRun();
    api.game.score = 100;
    api.startRun();
    assert.equal(api.game.score, 100);
    api.endRun();
    api.endRun();
    assert.equal(api.state.totalRuns, 1);
    assert.equal(api.state.coins, 20);
    assert.equal(api.dom.score.textContent, 100);
    assert.equal(api.dom.startBtn.disabled, false);
  });
  test(`${path}: blocked storage does not stop the game or reward settlement`, () => {
    const api = loadGame(path, { blockStorage: true });
    api.startRun();
    api.game.score = 100;
    assert.doesNotThrow(() => api.endRun());
    assert.equal(api.state.totalRuns, 1);
  });
  test(`${path}: malformed profile fields recover to usable defaults`, () => {
    const api = loadGame(path, { saved: JSON.stringify({ coins: 'bad', level: -4,
      unlockedPowerups: null, achievements: null, leaderboard: [null, 'bad', 25] }) });
    api.startRun();
    assert.equal(api.state.coins, 0);
    assert.equal(api.state.level, 1);
    assert.deepEqual(Array.from(api.state.leaderboard), [25]);
    assert.doesNotThrow(() => api.endRun());
  });
  test(`${path}: equipped backgrounds update immediately`, () => {
    const api = loadGame(path);
    api.state.coins = 200;
    api.buyOrEquip({ id: 'sunset-grid', price: 200 }, 'backgrounds');
    assert.equal(api.state.coins, 0);
    assert.match(api.canvas.style.background, /4f265f/);
  });
  test(`${path}: levels do not make future runs start faster`, () => {
    const api = loadGame(path);
    api.startRun();
    const speed = api.currentSpeed();
    api.state.level = 8;
    assert.equal(api.currentSpeed(), speed);
    api.update(0.4);
    assert.equal(api.game.entities.length, 0);
  });
  test(`${path}: pause stops time and score updates`, () => {
    const api = loadGame(path);
    api.startRun();
    api.togglePause();
    api.update(1);
    assert.equal(api.game.time, 0);
    assert.equal(api.game.score, 0);
    api.togglePause();
    api.update(0.1);
    assert.equal(api.game.score, 2);
  });
}

for (const path of ['app.js', 'dist/app.js']) {
  test(`${path}: double coins purchased mid-run apply only to the next run`, () => {
    const api = loadGame(path);
    api.startRun();
    api.state.unlockedPowerups.push('doubleCoins');
    api.game.score = 100;
    api.endRun();
    assert.equal(api.state.coins, 20);
    api.startRun();
    api.game.score = 100;
    api.endRun();
    assert.equal(api.state.coins, 60);
  });
}

for (const path of ['app.js', 'dist/app.js']) {
  test(`${path}: arrows work after a button receives focus`, () => {
    const api = loadGame(path);
    api.startRun();
    let prevented = false;
    api.events.keydown({ key: 'ArrowRight', repeat: false,
      target: { matches: selector => selector === 'button, a' },
      preventDefault: () => { prevented = true; } });
    assert.equal(api.game.playerLane, 1);
    assert.equal(prevented, true);
  });
  test(`${path}: hiding the tab pauses without automatically resuming`, () => {
    const api = loadGame(path);
    api.startRun();
    api.document.hidden = true;
    api.events.visibilitychange();
    assert.equal(api.game.paused, true);
    api.document.hidden = false;
    api.events.visibilitychange();
    assert.equal(api.game.paused, true);
  });
}
