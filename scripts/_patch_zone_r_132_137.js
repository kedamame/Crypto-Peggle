/**
 * Patch Zone R #132–#137 in one pass.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'CryptoPeggleGame.tsx');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

function after(a, ins, l) {
  if (!s.includes(a)) throw new Error('Missing: ' + l);
  const probe = ins.replace(/\r?\n/g, '').slice(0, 24);
  if (s.replace(/\r\n/g, '\n').includes(probe)) { console.log('skip', l); return; }
  s = s.slice(0, s.indexOf(a) + a.length) + ins + s.slice(s.indexOf(a) + a.length);
  console.log('ok', l);
}
function injectAfterComma(needle, addName) {
  let from = 0, n = 0;
  const token = `, ${needle},`;
  const repl = `, ${needle}, ${addName},`;
  while (n < 14) {
    const i = s.indexOf(token, from);
    if (i < 0) break;
    const slice = s.slice(i, i + token.length + addName.length + 6);
    if (!slice.includes(`, ${addName}`)) {
      s = s.slice(0, i) + repl + s.slice(i + token.length);
      n++;
      console.log('inject', addName, i);
    }
    from = i + 40;
  }
}

// ─── Constants ───────────────────────────────────────────────
after(
  `const HOMO_KICK         = 0.5;   // outward exit kick${nl}`,
  `const ECT_SPD           = 5;     // causal horizon expand px/f${nl}` +
  `const ECT_BAND          = 14;    // causal front band half-width${nl}` +
  `const ECT_KICK          = 0.45;  // outward kick on front cross${nl}` +
  `const DWIND_HALFL       = 120;   // domain-wall induced half-length${nl}` +
  `const DWIND_HALFW       = 4;     // domain-wall induced half-width${nl}` +
  `const DWIND_KICK1       = 0.50;  // primary normal kick${nl}` +
  `const DWIND_KICK2       = 0.22;  // secondary induced kick${nl}` +
  `const DWIND_DELAY       = 8;     // frames before secondary${nl}` +
  `const LATEBOIL_PERIOD   = 380;${nl}` +
  `const LATEBOIL_GROW     = 24;${nl}` +
  `const LATEBOIL_RMAX     = 90;${nl}` +
  `const LATEBOIL_ISW      = 0.08;  // upward ISW during growth${nl}` +
  `const LATEBOIL_POP      = 0.4;   // pop outward kick${nl}` +
  `const BLUETILT_RX       = 110;${nl}` +
  `const BLUETILT_RY       = 70;${nl}` +
  `const BLUETILT_TWIST    = 0.018;${nl}` +
  `const BLUETILT_MIN      = 0.7;   // spd/BALL_SPEED gate${nl}` +
  `const LRDTHOM_R0        = 40;${nl}` +
  `const LRDTHOM_R1        = 70;${nl}` +
  `const LRDTHOM_SCATTER   = 0.04;  // rad speed-preserving scatter${nl}` +
  `const TWINPEAK_R0       = 55;${nl}` +
  `const TWINPEAK_R1       = 120;${nl}` +
  `const TWINPEAK_BAND     = 12;${nl}` +
  `const TWINPEAK_FORCE    = 0.28;${nl}` +
  `const TWINPEAK_OMEGA    = 0.035;${nl}`,
  'ZR consts'
);

// ─── Interfaces ──────────────────────────────────────────────
after(
  `interface HomoShell { x: number; y: number; seed: number; passingBalls: WeakSet<Ball> }${nl}`,
  `// Early causal tensor horizon (lv342+): expanding causal front; one outward kick per ball.${nl}` +
  `interface EctHorizon { cx: number; cy: number; r: number; rMax: number; passingBalls: WeakSet<Ball> }${nl}` +
  `// Domain-wall induced kick (lv345+): normal kick + delayed secondary.${nl}` +
  `interface DwInducedWall { x: number; y: number; angle: number; passingBalls: WeakSet<Ball>; pending: WeakMap<Ball, { t: number; nx: number; ny: number }>; flash: number }${nl}` +
  `// Late vacuum boil (lv348+): ISW upward during grow, then pop outward.${nl}` +
  `interface LateBoil { x: number; y: number; phase: 0 | 1 | 2; timer: number; r: number }${nl}` +
  `// Blue-tilt speed gate (lv351+): twist only for fast balls.${nl}` +
  `interface BlueTiltGate { x: number; y: number; rx: number; ry: number; axis: number }${nl}` +
  `// LRD Thomson cocoon (lv354+): speed-preserving direction scatter in annulus.${nl}` +
  `interface LrdThomsonCocoon { x: number; y: number }${nl}` +
  `// Twin-peak GW shells (lv357+): out-of-phase concentric outward pulses.${nl}` +
  `interface TwinPeakShell { x: number; y: number }${nl}`,
  'ZR ifaces'
);

// ─── GameState ───────────────────────────────────────────────
after(
  `homoShells: HomoShell[]; // lv337+ homogenization transition shell${nl}`,
  `  ectHorizons: EctHorizon[]; // lv342+ early causal tensor horizon${nl}` +
  `  dwInducedWalls: DwInducedWall[]; // lv345+ domain-wall induced kick${nl}` +
  `  lateBoils: LateBoil[]; // lv348+ late vacuum boil${nl}` +
  `  blueTiltGates: BlueTiltGate[]; // lv351+ blue-tilt speed gate${nl}` +
  `  lrdThomsonCocoons: LrdThomsonCocoon[]; // lv354+ LRD Thomson cocoon${nl}` +
  `  twinPeakShells: TwinPeakShell[]; // lv357+ twin-peak GW shells${nl}`,
  'ZR gs'
);

after(
  `const homoShells: HomoShell[] = [];${nl}`,
  `  const ectHorizons: EctHorizon[] = [];${nl}` +
  `  const dwInducedWalls: DwInducedWall[] = [];${nl}` +
  `  const lateBoils: LateBoil[] = [];${nl}` +
  `  const blueTiltGates: BlueTiltGate[] = [];${nl}` +
  `  const lrdThomsonCocoons: LrdThomsonCocoon[] = [];${nl}` +
  `  const twinPeakShells: TwinPeakShell[] = [];${nl}`,
  'ZR empty'
);

s = s.replace(
  'edeWake = null; homoShells.length = 0;',
  'edeWake = null; homoShells.length = 0; ectHorizons.length = 0; dwInducedWalls.length = 0; lateBoils.length = 0; blueTiltGates.length = 0; lrdThomsonCocoons.length = 0; twinPeakShells.length = 0;'
);
console.log('ok clear');

s = s.replace(
  'hpmfLorCorridors, axionIrLines, rsShrinkScars, homoShells, quantumFoams,',
  'hpmfLorCorridors, axionIrLines, rsShrinkScars, homoShells, ectHorizons, dwInducedWalls, lateBoils, blueTiltGates, lrdThomsonCocoons, twinPeakShells, quantumFoams,'
);
console.log('ok anomaly list');

// Spawn after homoShell
{
  const mark =
    `      passingBalls: new WeakSet(),${nl}` +
    `    });${nl}` +
    `  }${nl}` +
    `${nl}` +
    `  // ─── Zone remix (gap levels)`;
  // Find homo shell end more carefully
  const homoEnd =
    `    homoShells.push({${nl}` +
    `      x: W * (0.28 + homoShellRng() * 0.44),${nl}` +
    `      y: topPad + playH * (0.28 + homoShellRng() * 0.40),${nl}` +
    `      seed: (homoShellRng() * 0x100000000) >>> 0,${nl}` +
    `      passingBalls: new WeakSet(),${nl}` +
    `    });${nl}` +
    `  }${nl}`;
  if (!s.includes('ectHorRng')) {
    if (!s.includes(homoEnd)) throw new Error('no homo end');
    const ins =
      `${nl}` +
      `  // Early causal tensor horizon (lv342+).${nl}` +
      `  const ectHorRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 342 &&${nl}` +
      `    gravWaves.length === 0 &&${nl}` +
      `    oddRadioCircles.length === 0 &&${nl}` +
      `    rsShrinkScars.length === 0 &&${nl}` +
      `    !gwBackgroundActive &&${nl}` +
      `    hazChance(ectHorRng, 0.40, 342, level)${nl}` +
      `  ) {${nl}` +
      `    ectHorizons.push({${nl}` +
      `      cx: W * 0.5,${nl}` +
      `      cy: launcherY + 8,${nl}` +
      `      r: 10,${nl}` +
      `      rMax: Math.hypot(W, H) + 40,${nl}` +
      `      passingBalls: new WeakSet(),${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Domain-wall induced kick (lv345+).${nl}` +
      `  const dwIndRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 345 &&${nl}` +
      `    cosmicStrings.length === 0 &&${nl}` +
      `    axionWalls.length === 0 &&${nl}` +
      `    scptWalls.length === 0 &&${nl}` +
      `    axionIrLines.length === 0 &&${nl}` +
      `    hazChance(dwIndRng, 0.40, 345, level)${nl}` +
      `  ) {${nl}` +
      `    dwInducedWalls.push({${nl}` +
      `      x: W * (0.28 + dwIndRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + dwIndRng() * 0.40),${nl}` +
      `      angle: dwIndRng() * Math.PI,${nl}` +
      `      passingBalls: new WeakSet(),${nl}` +
      `      pending: new WeakMap(),${nl}` +
      `      flash: 0,${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Late vacuum boil (lv348+).${nl}` +
      `  const lateBoilRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 348 &&${nl}` +
      `    vacuums.length === 0 &&${nl}` +
      `    vacLeaks.length === 0 &&${nl}` +
      `    bigRip === null &&${nl}` +
      `    bubbleUniverses.length === 0 &&${nl}` +
      `    hazChance(lateBoilRng, 0.35, 348, level)${nl}` +
      `  ) {${nl}` +
      `    lateBoils.push({${nl}` +
      `      x: W * (0.28 + lateBoilRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.30 + lateBoilRng() * 0.40),${nl}` +
      `      phase: 0,${nl}` +
      `      timer: Math.floor(lateBoilRng() * LATEBOIL_PERIOD * 0.6),${nl}` +
      `      r: 0,${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Blue-tilt speed gate (lv351+).${nl}` +
      `  const blueTiltRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 351 &&${nl}` +
      `    hpmfLorCorridors.length === 0 &&${nl}` +
      `    tachyonStreams.length === 0 &&${nl}` +
      `    quantumFoams.length === 0 &&${nl}` +
      `    hazChance(blueTiltRng, 0.40, 351, level)${nl}` +
      `  ) {${nl}` +
      `    blueTiltGates.push({${nl}` +
      `      x: W * (0.28 + blueTiltRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + blueTiltRng() * 0.40),${nl}` +
      `      rx: BLUETILT_RX,${nl}` +
      `      ry: BLUETILT_RY,${nl}` +
      `      axis: blueTiltRng() * Math.PI,${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // LRD Thomson cocoon (lv354+).${nl}` +
      `  const lrdThomRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 354 &&${nl}` +
      `    littleRedDots.length === 0 &&${nl}` +
      `    nakedLrdSeeds.length === 0 &&${nl}` +
      `    bhStarCocoons.length === 0 &&${nl}` +
      `    dressedPbhs.length === 0 &&${nl}` +
      `    hazChance(lrdThomRng, 0.35, 354, level)${nl}` +
      `  ) {${nl}` +
      `    lrdThomsonCocoons.push({${nl}` +
      `      x: W * (0.28 + lrdThomRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + lrdThomRng() * 0.40),${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Twin-peak GW shells (lv357+).${nl}` +
      `  const twinPeakRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 357 &&${nl}` +
      `    gravWaves.length === 0 &&${nl}` +
      `    oddRadioCircles.length === 0 &&${nl}` +
      `    hawkingPoints.length === 0 &&${nl}` +
      `    rsShrinkScars.length === 0 &&${nl}` +
      `    ectHorizons.length === 0 &&${nl}` +
      `    hazChance(twinPeakRng, 0.35, 357, level)${nl}` +
      `  ) {${nl}` +
      `    twinPeakShells.push({${nl}` +
      `      x: W * (0.30 + twinPeakRng() * 0.40),${nl}` +
      `      y: topPad + playH * (0.30 + twinPeakRng() * 0.40),${nl}` +
      `    });${nl}` +
      `  }${nl}`;
    const i = s.indexOf(homoEnd) + homoEnd.length;
    s = s.slice(0, i) + ins + s.slice(i);
    console.log('ok spawn');
  } else console.log('skip spawn');
}

injectAfterComma('homoShells', 'ectHorizons');
injectAfterComma('ectHorizons', 'dwInducedWalls');
injectAfterComma('dwInducedWalls', 'lateBoils');
injectAfterComma('lateBoils', 'blueTiltGates');
injectAfterComma('blueTiltGates', 'lrdThomsonCocoons');
injectAfterComma('lrdThomsonCocoons', 'twinPeakShells');

s = s.replace(
  'homoShells: HomoShell[], cosmicBirefringences:',
  'homoShells: HomoShell[], ectHorizons: EctHorizon[], dwInducedWalls: DwInducedWall[], lateBoils: LateBoil[], blueTiltGates: BlueTiltGate[], lrdThomsonCocoons: LrdThomsonCocoon[], twinPeakShells: TwinPeakShell[], cosmicBirefringences:'
);
console.log('ok gensig');

after(
  `homoShells: [],${nl}`,
  `    ectHorizons: [],${nl}` +
  `    dwInducedWalls: [],${nl}` +
  `    lateBoils: [],${nl}` +
  `    blueTiltGates: [],${nl}` +
  `    lrdThomsonCocoons: [],${nl}` +
  `    twinPeakShells: [],${nl}`,
  'useref'
);
after(
  `g.homoShells = homoShells;${nl}`,
  `    g.ectHorizons = ectHorizons;${nl}` +
  `    g.dwInducedWalls = dwInducedWalls;${nl}` +
  `    g.lateBoils = lateBoils;${nl}` +
  `    g.blueTiltGates = blueTiltGates;${nl}` +
  `    g.lrdThomsonCocoons = lrdThomsonCocoons;${nl}` +
  `    g.twinPeakShells = twinPeakShells;${nl}`,
  'assign'
);

// Revive WeakSets
s = s.replace(
  `g.axionIrLines,${nl}    g.homoShells,${nl}  ] as`,
  `g.axionIrLines,${nl}    g.homoShells,${nl}    g.ectHorizons,${nl}    g.dwInducedWalls,${nl}  ] as`
);
console.log('ok revive');

// Also revive pending WeakMaps for dw walls
if (!s.includes('for (const dw of g.dwInducedWalls)')) {
  const mark = `  if (g.fsCutoffBlade) g.fsCutoffBlade.passingBalls = new WeakSet();${nl}`;
  if (!s.includes(mark)) throw new Error('no fsblade revive');
  const ins =
    `  for (const dw of g.dwInducedWalls) { dw.passingBalls = new WeakSet(); dw.pending = new WeakMap(); }${nl}`;
  s = s.slice(0, s.indexOf(mark) + mark.length) + ins + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok dw revive');
}

// ─── Continuous physics before Magnet (after homo) ───────────
if (!s.includes('Early causal tensor horizon:')) {
  const mag = `          // Magnet attraction${nl}`;
  if (!s.includes(mag)) throw new Error('no magnet');
  // Insert before magnet — but homo is already before magnet. Find homo block end or just before magnet.
  const phys =
    `          // Early causal tensor horizon: outward kick when expanding front sweeps the ball.${nl}` +
    `          for (const eh of g.ectHorizons) {${nl}` +
    `            const dx = ball.x - eh.cx, dy = ball.y - eh.cy;${nl}` +
    `            const dist = Math.hypot(dx, dy);${nl}` +
    `            if (Math.abs(dist - eh.r) > ECT_BAND) continue;${nl}` +
    `            if (eh.passingBalls.has(ball)) continue;${nl}` +
    `            eh.passingBalls.add(ball);${nl}` +
    `            const inv = dist || 1;${nl}` +
    `            const fx = (dx / inv) * ECT_KICK, fy = (dy / inv) * ECT_KICK;${nl}` +
    `            ball.vx += fx; ball.vy += fy;${nl}` +
    `            pulseForceFx(ball, '#98b0c8', fx, fy);${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // Domain-wall induced: apply pending secondary kicks.${nl}` +
    `          for (const dw of g.dwInducedWalls) {${nl}` +
    `            const pend = dw.pending.get(ball);${nl}` +
    `            if (!pend) continue;${nl}` +
    `            pend.t--;${nl}` +
    `            if (pend.t > 0) continue;${nl}` +
    `            dw.pending.delete(ball);${nl}` +
    `            const fx = pend.nx * DWIND_KICK2, fy = pend.ny * DWIND_KICK2;${nl}` +
    `            ball.vx += fx; ball.vy += fy;${nl}` +
    `            ball.fxTrail = 6; ball.fxTrailColor = '#e8d0a0';${nl}` +
    `            pulseForceFx(ball, '#e8d0a0', fx, fy);${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // Late vacuum boil: ISW upward during grow; pop handled in draw.${nl}` +
    `          for (const lb of g.lateBoils) {${nl}` +
    `            if (lb.phase !== 1 || lb.r <= 0) continue;${nl}` +
    `            const dx = ball.x - lb.x, dy = ball.y - lb.y;${nl}` +
    `            if (dx * dx + dy * dy >= lb.r * lb.r) continue;${nl}` +
    `            ball.vy -= LATEBOIL_ISW;${nl}` +
    `            ball.vx += (ball.x < lb.x ? -1 : 1) * 0.01;${nl}` +
    `            pulseFieldFx(ball, '#d0b8b0');${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // Blue-tilt speed gate: twist only for fast balls.${nl}` +
    `          for (const bg of g.blueTiltGates) {${nl}` +
    `            const dx = ball.x - bg.x, dy = ball.y - bg.y;${nl}` +
    `            const c = Math.cos(bg.axis), sn = Math.sin(bg.axis);${nl}` +
    `            const lx = c * dx + sn * dy;${nl}` +
    `            const ly = -sn * dx + c * dy;${nl}` +
    `            if ((lx * lx) / (bg.rx * bg.rx) + (ly * ly) / (bg.ry * bg.ry) > 1) continue;${nl}` +
    `            const spd = Math.hypot(ball.vx, ball.vy);${nl}` +
    `            if (spd < BALL_SPEED * BLUETILT_MIN) continue;${nl}` +
    `            const bi = g.balls.indexOf(ball);${nl}` +
    `            const dTh = BLUETILT_TWIST * (spd / BALL_SPEED) * (spd / BALL_SPEED) * Math.sin(g.frame * 0.29 + bi * 1.3);${nl}` +
    `            const bc = Math.cos(dTh), bs = Math.sin(dTh);${nl}` +
    `            const nvx = ball.vx * bc - ball.vy * bs;${nl}` +
    `            ball.vy = ball.vx * bs + ball.vy * bc;${nl}` +
    `            ball.vx = nvx;${nl}` +
    `            if (g.frame % 5 === 0) pulseTwistFx(ball, '#40a8c8', dTh >= 0 ? 1 : -1);${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // LRD Thomson cocoon: speed-preserving scatter in annulus.${nl}` +
    `          for (const tc of g.lrdThomsonCocoons) {${nl}` +
    `            const dx = ball.x - tc.x, dy = ball.y - tc.y;${nl}` +
    `            const dist = Math.hypot(dx, dy);${nl}` +
    `            if (dist < LRDTHOM_R0 || dist > LRDTHOM_R1) continue;${nl}` +
    `            const bi = g.balls.indexOf(ball);${nl}` +
    `            const h = ((Math.imul((Math.floor(ball.x) ^ Math.floor(ball.y) ^ (bi * 2654435761)), 1597334677) >>> 0) / 4294967296);${nl}` +
    `            const dTh = (h * 2 - 1) * LRDTHOM_SCATTER;${nl}` +
    `            const spd0 = Math.hypot(ball.vx, ball.vy);${nl}` +
    `            const bc = Math.cos(dTh), bs = Math.sin(dTh);${nl}` +
    `            const nvx = ball.vx * bc - ball.vy * bs;${nl}` +
    `            ball.vy = ball.vx * bs + ball.vy * bc;${nl}` +
    `            ball.vx = nvx;${nl}` +
    `            const spd1 = Math.hypot(ball.vx, ball.vy) || 1;${nl}` +
    `            if (spd0 > 1e-6) { ball.vx *= spd0 / spd1; ball.vy *= spd0 / spd1; }${nl}` +
    `            if (g.frame % 4 === 0) {${nl}` +
    `              pulseTwistFx(ball, '#c87050', dTh >= 0 ? 1 : -1);${nl}` +
    `              ball.fxTrail = 5; ball.fxTrailColor = '#c87050';${nl}` +
    `            }${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // Twin-peak GW shells: out-of-phase concentric outward bands.${nl}` +
    `          for (const tp of g.twinPeakShells) {${nl}` +
    `            const dx = ball.x - tp.x, dy = ball.y - tp.y;${nl}` +
    `            const dist = Math.hypot(dx, dy);${nl}` +
    `            const inv = dist || 1;${nl}` +
    `            const breath0 = 0.5 + 0.5 * Math.sin(g.frame * TWINPEAK_OMEGA);${nl}` +
    `            const breath1 = 0.5 + 0.5 * Math.sin(g.frame * TWINPEAK_OMEGA + Math.PI);${nl}` +
    `            const r0 = TWINPEAK_R0 * (0.85 + 0.15 * breath0);${nl}` +
    `            const r1 = TWINPEAK_R1 * (0.85 + 0.15 * breath1);${nl}` +
    `            if (Math.abs(dist - r0) <= TWINPEAK_BAND) {${nl}` +
    `              const t = 1 - Math.abs(dist - r0) / TWINPEAK_BAND;${nl}` +
    `              const f = TWINPEAK_FORCE * t * t * breath0;${nl}` +
    `              const fx = (dx / inv) * f, fy = (dy / inv) * f;${nl}` +
    `              ball.vx += fx; ball.vy += fy;${nl}` +
    `              if (f > 0.05) pulseForceFx(ball, '#e8e8e0', fx, fy);${nl}` +
    `            }${nl}` +
    `            if (Math.abs(dist - r1) <= TWINPEAK_BAND) {${nl}` +
    `              const t = 1 - Math.abs(dist - r1) / TWINPEAK_BAND;${nl}` +
    `              const f = TWINPEAK_FORCE * t * t * breath1;${nl}` +
    `              const fx = (dx / inv) * f, fy = (dy / inv) * f;${nl}` +
    `              ball.vx += fx; ball.vy += fy;${nl}` +
    `              if (f > 0.05) pulseForceFx(ball, '#8890a0', fx, fy);${nl}` +
    `            }${nl}` +
    `          }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mag)) + phys + mag + s.slice(s.indexOf(mag) + mag.length);
  console.log('ok cont phys');
}

// ─── Substep: DW wall near axion IR / cosmic strings ─────────
if (!s.includes('Domain-wall induced kick:')) {
  const mark = `              // Axion IR decay line: one tangent kick + micro-twist per crossing.${nl}`;
  const alt = `              if (!teleported) for (const al of g.axionIrLines) {${nl}`;
  const at = s.includes(mark) ? mark : alt;
  if (!s.includes(at)) throw new Error('no axir substep mark');
  const sub =
    `              // Domain-wall induced kick: normal primary + delayed secondary.${nl}` +
    `              if (!teleported) for (const dw of g.dwInducedWalls) {${nl}` +
    `                const inside = testBallOBB(ball, dw.x, dw.y, DWIND_HALFL * 2, DWIND_HALFW * 2, dw.angle);${nl}` +
    `                if (!inside) { dw.passingBalls.delete(ball); continue; }${nl}` +
    `                if (dw.passingBalls.has(ball)) continue;${nl}` +
    `                dw.passingBalls.add(ball);${nl}` +
    `                const nx = -Math.sin(dw.angle), ny = Math.cos(dw.angle);${nl}` +
    `                const side = ((ball.x - dw.x) * nx + (ball.y - dw.y) * ny) >= 0 ? 1 : -1;${nl}` +
    `                const fx = nx * side * DWIND_KICK1, fy = ny * side * DWIND_KICK1;${nl}` +
    `                ball.vx += fx; ball.vy += fy;${nl}` +
    `                dw.pending.set(ball, { t: DWIND_DELAY, nx: nx * side, ny: ny * side });${nl}` +
    `                dw.flash = 12;${nl}` +
    `                pulseForceFx(ball, '#c8a060', fx, fy);${nl}` +
    `              }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(at)) + sub + at + s.slice(s.indexOf(at) + at.length);
  console.log('ok dw substep');
}

// ─── Draw before Homogenization draw ─────────────────────────
if (!s.includes('── Early causal tensor horizon')) {
  const mark = `      // ── Homogenization transition shell (lv337+) ──${nl}`;
  if (!s.includes(mark)) throw new Error('no homo draw');
  const draw =
    `      // ── Early causal tensor horizon (lv342+) ──${nl}` +
    `      for (const eh of g.ectHorizons) {${nl}` +
    `        eh.r += ECT_SPD;${nl}` +
    `        if (eh.r > eh.rMax) { eh.r = 10; eh.passingBalls = new WeakSet(); }${nl}` +
    `        ctx.fillStyle = '#98b0c8';${nl}` +
    `        for (let i = 0; i < 56; i++) {${nl}` +
    `          if (i % 4 === 0) continue;${nl}` +
    `          const a = (i / 56) * Math.PI * 2;${nl}` +
    `          ctx.globalAlpha = 0.32;${nl}` +
    `          ctx.fillRect(Math.round(eh.cx + Math.cos(a) * eh.r), Math.round(eh.cy + Math.sin(a) * eh.r), 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}` +
    `      // ── Domain-wall induced kick (lv345+) ──${nl}` +
    `      for (const dw of g.dwInducedWalls) {${nl}` +
    `        if (dw.flash > 0) dw.flash--;${nl}` +
    `        const c = Math.cos(dw.angle), sn = Math.sin(dw.angle);${nl}` +
    `        ctx.fillStyle = '#c8a060';${nl}` +
    `        for (let i = -12; i <= 12; i++) {${nl}` +
    `          if (i % 3 === 0) continue;${nl}` +
    `          const t = i / 12;${nl}` +
    `          const px = dw.x + c * t * DWIND_HALFL;${nl}` +
    `          const py = dw.y + sn * t * DWIND_HALFL;${nl}` +
    `          ctx.globalAlpha = dw.flash > 0 ? 0.55 : 0.28;${nl}` +
    `          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);${nl}` +
    `        }${nl}` +
    `        if (dw.flash > 0) {${nl}` +
    `          const nx = -sn, ny = c;${nl}` +
    `          ctx.fillStyle = '#e8d0a0';${nl}` +
    `          for (let i = 0; i < 8; i++) {${nl}` +
    `            const a = (i / 8) * Math.PI;${nl}` +
    `            ctx.globalAlpha = 0.2;${nl}` +
    `            ctx.fillRect(Math.round(dw.x + nx * Math.cos(a) * 18), Math.round(dw.y + ny * Math.cos(a) * 18), 1, 1);${nl}` +
    `          }${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}` +
    `      // ── Late vacuum boil (lv348+) ──${nl}` +
    `      for (const lb of g.lateBoils) {${nl}` +
    `        lb.timer--;${nl}` +
    `        if (lb.phase === 0) {${nl}` +
    `          lb.r = 0;${nl}` +
    `          if (lb.timer <= 0) { lb.phase = 1; lb.timer = LATEBOIL_GROW; }${nl}` +
    `        } else if (lb.phase === 1) {${nl}` +
    `          const u = 1 - lb.timer / LATEBOIL_GROW;${nl}` +
    `          lb.r = LATEBOIL_RMAX * u;${nl}` +
    `          if (lb.timer <= 0) {${nl}` +
    `            // Pop: shove nearby balls outward once.${nl}` +
    `            for (const b of g.balls) {${nl}` +
    `              const dx = b.x - lb.x, dy = b.y - lb.y;${nl}` +
    `              const d2 = dx * dx + dy * dy;${nl}` +
    `              if (d2 >= LATEBOIL_RMAX * LATEBOIL_RMAX || d2 === 0) continue;${nl}` +
    `              const d = Math.sqrt(d2);${nl}` +
    `              const fx = (dx / d) * LATEBOIL_POP, fy = (dy / d) * LATEBOIL_POP;${nl}` +
    `              b.vx += fx; b.vy += fy;${nl}` +
    `              pulseForceFx(b, '#e8c8c0', fx, fy);${nl}` +
    `            }${nl}` +
    `            lb.phase = 2; lb.timer = 8; lb.r = LATEBOIL_RMAX;${nl}` +
    `          }${nl}` +
    `        } else {${nl}` +
    `          if (lb.timer <= 0) { lb.phase = 0; lb.timer = LATEBOIL_PERIOD; lb.r = 0; }${nl}` +
    `        }${nl}` +
    `        if (lb.r > 2) {${nl}` +
    `          ctx.fillStyle = lb.phase === 2 ? '#fff8f0' : '#d0b8b0';${nl}` +
    `          for (let i = 0; i < 40; i++) {${nl}` +
    `            if (i % 4 === 0) continue;${nl}` +
    `            const a = (i / 40) * Math.PI * 2;${nl}` +
    `            ctx.globalAlpha = lb.phase === 2 ? 0.5 : 0.22;${nl}` +
    `            ctx.fillRect(Math.round(lb.x + Math.cos(a) * lb.r), Math.round(lb.y + Math.sin(a) * lb.r), 1, 1);${nl}` +
    `          }${nl}` +
    `          ctx.globalAlpha = 1;${nl}` +
    `        }${nl}` +
    `      }${nl}` +
    `${nl}` +
    `      // ── Blue-tilt speed gate (lv351+) ──${nl}` +
    `      for (const bg of g.blueTiltGates) {${nl}` +
    `        const c = Math.cos(bg.axis), sn = Math.sin(bg.axis);${nl}` +
    `        ctx.fillStyle = '#40a8c8';${nl}` +
    `        for (let i = 0; i < 32; i++) {${nl}` +
    `          const a = (i / 32) * Math.PI * 2;${nl}` +
    `          const px = bg.rx * Math.cos(a);${nl}` +
    `          const py = bg.ry * Math.sin(a);${nl}` +
    `          const wx = bg.x + c * px - sn * py;${nl}` +
    `          const wy = bg.y + sn * px + c * py;${nl}` +
    `          if (i % 3 === 0) continue;${nl}` +
    `          ctx.globalAlpha = 0.2;${nl}` +
    `          ctx.fillRect(Math.round(wx), Math.round(wy), 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}` +
    `      // ── LRD Thomson cocoon (lv354+) ──${nl}` +
    `      for (const tc of g.lrdThomsonCocoons) {${nl}` +
    `        ctx.fillStyle = '#c87050';${nl}` +
    `        for (let i = 0; i < 36; i++) {${nl}` +
    `          if (i % 4 === 0) continue;${nl}` +
    `          const a = (i / 36) * Math.PI * 2;${nl}` +
    `          const rr = (i % 2 === 0) ? LRDTHOM_R0 : LRDTHOM_R1;${nl}` +
    `          ctx.globalAlpha = 0.26;${nl}` +
    `          ctx.fillRect(Math.round(tc.x + Math.cos(a) * rr), Math.round(tc.y + Math.sin(a) * rr), 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}` +
    `      // ── Twin-peak GW shells (lv357+) ──${nl}` +
    `      for (const tp of g.twinPeakShells) {${nl}` +
    `        const breath0 = 0.5 + 0.5 * Math.sin(g.frame * TWINPEAK_OMEGA);${nl}` +
    `        const breath1 = 0.5 + 0.5 * Math.sin(g.frame * TWINPEAK_OMEGA + Math.PI);${nl}` +
    `        const r0 = TWINPEAK_R0 * (0.85 + 0.15 * breath0);${nl}` +
    `        const r1 = TWINPEAK_R1 * (0.85 + 0.15 * breath1);${nl}` +
    `        for (let ring = 0; ring < 2; ring++) {${nl}` +
    `          const rr = ring === 0 ? r0 : r1;${nl}` +
    `          const al = ring === 0 ? breath0 : breath1;${nl}` +
    `          ctx.fillStyle = ring === 0 ? '#e8e8e0' : '#8890a0';${nl}` +
    `          for (let i = 0; i < 48; i++) {${nl}` +
    `            if (i % 5 === 0) continue;${nl}` +
    `            const a = (i / 48) * Math.PI * 2;${nl}` +
    `            ctx.globalAlpha = 0.12 + 0.28 * al;${nl}` +
    `            ctx.fillRect(Math.round(tp.x + Math.cos(a) * rr), Math.round(tp.y + Math.sin(a) * rr), 1, 1);${nl}` +
    `          }${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('DONE Zone R #132-137');
