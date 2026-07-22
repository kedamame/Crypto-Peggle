/**
 * Patch Zone S #138–#143 in one pass.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'CryptoPeggleGame.tsx');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

function after(a, ins, l) {
  if (!s.includes(a)) throw new Error('Missing: ' + l);
  const probe = ins.replace(/\r?\n/g, '').slice(0, 28);
  if (s.replace(/\r\n/g, '\n').includes(probe)) { console.log('skip', l); return; }
  s = s.slice(0, s.indexOf(a) + a.length) + ins + s.slice(s.indexOf(a) + a.length);
  console.log('ok', l);
}
function injectAfterComma(needle, addName) {
  let from = 0, n = 0;
  const token = `, ${needle},`;
  const repl = `, ${needle}, ${addName},`;
  while (n < 16) {
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
  if (n === 0) console.log('warn no inject for', addName);
}

// ─── Constants ───────────────────────────────────────────────
after(
  `const TWINPEAK_OMEGA    = 0.035;${nl}`,
  `const PEANUTCONV_SEP    = 55;    // foci half-separation${nl}` +
  `const PEANUTCONV_B2     = 4200;  // Cassini r1*r2 surface${nl}` +
  `const PEANUTCONV_BAND   = 380;   // |r1*r2 - B2| band${nl}` +
  `const PEANUTCONV_TWIST  = 0.03;${nl}` +
  `const PEANUTCONV_KICK   = 0.28;  // tangent kick on cross${nl}` +
  `const AUDIBLEAX_R       = 48;    // burst node radius${nl}` +
  `const AUDIBLEAX_BURST   = 12;    // burst duration frames${nl}` +
  `const AUDIBLEAX_TANG    = 0.35;  // helical tangent kick${nl}` +
  `const AUDIBLEAX_OUT     = 0.12;  // micro outward${nl}` +
  `const NUHIER_HALF       = 6;     // seam half-width${nl}` +
  `const NUHIER_NH_DRAG    = 0.997;${nl}` +
  `const NUHIER_IH_DRAG    = 0.990;${nl}` +
  `const NUHIER_NH_OUT     = 0.012;${nl}` +
  `const NUHIER_IH_IN      = 0.010;${nl}` +
  `const NUHIER_TWIST      = 0.04;${nl}` +
  `const DISSIPDE_RX       = 100;${nl}` +
  `const DISSIPDE_RY       = 65;${nl}` +
  `const DISSIPDE_DRAG     = 0.985;${nl}` +
  `const DISSIPDE_DWELL    = 45;${nl}` +
  `const DISSIPDE_PUFF     = 0.40;${nl}` +
  `const DISSIPDE_FLOOR    = 0.4;   // * BALL_SPEED floor${nl}` +
  `const RADIOSOFT_LEN     = 180;${nl}` +
  `const RADIOSOFT_THICK   = 28;${nl}` +
  `const RADIOSOFT_MIN     = 0.85;  // spd/BALL_SPEED gate${nl}` +
  `const RADIOSOFT_FRAC    = 0.12;  // speed fraction -> lateral${nl}` +
  `const ALPECHO_SPD       = 4.5;   // expand px/f${nl}` +
  `const ALPECHO_BAND      = 14;${nl}` +
  `const ALPECHO_KICK1     = 0.42;${nl}` +
  `const ALPECHO_KICK2     = 0.22;${nl}` +
  `const ALPECHO_DELAY     = 18;${nl}`,
  'ZS consts'
);

// ─── Interfaces ──────────────────────────────────────────────
after(
  `interface TwinPeakShell { x: number; y: number }${nl}`,
  `// Resonant axion-photon peanut (lv362+): Cassini band cross twist + tangent kick.${nl}` +
  `interface PeanutConvSurface { cx: number; cy: number; angle: number; passingBalls: WeakSet<Ball>; flash: number }${nl}` +
  `// Audible axion burst lattice (lv365+): sparse nodes with helical chirp bursts.${nl}` +
  `interface AudibleAxLattice { nodes: { x: number; y: number; phase: number; helicity: 1 | -1 }[]; period: number }${nl}` +
  `// Neutrino hierarchy seam (lv368+): NH/IH drag asymmetry + cross twist.${nl}` +
  `interface NuHierSeam { x: number; lastSide: WeakMap<Ball, number>; flash: number }${nl}` +
  `// Dissipative DE friction wake (lv371+): drag + dwell fake-phantom puff.${nl}` +
  `interface DissipDeWake { x: number; y: number; rx: number; ry: number; axis: number }${nl}` +
  `// Radio-excess soft conversion sheet (lv374+): fast-ball far-face lateral reallocation.${nl}` +
  `interface RadioSoftSheet { x: number; y: number; angle: number; flash: number; hitX: number; hitY: number }${nl}` +
  `// ALP magneto-GW echo shell (lv377+): expanding front kick + delayed echo.${nl}` +
  `interface AlpEchoShell { cx: number; cy: number; r: number; rMax: number; passingBalls: WeakSet<Ball>; pending: WeakMap<Ball, { t: number; nx: number; ny: number }>; echoFlash: number }${nl}`,
  'ZS ifaces'
);

// ─── Ball fields ─────────────────────────────────────────────
if (!s.includes('dissipDwell: number')) {
  s = s.replace(
    'ebSide: number; fxTrail: number;',
    'ebSide: number; dissipDwell: number; radioSoftSide: number; fxTrail: number;'
  );
  console.log('ok Ball iface');
}
s = s.replaceAll(
  'ebSide: 0, fxTrail: 0,',
  'ebSide: 0, dissipDwell: 0, radioSoftSide: 0, fxTrail: 0,'
);
console.log('ok Ball spawns');

// ─── GameState ───────────────────────────────────────────────
after(
  `twinPeakShells: TwinPeakShell[]; // lv357+ twin-peak GW shells${nl}`,
  `  peanutConvSurfaces: PeanutConvSurface[]; // lv362+ resonant axion-photon peanut${nl}` +
  `  audibleAxLattices: AudibleAxLattice[]; // lv365+ audible axion burst lattice${nl}` +
  `  nuHierSeams: NuHierSeam[]; // lv368+ neutrino hierarchy seam${nl}` +
  `  dissipDeWakes: DissipDeWake[]; // lv371+ dissipative DE friction wake${nl}` +
  `  radioSoftSheets: RadioSoftSheet[]; // lv374+ radio-excess soft conversion sheet${nl}` +
  `  alpEchoShells: AlpEchoShell[]; // lv377+ ALP magneto-GW echo shell${nl}`,
  'ZS gs'
);

after(
  `const twinPeakShells: TwinPeakShell[] = [];${nl}`,
  `  const peanutConvSurfaces: PeanutConvSurface[] = [];${nl}` +
  `  const audibleAxLattices: AudibleAxLattice[] = [];${nl}` +
  `  const nuHierSeams: NuHierSeam[] = [];${nl}` +
  `  const dissipDeWakes: DissipDeWake[] = [];${nl}` +
  `  const radioSoftSheets: RadioSoftSheet[] = [];${nl}` +
  `  const alpEchoShells: AlpEchoShell[] = [];${nl}`,
  'ZS empty'
);

// anomaly clear
if (!s.includes('alpEchoShells.length = 0')) {
  s = s.replace(
    'twinPeakShells.length = 0;',
    'twinPeakShells.length = 0; peanutConvSurfaces.length = 0; audibleAxLattices.length = 0; nuHierSeams.length = 0; dissipDeWakes.length = 0; radioSoftSheets.length = 0; alpEchoShells.length = 0;'
  );
  console.log('ok clear');
}

if (!s.includes('twinPeakShells, peanutConvSurfaces,')) {
  s = s.replace(
    'lrdThomsonCocoons, twinPeakShells, quantumFoams,',
    'lrdThomsonCocoons, twinPeakShells, peanutConvSurfaces, audibleAxLattices, nuHierSeams, dissipDeWakes, radioSoftSheets, alpEchoShells, quantumFoams,'
  );
  console.log('ok anomaly list');
}

// inject field names into return/destructure/lists
for (const [prev, next] of [
  ['twinPeakShells', 'peanutConvSurfaces'],
  ['peanutConvSurfaces', 'audibleAxLattices'],
  ['audibleAxLattices', 'nuHierSeams'],
  ['nuHierSeams', 'dissipDeWakes'],
  ['dissipDeWakes', 'radioSoftSheets'],
  ['radioSoftSheets', 'alpEchoShells'],
]) injectAfterComma(prev, next);

// type signature: twinPeakShells: TwinPeakShell[]
if (!s.includes('alpEchoShells: AlpEchoShell[]')) {
  s = s.replace(
    /twinPeakShells: TwinPeakShell\[\]/g,
    'twinPeakShells: TwinPeakShell[], peanutConvSurfaces: PeanutConvSurface[], audibleAxLattices: AudibleAxLattice[], nuHierSeams: NuHierSeam[], dissipDeWakes: DissipDeWake[], radioSoftSheets: RadioSoftSheet[], alpEchoShells: AlpEchoShell[]'
  );
  console.log('ok type sig');
}

// useRef init
after(
  `twinPeakShells: [],${nl}`,
  `    peanutConvSurfaces: [],${nl}` +
  `    audibleAxLattices: [],${nl}` +
  `    nuHierSeams: [],${nl}` +
  `    dissipDeWakes: [],${nl}` +
  `    radioSoftSheets: [],${nl}` +
  `    alpEchoShells: [],${nl}`,
  'ZS useRef'
);

// initLevel assignment
after(
  `g.twinPeakShells = twinPeakShells;${nl}`,
  `    g.peanutConvSurfaces = peanutConvSurfaces;${nl}` +
  `    g.audibleAxLattices = audibleAxLattices;${nl}` +
  `    g.nuHierSeams = nuHierSeams;${nl}` +
  `    g.dissipDeWakes = dissipDeWakes;${nl}` +
  `    g.radioSoftSheets = radioSoftSheets;${nl}` +
  `    g.alpEchoShells = alpEchoShells;${nl}`,
  'ZS init'
);

// WeakSet revive
after(
  `g.ectHorizons,${nl}` +
  `    g.dwInducedWalls,${nl}` +
  `  ] as { passingBalls?: WeakSet<Ball> }[][];`,
  // keep structure: insert peanut + alp into the withPassing list via replace
  ``,
  'ZS revive skip-placeholder'
);
if (!s.includes('g.peanutConvSurfaces,')) {
  s = s.replace(
    `g.ectHorizons,${nl}` +
    `    g.dwInducedWalls,${nl}` +
    `  ] as { passingBalls?: WeakSet<Ball> }[][];`,
    `g.ectHorizons,${nl}` +
    `    g.dwInducedWalls,${nl}` +
    `    g.peanutConvSurfaces,${nl}` +
    `    g.alpEchoShells,${nl}` +
    `  ] as { passingBalls?: WeakSet<Ball> }[][];`
  );
  console.log('ok withPassing');
}
if (!s.includes('for (const ae of g.alpEchoShells)')) {
  s = s.replace(
    `for (const dw of g.dwInducedWalls) { dw.passingBalls = new WeakSet(); dw.pending = new WeakMap(); }${nl}}`,
    `for (const dw of g.dwInducedWalls) { dw.passingBalls = new WeakSet(); dw.pending = new WeakMap(); }${nl}` +
    `  for (const ns of g.nuHierSeams) ns.lastSide = new WeakMap();${nl}` +
    `  for (const ae of g.alpEchoShells) { ae.passingBalls = new WeakSet(); ae.pending = new WeakMap(); }${nl}` +
    `}`
  );
  console.log('ok revive maps');
}

// ZONE_MARK
if (!s.includes('340] as const') && s.includes('320, 340]')) {
  // already might be different
}
if (s.includes('320, 340] as const')) {
  s = s.replace('320, 340] as const', '320, 340, 360] as const');
  console.log('ok ZONE_MARK');
} else if (s.includes('340] as const') && !s.includes('360] as const')) {
  s = s.replace(/340\] as const/, '340, 360] as const');
  console.log('ok ZONE_MARK alt');
}

// ─── Spawn after twinPeak ────────────────────────────────────
{
  const twinEnd =
    `    twinPeakShells.push({${nl}` +
    `      x: W * (0.30 + twinPeakRng() * 0.40),${nl}` +
    `      y: topPad + playH * (0.30 + twinPeakRng() * 0.40),${nl}` +
    `    });${nl}` +
    `  }${nl}`;
  if (!s.includes('peanutConvRng')) {
    if (!s.includes(twinEnd)) throw new Error('no twinPeak end');
    const ins =
      `${nl}` +
      `  // Resonant axion-photon peanut (lv362+).${nl}` +
      `  const peanutConvRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 362 &&${nl}` +
      `    axionIrLines.length === 0 &&${nl}` +
      `    axionBirePatchwork === null &&${nl}` +
      `    magReconnections.length === 0 &&${nl}` +
      `    hazChance(peanutConvRng, 0.40, 362, level)${nl}` +
      `  ) {${nl}` +
      `    peanutConvSurfaces.push({${nl}` +
      `      cx: W * (0.28 + peanutConvRng() * 0.44),${nl}` +
      `      cy: topPad + playH * (0.28 + peanutConvRng() * 0.40),${nl}` +
      `      angle: peanutConvRng() * Math.PI,${nl}` +
      `      passingBalls: new WeakSet(),${nl}` +
      `      flash: 0,${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Audible axion burst lattice (lv365+).${nl}` +
      `  const audibleAxRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 365 &&${nl}` +
      `    hpmfLorCorridors.length === 0 &&${nl}` +
      `    hazChance(audibleAxRng, 0.35, 365, level)${nl}` +
      `  ) {${nl}` +
      `    const nNodes = 3 + (audibleAxRng() < 0.5 ? 1 : 0);${nl}` +
      `    const period = Math.max(160, 260 - Math.floor((level - 365) * 2.5));${nl}` +
      `    const nodes: AudibleAxLattice['nodes'] = [];${nl}` +
      `    for (let i = 0; i < nNodes; i++) {${nl}` +
      `      nodes.push({${nl}` +
      `        x: W * (0.22 + audibleAxRng() * 0.56),${nl}` +
      `        y: topPad + playH * (0.22 + audibleAxRng() * 0.50),${nl}` +
      `        phase: Math.floor(audibleAxRng() * period),${nl}` +
      `        helicity: audibleAxRng() < 0.5 ? 1 : -1,${nl}` +
      `      });${nl}` +
      `    }${nl}` +
      `    audibleAxLattices.push({ nodes, period });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Neutrino hierarchy seam (lv368+).${nl}` +
      `  const nuHierRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 368 &&${nl}` +
      `    neutrinoOscillations.length === 0 &&${nl}` +
      `    !negNuFlowActive &&${nl}` +
      `    nuNullBands.length === 0 &&${nl}` +
      `    s8Seams.length === 0 &&${nl}` +
      `    hazChance(nuHierRng, 0.40, 368, level)${nl}` +
      `  ) {${nl}` +
      `    nuHierSeams.push({${nl}` +
      `      x: W * (0.32 + nuHierRng() * 0.36),${nl}` +
      `      lastSide: new WeakMap(),${nl}` +
      `      flash: 0,${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Dissipative DE friction wake (lv371+).${nl}` +
      `  const dissipDeRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 371 &&${nl}` +
      `    phantomMembranes.length === 0 &&${nl}` +
      `    phantomBelts.length === 0 &&${nl}` +
      `    darkEnergyPatches.length === 0 &&${nl}` +
      `    ideSiphonBands.length === 0 &&${nl}` +
      `    hazChance(dissipDeRng, 0.35, 371, level)${nl}` +
      `  ) {${nl}` +
      `    dissipDeWakes.push({${nl}` +
      `      x: W * (0.28 + dissipDeRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + dissipDeRng() * 0.40),${nl}` +
      `      rx: DISSIPDE_RX * (0.9 + dissipDeRng() * 0.2),${nl}` +
      `      ry: DISSIPDE_RY * (0.9 + dissipDeRng() * 0.2),${nl}` +
      `      axis: dissipDeRng() * Math.PI,${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // Radio-excess soft conversion sheet (lv374+).${nl}` +
      `  const radioSoftRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 374 &&${nl}` +
      `    cosmicBirefringences.length === 0 &&${nl}` +
      `    !isoBireActive &&${nl}` +
      `    holographicRGSheets.length === 0 &&${nl}` +
      `    planckGratings.length === 0 &&${nl}` +
      `    hazChance(radioSoftRng, 0.40, 374, level)${nl}` +
      `  ) {${nl}` +
      `    radioSoftSheets.push({${nl}` +
      `      x: W * (0.28 + radioSoftRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + radioSoftRng() * 0.40),${nl}` +
      `      angle: radioSoftRng() * Math.PI,${nl}` +
      `      flash: 0,${nl}` +
      `      hitX: 0,${nl}` +
      `      hitY: 0,${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      `${nl}` +
      `  // ALP magneto-GW echo shell (lv377+).${nl}` +
      `  const alpEchoRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 377 &&${nl}` +
      `    twinPeakShells.length === 0 &&${nl}` +
      `    gravWaves.length === 0 &&${nl}` +
      `    oddRadioCircles.length === 0 &&${nl}` +
      `    ectHorizons.length === 0 &&${nl}` +
      `    hazChance(alpEchoRng, 0.35, 377, level)${nl}` +
      `  ) {${nl}` +
      `    alpEchoShells.push({${nl}` +
      `      cx: W * (0.30 + alpEchoRng() * 0.40),${nl}` +
      `      cy: topPad + playH * (0.30 + alpEchoRng() * 0.40),${nl}` +
      `      r: 12,${nl}` +
      `      rMax: Math.hypot(W, H) + 40,${nl}` +
      `      passingBalls: new WeakSet(),${nl}` +
      `      pending: new WeakMap(),${nl}` +
      `      echoFlash: 0,${nl}` +
      `    });${nl}` +
      `  }${nl}`;
    s = s.slice(0, s.indexOf(twinEnd) + twinEnd.length) + ins + s.slice(s.indexOf(twinEnd) + twinEnd.length);
    console.log('ok spawn');
  } else console.log('skip spawn');
}

// ─── Physics after twinPeak force block ──────────────────────
{
  const twinPhysEnd =
    `            if (Math.abs(dist - r1) <= TWINPEAK_BAND) {${nl}` +
    `              const t = 1 - Math.abs(dist - r1) / TWINPEAK_BAND;${nl}` +
    `              const f = TWINPEAK_FORCE * t * t * breath1;${nl}` +
    `              const fx = (dx / inv) * f, fy = (dy / inv) * f;${nl}` +
    `              ball.vx += fx; ball.vy += fy;${nl}` +
    `              if (f > 0.05) pulseForceFx(ball, '#8890a0', fx, fy);${nl}` +
    `            }${nl}` +
    `          }${nl}`;
  if (!s.includes('// Zone S: resonant axion-photon peanut')) {
    if (!s.includes(twinPhysEnd)) throw new Error('no twin phys end');
    const phys =
      `${nl}` +
      `          // Zone S: resonant axion-photon peanut — Cassini band cross.${nl}` +
      `          for (const pc of g.peanutConvSurfaces) {${nl}` +
      `            const c = Math.cos(pc.angle), sn = Math.sin(pc.angle);${nl}` +
      `            const f1x = pc.cx - c * PEANUTCONV_SEP, f1y = pc.cy - sn * PEANUTCONV_SEP;${nl}` +
      `            const f2x = pc.cx + c * PEANUTCONV_SEP, f2y = pc.cy + sn * PEANUTCONV_SEP;${nl}` +
      `            const r1 = Math.hypot(ball.x - f1x, ball.y - f1y) || 1e-6;${nl}` +
      `            const r2 = Math.hypot(ball.x - f2x, ball.y - f2y) || 1e-6;${nl}` +
      `            const cass = r1 * r2;${nl}` +
      `            if (Math.abs(cass - PEANUTCONV_B2) > PEANUTCONV_BAND) {${nl}` +
      `              pc.passingBalls.delete(ball);${nl}` +
      `              continue;${nl}` +
      `            }${nl}` +
      `            if (pc.passingBalls.has(ball)) continue;${nl}` +
      `            pc.passingBalls.add(ball);${nl}` +
      `            const gx = ((ball.x - f1x) / r1) * r2 + ((ball.x - f2x) / r2) * r1;${nl}` +
      `            const gy = ((ball.y - f1y) / r1) * r2 + ((ball.y - f2y) / r2) * r1;${nl}` +
      `            const gLen = Math.hypot(gx, gy) || 1;${nl}` +
      `            const tx = -gy / gLen, ty = gx / gLen;${nl}` +
      `            const along = (ball.vx * tx + ball.vy * ty) >= 0 ? 1 : -1;${nl}` +
      `            const kx = tx * PEANUTCONV_KICK * along, ky = ty * PEANUTCONV_KICK * along;${nl}` +
      `            ball.vx += kx; ball.vy += ky;${nl}` +
      `            const tw = ((Math.floor(ball.x) ^ Math.floor(ball.y)) & 1) === 0 ? PEANUTCONV_TWIST : -PEANUTCONV_TWIST;${nl}` +
      `            const tc = Math.cos(tw), ts = Math.sin(tw);${nl}` +
      `            const nvx = ball.vx * tc - ball.vy * ts;${nl}` +
      `            ball.vy = ball.vx * ts + ball.vy * tc;${nl}` +
      `            ball.vx = nvx;${nl}` +
      `            pc.flash = 10;${nl}` +
      `            pulseForceFx(ball, '#c8b0e0', kx, ky);${nl}` +
      `            pulseTwistFx(ball, '#a890c8', tw >= 0 ? 1 : -1);${nl}` +
      `          }${nl}` +
      `${nl}` +
      `          // Zone S: audible axion burst lattice.${nl}` +
      `          for (const lat of g.audibleAxLattices) {${nl}` +
      `            for (const nd of lat.nodes) {${nl}` +
      `              const phaseT = (g.frame + nd.phase) % lat.period;${nl}` +
      `              if (phaseT >= AUDIBLEAX_BURST) continue;${nl}` +
      `              const dx = ball.x - nd.x, dy = ball.y - nd.y;${nl}` +
      `              const dist = Math.hypot(dx, dy);${nl}` +
      `              if (dist > AUDIBLEAX_R || dist < 1e-6) continue;${nl}` +
      `              const inv = 1 / dist;${nl}` +
      `              const tx = -dy * inv * nd.helicity, ty = dx * inv * nd.helicity;${nl}` +
      `              const fx = tx * AUDIBLEAX_TANG + dx * inv * AUDIBLEAX_OUT;${nl}` +
      `              const fy = ty * AUDIBLEAX_TANG + dy * inv * AUDIBLEAX_OUT;${nl}` +
      `              ball.vx += fx; ball.vy += fy;${nl}` +
      `              pulseForceFx(ball, '#c8b040', fx, fy);${nl}` +
      `              ball.fxTrail = 5; ball.fxTrailColor = '#40a8a0';${nl}` +
      `            }${nl}` +
      `          }${nl}` +
      `${nl}` +
      `          // Zone S: neutrino hierarchy seam.${nl}` +
      `          for (const ns of g.nuHierSeams) {${nl}` +
      `            const dx = ball.x - ns.x;${nl}` +
      `            const side = dx >= 0 ? 1 : -1;${nl}` +
      `            if (Math.abs(dx) <= NUHIER_HALF * 3) {${nl}` +
      `              if (side < 0) {${nl}` +
      `                ball.vx *= NUHIER_NH_DRAG; ball.vy *= NUHIER_NH_DRAG;${nl}` +
      `                ball.vx -= NUHIER_NH_OUT;${nl}` +
      `                if (g.frame % 6 === 0) pulseFieldFx(ball, '#687888');${nl}` +
      `              } else {${nl}` +
      `                ball.vx *= NUHIER_IH_DRAG; ball.vy *= NUHIER_IH_DRAG;${nl}` +
      `                ball.vx -= Math.sign(dx || 1) * NUHIER_IH_IN;${nl}` +
      `                if (g.frame % 6 === 0) pulseFieldFx(ball, '#a87860');${nl}` +
      `              }${nl}` +
      `            }${nl}` +
      `            const prev = ns.lastSide.get(ball);${nl}` +
      `            if (prev === undefined) {${nl}` +
      `              ns.lastSide.set(ball, side);${nl}` +
      `            } else if (prev !== side && Math.abs(dx) <= NUHIER_HALF * 4) {${nl}` +
      `              ns.lastSide.set(ball, side);${nl}` +
      `              const tw = side > 0 ? NUHIER_TWIST : -NUHIER_TWIST;${nl}` +
      `              const tc = Math.cos(tw), ts = Math.sin(tw);${nl}` +
      `              const nvx = ball.vx * tc - ball.vy * ts;${nl}` +
      `              ball.vy = ball.vx * ts + ball.vy * tc;${nl}` +
      `              ball.vx = nvx;${nl}` +
      `              ns.flash = 8;${nl}` +
      `              pulseTwistFx(ball, '#c8a888', tw >= 0 ? 1 : -1);${nl}` +
      `            }${nl}` +
      `          }${nl}` +
      `${nl}` +
      `          // Zone S: dissipative DE friction wake.${nl}` +
      `          {${nl}` +
      `            let inWake = false;${nl}` +
      `            for (const dw of g.dissipDeWakes) {${nl}` +
      `              const dx = ball.x - dw.x, dy = ball.y - dw.y;${nl}` +
      `              const c = Math.cos(dw.axis), sn = Math.sin(dw.axis);${nl}` +
      `              const lx = c * dx + sn * dy;${nl}` +
      `              const ly = -sn * dx + c * dy;${nl}` +
      `              if ((lx * lx) / (dw.rx * dw.rx) + (ly * ly) / (dw.ry * dw.ry) > 1) continue;${nl}` +
      `              inWake = true;${nl}` +
      `              ball.vx *= DISSIPDE_DRAG; ball.vy *= DISSIPDE_DRAG;${nl}` +
      `              const floor = BALL_SPEED * DISSIPDE_FLOOR;${nl}` +
      `              const spd = Math.hypot(ball.vx, ball.vy);${nl}` +
      `              if (spd > 1e-6 && spd < floor) {${nl}` +
      `                const sc = floor / spd; ball.vx *= sc; ball.vy *= sc;${nl}` +
      `              }${nl}` +
      `              ball.dissipDwell = (ball.dissipDwell || 0) + 1;${nl}` +
      `              if (g.frame % 5 === 0) pulseFieldFx(ball, '#c8b0a0');${nl}` +
      `              if (ball.dissipDwell > DISSIPDE_DWELL) {${nl}` +
      `                const inv = Math.hypot(dx, dy) || 1;${nl}` +
      `                const fx = (dx / inv) * DISSIPDE_PUFF, fy = (dy / inv) * DISSIPDE_PUFF;${nl}` +
      `                ball.vx += fx; ball.vy += fy;${nl}` +
      `                ball.dissipDwell = 0;${nl}` +
      `                pulseForceFx(ball, '#e8d0c0', fx, fy);${nl}` +
      `              }${nl}` +
      `            }${nl}` +
      `            if (!inWake) ball.dissipDwell = 0;${nl}` +
      `          }${nl}` +
      `${nl}` +
      `          // Zone S: radio-excess soft conversion sheet (far-face exit).${nl}` +
      `          for (const rs of g.radioSoftSheets) {${nl}` +
      `            const rc = Math.cos(rs.angle), rsn = Math.sin(rs.angle);${nl}` +
      `            const rdx = ball.x - rs.x, rdy = ball.y - rs.y;${nl}` +
      `            const rlx = rc * rdx + rsn * rdy;${nl}` +
      `            const rly = -rsn * rdx + rc * rdy;${nl}` +
      `            if (Math.abs(rlx) > RADIOSOFT_LEN * 0.5 || Math.abs(rly) > RADIOSOFT_THICK * 0.5) {${nl}` +
      `              ball.radioSoftSide = 0;${nl}` +
      `              continue;${nl}` +
      `            }${nl}` +
      `            const rSide = rly >= 0 ? 1 : -1;${nl}` +
      `            if (ball.radioSoftSide === 0) {${nl}` +
      `              ball.radioSoftSide = rSide;${nl}` +
      `            } else if (rSide !== ball.radioSoftSide) {${nl}` +
      `              const spd = Math.hypot(ball.vx, ball.vy);${nl}` +
      `              if (spd >= BALL_SPEED * RADIOSOFT_MIN) {${nl}` +
      `                const latSign = ((Math.floor(ball.x) ^ Math.floor(ball.y)) & 1) === 0 ? 1 : -1;${nl}` +
      `                const lx = -rsn * latSign, ly = rc * latSign;${nl}` +
      `                const transfer = spd * RADIOSOFT_FRAC;${nl}` +
      `                const keep = spd - transfer;${nl}` +
      `                const inv = spd || 1;${nl}` +
      `                ball.vx = (ball.vx / inv) * keep + lx * transfer;${nl}` +
      `                ball.vy = (ball.vy / inv) * keep + ly * transfer;${nl}` +
      `                const spd1 = Math.hypot(ball.vx, ball.vy) || 1;${nl}` +
      `                ball.vx *= spd / spd1; ball.vy *= spd / spd1;${nl}` +
      `                rs.flash = 10; rs.hitX = ball.x; rs.hitY = ball.y;${nl}` +
      `                pulseForceFx(ball, '#80c8a8', lx * transfer, ly * transfer);${nl}` +
      `                ball.fxTrail = 8; ball.fxTrailColor = '#80c8a8';${nl}` +
      `              }${nl}` +
      `              ball.radioSoftSide = rSide;${nl}` +
      `            }${nl}` +
      `          }${nl}` +
      `${nl}` +
      `          // Zone S: ALP magneto-GW echo — front kick + pending echo.${nl}` +
      `          for (const ae of g.alpEchoShells) {${nl}` +
      `            const dx = ball.x - ae.cx, dy = ball.y - ae.cy;${nl}` +
      `            const dist = Math.hypot(dx, dy);${nl}` +
      `            if (Math.abs(dist - ae.r) <= ALPECHO_BAND) {${nl}` +
      `              if (!ae.passingBalls.has(ball)) {${nl}` +
      `                ae.passingBalls.add(ball);${nl}` +
      `                const inv = dist || 1;${nl}` +
      `                const nx = dx / inv, ny = dy / inv;${nl}` +
      `                const fx = nx * ALPECHO_KICK1, fy = ny * ALPECHO_KICK1;${nl}` +
      `                ball.vx += fx; ball.vy += fy;${nl}` +
      `                ae.pending.set(ball, { t: ALPECHO_DELAY, nx, ny });${nl}` +
      `                pulseForceFx(ball, '#b0a0c8', fx, fy);${nl}` +
      `              }${nl}` +
      `            }${nl}` +
      `            const pend = ae.pending.get(ball);${nl}` +
      `            if (pend) {${nl}` +
      `              pend.t--;${nl}` +
      `              if (pend.t <= 0) {${nl}` +
      `                ae.pending.delete(ball);${nl}` +
      `                const fx = pend.nx * ALPECHO_KICK2, fy = pend.ny * ALPECHO_KICK2;${nl}` +
      `                ball.vx += fx; ball.vy += fy;${nl}` +
      `                ae.echoFlash = 10;${nl}` +
      `                ball.fxTrail = 6; ball.fxTrailColor = '#e0d8f0';${nl}` +
      `                pulseForceFx(ball, '#e0d8f0', fx, fy);${nl}` +
      `              }${nl}` +
      `            }${nl}` +
      `          }${nl}`;
    s = s.slice(0, s.indexOf(twinPhysEnd) + twinPhysEnd.length) + phys + s.slice(s.indexOf(twinPhysEnd) + twinPhysEnd.length);
    console.log('ok phys');
  } else console.log('skip phys');
}

// ─── Draw after twinPeak draw ────────────────────────────────
{
  const twinDrawEnd =
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
    `      }${nl}`;
  if (!s.includes('// ── Zone S peanut')) {
    if (!s.includes(twinDrawEnd)) throw new Error('no twin draw end');
    const draw =
      `${nl}` +
      `      // ── Zone S peanut conv (lv362+) ──${nl}` +
      `      for (const pc of g.peanutConvSurfaces) {${nl}` +
      `        if (pc.flash > 0) pc.flash--;${nl}` +
      `        const c = Math.cos(pc.angle), sn = Math.sin(pc.angle);${nl}` +
      `        const f1x = pc.cx - c * PEANUTCONV_SEP, f1y = pc.cy - sn * PEANUTCONV_SEP;${nl}` +
      `        const f2x = pc.cx + c * PEANUTCONV_SEP, f2y = pc.cy + sn * PEANUTCONV_SEP;${nl}` +
      `        ctx.fillStyle = '#a890c8';${nl}` +
      `        ctx.globalAlpha = 0.35;${nl}` +
      `        ctx.fillRect(Math.round(f1x), Math.round(f1y), 2, 2);${nl}` +
      `        ctx.fillRect(Math.round(f2x), Math.round(f2y), 2, 2);${nl}` +
      `        const chirp = 0.004 + Math.min(0.004, (g.level - 362) * 0.00008);${nl}` +
      `        for (let i = 0; i < 64; i++) {${nl}` +
      `          if (i % 4 === 0) continue;${nl}` +
      `          const a = (i / 64) * Math.PI * 2 + g.frame * chirp;${nl}` +
      `          // sample peanut-ish by blending two circles${nl}` +
      `          const u = (Math.cos(a) + 1) * 0.5;${nl}` +
      `          const px = f1x * (1 - u) + f2x * u + Math.cos(a) * 28;${nl}` +
      `          const py = f1y * (1 - u) + f2y * u + Math.sin(a) * 22;${nl}` +
      `          ctx.globalAlpha = 0.14 + (pc.flash > 0 ? 0.2 : 0);${nl}` +
      `          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);${nl}` +
      `        }${nl}` +
      `        ctx.globalAlpha = 1;${nl}` +
      `      }${nl}` +
      `${nl}` +
      `      // ── Zone S audible axion lattice (lv365+) ──${nl}` +
      `      for (const lat of g.audibleAxLattices) {${nl}` +
      `        for (const nd of lat.nodes) {${nl}` +
      `          const phaseT = (g.frame + nd.phase) % lat.period;${nl}` +
      `          const bursting = phaseT < AUDIBLEAX_BURST;${nl}` +
      `          ctx.fillStyle = bursting ? '#c8b040' : '#887828';${nl}` +
      `          ctx.globalAlpha = bursting ? 0.55 : 0.22;${nl}` +
      `          ctx.fillRect(Math.round(nd.x), Math.round(nd.y), 1, 1);${nl}` +
      `          if (bursting) {${nl}` +
      `            ctx.fillStyle = '#40a8a0';${nl}` +
      `            for (let i = 0; i < 16; i++) {${nl}` +
      `              if (i % 3 === 0) continue;${nl}` +
      `              const a = (i / 16) * Math.PI * 2 * nd.helicity + phaseT * 0.2;${nl}` +
      `              const rr = 10 + phaseT * 1.4;${nl}` +
      `              ctx.globalAlpha = 0.28;${nl}` +
      `              ctx.fillRect(Math.round(nd.x + Math.cos(a) * rr), Math.round(nd.y + Math.sin(a) * rr), 1, 1);${nl}` +
      `            }${nl}` +
      `          }${nl}` +
      `        }${nl}` +
      `        ctx.globalAlpha = 1;${nl}` +
      `      }${nl}` +
      `${nl}` +
      `      // ── Zone S neutrino hierarchy seam (lv368+) ──${nl}` +
      `      for (const ns of g.nuHierSeams) {${nl}` +
      `        if (ns.flash > 0) ns.flash--;${nl}` +
      `        for (let y = 40; y < H - 40; y += 6) {${nl}` +
      `          ctx.fillStyle = '#687888';${nl}` +
      `          ctx.globalAlpha = 0.18 + (ns.flash > 0 ? 0.15 : 0);${nl}` +
      `          ctx.fillRect(Math.round(ns.x - 3), y, 1, 1);${nl}` +
      `          if (y % 12 === 0) {${nl}` +
      `            ctx.fillStyle = '#a87860';${nl}` +
      `            ctx.fillRect(Math.round(ns.x + 2), y + 2, 1, 1);${nl}` +
      `          }${nl}` +
      `        }${nl}` +
      `        ctx.globalAlpha = 1;${nl}` +
      `      }${nl}` +
      `${nl}` +
      `      // ── Zone S dissipative DE wake (lv371+) ──${nl}` +
      `      for (const dw of g.dissipDeWakes) {${nl}` +
      `        const c = Math.cos(dw.axis), sn = Math.sin(dw.axis);${nl}` +
      `        ctx.fillStyle = '#c8b0a0';${nl}` +
      `        for (let i = 0; i < 40; i++) {${nl}` +
      `          if (i % 4 === 0) continue;${nl}` +
      `          const a = (i / 40) * Math.PI * 2;${nl}` +
      `          const lx = Math.cos(a) * dw.rx;${nl}` +
      `          const ly = Math.sin(a) * dw.ry;${nl}` +
      `          const px = dw.x + c * lx - sn * ly;${nl}` +
      `          const py = dw.y + sn * lx + c * ly;${nl}` +
      `          ctx.globalAlpha = 0.16;${nl}` +
      `          ctx.fillRect(Math.round(px), Math.round(py), 1, 1);${nl}` +
      `        }${nl}` +
      `        ctx.globalAlpha = 1;${nl}` +
      `      }${nl}` +
      `${nl}` +
      `      // ── Zone S radio soft sheet (lv374+) ──${nl}` +
      `      for (const rs of g.radioSoftSheets) {${nl}` +
      `        if (rs.flash > 0) rs.flash--;${nl}` +
      `        const rc = Math.cos(rs.angle), rsn = Math.sin(rs.angle);${nl}` +
      `        ctx.fillStyle = '#80c8a8';${nl}` +
      `        for (let i = -8; i <= 8; i++) {${nl}` +
      `          if (i % 2 === 0) continue;${nl}` +
      `          const along = i * (RADIOSOFT_LEN / 16);${nl}` +
      `          for (let j = -2; j <= 2; j++) {${nl}` +
      `            const px = rs.x + rc * along - rsn * j * 4;${nl}` +
      `            const py = rs.y + rsn * along + rc * j * 4;${nl}` +
      `            ctx.globalAlpha = 0.12 + (rs.flash > 0 ? 0.2 : 0);${nl}` +
      `            ctx.fillRect(Math.round(px), Math.round(py), 1, 1);${nl}` +
      `          }${nl}` +
      `        }${nl}` +
      `        if (rs.flash > 0) {${nl}` +
      `          ctx.globalAlpha = rs.flash / 10;${nl}` +
      `          for (let k = 0; k < 6; k++) {${nl}` +
      `            ctx.fillRect(Math.round(rs.hitX + k * 3 - 8), Math.round(rs.hitY + ((k & 1) ? 2 : -2)), 1, 1);${nl}` +
      `          }${nl}` +
      `        }${nl}` +
      `        ctx.globalAlpha = 1;${nl}` +
      `      }${nl}` +
      `${nl}` +
      `      // ── Zone S ALP echo shell (lv377+) ──${nl}` +
      `      for (const ae of g.alpEchoShells) {${nl}` +
      `        ae.r += ALPECHO_SPD;${nl}` +
      `        if (ae.r > ae.rMax) {${nl}` +
      `          ae.r = 12;${nl}` +
      `          ae.passingBalls = new WeakSet();${nl}` +
      `          ae.pending = new WeakMap();${nl}` +
      `        }${nl}` +
      `        if (ae.echoFlash > 0) ae.echoFlash--;${nl}` +
      `        ctx.fillStyle = '#b0a0c8';${nl}` +
      `        for (let i = 0; i < 52; i++) {${nl}` +
      `          if (i % 4 === 0) continue;${nl}` +
      `          const a = (i / 52) * Math.PI * 2;${nl}` +
      `          ctx.globalAlpha = 0.28;${nl}` +
      `          ctx.fillRect(Math.round(ae.cx + Math.cos(a) * ae.r), Math.round(ae.cy + Math.sin(a) * ae.r), 1, 1);${nl}` +
      `        }${nl}` +
      `        if (ae.echoFlash > 0) {${nl}` +
      `          ctx.fillStyle = '#e0d8f0';${nl}` +
      `          const er = ae.r + 18;${nl}` +
      `          for (let i = 0; i < 24; i++) {${nl}` +
      `            if (i % 3 === 0) continue;${nl}` +
      `            const a = (i / 24) * Math.PI * 2;${nl}` +
      `            ctx.globalAlpha = ae.echoFlash / 10 * 0.4;${nl}` +
      `            ctx.fillRect(Math.round(ae.cx + Math.cos(a) * er), Math.round(ae.cy + Math.sin(a) * er), 1, 1);${nl}` +
      `          }${nl}` +
      `        }${nl}` +
      `        ctx.globalAlpha = 1;${nl}` +
      `      }${nl}`;
    s = s.slice(0, s.indexOf(twinDrawEnd) + twinDrawEnd.length) + draw + s.slice(s.indexOf(twinDrawEnd) + twinDrawEnd.length);
    console.log('ok draw');
  } else console.log('skip draw');
}

fs.writeFileSync(file, s);
console.log('DONE Zone S patch', file);
