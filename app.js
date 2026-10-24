const STORAGE_KEY = 'twocars_arcade_profile_v1';
const CONSENT_KEY = 'twocars_consent_seen_v1';

const defaultState = {
  bestScore: 0,
  coins: 0,
  totalRuns: 0,
  level: 1,
  xp: 0,
  selectedSkin: 'classic',
  selectedBackground: 'neon-night',
  unlockedSkins: ['classic'],
  unlockedBackgrounds: ['neon-night'],
  unlockedPowerups: [],
  achievements: {},
  leaderboard: [],
  lastLoginDate: null,
  profileVersion: 1
};

const config = {
  levelXpBase: 125,
  maxLeaderboard: 5,
  lanes: [0.35, 0.65],
  baseSpeed: 190,
  speedCap: 620,
  coinRatio: 0.2,
  scorePerSecond: 20
};

const shop = {
  skins: [
    { id: 'classic', name: 'Classic', price: 0 },
    { id: 'fire', name: 'Fire Rush', price: 120 },
    { id: 'ice', name: 'Ice Drift', price: 220 },
    { id: 'cyber', name: 'Cyber Bolt', price: 360 }
  ],
  backgrounds: [
    { id: 'neon-night', name: 'Neon Night', price: 0 },
    { id: 'sunset-grid', name: 'Sunset Grid', price: 200 },
    { id: 'aurora', name: 'Aurora Sky', price: 420 }
  ],
  powerups: [
    { id: 'shield', name: 'Shield Start', price: 180, description: 'Permanent: blocks one hit each run.' },
    { id: 'doubleCoins', name: 'Double Coins', price: 260, description: 'Permanent: doubles run coins.' },
    { id: 'slowTime', name: 'Slow Time', price: 320, description: 'Permanent: reduces speed each run.' }
  ]
};

const achievements = [
  { id: 'starter', label: 'First Drive', check: (s) => s.totalRuns >= 1 },
  { id: 'economist', label: 'Coin Collector (500)', check: (s) => s.coins >= 500 },
  { id: 'elite', label: 'Score 800+', check: (s) => s.bestScore >= 800 },
  { id: 'legend', label: 'Reach Level 8', check: (s) => s.level >= 8 }
];

const state = loadState();
const dom = {
  score: document.getElementById('score'),
  coins: document.getElementById('coins'),
  best: document.getElementById('bestScore'),
  level: document.getElementById('level'),
  levelFill: document.getElementById('levelFill'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  leftBtn: document.getElementById('leftBtn'),
  rightBtn: document.getElementById('rightBtn'),
  shopItems: document.getElementById('shopItems'),
  achievements: document.getElementById('achievements'),
  leaderboard: document.getElementById('leaderboard'),
  dailyBtn: document.getElementById('dailyBtn'),
  dailyText: document.getElementById('dailyText'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  consentModal: document.getElementById('consentModal'),
  consentBtn: document.getElementById('consentBtn'),
  status: document.getElementById('runStatus'),
  storageNotice: document.getElementById('storageNotice'),
  soundBtn: document.getElementById('soundBtn')
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let game = null;
let activeTab = 'skins';
let soundEnabled = false;

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const clean = JSON.parse(JSON.stringify(defaultState));
    if (!parsed || typeof parsed !== 'object') return clean;
    for (const key of ['bestScore', 'coins', 'totalRuns', 'xp']) {
      if (Number.isSafeInteger(parsed[key]) && parsed[key] >= 0) clean[key] = key === 'xp' ? Math.min(parsed[key], 1000000) : parsed[key];
    }
    if (Number.isSafeInteger(parsed.level) && parsed.level >= 1 && parsed.level <= 10000) clean.level = parsed.level;
    for (const key of ['unlockedSkins', 'unlockedBackgrounds', 'unlockedPowerups']) {
      if (Array.isArray(parsed[key])) clean[key] = [...new Set([...clean[key], ...parsed[key].filter(v => typeof v === 'string')])];
    }
    if (clean.unlockedSkins.includes(parsed.selectedSkin)) clean.selectedSkin = parsed.selectedSkin;
    if (clean.unlockedBackgrounds.includes(parsed.selectedBackground)) clean.selectedBackground = parsed.selectedBackground;
    if (Array.isArray(parsed.leaderboard)) clean.leaderboard = parsed.leaderboard.filter(v => Number.isSafeInteger(v) && v >= 0).sort((a,b) => b-a).slice(0, 5);
    if (typeof parsed.lastLoginDate === 'string') clean.lastLoginDate = parsed.lastLoginDate;
    return clean;
  } catch {
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    dom.storageNotice.textContent = 'Progress cannot be saved in this browser. You can keep playing this session.';
  }
}

function getXpToNextLevel(level) {
  return Math.floor(config.levelXpBase * (1 + level * 0.15));
}

function addXp(amount) {
  state.xp += amount;
  while (state.xp >= getXpToNextLevel(state.level)) {
    state.xp -= getXpToNextLevel(state.level);
    state.level += 1;
    beep(640, 0.08);
  }
}

function syncHud(score = 0) {
  dom.score.textContent = Math.floor(score);
  dom.coins.textContent = state.coins;
  dom.best.textContent = state.bestScore;
  dom.level.textContent = state.level;
  dom.levelFill.style.width = `${Math.min(100, (state.xp / getXpToNextLevel(state.level)) * 100)}%`;
}

function checkDailyReward() {
  const today = new Date().toISOString().slice(0, 10);
  const canClaim = state.lastLoginDate !== today;
  dom.dailyBtn.disabled = !canClaim;
  dom.dailyText.textContent = canClaim
    ? 'Claim +50 coins and a progression boost.'
    : 'Reward claimed today. Come back tomorrow!';
}

function claimDailyReward() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastLoginDate === today) {
    return;
  }
  state.coins += 50;
  addXp(30);
  state.lastLoginDate = today;
  unlockAchievements();
  saveState();
  syncHud(game?.score || 0);
  checkDailyReward();
  beep(880, 0.12);
}

