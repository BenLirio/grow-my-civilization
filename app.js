// Grow My Civilization — pixel civilization sim seeded by today's date
// Deterministic: same date = same fate for all viewers

// ── Seeded RNG ────────────────────────────────────────────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function dateSeed() {
  const d = new Date();
  const s = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  // Allow URL fragment override for share replay
  const frag = location.hash.replace('#','');
  if (frag && /^\d{8}$/.test(frag)) return parseInt(frag, 10);
  return parseInt(s, 10);
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Civilization Verdicts ─────────────────────────────────────────────────────
const TRIUMPH_VERDICTS = [
  {
    name: "The Titanium Dreamers",
    epitaph: "Exhibit 7 — They launched into the void before they finished their roads, and somehow that was the correct order of operations."
  },
  {
    name: "The Accidental Philosophers",
    epitaph: "Exhibit 12 — Every major discovery was made by someone trying to do something else entirely. They considered this a feature."
  },
  {
    name: "The Fungal Diplomats",
    epitaph: "Exhibit 3 — First civilization to negotiate peace using fermented beverages as currency. It worked embarrassingly well."
  },
  {
    name: "The Recursive Architects",
    epitaph: "Exhibit 9 — Built a city inside a building inside a city. Historians are still arguing about where the irony ends."
  },
  {
    name: "The Reluctant Conquerors",
    epitaph: "Exhibit 2 — Expanded their empire mainly because they kept accidentally wandering too far from camp."
  },
  {
    name: "The Extremely Organised Foragers",
    epitaph: "Exhibit 15 — Invented the calendar to track berry seasons. Used it instead to schedule the heat death of three neighbouring tribes."
  }
];

const COLLAPSE_VERDICTS = [
  {
    name: "The Bronze Age Cowards",
    epitaph: "Exhibit 4 — Survived every predator, plague, and ice age, then disbanded over a disagreement about grain storage quotas."
  },
  {
    name: "The Uranium Gourmands",
    epitaph: "Exhibit 8 — Discovered elemental energy and immediately asked whether it tasted good. The answer, they learned, was irrelevant."
  },
  {
    name: "The Paperclip Maximalists",
    epitaph: "Exhibit 6 — Optimised production so efficiently that by the end, there was nothing left to optimise — including them."
  },
  {
    name: "The Confident Astronomers",
    epitaph: "Exhibit 11 — Correctly predicted every comet for 400 years. Did not predict the one that landed on their observatory."
  },
  {
    name: "The Mild-Mannered Tyrants",
    epitaph: "Exhibit 1 — Their empire collapsed so politely that neighbouring kingdoms sent condolence letters. Several were unanswered."
  },
  {
    name: "The Infrastructure Optimists",
    epitaph: "Exhibit 14 — Built roads to everywhere. Forgot to build anywhere worth going. Left anyway."
  },
  {
    name: "The Coral Bureaucrats",
    epitaph: "Exhibit 5 — Their filing system survived them by 300 years. Archaeologists found 40,000 forms requesting permission to file fewer forms."
  }
];

// ── Era Definitions ───────────────────────────────────────────────────────────
const ERAS = [
  { name: "STONE AGE",   color: "#5a4a3a", duration: 12 },
  { name: "COPPER AGE",  color: "#8b6a3a", duration: 10 },
  { name: "BRONZE AGE",  color: "#a07830", duration: 10 },
  { name: "IRON AGE",    color: "#6a7a8a", duration: 10 },
  { name: "CLASSICAL",   color: "#c8a84a", duration: 10 },
  { name: "MEDIEVAL",    color: "#5a8a5a", duration: 10 },
  { name: "RENAISSANCE", color: "#a05a78", duration: 8  },
  { name: "INDUSTRIAL",  color: "#888888", duration: 8  },
  { name: "ATOMIC",      color: "#5a9aaa", duration: 7  },
  { name: "DIGITAL",     color: "#6a5aaa", duration: 5  },
];

const TOTAL_DURATION = ERAS.reduce((s, e) => s + e.duration, 0); // ~90 seconds

// ── Canvas Setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 360, H = 300;

// ── Simulation State ──────────────────────────────────────────────────────────
let rng;
let seed;
let startTime;
let animId;
let phase = 'loading'; // loading | running | verdict
let population = 0;
let maxPop = 0;
let currentEraIdx = 0;
let eraProgress = 0;
let collapseTriggered = false;
let collapseTime = -1;
let triumphTriggered = false;

