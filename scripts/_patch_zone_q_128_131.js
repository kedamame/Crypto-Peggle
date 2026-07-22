/**
 * Patch Zone Q #128–#131 in one pass (writes at end).
 * Anchor: after dblReion wiring.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'CryptoPeggleGame.tsx');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

function after(a, ins, l) {
  if (!s.includes(a)) throw new Error('Missing: ' + l);
  const probe = ins.replace(/\r?\n/g, '').slice(0, 26);
  if (s.replace(/\r\n/g, '\n').includes(probe)) { console.log('skip', l); return; }
  s = s.slice(0, s.indexOf(a) + a.length) + ins + s.slice(s.indexOf(a) + a.length);
  console.log('ok', l);
}
function injectAfterComma(needle, addName) {
  let from = 0, n = 0;
  const token = `, ${needle},`;
  const repl = `, ${needle}, ${addName},`;
  while (n < 12) {
    const i = s.indexOf(token, from);
    if (i < 0) break;
    const slice = s.slice(i, i + token.length + addName.length + 4);
    if (!slice.includes(`, ${addName},`) && !slice.includes(`, ${addName}`)) {
      s = s.slice(0, i) + repl + s.slice(i + token.length);
      n++;
      console.log('inject', addName, i);
    }
    from = i + 40;
  }
}

// ─── Constants ───────────────────────────────────────────────
after(
  `const DBLREION_SPD      = 4;     // front descent px/frame${nl}`,
  `const AXIR_KICK         = 0.55;  // axion IR line tangent kick${nl}` +
  `const AXIR_TWIST        = 0.08;  // axion IR line micro-twist rad${nl}` +
  `const AXIR_HALFL        = 140;   // axion IR line half-length${nl}` +
  `const AXIR_HALFW        = 3;     // axion IR line half-width${nl}` +
  `const AXIR_DRIFT        = 0.18;  // axion IR line vertical drift px/f${nl}` +
  `const RSSH_PERIOD       = 340;   // sound-horizon shrink cycle${nl}` +
  `const RSSH_R0           = 160;   // shrink start radius${nl}` +
  `const RSSH_R1           = 70;    // shrink end radius${nl}` +
  `const RSSH_SHRINK_DUR   = 20;    // frames of inward pulse${nl}` +
  `const RSSH_BAND         = 16;    // ring band half-width${nl}` +
  `const RSSH_FORCE        = 0.35;  // inward force peak${nl}` +
  `const EDEWAKE_FROZEN    = 80;${nl}` +
  `const EDEWAKE_FLASH     = 10;${nl}` +
  `const EDEWAKE_QUIESCENT = 120;${nl}` +
  `const EDEWAKE_REACT     = 16;${nl}` +
  `const EDEWAKE_PUSH      = 0.02;  // global outward accel during reactivate${nl}` +
  `const HOMO_R            = 120;   // homogenization shell radius${nl}` +
  `const HOMO_TWIST        = 0.02;  // inside-shell twist amp${nl}` +
  `const HOMO_WIND         = 0.015; // inside-shell deterministic wind${nl}` +
  `const HOMO_KICK         = 0.5;   // outward exit kick${nl}`,
  'ZQ consts'
);

// ─── Interfaces ──────────────────────────────────────────────
after(
  `interface DblReion { tilt: number; stage: 0 | 1 | 2 | 3; timer: number; y: number; period: number }${nl}`,
  `// Axion IR decay line (lv328+): thin drifting spectral line; one kick per crossing.${nl}` +
  `interface AxionIrLine { x: number; y: number; angle: number; dirY: 1 | -1; yMin: number; yMax: number; passingBalls: WeakSet<Ball>; flash: number }${nl}` +
  `// Sound-horizon shrink scar (lv331+): contracting ring with inward pulse.${nl}` +
  `interface RsShrinkScar { x: number; y: number; timer: number; r: number; phase: 0 | 1 | 2 }${nl}` +
  `// EDE quiescent wake machine (lv334+): frozen→flash→quiescent→reactivate.${nl}` +
  `interface EdeWake { phase: 0 | 1 | 2 | 3; timer: number }${nl}` +
  `// Homogenization transition shell (lv337+): chaos inside, kick on exit.${nl}` +
  `interface HomoShell { x: number; y: number; seed: number; passingBalls: WeakSet<Ball> }${nl}`,
  'ZQ ifaces'
);

// ─── GameState ───────────────────────────────────────────────
after(
  `dblReion: DblReion | null; // lv325+ double reionization fronts${nl}`,
  `  axionIrLines: AxionIrLine[]; // lv328+ axion IR decay line${nl}` +
  `  rsShrinkScars: RsShrinkScar[]; // lv331+ sound-horizon shrink scar${nl}` +
  `  edeWake: EdeWake | null; // lv334+ EDE quiescent wake machine${nl}` +
  `  homoShells: HomoShell[]; // lv337+ homogenization transition shell${nl}`,
  'ZQ gs'
);

// ─── Empty + clear + anomaly ─────────────────────────────────
after(
  `let dblReion: DblReion | null = null;${nl}`,
  `  const axionIrLines: AxionIrLine[] = [];${nl}` +
  `  const rsShrinkScars: RsShrinkScar[] = [];${nl}` +
  `  let edeWake: EdeWake | null = null;${nl}` +
  `  const homoShells: HomoShell[] = [];${nl}`,
  'ZQ empty'
);

s = s.replace(
  'hpmfLorCorridors.length = 0; dblReion = null;',
  'hpmfLorCorridors.length = 0; dblReion = null; axionIrLines.length = 0; rsShrinkScars.length = 0; edeWake = null; homoShells.length = 0;'
);
console.log('ok clear');

s = s.replace(
  'measDisagreeDuals, hpmfLorCorridors, dblReion, quantumFoams,',
  'measDisagreeDuals, hpmfLorCorridors, dblReion, axionIrLines, rsShrinkScars, edeWake, homoShells, quantumFoams,'
);
console.log('ok anomaly list');

// ─── Spawn after dblReion ────────────────────────────────────
{
  const mark =
    `      period: DBLREION_PERIOD,${nl}` +
    `    };${nl}` +
    `  }${nl}`;
  if (!s.includes('axIrLineRng')) {
    if (!s.includes(mark)) throw new Error('no dblReion end');
    const ins =
      `${nl}` +
      `  // Axion IR decay line (lv328+).${nl}` +
      `  const axIrLineRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 328 &&${nl}` +
      `    frbSources.length === 0 &&${nl}` +
      `    cosmicStrings.length === 0 &&${nl}` +
      `    quantumBarriers.length === 0 &&${nl}` +
      `    hazChance(axIrLineRng, 0.35, 328, level)${nl}` +
      `  ) {${nl}` +
      `    const y0 = topPad + playH * (0.30 + axIrLineRng() * 0.40);${nl}` +
      `    axionIrLines.push({${nl}` +
      `      x: W * 0.5,${nl}` +
      `      y: y0,${nl}` +
      `      angle: (axIrLineRng() - 0.5) * 0.22,${nl}` +
      `      dirY: axIrLineRng() < 0.5 ? 1 : -1,${nl}` +
      `      yMin: topPad + playH * 0.22,${nl}` +
      `      yMax: topPad + playH * 0.78,${nl}` +
      `      passingBalls: new WeakSet(),${nl}` +
      `      flash: 0,${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Sound-horizon shrink scar (lv331+).${nl}` +
      `  const rsShrinkRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 331 &&${nl}` +
      `    gravWaves.length === 0 &&${nl}` +
      `    oddRadioCircles.length === 0 &&${nl}` +
      `    hawkingPoints.length === 0 &&${nl}` +
      `    scptWalls.length === 0 &&${nl}` +
      `    hazChance(rsShrinkRng, 0.40, 331, level)${nl}` +
      `  ) {${nl}` +
      `    rsShrinkScars.push({${nl}` +
      `      x: W * (0.30 + rsShrinkRng() * 0.40),${nl}` +
      `      y: topPad + playH * (0.30 + rsShrinkRng() * 0.40),${nl}` +
      `      timer: Math.floor(rsShrinkRng() * RSSH_PERIOD),${nl}` +
      `      r: RSSH_R0,${nl}` +
      `      phase: 0,${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // EDE quiescent wake machine (lv334+).${nl}` +
      `  const edeWakeRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 334 &&${nl}` +
      `    !edeLawActive &&${nl}` +
      `    !quintomBreathActive &&${nl}` +
      `    signIdeSeams.length === 0 &&${nl}` +
      `    hazChance(edeWakeRng, 0.35, 334, level)${nl}` +
      `  ) {${nl}` +
      `    edeWake = { phase: 0, timer: EDEWAKE_FROZEN };${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Homogenization transition shell (lv337+).${nl}` +
      `  const homoShellRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 337 &&${nl}` +
      `    cosmicVoids.length === 0 &&${nl}` +
      `    theNothings.length === 0 &&${nl}` +
      `    quantumFoams.length === 0 &&${nl}` +
      `    hazChance(homoShellRng, 0.35, 337, level)${nl}` +
      `  ) {${nl}` +
      `    homoShells.push({${nl}` +
      `      x: W * (0.28 + homoShellRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + homoShellRng() * 0.40),${nl}` +
      `      seed: (homoShellRng() * 0x100000000) >>> 0,${nl}` +
      `      passingBalls: new WeakSet(),${nl}` +
      `    });${nl}` +
      `  }${nl}`;
    const i = s.indexOf(mark) + mark.length;
    s = s.slice(0, i) + ins + s.slice(i);
    console.log('ok spawn');
  } else console.log('skip spawn');
}

// Inject into return/destructure lists
injectAfterComma('dblReion', 'axionIrLines');
injectAfterComma('axionIrLines', 'rsShrinkScars');
injectAfterComma('rsShrinkScars', 'edeWake');
injectAfterComma('edeWake', 'homoShells');

s = s.replace(
  'dblReion: DblReion | null, cosmicBirefringences:',
  'dblReion: DblReion | null, axionIrLines: AxionIrLine[], rsShrinkScars: RsShrinkScar[], edeWake: EdeWake | null, homoShells: HomoShell[], cosmicBirefringences:'
);
console.log('ok gensig');

after(
  `dblReion: null,${nl}`,
  `    axionIrLines: [],${nl}` +
  `    rsShrinkScars: [],${nl}` +
  `    edeWake: null,${nl}` +
  `    homoShells: [],${nl}`,
  'useref'
);
after(
  `g.dblReion = dblReion;${nl}`,
  `    g.axionIrLines = axionIrLines;${nl}` +
  `    g.rsShrinkScars = rsShrinkScars;${nl}` +
  `    g.edeWake = edeWake;${nl}` +
  `    g.homoShells = homoShells;${nl}`,
  'assign'
);

// Revive WeakSets
s = s.replace(
  'g.scptWalls,\n    g.bosonCaustics,\n    g.photoZGates,',
  'g.scptWalls,\n    g.bosonCaustics,\n    g.photoZGates,\n    g.axionIrLines,\n    g.homoShells,'
);
if (!s.includes('g.axionIrLines')) {
  s = s.replace(
    `g.photoZGates,${nl}  ] as`,
    `g.photoZGates,${nl}    g.axionIrLines,${nl}    g.homoShells,${nl}  ] as`
  );
}
console.log('ok revive');

// ─── Physics: continuous forces before magnet / after HPMF ───
if (!s.includes('Sound-horizon shrink scar:')) {
  const mark = `          // Helical PMF Lorentz corridor: cyclotron a = k*(v × zhat)*helicity; speed-preserving.${nl}`;
  if (!s.includes(mark)) throw new Error('no hpmf phys');
  // Insert AFTER the hpmf block ends (before Magnet attraction)
  const mag = `          // Magnet attraction${nl}`;
  if (!s.includes(mag)) throw new Error('no magnet');
  const phys =
    `          // Sound-horizon shrink scar: inward pull only while ring is contracting.${nl}` +
    `          for (const rs of g.rsShrinkScars) {${nl}` +
    `            if (rs.phase !== 1) continue;${nl}` +
    `            const dx = ball.x - rs.x, dy = ball.y - rs.y;${nl}` +
    `            const dist = Math.hypot(dx, dy);${nl}` +
    `            if (Math.abs(dist - rs.r) > RSSH_BAND) continue;${nl}` +
    `            const t = 1 - Math.abs(dist - rs.r) / RSSH_BAND;${nl}` +
    `            const f = RSSH_FORCE * t * t;${nl}` +
    `            const inv = dist || 1;${nl}` +
    `            const fx = -(dx / inv) * f, fy = -(dy / inv) * f;${nl}` +
    `            ball.vx += fx; ball.vy += fy;${nl}` +
    `            pulseForceFx(ball, '#c8d0d8', fx, fy);${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // EDE wake flash: invert non-gravity continuous-force delta (same as #122).${nl}` +
    `          if (g.edeWake && g.edeWake.phase === 1) {${nl}` +
    `            ball.vx = edePreVx - (ball.vx - edePreVx);${nl}` +
    `            ball.vy = edePreVy - (ball.vy - edePreVy);${nl}` +
    `            pulseFieldFx(ball, '#d8a860');${nl}` +
    `          }${nl}` +
    `          // EDE wake reactivate: weak global outward accel from board center.${nl}` +
    `          if (g.edeWake && g.edeWake.phase === 3) {${nl}` +
    `            const dx = ball.x - W * 0.5, dy = ball.y - H * 0.45;${nl}` +
    `            const inv = Math.hypot(dx, dy) || 1;${nl}` +
    `            const fx = (dx / inv) * EDEWAKE_PUSH, fy = (dy / inv) * EDEWAKE_PUSH;${nl}` +
    `            ball.vx += fx; ball.vy += fy;${nl}` +
    `            pulseForceFx(ball, '#e8c878', fx, fy);${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // Homogenization shell: chaos inside only.${nl}` +
    `          for (const hs of g.homoShells) {${nl}` +
    `            const dx = ball.x - hs.x, dy = ball.y - hs.y;${nl}` +
    `            const dist = Math.hypot(dx, dy);${nl}` +
    `            const inside = dist < HOMO_R;${nl}` +
    `            if (inside) {${nl}` +
    `              if (!hs.passingBalls.has(ball)) hs.passingBalls.add(ball);${nl}` +
    `              const bi = g.balls.indexOf(ball);${nl}` +
    `              const dTh = HOMO_TWIST * Math.sin(g.frame * 0.31 + bi * 1.7);${nl}` +
    `              const bc = Math.cos(dTh), bs = Math.sin(dTh);${nl}` +
    `              const nvx = ball.vx * bc - ball.vy * bs;${nl}` +
    `              ball.vy = ball.vx * bs + ball.vy * bc;${nl}` +
    `              ball.vx = nvx;${nl}` +
    `              const h = ((Math.imul(hs.seed ^ (bi * 2654435761), 1597334677) >>> 0) / 4294967296);${nl}` +
    `              const ang = h * Math.PI * 2;${nl}` +
    `              ball.vx += Math.cos(ang) * HOMO_WIND;${nl}` +
    `              ball.vy += Math.sin(ang) * HOMO_WIND;${nl}` +
    `              if (g.frame % 6 === 0) pulseTwistFx(ball, '#687888', dTh >= 0 ? 1 : -1);${nl}` +
    `            } else if (hs.passingBalls.has(ball)) {${nl}` +
    `              hs.passingBalls.delete(ball);${nl}` +
    `              const inv = dist || 1;${nl}` +
    `              const fx = (dx / inv) * HOMO_KICK, fy = (dy / inv) * HOMO_KICK;${nl}` +
    `              ball.vx += fx; ball.vy += fy;${nl}` +
    `              pulseForceFx(ball, '#a8b0b8', fx, fy);${nl}` +
    `            }${nl}` +
    `          }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mag)) + phys + mag + s.slice(s.indexOf(mag) + mag.length);
  console.log('ok cont phys');
}

// ─── Substep: axion IR line near cosmic strings ──────────────
if (!s.includes('Axion IR decay line:')) {
  const mark = `              if (!teleported) for (const cs of g.cosmicStrings) {${nl}`;
  if (!s.includes(mark)) throw new Error('no cs substep');
  const sub =
    `              // Axion IR decay line: one tangent kick + micro-twist per crossing.${nl}` +
    `              if (!teleported) for (const al of g.axionIrLines) {${nl}` +
    `                const inside = testBallOBB(ball, al.x, al.y, AXIR_HALFL * 2, AXIR_HALFW * 2, al.angle);${nl}` +
    `                if (!inside) { al.passingBalls.delete(ball); continue; }${nl}` +
    `                if (al.passingBalls.has(ball)) continue;${nl}` +
    `                al.passingBalls.add(ball);${nl}` +
    `                const tc = Math.cos(al.angle), ts = Math.sin(al.angle);${nl}` +
    `                const alongSign = (ball.vx * tc + ball.vy * ts) >= 0 ? 1 : -1;${nl}` +
    `                const kx = tc * AXIR_KICK * alongSign, ky = ts * AXIR_KICK * alongSign;${nl}` +
    `                ball.vx += kx; ball.vy += ky;${nl}` +
    `                const twist = ((Math.floor(ball.x) ^ Math.floor(ball.y)) & 1) === 0 ? AXIR_TWIST : -AXIR_TWIST;${nl}` +
    `                const bc = Math.cos(twist), bs = Math.sin(twist);${nl}` +
    `                const nvx = ball.vx * bc - ball.vy * bs;${nl}` +
    `                ball.vy = ball.vx * bs + ball.vy * bc;${nl}` +
    `                ball.vx = nvx;${nl}` +
    `                al.flash = 10;${nl}` +
    `                pulseForceFx(ball, '#c87050', kx, ky);${nl}` +
    `                pulseTwistFx(ball, '#e8a878', twist >= 0 ? 1 : -1);${nl}` +
    `              }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + sub + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok axir substep');
}

// ─── Draw blocks before Helical PMF draw ─────────────────────
if (!s.includes('── Axion IR decay line')) {
  const mark = `      // ── Helical PMF Lorentz corridor (lv322+) ──${nl}`;
  if (!s.includes(mark)) throw new Error('no hpmf draw');
  const draw =
    `      // ── Axion IR decay line (lv328+) ──${nl}` +
    `      for (const al of g.axionIrLines) {${nl}` +
    `        al.y += al.dirY * AXIR_DRIFT;${nl}` +
    `        if (al.y < al.yMin) { al.y = al.yMin; al.dirY = 1; }${nl}` +
    `        if (al.y > al.yMax) { al.y = al.yMax; al.dirY = -1; }${nl}` +
    `        if (al.flash > 0) al.flash--;${nl}` +
    `        const c = Math.cos(al.angle), sn = Math.sin(al.angle);${nl}` +
    `        ctx.fillStyle = '#c87050';${nl}` +
    `        for (let i = -14; i <= 14; i++) {${nl}` +
    `          const t = i / 14;${nl}` +
    `          const px = al.x + c * t * AXIR_HALFL;${nl}` +
    `          const py = al.y + sn * t * AXIR_HALFL;${nl}` +
    `          ctx.globalAlpha = al.flash > 0 ? 0.7 : 0.35;${nl}` +
    `          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);${nl}` +
    `          if (i % 4 === 0) {${nl}` +
    `            ctx.globalAlpha = 0.2;${nl}` +
    `            ctx.fillRect(Math.round(px - sn * 3), Math.round(py + c * 3), 1, 1);${nl}` +
    `          }${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}` +
    `      // ── Sound-horizon shrink scar (lv331+) ──${nl}` +
    `      for (const rs of g.rsShrinkScars) {${nl}` +
    `        rs.timer--;${nl}` +
    `        if (rs.phase === 0) {${nl}` +
    `          rs.r = RSSH_R0;${nl}` +
    `          if (rs.timer <= 0) { rs.phase = 1; rs.timer = RSSH_SHRINK_DUR; }${nl}` +
    `        } else if (rs.phase === 1) {${nl}` +
    `          const u = 1 - rs.timer / RSSH_SHRINK_DUR;${nl}` +
    `          rs.r = RSSH_R0 + (RSSH_R1 - RSSH_R0) * u;${nl}` +
    `          if (rs.timer <= 0) { rs.phase = 2; rs.timer = 40; }${nl}` +
    `        } else {${nl}` +
    `          if (rs.timer <= 0) { rs.phase = 0; rs.timer = RSSH_PERIOD; rs.r = RSSH_R0; }${nl}` +
    `        }${nl}` +
    `        const alpha = rs.phase === 1 ? 0.45 : rs.phase === 2 ? 0.12 : 0.18;${nl}` +
    `        ctx.fillStyle = '#c8d0d8';${nl}` +
    `        for (let i = 0; i < 48; i++) {${nl}` +
    `          if (i % 5 === 0) continue;${nl}` +
    `          const a = (i / 48) * Math.PI * 2;${nl}` +
    `          ctx.globalAlpha = alpha;${nl}` +
    `          ctx.fillRect(Math.round(rs.x + Math.cos(a) * rs.r), Math.round(rs.y + Math.sin(a) * rs.r), 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}` +
    `      // ── EDE quiescent wake machine (lv334+) ──${nl}` +
    `      if (g.edeWake) {${nl}` +
    `        const ew = g.edeWake;${nl}` +
    `        ew.timer--;${nl}` +
    `        if (ew.timer <= 0) {${nl}` +
    `          if (ew.phase === 0) { ew.phase = 1; ew.timer = EDEWAKE_FLASH; }${nl}` +
    `          else if (ew.phase === 1) { ew.phase = 2; ew.timer = EDEWAKE_QUIESCENT; }${nl}` +
    `          else if (ew.phase === 2) { ew.phase = 3; ew.timer = EDEWAKE_REACT; }${nl}` +
    `          else { ew.phase = 0; ew.timer = EDEWAKE_FROZEN; }${nl}` +
    `        }${nl}` +
    `        const corners = [[8, 8], [W - 9, 8], [8, H - 9], [W - 9, H - 9]] as [number, number][];${nl}` +
    `        const cols = ['#687070', '#d8a860', '#2a2824', '#e8c878'];${nl}` +
    `        ctx.fillStyle = cols[ew.phase];${nl}` +
    `        for (const [cx, cy] of corners) {${nl}` +
    `          ctx.globalAlpha = ew.phase === 2 ? 0.05 : 0.35;${nl}` +
    `          ctx.fillRect(cx, cy, 2, 2);${nl}` +
    `          if (ew.phase === 1 || ew.phase === 3) {${nl}` +
    `            ctx.globalAlpha = 0.2;${nl}` +
    `            ctx.fillRect(cx + (cx < W * 0.5 ? 3 : -3), cy, 1, 1);${nl}` +
    `          }${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}` +
    `      // ── Homogenization transition shell (lv337+) ──${nl}` +
    `      for (const hs of g.homoShells) {${nl}` +
    `        ctx.fillStyle = '#687888';${nl}` +
    `        for (let i = 0; i < 40; i++) {${nl}` +
    `          const a = (i / 40) * Math.PI * 2;${nl}` +
    `          ctx.globalAlpha = 0.28;${nl}` +
    `          ctx.fillRect(Math.round(hs.x + Math.cos(a) * HOMO_R), Math.round(hs.y + Math.sin(a) * HOMO_R), 1, 1);${nl}` +
    `        }${nl}` +
    `        for (let i = 0; i < 18; i++) {${nl}` +
    `          const a = (i / 18) * Math.PI * 2 + hs.seed * 0.001;${nl}` +
    `          const rr = HOMO_R * (0.25 + 0.45 * ((i * 37 + hs.seed) % 7) / 7);${nl}` +
    `          ctx.globalAlpha = 0.12;${nl}` +
    `          ctx.fillRect(Math.round(hs.x + Math.cos(a) * rr), Math.round(hs.y + Math.sin(a) * rr), 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('DONE #128-131');
