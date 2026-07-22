/**
 * Patch Zone P #124 EB Parity Fault
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
  `const FSBLADE_SPD       = 2.2;   // blade sweep speed px/f${nl}`,
  `const EBPAR_TWIST       = 0.006; // left/right continuous twist rad/f${nl}` +
  `const EBPAR_CROSS       = 0.22;  // midline fault one-shot twist${nl}` +
  `const EBPAR_FAULT_HALF  = 10;    // midline fault half-width px${nl}`,
  'EBPAR consts'
);

// GameState - ebParityActive already local in generateLevel; add to GS
after(
  `fsCutoffBlade: FsCutoffBlade | null; // lv311+ free-streaming cutoff blade${nl}`,
  `  ebParityActive: boolean; // lv314+ EB parity fault${nl}`,
  'EBPAR gs'
);

// Ball.ebSide
if (!s.includes('ebSide: number')) {
  s = s.replace(
    'flexBand: number; fxTrail: number;',
    'flexBand: number; ebSide: number; fxTrail: number;'
  );
  s = s.replaceAll(
    'flexBand: 0, fxTrail: 0,',
    'flexBand: 0, ebSide: 0, fxTrail: 0,'
  );
  console.log('ok ball field');
}

// anomaly clear already has let ebParityActive = false - need clear on anomaly
if (!s.includes('ebParityActive = false;') || !s.includes('fsCutoffBlade = null; ebParityActive')) {
  s = s.replace(
    'fsCutoffBlade = null;',
    'fsCutoffBlade = null; ebParityActive = false;'
  );
  console.log('ok clear');
}

if (!s.includes('fsCutoffBlade, ebParityActive, quantumFoams') && !s.includes('ebParityActive, quantumFoams')) {
  s = s.replace(
    'edeLawActive, fsCutoffBlade, quantumFoams,',
    'edeLawActive, fsCutoffBlade, ebParityActive, quantumFoams,'
  );
  console.log('ok anomaly list');
}

{
  const mark = `    fsCutoffBlade = { horizontal, pos, dir, passingBalls: new WeakSet() };${nl}` + `  }${nl}`;
  if (!s.includes(mark)) throw new Error('no fsblade spawn end');
  if (!s.includes('ebParityRng')) {
    const ins =
      `${nl}` +
      `  // EB parity fault (lv314+).${nl}` +
      `  const ebParityRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 314 &&${nl}` +
      `    axionBirePatchwork === null &&${nl}` +
      `    !isoBireActive &&${nl}` +
      `    hazChance(ebParityRng, 0.40, 314, level)${nl}` +
      `  ) {${nl}` +
      `    ebParityActive = true;${nl}` +
      `  }${nl}`;
    const i = s.indexOf(mark) + mark.length;
    s = s.slice(0, i) + ins + s.slice(i);
    console.log('ok spawn');
  }
}

{
  let from = 0, n = 0;
  while (n < 8) {
    const i = s.indexOf(', fsCutoffBlade,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 50).includes('ebParityActive')) {
      s = s.slice(0, i) + ', fsCutoffBlade, ebParityActive,' + s.slice(i + ', fsCutoffBlade,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 40;
  }
}

after(`fsCutoffBlade: null,${nl}`, `    ebParityActive: false,${nl}`, 'useref');
after(`g.fsCutoffBlade = fsCutoffBlade;${nl}`, `    g.ebParityActive = ebParityActive;${nl}`, 'assign');

s = s.replace(
  'fsCutoffBlade: FsCutoffBlade | null, cosmicBirefringences:',
  'fsCutoffBlade: FsCutoffBlade | null, ebParityActive: boolean, cosmicBirefringences:'
);
console.log('ok gensig');

// Physics inside !inNothing, after EDE flip (before closing brace)
if (!s.includes('EB parity fault:')) {
  const mark =
    `          // EDE law blink: invert non-gravity continuous-force delta for EDEBLINK_DUR frames.${nl}` +
    `          if (g.edeLawActive && g.edeLawBlink > 0) {${nl}` +
    `            ball.vx = edePreVx - (ball.vx - edePreVx);${nl}` +
    `            ball.vy = edePreVy - (ball.vy - edePreVy);${nl}` +
    `            pulseFieldFx(ball, '#d8a860');${nl}` +
    `          }${nl}` +
    `          } // end !inNothing continuous-force block${nl}`;
  if (!s.includes(mark)) throw new Error('no ede flip end');
  const phys =
    `          // EDE law blink: invert non-gravity continuous-force delta for EDEBLINK_DUR frames.${nl}` +
    `          if (g.edeLawActive && g.edeLawBlink > 0) {${nl}` +
    `            ball.vx = edePreVx - (ball.vx - edePreVx);${nl}` +
    `            ball.vy = edePreVy - (ball.vy - edePreVy);${nl}` +
    `            pulseFieldFx(ball, '#d8a860');${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // EB parity fault: opposite micro-twist on left/right; midline dump on cross.${nl}` +
    `          if (g.ebParityActive) {${nl}` +
    `            const mid = W * 0.5;${nl}` +
    `            const side = ball.x < mid ? -1 : 1;${nl}` +
    `            const inFault = Math.abs(ball.x - mid) < EBPAR_FAULT_HALF;${nl}` +
    `            if (!inFault) {${nl}` +
    `              if (ball.ebSide !== 0 && ball.ebSide !== side) {${nl}` +
    `                const dTh = side * EBPAR_CROSS;${nl}` +
    `                const bc = Math.cos(dTh), bs = Math.sin(dTh);${nl}` +
    `                const nvx = ball.vx * bc - ball.vy * bs;${nl}` +
    `                ball.vy = ball.vx * bs + ball.vy * bc;${nl}` +
    `                ball.vx = nvx;${nl}` +
    `                pulseTwistFx(ball);${nl}` +
    `              }${nl}` +
    `              ball.ebSide = side;${nl}` +
    `            }${nl}` +
    `            const dTh = side * EBPAR_TWIST;${nl}` +
    `            const bc = Math.cos(dTh), bs = Math.sin(dTh);${nl}` +
    `            const nvx = ball.vx * bc - ball.vy * bs;${nl}` +
    `            ball.vy = ball.vx * bs + ball.vy * bc;${nl}` +
    `            ball.vx = nvx;${nl}` +
    `            if (g.frame % 6 === 0) pulseTwistFx(ball);${nl}` +
    `          }${nl}` +
    `          } // end !inNothing continuous-force block${nl}`;
  s = s.replace(mark, phys);
  console.log('ok phys');
}

// Draw
if (!s.includes('── EB parity fault')) {
  const mark = `      // ── Free-streaming cutoff blade (lv311+) ──${nl}`;
  if (!s.includes(mark)) throw new Error('no fsblade draw');
  const draw =
    `      // ── EB parity fault (lv314+) ──${nl}` +
    `      if (g.ebParityActive) {${nl}` +
    `        const mid = W * 0.5;${nl}` +
    `        ctx.fillStyle = '#7a5a98';${nl}` +
    `        for (let y = 10; y < H - 10; y += 9) {${nl}` +
    `          ctx.globalAlpha = 0.12;${nl}` +
    `          ctx.fillRect(8, y, 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.fillStyle = '#5a98a8';${nl}` +
    `        for (let y = 10; y < H - 10; y += 9) {${nl}` +
    `          ctx.globalAlpha = 0.12;${nl}` +
    `          ctx.fillRect(W - 9, y, 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.fillStyle = '#686870';${nl}` +
    `        for (let y = 6; y < H - 6; y += 6) {${nl}` +
    `          if (y % 12 === 0) continue;${nl}` +
    `          ctx.globalAlpha = 0.28;${nl}` +
    `          ctx.fillRect(Math.round(mid), y, 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('DONE #124');
