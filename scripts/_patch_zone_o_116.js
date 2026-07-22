/**
 * Patch Zone O #116 Dressed PBH Microlens Cloak
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'CryptoPeggleGame.tsx');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
function must(a, l) { if (!s.includes(a)) throw new Error('Missing: ' + l); }
function after(a, ins, l) {
  must(a, l);
  const i = s.indexOf(a) + a.length;
  s = s.slice(0, i) + ins + s.slice(i);
  console.log('ok', l);
}
function rep(from, to, l) {
  if (!s.includes(from)) throw new Error('Missing rep: ' + l);
  s = s.replace(from, to);
  console.log('ok rep', l);
}

after(
  `const NLS_IN             = 0.08;  // weak inward component${nl}`,
  `const DPBH_HALO_R        = 110;   // dressed PBH DM-halo pull radius${nl}` +
  `const DPBH_HALO_F        = 0.22;  // dressed PBH halo pull${nl}` +
  `const DPBH_RING_R        = 48;    // microlens caustic ring radius${nl}` +
  `const DPBH_RING_HALF     = 10;    // caustic band half-width${nl}` +
  `const DPBH_KICK          = 0.55;  // radial kick on ring cross${nl}` +
  `const DPBH_TWIST         = 0.12;  // velocity twist on ring cross${nl}` +
  `const DPBH_FLASH         = 10;    // ghost-arc flash frames${nl}`,
  'DPBH constants'
);

after(
  `interface NakedLrdSeed { x: number; y: number }${nl}`,
  `// Dressed PBH microlens (lv288+): invisible DM halo pull + one-shot caustic ring kick.${nl}` +
  `interface DressedPbh { x: number; y: number; passingBalls: WeakSet<Ball>; flashTimer: number }${nl}`,
  'DPBH interface'
);

after(
  `nakedLrdSeeds: NakedLrdSeed[]; // lv285+ hostless LRD seed${nl}`,
  `  dressedPbhs: DressedPbh[]; // lv288+ dressed PBH microlens cloak${nl}`,
  'DPBH GameState'
);

after(
  `const nakedLrdSeeds: NakedLrdSeed[] = [];${nl}`,
  `  const dressedPbhs: DressedPbh[] = [];${nl}`,
  'DPBH empty'
);

rep(`nakedLrdSeeds.length = 0;`, `nakedLrdSeeds.length = 0; dressedPbhs.length = 0;`, 'DPBH anomaly');
rep(
  `memoryBurdenEmbers, nakedLrdSeeds, quantumFoams,`,
  `memoryBurdenEmbers, nakedLrdSeeds, dressedPbhs, quantumFoams,`,
  'DPBH for-of'
);

// reset WeakSets list
rep(
  `g.frbMicrolenses,${nl}`,
  `g.frbMicrolenses,${nl}` +
  `    g.dressedPbhs,${nl}`,
  'DPBH weakset reset'
);

const spawnAnchor =
  `    nakedLrdSeeds.push({${nl}` +
  `      x: W * (0.28 + nakedSeedRng() * 0.44),${nl}` +
  `      y: topPad + playH * (0.28 + nakedSeedRng() * 0.40),${nl}` +
  `    });${nl}` +
  `  }${nl}${nl}` +
  `  // ─── Zone remix (gap levels)`;
must(spawnAnchor, 'spawn anchor');
after(
  spawnAnchor,
  `${nl}` +
  `  // Dressed PBH microlens cloak (lv288+): halo pull + caustic ring kick.${nl}` +
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
  `      passingBalls: new WeakSet<Ball>(),${nl}` +
  `      flashTimer: 0,${nl}` +
  `    });${nl}` +
  `  }${nl}${nl}` +
  `  // ─── Zone remix (gap levels)`,
  'DPBH spawn'
);
s = s.replace(
  `  // ─── Zone remix (gap levels)${nl}${nl}` +
  `  // Dressed PBH`,
  `  // Dressed PBH`
);

rep(`, nakedLrdSeeds, `, `, nakedLrdSeeds, dressedPbhs, `, 'DPBH ret1');
if ((s.match(/nakedLrdSeeds, dressedPbhs,/g) || []).length < 2) {
  let from = 0;
  for (let n = 0; n < 3 && from >= 0; ) {
    const i = s.indexOf('nakedLrdSeeds,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 40).includes('dressedPbhs')) {
      s = s.slice(0, i) + 'nakedLrdSeeds, dressedPbhs,' + s.slice(i + 'nakedLrdSeeds,'.length);
      n++;
      console.log('inject dressed at', i);
    }
    from = i + 40;
  }
}

after(`nakedLrdSeeds: [],${nl}`, `    dressedPbhs: [],${nl}`, 'DPBH useRef');
after(`g.nakedLrdSeeds = nakedLrdSeeds;${nl}`, `    g.dressedPbhs = dressedPbhs;${nl}`, 'DPBH assign');

rep(
  `nakedLrdSeeds: NakedLrdSeed[], cosmicBirefringences:`,
  `nakedLrdSeeds: NakedLrdSeed[], dressedPbhs: DressedPbh[], cosmicBirefringences:`,
  'DPBH gen sig'
);

// Halo force after NLS physics
const nlsPhysEnd = `          for (const ns of g.nakedLrdSeeds) {`;
must(nlsPhysEnd, 'nls phys');
// Find end of NLS block - next "// Pop III.1" or next hazard comment after nls
const nlsIdx = s.indexOf(nlsPhysEnd);
const popAfterNls = s.indexOf(`          // Pop III.1 Flash:`, nlsIdx);
if (popAfterNls < 0) throw new Error('no pop after nls');
const haloIns =
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
s = s.slice(0, popAfterNls) + haloIns + s.slice(popAfterNls);
console.log('ok DPBH halo force');

// Substep collision after frb microlenses block
const frbMlEnd = `              // FRB microlens IMBH: thin arc caustic — along-heading kick + twist once per approach.`;
must(frbMlEnd, 'frb ml');
const frbIdx = s.indexOf(frbMlEnd);
// Find next block comment after FRB ml loop - boson or cosmic string
const afterFrb = s.indexOf(`              // Cosmic string teleport-shift`, frbIdx);
const afterBoson = s.indexOf(`              // Boson star soft caustic`, frbIdx);
const insertSub = afterBoson >= 0 && (afterFrb < 0 || afterBoson < afterFrb) ? afterBoson
  : s.indexOf(`              // Cosmic string`, frbIdx);
if (insertSub < 0) {
  // try after frb loop closes - look for pulseTwistFx after frb and then next if
  const flash = s.indexOf(`ml.flashTimer = FRBML_FLASH;`, frbIdx);
  const nextIf = s.indexOf(`              if (!teleported) for (`, flash + 10);
  if (nextIf < 0) throw new Error('no insert for substep');
  // insert before that next if
  const subIns =
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
  s = s.slice(0, nextIf) + subIns + s.slice(nextIf);
  console.log('ok DPBH substep');
} else {
  const subIns =
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
  s = s.slice(0, insertSub) + subIns + s.slice(insertSub);
  console.log('ok DPBH substep alt');
}

// Draw after NLS draw
const nlsDraw = `      // ── Hostless LRD seeds (lv285+) ──`;
must(nlsDraw, 'nls draw');
const nlsDIdx = s.indexOf(nlsDraw);
const nlsDEnd = s.indexOf(`        ctx.globalAlpha = 1;${nl}` + `      }${nl}`, nlsDIdx) ;
const nlsEndAt = nlsDEnd + (`        ctx.globalAlpha = 1;${nl}` + `      }${nl}`).length;
const dpbhDraw =
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
if (!s.includes('Dressed PBH microlens cloaks')) {
  s = s.slice(0, nlsEndAt) + dpbhDraw + s.slice(nlsEndAt);
  console.log('ok DPBH draw');
}

fs.writeFileSync(file, s);
console.log('done #116');
