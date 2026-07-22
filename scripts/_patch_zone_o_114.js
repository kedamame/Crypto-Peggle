/**
 * Patch Zone O #114 Memory-Burdened PBH Ember into CryptoPeggleGame.tsx
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'CryptoPeggleGame.tsx');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

function mustInclude(anchor, label) {
  if (!s.includes(anchor)) throw new Error('Missing anchor: ' + label + ' :: ' + JSON.stringify(anchor.slice(0, 60)));
}

function insertAfter(anchor, insert, label) {
  mustInclude(anchor, label);
  const probe = insert.replace(/\r?\n/g, '').slice(0, 28);
  if (s.replace(/\r\n/g, '\n').includes(probe)) {
    console.log('skip (already present):', label);
    return;
  }
  const i = s.indexOf(anchor) + anchor.length;
  s = s.slice(0, i) + insert + s.slice(i);
  console.log('ok:', label);
}

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error('Missing replace target: ' + label);
  s = s.replace(from, to);
  console.log('ok replace:', label);
}

insertAfter(
  `const IHDE_DRAG          = 0.990; // opposite side mild drag${nl}`,
  `const MBE_PULL           = 0.18;  // memory-burden ember weak pull (t*t)${nl}` +
  `const MBE_RANGE          = 70;    // memory-burden ember pull radius${nl}` +
  `const MBE_PULSE_FORCE    = 0.7;   // young-evaporation outward pulse${nl}` +
  `const MBE_PULSE_RANGE    = 110;   // pulse radius${nl}` +
  `const MBE_RELEASE        = 12;    // pulse duration frames${nl}` +
  `const MBE_PERIOD         = 280;   // frames between pulses${nl}`,
  'MBE constants'
);

insertAfter(
  `interface IhdeBelt { y: number; halfW: number; dir: 1 | -1 }${nl}`,
  `// Memory-burdened PBH ember (lv282+): weak continuous pull + periodic young-evaporation pulse.${nl}` +
  `interface MemoryBurdenEmber { x: number; y: number; period: number; timer: number; releaseTimer: number }${nl}`,
  'MBE interface'
);

insertAfter(
  `ihdeBelts: IhdeBelt[]; // lv277+ interacting HDE transfer belt${nl}`,
  `  memoryBurdenEmbers: MemoryBurdenEmber[]; // lv282+ memory-burden PBH ember${nl}`,
  'MBE GameState'
);

insertAfter(
  `const ihdeBelts: IhdeBelt[] = [];${nl}`,
  `  const memoryBurdenEmbers: MemoryBurdenEmber[] = [];${nl}`,
  'MBE empty decl'
);

replaceOnce(
  `ihdeBelts.length = 0;`,
  `ihdeBelts.length = 0; memoryBurdenEmbers.length = 0;`,
  'MBE anomaly clear'
);

replaceOnce(
  `darkStars, hawkingPoints, quantumFoams,`,
  `darkStars, hawkingPoints, memoryBurdenEmbers, quantumFoams,`,
  'MBE for-of clear'
);

const spawnAnchor =
  `    ihdeBelts.push({${nl}` +
  `      y: topPad + playH * (0.28 + ihdeRng() * 0.44),${nl}` +
  `      halfW: IHDE_HALF,${nl}` +
  `      dir: hazChance(ihdeRng, 0.5) ? 1 : -1,${nl}` +
  `    });${nl}` +
  `  }${nl}${nl}` +
  `  // ─── Zone remix (gap levels) ───────────────────────────────────────────────`;

insertAfter(
  spawnAnchor,
  `${nl}` +
  `  // Memory-burdened PBH ember (lv282+): weak pull + periodic young-evaporation pulse.${nl}` +
  `  const mbeRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
  `  if (${nl}` +
  `    anomalyKind === null &&${nl}` +
  `    level >= 282 &&${nl}` +
  `    microBHs.length === 0 &&${nl}` +
  `    primordialBHs.length === 0 &&${nl}` +
  `    subsolarPbhEcho === null &&${nl}` +
  `    hawkingPoints.length === 0 &&${nl}` +
  `    hazChance(mbeRng, 0.35, 282, level)${nl}` +
  `  ) {${nl}` +
  `    memoryBurdenEmbers.push({${nl}` +
  `      x: W * (0.22 + mbeRng() * 0.56),${nl}` +
  `      y: topPad + playH * (0.22 + mbeRng() * 0.50),${nl}` +
  `      period: MBE_PERIOD,${nl}` +
  `      timer: 60 + Math.floor(mbeRng() * 120),${nl}` +
  `      releaseTimer: 0,${nl}` +
  `    });${nl}` +
  `  }${nl}${nl}` +
  `  // ─── Zone remix (gap levels) ───────────────────────────────────────────────`,
  'MBE spawn'
);
// Fix: insertAfter kept the zone remix comment duplicated - the spawnAnchor ended WITH the remix comment,
// so we duplicated it. Undo by removing the duplicate header left behind.
s = s.replace(
  `  // ─── Zone remix (gap levels) ───────────────────────────────────────────────${nl}${nl}` +
  `  // Memory-burdened PBH ember`,
  `  // Memory-burdened PBH ember`
);

replaceOnce(`, ihdeBelts, `, `, ihdeBelts, memoryBurdenEmbers, `, 'MBE return/destructure first');
// Second occurrence for destructure if still needed
if ((s.match(/ihdeBelts, memoryBurdenEmbers,/g) || []).length < 2) {
  const idx = s.indexOf('ihdeBelts,');
  const idx2 = s.indexOf('ihdeBelts,', idx + 1);
  if (idx2 >= 0 && !s.slice(idx2, idx2 + 40).includes('memoryBurdenEmbers')) {
    s = s.slice(0, idx2) + 'ihdeBelts, memoryBurdenEmbers,' + s.slice(idx2 + 'ihdeBelts,'.length);
    console.log('ok: MBE destructure second');
  }
}

insertAfter(`ihdeBelts: [],${nl}`, `    memoryBurdenEmbers: [],${nl}`, 'MBE useRef');
insertAfter(`g.ihdeBelts = ihdeBelts;${nl}`, `    g.memoryBurdenEmbers = memoryBurdenEmbers;${nl}`, 'MBE assign');

replaceOnce(
  `ihdeBelts: IhdeBelt[]`,
  `ihdeBelts: IhdeBelt[], memoryBurdenEmbers: MemoryBurdenEmber[]`,
  'MBE generateLevel sig'
);

const physAnchor =
  `            if (hp.releaseTimer === HP_RELEASE) spawnBurst(g, ball.x, ball.y, 0, 0, '#e8d8c0');${nl}` +
  `          }${nl}${nl}` +
  `          // Pop III.1 Flash:`;

insertAfter(
  physAnchor,
  `${nl}` +
  `          // Memory-burden ember: weak continuous pull; young-evaporation outward pulse while releasing.${nl}` +
  `          for (const mbe of g.memoryBurdenEmbers) {${nl}` +
  `            const mdx = ball.x - mbe.x, mdy = ball.y - mbe.y;${nl}` +
  `            const md2 = mdx * mdx + mdy * mdy;${nl}` +
  `            if (md2 > 0 && md2 < MBE_RANGE * MBE_RANGE) {${nl}` +
  `              const md = Math.sqrt(md2);${nl}` +
  `              const mt = 1 - md / MBE_RANGE;${nl}` +
  `              const mf = MBE_PULL * mt * mt;${nl}` +
  `              ball.vx -= (mdx / md) * mf;${nl}` +
  `              ball.vy -= (mdy / md) * mf;${nl}` +
  `              if (g.frame % 5 === 0) pulseFieldFx(ball, '#8a8078');${nl}` +
  `            }${nl}` +
  `            if (mbe.releaseTimer > 0 && md2 > 0 && md2 < MBE_PULSE_RANGE * MBE_PULSE_RANGE) {${nl}` +
  `              const md = Math.sqrt(md2);${nl}` +
  `              const mt = 1 - md / MBE_PULSE_RANGE;${nl}` +
  `              const mf = MBE_PULSE_FORCE * mt * mt;${nl}` +
  `              ball.vx += (mdx / md) * mf;${nl}` +
  `              ball.vy += (mdy / md) * mf;${nl}` +
  `              pulseForceFx(ball, '#e8e0d0');${nl}` +
  `              const spd = Math.hypot(ball.vx, ball.vy);${nl}` +
  `              if (spd > BALL_SPEED * 2) {${nl}` +
  `                ball.vx *= (BALL_SPEED * 2) / spd;${nl}` +
  `                ball.vy *= (BALL_SPEED * 2) / spd;${nl}` +
  `              }${nl}` +
  `            }${nl}` +
  `          }${nl}${nl}` +
  `          // Pop III.1 Flash:`,
  'MBE physics'
);
s = s.replace(
  `          // Pop III.1 Flash:${nl}${nl}` +
  `          // Memory-burden ember:`,
  `          // Memory-burden ember:`
);

// Draw: insert after hawking points block uniquely
const drawMarker = `      // ── Hawking Points: ghost rings that periodically fire a warmth pulse ──`;
mustInclude(drawMarker, 'hawking draw marker');
const hawkingEnd = `          ctx.fillRect(Math.round(hp.x) - 3, Math.round(hp.y) - 3, 6, 6);${nl}` +
  `        }${nl}` +
  `        ctx.globalAlpha = 1;${nl}` +
  `      }${nl}`;
mustInclude(hawkingEnd, 'hawking draw end');
insertAfter(
  hawkingEnd,
  `${nl}` +
  `      // ── Memory-burdened PBH embers (lv282+) ──${nl}` +
  `      for (const mbe of g.memoryBurdenEmbers) {${nl}` +
  `        if (mbe.releaseTimer > 0) {${nl}` +
  `          mbe.releaseTimer--;${nl}` +
  `        } else {${nl}` +
  `          mbe.timer--;${nl}` +
  `          if (mbe.timer <= 0) {${nl}` +
  `            mbe.releaseTimer = MBE_RELEASE;${nl}` +
  `            mbe.timer = mbe.period;${nl}` +
  `          }${nl}` +
  `        }${nl}` +
  `        ctx.fillStyle = '#8a8078';${nl}` +
  `        ctx.globalAlpha = 0.35 + 0.2 * (0.5 + 0.5 * Math.sin(g.frame * 0.01));${nl}` +
  `        ctx.fillRect(Math.round(mbe.x), Math.round(mbe.y), 1, 1);${nl}` +
  `        if (mbe.releaseTimer > 0) {${nl}` +
  `          const rt = 1 - mbe.releaseTimer / MBE_RELEASE;${nl}` +
  `          ctx.fillStyle = '#e8e0d0';${nl}` +
  `          for (let i = 0; i < 36; i++) {${nl}` +
  `            if (i % 3 === 0) continue;${nl}` +
  `            const a = (i / 36) * Math.PI * 2;${nl}` +
  `            const rr = 8 + rt * (MBE_PULSE_RANGE - 8);${nl}` +
  `            ctx.globalAlpha = (1 - rt) * 0.7;${nl}` +
  `            ctx.fillRect(${nl}` +
  `              Math.round(mbe.x + Math.cos(a) * rr),${nl}` +
  `              Math.round(mbe.y + Math.sin(a) * rr),${nl}` +
  `              2, 2,${nl}` +
  `            );${nl}` +
  `          }${nl}` +
  `        }${nl}` +
  `        ctx.globalAlpha = 1;${nl}` +
  `      }${nl}`,
  'MBE draw'
);

fs.writeFileSync(file, s);
console.log('Patched #114 OK');
