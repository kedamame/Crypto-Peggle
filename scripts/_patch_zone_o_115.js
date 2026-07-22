/**
 * Patch Zone O #115 Hostless LRD Seed
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'CryptoPeggleGame.tsx');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

function must(a, l) { if (!s.includes(a)) throw new Error('Missing: ' + l); }
function after(a, ins, l) {
  must(a, l);
  if (s.includes('nakedLrdSeeds') && l !== 'NLS constants' && !l.includes('constants') && l !== 'NLS interface') {
    // allow re-run checks below
  }
  if (ins.includes('NakedLrdSeed') && s.includes(ins.trim().slice(0, 40).replace(/\r?\n/g,''))) {
    console.log('skip', l); return;
  }
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
  `const MBE_PERIOD         = 280;   // frames between pulses${nl}`,
  `const NLS_RANGE          = 95;    // hostless LRD seed force radius${nl}` +
  `const NLS_TANG           = 0.35;  // Keplerian tangential force${nl}` +
  `const NLS_IN             = 0.08;  // weak inward component${nl}`,
  'NLS constants'
);

after(
  `interface MemoryBurdenEmber { x: number; y: number; period: number; timer: number; releaseTimer: number }${nl}`,
  `// Hostless LRD seed (lv285+): naked BH Keplerian swirl with no host cocoon.${nl}` +
  `interface NakedLrdSeed { x: number; y: number }${nl}`,
  'NLS interface'
);

after(
  `memoryBurdenEmbers: MemoryBurdenEmber[]; // lv282+ memory-burden PBH ember${nl}`,
  `  nakedLrdSeeds: NakedLrdSeed[]; // lv285+ hostless LRD seed${nl}`,
  'NLS GameState'
);

after(
  `const memoryBurdenEmbers: MemoryBurdenEmber[] = [];${nl}`,
  `  const nakedLrdSeeds: NakedLrdSeed[] = [];${nl}`,
  'NLS empty'
);

rep(`memoryBurdenEmbers.length = 0;`, `memoryBurdenEmbers.length = 0; nakedLrdSeeds.length = 0;`, 'NLS anomaly clear');
rep(
  `darkStars, hawkingPoints, memoryBurdenEmbers, quantumFoams,`,
  `darkStars, hawkingPoints, memoryBurdenEmbers, nakedLrdSeeds, quantumFoams,`,
  'NLS for-of'
);

const spawnAfter =
  `      releaseTimer: 0,${nl}` +
  `    });${nl}` +
  `  }${nl}${nl}` +
  `  // ─── Zone remix (gap levels)`;

must(spawnAfter, 'spawn after mbe');
after(
  spawnAfter,
  `${nl}` +
  `  // Hostless LRD seed (lv285+): Keplerian swirl, no host cocoon.${nl}` +
  `  const nakedSeedRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
  `  if (${nl}` +
  `    anomalyKind === null &&${nl}` +
  `    level >= 285 &&${nl}` +
  `    littleRedDots.length === 0 &&${nl}` +
  `    bhStarCocoons.length === 0 &&${nl}` +
  `    ommCores.length === 0 &&${nl}` +
  `    hazChance(nakedSeedRng, 0.35, 285, level)${nl}` +
  `  ) {${nl}` +
  `    nakedLrdSeeds.push({${nl}` +
  `      x: W * (0.28 + nakedSeedRng() * 0.44),${nl}` +
  `      y: topPad + playH * (0.28 + nakedSeedRng() * 0.40),${nl}` +
  `    });${nl}` +
  `  }${nl}${nl}` +
  `  // ─── Zone remix (gap levels)`,
  'NLS spawn'
);
s = s.replace(
  `  // ─── Zone remix (gap levels)${nl}${nl}` +
  `  // Hostless LRD seed`,
  `  // Hostless LRD seed`
);

rep(`, memoryBurdenEmbers, `, `, memoryBurdenEmbers, nakedLrdSeeds, `, 'NLS return1');
if ((s.match(/memoryBurdenEmbers, nakedLrdSeeds,/g) || []).length < 2) {
  let from = 0, n = 0;
  while (n < 2) {
    const i = s.indexOf('memoryBurdenEmbers,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 40).includes('nakedLrdSeeds')) {
      s = s.slice(0, i) + 'memoryBurdenEmbers, nakedLrdSeeds,' + s.slice(i + 'memoryBurdenEmbers,'.length);
      n++;
      console.log('ok NLS inject at', i);
    }
    from = i + 30;
  }
}

after(`memoryBurdenEmbers: [],${nl}`, `    nakedLrdSeeds: [],${nl}`, 'NLS useRef');
after(`g.memoryBurdenEmbers = memoryBurdenEmbers;${nl}`, `    g.nakedLrdSeeds = nakedLrdSeeds;${nl}`, 'NLS assign');

rep(
  `memoryBurdenEmbers: MemoryBurdenEmber[], cosmicBirefringences:`,
  `memoryBurdenEmbers: MemoryBurdenEmber[], nakedLrdSeeds: NakedLrdSeed[], cosmicBirefringences:`,
  'NLS gen sig'
);

const physAfter =
  `          }${nl}${nl}` +
  `          // Pop III.1 Flash:`;
// Find the MBE physics block end more uniquely
const mbePhysEnd = `              }${nl}` +
  `            }${nl}` +
  `          }${nl}${nl}` +
  `          // Pop III.1 Flash:`;
must(mbePhysEnd, 'mbe phys end');
after(
  mbePhysEnd,
  `${nl}` +
  `          // Hostless LRD seed: tangential Keplerian swirl + weak inward (no absorb).${nl}` +
  `          for (const ns of g.nakedLrdSeeds) {${nl}` +
  `            const dx = ball.x - ns.x, dy = ball.y - ns.y;${nl}` +
  `            const d2 = dx * dx + dy * dy;${nl}` +
  `            if (d2 === 0 || d2 >= NLS_RANGE * NLS_RANGE) continue;${nl}` +
  `            const d = Math.sqrt(d2);${nl}` +
  `            const t = 1 - d / NLS_RANGE;${nl}` +
  `            const ux = dx / d, uy = dy / d;${nl}` +
  `            const tx = -uy, ty = ux;${nl}` +
  `            const ft = NLS_TANG * t * t;${nl}` +
  `            const fi = NLS_IN * t * t;${nl}` +
  `            ball.vx += tx * ft - ux * fi;${nl}` +
  `            ball.vy += ty * ft - uy * fi;${nl}` +
  `            pulseTwistFx(ball);${nl}` +
  `            if (d < 40) pulseFieldFx(ball, '#a03028');${nl}` +
  `            const spd = Math.hypot(ball.vx, ball.vy);${nl}` +
  `            if (spd > BALL_SPEED * 2) {${nl}` +
  `              ball.vx *= (BALL_SPEED * 2) / spd;${nl}` +
  `              ball.vy *= (BALL_SPEED * 2) / spd;${nl}` +
  `            }${nl}` +
  `          }${nl}${nl}` +
  `          // Pop III.1 Flash:`,
  'NLS physics'
);
s = s.replace(
  `          // Pop III.1 Flash:${nl}${nl}` +
  `          // Hostless LRD seed:`,
  `          // Hostless LRD seed:`
);

const drawEnd =
  `        ctx.globalAlpha = 1;${nl}` +
  `      }${nl}`;
// Find MBE draw block end uniquely
const mbeDrawMarker = `      // ── Memory-burdened PBH embers (lv282+) ──`;
must(mbeDrawMarker, 'mbe draw');
const mbeDrawIdx = s.indexOf(mbeDrawMarker);
const afterMbe = s.indexOf(drawEnd, mbeDrawIdx);
if (afterMbe < 0) throw new Error('no mbe draw end');
const insertAt = afterMbe + drawEnd.length;
const nlsDraw =
  `${nl}` +
  `      // ── Hostless LRD seeds (lv285+) ──${nl}` +
  `      for (const ns of g.nakedLrdSeeds) {${nl}` +
  `        ctx.fillStyle = '#a03028';${nl}` +
  `        ctx.globalAlpha = 0.85;${nl}` +
  `        ctx.fillRect(Math.round(ns.x) - 2, Math.round(ns.y) - 2, 4, 4);${nl}` +
  `        ctx.fillStyle = '#6a98a8';${nl}` +
  `        for (let i = 0; i < 12; i++) {${nl}` +
  `          if (i % 2 === 0) continue;${nl}` +
  `          const a = (i / 12) * Math.PI * 2 + g.frame * 0.02;${nl}` +
  `          const rr = 18 + (i % 3) * 6;${nl}` +
  `          ctx.globalAlpha = 0.25;${nl}` +
  `          ctx.fillRect(Math.round(ns.x + Math.cos(a) * rr), Math.round(ns.y + Math.sin(a) * rr), 1, 1);${nl}` +
  `        }${nl}` +
  `        ctx.globalAlpha = 1;${nl}` +
  `      }${nl}`;
if (!s.includes('Hostless LRD seeds (lv285+)')) {
  s = s.slice(0, insertAt) + nlsDraw + s.slice(insertAt);
  console.log('ok NLS draw');
}

fs.writeFileSync(file, s);
console.log('done #115');
