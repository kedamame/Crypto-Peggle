/**
 * Patch Zone O #119 Supercooled Phase-Transition Wall
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

after(
  `const PTACW_OMEGA        = 0.011; // CW angular frequency${nl}`,
  `const SCPT_R0           = 40;    // supercooled PT wall start radius${nl}` +
  `const SCPT_RMAX         = 180;   // supercooled PT wall max radius${nl}` +
  `const SCPT_GROW         = 0.55;  // radius growth per frame${nl}` +
  `const SCPT_HALF         = 6;     // wall band half-width${nl}` +
  `const SCPT_KICK         = 0.9;   // outward wall kick${nl}` +
  `const SCPT_GRAV         = 0.92;  // gravity scale inside new phase${nl}` +
  `const SCPT_RESPAWN      = 140;   // frames before recondensation${nl}`,
  'SCPT consts'
);

after(
  `interface PtaContinuousWave { theta: number; phase: number }${nl}`,
  `// Supercooled phase-transition wall (lv297+): expanding wall kick + reduced gravity inside.${nl}` +
  `interface ScptWall { x: number; y: number; r: number; respawnTimer: number; passingBalls: WeakSet<Ball> }${nl}`,
  'SCPT iface'
);

after(
  `ptaCw: PtaContinuousWave | null; // lv294+ resolvable PTA continuous wave${nl}`,
  `  scptWalls: ScptWall[]; // lv297+ supercooled phase-transition wall${nl}`,
  'SCPT gs'
);

after(`let ptaCw: PtaContinuousWave | null = null;${nl}`, `  const scptWalls: ScptWall[] = [];${nl}`, 'SCPT empty');

s = s.replace('ptaCw = null;', 'ptaCw = null; scptWalls.length = 0;');
// also for-of clear
s = s.replace(
  'nakedLrdSeeds, dressedPbhs, fapLooms, quantumFoams,',
  'nakedLrdSeeds, dressedPbhs, fapLooms, scptWalls, quantumFoams,'
);
console.log('ok clear');

// weakset revive
if (!s.includes('g.scptWalls,')) {
  s = s.replace(`g.dressedPbhs,${nl}`, `g.dressedPbhs,${nl}    g.scptWalls,${nl}`);
  console.log('ok weakset');
}

{
  const mark = `    ptaCw = { theta: ptaCwRng() * Math.PI * 2, phase: ptaCwRng() * Math.PI * 2 };${nl}` + `  }${nl}`;
  if (!s.includes(mark)) throw new Error('no pta mark');
  if (!s.includes('scptWallRng')) {
    const ins =
      `${nl}` +
      `  // Supercooled phase-transition wall (lv297+).${nl}` +
      `  const scptWallRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 297 &&${nl}` +
      `    vacuums.length === 0 &&${nl}` +
      `    vacLeaks.length === 0 &&${nl}` +
      `    bubbleUniverses.length === 0 &&${nl}` +
      `    axionWalls.length === 0 &&${nl}` +
      `    hazChance(scptWallRng, 0.35, 297, level)${nl}` +
      `  ) {${nl}` +
      `    scptWalls.push({${nl}` +
      `      x: W * (0.28 + scptWallRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + scptWallRng() * 0.40),${nl}` +
      `      r: SCPT_R0,${nl}` +
      `      respawnTimer: 0,${nl}` +
      `      passingBalls: new WeakSet(),${nl}` +
      `    });${nl}` +
      `  }${nl}`;
    const i = s.indexOf(mark) + mark.length;
    s = s.slice(0, i) + ins + s.slice(i);
    console.log('ok spawn');
  }
}

{
  let from = 0, n = 0;
  while (n < 6) {
    const i = s.indexOf(', ptaCw,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 30).includes('scptWalls')) {
      s = s.slice(0, i) + ', ptaCw, scptWalls,' + s.slice(i + ', ptaCw,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 30;
  }
}

after(`ptaCw: null,${nl}`, `    scptWalls: [],${nl}`, 'useref');
after(`g.ptaCw = ptaCw;${nl}`, `    g.scptWalls = scptWalls;${nl}`, 'assign');
s = s.replace(
  'ptaCw: PtaContinuousWave | null, cosmicBirefringences:',
  'ptaCw: PtaContinuousWave | null, scptWalls: ScptWall[], cosmicBirefringences:'
);
console.log('ok gensig');

// Gravity scale: insert before the final gravity apply line
if (!s.includes('scptGravScale')) {
  const gravLine = 'if (!inBubbleU && !inSpbhEcho) ball.vy += effGrav * quintomScale * varCoupScale * h0Scale * s8Scale * nuNullScale * ideSiphonScale * phBeltScale * dePertScale;';
  if (!s.includes(gravLine)) throw new Error('no grav line');
  const before =
    `          let scptGravScale = 1;${nl}` +
    `          for (const sw of g.scptWalls) {${nl}` +
    `            if (sw.respawnTimer > 0) continue;${nl}` +
    `            const dx = ball.x - sw.x, dy = ball.y - sw.y;${nl}` +
    `            const d = Math.sqrt(dx * dx + dy * dy);${nl}` +
    `            if (d < sw.r - SCPT_HALF) {${nl}` +
    `              scptGravScale = SCPT_GRAV;${nl}` +
    `              if (g.frame % 5 === 0) pulseFieldFx(ball, '#2a2824');${nl}` +
    `              break;${nl}` +
    `            }${nl}` +
    `          }${nl}` +
    `          `;
  s = s.replace(
    gravLine,
    before + 'if (!inBubbleU && !inSpbhEcho) ball.vy += effGrav * quintomScale * varCoupScale * h0Scale * s8Scale * nuNullScale * ideSiphonScale * phBeltScale * dePertScale * scptGravScale;'
  );
  console.log('ok grav');
}

// Substep wall kick after dressed PBH caustic
if (!s.includes('Supercooled PT wall:')) {
  const mark = 'dp.flashTimer = DPBH_FLASH;';
  const mi = s.indexOf(mark);
  const next = s.indexOf('              if (!teleported) for (', mi + 10);
  if (next < 0) throw new Error('no sub insert');
  const ins =
    `              // Supercooled PT wall: one-shot outward kick on band cross.${nl}` +
    `              if (!teleported) for (const sw of g.scptWalls) {${nl}` +
    `                if (sw.respawnTimer > 0) continue;${nl}` +
    `                const mdx = ball.x - sw.x, mdy = ball.y - sw.y;${nl}` +
    `                const mdist = Math.sqrt(mdx * mdx + mdy * mdy) || 1;${nl}` +
    `                const band = Math.abs(mdist - sw.r);${nl}` +
    `                const inside = band < SCPT_HALF + BALL_R;${nl}` +
    `                if (!inside) { sw.passingBalls.delete(ball); continue; }${nl}` +
    `                if (sw.passingBalls.has(ball)) continue;${nl}` +
    `                sw.passingBalls.add(ball);${nl}` +
    `                const nx = mdx / mdist, ny = mdy / mdist;${nl}` +
    `                ball.vx += nx * SCPT_KICK;${nl}` +
    `                ball.vy += ny * SCPT_KICK;${nl}` +
    `                const nspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);${nl}` +
    `                if (nspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / nspd; ball.vx *= sc; ball.vy *= sc; }${nl}` +
    `                else if (nspd > 0 && nspd < effMinSpeed) { const sc = effMinSpeed / nspd; ball.vx *= sc; ball.vy *= sc; }${nl}` +
    `                pulseForceFx(ball, '#d8c8a0');${nl}` +
    `                spawnBurst(g, ball.x, ball.y, nx * 0.3, ny * 0.3, '#d8c8a0');${nl}` +
    `              }${nl}${nl}`;
  s = s.slice(0, next) + ins + s.slice(next);
  console.log('ok substep');
}

// Draw + advance state after PTA draw
if (!s.includes('Supercooled phase-transition walls')) {
  const mark = '      // ── Resolvable PTA continuous wave beacon (lv294+) ──';
  const mi = s.indexOf(mark);
  const endPat = `        ctx.globalAlpha = 1;${nl}      }${nl}`;
  const end = s.indexOf(endPat, mi) + endPat.length;
  const ins =
    `${nl}` +
    `      // ── Supercooled phase-transition walls (lv297+) ──${nl}` +
    `      for (const sw of g.scptWalls) {${nl}` +
    `        if (sw.respawnTimer > 0) {${nl}` +
    `          sw.respawnTimer--;${nl}` +
    `          if (sw.respawnTimer <= 0) { sw.r = SCPT_R0; sw.passingBalls = new WeakSet(); }${nl}` +
    `          continue;${nl}` +
    `        }${nl}` +
    `        sw.r += SCPT_GROW;${nl}` +
    `        if (sw.r >= SCPT_RMAX) { sw.respawnTimer = SCPT_RESPAWN; sw.r = 0; continue; }${nl}` +
    `        ctx.fillStyle = '#2a2824';${nl}` +
    `        for (let i = 0; i < 48; i++) {${nl}` +
    `          if (i % 3 === 0) continue;${nl}` +
    `          const a = (i / 48) * Math.PI * 2;${nl}` +
    `          ctx.globalAlpha = 0.45;${nl}` +
    `          ctx.fillRect(Math.round(sw.x + Math.cos(a) * sw.r), Math.round(sw.y + Math.sin(a) * sw.r), 2, 2);${nl}` +
    `        }${nl}` +
    `        ctx.fillStyle = '#d8c8a0';${nl}` +
    `        for (let i = 0; i < 8; i++) {${nl}` +
    `          const a = (i / 8) * Math.PI * 2 + g.frame * 0.01;${nl}` +
    `          const rr = sw.r * (0.7 + 0.1 * (i % 3));${nl}` +
    `          ctx.globalAlpha = 0.2;${nl}` +
    `          ctx.fillRect(Math.round(sw.x + Math.cos(a) * rr), Math.round(sw.y + Math.sin(a) * rr), 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}`;
  s = s.slice(0, end) + ins + s.slice(end);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('done 119');
