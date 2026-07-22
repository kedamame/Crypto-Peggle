/**
 * Patch Zone O #118 Resolvable PTA Continuous Wave
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
  `const FAP_ORTHO_SCALE    = 0.975; // compress along orthogonal${nl}`,
  `const PTACW_AMP          = 0.014; // resolvable PTA CW acceleration${nl}` +
  `const PTACW_OMEGA        = 0.011; // CW angular frequency${nl}`,
  'PTA consts'
);

after(
  `interface FapLoom { x: number; y: number; rx: number; ry: number; axis: number }${nl}`,
  `// Resolvable PTA continuous wave (lv294+): single-sky-direction sinusoid (not HD quad).${nl}` +
  `interface PtaContinuousWave { theta: number; phase: number }${nl}`,
  'PTA iface'
);

after(
  `fapLooms: FapLoom[]; // lv291+ F_AP anisotropy loom${nl}`,
  `  ptaCw: PtaContinuousWave | null; // lv294+ resolvable PTA continuous wave${nl}`,
  'PTA gs'
);

after(`const fapLooms: FapLoom[] = [];${nl}`, `  let ptaCw: PtaContinuousWave | null = null;${nl}`, 'PTA empty');

s = s.replace('fapLooms.length = 0;', 'fapLooms.length = 0; ptaCw = null;');
console.log('ok clear');

{
  const push =
    `    fapLooms.push({${nl}` +
    `      x: W * (0.28 + fapLoomRng() * 0.44),${nl}` +
    `      y: topPad + playH * (0.28 + fapLoomRng() * 0.40),${nl}` +
    `      rx: FAP_RX,${nl}` +
    `      ry: FAP_RY,${nl}` +
    `      axis: fapLoomRng() * Math.PI,${nl}` +
    `    });${nl}` +
    `  }${nl}`;
  if (!s.includes(push)) throw new Error('no fap push');
  if (!s.includes('ptaCwRng')) {
    const ins =
      `${nl}` +
      `  // Resolvable PTA continuous wave (lv294+): directional sinusoid force.${nl}` +
      `  const ptaCwRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 294 &&${nl}` +
      `    !hdHumActive &&${nl}` +
      `    !gwBackgroundActive &&${nl}` +
      `    !alensActive &&${nl}` +
      `    chirpBinary === null &&${nl}` +
      `    gravEcho === null &&${nl}` +
      `    hazChance(ptaCwRng, 0.35, 294, level)${nl}` +
      `  ) {${nl}` +
      `    ptaCw = { theta: ptaCwRng() * Math.PI * 2, phase: ptaCwRng() * Math.PI * 2 };${nl}` +
      `  }${nl}`;
    const i = s.indexOf(push) + push.length;
    s = s.slice(0, i) + ins + s.slice(i);
    console.log('ok spawn');
  }
}

// Careful list inject: only `, fapLooms, ` patterns (comma-prefixed), not g.fapLooms
{
  let from = 0, n = 0;
  while (n < 6) {
    const i = s.indexOf(', fapLooms,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 30).includes('ptaCw')) {
      s = s.slice(0, i) + ', fapLooms, ptaCw,' + s.slice(i + ', fapLooms,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 30;
  }
}

after(`fapLooms: [],${nl}`, `    ptaCw: null,${nl}`, 'useref');
after(`g.fapLooms = fapLooms;${nl}`, `    g.ptaCw = ptaCw;${nl}`, 'assign');
s = s.replace(
  'fapLooms: FapLoom[], cosmicBirefringences:',
  'fapLooms: FapLoom[], ptaCw: PtaContinuousWave | null, cosmicBirefringences:'
);
console.log('ok gensig');

if (!s.includes('Resolvable PTA continuous wave:')) {
  const mark = '          // F_AP anisotropy loom:';
  const mi = s.indexOf(mark);
  const pop = s.indexOf('          // Pop III.1 Flash:', mi);
  const ins =
    `          // Resolvable PTA continuous wave: single-direction sinusoid.${nl}` +
    `          if (g.ptaCw) {${nl}` +
    `            const wave = Math.sin(g.frame * PTACW_OMEGA + g.ptaCw.phase);${nl}` +
    `            const a = PTACW_AMP * wave;${nl}` +
    `            ball.vx += Math.cos(g.ptaCw.theta) * a;${nl}` +
    `            ball.vy += Math.sin(g.ptaCw.theta) * a;${nl}` +
    `            if (Math.abs(wave) > 0.85) pulseTwistFx(ball);${nl}` +
    `            const spd = Math.hypot(ball.vx, ball.vy);${nl}` +
    `            if (spd > BALL_SPEED * 2) { ball.vx *= (BALL_SPEED * 2) / spd; ball.vy *= (BALL_SPEED * 2) / spd; }${nl}` +
    `          }${nl}${nl}`;
  s = s.slice(0, pop) + ins + s.slice(pop);
  console.log('ok phys');
}

if (!s.includes('Resolvable PTA continuous wave beacon')) {
  const mark = '      // ── F_AP anisotropy looms (lv291+) ──';
  const mi = s.indexOf(mark);
  const endPat = `        ctx.globalAlpha = 1;${nl}      }${nl}`;
  const end = s.indexOf(endPat, mi) + endPat.length;
  const ins =
    `${nl}` +
    `      // ── Resolvable PTA continuous wave beacon (lv294+) ──${nl}` +
    `      if (g.ptaCw) {${nl}` +
    `        const wave = Math.sin(g.frame * PTACW_OMEGA + g.ptaCw.phase);${nl}` +
    `        const bx = 10 + Math.cos(g.ptaCw.theta) * 8;${nl}` +
    `        const by = 10 + Math.sin(g.ptaCw.theta) * 8;${nl}` +
    `        const ox = W - 10 - Math.cos(g.ptaCw.theta) * 8;${nl}` +
    `        const oy = H - 10 - Math.sin(g.ptaCw.theta) * 8;${nl}` +
    `        ctx.fillStyle = '#687898';${nl}` +
    `        ctx.globalAlpha = 0.35 + 0.45 * Math.abs(wave);${nl}` +
    `        ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3);${nl}` +
    `        ctx.globalAlpha = 0.12;${nl}` +
    `        ctx.fillRect(Math.round(ox), Math.round(oy), 2, 2);${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}`;
  s = s.slice(0, end) + ins + s.slice(end);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('done 118');