function unlockAchievements() {
  achievements.forEach((item) => {
    if (!state.achievements[item.id] && item.check(state)) {
      state.achievements[item.id] = true;
      beep(720, 0.1);
    }
  });
  renderAchievements();
}

function renderAchievements() {
  dom.achievements.innerHTML = '';
  achievements.forEach((item) => {
    const li = document.createElement('li');
    const unlocked = Boolean(state.achievements[item.id]);
    li.textContent = `${unlocked ? '✅' : '🔒'} ${item.label}`;
    dom.achievements.appendChild(li);
  });
}

function renderLeaderboard() {
  dom.leaderboard.innerHTML = '';
  if (!state.leaderboard.length) {
    const li = document.createElement('li');
    li.textContent = 'No scores yet.';
    dom.leaderboard.appendChild(li);
    return;
  }
  state.leaderboard.forEach((score) => {
    const li = document.createElement('li');
    li.textContent = `${score} pts`;
    dom.leaderboard.appendChild(li);
  });
}

function renderShop() {
  dom.shopItems.innerHTML = '';
  shop[activeTab].forEach((item) => {
    const row = document.createElement('div');
    row.className = 'shop-item';
    const owned = isOwned(item.id, activeTab);
    const equipped = isEquipped(item.id, activeTab);
    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = equipped ? 'Equipped' : owned ? 'Equip' : `${item.price}🪙`;
    button.disabled = equipped;
    button.addEventListener('click', () => buyOrEquip(item, activeTab));
    row.innerHTML = `<div><strong>${item.name}</strong>${item.description ? `<div>${item.description}</div>` : ''}</div>`;
    row.appendChild(button);
    dom.shopItems.appendChild(row);
  });
}

function isOwned(id, tab) {
  if (tab === 'skins') return state.unlockedSkins.includes(id);
  if (tab === 'backgrounds') return state.unlockedBackgrounds.includes(id);
  return state.unlockedPowerups.includes(id);
}

function isEquipped(id, tab) {
  if (tab === 'skins') return state.selectedSkin === id;
  if (tab === 'backgrounds') return state.selectedBackground === id;
  return false;
}

function buyOrEquip(item, tab) {
  if (!isOwned(item.id, tab)) {
    if (state.coins < item.price) {
      beep(220, 0.08);
      return;
    }
    state.coins -= item.price;
    if (tab === 'skins') state.unlockedSkins.push(item.id);
    if (tab === 'backgrounds') state.unlockedBackgrounds.push(item.id);
    if (tab === 'powerups') state.unlockedPowerups.push(item.id);
  }

  if (tab === 'skins') state.selectedSkin = item.id;
  if (tab === 'backgrounds') {
    state.selectedBackground = item.id;
    applyBg();
  }

  unlockAchievements();
  saveState();
  syncHud(game?.score || 0);
  renderShop();
  beep(520, 0.08);
}

function applyBg() {
  const bg = state.selectedBackground;
  if (bg === 'sunset-grid') {
    canvas.style.background = 'linear-gradient(180deg, #4f265f, #1c2742)';
  } else if (bg === 'aurora') {
    canvas.style.background = 'linear-gradient(180deg, #11414e, #2a153d)';
  } else {
    canvas.style.background = 'linear-gradient(180deg, #131f3f, #081128)';
  }
}

