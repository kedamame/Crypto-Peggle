/**
 * Patch Zone P #123 Free-Streaming Cutoff Blade
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'CryptoPeggleGame.tsx');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

function after(a, ins, l) {
  if (!s.includes(a)) throw new Error('Missing: ' + l);
  const probe = ins.replace(/\r?\n/g, '').slice(0, 32);
  if (s.replace(/\r\n/g, '\n').includes(probe)) { console.log('skip', l); return; }
  s = s.slice(0, s.indexOf(a) + a.length) + ins + s.slice(s.indexOf(a) + a.length);
  console.log('ok', l);
}

after(
  `const EDEBLINK_DUR      = 10;    // force-sign-flip duration frames${nl}`,
  `const FSBLADE_HALF      = 6;     // free-streaming cutoff blade half-width${nl}` +
  `const FSBLADE_VN_CUT    = 0.55;  // |vn| below this is zeroed on cross${nl}` +
  `const FSBLADE_SPD       = 2.2;   // blade sweep speed px/f${nl}`,
  'FSBLADE consts'
);

after(
  `interface QuadGhostLens { x: number; y: number; flashTimer: number; track: WeakMap<Ball, { minDist: number; inside: boolean }> }${nl}`,
  `// Free-streaming cutoff blade (lv311+): sweeping thin band that deletes small normal velocity.${nl}` +
  `interface FsCutoffBlade { horizontal: boolean; pos: number; dir: 1 | -1; passingBalls: WeakSet<Ball> }${nl}`,
  'FSBLADE iface'
);

after(
  `edeLawBlink: number; // active force-sign-flip remaining${nl}`,
  `  fsCutoffBlade: FsCutoffBlade | null; // lv311+ free-streaming cutoff blade${nl}`,
  'FSBLADE gs'
);

after(`let edeLawActive = false;${nl}`, `  let fsCutoffBlade: FsCutoffBlade | null = null;${nl}`, 'FSBLADE empty');

s = s.replace(
  'quadGhostLenses.length = 0; edeLawActive = false;',
  'quadGhostLenses.length = 0; edeLawActive = false; fsCutoffBlade = null;'
);
console.log('ok clear');

if (!s.includes('fsCutoffBlade, quantumFoams') && !s.includes('edeLawActive, fsCutoffBlade')) {
  s = s.replace(
    'quadGhostLenses, edeLawActive, quantumFoams,',
    'quadGhostLenses, edeLawActive, fsCutoffBlade, quantumFoams,'
  );
  console.log('ok anomaly list');
}

if (!s.includes('g.fsCutoffBlade')) {
  const mark = `  for (const q of g.quadGhostLenses) q.track = new WeakMap();${nl}}`;
  if (!s.includes(mark)) throw new Error('no revive');
  s = s.replace(
    mark,
    `  for (const q of g.quadGhostLenses) q.track = new WeakMap();${nl}` +
    `  if (g.fsCutoffBlade) g.fsCutoffBlade.passingBalls = new WeakSet();${nl}` +
    `}`
  );
  console.log('ok revive');
}

{
  const mark = `    edeLawActive = true;${nl}` + `  }${nl}`;
  if (!s.includes(mark)) throw new Error('no ede spawn end');
  if (!s.includes('fsBladeRng')) {
    const ins =
      `${nl}` +
      `  // Free-streaming cutoff blade (lv311+).${nl}` +
      `  const fsBladeRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 311 &&${nl}` +
      `    silkDampingClouds.length === 0 &&${nl}` +
      `    !cme.active &&${nl}` +
      `    hazChance(fsBladeRng, 0.40, 311, level)${nl}` +
      `  ) {${nl}` +
      `    const horizontal = fsBladeRng() < 0.5;${nl}` +
      `    const dir: 1 | -1 = fsBladeRng() < 0.5 ? 1 : -1;${nl}` +
      `    const pos = horizontal${nl}` +
      `      ? (dir > 0 ? launcherY + 40 : H - 20)${nl}` +
      `      : (dir > 0 ? 10 : W - 10);${nl}` +
      `    fsCutoffBlade = { horizontal, pos, dir, passingBalls: new WeakSet() };${nl}` +
      `  }${nl}`;
    const i = s.indexOf(mark) + mark.length;
    s = s.slice(0, i) + ins + s.slice(i);
    console.log('ok spawn');
  }
}

{
  let from = 0, n = 0;
  while (n < 8) {
    const i = s.indexOf(', edeLawActive,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 50).includes('fsCutoffBlade')) {
      s = s.slice(0, i) + ', edeLawActive, fsCutoffBlade,' + s.slice(i + ', edeLawActive,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 40;
  }
}

after(`edeLawBlink: 0,${nl}`, `    fsCutoffBlade: null,${nl}`, 'useref');
after(`g.edeLawBlink = 0;${nl}`, `    g.fsCutoffBlade = fsCutoffBlade;${nl}`, 'assign');

s = s.replace(
  'edeLawActive: boolean, cosmicBirefringences:',
  'edeLawActive: boolean, fsCutoffBlade: FsCutoffBlade | null, cosmicBirefringences:'
);
console.log('ok gensig');

// Substep collision - after scpt walls
if (!s.includes('Free-streaming cutoff blade:')) {
  const mark = `              if (!teleported) for (const sw of g.scptWalls) {`;
  const mi = s.indexOf(mark);
  if (mi < 0) throw new Error('no scpt substep');
  // find end of scpt for loop block - look for next distinctive comment after this
  const afterScpt = s.indexOf(`              if (!teleported) for (const`, mi + mark.length);
  // Actually insert right before scpt, or after entire scpt block.
  // Find scpt block end by searching for pattern after scpt kick
  const scptKick = 'pulseForceFx(ball, \'#d8c8a0\')';
  const ki = s.indexOf(scptKick, mi);
  if (ki < 0) throw new Error('no scpt kick');
  // find closing of the for sw loop - after kick there's clamp and }
  const blockEnd = s.indexOf(`              }${nl}`, ki);
  if (blockEnd < 0) throw new Error('no scpt end');
  const insertAt = blockEnd + `              }${nl}`.length;
  const phys =
    `${nl}` +
    `              // Free-streaming cutoff blade: zero small normal velocity on one-shot cross.${nl}` +
    `              if (!teleported && g.fsCutoffBlade) {${nl}` +
    `                const bl = g.fsCutoffBlade;${nl}` +
    `                const d = bl.horizontal ? Math.abs(ball.y - bl.pos) : Math.abs(ball.x - bl.pos);${nl}` +
    `                if (d <= FSBLADE_HALF + BALL_R) {${nl}` +
    `                  if (!bl.passingBalls.has(ball)) {${nl}` +
    `                    bl.passingBalls.add(ball);${nl}` +
    `                    if (bl.horizontal) {${nl}` +
    `                      if (Math.abs(ball.vy) < FSBLADE_VN_CUT) ball.vy = 0;${nl}` +
    `                    } else {${nl}` +
    `                      if (Math.abs(ball.vx) < FSBLADE_VN_CUT) ball.vx = 0;${nl}` +
    `                    }${nl}` +
    `                    pulseForceFx(ball, '#4060a0');${nl}` +
    `                  }${nl}` +
    `                } else {${nl}` +
    `                  bl.passingBalls.delete(ball);${nl}` +
    `                }${nl}` +
    `              }${nl}`;
  s = s.slice(0, insertAt) + phys + s.slice(insertAt);
  console.log('ok phys');
}

// Draw + advance - with EDE draw
if (!s.includes('── Free-streaming cutoff blade')) {
  const mark = `      // ── EDE law blink (lv308+) ──${nl}`;
  if (!s.includes(mark)) throw new Error('no ede draw');
  const draw =
    `      // ── Free-streaming cutoff blade (lv311+) ──${nl}` +
    `      if (g.fsCutoffBlade) {${nl}` +
    `        const bl = g.fsCutoffBlade;${nl}` +
    `        bl.pos += bl.dir * FSBLADE_SPD;${nl}` +
    `        const done = bl.horizontal${nl}` +
    `          ? (bl.dir > 0 ? bl.pos > H + 20 : bl.pos < launcherY)${nl}` +
    `          : (bl.dir > 0 ? bl.pos > W + 20 : bl.pos < -20);${nl}` +
    `        if (done) {${nl}` +
    `          bl.dir = (bl.dir === 1 ? -1 : 1);${nl}` +
    `          bl.pos = bl.horizontal${nl}` +
    `            ? (bl.dir > 0 ? launcherY + 40 : H - 20)${nl}` +
    `            : (bl.dir > 0 ? 10 : W - 10);${nl}` +
    `          bl.passingBalls = new WeakSet();${nl}` +
    `        }${nl}` +
    `        ctx.fillStyle = '#4060a0';${nl}` +
    `        if (bl.horizontal) {${nl}` +
    `          for (let x = 4; x < W - 4; x += 5) {${nl}` +
    `            if (x % 15 === 0) continue;${nl}` +
    `            ctx.globalAlpha = 0.35;${nl}` +
    `            ctx.fillRect(x, Math.round(bl.pos), 2, 1);${nl}` +
    `          }${nl}` +
    `        } else {${nl}` +
    `          for (let y = 4; y < H - 4; y += 5) {${nl}` +
    `            if (y % 15 === 0) continue;${nl}` +
    `            ctx.globalAlpha = 0.35;${nl}` +
    `            ctx.fillRect(Math.round(bl.pos), y, 1, 2);${nl}` +
    `          }${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('DONE #123');
