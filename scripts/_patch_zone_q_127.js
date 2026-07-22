/**
 * Patch Zone Q #127 Double Reionization Fronts
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
  `const HPMF_HALFL        = 110;   // Lorentz corridor half-length${nl}`,
  `const DBLREION_PERIOD   = 420;   // double-reion full cycle frames${nl}` +
  `const DBLREION_GAP      = 90;    // quiet gap between fake dawn and true front${nl}` +
  `const DBLREION_BAND1    = 22;    // first (false-dawn) front half-band${nl}` +
  `const DBLREION_BAND2    = 36;    // second front half-band (reion-class)${nl}` +
  `const DBLREION_SCRAMBLE = 0.028; // weak sideways shove on front1${nl}` +
  `const DBLREION_SPD      = 4;     // front descent px/frame${nl}`,
  'DBLREION consts'
);

after(
  `interface HpmfLorCorridor { x: number; y: number; angle: number; helicity: 1 | -1 }${nl}`,
  `// Double reionization fronts (lv325+): false-dawn thin front → gap → true reion front.${nl}` +
  `interface DblReion { tilt: number; stage: 0 | 1 | 2 | 3; timer: number; y: number; period: number }${nl}`,
  'DBLREION iface'
);

after(
  `hpmfLorCorridors: HpmfLorCorridor[]; // lv322+ helical PMF Lorentz corridor${nl}`,
  `  dblReion: DblReion | null; // lv325+ double reionization fronts${nl}`,
  'DBLREION gs'
);

after(`const hpmfLorCorridors: HpmfLorCorridor[] = [];${nl}`, `  let dblReion: DblReion | null = null;${nl}`, 'DBLREION empty');

s = s.replace(
  'measDisagreeDuals.length = 0; hpmfLorCorridors.length = 0;',
  'measDisagreeDuals.length = 0; hpmfLorCorridors.length = 0; dblReion = null;'
);
console.log('ok clear');

if (!s.includes('hpmfLorCorridors, dblReion, quantumFoams') && !s.includes('hpmfLorCorridors, dblReion,')) {
  s = s.replace(
    'measDisagreeDuals, hpmfLorCorridors, quantumFoams,',
    'measDisagreeDuals, hpmfLorCorridors, dblReion, quantumFoams,'
  );
  console.log('ok anomaly list');
}

{
  const mark =
    `      helicity: hpmfLorRng() < 0.5 ? 1 : -1,${nl}` +
    `    });${nl}` +
    `  }${nl}`;
  if (!s.includes(mark)) throw new Error('no hpmf end');
  if (!s.includes('dblReionRng')) {
    const ins =
      `${nl}` +
      `  // Double reionization fronts (lv325+).${nl}` +
      `  const dblReionRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 325 &&${nl}` +
      `    !reion.active &&${nl}` +
      `    pop31Flash === null &&${nl}` +
      `    !cme.active &&${nl}` +
      `    hazChance(dblReionRng, 0.40, 325, level)${nl}` +
      `  ) {${nl}` +
      `    dblReion = {${nl}` +
      `      tilt: (dblReionRng() - 0.5) * 0.18,${nl}` +
      `      stage: 0,${nl}` +
      `      timer: Math.floor(dblReionRng() * DBLREION_PERIOD * 0.5),${nl}` +
      `      y: -1,${nl}` +
      `      period: DBLREION_PERIOD,${nl}` +
      `    };${nl}` +
      `  }${nl}`;
    const i = s.indexOf(mark) + mark.length;
    s = s.slice(0, i) + ins + s.slice(i);
    console.log('ok spawn');
  }
}

{
  let from = 0, n = 0;
  while (n < 8) {
    const i = s.indexOf(', hpmfLorCorridors,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 40).includes('dblReion')) {
      s = s.slice(0, i) + ', hpmfLorCorridors, dblReion,' + s.slice(i + ', hpmfLorCorridors,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 40;
  }
}

after(`hpmfLorCorridors: [],${nl}`, `    dblReion: null,${nl}`, 'useref');
after(`g.hpmfLorCorridors = hpmfLorCorridors;${nl}`, `    g.dblReion = dblReion;${nl}`, 'assign');

s = s.replace(
  'hpmfLorCorridors: HpmfLorCorridor[], cosmicBirefringences:',
  'hpmfLorCorridors: HpmfLorCorridor[], dblReion: DblReion | null, cosmicBirefringences:'
);
console.log('ok gensig');

// Physics near reion force block
if (!s.includes('Double reionization fronts:')) {
  const mark = `          if (g.reionY >= 0) {${nl}`;
  if (!s.includes(mark)) throw new Error('no reion phys');
  // Find the closing of reion phys block more carefully — insert AFTER the whole reion if-block
  const reionPhysStart = s.indexOf(mark);
  // Find matching end: look for next blank-ish after REION_MIN_SPD block
  const afterReion = s.indexOf(`          if (g.cmeY >= 0)`, reionPhysStart);
  // Prefer insert after reion block ends. Search for pattern after reion min speed
  const endMark = `              if (rspd > 0 && rspd < REION_MIN_SPD) {${nl}` +
    `                const sc = REION_MIN_SPD / rspd; ball.vx *= sc; ball.vy *= sc;${nl}` +
    `              }${nl}` +
    `            }${nl}` +
    `          }${nl}`;
  const ei = s.indexOf(endMark, reionPhysStart);
  if (ei < 0) throw new Error('no reion phys end');
  const insertAt = ei + endMark.length;
  const phys =
    `${nl}` +
    `          // Double reionization fronts: false dawn (sideways) then true front (reion-class).${nl}` +
    `          if (g.dblReion && g.dblReion.y >= 0 && (g.dblReion.stage === 1 || g.dblReion.stage === 3)) {${nl}` +
    `            const dr = g.dblReion;${nl}` +
    `            const band = dr.stage === 1 ? DBLREION_BAND1 : DBLREION_BAND2;${nl}` +
    `            const bandY = dr.y + (ball.x - W * 0.5) * Math.tan(dr.tilt);${nl}` +
    `            if (Math.abs(ball.y - bandY) < band * 0.5) {${nl}` +
    `              if (dr.stage === 1) {${nl}` +
    `                const sx = DBLREION_SCRAMBLE * (ball.x < W * 0.5 ? -1 : 1);${nl}` +
    `                ball.vx += sx;${nl}` +
    `                pulseForceFx(ball, '#9a70d0', sx, 0);${nl}` +
    `              } else {${nl}` +
    `                ball.vx *= REION_DRAG_X;${nl}` +
    `                ball.vy += REION_PUSH_Y;${nl}` +
    `                if (Math.abs(dr.tilt) > 0.02) ball.vx += Math.sin(dr.tilt) * REION_PUSH_Y * 4;${nl}` +
    `                pulseForceFx(ball, '#7b5cff', 0, REION_PUSH_Y);${nl}` +
    `                const rspd2 = Math.hypot(ball.vx, ball.vy);${nl}` +
    `                if (rspd2 > 0 && rspd2 < REION_MIN_SPD) {${nl}` +
    `                  const sc = REION_MIN_SPD / rspd2; ball.vx *= sc; ball.vy *= sc;${nl}` +
    `                }${nl}` +
    `              }${nl}` +
    `            }${nl}` +
    `          }${nl}`;
  s = s.slice(0, insertAt) + phys + s.slice(insertAt);
  console.log('ok phys');
}

// Draw after reion draw block
if (!s.includes('── Double reionization fronts')) {
  const mark = `      // ── Pulsars: rotating twin radiation beams (update + draw) ────────────${nl}`;
  if (!s.includes(mark)) throw new Error('no pulsar draw mark');
  const draw =
    `      // ── Double reionization fronts (lv325+) ──${nl}` +
    `      if (g.dblReion) {${nl}` +
    `        const dr = g.dblReion;${nl}` +
    `        const tiltTan = Math.tan(dr.tilt);${nl}` +
    `        if (dr.stage === 0) {${nl}` +
    `          dr.timer--;${nl}` +
    `          if (dr.timer <= 0) { dr.stage = 1; dr.y = launcherY + 34; }${nl}` +
    `        } else if (dr.stage === 1 || dr.stage === 3) {${nl}` +
    `          dr.y += DBLREION_SPD;${nl}` +
    `          const col = dr.stage === 1 ? '#9a70d0' : '#7b5cff';${nl}` +
    `          const step = dr.stage === 1 ? 10 : 8;${nl}` +
    `          ctx.fillStyle = col;${nl}` +
    `          const phase = g.frame * 0.8;${nl}` +
    `          for (let bx = ((phase % step) - step); bx < W; bx += step) {${nl}` +
    `            const frontY = dr.y + (bx - W * 0.5) * tiltTan;${nl}` +
    `            ctx.globalAlpha = dr.stage === 1 ? 0.35 : 0.75;${nl}` +
    `            ctx.fillRect(Math.round(bx), Math.round(frontY) - 1, dr.stage === 1 ? 1 : 2, 2);${nl}` +
    `          }${nl}` +
    `          if (dr.stage === 3) {${nl}` +
    `            ctx.fillStyle = '#c8c0b8';${nl}` +
    `            for (let row = 1; row <= 2; row++) {${nl}` +
    `              ctx.globalAlpha = 0.10 / row;${nl}` +
    `              for (let bx = 0; bx < W; bx += 10 + row) {${nl}` +
    `                const wakeY = dr.y + (bx - W * 0.5) * tiltTan - row * 5;${nl}` +
    `                ctx.fillRect(bx, Math.round(wakeY), 1, 1);${nl}` +
    `              }${nl}` +
    `            }${nl}` +
    `          }${nl}` +
    `          ctx.globalAlpha = 1;${nl}` +
    `          if (dr.y > H + Math.abs(tiltTan) * W * 0.5) {${nl}` +
    `            if (dr.stage === 1) { dr.stage = 2; dr.timer = DBLREION_GAP; dr.y = -1; }${nl}` +
    `            else { dr.stage = 0; dr.timer = dr.period; dr.y = -1; }${nl}` +
    `          }${nl}` +
    `        } else if (dr.stage === 2) {${nl}` +
    `          dr.timer--;${nl}` +
    `          // Dark interlude — almost nothing drawn${nl}` +
    `          if (dr.timer % 20 === 0) {${nl}` +
    `            ctx.fillStyle = '#2a2430';${nl}` +
    `            ctx.globalAlpha = 0.08;${nl}` +
    `            ctx.fillRect(Math.round(W * 0.5), launcherY + 40, 1, 1);${nl}` +
    `            ctx.globalAlpha = 1;${nl}` +
    `          }${nl}` +
    `          if (dr.timer <= 0) { dr.stage = 3; dr.y = launcherY + 34; }${nl}` +
    `        }${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('DONE #127');