// Pixel entities
let buildings = [];
let people = [];
let fires = [];
let explosions = [];
let stars = [];

// ── Palette ───────────────────────────────────────────────────────────────────
const SKY_COLORS = [
  ['#0d0d2a', '#1a1a3a'],  // night
  ['#0d0d2a', '#1a1a3a'],
  ['#1a1430', '#2a1a40'],
  ['#2a1830', '#3a2840'],
  ['#2a2040', '#4a3050'],
  ['#3a2840', '#5a3858'],
  ['#2a2848', '#3a3858'],
  ['#1a1840', '#2a2848'],
  ['#1a1838', '#1a1838'],
  ['#0d0d20', '#0d0d20'],
];

const BUILDING_COLORS = [
  ['#5a4a3a','#3a2a2a'],  // stone age
  ['#8b6030','#5a3820'],
  ['#a07028','#6a4818'],
  ['#707888','#484e58'],
  ['#c8a040','#888030'],
  ['#507848','#305830'],
  ['#903870','#601848'],
  ['#787878','#484848'],
  ['#4888a0','#285878'],
  ['#584898','#382868'],
];

// ── Initialization ─────────────────────────────────────────────────────────────
function initSim() {
  seed = dateSeed();
  rng = mulberry32(seed);

  document.getElementById('seed-value').textContent = seed;

  // Show URL fragment for sharing
  if (!location.hash) {
    history.replaceState(null, '', '#' + seed);
  }

  // Pregenerate stars
  stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({ x: rng() * W, y: rng() * (H * 0.55), r: rng() < 0.3 ? 2 : 1 });
  }

  // Determine fate (triumph vs collapse) seeded deterministically
  const fateVal = rng();
  collapseTriggered = fateVal < 0.55; // 55% chance collapse

  // Pick verdict
  const verdictPool = collapseTriggered ? COLLAPSE_VERDICTS : TRIUMPH_VERDICTS;
  const verdictIdx = Math.floor(rng() * verdictPool.length);
  window._verdict = verdictPool[verdictIdx];
  window._isCollapse = collapseTriggered;

  // Choose collapse era (not first, not last)
  if (collapseTriggered) {
    collapseTime = 3 + Math.floor(rng() * (ERAS.length - 4));
  }

  // Initial campfire
  fires = [{ x: W / 2, y: H - 60, size: 6, age: 0 }];
  buildings = [];
  people = [];
  explosions = [];
  population = 1;
  maxPop = 1;
  currentEraIdx = 0;
  eraProgress = 0;
}

// ── Update Logic ──────────────────────────────────────────────────────────────
function tick(elapsed, dt) {
  const totalSec = TOTAL_DURATION;
  const t = Math.min(elapsed / 1000, totalSec);
  const progress = t / totalSec;

  // Compute current era
  let acc = 0;
  for (let i = 0; i < ERAS.length; i++) {
    acc += ERAS[i].duration;
    if (t <= acc || i === ERAS.length - 1) {
      currentEraIdx = i;
      const eraStart = acc - ERAS[i].duration;
      eraProgress = (t - eraStart) / ERAS[i].duration;
      break;
    }
  }

  // Population grows, then potentially collapses
  const growthCurve = Math.sin(progress * Math.PI / 2);
  const targetPop = Math.floor(growthCurve * 150) + 1;

  if (collapseTriggered && currentEraIdx >= collapseTime) {
    const collapseProgress = Math.min((currentEraIdx - collapseTime) / 2 + eraProgress, 1);
    population = Math.max(1, Math.floor(targetPop * (1 - collapseProgress * 0.9)));
    if (population < 3 && !explosions.length) spawnExplosions();
  } else {
    population = targetPop;
  }

  maxPop = Math.max(maxPop, population);

  // Spawn/prune buildings
  const targetBuildings = Math.floor(population * 0.6);
  while (buildings.length < targetBuildings) spawnBuilding();
  while (buildings.length > targetBuildings + 2) buildings.shift();

  // Spawn/prune people
  const targetPeople = Math.min(population, 20);
  while (people.length < targetPeople) spawnPerson();
  while (people.length > targetPeople) people.shift();

  // Update fires
  fires.forEach(f => { f.age += dt; f.flicker = Math.sin(f.age * 0.008 + rng() * 0.5) * 1.5; });

  // Update people movement
  people.forEach(p => {
    p.x += p.vx;
    p.y += p.vy * 0.3;
    if (p.x < 5 || p.x > W - 5) p.vx *= -1;
    if (p.y < H - 80 || p.y > H - 20) p.vy *= -1;
    p.animFrame = (p.animFrame + dt * 0.01) % 4;
  });

  // Update explosions
  explosions = explosions.filter(e => e.age < e.life);
  explosions.forEach(e => { e.age += dt; e.x += e.vx; e.y += e.vy; e.vy += 0.05; });

  // Update stats
  document.getElementById('stat-pop').textContent = population.toLocaleString();
  document.getElementById('stat-era').textContent = ERAS[currentEraIdx].name.split(' ')[0];
  document.getElementById('stat-fate').textContent = (collapseTriggered && currentEraIdx >= collapseTime) ? 'FALLING' : 'RISING';

  document.getElementById('era-label').textContent = ERAS[currentEraIdx].name;

  // End condition
  if (elapsed / 1000 >= totalSec) {
    return true; // done
  }
  return false;
}

