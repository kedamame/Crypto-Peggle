/**
 * Patch Zone P #121 Quadruple-Image Ghost Lens
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
  `const ABP_CROSS         = 0.20;  // strip-boundary one-shot twist${nl}`,
  `const QGL_RANGE         = 55;    // quad ghost lens pull radius${nl}` +
  `const QGL_PULL          = 0.18;  // weak inward pull (t*t)${nl}` +
  `const QGL_KICK          = 0.55;  // outward kick on exit after closest approach${nl}` +
  `const QGL_FLASH         = 10;    // nucleus flash frames after kick${nl}`,
  'QGL consts'
);

after(
  `interface AxionBirePatchwork { edges: number[]; signs: (1 | -1)[]; lastStrip: WeakMap<Ball, number> }${nl}`,
  `// Quadruple-image ghost lens (lv305+): weak pull + exit kick; delayed ghosts are draw-only.${nl}` +
  `interface QuadGhostLens { x: number; y: number; flashTimer: number; track: WeakMap<Ball, { minDist: number; inside: boolean }> }${nl}`,
  'QGL iface'
);

after(
  `axionBirePatchwork: AxionBirePatchwork | null; // lv302+ axion-string birefringence patchwork${nl}`,
  `  quadGhostLenses: QuadGhostLens[]; // lv305+ quadruple-image ghost lens${nl}`,
  'QGL gs'
);

after(`let axionBirePatchwork: AxionBirePatchwork | null = null;${nl}`, `  const quadGhostLenses: QuadGhostLens[] = [];${nl}`, 'QGL empty');

if (!s.includes('quadGhostLenses.length = 0')) {
  s = s.replace(
    'axionBirePatchwork = null;',
    'axionBirePatchwork = null; quadGhostLenses.length = 0;'
  );
  console.log('ok clear');
}
if (!s.includes('quadGhostLenses, quantumFoams')) {
  s = s.replace(
    'axionBirePatchwork, quantumFoams,',
    'axionBirePatchwork, quadGhostLenses, quantumFoams,'
  );
  console.log('ok anomaly list');
}

if (!s.includes('g.quadGhostLenses')) {
  const mark = `  if (g.axionBirePatchwork) g.axionBirePatchwork.lastStrip = new WeakMap();${nl}}`;
  if (!s.includes(mark)) throw new Error('no revive mark');
  s = s.replace(
    mark,
    `  if (g.axionBirePatchwork) g.axionBirePatchwork.lastStrip = new WeakMap();${nl}` +
    `  for (const q of g.quadGhostLenses) q.track = new WeakMap();${nl}` +
    `}`
  );
  console.log('ok revive');
}

{
  const mark = `    axionBirePatchwork = { edges, signs, lastStrip: new WeakMap() };${nl}` + `  }${nl}`;
  if (!s.includes(mark)) throw new Error('no abp spawn end');
  if (!s.includes('qglRng')) {
    const ins =
      `${nl}` +
      `  // Quadruple-image ghost lens (lv305+).${nl}` +
      `  const qglRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 305 &&${nl}` +
      `    dressedPbhs.length === 0 &&${nl}` +
      `    einsteinCrosses.length === 0 &&${nl}` +
      `    hazChance(qglRng, 0.40, 305, level)${nl}` +
      `  ) {${nl}` +
      `    quadGhostLenses.push({${nl}` +
      `      x: W * (0.28 + qglRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + qglRng() * 0.40),${nl}` +
      `      flashTimer: 0,${nl}` +
      `      track: new WeakMap(),${nl}` +
      `    });${nl}` +
      `  }${nl}`;
    const i = s.indexOf(mark) + mark.length;
    s = s.slice(0, i) + ins + s.slice(i);
    console.log('ok spawn');
  }
}

{
  let from = 0, n = 0;
  while (n < 8) {
    const i = s.indexOf(', axionBirePatchwork,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 60).includes('quadGhostLenses')) {
      s = s.slice(0, i) + ', axionBirePatchwork, quadGhostLenses,' + s.slice(i + ', axionBirePatchwork,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 40;
  }
}

after(`axionBirePatchwork: null,${nl}`, `    quadGhostLenses: [],${nl}`, 'useref');
after(`g.axionBirePatchwork = axionBirePatchwork;${nl}`, `    g.quadGhostLenses = quadGhostLenses;${nl}`, 'assign');

s = s.replace(
  'axionBirePatchwork: AxionBirePatchwork | null, cosmicBirefringences:',
  'axionBirePatchwork: AxionBirePatchwork | null, quadGhostLenses: QuadGhostLens[], cosmicBirefringences:'
);
console.log('ok gensig');

// Physics: continuous force before ABP block
if (!s.includes('Quadruple-image ghost lens:')) {
  const mark = `          // Axion-string birefringence patchwork: in-strip micro-twist + boundary dump.${nl}`;
  if (!s.includes(mark)) throw new Error('no abp phys mark');
  const phys =
    `          // Quadruple-image ghost lens: weak inward pull; exit after closest approach kicks outward.${nl}` +
    `          for (const qgl of g.quadGhostLenses) {${nl}` +
    `            const dx = qgl.x - ball.x, dy = qgl.y - ball.y;${nl}` +
    `            const dist = Math.sqrt(dx * dx + dy * dy);${nl}` +
    `            const inside = dist < QGL_RANGE && dist > 1e-6;${nl}` +
    `            let st = qgl.track.get(ball);${nl}` +
    `            if (inside) {${nl}` +
    `              const t = 1 - dist / QGL_RANGE;${nl}` +
    `              const f = QGL_PULL * t * t;${nl}` +
    `              ball.vx += (dx / dist) * f;${nl}` +
    `              ball.vy += (dy / dist) * f;${nl}` +
    `              if (g.frame % 5 === 0) pulseFieldFx(ball, '#5a6878');${nl}` +
    `              if (!st) st = { minDist: dist, inside: true };${nl}` +
    `              else { st.minDist = Math.min(st.minDist, dist); st.inside = true; }${nl}` +
    `              qgl.track.set(ball, st);${nl}` +
    `            } else if (st && st.inside) {${nl}` +
    `              const ux = ball.x - qgl.x, uy = ball.y - qgl.y;${nl}` +
    `              const ud = Math.hypot(ux, uy) || 1;${nl}` +
    `              ball.vx += (ux / ud) * QGL_KICK;${nl}` +
    `              ball.vy += (uy / ud) * QGL_KICK;${nl}` +
    `              const spd = Math.hypot(ball.vx, ball.vy);${nl}` +
    `              if (spd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / spd; ball.vx *= sc; ball.vy *= sc; }${nl}` +
    `              pulseForceFx(ball, '#c8b090');${nl}` +
    `              qgl.flashTimer = QGL_FLASH;${nl}` +
    `              qgl.track.set(ball, { minDist: Infinity, inside: false });${nl}` +
    `            }${nl}` +
    `          }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + phys + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok phys');
}

// Draw
if (!s.includes('Quadruple-image ghost lens (lv305+)')) {
  const mark = `      // ── Axion-string birefringence patchwork (lv302+) ──${nl}`;
  if (!s.includes(mark)) throw new Error('no draw mark');
  const draw =
    `      // ── Quadruple-image ghost lens (lv305+) ──${nl}` +
    `      for (const qgl of g.quadGhostLenses) {${nl}` +
    `        if (qgl.flashTimer > 0) qgl.flashTimer--;${nl}` +
    `        const flash = qgl.flashTimer > 0 ? 0.55 : 0.28;${nl}` +
    `        ctx.fillStyle = '#a87840';${nl}` +
    `        ctx.globalAlpha = flash;${nl}` +
    `        ctx.fillRect(Math.round(qgl.x) - 1, Math.round(qgl.y) - 1, 3, 3);${nl}` +
    `        ctx.fillStyle = '#c8b090';${nl}` +
    `        for (const ball of g.balls) {${nl}` +
    `          const dx = ball.x - qgl.x, dy = ball.y - qgl.y;${nl}` +
    `          if (dx * dx + dy * dy > QGL_RANGE * QGL_RANGE * 1.44) continue;${nl}` +
    `          for (const lag of [12, 24, 36]) {${nl}` +
    `            const gx = ball.x - ball.vx * lag;${nl}` +
    `            const gy = ball.y - ball.vy * lag;${nl}` +
    `            ctx.globalAlpha = 0.12;${nl}` +
    `            ctx.fillRect(Math.round(gx), Math.round(gy), 2, 2);${nl}` +
    `          }${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('DONE #121');