function getPlayerColor() {
  if (state.selectedSkin === 'fire') return '#ff7f5c';
  if (state.selectedSkin === 'ice') return '#8ce5ff';
  if (state.selectedSkin === 'cyber') return '#94ff8c';
  return '#f2f5ff';
}

function initGame() {
  game = {
    running: false,
    paused: false,
    playerLane: 0,
    score: 0,
    time: 0,
    entities: [],
    combo: 1,
    shieldUsed: false,
    lastSpawn: 0,
    speedFactor: 1
  };
  if (state.unlockedPowerups.includes('shield')) game.shieldUsed = true;
  if (state.unlockedPowerups.includes('slowTime')) game.speedFactor = 0.88;
  gameLoop(0);
}

function startRun() {
  if (!game) initGame();
  if (game.running) return;
  game.running = true;
  game.paused = false;
  game.score = 0;
  game.time = 0;
  game.lastSpawn = 0;
  game.entities = [];
  game.playerLane = 0;
  game.combo = 1;
  game.coinMultiplier = state.unlockedPowerups.includes('doubleCoins') ? 2 : 1;
  if (state.unlockedPowerups.includes('shield')) game.shieldUsed = true;
  else game.shieldUsed = false;
  if (state.unlockedPowerups.includes('slowTime')) game.speedFactor = 0.88;
  else game.speedFactor = 1;
  dom.startBtn.disabled = true;
  dom.pauseBtn.disabled = false;
  dom.pauseBtn.textContent = 'Pause';
  dom.status.textContent = 'Run started. Avoid pink obstacles; collect gold coins.';
  syncHud(0);
  beep(420, 0.09);
}

function endRun() {
  if (!game?.running) return;
  game.running = false;
  state.totalRuns += 1;
  const finalScore = Math.floor(game.score);
  const coinMultiplier = game.coinMultiplier;
  const coinsEarned = Math.floor(finalScore * config.coinRatio * coinMultiplier);
  state.coins += coinsEarned;
  state.bestScore = Math.max(state.bestScore, finalScore);
  addXp(Math.floor(finalScore * 0.22));
  state.leaderboard.push(finalScore);
  state.leaderboard = state.leaderboard.sort((a, b) => b - a).slice(0, config.maxLeaderboard);
  unlockAchievements();
  saveState();
  syncHud(finalScore);
  dom.startBtn.disabled = false;
  dom.startBtn.textContent = 'Play Again';
  dom.pauseBtn.disabled = true;
  dom.status.textContent = `Run complete: ${finalScore} points · +${coinsEarned} coins · +${Math.floor(finalScore * 0.22)} XP. Best: ${state.bestScore}.`;
  renderLeaderboard();
  renderShop();
  beep(300, 0.15);
}

function spawnEntity() {
  const roll = Math.random();
  const lane = Math.random() > 0.5 ? 1 : 0;
  const type = roll > 0.74 ? 'coin' : 'obstacle';
  game.entities.push({
    type,
    lane,
    y: -40,
    size: type === 'coin' ? 13 : 18,
    spin: 0
  });
}

function moveLane(dir) {
  if (!game || !game.running || game.paused) return;
  game.playerLane = Math.max(0, Math.min(1, game.playerLane + dir));
  beep(560, 0.04);
}

function currentSpeed() {
  const runtimeBoost = Math.min(2.2, 1 + game.time / 30);
  const dynamicBoost = 1 + Math.min(1.3, game.score / 1200);
  return Math.min(config.speedCap, config.baseSpeed * runtimeBoost * dynamicBoost * game.speedFactor);
}

function drawRoad() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const laneX = canvas.width * 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 6;
  for (let i = -20; i < canvas.height; i += 60) {
    const y = (i + (game.time * 240) % 60);
    ctx.beginPath();
    ctx.moveTo(laneX, y);
    ctx.lineTo(laneX, y + 28);
    ctx.stroke();
  }
}

