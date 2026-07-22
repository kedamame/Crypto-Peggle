/**
 * Patch Zone O #117 F_AP Anisotropy Loom
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'CryptoPeggleGame.tsx');
let s = fs.readFileSync(file, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

function after(a, ins, l) {
  if (!s.includes(a)) throw new Error('Missing: ' + l + ' :: ' + JSON.stringify(a.slice(0, 50)));
  const probe = ins.replace(/\r?\n/g, '').slice(0, 24);
  if (s.replace(/\r\n/g, '\n').includes(probe)) { console.log('skip', l); return; }
  s = s.slice(0, s.indexOf(a) + a.length) + ins + s.slice(s.indexOf(a) + a.length);
  console.log('ok', l);
}

after(
  `const DPBH_FLASH         = 10;    // ghost-arc flash frames${nl}`,
  `const FAP_RX             = 95;    // F_AP loom ellipse rx${nl}` +
  `const FAP_RY             = 70;    // F_AP loom ellipse ry${nl}` +
  `const FAP_AXIS_SCALE     = 1.025; // stretch along loom axis${nl}` +
  `const FAP_ORTHO_SCALE    = 0.975; // compress along orthogonal${nl}`,
  'FAP consts'
);

after(
  `interface DressedPbh { x: number; y: number; passingBalls: WeakSet<Ball>; flashTimer: number }${nl}`,
  `// F_AP anisotropy loom (lv291+): axis-anisotropic speed-preserving velocity scale inside ellipse.${nl}` +
  `interface FapLoom { x: number; y: number; rx: number; ry: number; axis: number }${nl}`,
  'FAP iface'
);

after(
  `dressedPbhs: DressedPbh[]; // lv288+ dressed PBH microlens cloak${nl}`,
  `  fapLooms: FapLoom[]; // lv291+ F_AP anisotropy loom${nl}`,
  'FAP gs'
);

after(`const dressedPbhs: DressedPbh[] = [];${nl}`, `  const fapLooms: FapLoom[] = [];${nl}`, 'FAP empty');

s = s.replace('dressedPbhs.length = 0;', 'dressedPbhs.length = 0; fapLooms.length = 0;');
s = s.replace(
  'nakedLrdSeeds, dressedPbhs, quantumFoams,',
  'nakedLrdSeeds, dressedPbhs, fapLooms, quantumFoams,'
);
console.log('ok clear');

{
  const push =
    `    dressedPbhs.push({${nl}` +
    `      x: W * (0.25 + dressedPbhRng() * 0.50),${nl}` +
    `      y: topPad + playH * (0.25 + dressedPbhRng() * 0.45),${nl}` +
    `      passingBalls: new WeakSet(),${nl}` +
    `      flashTimer: 0,${nl}` +
    `    });${nl}` +
    `  }${nl}`;
  if (!s.includes(push)) throw new Error('no dressed push');
  if (!s.includes('fapLoomRng')) {
    const ins =
      `${nl}` +
      `  // F_AP anisotropy loom (lv291+): DESI shape diagnostic as velocity loom.${nl}` +
      `  const fapLoomRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 291 &&${nl}` +
      `    cosmicShears.length === 0 &&${nl}` +
      `    iaContams.length === 0 &&${nl}` +
      `    mBiasVeils.length === 0 &&${nl}` +
      `    !alensActive &&${nl}` +
      `    hazChance(fapLoomRng, 0.35, 291, level)${nl}` +
      `  ) {${nl}` +
      `    fapLooms.push({${nl}` +
      `      x: W * (0.28 + fapLoomRng() * 0.44),${nl}` +
      `      y: topPad + playH * (0.28 + fapLoomRng() * 0.40),${nl}` +
      `      rx: FAP_RX,${nl}` +
      `      ry: FAP_RY,${nl}` +
      `      axis: fapLoomRng() * Math.PI,${nl}` +
      `    });${nl}` +
      `  }${nl}`;
    const i = s.indexOf(push) + push.length;
    s = s.slice(0, i) + ins + s.slice(i);
    console.log('ok spawn');
  }
}

{
  let from = 0, n = 0;
  while (n < 6) {
    const i = s.indexOf('dressedPbhs,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 40).includes('fapLooms')) {
      s = s.slice(0, i) + 'dressedPbhs, fapLooms,' + s.slice(i + 'dressedPbhs,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 40;
  }
}

after(`dressedPbhs: [],${nl}`, `    fapLooms: [],${nl}`, 'useref');
after(`g.dressedPbhs = dressedPbhs;${nl}`, `    g.fapLooms = fapLooms;${nl}`, 'assign');
s = s.replace(
  'dressedPbhs: DressedPbh[], cosmicBirefringences:',
  'dressedPbhs: DressedPbh[], fapLooms: FapLoom[], cosmicBirefringences:'
);
console.log('ok gensig');

if (!s.includes('F_AP anisotropy loom:')) {
  const mark = '          // Dressed PBH halo:';
  const mi = s.indexOf(mark);
  const pop = s.indexOf('          // Pop III.1 Flash:', mi);
  const ins =
    `          // F_AP anisotropy loom: axis stretch / ortho compress, then renormalize speed.${nl}` +
    `          for (const fl of g.fapLooms) {${nl}` +
    `            const dx = ball.x - fl.x, dy = ball.y - fl.y;${nl}` +
    `            const c = Math.cos(fl.axis), sn = Math.sin(fl.axis);${nl}` +
    `            const lx = c * dx + sn * dy;${nl}` +
    `            const ly = -sn * dx + c * dy;${nl}` +
    `            if ((lx * lx) / (fl.rx * fl.rx) + (ly * ly) / (fl.ry * fl.ry) > 1) continue;${nl}` +
    `            const spd0 = Math.hypot(ball.vx, ball.vy);${nl}` +
    `            if (spd0 < 1e-6) continue;${nl}` +
    `            const ax = c, ay = sn;${nl}` +
    `            const ox = -sn, oy = c;${nl}` +
    `            const va = ball.vx * ax + ball.vy * ay;${nl}` +
    `            const vo = ball.vx * ox + ball.vy * oy;${nl}` +
    `            const nva = va * FAP_AXIS_SCALE;${nl}` +
    `            const nvo = vo * FAP_ORTHO_SCALE;${nl}` +
    `            ball.vx = nva * ax + nvo * ox;${nl}` +
    `            ball.vy = nva * ay + nvo * oy;${nl}` +
    `            const spd1 = Math.hypot(ball.vx, ball.vy) || 1;${nl}` +
    `            ball.vx *= spd0 / spd1;${nl}` +
    `            ball.vy *= spd0 / spd1;${nl}` +
    `            pulseForceFx(ball, g.frame % 2 === 0 ? '#8a7060' : '#90a0a8');${nl}` +
    `          }${nl}${nl}`;
  s = s.slice(0, pop) + ins + s.slice(pop);
  console.log('ok phys');
}

if (!s.includes('F_AP anisotropy looms')) {
  const mark = '      // ── Dressed PBH microlens cloaks (lv288+) ──';
  const mi = s.indexOf(mark);
  const endPat = `        ctx.globalAlpha = 1;${nl}      }${nl}`;
  const end = s.indexOf(endPat, mi) + endPat.length;
  const ins =
    `${nl}` +
    `      // ── F_AP anisotropy looms (lv291+) ──${nl}` +
    `      for (const fl of g.fapLooms) {${nl}` +
    `        const c = Math.cos(fl.axis), sn = Math.sin(fl.axis);${nl}` +
    `        ctx.globalAlpha = 0.18;${nl}` +
    `        for (let i = -4; i <= 4; i++) {${nl}` +
    `          const t = i / 4;${nl}` +
    `          ctx.fillStyle = '#8a7060';${nl}` +
    `          ctx.fillRect(Math.round(fl.x + c * t * fl.rx), Math.round(fl.y + sn * t * fl.rx), 1, 1);${nl}` +
    `          ctx.fillStyle = '#90a0a8';${nl}` +
    `          ctx.fillRect(Math.round(fl.x - sn * t * fl.ry), Math.round(fl.y + c * t * fl.ry), 1, 1);${nl}` +
    `        }${nl}` +
    `        ctx.globalAlpha = 1;${nl}` +
    `      }${nl}`;
  s = s.slice(0, end) + ins + s.slice(end);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('done 117');
