/**
 * Isolated physics sims for Zone S fun-fix (#138–#143).
 * Run: node scripts/_sim_zone_s.js
 */
const BALL_SPEED = 11;
const PEANUTCONV_B2 = 4200;
const PEANUTCONV_BAND = 1600;
const PEANUTCONV_SEP = 55;
const DISSIPDE_DWELL = 24;
const DISSIPDE_FLOOR = 0.28;
const DISSIPDE_DRAG = 0.985;
const RADIOSOFT_MIN = 0.60;

function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  console.log('OK', msg);
}

// #138 peanut — band half-width should be hittable (~10px+)
{
  const f1x = -PEANUTCONV_SEP, f2x = PEANUTCONV_SEP;
  let hits = 0, samples = 0;
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    for (let r = 20; r < 100; r += 2) {
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      const cass = Math.hypot(x - f1x, y) * Math.hypot(x - f2x, y);
      samples++;
      if (Math.abs(cass - PEANUTCONV_B2) <= PEANUTCONV_BAND) hits++;
    }
  }
  const rate = hits / samples;
  assert(rate > 0.08, `#138 cassini band hit rate ${rate.toFixed(3)} (>0.08)`);
}

// #138 twist+kick speed mostly preserved after twist
{
  let vx = 8, vy = 2;
  const tw = 0.12;
  vx += 0.45;
  const spd0 = Math.hypot(vx, vy);
  const tc = Math.cos(tw), ts = Math.sin(tw);
  const nvx = vx * tc - vy * ts;
  vy = vx * ts + vy * tc;
  vx = nvx;
  assert(Math.abs(Math.hypot(vx, vy) - spd0) < 1e-9, '#138 twist speed preserve');
}

// #139 duty cycle
{
  const period = 200, burst = 28;
  assert(burst / period > 0.12, `#139 duty ${(burst / period).toFixed(2)} (>0.12)`);
}

// #140 lastSide always updates (dualH0 style)
{
  const lastSide = new Map();
  let twists = 0;
  let side = -1;
  for (let x = -40; x <= 40; x += 8) {
    const s = x >= 0 ? 1 : -1;
    const prev = lastSide.get('b');
    if (prev !== undefined && prev !== s) twists++;
    lastSide.set('b', s);
    side = s;
  }
  assert(twists === 1, `#140 cross twist once (got ${twists})`);
}

// #141 dissipative wake — short-axis dwell can reach puff
{
  const shortDiam = 65 * 2;
  const floor = BALL_SPEED * DISSIPDE_FLOOR;
  const frames = shortDiam / floor;
  assert(frames > DISSIPDE_DWELL, `#141 short-axis frames ${frames.toFixed(1)} > dwell ${DISSIPDE_DWELL}`);
  let vx = 5, vy = 2, dwell = 0, puffed = false;
  for (let f = 0; f < 80; f++) {
    vx *= DISSIPDE_DRAG; vy *= DISSIPDE_DRAG;
    const spd = Math.hypot(vx, vy);
    if (spd > 1e-6 && spd < floor) { const sc = floor / spd; vx *= sc; vy *= sc; }
    dwell++;
    if (dwell > DISSIPDE_DWELL) { puffed = true; dwell = 0; vx += 0.75; }
  }
  assert(puffed, '#141 puff fires in 80f linger');
}

// #142 opposite-face exit only
{
  const entry = new Map();
  const last = new Map();
  // enter side +1, cross to -1, exit → fire
  entry.set('b', 1);
  last.set('b', -1);
  const shouldFire = entry.get('b') !== last.get('b');
  assert(shouldFire, '#142 opposite-face exit fires');
  // same-side exit → no fire
  entry.set('c', 1);
  last.set('c', 1);
  assert(entry.get('c') === last.get('c'), '#142 same-face exit silent');
  assert(BALL_SPEED * RADIOSOFT_MIN < 9, `#142 gate ${BALL_SPEED * RADIOSOFT_MIN} relaxed`);
}

// #143 echo once after 18f + tangent
{
  let kicks = 0;
  let pending = { t: 18, nx: 1, ny: 0 };
  for (let f = 0; f < 25; f++) {
    if (pending) {
      pending.t--;
      if (pending.t <= 0) {
        const tx = -pending.ny, ty = pending.nx;
        const fx = pending.nx * 0.22 + tx * 0.10;
        assert(Math.abs(fx - 0.22) < 1e-9 && Math.abs(ty * 0.10 - 0.10) < 1e-9, '#143 echo has tangent');
        kicks++;
        pending = null;
      }
    }
  }
  assert(kicks === 1, `#143 echo once (got ${kicks})`);
}

console.log('Zone S fun-fix sims done');
