/**
 * Resume/complete Zone O #116 after partial apply
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
  const i = s.indexOf(a) + a.length;
  s = s.slice(0, i) + ins + s.slice(i);
  console.log('ok', l);
}

// fix duplicate nakedLrdSeeds in for-of + add dressedPbhs
s = s.replace(
  'memoryBurdenEmbers, nakedLrdSeeds, nakedLrdSeeds, quantumFoams,',
  'memoryBurdenEmbers, nakedLrdSeeds, dressedPbhs, quantumFoams,'
);
s = s.replace(
  'memoryBurdenEmbers, nakedLrdSeeds, quantumFoams,',
  'memoryBurdenEmbers, nakedLrdSeeds, dressedPbhs, quantumFoams,'
);

if (!s.includes('nakedLrdSeeds.length = 0; dressedPbhs.length = 0')) {
  s = s.replace('nakedLrdSeeds.length = 0;', 'nakedLrdSeeds.length = 0; dressedPbhs.length = 0;');
  console.log('ok anomaly');
}

if (!s.includes('const dressedPbhs: DressedPbh[]')) {
  after(`const nakedLrdSeeds: NakedLrdSeed[] = [];${nl}`, `  const dressedPbhs: DressedPbh[] = [];${nl}`, 'empty');
}

if (!s.includes('g.dressedPbhs,')) {
  s = s.replace(`g.frbMicrolenses,${nl}`, `g.frbMicrolenses,${nl}    g.dressedPbhs,${nl}`);
  console.log('ok weakset');
}

if (!s.includes('dressedPbhRng')) {
  const pushBlock =
    `    nakedLrdSeeds.push({${nl}` +
    `      x: W * (0.28 + nakedSeedRng() * 0.44),${nl}` +
    `      y: topPad + playH * (0.28 + nakedSeedRng() * 0.40),${nl}` +
    `    });${nl}` +
    `  }${nl}`;
  if (!s.includes(pushBlock)) throw new Error('no naked push block');
  const ins =
    `${nl}` +
    `  // Dressed PBH microlens cloak (lv288+).${nl}` +
    `  const dressedPbhRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
    `  if (${nl}` +
    `    anomalyKind === null &&${nl}` +
    `    level >= 288 &&${nl}` +
    `    frbMicrolenses.length === 0 &&${nl}` +
    `    darkHalos.length === 0 &&${nl}` +
    `    primordialBHs.length === 0 &&${nl}` +
    `    gravitationalCaustics.length === 0 &&${nl}` +
    `    hazChance(dressedPbhRng, 0.35, 288, level)${nl}` +
    `  ) {${nl}` +
    `    dressedPbhs.push({${nl}` +
    `      x: W * (0.25 + dressedPbhRng() * 0.50),${nl}` +
    `      y: topPad + playH * (0.25 + dressedPbhRng() * 0.45),${nl}` +
    `      passingBalls: new WeakSet(),${nl}` +
    `      flashTimer: 0,${nl}` +
    `    });${nl}` +
    `  }${nl}`;
  const i = s.indexOf(pushBlock) + pushBlock.length;
  s = s.slice(0, i) + ins + s.slice(i);
  console.log('ok spawn');
}

// inject dressedPbhs into return/destructure lists
{
  let from = 0;
  let n = 0;
  while (n < 6) {
    const i = s.indexOf('nakedLrdSeeds,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 45).includes('dressedPbhs')) {
      s = s.slice(0, i) + 'nakedLrdSeeds, dressedPbhs,' + s.slice(i + 'nakedLrdSeeds,'.length);
      n++;
      console.log('inject list', i);
    }
    from = i + 50;
  }
}

if (!s.includes('dressedPbhs: [],')) {
  after(`nakedLrdSeeds: [],${nl}`, `    dressedPbhs: [],${nl}`, 'useref');
}
if (!s.includes('g.dressedPbhs = dressedPbhs')) {
  after(`g.nakedLrdSeeds = nakedLrdSeeds;${nl}`, `    g.dressedPbhs = dressedPbhs;${nl}`, 'assign');
}
if (!s.includes('dressedPbhs: DressedPbh[];')) {
  after(
    `nakedLrdSeeds: NakedLrdSeed[]; // lv285+ hostless LRD seed${nl}`,
    `  dressedPbhs: DressedPbh[]; // lv288+ dressed PBH microlens cloak${nl}`,
    'gs'
  );
}
if (!s.includes('dressedPbhs: DressedPbh[], cosmicBirefringences')) {
  s = s.replace(
    'nakedLrdSeeds: NakedLrdSeed[], cosmicBirefringences:',
    'nakedLrdSeeds: NakedLrdSeed[], dressedPbhs: DressedPbh[], cosmicBirefringences:'
  );
  console.log('ok gensig');
}

if (!s.includes('Dressed PBH halo:')) {
  const nls = '          for (const ns of g.nakedLrdSeeds) {';
  const nlsI = s.indexOf(nls);
  const popI = s.indexOf('          // Pop III.1 Flash:', nlsI);
  if (popI < 0) throw new Error('no pop');
  const ins =
    `          // Dressed PBH halo: weak continuous pull (cloak invisible).${nl}` +
    `          for (const dp of g.dressedPbhs) {${nl}` +
    `            const dx = dp.x - ball.x, dy = dp.y - ball.y;${nl}` +
    `            const d2 = dx * dx + dy * dy;${nl}` +
    `            if (d2 === 0 || d2 >= DPBH_HALO_R * DPBH_HALO_R) continue;${nl}` +
    `            const d = Math.sqrt(d2);${nl}` +
    `            const t = 1 - d / DPBH_HALO_R;${nl}` +
    `            const f = DPBH_HALO_F * t * t;${nl}` +
    `            ball.vx += (dx / d) * f;${nl}` +
    `            ball.vy += (dy / d) * f;${nl}` +
    `            if (g.frame % 5 === 0) pulseFieldFx(ball, '#5a6878');${nl}` +
    `          }${nl}${nl}`;
  s = s.slice(0, popI) + ins + s.slice(popI);
  console.log('ok halo');
}

if (!s.includes('Dressed PBH caustic ring:')) {
  const mark = 'ml.flashTimer = FRBML_FLASH;';
  const mi = s.indexOf(mark);
  const next = s.indexOf('              if (!teleported) for (', mi + 10);
  if (next < 0) throw new Error('no substep insert');
  const ins =
    `              // Dressed PBH caustic ring: one-shot radial kick + twist.${nl}` +
    `              if (!teleported) for (const dp of g.dressedPbhs) {${nl}` +
    `                const mdx = ball.x - dp.x, mdy = ball.y - dp.y;${nl}` +
    `                const mdist = Math.sqrt(mdx * mdx + mdy * mdy) || 1;${nl}` +
    `                const band = Math.abs(mdist - DPBH_RING_R);${nl}` +
    `                const inside = band < DPBH_RING_HALF + BALL_R;${nl}` +
    `                if (!inside) { dp.passingBalls.delete(ball); continue; }${nl}` +
    `                if (dp.passingBalls.has(ball)) continue;${nl}` +
    `                dp.passingBalls.add(ball);${nl}` +
    `                const nx = mdx / mdist, ny = mdy / mdist;${nl}` +
    `                ball.vx += nx * DPBH_KICK;${nl}` +
    `                ball.vy += ny * DPBH_KICK;${nl}` +
    `                const tw = ((Math.floor(ball.x) ^ Math.floor(ball.y)) & 1) === 0 ? DPBH_TWIST : -DPBH_TWIST;${nl}` +
    `                const tc = Math.cos(tw), ts = Math.sin(tw);${nl}` +
    `                const ovx = ball.vx, ovy = ball.vy;${nl}` +
    `                ball.vx = ovx * tc - ovy * ts;${nl}` +
    `                ball.vy = ovx * ts + ovy * tc;${nl}` +
    `                const nspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);${nl}` +
    `                if (nspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / nspd; ball.vx *= sc; ball.vy *= sc; }${nl}` +
    `                else if (nspd > 0 && nspd < effMinSpeed) { const sc = effMinSpeed / nspd; ball.vx *= sc; ball.vy *= sc; }${nl}` +
    `                dp.flashTimer = DPBH_FLASH;${nl}` +
    `                pulseTwistFx(ball);${nl}` +
    `                pulseForceFx(ball, '#c8b090');${nl}` +
    `              }${nl}${nl}`;
  s = s.slice(0, next) + ins + s.slice(next);
  console.log('ok substep');
}

if (!s.includes('Dressed PBH microlens cloaks')) {
  const mark = '      // ── Hostless LRD seeds (lv285+) ──';
  const mi = s.indexOf(mark);
  const endPat = `        ctx.globalAlpha = 1;${nl}      }${nl}`;
  const end = s.indexOf(endPat, mi) + endPat.length;
  const ins =
    `${nl}` +
    `      // ── Dressed PBH microlens cloaks (lv288+) ──${nl}` +
    `      for (const dp of g.dressedPbhs) {${nl}` +
    `        if (dp.flashTimer > 0) dp.flashTimer--;${nl}` +
    `        if (g.frame % 60 === 0) {${nl}` +
    `          ctx.fillStyle = '#5a6878';${nl}` +
    `          ctx.globalAlpha = 0.35;${nl}` +
    `          ctx.fillRect(Math.round(dp.x), Math.round(dp.y), 1, 1);${nl}` +
    `        }${nl}` +
    `        if (dp.flashTimer > 0) {${nl}` +
    `          const life = dp.flashTimer / DPBH_FLASH;${nl}` +
    `          ctx.fillStyle = '#c8b090';${nl}` +
    `          for (const off of [-0.08, 0.08] as const) {${nl}` +
    `            for (let i = 0; i < 20; i++) {${nl}` +
    `              const a = (i / 20) * Math.PI * 2;${nl}` +
    `              const rr = DPBH_RING_R * (1 + off);${nl}` +
    `              ctx.globalAlpha = life * 0.5;${nl}` +
    `              ctx.fillRect(Math.round(dp.x + Math.cos(a) * rr), Math.round(dp.y + Math.sin(a) * rr), 2, 1);${nl}` +
    `            }${nl}` +
    `          }${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}`;
  s = s.slice(0, end) + ins + s.slice(end);
  console.log('ok draw');
}

// Ensure interface + constants exist (from partial)
if (!s.includes('interface DressedPbh')) {
  after(
    `interface NakedLrdSeed { x: number; y: number }${nl}`,
    `interface DressedPbh { x: number; y: number; passingBalls: WeakSet<Ball>; flashTimer: number }${nl}`,
    'iface'
  );
}
if (!s.includes('DPBH_HALO_R')) {
  after(
    `const NLS_IN             = 0.08;  // weak inward component${nl}`,
    `const DPBH_HALO_R        = 110;${nl}const DPBH_HALO_F        = 0.22;${nl}const DPBH_RING_R        = 48;${nl}const DPBH_RING_HALF     = 10;${nl}const DPBH_KICK          = 0.55;${nl}const DPBH_TWIST         = 0.12;${nl}const DPBH_FLASH         = 10;${nl}`,
    'consts'
  );
}

fs.writeFileSync(file, s);
console.log('done resume 116');
