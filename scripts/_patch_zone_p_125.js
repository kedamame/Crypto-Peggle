/**
 * Patch Zone P #125 Measurement-Disagreement Dual Field
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
  `const EBPAR_FAULT_HALF  = 10;    // midline fault half-width px${nl}`,
  `const MEASDUAL_RX       = 110;   // measurement-disagreement dual ellipse rx${nl}` +
  `const MEASDUAL_RY       = 70;    // measurement-disagreement dual ellipse ry${nl}` +
  `const MEASDUAL_TWIST    = 0.010; // shear-answer twist rad/f peak${nl}` +
  `const MEASDUAL_PUSH     = 0.22;  // clustering-answer outward force peak${nl}` +
  `const MEASDUAL_OMEGA    = 0.04;  // answer-phase angular frequency${nl}`,
  'MEASDUAL consts'
);

after(
  `interface FsCutoffBlade { horizontal: boolean; pos: number; dir: 1 | -1; passingBalls: WeakSet<Ball> }${nl}`,
  `// Measurement-disagreement dual field (lv317+): ellipse where shear-twist and clustering-push take turns.${nl}` +
  `interface MeasDisagreeDual { x: number; y: number; rx: number; ry: number; axis: number }${nl}`,
  'MEASDUAL iface'
);

after(
  `ebParityActive: boolean; // lv314+ EB parity fault${nl}`,
  `  measDisagreeDuals: MeasDisagreeDual[]; // lv317+ measurement-disagreement dual field${nl}`,
  'MEASDUAL gs'
);

after(`let ebParityActive = false;${nl}`, `  const measDisagreeDuals: MeasDisagreeDual[] = [];${nl}`, 'MEASDUAL empty');

s = s.replace(
  'fsCutoffBlade = null; ebParityActive = false;',
  'fsCutoffBlade = null; ebParityActive = false; measDisagreeDuals.length = 0;'
);
console.log('ok clear');

if (!s.includes('measDisagreeDuals, quantumFoams')) {
  s = s.replace(
    'fsCutoffBlade, ebParityActive, quantumFoams,',
    'fsCutoffBlade, ebParityActive, measDisagreeDuals, quantumFoams,'
  );
  console.log('ok anomaly list');
}

{
  const mark = `    ebParityActive = true;${nl}` + `  }${nl}`;
  if (!s.includes(mark)) throw new Error('no ebparity spawn end');
  if (!s.includes('measDualRng')) {
    const ins =
      `${nl}` +
      `  // Measurement-disagreement dual field (lv317+).${nl}` +
      `  const measDualRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 317 &&${nl}` +
      `    cosmicShears.length === 0 &&${nl}` +
      `    fapLooms.length === 0 &&${nl}` +
      `    hazChance(measDualRng, 0.35, 317, level)${nl}` +
      `  ) {${nl}` +
      `    measDisagreeDuals.push({${nl}` +
      `      x: W * (0.28 + measDualRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + measDualRng() * 0.40),${nl}` +
      `      rx: MEASDUAL_RX,${nl}` +
      `      ry: MEASDUAL_RY,${nl}` +
      `      axis: measDualRng() * Math.PI,${nl}` +
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
    const i = s.indexOf(', ebParityActive,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 55).includes('measDisagreeDuals')) {
      s = s.slice(0, i) + ', ebParityActive, measDisagreeDuals,' + s.slice(i + ', ebParityActive,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 40;
  }
}

after(`ebParityActive: false,${nl}`, `    measDisagreeDuals: [],${nl}`, 'useref');
after(`g.ebParityActive = ebParityActive;${nl}`, `    g.measDisagreeDuals = measDisagreeDuals;${nl}`, 'assign');

s = s.replace(
  'ebParityActive: boolean, cosmicBirefringences:',
  'ebParityActive: boolean, measDisagreeDuals: MeasDisagreeDual[], cosmicBirefringences:'
);
console.log('ok gensig');

// Physics before EB parity (or after EDE, before EB)
if (!s.includes('Measurement-disagreement dual:')) {
  const mark = `          // EB parity fault: opposite micro-twist on left/right; midline dump on cross.${nl}`;
  if (!s.includes(mark)) throw new Error('no ebparity phys');
  const phys =
    `          // Measurement-disagreement dual: shear-twist vs clustering-push by phase.${nl}` +
    `          for (const md of g.measDisagreeDuals) {${nl}` +
    `            const dx = ball.x - md.x, dy = ball.y - md.y;${nl}` +
    `            const c = Math.cos(md.axis), sn = Math.sin(md.axis);${nl}` +
    `            const lx = c * dx + sn * dy;${nl}` +
    `            const ly = -sn * dx + c * dy;${nl}` +
    `            if ((lx * lx) / (md.rx * md.rx) + (ly * ly) / (md.ry * md.ry) > 1) continue;${nl}` +
    `            const phase = Math.sin(g.frame * MEASDUAL_OMEGA);${nl}` +
    `            const nearZero = Math.abs(phase) < 0.15;${nl}` +
    `            const scale = nearZero ? 0.5 : 1;${nl}` +
    `            if (phase >= 0) {${nl}` +
    `              const dTh = MEASDUAL_TWIST * phase * scale;${nl}` +
    `              const bc = Math.cos(dTh), bs = Math.sin(dTh);${nl}` +
    `              const nvx = ball.vx * bc - ball.vy * bs;${nl}` +
    `              ball.vy = ball.vx * bs + ball.vy * bc;${nl}` +
    `              ball.vx = nvx;${nl}` +
    `              pulseTwistFx(ball);${nl}` +
    `              if (g.frame % 2 === 0) pulseForceFx(ball, '#c8a060');${nl}` +
    `            } else {${nl}` +
    `              const dist = Math.hypot(dx, dy) || 1;${nl}` +
    `              const t = 1 - Math.min(1, dist / Math.max(md.rx, md.ry));${nl}` +
    `              const f = MEASDUAL_PUSH * (-phase) * t * t * scale;${nl}` +
    `              ball.vx += (dx / dist) * f;${nl}` +
    `              ball.vy += (dy / dist) * f;${nl}` +
    `              const spd = Math.hypot(ball.vx, ball.vy);${nl}` +
    `              if (spd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / spd; ball.vx *= sc; ball.vy *= sc; }${nl}` +
    `              pulseForceFx(ball, '#888880');${nl}` +
    `            }${nl}` +
    `          }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + phys + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok phys');
}

// Draw
if (!s.includes('── Measurement-disagreement dual')) {
  const mark = `      // ── EB parity fault (lv314+) ──${nl}`;
  if (!s.includes(mark)) throw new Error('no ebparity draw');
  const draw =
    `      // ── Measurement-disagreement dual field (lv317+) ──${nl}` +
    `      for (const md of g.measDisagreeDuals) {${nl}` +
    `        const phase = Math.sin(g.frame * MEASDUAL_OMEGA);${nl}` +
    `        const c = Math.cos(md.axis), sn = Math.sin(md.axis);${nl}` +
    `        for (let i = 0; i < 36; i++) {${nl}` +
    `          const a = (i / 36) * Math.PI * 2;${nl}` +
    `          const px = md.rx * Math.cos(a);${nl}` +
    `          const py = md.ry * Math.sin(a);${nl}` +
    `          const wx = md.x + c * px - sn * py;${nl}` +
    `          const wy = md.y + sn * px + c * py;${nl}` +
    `          const shearOn = phase >= 0;${nl}` +
    `          ctx.fillStyle = shearOn ? '#c8a060' : '#888880';${nl}` +
    `          ctx.globalAlpha = 0.18 + 0.12 * Math.abs(phase);${nl}` +
    `          if (i % 2 === (shearOn ? 0 : 1)) ctx.fillRect(Math.round(wx), Math.round(wy), 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('DONE #125');