function spawnBuilding() {
  const e = currentEraIdx;
  const x = 20 + rng() * (W - 40);
  const groundY = H - 30;
  const h = 12 + Math.floor(rng() * (8 + e * 3));
  const w = 10 + Math.floor(rng() * (6 + e * 2));
  buildings.push({ x, y: groundY - h, w, h, era: e });
}

function spawnPerson() {
  people.push({
    x: 20 + rng() * (W - 40),
    y: H - 30 - rng() * 30,
    vx: (rng() - 0.5) * 0.8,
    vy: (rng() - 0.5) * 0.4,
    color: rng() < 0.5 ? '#ffcc88' : '#cc8844',
    animFrame: rng() * 4,
    era: currentEraIdx
  });
}

function spawnExplosions() {
  for (let i = 0; i < 20; i++) {
    explosions.push({
      x: 20 + rng() * (W - 40),
      y: H - 40 - rng() * 60,
      vx: (rng() - 0.5) * 2,
      vy: -rng() * 3,
      life: 800 + rng() * 400,
      age: 0,
      color: rng() < 0.5 ? '#ff6633' : '#ffaa33'
    });
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function draw(elapsed) {
  const t = Math.min(elapsed / 1000, TOTAL_DURATION);
  const progress = t / TOTAL_DURATION;
  const ei = currentEraIdx;

  ctx.clearRect(0, 0, W, H);

  // Sky gradient
  const [sky1, sky2] = SKY_COLORS[Math.min(ei, SKY_COLORS.length - 1)];
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  skyGrad.addColorStop(0, sky1);
  skyGrad.addColorStop(1, sky2);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.65);

  // Ground
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  // Stars (fade out in later eras = progress civilisation = more light pollution)
  const starAlpha = Math.max(0, 1 - progress * 1.2);
  if (starAlpha > 0) {
    ctx.globalAlpha = starAlpha;
    ctx.fillStyle = '#ffffff';
    stars.forEach(s => {
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.r, s.r);
    });
    ctx.globalAlpha = 1;
  }

  // Moon/Sun
  const celestialY = 20 + progress * H * 0.35;
  if (progress < 0.5) {
    // Moon
    ctx.fillStyle = '#ddeeff';
    ctx.beginPath(); ctx.arc(W * 0.8, celestialY, 14, 0, Math.PI * 2); ctx.fill();
  } else {
    // Sun rises
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath(); ctx.arc(W * 0.75, celestialY, 16, 0, Math.PI * 2); ctx.fill();
    // Sun glow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ffaa22';
    ctx.beginPath(); ctx.arc(W * 0.75, celestialY, 28, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Horizon line
  ctx.fillStyle = '#2a1a08';
  ctx.fillRect(0, H * 0.65 - 2, W, 4);

  // Buildings (sorted back to front by y)
  const sorted = [...buildings].sort((a, b) => a.y - b.y);
  sorted.forEach(b => {
    const [bc1, bc2] = BUILDING_COLORS[Math.min(b.era, BUILDING_COLORS.length - 1)];
    ctx.fillStyle = bc1;
    ctx.fillRect(Math.floor(b.x - b.w / 2), Math.floor(b.y), b.w, b.h);
    // Shadow side
    ctx.fillStyle = bc2;
    ctx.fillRect(Math.floor(b.x + b.w / 2 - 3), Math.floor(b.y), 3, b.h);
    // Window pixels
    if (b.h > 18 && b.w > 8) {
      ctx.fillStyle = '#ffee88';
      ctx.globalAlpha = 0.7;
      for (let wy = b.y + 4; wy < b.y + b.h - 4; wy += 6) {
        for (let wx = b.x - b.w / 2 + 2; wx < b.x + b.w / 2 - 4; wx += 6) {
          if (rng() < 0.6) ctx.fillRect(Math.floor(wx), Math.floor(wy), 2, 2);
        }
      }
      ctx.globalAlpha = 1;
    }
  });

  // Fires
  fires.forEach(f => {
    const flicker = f.flicker || 0;
    // Outer glow
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#ff8800';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.size * 2.5 + flicker, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Fire body
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(Math.floor(f.x - f.size / 2), Math.floor(f.y - f.size + flicker), f.size, f.size);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(Math.floor(f.x - f.size / 3), Math.floor(f.y - f.size * 0.7 + flicker), f.size * 0.65, f.size * 0.65);
    ctx.fillStyle = '#ffee44';
    ctx.fillRect(Math.floor(f.x - 2), Math.floor(f.y - f.size * 0.4 + flicker), 4, 4);
  });

  // People (tiny 2px sprites)
  people.forEach(p => {
    ctx.fillStyle = p.color;
    const bobY = Math.floor(p.y + Math.sin(p.animFrame * Math.PI * 2) * 1.5);
    ctx.fillRect(Math.floor(p.x) - 1, bobY - 4, 3, 4); // body
    ctx.fillStyle = '#ffcc88';
    ctx.fillRect(Math.floor(p.x) - 1, bobY - 7, 3, 3); // head
  });

  // Explosions (collapse visual)
  explosions.forEach(e => {
    const a = 1 - e.age / e.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = e.color;
    const s = Math.max(1, Math.floor(3 * a));
    ctx.fillRect(Math.floor(e.x) - s, Math.floor(e.y) - s, s * 2, s * 2);
    ctx.globalAlpha = 1;
  });

  // Progress bar at bottom
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, H - 6, W, 6);
  const barColor = (collapseTriggered && currentEraIdx >= collapseTime) ? '#ff3333' : '#00ff41';
  ctx.fillStyle = barColor;
  const barW = Math.floor((elapsed / (TOTAL_DURATION * 1000)) * W);
  ctx.fillRect(0, H - 6, Math.min(barW, W), 6);
}

// ── Main Loop ─────────────────────────────────────────────────────────────────
function loop(startTs) {
  return function frame(ts) {
    const elapsed = ts - startTs;
    const dt = 16; // target 60fps, dt ~16ms

    const done = tick(elapsed, dt);
    draw(elapsed);

    if (done) {
      showVerdict(elapsed);
      return;
    }

    animId = requestAnimationFrame(frame);
  };
}

function showVerdict(elapsed) {
  const v = window._verdict;
  const isCollapse = window._isCollapse;

  document.getElementById('loading-panel').style.display = 'none';

  const panel = document.getElementById('verdict-panel');
  panel.style.display = 'flex';
  document.getElementById('verdict-name').textContent = v.name;
  document.getElementById('verdict-epitaph').textContent = v.epitaph;

  const statsEl = document.getElementById('verdict-stats');
  statsEl.innerHTML = [
    `► PEAK POPULATION: ${maxPop.toLocaleString()}`,
    `► ERAS SURVIVED: ${currentEraIdx + 1} / ${ERAS.length}`,
    `► OUTCOME: ${isCollapse ? 'COLLAPSE' : 'EMPIRE'}`,
    `► SEED: ${seed}`
  ].join('<br>');

  document.getElementById('app').className = isCollapse ? 'verdict-collapse' : 'verdict-triumph';
  document.getElementById('share').style.display = 'block';

  // Update fate stat
  document.getElementById('stat-fate').textContent = isCollapse ? 'RUIN' : 'GLORY';
}

// ── Share ─────────────────────────────────────────────────────────────────────
function share() {
  const url = location.href.split('#')[0] + '#' + seed;
  if (navigator.share) {
    navigator.share({ title: document.title + ' — ' + (window._verdict ? window._verdict.name : ''), url });
  } else {
    navigator.clipboard.writeText(url)
      .then(() => alert('Link copied! Everyone who opens it sees the same fate.'));
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // 1) Show loading message for 800ms, then start
  document.getElementById('loading-text').textContent = 'consulting the oracle of epochs...';

  initSim();

  setTimeout(() => {
    document.getElementById('loading-panel').style.display = 'none';

    startTime = performance.now();
    animId = requestAnimationFrame(loop(startTime));
  }, 800);
});