function drawPlayer() {
  const x = canvas.width * config.lanes[game.playerLane];
  const y = canvas.height - 80;
  ctx.fillStyle = getPlayerColor();
  ctx.beginPath();
  ctx.roundRect(x - 22, y - 34, 44, 66, 12);
  ctx.fill();

  if (game.shieldUsed) {
    ctx.strokeStyle = 'rgba(126,255,156,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 40, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEntities(dt) {
  const speed = currentSpeed();
  const playerX = canvas.width * config.lanes[game.playerLane];
  const playerY = canvas.height - 80;

  for (const entity of game.entities) {
    entity.y += speed * dt;
    entity.spin += dt * 8;
    const x = canvas.width * config.lanes[entity.lane];

    if (entity.type === 'coin') {
      ctx.save();
      ctx.translate(x, entity.y);
      ctx.rotate(entity.spin);
      ctx.fillStyle = '#ffd447';
      ctx.fillRect(-12, -12, 24, 24);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ff4d74';
      ctx.beginPath();
      ctx.moveTo(x, entity.y - 20);
      ctx.lineTo(x - 20, entity.y + 20);
      ctx.lineTo(x + 20, entity.y + 20);
      ctx.closePath();
      ctx.fill();
    }

    const hit = Math.abs(entity.y - playerY) < 36 && Math.abs(x - playerX) < 28;
    if (hit && entity.type === 'coin') {
      game.score += 20;
      entity.y = canvas.height + 100;
      beep(760, 0.04);
    }
    if (hit && entity.type === 'obstacle') {
      if (game.shieldUsed) {
        game.shieldUsed = false;
        entity.y = canvas.height + 100;
        beep(250, 0.08);
      } else {
        endRun();
        return;
      }
    }
  }

  game.entities = game.entities.filter((e) => e.y < canvas.height + 60);
}

function update(dt) {
  if (!game.running || game.paused) return;
  game.time += dt;
  game.score += dt * config.scorePerSecond;

  const spawnRate = Math.max(0.24, 0.85 - 0.04 - (game.time * 0.02));
  if (game.time - game.lastSpawn > spawnRate) {
    spawnEntity();
    game.lastSpawn = game.time;
  }

  drawRoad();
  drawPlayer();
  drawEntities(dt);
  if (!game.running) return;
  syncHud(game.score);
}

let last = 0;
function gameLoop(ts) {
  const dt = Math.min(0.033, (ts - last) / 1000 || 0);
  last = ts;
  if (game) {
    if (game.running && !game.paused) update(dt);
    else {
      drawRoad();
      drawPlayer();
    }
  }
  requestAnimationFrame(gameLoop);
}

function beep(freq, duration) {
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!beep.ctx) beep.ctx = new AudioCtx();
    const osc = beep.ctx.createOscillator();
    const gain = beep.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(beep.ctx.destination);
    osc.start();
    osc.stop(beep.ctx.currentTime + duration);
  } catch {
    soundEnabled = false;
    dom.soundBtn.textContent = 'Sound: Off';
    dom.soundBtn.setAttribute('aria-pressed', 'false');
  }
}

window.rewardedAdBridge = {
  requestRewardedAd() {
    return Promise.resolve({ supported: false, reason: 'Rewarded ads are not integrated yet.' });
  }
};

dom.startBtn.addEventListener('click', startRun);
function togglePause() {
  if (!game?.running) return;
  game.paused = !game.paused;
  dom.pauseBtn.textContent = game.paused ? 'Resume' : 'Pause';
  dom.status.textContent = game.paused ? 'Paused. Press Resume when ready.' : 'Run resumed.';
}
dom.pauseBtn.disabled = true;
dom.pauseBtn.addEventListener('click', togglePause);
dom.soundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  dom.soundBtn.textContent = soundEnabled ? 'Sound: On' : 'Sound: Off';
  dom.soundBtn.setAttribute('aria-pressed', String(soundEnabled));
  beep(520, 0.08);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game?.running && !game.paused) togglePause();
});
dom.leftBtn.addEventListener('click', () => moveLane(-1));
dom.rightBtn.addEventListener('click', () => moveLane(1));
document.addEventListener('keydown', (e) => {
  if (e.target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
  if (e.key === ' ' && e.target?.matches?.('button, a')) return;
  if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key) && game?.running) e.preventDefault();
  if (e.repeat) return;
  if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') moveLane(-1);
  if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') moveLane(1);
  if (e.key === ' ') togglePause();
});
dom.dailyBtn.addEventListener('click', claimDailyReward);
dom.tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    dom.tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    renderShop();
  });
});

let noticeSeen = false;
try { noticeSeen = localStorage.getItem(CONSENT_KEY) === '1'; } catch {}
dom.consentModal.classList.toggle('hidden', noticeSeen);
dom.consentBtn.addEventListener('click', () => {
  try { localStorage.setItem(CONSENT_KEY, '1'); } catch {}
  dom.consentModal.classList.add('hidden');
});

applyBg();
syncHud(0);
checkDailyReward();
renderShop();
renderAchievements();
renderLeaderboard();
unlockAchievements();
initGame();

