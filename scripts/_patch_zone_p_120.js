/**
 * Patch Zone P #120 Axion-String Birefringence Patchwork
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

after(
  `const SCPT_RESPAWN      = 140;   // frames before recondensation${nl}`,
  `const ABP_TWIST         = 0.004; // in-strip continuous twist rad/f${nl}` +
  `const ABP_CROSS         = 0.20;  // strip-boundary one-shot twist${nl}`,
  'ABP consts'
);

after(
  `interface ScptWall { x: number; y: number; r: number; respawnTimer: number; passingBalls: WeakSet<Ball> }${nl}`,
  `// Axion-string birefringence patchwork (lv302+): vertical strips with opposite micro-twist; boundary cross dumps twist.${nl}` +
  `interface AxionBirePatchwork { edges: number[]; signs: (1 | -1)[]; lastStrip: WeakMap<Ball, number> }${nl}`,
  'ABP iface'
);

after(
  `scptWalls: ScptWall[]; // lv297+ supercooled phase-transition wall${nl}`,
  `  axionBirePatchwork: AxionBirePatchwork | null; // lv302+ axion-string birefringence patchwork${nl}`,
  'ABP gs'
);

after(`const scptWalls: ScptWall[] = [];${nl}`, `  let axionBirePatchwork: AxionBirePatchwork | null = null;${nl}`, 'ABP empty');

// anomaly clear
if (!s.includes('axionBirePatchwork = null;')) {
  s = s.replace(
    'ptaCw = null; scptWalls.length = 0;',
    'ptaCw = null; scptWalls.length = 0; axionBirePatchwork = null;'
  );
  console.log('ok clear');
}
if (!s.includes('axionBirePatchwork, quantumFoams')) {
  s = s.replace(
    'ptaCw, scptWalls, quantumFoams,',
    'ptaCw, scptWalls, axionBirePatchwork, quantumFoams,'
  );
  console.log('ok anomaly list');
}

// revive WeakMap
if (!s.includes('g.axionBirePatchwork')) {
  const mark = `  g.gwMemories = new WeakMap();${nl}}`;
  if (!s.includes(mark)) throw new Error('no revive end');
  s = s.replace(
    mark,
    `  g.gwMemories = new WeakMap();${nl}` +
    `  if (g.axionBirePatchwork) g.axionBirePatchwork.lastStrip = new WeakMap();${nl}` +
    `}`
  );
  console.log('ok revive');
}

// spawn after scptWalls block
{
  const mark =
    `      passingBalls: new WeakSet(),${nl}` +
    `    });${nl}` +
    `  }${nl}` +
    `${nl}` +
    `  // ─── Zone remix (gap levels)`;
  if (!s.includes(mark)) throw new Error('no scpt spawn mark');
  if (!s.includes('abpRng')) {
    const ins =
      `${nl}` +
      `  // Axion-string birefringence patchwork (lv302+).${nl}` +
      `  const abpRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 302 &&${nl}` +
      `    !isoBireActive &&${nl}` +
      `    cosmicBirefringences.length === 0 &&${nl}` +
      `    !ebParityActive &&${nl}` +
      `    hazChance(abpRng, 0.40, 302, level)${nl}` +
      `  ) {${nl}` +
      `    const n = 3 + Math.floor(abpRng() * 3);${nl}` +
      `    const edges: number[] = [];${nl}` +
      `    for (let i = 1; i < n; i++) edges.push(W * (i / n) + (abpRng() - 0.5) * W * 0.06);${nl}` +
      `    edges.sort((a, b) => a - b);${nl}` +
      `    const signs: (1 | -1)[] = [];${nl}` +
      `    let sgn: 1 | -1 = abpRng() < 0.5 ? 1 : -1;${nl}` +
      `    for (let i = 0; i < n; i++) { signs.push(sgn); sgn = sgn === 1 ? -1 : 1; }${nl}` +
      `    axionBirePatchwork = { edges, signs, lastStrip: new WeakMap() };${nl}` +
      `  }${nl}`;
    // Need ebParityActive declared early - for #120 exclusivity we reference it before #124 exists.
    // Declare let ebParityActive = false next to axionBirePatchwork empty.
    s = s.slice(0, s.indexOf(mark)) +
      `      passingBalls: new WeakSet(),${nl}` +
      `    });${nl}` +
      `  }${nl}` +
      ins +
      `${nl}` +
      `  // ─── Zone remix (gap levels)` +
      s.slice(s.indexOf(mark) + mark.length);
    console.log('ok spawn');
  }
}

// Declare ebParityActive early (used by #120 exclusivity; #124 will set it)
if (!s.includes('let ebParityActive = false;')) {
  after(
    `let axionBirePatchwork: AxionBirePatchwork | null = null;${nl}`,
    `  let ebParityActive = false;${nl}`,
    'ebParity early decl'
  );
}

// inject into return / destructure / gensig
{
  let from = 0, n = 0;
  while (n < 8) {
    const i = s.indexOf(', scptWalls,', from);
    if (i < 0) break;
    const slice = s.slice(i, i + 80);
    if (!slice.includes('axionBirePatchwork')) {
      s = s.slice(0, i) + ', scptWalls, axionBirePatchwork,' + s.slice(i + ', scptWalls,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 40;
  }
}

after(`scptWalls: [],${nl}`, `    axionBirePatchwork: null,${nl}`, 'useref');
after(`g.scptWalls = scptWalls;${nl}`, `    g.axionBirePatchwork = axionBirePatchwork;${nl}`, 'assign');

s = s.replace(
  'scptWalls: ScptWall[], cosmicBirefringences:',
  'scptWalls: ScptWall[], axionBirePatchwork: AxionBirePatchwork | null, cosmicBirefringences:'
);
console.log('ok gensig');

// Physics before substeps
if (!s.includes('axionBirePatchwork)')) {
  const mark = `          // Sub-step movement: split frame into ≤BALL_R px steps so the ball${nl}`;
  if (!s.includes(mark)) throw new Error('no substep mark');
  const phys =
    `          // Axion-string birefringence patchwork: in-strip micro-twist + boundary dump.${nl}` +
    `          if (g.axionBirePatchwork) {${nl}` +
    `            const abp = g.axionBirePatchwork;${nl}` +
    `            let strip = 0;${nl}` +
    `            while (strip < abp.edges.length && ball.x >= abp.edges[strip]) strip++;${nl}` +
    `            const prev = abp.lastStrip.get(ball);${nl}` +
    `            if (prev !== undefined && prev !== strip) {${nl}` +
    `              const dTh = (strip > prev ? 1 : -1) * ABP_CROSS * abp.signs[strip];${nl}` +
    `              const bc = Math.cos(dTh), bs = Math.sin(dTh);${nl}` +
    `              const nvx = ball.vx * bc - ball.vy * bs;${nl}` +
    `              ball.vy = ball.vx * bs + ball.vy * bc;${nl}` +
    `              ball.vx = nvx;${nl}` +
    `              pulseTwistFx(ball);${nl}` +
    `            }${nl}` +
    `            abp.lastStrip.set(ball, strip);${nl}` +
    `            const dTh = abp.signs[strip] * ABP_TWIST;${nl}` +
    `            const bc = Math.cos(dTh), bs = Math.sin(dTh);${nl}` +
    `            const nvx = ball.vx * bc - ball.vy * bs;${nl}` +
    `            ball.vy = ball.vx * bs + ball.vy * bc;${nl}` +
    `            ball.vx = nvx;${nl}` +
    `            if (g.frame % 6 === 0) pulseTwistFx(ball);${nl}` +
    `          }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + phys + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok phys');
}

// Draw after scpt walls
if (!s.includes('Axion-string birefringence patchwork')) {
  const mark = `      // ── Pop III.1 Flash: synchronized ionization patches (The Flash at z~20) ──${nl}`;
  if (!s.includes(mark)) throw new Error('no draw mark');
  const draw =
    `      // ── Axion-string birefringence patchwork (lv302+) ──${nl}` +
    `      if (g.axionBirePatchwork) {${nl}` +
    `        const abp = g.axionBirePatchwork;${nl}` +
    `        for (let ei = 0; ei < abp.edges.length; ei++) {${nl}` +
    `          const ex = abp.edges[ei];${nl}` +
    `          const col = abp.signs[ei] > 0 ? '#7a5a98' : '#5a98a8';${nl}` +
    `          ctx.fillStyle = col;${nl}` +
    `          for (let y = 8; y < H - 8; y += 7) {${nl}` +
    `            if ((y + ei * 3) % 14 === 0) continue;${nl}` +
    `            ctx.globalAlpha = 0.22;${nl}` +
    `            ctx.fillRect(Math.round(ex), y, 1, 1);${nl}` +
    `          }${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

// debug counters if present
if (s.includes('scptWalls: g.scptWalls.length') && !s.includes('axionBirePatchwork:')) {
  s = s.replace(
    'scptWalls: g.scptWalls.length',
    'scptWalls: g.scptWalls.length, axionBirePatchwork: g.axionBirePatchwork ? 1 : 0'
  );
  console.log('ok debug');
}

fs.writeFileSync(file, s);
console.log('DONE #120');
