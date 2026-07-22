/**
 * Patch Zone P #122 EDE Law Blink
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
  `const QGL_FLASH         = 10;    // nucleus flash frames after kick${nl}`,
  `const EDEBLINK_PERIOD   = 380;   // frames between EDE law blinks${nl}` +
  `const EDEBLINK_WARN     = 18;    // telegraph frames before blink${nl}` +
  `const EDEBLINK_DUR      = 10;    // force-sign-flip duration frames${nl}`,
  'EDE consts'
);

after(
  `quadGhostLenses: QuadGhostLens[]; // lv305+ quadruple-image ghost lens${nl}`,
  `  edeLawActive: boolean; // lv308+ EDE law blink present on level${nl}` +
  `  edeLawTimer: number; // countdown to next blink cycle${nl}` +
  `  edeLawWarn: number; // telegraph remaining${nl}` +
  `  edeLawBlink: number; // active force-sign-flip remaining${nl}`,
  'EDE gs'
);

after(`const quadGhostLenses: QuadGhostLens[] = [];${nl}`, `  let edeLawActive = false;${nl}`, 'EDE empty');

if (!s.includes('edeLawActive = false;') || s.split('edeLawActive = false').length < 3) {
  // anomaly clear — reset local
  if (!s.includes('edeLawActive = false; // anomaly')) {
    s = s.replace(
      'quadGhostLenses.length = 0;',
      'quadGhostLenses.length = 0; edeLawActive = false;'
    );
    console.log('ok clear');
  }
}
if (!s.includes('edeLawActive, quantumFoams') && !s.includes('edeLawActive, firewalls')) {
  s = s.replace(
    'quadGhostLenses, quantumFoams,',
    'quadGhostLenses, edeLawActive, quantumFoams,'
  );
  console.log('ok anomaly list');
}

{
  const mark =
    `      track: new WeakMap(),${nl}` +
    `    });${nl}` +
    `  }${nl}`;
  // find qgl spawn end uniquely
  const qglSpawn = `  // Quadruple-image ghost lens (lv305+).${nl}`;
  const qi = s.indexOf(qglSpawn);
  if (qi < 0) throw new Error('no qgl spawn');
  const afterQgl = s.indexOf(`  }${nl}`, s.indexOf('track: new WeakMap()', qi));
  if (afterQgl < 0) throw new Error('no qgl end');
  if (!s.includes('edeBlinkRng')) {
    const ins =
      `${nl}` +
      `  // EDE law blink (lv308+).${nl}` +
      `  const edeBlinkRng = makeRng((rng() * 0x100000000) >>> 0);${nl}` +
      `  if (${nl}` +
      `    anomalyKind === null &&${nl}` +
      `    level >= 308 &&${nl}` +
      `    !quintomBreathActive &&${nl}` +
      `    signIdeSeams.length === 0 &&${nl}` +
      `    hazChance(edeBlinkRng, 0.35, 308, level)${nl}` +
      `  ) {${nl}` +
      `    edeLawActive = true;${nl}` +
      `  }${nl}`;
    const end = afterQgl + `  }${nl}`.length;
    s = s.slice(0, end) + ins + s.slice(end);
    console.log('ok spawn');
  }
}

{
  let from = 0, n = 0;
  while (n < 8) {
    const i = s.indexOf(', quadGhostLenses,', from);
    if (i < 0) break;
    if (!s.slice(i, i + 50).includes('edeLawActive')) {
      s = s.slice(0, i) + ', quadGhostLenses, edeLawActive,' + s.slice(i + ', quadGhostLenses,'.length);
      n++;
      console.log('inject', i);
    }
    from = i + 40;
  }
}

after(`quadGhostLenses: [],${nl}`,
  `    edeLawActive: false,${nl}` +
  `    edeLawTimer: EDEBLINK_PERIOD,${nl}` +
  `    edeLawWarn: 0,${nl}` +
  `    edeLawBlink: 0,${nl}`,
  'useref');

after(`g.quadGhostLenses = quadGhostLenses;${nl}`,
  `    g.edeLawActive = edeLawActive;${nl}` +
  `    g.edeLawTimer = EDEBLINK_PERIOD;${nl}` +
  `    g.edeLawWarn = 0;${nl}` +
  `    g.edeLawBlink = 0;${nl}`,
  'assign');

s = s.replace(
  'quadGhostLenses: QuadGhostLens[], cosmicBirefringences:',
  'quadGhostLenses: QuadGhostLens[], edeLawActive: boolean, cosmicBirefringences:'
);
console.log('ok gensig');

// After gravity apply: save pre-force velocity when blink active
if (!s.includes('edePreVx')) {
  const gravApply = 'if (!inBubbleU && !inSpbhEcho) ball.vy += effGrav * quintomScale * varCoupScale * h0Scale * s8Scale * nuNullScale * ideSiphonScale * phBeltScale * dePertScale * scptGravScale;';
  if (!s.includes(gravApply)) throw new Error('no grav apply');
  s = s.replace(
    gravApply,
    gravApply + nl +
    `          const edePreVx = ball.vx;${nl}` +
    `          const edePreVy = ball.vy;`
  );
  console.log('ok pre save');
}

// Before ABP / at end of continuous forces: flip delta
if (!s.includes('EDE law blink: invert')) {
  const mark = `          // Quadruple-image ghost lens: weak inward pull; exit after closest approach kicks outward.${nl}`;
  if (!s.includes(mark)) throw new Error('no qgl phys');
  // Actually put AFTER all continuous forces, before QGL is ok too - plan says after continuous forces.
  // Best: right before substeps, after ABP block.
  const sub = `          // Sub-step movement: split frame into ≤BALL_R px steps so the ball${nl}`;
  // Insert before axion block's end... Find after ABP block ends, before Sub-step
  // ABP ends with `          }${nl}${nl}          // Sub-step`
  const abpEnd = `            if (g.frame % 6 === 0) pulseTwistFx(ball);${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // Sub-step movement:`;
  if (!s.includes(abpEnd)) throw new Error('no abp end before sub');
  const flip =
    `            if (g.frame % 6 === 0) pulseTwistFx(ball);${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // EDE law blink: invert non-gravity continuous-force delta for EDEBLINK_DUR frames.${nl}` +
    `          if (g.edeLawActive && g.edeLawBlink > 0) {${nl}` +
    `            ball.vx = edePreVx - (ball.vx - edePreVx);${nl}` +
    `            ball.vy = edePreVy - (ball.vy - edePreVy);${nl}` +
    `            pulseFieldFx(ball, '#d8a860');${nl}` +
    `          }${nl}` +
    `${nl}` +
    `          // Sub-step movement:`;
  s = s.replace(abpEnd, flip);
  console.log('ok flip');
}

// Draw + advance timers (with QGL draw)
if (!s.includes('EDE law blink (lv308+)')) {
  const mark = `      // ── Quadruple-image ghost lens (lv305+) ──${nl}`;
  if (!s.includes(mark)) throw new Error('no qgl draw');
  const draw =
    `      // ── EDE law blink (lv308+) ──${nl}` +
    `      if (g.edeLawActive) {${nl}` +
    `        if (g.edeLawBlink > 0) {${nl}` +
    `          g.edeLawBlink--;${nl}` +
    `        } else if (g.edeLawWarn > 0) {${nl}` +
    `          g.edeLawWarn--;${nl}` +
    `          if (g.edeLawWarn <= 0) g.edeLawBlink = EDEBLINK_DUR;${nl}` +
    `          const a = 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(g.frame * 0.4));${nl}` +
    `          ctx.fillStyle = '#d8a860';${nl}` +
    `          ctx.globalAlpha = a;${nl}` +
    `          ctx.fillRect(6, 6, 3, 3);${nl}` +
    `          ctx.fillRect(W - 9, 6, 3, 3);${nl}` +
    `          ctx.fillRect(6, H - 9, 3, 3);${nl}` +
    `          ctx.fillRect(W - 9, H - 9, 3, 3);${nl}` +
    `          ctx.globalAlpha = 1;${nl}` +
    `        } else {${nl}` +
    `          g.edeLawTimer--;${nl}` +
    `          if (g.edeLawTimer <= 0) {${nl}` +
    `            g.edeLawTimer = EDEBLINK_PERIOD;${nl}` +
    `            g.edeLawWarn = EDEBLINK_WARN;${nl}` +
    `          }${nl}` +
    `        }${nl}` +
    `      }${nl}` +
    `${nl}`;
  s = s.slice(0, s.indexOf(mark)) + draw + mark + s.slice(s.indexOf(mark) + mark.length);
  console.log('ok draw');
}

fs.writeFileSync(file, s);
console.log('DONE #122');
