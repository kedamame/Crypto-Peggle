/**
 * Patch Zone Q #126 Helical PMF Lorentz Corridor
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
  `const MEASDUAL_OMEGA    = 0.04;  // answer-phase angular frequency${nl}`,
  `const HPMF_K            = 0.035; // helical PMF Lorentz accel scale (v×B)${nl}` +
  `const HPMF_HALFW        = 35;    // Lorentz corridor half-width${nl}` +
  `const HPMF_HALFL        = 110;   // Lorentz corridor half-length${nl}`,
  'HPMF consts'
);

after(
  `interface MeasDisagreeDual { x: number; y: number; rx: number; ry: number; axis: number }${nl}`,
  `// Helical PMF Lorentz corridor (lv322+): in-band cyclotron force a = k*(v×zhat)*helicity.${nl}` +
  `interface HpmfLorCorridor { x: number; y: number; angle: number; helicity: 1 | -1 }${nl}`,
  'HPMF iface'
);

after(
  `measDisagreeDuals: MeasDisagreeDual[]; // lv317+ measurement-disagreement dual field${nl}`,
  `  hpmfLorCorridors: HpmfLorCorridor[]; // lv322+ helical PMF Lorentz corridor${nl}`,
  'HPMF gs'
);

after(`const measDisagreeDuals: MeasDisagreeDual[] = [];${nl}`, `  const hpmfLorCorridors: HpmfLorCorridor[] = [];${nl}`, 'HPMF empty');

s = s.replace(
  'measDisagreeDuals.length = 0;',
  'measDisagreeDuals.length = 0; hpmfLorCorridors.length = 0;'
);
console.log('ok clear');

if (!s.includes('hpmfLorCorridors, quantumFoams')) {
  s = s.replace(
    'ebParityActive, measDisagreeDuals, quantumFoams,',
    'ebParityActive, measDisagreeDuals, hpmfLorCorridors, quantumFoams,'
  );
  console.log('ok anomaly list');
}

{
  const mark =
    `      axis: measDualRng() * Math.PI,${nl}` +
    `    });${nl}` +
    `  }${nl}`;
  if (!s.includes(mark)) throw new Error('no meas dual end');
  if (!s.includes('hpmfLorRng')) {
    const ins =
      `${nl}` +
      `  // Helical PMF Lorentz corridor (lv322+).${nl}` +
      `  const hpmfLorRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 322 &&${nl}` +
      `    pmfClumps.length === 0 &&${nl}` +
      `    magnetars.length === 0 &&${nl}` +
      `    hazChance(hpmfLorRng, 0.40, 322, level)${nl}` +
      `  ) {${nl}` +
      `    hpmfLorCorridors.push({${nl}` +
      `      x: W * (0.28 + hpmfLorRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + hpmfLorRng() * 0.40),${nl}` +
      `      angle: hpmfLorRng() * Math.PI,${nl}` +
      `      helicity: hpmfLorRng() < 0.5 ? 1 : -1,${nl}` +
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
    const i = s.indexOf(', measDisagreeDuals,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 55).includes('hpmfLorCorridors')) {
      s = s.slice(0, i) + ', measDisagreeDuals, hpmfLorCorridors,' + s.slice(i + ', measDisagreeDuals,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 40;
  }
}

after(`measDisagreeDuals: [],${nl}`, `    hpmfLorCorridors: [],${nl}`, 'useref');
after(`g.measDisagreeDuals = measDisagreeDuals;${nl}`, `    g.hpmfLorCorridors = hpmfLorCorridors;${nl}`, 'assign');

s = s.replace(
  'measDisagreeDuals: MeasDisagreeDual[], cosmicBirefringences:',
  'measDisagreeDuals: MeasDisagreeDual[], hpmfLorCorridors: HpmfLorCorridor[], cosmicBirefringences:'
);
console.log('ok gensig');

// Physics before magnet / inside !inNothing near end (before EDE wake later)
if (!s.includes('Helical PMF Lorentz corridor:')) {
  const mark = `          // Magnet attraction${nl}`;
  if (!s.includes(mark)) throw new Error('no magnet mark');
  const phys =
    `          // Helical PMF Lorentz corridor: cyclotron a = k*(v × zhat)*helicity; speed-preserving.${nl}` +
    `          for (const hc of g.hpmfLorCorridors) {${nl}` +
    `            const c = Math.cos(hc.angle), sn = Math.sin(hc.angle);${nl}` +
    `            const dx = ball.x - hc.x, dy = ball.y - hc.y;${nl}` +
    `            const along = c * dx + sn * dy;${nl}` +
    `            const perp = -sn * dx + c * dy;${nl}` +
    `            if (Math.abs(along) > HPMF_HALFL || Math.abs(perp) > HPMF_HALFW) continue;${nl}` +
    `            const spd0 = Math.hypot(ball.vx, ball.vy);${nl}` +
    `            const ax = HPMF_K * hc.helicity * ball.vy;${nl}` +
    `            const ay = -HPMF_K * hc.helicity * ball.vx;${nl}` +
    `            ball.vx += ax;${nl}` +
    `            ball.vy += ay;${nl}` +
    `            const spd1 = Math.hypot(ball.vx, ball.vy) || 1;${nl}` +
    `            if (spd0 > 1e-6) { ball.vx *= spd0 / spd1; ball.vy *= spd0 / spd1; }${nl}` +
    `            const cspd = Math.hypot(ball.vx, ball.vy);${nl}` +
    `            if (cspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / cspd; ball.vx *= sc; ball.vy *= sc; }${nl}` +
    `            if (g.frame % 8 === 0) pulseForceFx(ball, '#4a98b8', ax, ay);${nl}` +
    `          }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + phys + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok phys');
}

// Draw
if (!s.includes('── Helical PMF Lorentz corridor')) {
  const mark = `      // ── Measurement-disagreement dual field (lv317+) ──${nl}`;
  if (!s.includes(mark)) throw new Error('no meas draw');
  const draw =
    `      // ── Helical PMF Lorentz corridor (lv322+) ──${nl}` +
    `      for (const hc of g.hpmfLorCorridors) {${nl}` +
    `        const c = Math.cos(hc.angle), sn = Math.sin(hc.angle);${nl}` +
    `        for (let i = -10; i <= 10; i++) {${nl}` +
    `          const t = i / 10;${nl}` +
    `          const px = hc.x + c * t * HPMF_HALFL;${nl}` +
    `          const py = hc.y + sn * t * HPMF_HALFL;${nl}` +
    `          const ox = -sn * (i % 2 === 0 ? 1 : -1) * 4 * hc.helicity;${nl}` +
    `          const oy = c * (i % 2 === 0 ? 1 : -1) * 4 * hc.helicity;${nl}` +
    `          ctx.fillStyle = i % 2 === 0 ? '#4a98b8' : '#b85a98';${nl}` +
    `          ctx.globalAlpha = 0.28;${nl}` +
    `          ctx.fillRect(Math.round(px + ox), Math.round(py + oy), 1, 1);${nl}` +
    `          ctx.fillRect(Math.round(px - ox * 0.3), Math.round(py - oy * 0.3), 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('DONE #126');
