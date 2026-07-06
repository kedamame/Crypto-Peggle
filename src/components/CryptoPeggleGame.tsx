'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const BALL_R        = 7;
const PEG_R         = 11;
const GRAVITY       = 0.20;
const BALL_SPEED    = 11;
const MIN_SPEED     = 5.0;
const BUCKET_W      = 82;
const BUCKET_H      = 12;
const BUCKET_SPD    = 1.7;
const SHOTS_START   = 5;           // throws per game
const BALLS_PER_SHOT = 8;          // balls per throw
const BURST_INTERVAL = 4;          // frames between ball launches in a burst
const BURST_SPREAD   = 0.04;       // ±rad random wobble per ball so paths diverge
const HIT_COOL      = 4;
const WIND_MAX       = 0.013;
const BUCKET_BALL_PROB  = 0.25;          // non-lucky balls' chance of being bucket balls
const GOLD_GLOW_COLOR   = '#c8a000';    // bright gold for glow effects
const BOMB_CHANCE   = 0.08;   // blue→bomb conversion rate (level 5+)
const SPLIT_CHANCE  = 0.05;   // blue→split conversion rate (level 8+)
const MAGNET_FORCE  = 0.15;   // attraction accel per frame
const MAGNET_RANGE  = 110;    // pixels
const BH_PULL_FORCE = 0.72;   // black hole radial pull per frame
const BH_PULL_RANGE_FACTOR = 3.8; // pull range = zone.h * this
const BOMB_RADIUS   = 75;     // explosion radius
const BUMPER_FLASH  = 20;                                     // frames a bumper glows after hit
const FLASH_COLORS  = ['#f07a6a','#f4a84a','#f5d46a','#d4c86a','#f4b88a','#e88888','#d48aaa'] as const;
const WORMHOLE_CYCLE  = 210;  // frames per full appear/disappear cycle
const WORMHOLE_ACTIVE = 140;  // frames of active (visible) phase
const WORMHOLE_FADE   = 20;   // frames for fade-in and fade-out
const CHAIN_HP_BASE   = 5;    // weak-point HP at level 10
const CHAIN_HP_MAX    = 10;   // hard cap
const STUCK_FRAMES    = 220;  // frames without downward progress before rescue
const STUCK_PROGRESS  = 35;   // px of downward advance that resets the stuck timer
const BUMPER_DN_BIAS  = 1.2;  // vy added after bumper hit when ball is moving upward
const WIND_STORM      = 0.040; // strong storm wind force (level 12+)
const WIND_NARROW_MULT = 2.0;  // narrow zone: force multiplier vs wide
const WIND_NARROW_FRAC = 0.38; // narrow zone: width as fraction of W
const FREEZE_DUR       = 120;  // frames the freeze effect lasts
const FREEZE_SLOW      = 0.55; // speed multiplier on freeze hit
const LIGHTNING_RANGE  = 140;  // max cascade px distance for lightning peg
const SHIELD_HP        = 2;    // hits to clear a shield peg
const MUD_SLOW         = 0.14; // mud peg: speed multiplier on hit (nearly stops the ball)
const MUD_DUR          = 90;   // frames the mud slow (min-speed suppression) lasts
const MUD_REVIVE       = 22;   // frames of the mud "reform" animation after revival

// ── Deep-space hazards (pulsar lv24 / gravitational wave lv27 / vacuum decay lv29) ──
const PULSAR_FORCE     = 0.50;  // radiation-pressure accel at the core, decays along the beam
const PULSAR_BEAM_LEN  = 150;   // base beam length px (grows with level)
const PULSAR_BEAM_HALF = 10;    // beam half-thickness px (physics; visuals scatter to match)
const PULSAR_ROT       = 0.009; // beam rotation rad/frame
const GW_SPEED         = 5.5;   // wavefront expansion px/frame
const GW_BAND          = 26;    // half-thickness of the wavefront band px
const GW_BEND          = 0.055; // velocity rotation rad/frame while the wavefront passes
const VAC_R0           = 26;    // vacuum bubble spawn radius
const VAC_ANTIGRAV     = 1.5;   // inside the bubble: vy -= effGrav * this (net 0.5x upward)
const VAC_RESPAWN      = 110;   // frames between pop and regrowth
const WH_PUSH          = 0.55;  // white hole radial repulsion at the core (decays t*t), scales w/ level
const WH_RANGE         = 140;   // white hole push range px
const MAG_FORCE        = 1.6;   // magnetar flare outward impulse at the core (decays t*t)
const MAG_RANGE        = 170;   // magnetar flare radius px
const MAG_RELEASE      = 6;     // frames the flare pushes balls
const MAG_WARN         = 40;    // telegraph frames before a flare fires
const RP_PULL          = 0.35;  // rogue planet attraction at the core (decays t*t)
const RP_RANGE         = 130;   // rogue planet attraction range px
const RP_R             = 22;    // rogue planet solid bounce-body radius px
const QJ_HALF          = 16;    // quasar jet column half-width px
const QJ_FAN           = 0.12;  // quasar jet sideways spray (guarantees no vertical trap)
const MBH_PULL         = 0.5;   // micro BH attraction at the core (decays t*t)
const MBH_EVAP_FORCE   = 2.0;   // micro BH evaporation repulsion burst
const MBH_EVAP_RANGE   = 130;   // micro BH evaporation burst range px
const DM_RANGE         = 160;   // dark matter halo attraction range px
const DM_PULL          = 0.30;  // dark matter halo base attraction (decays t*t, +ramp to 0.60)
const ERGO_R0          = 45;    // ergosphere inner ring radius px
const ERGO_R1          = 95;    // ergosphere outer ring radius px
const ERGO_DRAG        = 0.5;   // ergosphere tangential drag at band centre (decays t*t, +ramp to 1.0)
const MR_HALF          = 14;    // magnetic reconnection line half-width px
const MR_HALFLEN       = 100;   // magnetic reconnection line half-length px
const MR_FORCE         = 1.4;   // magnetic reconnection snap ejection force at the crossing (decays t*t)
const MR_RELEASE       = 8;     // frames the snap ejects balls
const MR_WARN          = 30;    // telegraph frames before a snap
const SN_R_MIN         = 14;    // pre-supernova star min (post-collapse) bounce radius px
const SN_R_MAX         = 30;    // pre-supernova star max (pre-boom) bounce radius px
const SN_BOOM          = 12;    // frames the explosion shockwave pushes balls
const SN_SHRINK        = 20;    // frames the post-boom collapse fade takes
const SN_BOOM_RANGE    = 180;   // explosion outward-push range px
const SN_BOOM_FORCE    = 2.2;   // explosion outward-push force at the core (decays t*t)
const SN_WARN          = 45;    // telegraph frames before the boom (surface flecks + fast pulse)

// ── Boss (re-armor boss, every 10th level) ──────────────────────────────────
const BOSS_R           = 30;   // core hit radius
const BOSS_HP_BASE     = 12;   // core HP at the first boss (level 10)
const BOSS_HP_PER_TIER = 5;    // extra HP per boss tier (each +10 levels)
const BOSS_ARMOR_COUNT = 8;    // shield pegs ringing the core
const BOSS_HIT_COOL    = 6;    // frames between core damage ticks

// ─── Seeded RNG (mulberry32) ──────────────────────────────────────────────────
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
// cosP/sinP = cos/sin(phase); cosP2/sinP2 = cos/sin of the dot family's secondary jitter phase
// (phase*1.27 for makeDot dots, phase*1.3 for wormhole aura dots). Precomputed once so the
// per-frame jitter sin(fK + phase) decomposes to sin(fK)*cosP + cos(fK)*sinP — no per-dot trig
// in the render loop. The identity is mathematically exact (FP differs at ~1 ulp), so the
// rendered output is perceptually identical.
interface Dot { x: number; y: number; size: number; alpha: number; phase: number; cosP: number; sinP: number; cosP2: number; sinP2: number }
interface BgDot { x: number; y: number; vx: number; vy: number; size: number; alpha: number; targetAlpha: number; age: number; maxAge: number }
interface BurstP  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color?: string }
interface Burst   { particles: BurstP[] }
interface BreakP  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }
interface PegBreak { particles: BreakP[] }
interface TrajPt  { x: number; y: number }
interface GravZone { x: number; y: number; w: number; h: number; flashTimer: number }
interface Comet { x: number; y: number; vx: number; vy: number; r: number; hitCool: number; respawnTimer: number; warnFromLeft: boolean; warnY: number; vanish: boolean; hitFlash: number; hitX: number; hitY: number }
interface Lens  { x: number; y: number; r: number; dir: 1 | -1; strength: number }
// Pulsar (lv24+): fixed neutron star whose twin radiation beams sweep like a lighthouse.
interface Pulsar { x: number; y: number; angle: number; rotSpeed: number; beamLen: number }
// Gravitational wave (lv27+): periodic ripple ring expanding from a distant merger.
// radius = -1 while dormant (timer counts down to the next wave).
interface GravWave { ex: number; ey: number; radius: number; timer: number; period: number; dir: 1 | -1 }
// Vacuum decay bubble (lv29+): slowly expanding true-vacuum sphere; gravity flips inside.
interface VacuumBubble { x: number; y: number; r: number; rMax: number; grow: number; respawnTimer: number; popFlash: number }
// White hole (lv23+): the time-reverse of a black hole — a pure radial repulsion, no absorption.
interface WhiteHole { x: number; y: number; strength: number }
// Magnetar (lv31+): neutron star that periodically flares, shoving every nearby ball outward.
// timer counts down to the next flare; releaseTimer > 0 means a flare is currently firing.
interface Magnetar { x: number; y: number; period: number; timer: number; releaseTimer: number }
// Rogue planet (lv32+): a starless world drifting across the field — a moving gravity well
// with a solid bounce body. It never stops, so its pull can never form a stable trap.
interface RoguePlanet { x: number; y: number; vx: number; vy: number; r: number; hitCool: number; ringTilt: number }
// Quasar jet (lv33+): a fixed plasma column that accelerates balls along its axis. A small
// sideways spray guarantees balls are ejected out the sides, so an up-jet can't hold a ball.
interface QuasarJet { bx: number; y0: number; y1: number; dir: 1 | -1; accel: number }
// Evaporating micro black hole (lv34+): a tiny BH that pulls (weakening as it shrinks), then
// evaporates in a repulsion burst and re-forms at another spot. No absorption → no trap.
interface MicroBH { x: number; y: number; life: number; maxLife: number; evap: number; dormant: number; spots: { x: number; y: number }[]; spotIdx: number }
// Dark matter halo (lv35+): a nearly invisible attraction source. Only a faint periodic
// shimmer betrays its position — otherwise you feel it only as the ball's path bending.
interface DarkHalo { x: number; y: number; strength: number; shimmer: number }
// Ergosphere (lv36+): a rotating BH's frame-dragging region — a ring band (r0..r1) where
// spacetime itself is dragged one way. Only balls inside the band feel a one-way tangential
// drag; the centre (a static, non-rotating core) and the outside are inert.
interface Ergosphere { x: number; y: number; r0: number; r1: number; strength: number; dir: 1 | -1 }
// Magnetic reconnection (lv37+): an X of two crossed field lines that's inert most of the
// time — it snaps periodically, ejecting balls outward along whichever line they're on.
// timer counts down to the next snap; releaseTimer > 0 means a snap is currently firing.
interface MagReconnection { x: number; y: number; angle: number; period: number; timer: number; releaseTimer: number }
// Pre-supernova star (lv38+): a solid bounce body that swells (r: 14→30) over its cycle,
// then explodes in an outward shockwave and collapses back to its minimum radius. The
// bounce radius always matches what's drawn, so "bigger = more dangerous" reads fairly.
interface PreSupernova { x: number; y: number; hitCool: number; hitFlash: number; period: number; timer: number; boomTimer: number; shrinkTimer: number }
interface Wormhole {
  cx: number; cy: number;
  w: number; h: number;
  angle: number;
  pairId: number;
  pairSlot: 0 | 1;
  cycleTimer: number;
  hitCool: number;
  flashTimer: number;
  dots: Dot[];
  auraDots: Dot[];
}
interface LightningArc {
  x1: number; y1: number;
  x2: number; y2: number;
  age: number; maxAge: number;
  pts: { x: number; y: number }[];
}
interface WallSegment {
  side: 'left' | 'right';
  yMin: number; yMax: number;
  type: 'warp' | 'void' | 'distort';
}
interface FogCloudDot { dx: number; dy: number; r: number }
interface FogCloud    {
  bx: number; by: number; spd: number; alpha: number; dots: FogCloudDot[];
  noiseTiers: [[number, number][], [number, number][], [number, number][]];
  // pre-baked sprite (fill + noise + rings) so per-frame cost is one drawImage; built lazily in render
  sprite?: HTMLCanvasElement; sox?: number; soy?: number; sw?: number; sh?: number; spriteDpr?: number;
  staticPool?: [number, number][]; // in-cloud positions (center-relative) sampled live for TV static flicker
}

type PegType = 'orange' | 'blue' | 'purple' | 'bomb' | 'split' | 'magnet' | 'chain-weak' | 'chain-node' | 'shield' | 'lightning' | 'hash' | 'freeze' | 'mud';
type Phase   = 'idle' | 'aiming' | 'firing' | 'levelclear' | 'gameover' | 'paused';

interface Peg {
  x: number; y: number;
  type: PegType;
  cleared: boolean;
  hitCool: number;
  dots: Dot[];
  chainId?: number;
  hp?: number;
  maxHp?: number;
  bossArmor?: boolean; // shield peg belonging to a boss's re-arming armor ring
  armorAngle?: number; // angle around the boss core (so armor can follow a moving boss)
  mudBroken?: boolean; // mud peg: destroyed this volley (revives before the next shot)
  mudAnim?: number;    // mud peg: frames remaining in the reform animation after revival
}

interface Boss {
  x: number; y: number; r: number;
  hp: number; maxHp: number;
  hitFlash: number;   // frames, flashes white on damage
  hitCool: number;    // frames, gates damage ticks
  rearmFlash: number; // frames, flashes when re-arming (triggered on fire)
  tier: number;       // floor(level/10): 1 at lv10, scales gimmicks
  vx: number;         // horizontal drift speed (0 = static, set from tier 2)
  armorR: number;     // radius of the armor ring (for repositioning followers)
  moveMinX: number; moveMaxX: number; // horizontal drift bounds
}

interface Bumper {
  cx: number; cy: number;
  w: number; h: number;
  angle: number;
  angularVel: number;
  dots: Dot[];
  hitFlash: number;
  hitCount: number;
  hitCool: number;
}

interface Ball { x: number; y: number; vx: number; vy: number; dots: Dot[]; isBucketBall: boolean; stuckTimer: number; stuckBaseY: number; freezeTimer: number; mudTimer: number; }

interface GameState {
  phase: Phase;
  prePausePhase: Phase;
  pegs: Peg[];
  bumpers: Bumper[];
  balls: Ball[];           // all active balls
  burstRemaining: number;  // balls yet to be launched in current burst
  burstTimer: number;      // frames until next ball launch
  burstAngle: number;      // locked aim angle for the current burst
  burstLuckyIdx: number;   // index of the guaranteed bucket ball in current burst (-1 = none)
  burstBucketProb: number; // per-burst chance a ball is a bucket ball (dynamic refill throttle)
  bossRefillLeft: number;  // remaining boss-armor refills allowed this volley (cap 3)
  shotsLeft: number;
  score: number;
  level: number;
  aimAngle: number;
  bursts: Burst[];
  pegBreaks: PegBreak[];
  bgDots: BgDot[];
  bgClusterTimer: number;
  frame: number;
  W: number; H: number;
  launcherX: number; launcherY: number;
  bucketX: number; bucketDir: 1 | -1;
  bucketW: number; bucketSpd: number;
  windForce: number;
  windRange: number;  // px width of wind zone (W = full screen)
  windCenter: number; // center X of wind zone
  windRectY0: number; // top Y of dust rectangle (narrow wind only)
  windRectY1: number; // bottom Y of dust rectangle (narrow wind only)
  warpWalls: boolean;
  gravZones: GravZone[];
  wormholes: Wormhole[];
  comets: Comet[];
  lenses: Lens[];
  pulsars: Pulsar[];
  gravWaves: GravWave[];
  vacuums: VacuumBubble[];
  whiteHoles: WhiteHole[];
  magnetars: Magnetar[];
  roguePlanets: RoguePlanet[];
  quasarJets: QuasarJet[];
  microBHs: MicroBH[];
  darkHalos: DarkHalo[];
  ergospheres: Ergosphere[];
  magReconnections: MagReconnection[];
  preSupernovae: PreSupernova[];
  cmeActive: boolean;   // this level has a periodic CME shockwave
  cmePeriod: number;    // frames between sweeps
  cmeTimer: number;     // countdown to next sweep
  cmeY: number;         // current sweep-band Y (-1 = not sweeping)
  rng: () => number;
  levelClearTimer: number;
  orangeLeft: number;
  bucketGlowTimer: number;
  bucketFlashTimer: number;
  burstTime: number;
  fogActive: boolean;
  fogRevealTimer: number;
  fogAlpha: number;
  fogClouds: FogCloud[];
  lightningArcs: LightningArc[];
  wallSegments: WallSegment[];
  boss: Boss | null;
}

type Eip1193Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type EIP6963Wallet   = { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193Provider };

// ─── Dot helpers ──────────────────────────────────────────────────────────────
function rnd(n: number) { return (Math.random() - 0.5) * n; }

function makeDot(x: number, y: number, sizeW = 1.0): Dot {
  const s = Math.random();
  const d: Dot = {
    x: x + rnd(2),
    y: y + rnd(2),
    size: Math.max(1, Math.round((s < 0.55 ? 1 : s < 0.88 ? 2 : 3) * sizeW)),
    alpha: 0.58 + Math.random() * 0.42,
    phase: Math.random() * Math.PI * 2,
    cosP: 0, sinP: 0, cosP2: 0, sinP2: 0,
  };
  d.cosP  = Math.cos(d.phase);        d.sinP  = Math.sin(d.phase);
  d.cosP2 = Math.cos(d.phase * 1.27); d.sinP2 = Math.sin(d.phase * 1.27);
  return d;
}

function makePegDots(type: PegType): Dot[] {
  const dots: Dot[] = [];

  if (type === 'orange') {
    // Dense filled circle → solid ink mass
    for (let r = 1.5; r <= PEG_R + 1; r += 2.3) {
      const edgeFactor = r <= PEG_R ? 1.0 : 0.28;
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.6));
      for (let i = 0; i < count; i++) {
        if (Math.random() > edgeFactor) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.05));
      }
    }
    for (let i = 0; i < 10; i++) {
      const r2 = Math.sqrt(Math.random()) * PEG_R * 0.68;
      const a2 = Math.random() * Math.PI * 2;
      const d = makeDot(Math.cos(a2) * r2, Math.sin(a2) * r2);
      d.alpha *= 0.55;
      dots.push(d);
    }
  } else if (type === 'blue') {
    // Outline ring only → hollow look
    const count = Math.floor(2 * Math.PI * PEG_R / 3.0);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * PEG_R, Math.sin(a) * PEG_R, 0.88));
    }
    const count2 = Math.floor(2 * Math.PI * (PEG_R - 4) / 4.2);
    for (let i = 0; i < count2; i++) {
      const a = (i / count2) * Math.PI * 2 + 0.4;
      const d = makeDot(Math.cos(a) * (PEG_R - 4), Math.sin(a) * (PEG_R - 4), 0.75);
      d.alpha *= 0.35;
      dots.push(d);
    }
  } else if (type === 'purple') {
    // Purple: filled but sparser, with slightly larger dots for distinct look
    for (let r = 1.5; r <= PEG_R + 1; r += 2.0) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.2));
      for (let i = 0; i < count; i++) {
        if (Math.random() > (r <= PEG_R ? 0.88 : 0.22)) continue;
        const a = (i / count) * Math.PI * 2;
        const d = makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.25);
        d.alpha *= 0.80;
        dots.push(d);
      }
    }
  } else if (type === 'bomb') {
    // Dense core + 4 starburst spikes at 45° → looks like an explosion marker
    for (let r = 1.5; r <= PEG_R; r += 2.2) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.4));
      for (let i = 0; i < count; i++) {
        if (Math.random() > 0.92) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    for (let arm = 0; arm < 4; arm++) {
      const a = arm * Math.PI / 2 + Math.PI / 4;
      for (let r = PEG_R; r <= PEG_R + 5; r += 2) {
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.2));
      }
    }
    dots.push({ x: 0, y: 0, size: 3, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'split') {
    // Outer ring + vertical divider → looks split in two
    const count = Math.floor(2 * Math.PI * PEG_R / 3.0);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * PEG_R, Math.sin(a) * PEG_R, 0.9));
    }
    for (let y = -PEG_R + 2; y <= PEG_R - 2; y += 2.8) {
      dots.push(makeDot(0, y, 1.0));
    }
  } else if (type === 'chain-node') {
    // Double concentric rings → steel chain ring appearance
    const outerCount = Math.floor(2 * Math.PI * PEG_R / 2.5);
    for (let i = 0; i < outerCount; i++) {
      const a = (i / outerCount) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * PEG_R, Math.sin(a) * PEG_R, 1.0));
    }
    const innerR = 5;
    const innerCount = Math.floor(2 * Math.PI * innerR / 2.5);
    for (let i = 0; i < innerCount; i++) {
      const a = (i / innerCount) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * innerR, Math.sin(a) * innerR, 0.8));
    }
  } else if (type === 'chain-weak') {
    // Dense red-tinted core; HP ring is drawn dynamically in render loop
    for (let r = 1.5; r <= PEG_R; r += 2.0) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.4));
      for (let i = 0; i < count; i++) {
        if (Math.random() > 0.85) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    dots.push({ x: 0, y: 0, size: 3, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'shield') {
    // Dense filled core (blue-tinted); animated shield ring drawn in render loop
    for (let r = 1.5; r <= PEG_R; r += 2.2) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.5));
      for (let i = 0; i < count; i++) {
        if (Math.random() > 0.80) continue;
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    dots.push({ x: 0, y: 0, size: 2, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'lightning') {
    // 8-armed jagged star pattern
    for (let arm = 0; arm < 8; arm++) {
      const a = arm * Math.PI / 4;
      for (let r = 2; r <= PEG_R + 2; r += 2.5) {
        const offA = (r / PEG_R) * 0.18;
        dots.push(makeDot(Math.cos(a + offA) * r, Math.sin(a + offA) * r, 1.1));
      }
    }
    dots.push({ x: 0, y: 0, size: 3, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'hash') {
    // Hash symbol: 2 horizontal + 2 vertical bars
    for (let i = -10; i <= 10; i += 2) {
      dots.push(makeDot(i, -3.5, 0.9));
      dots.push(makeDot(i,  3.5, 0.9));
      dots.push(makeDot(-3.5, i, 0.9));
      dots.push(makeDot( 3.5, i, 0.9));
    }
  } else if (type === 'freeze') {
    // 6-armed snowflake with side branches
    for (let arm = 0; arm < 6; arm++) {
      const a = arm * Math.PI / 3;
      for (let r = 2; r <= PEG_R; r += 2.2) {
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
        if (r > PEG_R * 0.42 && r < PEG_R * 0.72) {
          const ba = a + Math.PI / 6;
          const bl = r * 0.42;
          dots.push(makeDot(Math.cos(a) * r + Math.cos(ba) * bl, Math.sin(a) * r + Math.sin(ba) * bl, 0.8));
          dots.push(makeDot(Math.cos(a) * r - Math.cos(ba) * bl, Math.sin(a) * r - Math.sin(ba) * bl, 0.8));
        }
      }
    }
    dots.push({ x: 0, y: 0, size: 2, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else if (type === 'mud') {
    // mud: dense filled blob (rendered custom, but keep valid dots for the type)
    for (let r = 1.5; r <= PEG_R; r += 2.4) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.6));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.0));
      }
    }
    dots.push({ x: 0, y: 0, size: 3, alpha: 1.0, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  } else {
    // magnet: very dense filled circle + faint outer field ring
    for (let r = 1.5; r <= PEG_R; r += 1.9) {
      const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.0));
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 1.1));
      }
    }
    const fieldCount = Math.floor(2 * Math.PI * (PEG_R + 5) / 4.5);
    for (let i = 0; i < fieldCount; i++) {
      if (Math.random() > 0.55) continue;
      const a = (i / fieldCount) * Math.PI * 2;
      const d = makeDot(Math.cos(a) * (PEG_R + 5), Math.sin(a) * (PEG_R + 5), 0.8);
      d.alpha *= 0.45;
      dots.push(d);
    }
  }
  return dots;
}

function makeBallDots(): Dot[] {
  const dots: Dot[] = [];
  for (let r = 1; r <= BALL_R; r += 2.2) {
    const count = Math.max(1, Math.floor(2 * Math.PI * r / 2.4));
    for (let i = 0; i < count; i++) {
      if (Math.random() > 0.86) continue;
      const a = (i / count) * Math.PI * 2;
      dots.push(makeDot(Math.cos(a) * r, Math.sin(a) * r, 0.92));
    }
  }
  dots.push({ x: 0, y: 0, size: 2, alpha: 0.90, phase: 0, cosP: 1, sinP: 0, cosP2: 1, sinP2: 0 });
  return dots;
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
// Memoized unit-circle trig for evenly-spaced angles a = (i/n)*2π. The values are
// frame-invariant, so circular dot rings (black hole halos, accretion, etc.) can reuse
// them instead of recomputing Math.cos/sin every frame. Bit-identical to the inline form.
const _circleTrigCache = new Map<number, { cos: Float64Array; sin: Float64Array }>();
function circleTrig(n: number): { cos: Float64Array; sin: Float64Array } {
  let e = _circleTrigCache.get(n);
  if (!e) {
    const cos = new Float64Array(n), sin = new Float64Array(n);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; cos[i] = Math.cos(a); sin[i] = Math.sin(a); }
    e = { cos, sin };
    _circleTrigCache.set(n, e);
  }
  return e;
}

function drawDots(
  ctx: CanvasRenderingContext2D,
  dots: Dot[],
  cx: number, cy: number,
  rotAngle: number,
  frame: number,
  color: string,
  alphaMult = 1.0,
) {
  ctx.fillStyle = color;
  const cos = Math.cos(rotAngle), sin = Math.sin(rotAngle);
  // Shared per-frame trig; per-dot jitter uses the precomputed cos/sin of each dot's phase.
  const sA = Math.sin(frame * 0.038), cA = Math.cos(frame * 0.038);
  const sB = Math.sin(frame * 0.031), cB = Math.cos(frame * 0.031);
  for (const d of dots) {
    const jx = (sA * d.cosP  + cA * d.sinP)  * 0.55;
    const jy = (cB * d.cosP2 - sB * d.sinP2) * 0.55;
    const rx = (d.x + jx) * cos - (d.y + jy) * sin;
    const ry = (d.x + jx) * sin + (d.y + jy) * cos;
    ctx.globalAlpha = d.alpha * alphaMult;
    ctx.fillRect(Math.round(cx + rx - d.size * 0.5), Math.round(cy + ry - d.size * 0.5), d.size, d.size);
  }
  ctx.globalAlpha = 1;
}

// Anti-aliased solid circle: full-coverage pixels at alpha 1, edge pixels at fractional alpha.
function drawSolidCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  const cx = Math.round(x), cy = Math.round(y);
  for (let dy = -r; dy <= r; dy++) {
    const exactHw = Math.sqrt(Math.max(0, r * r - dy * dy));
    const fullHw  = Math.floor(exactHw);
    const frac    = exactHw - fullHw;
    ctx.globalAlpha = 1;
    ctx.fillRect(cx - fullHw, cy + dy, fullHw * 2 + 1, 1);
    if (frac > 0.01) {
      ctx.globalAlpha = frac;
      ctx.fillRect(cx - fullHw - 1, cy + dy, 1, 1);
      ctx.fillRect(cx + fullHw + 1, cy + dy, 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Black hole render tables ─────────────────────────────────────────────────
// Every animated term in the black hole render has the form sin(frame*K + C) with K constant per
// layer and C constant per grain, so cos(C)/sin(C) are baked once per zone into typed arrays and
// the per-frame trig collapses to a handful of sin/cos per layer (angle-addition identity —
// mathematically exact, FP differs at ~1 ulp, output perceptually identical). Frame-invariant dot
// positions (halo rings, event horizon, accretion ring, influence ring) are precomputed with the
// identical FP expressions.
// Zones never move after generateLevel, so the tables are baked lazily on first draw and never
// invalidated (keyed by zone object via WeakMap).
const BH_GOLDEN = 2.39996; // golden angle (rad)

interface BHSwirl {
  n: number;
  rBase: Float64Array;               // radius base factor per grain
  wobC: Float64Array; wobS: Float64Array;   // cos/sin of radius-wobble phase
  w1C: Float64Array; w1S: Float64Array;     // cos/sin of wx wobble phase
  w2C: Float64Array; w2S: Float64Array;     // cos/sin of wy wobble phase
  alC: Float64Array; alS: Float64Array;     // cos/sin of alpha twinkle phase
  aB: Float64Array;                  // alpha base factor per grain
  color: string[];
  // veils: angle = a0 + t*aK (per-grain rotation speed); storms: uniform rotation of baked a0C/a0S
  a0?: Float64Array; aK?: Float64Array;
  a0C?: Float64Array; a0S?: Float64Array;
  sz?: Uint8Array;
}
interface BHTables {
  veilA: BHSwirl; veilB: BHSwirl; stormA: BHSwirl; stormB: BHSwirl;
  arm: { bx: Float64Array; by: Float64Array; j1C: Float64Array; j1S: Float64Array; j2C: Float64Array; j2S: Float64Array;
         k1C: Float64Array; k1S: Float64Array; k2C: Float64Array; k2S: Float64Array; sz: Uint8Array; aB: Float64Array; color: string[] };
  ten: { x0: Int32Array; j1C: Float64Array; j1S: Float64Array; j2C: Float64Array; j2S: Float64Array;
         wC: Float64Array; wS: Float64Array; aB: Float64Array; color: string[] };
  rings: { spd: number; color: string; bx: Float64Array; by: Float64Array; w1C: Float64Array; w1S: Float64Array;
           w2C: Float64Array; w2S: Float64Array; alC: Float64Array; alS: Float64Array }[];
  halo: { powV: number; sz: number; color: string; xs: Int32Array; ys: Int32Array }[];
  horizon: { alpha: number; xs: Int32Array; ys: Int32Array }[];
  acc: { factor: number; color: string; xs: Int32Array; ys: Int32Array; alC: Float64Array; alS: Float64Array }[];
  infX: Int32Array; infY: Int32Array; infAlC: Float64Array; infAlS: Float64Array;
}

function bakeBHSwirl(
  n: number, last: number,
  rBaseFn: (frac: number) => number,
  wobPhase: number, w1Phase: number, w2Phase: number, alPhase: number,
  aBFn: (frac: number) => number,
  colorFn: (frac: number) => string,
): BHSwirl {
  const s: BHSwirl = {
    n,
    rBase: new Float64Array(n), wobC: new Float64Array(n), wobS: new Float64Array(n),
    w1C: new Float64Array(n), w1S: new Float64Array(n), w2C: new Float64Array(n), w2S: new Float64Array(n),
    alC: new Float64Array(n), alS: new Float64Array(n), aB: new Float64Array(n), color: new Array<string>(n),
  };
  for (let i = 0; i < n; i++) {
    const frac = i / last;
    s.rBase[i] = rBaseFn(frac);
    s.wobC[i] = Math.cos(i * wobPhase); s.wobS[i] = Math.sin(i * wobPhase);
    s.w1C[i]  = Math.cos(i * w1Phase);  s.w1S[i]  = Math.sin(i * w1Phase);
    s.w2C[i]  = Math.cos(i * w2Phase);  s.w2S[i]  = Math.sin(i * w2Phase);
    s.alC[i]  = Math.cos(i * alPhase);  s.alS[i]  = Math.sin(i * alPhase);
    s.aB[i]   = aBFn(frac);
    s.color[i] = colorFn(frac);
  }
  return s;
}

const _bhTablesCache = new WeakMap<GravZone, BHTables>();

function getBHTables(zone: GravZone, cx: number, cy: number, maxR: number, bhRange: number): BHTables {
  let bh = _bhTablesCache.get(zone);
  if (bh) return bh;

  // Sand veil A (360 grains)
  const veilA = bakeBHSwirl(360, 359, frac => maxR * (0.14 + frac * 0.90), 2.7, 1.37, 2.11, 1.91,
    frac => 1 - frac * 0.50, frac => frac < 0.35 ? '#3a0016' : frac < 0.65 ? '#1e000a' : '#0c0006');
  veilA.a0 = new Float64Array(360); veilA.aK = new Float64Array(360);
  for (let i = 0; i < 360; i++) { veilA.a0[i] = i * BH_GOLDEN; veilA.aK[i] = 0.50 + (i / 359) * 0.28; }

  // Sand veil B (240 grains)
  const veilB = bakeBHSwirl(240, 239, frac => maxR * (0.20 + frac * 0.72), 3.3, 2.39, 1.73, 2.5,
    frac => 1 - frac * 0.55, frac => frac < 0.4 ? '#280010' : '#120007');
  veilB.a0 = new Float64Array(240); veilB.aK = new Float64Array(240);
  for (let i = 0; i < 240; i++) { veilB.a0[i] = i * BH_GOLDEN * 2; veilB.aK[i] = 0.35 + (i / 239) * 0.22; }

  // Inner storm A (280 grains, uniform counter-rotation)
  const stormA = bakeBHSwirl(280, 279, frac => maxR * (0.06 + frac * 0.66), 3.1, 1.91, 2.83, 2.3,
    frac => 1 - frac * 0.65, frac => frac < 0.28 ? '#620024' : frac < 0.58 ? '#3a0018' : '#1e000c');
  stormA.a0C = new Float64Array(280); stormA.a0S = new Float64Array(280); stormA.sz = new Uint8Array(280);
  for (let i = 0; i < 280; i++) {
    const a0 = i * BH_GOLDEN * 1.618;
    stormA.a0C[i] = Math.cos(a0); stormA.a0S[i] = Math.sin(a0);
    stormA.sz[i] = (i / 279) < 0.20 ? 2 : 1;
  }

  // Inner storm B (180 grains, uniform clockwise rotation)
  const stormB = bakeBHSwirl(180, 179, frac => maxR * (0.10 + frac * 0.55), 4.1, 3.14, 1.57, 1.7,
    frac => 1 - frac * 0.72, frac => frac < 0.35 ? '#440018' : '#220010');
  stormB.a0C = new Float64Array(180); stormB.a0S = new Float64Array(180);
  for (let i = 0; i < 180; i++) {
    const a0 = i * BH_GOLDEN * 0.618;
    stormB.a0C[i] = Math.cos(a0); stormB.a0S[i] = Math.sin(a0);
  }

  // 4 spiral arms × 90 dots (drawn in a rotated local frame)
  const arm = {
    bx: new Float64Array(360), by: new Float64Array(360),
    j1C: new Float64Array(360), j1S: new Float64Array(360), j2C: new Float64Array(360), j2S: new Float64Array(360),
    k1C: new Float64Array(360), k1S: new Float64Array(360), k2C: new Float64Array(360), k2S: new Float64Array(360),
    sz: new Uint8Array(360), aB: new Float64Array(360), color: new Array<string>(360),
  };
  for (let armI = 0; armI < 4; armI++) {
    for (let i = 0; i < 90; i++) {
      const idx  = armI * 90 + i;
      const frac = i / 89;
      const a    = frac * Math.PI * 2.2;
      const sr   = frac * maxR * 0.94 + maxR * 0.07;
      arm.bx[idx] = Math.cos(a) * sr; arm.by[idx] = Math.sin(a) * sr;
      arm.j1C[idx] = Math.cos(i * 3.7);  arm.j1S[idx] = Math.sin(i * 3.7);
      arm.j2C[idx] = Math.cos(armI * 1.1 + i * 1.37); arm.j2S[idx] = Math.sin(armI * 1.1 + i * 1.37);
      arm.k1C[idx] = Math.cos(i * 2.9);  arm.k1S[idx] = Math.sin(i * 2.9);
      arm.k2C[idx] = Math.cos(armI * 1.1 + i * 2.11); arm.k2S[idx] = Math.sin(armI * 1.1 + i * 2.11);
      arm.sz[idx]  = Math.max(1, Math.round(3.4 - frac * 2.4));
      arm.aB[idx]  = (1 - frac) * 0.82;
      arm.color[idx] = frac < 0.22 ? '#cc0022' : frac < 0.50 ? '#660033' : frac < 0.75 ? '#330022' : '#110011';
    }
  }

  // 16 tendrils × 36 dots (drawn in a rotated local frame)
  const ten = {
    x0: new Int32Array(576),
    j1C: new Float64Array(576), j1S: new Float64Array(576), j2C: new Float64Array(576), j2S: new Float64Array(576),
    wC: new Float64Array(576), wS: new Float64Array(576), aB: new Float64Array(576), color: new Array<string>(576),
  };
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 36; j++) {
      const idx  = i * 36 + j;
      const frac = j / 35;
      ten.x0[idx] = Math.round(maxR * (0.45 + frac * 0.58)) - 1;
      ten.j1C[idx] = Math.cos(j * 2.1 + i * 0.9); ten.j1S[idx] = Math.sin(j * 2.1 + i * 0.9);
      ten.j2C[idx] = Math.cos(i * 1.9 + j * 0.7); ten.j2S[idx] = Math.sin(i * 1.9 + j * 0.7);
      ten.wC[idx]  = Math.cos(i * 2.3 + j * 1.1); ten.wS[idx]  = Math.sin(i * 2.3 + j * 1.1);
      ten.aB[idx]  = (1 - frac) * 0.34;
      ten.color[idx] = frac < 0.5 ? '#550022' : '#220011';
    }
  }

  // 5 counter-rotating rings (48–112 dots)
  const rings: BHTables['rings'] = [];
  for (let ring = 0; ring < 5; ring++) {
    const rr   = maxR * (0.42 + ring * 0.13);
    const dotN = 48 + ring * 16;
    const tr   = circleTrig(dotN);
    const r = {
      spd: 3.0 + ring * 0.85,
      color: ring < 2 ? '#cc0033' : ring < 4 ? '#880022' : '#550018',
      bx: new Float64Array(dotN), by: new Float64Array(dotN),
      w1C: new Float64Array(dotN), w1S: new Float64Array(dotN), w2C: new Float64Array(dotN), w2S: new Float64Array(dotN),
      alC: new Float64Array(dotN), alS: new Float64Array(dotN),
    };
    for (let i = 0; i < dotN; i++) {
      r.bx[i] = tr.cos[i] * rr; r.by[i] = tr.sin[i] * rr;
      r.w1C[i] = Math.cos(ring * 0.7 + i * 1.73); r.w1S[i] = Math.sin(ring * 0.7 + i * 1.73);
      r.w2C[i] = Math.cos(ring * 0.7 + i * 2.39); r.w2S[i] = Math.sin(ring * 0.7 + i * 2.39);
      r.alC[i] = Math.cos(i * 0.7); r.alS[i] = Math.sin(i * 0.7);
    }
    rings.push(r);
  }

  // Halo rings: positions are frame-invariant; alpha = flicker * 0.88 * powV stays per-frame
  const halo: BHTables['halo'] = [];
  for (let ri = 0; ri < 11; ri++) {
    const r = maxR * (0.14 + ri * 0.09);
    if (r > maxR * 1.05) break;
    const powV     = Math.pow(Math.max(0, 1 - r / maxR), 1.2);
    const dotGap   = 3.5 + ri * 0.6;
    const dotCount = Math.max(4, Math.round(2 * Math.PI * r / dotGap));
    const sz       = Math.max(1, 3 - Math.floor(ri * 0.5));
    const tr       = circleTrig(dotCount);
    const xs = new Int32Array(dotCount), ys = new Int32Array(dotCount);
    for (let j = 0; j < dotCount; j++) {
      xs[j] = Math.round(cx + tr.cos[j] * r) - (sz >> 1);
      ys[j] = Math.round(cy + tr.sin[j] * r) - (sz >> 1);
    }
    halo.push({ powV, sz, color: ri < 4 ? '#1a0010' : ri < 7 ? '#0d000a' : '#000', xs, ys });
  }

  // Event horizon disc: fully frame-invariant
  const horizon: BHTables['horizon'] = [];
  for (let r = 0; r <= maxR * 0.14; r += 2.5) {
    const dotCount = Math.max(1, Math.round(2 * Math.PI * r / 3.0));
    const tr = circleTrig(dotCount);
    const xs = new Int32Array(dotCount), ys = new Int32Array(dotCount);
    for (let j = 0; j < dotCount; j++) {
      xs[j] = Math.round(cx + tr.cos[j] * r) - 1;
      ys[j] = Math.round(cy + tr.sin[j] * r) - 1;
    }
    horizon.push({ alpha: r < maxR * 0.16 ? 1.0 : 0.92, xs, ys });
  }

  // Accretion ring: 3 passes, positions frame-invariant, per-dot alpha twinkle decomposed
  const accR = maxR * 0.34;
  const acc: BHTables['acc'] = [];
  for (let pass = 0; pass < 3; pass++) {
    const rr   = accR + pass * 3.5;
    const dotN = 56 + pass * 18;
    const tr   = circleTrig(dotN);
    const xs = new Int32Array(dotN), ys = new Int32Array(dotN);
    const alC = new Float64Array(dotN), alS = new Float64Array(dotN);
    for (let i = 0; i < dotN; i++) {
      xs[i] = Math.round(cx + tr.cos[i] * rr) - 1;
      ys[i] = Math.round(cy + tr.sin[i] * rr) - 1;
      alC[i] = Math.cos(i * 0.4); alS[i] = Math.sin(i * 0.4);
    }
    acc.push({ factor: pass === 0 ? 0.85 : pass === 1 ? 0.50 : 0.28, color: pass === 0 ? '#ee0033' : pass === 1 ? '#bb0022' : '#880018', xs, ys, alC, alS });
  }

  // Influence range ring (physics pull boundary)
  const infN = 48, infTr = circleTrig(infN);
  const infX = new Int32Array(infN), infY = new Int32Array(infN);
  const infAlC = new Float64Array(infN), infAlS = new Float64Array(infN);
  for (let i = 0; i < infN; i++) {
    infX[i] = Math.round(cx + infTr.cos[i] * bhRange) - 1;
    infY[i] = Math.round(cy + infTr.sin[i] * bhRange) - 1;
    infAlC[i] = Math.cos(i * 0.4); infAlS[i] = Math.sin(i * 0.4);
  }

  bh = { veilA, veilB, stormA, stormB, arm, ten, rings, halo, horizon, acc, infX, infY, infAlC, infAlS };
  _bhTablesCache.set(zone, bh);
  return bh;
}

// ─── Background dots ──────────────────────────────────────────────────────────
function spawnBgDot(W: number, H: number): BgDot {
  const maxAge = 180 + Math.random() * 240;
  return {
    x: Math.random() * W, y: Math.random() * H,
    vx: rnd(0.20), vy: rnd(0.20),
    size: Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 3,
    alpha: 0, targetAlpha: 0.06 + Math.random() * 0.14,
    age: 0, maxAge,
  };
}

function spawnBgCluster(W: number, H: number, cx: number, cy: number, count: number): BgDot[] {
  return Array.from({ length: count }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 45;
    const maxAge = 120 + Math.random() * 200;
    return {
      x: Math.min(W - 2, Math.max(2, cx + Math.cos(a) * r)),
      y: Math.min(H - 2, Math.max(2, cy + Math.sin(a) * r)),
      vx: Math.cos(a) * (0.06 + Math.random() * 0.15),
      vy: Math.sin(a) * (0.06 + Math.random() * 0.15),
      size: Math.random() < 0.5 ? 1 : 2,
      alpha: 0, targetAlpha: 0.08 + Math.random() * 0.14,
      age: 0, maxAge,
    };
  });
}

function initBgDots(W: number, H: number): BgDot[] {
  return Array.from({ length: 200 }, () => {
    const d = spawnBgDot(W, H);
    d.age = Math.random() * d.maxAge;
    d.alpha = d.targetAlpha;
    return d;
  });
}

// ─── Fog cloud sprite baking ──────────────────────────────────────────────────
// Renders fill + noise stipple + outer/inner/fringe rings into an offscreen canvas ONCE.
// Per-frame the render loop just drawImages the sprite at its scrolled position, which
// removes the ~160k isExterior distance checks + ~60k trig calls + 24 ctx.clip()/frame.
// Internal layer alphas are baked in; the blit applies ca = fogAlpha * cloud.alpha on top.
// Layers composite into the sprite first, then the merged result composites at ca — visually
// equivalent to the previous live `ca * layerAlpha` per-layer compositing (not bit-identical
// where layers overlap, but imperceptible for scrolling fog).
function bakeFogCloudSprite(cloud: FogCloud, dpr: number): void {
  if (typeof document === 'undefined') return;
  const dots = cloud.dots;
  const MARG = 16; // room for fringe (r+12) and rounding
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of dots) {
    if (d.dx - d.r - MARG < minX) minX = d.dx - d.r - MARG;
    if (d.dy - d.r - MARG < minY) minY = d.dy - d.r - MARG;
    if (d.dx + d.r + MARG > maxX) maxX = d.dx + d.r + MARG;
    if (d.dy + d.r + MARG > maxY) maxY = d.dy + d.r + MARG;
  }
  const sw = Math.ceil(maxX - minX), sh = Math.ceil(maxY - minY);
  const cv = document.createElement('canvas');
  cv.width  = Math.max(1, Math.ceil(sw * dpr));
  cv.height = Math.max(1, Math.ceil(sh * dpr));
  const c = cv.getContext('2d');
  if (!c) return;
  c.scale(dpr, dpr);
  const ox = -minX, oy = -minY; // sprite-local origin offset
  const cd = dots.map((d) => ({ dx: d.dx + ox, dy: d.dy + oy, r: d.r }));

  // cloud fill
  c.beginPath();
  for (const d of cd) { c.moveTo(d.dx + d.r, d.dy); c.arc(d.dx, d.dy, d.r, 0, Math.PI * 2); }
  c.fillStyle = '#1e1630'; c.globalAlpha = 1; c.fill();

  // noise stipple (positions are center-relative → shift by ox/oy)
  const [nt0, nt1, nt2] = cloud.noiseTiers;
  c.fillStyle = '#0a0616'; c.globalAlpha = 0.62; for (const [nx, ny] of nt0) c.fillRect(Math.round(nx + ox), Math.round(ny + oy), 2, 2);
  c.fillStyle = '#140e26'; c.globalAlpha = 0.78; for (const [nx, ny] of nt1) c.fillRect(Math.round(nx + ox), Math.round(ny + oy), 2, 2);
  c.fillStyle = '#2e2048'; c.globalAlpha = 0.95; for (const [nx, ny] of nt2) c.fillRect(Math.round(nx + ox), Math.round(ny + oy), 3, 3);

  const isExt = (skip: number, bpx: number, bpy: number): boolean => {
    for (let j = 0; j < cd.length; j++) {
      if (j === skip) continue;
      const e = cd[j]; const ex = bpx - e.dx, ey = bpy - e.dy;
      if (ex * ex + ey * ey < e.r * e.r) return false;
    }
    return true;
  };

  // rings — baked at a fixed phase (frozen trembling; imperceptible while the cloud scrolls)
  for (let di = 0; di < cd.length; di++) {
    const d = cd[di], px = d.dx, py = d.dy;
    const outerN = Math.max(12, Math.floor(2 * Math.PI * d.r / 4.0));
    c.fillStyle = '#0f0f0d';
    for (let si = 0; si < outerN; si++) {
      const a = (si / outerN) * Math.PI * 2;
      const bpx = px + Math.cos(a) * d.r, bpy = py + Math.sin(a) * d.r;
      if (isExt(di, bpx, bpy)) { const sz = si % 6 === 0 ? 2 : 1; c.globalAlpha = 0.72 + (si % 3) * 0.09; c.fillRect(Math.round(bpx) - 1, Math.round(bpy) - 1, sz, sz); }
    }
    const innerR = d.r - 4;
    if (innerR > 10) {
      const innerN = Math.max(8, Math.floor(2 * Math.PI * innerR / 5.5));
      c.fillStyle = '#3a1060';
      for (let si = 0; si < innerN; si++) {
        const a = (si / innerN) * Math.PI * 2 + 0.5;
        const bpx = px + Math.cos(a) * innerR, bpy = py + Math.sin(a) * innerR;
        if (isExt(di, bpx, bpy)) { c.globalAlpha = 0.55 + (si % 2) * 0.15; c.fillRect(Math.round(bpx) - 1, Math.round(bpy) - 1, 1, 1); }
      }
    }
    const fringeN = Math.max(8, Math.floor(2 * Math.PI * d.r / 7.0));
    c.fillStyle = '#6010b0';
    for (let si = 0; si < fringeN; si++) {
      const a = (si / fringeN) * Math.PI * 2;
      const fringeR = d.r + 5 + Math.sin(si * 2.0) * 7;
      const bpx = px + Math.cos(a) * fringeR, bpy = py + Math.sin(a) * fringeR;
      if (isExt(di, bpx, bpy)) { c.globalAlpha = 0.14 + Math.abs(Math.sin(si * 1.9)) * 0.14; c.fillRect(Math.round(bpx) - 1, Math.round(bpy) - 1, 1, 1); }
    }
  }

  // dedicated random in-cloud pool for live TV static (smooth snow, center-relative coords)
  const pool: [number, number][] = [];
  for (let a = 0; a < 3000 && pool.length < 500; a++) {
    const px = minX + Math.random() * (maxX - minX);
    const py = minY + Math.random() * (maxY - minY);
    for (const d of dots) { const ex = px - d.dx, ey = py - d.dy; if (ex * ex + ey * ey < d.r * d.r) { pool.push([px, py]); break; } }
  }

  cloud.sprite = cv; cloud.sox = minX; cloud.soy = minY; cloud.sw = sw; cloud.sh = sh; cloud.spriteDpr = dpr;
  cloud.staticPool = pool;
}

// ─── Velocity-scaled burst ────────────────────────────────────────────────────
// Intensity scales from 0 (dead slow) to 1 (full speed). The visible difference
// between a graze and a direct fast hit is the whole point of this system.
//
//  speed  3  → intensity 0.09 →  9 particles, speed×1.0  (gentle poof)
//  speed 10  → intensity 0.53 → 31 particles, speed×3.4  (solid burst)
//  speed 18  → intensity 1.00 → 55 particles, speed×6.0  (explosive scatter)
function spawnBurst(g: GameState, cx: number, cy: number, bvx: number, bvy: number, color?: string) {
  const speed     = Math.sqrt(bvx * bvx + bvy * bvy);
  const intensity = Math.min(1.0, Math.max(0, (speed - 1.5) / 16.5));
  const count     = Math.round(4 + intensity * 51);
  const spdScale  = 0.5 + intensity * 5.5;
  const lifeScale = 0.40 + intensity * 0.60;

  const particles: BurstP[] = Array.from({ length: count }, () => {
    const a    = Math.random() * Math.PI * 2;
    const spd  = (0.3 + Math.random() * 3.8) * spdScale;
    const life = Math.round((10 + Math.random() * 28) * lifeScale);
    return {
      x: cx + rnd(5), y: cy + rnd(5),
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      life, maxLife: life,
      size: Math.random() < 0.44 ? 1 : Math.random() < 0.80 ? 2 : 3,
      color,
    };
  });
  g.bursts.push({ particles });
}

// ─── Peg break animation (plays when ball exits and lit pegs are cleared) ─────
// Radially symmetric shatter: all dots fly outward simultaneously.
// Orange (filled) → many particles from the interior.
// Blue  (outline) → fewer particles arranged in a ring.
function spawnPegBreak(g: GameState, peg: Peg) {
  const isFilled = peg.type !== 'blue' && peg.type !== 'chain-node';
  const count    = peg.type === 'orange'     ? 28
                 : peg.type === 'purple'     ? 22
                 : peg.type === 'chain-weak' ? 22
                 : peg.type === 'chain-node' ? 10
                 : 14;
  const particles: BreakP[] = Array.from({ length: count }, (_, i) => {
    const a       = (i / count) * Math.PI * 2 + rnd(0.45);
    const startR  = isFilled
      ? PEG_R * (0.15 + Math.random() * 0.70)   // scatter from interior
      : PEG_R * (0.70 + Math.random() * 0.40);   // ring surface
    const spd     = 1.2 + Math.random() * 3.2;
    const life    = Math.round(28 + Math.random() * 24);
    return {
      x: peg.x + Math.cos(a) * startR * 0.5,
      y: peg.y + Math.sin(a) * startR * 0.5,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 0.5, // slight upward bias for visual flair
      life, maxLife: life,
      size: Math.random() < 0.30 ? 1 : Math.random() < 0.78 ? 2 : 3,
    };
  });
  g.pegBreaks.push({ particles });
}

// ─── Bucket-catch rainbow burst ───────────────────────────────────────────────
function spawnBucketBurst(g: GameState, cx: number, cy: number) {
  // Wave 1: heavy gold fountain (shoots straight up)
  const goldParticles: BurstP[] = Array.from({ length: 55 }, () => {
    const a    = -Math.PI / 2 + rnd(1.1);
    const spd  = 5.0 + Math.random() * 11.0;
    const life = Math.round(50 + Math.random() * 35);
    return {
      x: cx + rnd(16), y: cy,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life, maxLife: life,
      size: Math.random() < 0.2 ? 4 : Math.random() < 0.6 ? 6 : 9,
      color: Math.random() < 0.55 ? GOLD_GLOW_COLOR : Math.random() < 0.7 ? '#f5d46a' : '#ffe8a0',
    };
  });
  // Wave 2: rainbow explosion ring (denser, faster, bigger)
  const rainbowColors = ['#f07a6a','#f4a84a','#f5d46a','#81c784','#80deea','#90caf9','#ce93d8'];
  const ringParticles: BurstP[] = Array.from({ length: 88 }, (_, i) => {
    const a    = (i / 88) * Math.PI * 2 + rnd(0.15);
    const spd  = 4.5 + Math.random() * 9.0;
    const life = Math.round(38 + Math.random() * 28);
    return {
      x: cx + rnd(6), y: cy + rnd(4),
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 3.5,
      life, maxLife: life,
      size: Math.random() < 0.2 ? 4 : Math.random() < 0.6 ? 6 : 8,
      color: rainbowColors[i % rainbowColors.length],
    };
  });
  // Wave 3: fast shockwave ring (bright gold, very short life)
  const shockParticles: BurstP[] = Array.from({ length: 60 }, (_, i) => {
    const a    = (i / 60) * Math.PI * 2;
    const spd  = 10.0 + Math.random() * 8.0;
    const life = Math.round(10 + Math.random() * 8);
    return {
      x: cx, y: cy,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      life, maxLife: life,
      size: 3,
      color: '#ffe8a0',
    };
  });
  g.bursts.push({ particles: [...goldParticles, ...ringParticles, ...shockParticles] });
}

// ─── Black hole ball absorption burst ────────────────────────────────────────
function spawnBHAbsorb(g: GameState, cx: number, cy: number) {
  const particles: BurstP[] = [];
  for (let i = 0; i < 22; i++) {
    const a   = Math.random() * Math.PI * 2;
    const spd = 0.8 + Math.random() * 2.2;
    const col = Math.random() < 0.5 ? '#330022' : Math.random() < 0.7 ? '#220033' : '#440011';
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 18 + Math.random() * 10, maxLife: 28, size: 2 + Math.round(Math.random() * 2), color: col });
  }
  g.bursts.push({ particles });
}

// ─── Wormhole teleport burst ──────────────────────────────────────────────────
function spawnWHBurst(g: GameState, cx: number, cy: number) {
  const particles: BurstP[] = [];
  for (let i = 0; i < 18; i++) {
    const a   = Math.random() * Math.PI * 2;
    const spd = 1.8 + Math.random() * 3.2;
    const col = Math.random() < 0.55 ? '#aa44ff' : Math.random() < 0.6 ? '#6622cc' : '#dd88ff';
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 14 + Math.random() * 10, maxLife: 24, size: 2, color: col });
  }
  g.bursts.push({ particles });
}

// ─── Bomb rainbow fireworks burst ────────────────────────────────────────────
function spawnBombBurst(g: GameState, cx: number, cy: number) {
  const rainbow = ['#ff4444','#ff8844','#ffdd44','#44ee44','#44ddff','#6688ff','#dd44ff','#ff44aa'] as const;

  // Wave 1: instant white shockwave ring
  const shock: BurstP[] = Array.from({ length: 80 }, (_, i) => {
    const a   = (i / 80) * Math.PI * 2;
    const spd = 13.0 + Math.random() * 7.0;
    const life = Math.round(7 + Math.random() * 5);
    return { x: cx, y: cy, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life, maxLife: life, size: 2, color: '#ffffff' };
  });

  // Wave 2: 8 rainbow debris streams radiating outward
  const debris: BurstP[] = [];
  for (let s = 0; s < 8; s++) {
    const baseA = (s / 8) * Math.PI * 2;
    const col   = rainbow[s];
    for (let p = 0; p < 14; p++) {
      const a   = baseA + rnd(0.40);
      const spd = 2.5 + Math.random() * 10.0;
      const life = Math.round(38 + Math.random() * 32);
      debris.push({ x: cx + rnd(8), y: cy + rnd(8), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 1.5, life, maxLife: life, size: Math.random() < 0.3 ? 3 : Math.random() < 0.7 ? 5 : 7, color: col });
    }
  }

  // Wave 3: slow rainbow sparkle cloud (longer life, floats upward)
  const sparkle: BurstP[] = Array.from({ length: 60 }, (_, i) => {
    const a   = (i / 60) * Math.PI * 2 + rnd(0.25);
    const spd = 1.0 + Math.random() * 4.5;
    const life = Math.round(50 + Math.random() * 40);
    return { x: cx + rnd(12), y: cy + rnd(12), vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 2.5, life, maxLife: life, size: 2, color: rainbow[i % rainbow.length] };
  });

  g.bursts.push({ particles: [...shock, ...debris, ...sparkle] });
}

// ─── Bumper dot generation ────────────────────────────────────────────────────
function makeBumperDots(w: number, h: number): Dot[] {
  const dots: Dot[] = [];
  const hw = w * 0.5, hh = h * 0.5;
  // Interior fill (sparse stipple)
  for (let x = -hw + 2; x <= hw - 2; x += 2.8) {
    for (let y = -hh + 1.5; y <= hh - 1.5; y += 2.8) {
      if (Math.random() > 0.60) continue;
      dots.push(makeDot(x, y, 1.10));
    }
  }
  // Top / bottom edge reinforcement (denser, gives clear outline)
  for (let x = -hw; x <= hw; x += 2.0) {
    dots.push(makeDot(x, -hh, 1.05));
    dots.push(makeDot(x,  hh, 1.05));
  }
  // End caps
  for (let y = -hh; y <= hh; y += 2.2) {
    dots.push(makeDot(-hw, y, 1.0));
    dots.push(makeDot( hw, y, 1.0));
  }
  return dots;
}

// ─── Wormhole aura dot generation ────────────────────────────────────────────
function makeWormholeAura(w: number): Dot[] {
  const dots: Dot[] = [];
  const halfW = w * 0.5 + 16;
  const halfH = 22;
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() * 2 - 1) * halfW;
    const y = (Math.random() * 2 - 1) * halfH;
    const distFromBar = Math.max(0, Math.abs(y) - 3);
    if (Math.random() > Math.exp(-distFromBar * 0.11)) continue;
    const size  = Math.random() < 0.55 ? 1 : 2;
    const alpha = 0.28 + Math.random() * 0.48;
    const phase = Math.random() * Math.PI * 2;
    // Aura dots use a secondary jitter phase of phase*1.3 (not 1.27) — see the aura draw loop.
    dots.push({ x, y, size, alpha, phase, cosP: Math.cos(phase), sinP: Math.sin(phase), cosP2: Math.cos(phase * 1.3), sinP2: Math.sin(phase * 1.3) });
  }
  return dots;
}

// ─── OBB overlap test (no reflection) ────────────────────────────────────────
function testBallOBB(ball: Ball, cx: number, cy: number, w: number, h: number, angle: number): boolean {
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const dx = ball.x - cx, dy = ball.y - cy;
  const lx =  cosA * dx + sinA * dy;
  const ly = -sinA * dx + cosA * dy;
  return Math.abs(lx) <= w * 0.5 + BALL_R && Math.abs(ly) <= h * 0.5 + BALL_R;
}

// ─── Bumper–ball collision (OBB vs circle) ────────────────────────────────────
// Transforms ball into the bumper's local frame, tests AABB, then reflects.
function collideBallBumper(ball: Ball, bumper: Bumper): boolean {
  const cosA = Math.cos(bumper.angle), sinA = Math.sin(bumper.angle);
  const dx = ball.x - bumper.cx, dy = ball.y - bumper.cy;
  // Rotate into local frame (rotate by -angle)
  const lx =  cosA * dx + sinA * dy;
  const ly = -sinA * dx + cosA * dy;

  const hw = bumper.w * 0.5 + BALL_R;
  const hh = bumper.h * 0.5 + BALL_R;
  if (Math.abs(lx) > hw || Math.abs(ly) > hh) return false;

  // Penetration depth on each axis → nearest face normal
  const ox = hw - Math.abs(lx);
  const oy = hh - Math.abs(ly);
  let nlx: number, nly: number, push: number;
  if (ox < oy) { nlx = lx >= 0 ? 1 : -1; nly = 0; push = ox; }
  else          { nlx = 0; nly = ly >= 0 ? 1 : -1; push = oy; }

  // Rotate normal back to world frame (rotate by +angle)
  const wnx = cosA * nlx - sinA * nly;
  const wny = sinA * nlx + cosA * nly;

  const vDotN = ball.vx * wnx + ball.vy * wny;
  if (vDotN > 0) return false; // already separating

  // Reflect and push out
  ball.vx -= 2 * vDotN * wnx;
  ball.vy -= 2 * vDotN * wny;
  ball.x  += wnx * push;
  ball.y  += wny * push;
  return true;
}

// ─── Lightning arc helper ─────────────────────────────────────────────────────
function makeLightningPath(x1: number, y1: number, x2: number, y2: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const jx = i > 0 && i < n ? (Math.random() - 0.5) * 26 : 0;
    const jy = i > 0 && i < n ? (Math.random() - 0.5) * 26 : 0;
    pts.push({ x: x1 + (x2 - x1) * t + jx, y: y1 + (y2 - y1) * t + jy });
  }
  return pts;
}

// ─── Level generation ─────────────────────────────────────────────────────────
// Milestone levels: every 10th = boss spike, other multiples of 5 = special.
type SpecialKind = 'special' | 'boss' | null;
function specialKind(level: number): SpecialKind {
  if (level % 10 === 0) return 'boss';
  if (level % 5 === 0)  return 'special';
  return null;
}

// Hidden dynamic-refill throttle: the more ammo you're holding, the less likely
// fired balls become catchable "bucket balls" — keeps the player near the edge
// without touching any visible payout. Lower levels are more lenient (higher band).
// Boss/special levels are exempt (they demand lots of ammo) → factor 1.
function refillFactor(level: number, shots: number): number {
  if (specialKind(level)) return 1;
  const bandTop = Math.max(7, 13 - Math.floor(level * 0.35));
  return Math.max(0.25, Math.min(1, (bandTop - shots) / bandTop));
}

function generateLevel(W: number, H: number, launcherY: number, rng: () => number, level = 1): { pegs: Peg[], orangeTotal: number, bumpers: Bumper[], gravZones: GravZone[], wormholes: Wormhole[], wallSegments: WallSegment[], boss: Boss | null, comets: Comet[], lenses: Lens[], cme: { active: boolean; period: number }, pulsars: Pulsar[], gravWaves: GravWave[], vacuums: VacuumBubble[], whiteHoles: WhiteHole[], magnetars: Magnetar[], roguePlanets: RoguePlanet[], quasarJets: QuasarJet[], microBHs: MicroBH[], darkHalos: DarkHalo[], ergospheres: Ergosphere[], magReconnections: MagReconnection[], preSupernovae: PreSupernova[] } {
  const pegs: Peg[] = [];
  const topPad    = launcherY + 65;
  const bottomPad = H * 0.18;
  const playH     = H - topPad - bottomPad;
  const playW     = W * 0.86;
  const rows      = 11;
  const BASE_COLS = 9;
  const STEP_X    = playW / BASE_COLS;
  const startX    = (W - (BASE_COLS - 1) * STEP_X) / 2;
  const STEP_Y    = playH / rows;

  // Special / boss levels pack the board denser with more orange targets.
  const special    = specialKind(level);
  const fillThresh = special === 'boss' ? 0.93 : special ? 0.89 : 0.82; // higher = fuller board
  const orangeP    = special === 'boss' ? 0.50 : special ? 0.45 : 0.38;
  const minOrange  = special === 'boss' ? 20   : special ? 16   : 12;

  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * STEP_X * 0.5;
    const cols   = row % 2 === 0 ? BASE_COLS : BASE_COLS - 1;
    for (let col = 0; col < cols; col++) {
      if (rng() > fillThresh) continue;
      const x = startX + col * STEP_X + offset + rnd(STEP_X * 0.20);
      const y = topPad + row * STEP_Y + STEP_Y * 0.5 + rnd(STEP_Y * 0.18);
      const tooClose = pegs.some(p => { const dx = p.x - x, dy = p.y - y; return dx*dx + dy*dy < (PEG_R * 2.5) ** 2; });
      if (tooClose) continue;
      const tr   = rng();
      const type: PegType = tr < orangeP ? 'orange' : tr < 0.97 ? 'blue' : 'purple';
      pegs.push({ x, y, type, cleared: false, hitCool: 0, dots: makePegDots(type) });
    }
  }

  // Guarantee a minimum number of orange pegs (higher on special/boss levels)
  const orangeCount = pegs.filter(p => p.type === 'orange').length;
  if (orangeCount < minOrange) {
    const blues = pegs.filter(p => p.type === 'blue');
    let toConvert = Math.min(minOrange - orangeCount, blues.length);
    while (toConvert > 0 && blues.length > 0) {
      const idx = Math.floor(rng() * blues.length);
      blues[idx].type = 'orange';
      blues[idx].dots = makePegDots('orange');
      blues.splice(idx, 1);
      toConvert--;
    }
  }

  // ── Gimmick pegs (bomb / split / magnet) ─────────────────────────────────
  // Use a dedicated rng (1 main rng call) to keep peg layout deterministic.
  const gimmickRng = makeRng((rng() * 0x100000000) >>> 0);
  if (level >= 5) {
    for (const peg of pegs) {
      if (peg.type === 'blue' && gimmickRng() < BOMB_CHANCE) {
        peg.type = 'bomb'; peg.dots = makePegDots('bomb');
      }
    }
  }
  if (level >= 8) {
    for (const peg of pegs) {
      if (peg.type === 'blue' && gimmickRng() < SPLIT_CHANCE) {
        peg.type = 'split'; peg.dots = makePegDots('split');
      }
    }
  }
  if (level >= 6) {
    const magnetCount = Math.min(3, 1 + Math.floor(gimmickRng() * (level - 4) / 3));
    const blues = pegs.filter(p => p.type === 'blue');
    for (let m = 0; m < magnetCount && blues.length > 0; m++) {
      const idx = Math.floor(gimmickRng() * blues.length);
      blues[idx].type = 'magnet'; blues[idx].dots = makePegDots('magnet');
      blues.splice(idx, 1);
    }
  }

  // ── Gravity zones (level 7+, 60% chance) ──────────────────────────────────
  const gravZones: GravZone[] = [];
  if (level >= 7 && gimmickRng() < 0.6) {
    const zoneW = W * 0.55;
    const zoneH = 55;
    const zoneX = (W - zoneW) * (0.1 + gimmickRng() * 0.8);
    const zoneY = topPad + playH * (0.25 + gimmickRng() * 0.40);
    gravZones.push({ x: zoneX, y: zoneY, w: zoneW, h: zoneH, flashTimer: 0 });
  }

  // ── Bumpers (count and angle range scale with level) ──────────────────────
  // Level 1-2: 3, Level 3-5: 4, Level 6-8: 5, Level 9+: 6 (capped)
  // Angle range: ±58° at level 1 → ±72° at level 7+ (capped)
  // Level 3+: some bumpers rotate
  const bumperCount = Math.min(6, 3 + Math.floor(level / 3));
  const angleRange  = Math.min(Math.PI * 0.80, Math.PI * (0.65 + (level - 1) * 0.025));
  const bPositions  = Array.from({ length: bumperCount }, (_, i) => (i + 1) / (bumperCount + 1));
  const bumperRng   = makeRng((rng() * 0x100000000) >>> 0);
  const xJitter     = W * Math.max(0.04, 0.12 - bumperCount * 0.01);
  const maxW        = Math.max(4, 28 - bumperCount * 3);
  const bumpers: Bumper[] = [];
  for (let i = 0; i < bumperCount; i++) {
    const cx = W * bPositions[i] + (bumperRng() - 0.5) * xJitter;
    const cy = topPad + playH * (0.28 + bumperRng() * 0.42);
    const angle = (bumperRng() - 0.5) * angleRange;
    const w = 52 + Math.floor(bumperRng() * maxW);
    const rotProb = level >= 3 ? Math.min(0.8, (level - 2) * 0.15) : 0;
    const angularVel = bumperRng() < rotProb ? (bumperRng() - 0.5) * 0.030 : 0;
    bumpers.push({ cx, cy, w, h: 10, angle, angularVel, dots: makeBumperDots(w, 10), hitFlash: 0, hitCount: 0, hitCool: 0 });
  }

  // ── Wormholes (level 9+, always in pairs) ────────────────────────────────────
  const wormholes: Wormhole[] = [];
  if (level >= 9) {
    const pairCount = level >= 12 ? 2 : 1;
    const whRng = makeRng((rng() * 0x100000000) >>> 0);
    for (let p = 0; p < pairCount; p++) {
      const cycleOffset = Math.floor(whRng() * WORMHOLE_CYCLE);
      for (let slot = 0; slot < 2; slot++) {
        const cx    = W * (0.15 + whRng() * 0.70);
        const cy    = topPad + playH * (0.15 + whRng() * 0.68);
        const angle = (whRng() - 0.5) * Math.PI * 0.75;
        const w     = 36 + Math.floor(whRng() * 14); // thinner than bumper (52+)
        wormholes.push({ cx, cy, w, h: 5, angle, pairId: p, pairSlot: slot as 0 | 1, cycleTimer: cycleOffset, hitCool: 0, flashTimer: 0, dots: makeBumperDots(w, 5), auraDots: makeWormholeAura(w) });
      }
    }
  }

  // ── Chain peg groups (level 10+) ─────────────────────────────────────────
  if (level >= 10) {
    const chainRng    = makeRng((rng() * 0x100000000) >>> 0);
    const groupCount  = level >= 15 ? 2 : 1;
    const maxHp       = Math.min(CHAIN_HP_MAX, CHAIN_HP_BASE + Math.floor((level - 10) / 5));

    for (let g = 0; g < groupCount; g++) {
      const chainId   = g;
      const nodeCount = 2 + Math.floor(chainRng() * 4); // 2–5 nodes
      const wcx       = W * (0.2 + chainRng() * 0.6);
      const wcy       = topPad + playH * (0.25 + chainRng() * 0.45);
      const clusterR  = 44 + chainRng() * 18;

      pegs.push({ x: wcx, y: wcy, type: 'chain-weak', cleared: false, hitCool: 0,
        dots: makePegDots('chain-weak'), chainId, hp: maxHp, maxHp });

      for (let n = 0; n < nodeCount; n++) {
        const angle = (n / nodeCount) * Math.PI * 2 + chainRng() * 0.5;
        const nx = Math.max(PEG_R + 5, Math.min(W - PEG_R - 5, wcx + Math.cos(angle) * clusterR));
        const ny = Math.max(topPad + PEG_R + 5, Math.min(topPad + playH - PEG_R - 5, wcy + Math.sin(angle) * clusterR));
        pegs.push({ x: nx, y: ny, type: 'chain-node', cleared: false, hitCool: 0,
          dots: makePegDots('chain-node'), chainId });
      }
    }
  }

  // ── Shield pegs (level 13+): 2-hit pegs, taken from blue pool ────────────
  if (level >= 13) {
    const shieldCount = Math.min(3, 1 + Math.floor(gimmickRng() * 2));
    const blues = pegs.filter(p => p.type === 'blue');
    for (let s = 0; s < shieldCount && blues.length > 0; s++) {
      const idx = Math.floor(gimmickRng() * blues.length);
      blues[idx].type = 'shield'; blues[idx].dots = makePegDots('shield');
      blues[idx].hp = SHIELD_HP; blues[idx].maxHp = SHIELD_HP;
      blues.splice(idx, 1);
    }
  }

  // ── Lightning pegs (level 19+): cascade clear on hit ─────────────────────
  if (level >= 19) {
    const lightningCount = Math.min(2, 1 + Math.floor(gimmickRng() * 2));
    const blues2 = pegs.filter(p => p.type === 'blue');
    for (let l = 0; l < lightningCount && blues2.length > 0; l++) {
      const idx = Math.floor(gimmickRng() * blues2.length);
      blues2[idx].type = 'lightning'; blues2[idx].dots = makePegDots('lightning');
      blues2.splice(idx, 1);
    }
  }

  // ── Hash pegs (level 22+): randomize ball direction on hit ───────────────
  if (level >= 22) {
    const hashCount = Math.min(3, 1 + Math.floor(gimmickRng() * 2));
    const blues3 = pegs.filter(p => p.type === 'blue');
    for (let h = 0; h < hashCount && blues3.length > 0; h++) {
      const idx = Math.floor(gimmickRng() * blues3.length);
      blues3[idx].type = 'hash'; blues3[idx].dots = makePegDots('hash');
      blues3.splice(idx, 1);
    }
  }

  // ── Freeze pegs (level 25+): slow ball for FREEZE_DUR frames ─────────────
  if (level >= 25) {
    const blues4 = pegs.filter(p => p.type === 'blue');
    const freezeCount = Math.min(2, Math.floor(gimmickRng() * 3));
    for (let f = 0; f < freezeCount && blues4.length > 0; f++) {
      const idx = Math.floor(gimmickRng() * blues4.length);
      blues4[idx].type = 'freeze'; blues4[idx].dots = makePegDots('freeze');
      blues4.splice(idx, 1);
    }
  }

  // ── Mud pegs (level 26+): 0-3 sticky pegs that kill a ball's momentum, break
  // on hit, and revive before the next shot. Introduced once new-gimmick unlocks
  // have run out (freeze @25 is the last), so it reads as the final new peg type.
  if (level >= 26) {
    const mudBlues = pegs.filter(p => p.type === 'blue');
    const mudCount = Math.floor(gimmickRng() * 4); // 0..3
    for (let m = 0; m < mudCount && mudBlues.length > 0; m++) {
      const idx = Math.floor(gimmickRng() * mudBlues.length);
      mudBlues[idx].type = 'mud'; mudBlues[idx].dots = makePegDots('mud');
      mudBlues[idx].mudBroken = false; mudBlues[idx].mudAnim = 0;
      mudBlues.splice(idx, 1);
    }
  }

  // ── Boss core + re-arming armor ring (boss levels) ───────────────────────────
  let boss: Boss | null = null;
  if (special === 'boss') {
    const tier      = Math.floor(level / 10);                        // 1 at lv10, 2 at lv20...
    const bx        = W / 2;
    const by        = topPad + playH * 0.58;                         // lower-centre of the play field
    const armorR    = BOSS_R + PEG_R + 7;
    const armorN    = BOSS_ARMOR_COUNT + Math.min(4, tier - 1);      // 8..12 shields
    const armorHp   = tier >= 3 ? 3 : SHIELD_HP;                     // tougher armor from lv30
    const moveSpeed = tier >= 2 ? Math.min(2.2, 0.6 + (tier - 2) * 0.4) : 0; // drift from lv20
    const moveSpan  = moveSpeed > 0 ? W * 0.18 : 0;
    const moveMinX  = bx - moveSpan, moveMaxX = bx + moveSpan;
    const maxHp     = BOSS_HP_BASE + Math.max(0, tier - 1) * BOSS_HP_PER_TIER;
    // carve a clean arena covering the horizontal sweep (capsule footprint)
    const clearR = armorR + PEG_R + 4;
    for (let i = pegs.length - 1; i >= 0; i--) {
      const cxClamped = Math.max(moveMinX, Math.min(moveMaxX, pegs[i].x));
      const ddx = pegs[i].x - cxClamped, ddy = pegs[i].y - by;
      if (ddx * ddx + ddy * ddy < clearR * clearR) pegs.splice(i, 1);
    }
    boss = {
      x: bx, y: by, r: BOSS_R, hp: maxHp, maxHp,
      hitFlash: 0, hitCool: 0, rearmFlash: 0,
      tier, vx: moveSpeed, armorR, moveMinX, moveMaxX,
    };
    for (let i = 0; i < armorN; i++) {
      const a = (i / armorN) * Math.PI * 2 - Math.PI / 2;
      pegs.push({ x: bx + Math.cos(a) * armorR, y: by + Math.sin(a) * armorR, type: 'shield', cleared: false, hitCool: 0, dots: makePegDots('shield'), hp: armorHp, maxHp: armorHp, bossArmor: true, armorAngle: a });
    }
  }

  // ── Partial wall segments ─────────────────────────────────────────────────
  const wallSegments: WallSegment[] = [];
  const wallRng = makeRng((rng() * 0x100000000) >>> 0);
  const segH = 70;
  const segYMin = topPad + playH * 0.15;
  const segYMax = topPad + playH * 0.80 - segH;

  // Ball-vanishing wall (red haze): a partial wall segment at a fully random spot
  // whose spawn chance rises a little every level. Rolled first so it is never
  // crowded out of the 2-segment cap by warp/distort at high levels.
  const voidProb = Math.min(0.55, Math.max(0, (level - 1) * 0.015));
  if (wallRng() < voidProb) {
    const side = wallRng() < 0.5 ? 'left' : 'right';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'void' });
  }
  // Second red wall: only when a first one spawned and there is no black hole this
  // level. With no black hole it uses the SAME probability as the first wall.
  // Placed on the opposite wall so the two traps are visually distinct.
  const firstVoid = wallSegments.find(s => s.type === 'void');
  if (
    gravZones.length === 0 &&
    firstVoid &&
    wallSegments.length < 2 &&
    wallRng() < voidProb
  ) {
    const side: 'left' | 'right' = firstVoid.side === 'left' ? 'right' : 'left';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'void' });
  }
  if (level >= 14 && wallRng() < 0.30 && wallSegments.length < 2) {
    const side = wallRng() < 0.5 ? 'left' : 'right';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'warp' });
  }
  if (level >= 16 && wallRng() < 0.30 && wallSegments.length < 2) {
    const side = wallRng() < 0.5 ? 'left' : 'right';
    const yMin = segYMin + wallRng() * (segYMax - segYMin);
    wallSegments.push({ side, yMin, yMax: yMin + segH, type: 'distort' });
  }

  // ── Space hazards: comets, gravitational lenses, CME (each a level-gated 50% roll) ──
  const hazardRng = makeRng((rng() * 0x100000000) >>> 0);
  // Comet (lv12+): blue deflector that bounces around the field. Up to 3, each an
  // extra probabilistic roll that gets more likely as levels rise.
  const comets: Comet[] = [];
  if (level >= 12 && hazardRng() < 0.5) {
    let cometCount = 1;
    if (level >= 16 && hazardRng() < 0.45) cometCount++;                       // 2nd
    if (cometCount === 2 && level >= 22 && hazardRng() < 0.35) cometCount++;   // 3rd
    for (let c = 0; c < cometCount; c++) {
      // start off-screen; entry edge/height are pre-decided so the runtime can telegraph them
      comets.push({
        x: -100, y: -100, vx: 0, vy: 0, r: 18, hitCool: 0,
        respawnTimer: 30 + Math.floor(hazardRng() * 40),
        warnFromLeft: hazardRng() < 0.5,
        warnY: (launcherY + 60) + hazardRng() * ((H - launcherY) * 0.45),
        vanish: false, hitFlash: 0, hitX: 0, hitY: 0,
      });
    }
  }
  // Red comet (lv18+): destroys any ball it touches; crosses and exits (not bouncing).
  // Up to 2 — the 2nd is a rare, high-level-only extra roll.
  if (level >= 18 && hazardRng() < 0.4) {
    let redCount = 1;
    if (level >= 26 && hazardRng() < 0.3) redCount++;   // 2nd red comet
    for (let c = 0; c < redCount; c++) {
      comets.push({
        x: -100, y: -100, vx: 0, vy: 0, r: 18, hitCool: 0,
        respawnTimer: 30 + Math.floor(hazardRng() * 40),
        warnFromLeft: hazardRng() < 0.5,
        warnY: (launcherY + 60) + hazardRng() * ((H - launcherY) * 0.45),
        vanish: true, hitFlash: 0, hitX: 0, hitY: 0,
      });
    }
  }
  // Gravitational lens (lv15+): tangential swirl that bends ball paths. 2 lenses from lv28.
  const lenses: Lens[] = [];
  if (level >= 15 && hazardRng() < 0.5) {
    const lensCount = level >= 28 ? 2 : 1;
    const strength  = 0.45 + Math.min(1.1, (level - 15) * 0.03);
    for (let l = 0; l < lensCount; l++) {
      const lx = W * (0.20 + hazardRng() * 0.60);
      const ly = topPad + playH * (0.20 + hazardRng() * 0.55);
      lenses.push({ x: lx, y: ly, r: 62, dir: hazardRng() < 0.5 ? 1 : -1, strength });
    }
  }
  // CME (lv20+): periodic top→bottom shockwave sweep. Period shrinks with level.
  const cme = { active: false, period: 0 };
  if (level >= 20 && hazardRng() < 0.5) {
    cme.active = true;
    cme.period = Math.max(180, 380 - level * 5);
  }

  // ── Deep-space hazards (lv24+): each gets its own rng stream, seeded after all
  // existing draws, so adding/tuning one never shifts older levels' layouts.
  // Pulsar (lv24+): rotating twin radiation beams push balls outward.
  const pulsarRng = makeRng((rng() * 0x100000000) >>> 0);
  const pulsars: Pulsar[] = [];
  if (level >= 24 && pulsarRng() < 0.5) {
    pulsars.push({
      x: W * (0.25 + pulsarRng() * 0.50),
      y: topPad + playH * (0.25 + pulsarRng() * 0.45),
      angle: pulsarRng() * Math.PI,
      rotSpeed: (pulsarRng() < 0.5 ? 1 : -1) * PULSAR_ROT,
      beamLen: PULSAR_BEAM_LEN + Math.min(70, Math.max(0, (level - 24) * 6)),
    });
  }
  // Gravitational wave (lv27+): periodic ripple ring bends every ball it passes.
  const gwRng = makeRng((rng() * 0x100000000) >>> 0);
  const gravWaves: GravWave[] = [];
  if (level >= 27 && gwRng() < 0.5) {
    gravWaves.push({
      ex: W * (0.15 + gwRng() * 0.70),
      ey: topPad + playH * (0.10 + gwRng() * 0.35),
      radius: -1,
      period: Math.max(220, 400 - level * 5),
      timer: 120 + Math.floor(gwRng() * 120),
      dir: gwRng() < 0.5 ? 1 : -1,
    });
  }
  // Vacuum decay bubble (lv29+): expanding sphere of "wrong physics" (gravity flips inside).
  const vacRng = makeRng((rng() * 0x100000000) >>> 0);
  const vacuums: VacuumBubble[] = [];
  if (level >= 29 && vacRng() < 0.5) {
    vacuums.push({
      x: W * (0.25 + vacRng() * 0.50),
      y: topPad + playH * (0.30 + vacRng() * 0.40),
      r: VAC_R0,
      rMax: 90 + Math.min(40, Math.max(0, (level - 29) * 4)),
      grow: 0.085,
      respawnTimer: 0,
      popFlash: 0,
    });
  }
  // White hole (lv23+): radial repulsion, the visual/physical inverse of the black hole.
  const whiteHoleRng = makeRng((rng() * 0x100000000) >>> 0);
  const whiteHoles: WhiteHole[] = [];
  if (level >= 23 && whiteHoleRng() < 0.5) {
    whiteHoles.push({
      x: W * (0.25 + whiteHoleRng() * 0.50),
      y: topPad + playH * (0.25 + whiteHoleRng() * 0.45),
      strength: WH_PUSH + Math.min(0.55, Math.max(0, (level - 23) * 0.03)),
    });
  }
  // Magnetar (lv31+): periodic starquake flare that shoves nearby balls outward.
  const magnetarRng = makeRng((rng() * 0x100000000) >>> 0);
  const magnetars: Magnetar[] = [];
  if (level >= 31 && magnetarRng() < 0.5) {
    magnetars.push({
      x: W * (0.25 + magnetarRng() * 0.50),
      y: topPad + playH * (0.25 + magnetarRng() * 0.45),
      period: Math.max(180, 300 - Math.max(0, (level - 31) * 8)),
      timer: 90 + Math.floor(magnetarRng() * 90),
      releaseTimer: 0,
    });
  }
  // Rogue planet (lv32+): a drifting gravity well with a solid bounce body.
  const roguePlanetRng = makeRng((rng() * 0x100000000) >>> 0);
  const roguePlanets: RoguePlanet[] = [];
  if (level >= 32 && roguePlanetRng() < 0.45) {
    const spd = 0.35 + Math.max(0, (level - 32) * 0.01);
    roguePlanets.push({
      x: W * (0.30 + roguePlanetRng() * 0.40),
      y: topPad + playH * (0.25 + roguePlanetRng() * 0.30),
      vx: (roguePlanetRng() < 0.5 ? 1 : -1) * spd * (0.7 + roguePlanetRng() * 0.4),
      vy: (roguePlanetRng() < 0.5 ? 1 : -1) * spd * (0.4 + roguePlanetRng() * 0.3),
      r: RP_R,
      hitCool: 0,
      ringTilt: roguePlanetRng() * Math.PI,
    });
  }
  // Quasar jet (lv33+): a fixed plasma column that flings balls along its axis.
  const quasarJetRng = makeRng((rng() * 0x100000000) >>> 0);
  const quasarJets: QuasarJet[] = [];
  if (level >= 33 && quasarJetRng() < 0.45) {
    const y0   = topPad + playH * (0.15 + quasarJetRng() * 0.25);
    const jlen = playH * (0.35 + quasarJetRng() * 0.25);
    quasarJets.push({
      bx: W * (0.25 + quasarJetRng() * 0.50),
      y0,
      y1: y0 + jlen,
      dir: quasarJetRng() < 0.5 ? 1 : -1,
      accel: 0.30 + Math.min(0.30, Math.max(0, (level - 33) * 0.015)),
    });
  }
  // Evaporating micro black hole (lv34+): shrinking pull → evaporation burst → re-form.
  const microBHRng = makeRng((rng() * 0x100000000) >>> 0);
  const microBHs: MicroBH[] = [];
  if (level >= 34 && microBHRng() < 0.45) {
    const spotCount = 2 + Math.floor(microBHRng() * 2); // 2-3 re-form sites
    const spots: { x: number; y: number }[] = [];
    for (let s = 0; s < spotCount; s++) {
      spots.push({
        x: W * (0.20 + microBHRng() * 0.60),
        y: topPad + playH * (0.20 + microBHRng() * 0.50),
      });
    }
    const maxLife = Math.max(360, 700 - Math.max(0, (level - 34) * 15));
    microBHs.push({
      x: spots[0].x, y: spots[0].y,
      life: maxLife, maxLife,
      evap: 0, dormant: 0,
      spots, spotIdx: 0,
    });
  }
  // Dark matter halo (lv35+): a nearly invisible attraction source (magnet-style, enlarged).
  const darkHaloRng = makeRng((rng() * 0x100000000) >>> 0);
  const darkHalos: DarkHalo[] = [];
  if (level >= 35 && darkHaloRng() < 0.45) {
    darkHalos.push({
      x: W * (0.25 + darkHaloRng() * 0.50),
      y: topPad + playH * (0.25 + darkHaloRng() * 0.45),
      strength: DM_PULL + Math.min(0.30, Math.max(0, (level - 35) * 0.015)),
      shimmer: 60 + Math.floor(darkHaloRng() * 90),
    });
  }
  // Ergosphere (lv36+): a ring band where a one-way tangential drag drags balls around it
  // (a rotating BH's frame-dragging region). The centre stays inert — only the band pulls.
  const ergoRng = makeRng((rng() * 0x100000000) >>> 0);
  const ergospheres: Ergosphere[] = [];
  if (level >= 36 && ergoRng() < 0.45) {
    ergospheres.push({
      x: W * (0.25 + ergoRng() * 0.50),
      y: topPad + playH * (0.25 + ergoRng() * 0.45),
      r0: ERGO_R0,
      r1: ERGO_R1,
      strength: ERGO_DRAG + Math.min(0.5, Math.max(0, (level - 36) * 0.02)),
      dir: ergoRng() < 0.5 ? 1 : -1,
    });
  }
  // Magnetic reconnection (lv37+): an X of field lines, inert until a periodic snap ejects
  // balls outward along whichever line they're on. Fully passable between snaps.
  const mrRng = makeRng((rng() * 0x100000000) >>> 0);
  const magReconnections: MagReconnection[] = [];
  if (level >= 37 && mrRng() < 0.45) {
    const mrPeriod = Math.max(200, 320 - (level - 37) * 10);
    magReconnections.push({
      x: W * (0.25 + mrRng() * 0.50),
      y: topPad + playH * (0.25 + mrRng() * 0.45),
      angle: mrRng() * Math.PI * 2,
      period: mrPeriod,
      timer: mrPeriod,
      releaseTimer: 0,
    });
  }
  // Pre-supernova star (lv38+): a solid body that swells (14→30) over its cycle, explodes
  // outward, then collapses back to its minimum radius and starts swelling again.
  const snRng = makeRng((rng() * 0x100000000) >>> 0);
  const preSupernovae: PreSupernova[] = [];
  if (level >= 38 && snRng() < 0.45) {
    const snPeriod = Math.max(360, 600 - (level - 38) * 8);
    preSupernovae.push({
      x: W * (0.25 + snRng() * 0.50),
      y: topPad + playH * (0.25 + snRng() * 0.45),
      hitCool: 0,
      hitFlash: 0,
      period: snPeriod,
      timer: snPeriod,
      boomTimer: 0,
      shrinkTimer: 0,
    });
  }

  return { pegs, orangeTotal: pegs.filter(p => p.type === 'orange').length, bumpers, gravZones, wormholes, wallSegments, boss, comets, lenses, cme, pulsars, gravWaves, vacuums, whiteHoles, magnetars, roguePlanets, quasarJets, microBHs, darkHalos, ergospheres, magReconnections, preSupernovae };
}

// ─── Trajectory preview ───────────────────────────────────────────────────────
// Runs every frame while aiming, so the points are written into a persistent module-level
// buffer instead of allocating a fresh array per call. Returns the number of valid points.
const TRAJ_MAX = 90;
const _trajBuf: TrajPt[] = Array.from({ length: TRAJ_MAX }, () => ({ x: 0, y: 0 }));

function computeTrajectory(sx: number, sy: number, vx: number, vy: number, pegs: Peg[], W: number, windForce = 0, warpWalls = false, windRange = W, windCenter = W / 2, windRectY0 = 0, windRectY1 = 0): number {
  let n = 0;
  let x = sx, y = sy, tvx = vx, tvy = vy;
  const windHalf = windRange / 2;
  const isNarrowWind = windRange < W;
  for (let i = 0; i < TRAJ_MAX; i++) {
    tvy += GRAVITY;
    const inWindX = windForce !== 0 && Math.abs(x - windCenter) <= windHalf;
    const inWindY = !isNarrowWind || (y >= windRectY0 && y <= windRectY1);
    if (inWindX && inWindY) tvx += windForce;
    tvx = Math.max(-BALL_SPEED * 2, Math.min(BALL_SPEED * 2, tvx));
    x  += tvx; y += tvy;
    if (warpWalls) {
      if (x < -BALL_R)      x += W + BALL_R * 2;
      if (x > W + BALL_R)   x -= W + BALL_R * 2;
    } else {
      if (x - BALL_R < 0)  { x = BALL_R;     tvx =  Math.abs(tvx); }
      if (x + BALL_R > W)  { x = W - BALL_R; tvx = -Math.abs(tvx); }
    }
    _trajBuf[n].x = x; _trajBuf[n].y = y; n++;
    let hit = false;
    for (const p of pegs) {
      if (p.cleared || p.type === 'magnet') continue;
      const dx = x - p.x, dy = y - p.y;
      if (dx*dx + dy*dy < (BALL_R + PEG_R) ** 2) { hit = true; break; }
    }
    if (hit || y > sy + 520) break;
  }
  return n;
}

// ─── Translations ─────────────────────────────────────────────────────────────
const LANGS = {
  en: {
    miniGame:            'Mini Game',
    tagline1:            'Clear all the orange pegs.',
    tagline2:            'Drag to aim, release to fire.',
    startPlaying:        'Start Playing',
    levelLabel:          'Level',
    targetsLabel:        'Targets',
    shotsLabel:          'Shots',
    scoreLabel:          'Score',
    paused:              'PAUSED',
    resume:              'Resume',
    retire:              'Retire',
    confirmRetireText:   'Are you sure you want to retire?',
    confirmRetireSub:    'Your current score can be recorded.',
    retireConfirm:       'Retire',
    cancel:              'Cancel',
    gameOver:            'Game Over',
    retiredLabel:        'Retired',
    levelSummary:        (ret: boolean, lv: number, left: number) =>
      `${ret ? 'Retired at' : 'Reached'} Level ${lv}  -  ${left} target${left !== 1 ? 's' : ''} remaining`,
    playAgain:           'Play Again',
    share:               'Share',
    scoreZero:           'Score 0 cannot be recorded on-chain.',
    connectWallet:       'Connect Wallet',
    connecting:          'Connecting...',
    recordOnChain:       'Record On-Chain',
    recording:           'Recording...',
    failedRetry:         'Failed - Retry',
    disconnect:          'Disconnect',
    scoreRecorded:       'Score recorded on Base',
    viewOnBasescan:      'View on Basescan',
    selectWallet:        'Select Wallet',
    fcWalletName:        'Farcaster Wallet',
    fcWalletSub:         'Built-in',
    noWallets:           'No wallets detected. Install Rabby or MetaMask and reload.',
    walletCancel:        'Cancel',
    cleared:             'CLEARED',
    bossLabel:           'BOSS',
    specialLabel:        'SPECIAL',
  },
  ja: {
    miniGame:            'ミニゲーム',
    tagline1:            'オレンジのペグを全部消せ。',
    tagline2:            'ドラッグで狙いを定め、離して発射。',
    startPlaying:        'スタート',
    levelLabel:          'レベル',
    targetsLabel:        '残りペグ',
    shotsLabel:          '残弾',
    scoreLabel:          'スコア',
    paused:              '一時停止',
    resume:              '再開',
    retire:              'リタイア',
    confirmRetireText:   '本当にリタイアしますか？',
    confirmRetireSub:    '現在のスコアを記録できます。',
    retireConfirm:       'リタイア',
    cancel:              'キャンセル',
    gameOver:            'ゲームオーバー',
    retiredLabel:        'リタイア',
    levelSummary:        (ret: boolean, lv: number, left: number) =>
      `レベル${lv}${ret ? 'でリタイア' : '到達'} - 残り${left}ペグ`,
    playAgain:           'もう一度',
    share:               'シェア',
    scoreZero:           'スコア0はオンチェーンに記録できません。',
    connectWallet:       'ウォレット接続',
    connecting:          '接続中...',
    recordOnChain:       'オンチェーンに記録',
    recording:           '記録中...',
    failedRetry:         '失敗 - 再試行',
    disconnect:          '切断',
    scoreRecorded:       'Baseにスコアを記録しました',
    viewOnBasescan:      'Basescanで確認',
    selectWallet:        'ウォレット選択',
    fcWalletName:        'Farcasterウォレット',
    fcWalletSub:         '内蔵',
    noWallets:           'ウォレットが見つかりません。RabbyまたはMetaMaskをインストールしてリロードしてください。',
    walletCancel:        'キャンセル',
    cleared:             'クリア！',
    bossLabel:           'ボス',
    specialLabel:        'スペシャル',
  },
} as const;

// ─── Component ────────────────────────────────────────────────────────────────
export function DotShotGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const rafRef    = useRef(0);

  const G = useRef<GameState>({
    phase: 'idle', prePausePhase: 'aiming',
    pegs: [], bumpers: [],
    balls: [],
    burstRemaining: 0, burstTimer: 0, burstAngle: 0, burstLuckyIdx: 0, burstBucketProb: BUCKET_BALL_PROB, bossRefillLeft: 0,
    shotsLeft: SHOTS_START, score: 0, level: 1,
    aimAngle: 0,
    bursts: [], pegBreaks: [],
    bgDots: [], bgClusterTimer: 0,
    frame: 0,
    W: 390, H: 780,
    launcherX: 195, launcherY: 60,
    bucketX: 155, bucketDir: 1,
    bucketW: BUCKET_W, bucketSpd: BUCKET_SPD,
    windForce: 0, windRange: 390, windCenter: 195, windRectY0: 0, windRectY1: 0,
    warpWalls: false,
    gravZones: [],
    wormholes: [],
    comets: [],
    lenses: [],
    pulsars: [],
    gravWaves: [],
    vacuums: [],
    whiteHoles: [],
    magnetars: [],
    roguePlanets: [],
    quasarJets: [],
    microBHs: [],
    darkHalos: [],
    ergospheres: [],
    magReconnections: [],
    preSupernovae: [],
    cmeActive: false, cmePeriod: 0, cmeTimer: 0, cmeY: -1,
    rng: () => 0,
    levelClearTimer: 0,
    orangeLeft: 0,
    bucketGlowTimer: 0,
    bucketFlashTimer: 0,
    burstTime: 0,
    fogActive: false,
    fogRevealTimer: 0,
    fogAlpha: 0,
    fogClouds: [],
    lightningArcs: [],
    wallSegments: [],
    boss: null,
  });

  const preventNextFire = useRef(false);

  const [phase,      setPhase]      = useState<Phase>('idle');
  const [shotsLeft,  setShotsLeft]  = useState(SHOTS_START);
  const [score,      setScore]      = useState(0);
  const [level,      setLevel]      = useState(1);
  const [orangeLeft, setOrangeLeft] = useState(0);
  const [warpWalls,  setWarpWalls]  = useState(false);
  const [retired,       setRetired]       = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const [txState,    setTxState]    = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txHash,     setTxHash]     = useState<string | null>(null);
  const [walletAddress,    setWalletAddress]    = useState<string | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [showWalletModal,  setShowWalletModal]  = useState(false);
  const [detectedWallets,  setDetectedWallets]  = useState<EIP6963Wallet[]>([]);
  const [inFarcaster,      setInFarcaster]      = useState(false);
  const [lang,             setLang]             = useState<'en' | 'ja'>('en');
  const [speed,            setSpeed]            = useState<1|2|3>(1);
  const [refillPopup,      setRefillPopup]      = useState<{ n: number; key: number } | null>(null);
  const selectedProviderRef = useRef<Eip1193Provider | null>(null);
  const t = LANGS[lang];

  // ── Size sync ────────────────────────────────────────────────────────────
  const syncSize = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const W = el.clientWidth  || 390;
    const H = el.clientHeight || 780;
    const g = G.current;
    g.W = W; g.H = H;
    g.launcherX = W / 2;
    g.launcherY = H * 0.08;
    g.bucketX   = Math.min(g.bucketX, W - g.bucketW);
  }, []);

  // ── Init level ───────────────────────────────────────────────────────────
  const initLevel = useCallback((lv: number) => {
    const g = G.current;
    const { pegs, orangeTotal, bumpers, gravZones, wormholes, wallSegments, boss, comets, lenses, cme, pulsars, gravWaves, vacuums, whiteHoles, magnetars, roguePlanets, quasarJets, microBHs, darkHalos, ergospheres, magReconnections, preSupernovae } = generateLevel(g.W, g.H, g.launcherY, g.rng, lv);
    g.level          = lv;
    g.pegs           = pegs;
    g.boss           = boss;
    g.bumpers        = bumpers;
    g.orangeLeft     = orangeTotal;
    g.balls          = [];
    g.burstRemaining = 0;
    g.burstTimer     = 0;
    g.bursts         = [];
    g.pegBreaks      = [];
    g.phase          = 'aiming';
    g.levelClearTimer = 0;
    g.bucketGlowTimer = 0;
    g.bucketFlashTimer = 0;
    g.burstTime = 0;
    g.bucketW   = Math.max(40, BUCKET_W - (lv - 1) * 5);
    g.bucketSpd = Math.min(3.5, BUCKET_SPD + (lv - 1) * 0.2);
    g.bucketX   = g.W / 2 - g.bucketW / 2;
    g.gravZones    = gravZones;
    g.wormholes    = wormholes;
    g.wallSegments = wallSegments;
    g.comets       = comets;
    g.lenses       = lenses;
    g.pulsars      = pulsars;
    g.gravWaves    = gravWaves;
    g.vacuums      = vacuums;
    g.whiteHoles   = whiteHoles;
    g.magnetars    = magnetars;
    g.roguePlanets = roguePlanets;
    g.quasarJets   = quasarJets;
    g.microBHs     = microBHs;
    g.darkHalos    = darkHalos;
    g.ergospheres  = ergospheres;
    g.magReconnections = magReconnections;
    g.preSupernovae = preSupernovae;
    g.cmeActive    = cme.active;
    g.cmePeriod    = cme.period;
    g.cmeTimer     = cme.period;
    g.cmeY         = -1;
    g.lightningArcs = [];
    // Fog gimmick: from Lv17+, probability ramps with level; forced on boss levels.
    // Always consume one rng() so the layout stream stays stable regardless of branch.
    const fogRoll = g.rng();
    const fogProb = Math.min(0.7, 0.35 + Math.max(0, lv - 17) * 0.03);
    g.fogActive      = lv >= 17 && (specialKind(lv) === 'boss' || fogRoll < fogProb);
    g.fogRevealTimer = g.fogActive ? 90 : 0;
    g.fogAlpha       = 0;
    if (g.fogActive) {
      const fogTop = Math.round(g.launcherY + 24);
      const areaH  = g.H - fogTop;
      const bufW   = g.W + 200;
      const count  = 20 + Math.round(Math.random() * 8); // 20-28 clouds
      g.fogClouds  = Array.from({ length: count }, () => {
        const numDots = 5 + Math.round(Math.random() * 5); // 5-10 blobs per cloud
        const dots: FogCloudDot[] = [{ dx: 0, dy: 0, r: 45 + Math.random() * 30 }]; // larger base
        for (let di = 1; di < numDots; di++) {
          const par   = dots[Math.floor(Math.random() * dots.length)];
          const angle = Math.random() * Math.PI * 2;
          const r     = 32 + Math.random() * 32; // 32-64px
          const dist  = (par.r + r) * (0.40 + Math.random() * 0.45);
          dots.push({ dx: par.dx + Math.cos(angle) * dist, dy: par.dy + Math.sin(angle) * dist * 0.55, r });
        }
        // Pre-bake noise positions: rejection-sample inside blob shapes
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const d of dots) {
          minX = Math.min(minX, d.dx - d.r); maxX = Math.max(maxX, d.dx + d.r);
          minY = Math.min(minY, d.dy - d.r); maxY = Math.max(maxY, d.dy + d.r);
        }
        const bboxW = maxX - minX, bboxH = maxY - minY;
        // pre-sort 180 noise points into 3 colour tiers so render can batch by tier (3 state-changes per cloud)
        const noiseTarget = 180;
        const t0: [number, number][] = [], t1: [number, number][] = [], t2: [number, number][] = [];
        for (let attempt = 0; attempt < noiseTarget * 10 && (t0.length + t1.length + t2.length) < noiseTarget; attempt++) {
          const px = minX + Math.random() * bboxW;
          const py = minY + Math.random() * bboxH;
          for (const d of dots) {
            const ex = px - d.dx, ey = py - d.dy;
            if (ex * ex + ey * ey < d.r * d.r) {
              const nt = Math.random();
              if (nt > 0.68) t2.push([px, py]);
              else if (nt > 0.36) t1.push([px, py]);
              else t0.push([px, py]);
              break;
            }
          }
        }
        return {
          bx:   Math.random() * bufW,
          by:   fogTop + 0.02 * areaH + Math.random() * 0.96 * areaH,
          spd:  (Math.random() < 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.38),
          alpha: 0.25 + Math.random() * 0.75,
          dots,
          noiseTiers: [t0, t1, t2],
        };
      });
    } else {
      g.fogClouds = [];
    }
    g.warpWalls = lv <= 2 ? false : g.rng() < 0.5;
    // Loop walls wrap balls around the edges, so partial wall gimmicks (warp/distort/
    // vanish segments) have no effect there — drop them to avoid dead/confusing visuals.
    if (g.warpWalls) g.wallSegments = [];
    // Wind is now a per-level chance (rises with level), so some levels are calm.
    // The whether-wind decision uses Math.random; the level's peg/hazard layout is
    // already fixed here (wind is set after generateLevel), so g.rng isn't perturbed.
    const windProb = Math.min(0.75, 0.35 + (lv - 4) * 0.025);
    if (lv >= 4 && Math.random() < windProb) {
      const dir      = lv % 2 === 0 ? 1 : -1;
      const isNarrow = Math.random() < 0.5;
      const base     = lv >= 12 ? WIND_STORM : Math.min(WIND_MAX, (lv - 3) * 0.003);
      if (isNarrow) {
        const narrowW    = Math.round(g.W * WIND_NARROW_FRAC);
        g.windForce  = base * WIND_NARROW_MULT * dir;
        g.windRange  = narrowW;
        g.windCenter = Math.round(narrowW / 2 + g.rng() * (g.W - narrowW));
        // Random rectangle for dust: 30-55% of play area height, random vertical position
        const playTop = Math.round(g.H * 0.08 + 16);
        const playH   = g.H - playTop;
        const rectH   = Math.round(playH * (0.30 + g.rng() * 0.25));
        g.windRectY0  = playTop + Math.round(g.rng() * (playH - rectH));
        g.windRectY1  = g.windRectY0 + rectH;
      } else {
        g.windForce  = base * dir;
        g.windRange  = g.W;
        g.windCenter = Math.round(g.W / 2);
        g.windRectY0 = 0; g.windRectY1 = 0;
      }
    } else {
      g.windForce  = 0;
      g.windRange  = g.W;
      g.windCenter = Math.round(g.W / 2);
      g.windRectY0 = 0; g.windRectY1 = 0;
    }
    setLevel(lv);
    setOrangeLeft(orangeTotal);
    setWarpWalls(g.warpWalls);
    setPhase('aiming');
  }, []);

  // ── Start game ───────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    syncSize();
    const g = G.current;
    g.rng       = makeRng(Date.now());
    if (g.bgDots.length === 0) g.bgDots = initBgDots(g.W, g.H);
    g.shotsLeft = SHOTS_START;
    g.score     = 0;
    g.bucketDir = 1;
    setShotsLeft(SHOTS_START);
    setScore(0);
    setRetired(false);
    setConfirmRetire(false);
    setTxState('idle');
    setTxHash(null);
    preventNextFire.current = true; // block the pointerUp that follows this tap
    initLevel(1);
  }, [syncSize, initLevel]);

  // ── Pause / Resume ───────────────────────────────────────────────────────
  const handlePause = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'aiming' && g.phase !== 'firing') return;
    g.prePausePhase = g.phase;
    g.phase = 'paused';
    setPhase('paused');
  }, []);

  const handleResume = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'paused') return;
    setConfirmRetire(false);
    g.phase = g.prePausePhase;
    setPhase(g.prePausePhase);
  }, []);

  // ── Retire (only from pause menu) ────────────────────────────────────────
  const handleRetire = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'paused') return;
    g.balls = [];
    g.burstRemaining = 0;
    g.phase = 'gameover';
    setConfirmRetire(false);
    setRetired(true);
    setPhase('gameover');
  }, []);

  // ── Start burst ───────────────────────────────────────────────────────────
  const fireBall = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'aiming' || g.shotsLeft <= 0) return;
    // Boss re-armor happens ONLY when the player fires the next shot (not on a timer).
    const b = g.boss;
    if (b && b.hp > 0) {
      const enraged  = b.hp <= b.maxHp * 0.30;
      const armorHp  = b.tier >= 3 ? 3 : SHIELD_HP;
      const restoreN = (b.tier >= 3 ? 2 : 1) + (enraged ? 1 : 0);
      const downed = g.pegs.filter(p => p.bossArmor && p.cleared);
      let restored = 0;
      for (let k = 0; k < restoreN && downed.length > 0; k++) {
        const idx = Math.floor(Math.random() * downed.length);
        const tpeg = downed[idx]; downed.splice(idx, 1);
        tpeg.cleared = false; tpeg.hp = armorHp; tpeg.hitCool = 0; restored++;
        if (tpeg.armorAngle !== undefined) {
          tpeg.x = b.x + Math.cos(tpeg.armorAngle) * b.armorR;
          tpeg.y = b.y + Math.sin(tpeg.armorAngle) * b.armorR;
        }
      }
      if (restored > 0) b.rearmFlash = 18;
    }
    // Dynamic refill throttle (hidden): fewer bucket balls when you're flush.
    const f = refillFactor(g.level, g.shotsLeft);
    g.burstBucketProb = BUCKET_BALL_PROB * f;
    g.burstLuckyIdx   = f >= 0.6 ? Math.floor(Math.random() * BALLS_PER_SHOT) : -1; // guaranteed catch only when low-ish
    g.bossRefillLeft  = 3; // boss armor breaks can refill up to +3 this volley
    g.burstAngle     = g.aimAngle;
    g.burstRemaining = BALLS_PER_SHOT;
    g.burstTimer     = 0; // launch first ball immediately
    g.burstTime      = 0;
    g.shotsLeft--;
    g.phase = 'firing';
    setShotsLeft(g.shotsLeft);
    setPhase('firing');
  }, []);

  // Boss gimmick: breaking a boss-armor shield refills a shot, capped at 3/volley.
  const armorRefill = useCallback(() => {
    const g = G.current;
    if (g.bossRefillLeft <= 0) return;
    g.bossRefillLeft--;
    g.shotsLeft++;
    setShotsLeft(g.shotsLeft);
    setRefillPopup({ n: 1, key: g.frame });
  }, []);

  // ── Update aim angle from pointer position ────────────────────────────────
  const updateAim = useCallback((clientX: number, clientY: number, rect: DOMRect) => {
    const g  = G.current;
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const raw = Math.atan2(px - g.launcherX, py - g.launcherY);
    // clamp to ±82° from vertical; always fires downward
    g.aimAngle = Math.max(-1.43, Math.min(1.43, raw));
  }, []);

  // ── Pointer events ───────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (G.current.phase !== 'aiming') return;
    updateAim(e.clientX, e.clientY, (e.currentTarget as HTMLElement).getBoundingClientRect());
  }, [updateAim]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (g.phase === 'idle') { startGame(); return; }
    if (g.phase === 'aiming') {
      updateAim(e.clientX, e.clientY, (e.currentTarget as HTMLElement).getBoundingClientRect());
    }
  }, [startGame, updateAim]);

  const handlePointerUp = useCallback(() => {
    // Discard the pointerUp that follows game-start to prevent instant firing
    if (preventNextFire.current) { preventNextFire.current = false; return; }
    if (G.current.phase === 'aiming') fireBall();
  }, [fireBall]);

  // ── Render loop ──────────────────────────────────────────────────────────
  const loopFnRef = useRef<() => void>(() => {});
  const speedRef  = useRef<1|2|3>(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // alpha:false — every rendered frame paints the full canvas opaque cream first and the
    // wrapper div behind it is the same cream, so an opaque backing store is safe and lets the
    // browser skip alpha compositing of the canvas layer. Invariant: loop() must always run the
    // background fill before returning, or the opaque store would expose black instead of cream.
    // Cache once — getContext per frame is wasteful.
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    // An opaque backing store defaults to black; paint it cream before the first rAF so the
    // stretched canvas never flashes black between mount and the first loop() frame.
    ctx.fillStyle = '#ede9df';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loop = () => {
      const g = G.current;

      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== g.W * dpr || canvas.height !== g.H * dpr) {
        canvas.width  = g.W * dpr;
        canvas.height = g.H * dpr;
        ctx.scale(dpr, dpr);
      }
      const steps = (g.phase === 'aiming' || g.phase === 'firing') ? speedRef.current : 1;
      for (let _step = 0; _step < steps; _step++) {
      const { W, H, launcherX, launcherY } = g;
      g.frame++;

      // ── Background fill ──────────────────────────────────────────────────
      ctx.fillStyle = '#ede9df';
      ctx.fillRect(0, 0, W, H);

      // ── Background floating dot clusters ─────────────────────────────────
      if (g.phase !== 'idle') {
        g.bgClusterTimer--;
        if (g.bgClusterTimer <= 0 && g.bgDots.length < 300) {
          g.bgClusterTimer = 55 + Math.floor(Math.random() * 70);
          const cx = 60 + Math.random() * (W - 120);
          const cy = 60 + Math.random() * (H - 120);
          g.bgDots.push(...spawnBgCluster(W, H, cx, cy, 10 + Math.floor(Math.random() * 10)));
        }
      }
      ctx.fillStyle = '#0f0f0d';
      const bg = g.bgDots;
      for (let bi = 0; bi < bg.length; bi++) {
        const d = bg[bi];
        d.age++; d.x += d.vx; d.y += d.vy;
        if (d.x < -8)    d.x = W + 4;
        if (d.x > W + 8) d.x = -4;
        if (d.y < -8)    d.y = H + 4;
        if (d.y > H + 8) d.y = -4;
        const p = d.age / d.maxAge;
        if (p < 0.15)      d.alpha = Math.min(d.targetAlpha, d.alpha + d.targetAlpha / (d.maxAge * 0.15));
        else if (p > 0.75) d.alpha = Math.max(0, d.alpha - d.targetAlpha / (d.maxAge * 0.25));
        ctx.globalAlpha = d.alpha;
        ctx.fillRect(Math.round(d.x), Math.round(d.y), d.size, d.size);
        if (d.age >= d.maxAge) bg[bi] = spawnBgDot(W, H); // replace in place, no per-frame realloc
      }
      ctx.globalAlpha = 1;

      if (g.phase === 'idle') break;

      // ── Wall indicators ──────────────────────────────────────────────────
      if (!g.warpWalls) {
        ctx.save();
        ctx.strokeStyle = 'rgba(15,15,13,0.28)';
        ctx.lineWidth   = 2;
        ctx.setLineDash([6, 8]);
        ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(1, H);    ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W - 1, 0); ctx.lineTo(W - 1, H); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── Bumpers ───────────────────────────────────────────────────────────
      for (const bumper of g.bumpers) {
        if (bumper.angularVel) bumper.angle += bumper.angularVel;
        if (bumper.hitFlash > 0) bumper.hitFlash--;
        if (bumper.hitCool  > 0) bumper.hitCool--;

        if (bumper.hitFlash > 0) {
          const t      = bumper.hitFlash / BUMPER_FLASH;
          const pulse  = 0.5 + Math.abs(Math.sin(g.frame * 0.6)) * 0.5;
          const hitIdx = bumper.hitCount % FLASH_COLORS.length;
          const color1 = FLASH_COLORS[hitIdx];
          const color2 = FLASH_COLORS[(hitIdx + 1) % FLASH_COLORS.length];
          const cos    = Math.cos(bumper.angle), sin = Math.sin(bumper.angle);

          // Soft bloom: draw each dot 3× at expanding sizes with fading alpha
          // outer pass uses complementary color for two-tone glow
          const bloomPasses = [
            { extra: 4, aFactor: 0.15, color: color2 },
            { extra: 2, aFactor: 0.28, color: color1 },
            { extra: 1, aFactor: 0.52, color: color1 },
          ] as const;
          const sA = Math.sin(g.frame * 0.038), cA = Math.cos(g.frame * 0.038);
          const sB = Math.sin(g.frame * 0.031), cB = Math.cos(g.frame * 0.031);
          for (const pass of bloomPasses) {
            ctx.fillStyle = pass.color;
            for (const d of bumper.dots) {
              const jx = (sA * d.cosP  + cA * d.sinP)  * 0.55;
              const jy = (cB * d.cosP2 - sB * d.sinP2) * 0.55;
              const rx = (d.x + jx) * cos - (d.y + jy) * sin;
              const ry = (d.x + jx) * sin + (d.y + jy) * cos;
              const sz = d.size + pass.extra;
              ctx.globalAlpha = d.alpha * t * pulse * pass.aFactor;
              ctx.fillRect(Math.round(bumper.cx + rx - sz * 0.5),
                           Math.round(bumper.cy + ry - sz * 0.5), sz, sz);
            }
          }
          ctx.globalAlpha = 1;

          // Core dots in flash color
          drawDots(ctx, bumper.dots, bumper.cx, bumper.cy, bumper.angle, g.frame, color1, 1.0);
        } else {
          drawDots(ctx, bumper.dots, bumper.cx, bumper.cy, bumper.angle, g.frame, '#0f0f0d', 1.0);
        }
      }

      // ── Boss update: movement, re-armor, enrage (scales with boss tier) ──────
      if (g.boss && g.boss.hp > 0 && (g.phase === 'aiming' || g.phase === 'firing')) {
        const b = g.boss;
        if (b.hitFlash   > 0) b.hitFlash--;
        if (b.hitCool    > 0) b.hitCool--;
        if (b.rearmFlash > 0) b.rearmFlash--;
        const enraged = b.hp <= b.maxHp * 0.30;
        // Movement (tier 2+): drift horizontally, faster when enraged; armor follows.
        if (b.vx !== 0) {
          b.x += b.vx * (enraged ? 1.5 : 1);
          if (b.x <= b.moveMinX) { b.x = b.moveMinX; b.vx =  Math.abs(b.vx); }
          if (b.x >= b.moveMaxX) { b.x = b.moveMaxX; b.vx = -Math.abs(b.vx); }
          for (const p of g.pegs) {
            if (!p.bossArmor || p.armorAngle === undefined) continue;
            p.x = b.x + Math.cos(p.armorAngle) * b.armorR;
            p.y = b.y + Math.sin(p.armorAngle) * b.armorR;
          }
        }
        // Re-armor itself is triggered on fire (see fireBall), not on a timer.
      }

      // ── Grav zones (black hole, swirling sand storm) ─────────────────────
      for (const zone of g.gravZones) {
        if (zone.flashTimer > 0) zone.flashTimer--;
        const cx      = zone.x + zone.w / 2;
        const cy      = zone.y + zone.h / 2;
        const maxR    = zone.h * 1.55;
        const bhRange = zone.h * BH_PULL_RANGE_FACTOR; // physics pull radius
        const bh      = getBHTables(zone, cx, cy, maxR, bhRange);

        // ── Influence range ring: sparse dots at physics pull boundary ──────
        {
          const pulse = 0.14 + Math.sin(g.frame * 0.07) * 0.06;
          const s11 = Math.sin(g.frame * 0.11), c11 = Math.cos(g.frame * 0.11);
          ctx.fillStyle = '#440011';
          for (let i = 0; i < 48; i++) {
            ctx.globalAlpha = pulse * (0.7 + (s11 * bh.infAlC[i] + c11 * bh.infAlS[i]) * 0.3);
            ctx.fillRect(bh.infX[i], bh.infY[i], 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        const t       = g.frame * 0.010; // very slow base rotation
        const f       = g.frame;         // shorthand for wobble phases
        const flicker = 0.80 + Math.sin(f * 0.19) * 0.20;

        // ── Sand veil A: outer fibonacci dust (360 grains) + wobble ──────────
        {
          const va = bh.veilA;
          const sW = Math.sin(t * 0.18),  cW = Math.cos(t * 0.18);
          const s1 = Math.sin(f * 0.053), c1 = Math.cos(f * 0.053);
          const s2 = Math.sin(f * 0.047), c2 = Math.cos(f * 0.047);
          const sT = Math.sin(t * 0.07),  cT = Math.cos(t * 0.07);
          for (let i = 0; i < 360; i++) {
            const r = va.rBase[i] * (0.91 + (sW * va.wobC[i] + cW * va.wobS[i]) * 0.09);
            if (r > maxR * 1.04) continue;
            const angle = va.a0![i] + t * va.aK![i];
            const wx    = (s1 * va.w1C[i] + c1 * va.w1S[i]) * 3.5;
            const wy    = (c2 * va.w2C[i] - s2 * va.w2S[i]) * 3.5;
            ctx.globalAlpha = flicker * va.aB[i] * (0.32 + (sT * va.alC[i] + cT * va.alS[i]) * 0.14);
            ctx.fillStyle   = va.color[i];
            ctx.fillRect(Math.round(cx + Math.cos(angle) * r + wx), Math.round(cy + Math.sin(angle) * r + wy), 1, 1);
          }
        }

        // ── Sand veil B: second offset dust cloud (240 grains) + wobble ──────
        {
          const vb = bh.veilB;
          const sW = Math.sin(t * 0.14),  cW = Math.cos(t * 0.14);
          const s1 = Math.sin(f * 0.061), c1 = Math.cos(f * 0.061);
          const s2 = Math.sin(f * 0.044), c2 = Math.cos(f * 0.044);
          const sT = Math.sin(t * 0.09),  cT = Math.cos(t * 0.09);
          for (let i = 0; i < 240; i++) {
            const r = vb.rBase[i] * (0.89 + (sW * vb.wobC[i] + cW * vb.wobS[i]) * 0.11);
            if (r > maxR * 1.02) continue;
            const angle = vb.a0![i] + t * vb.aK![i] + Math.PI;
            const wx    = (s1 * vb.w1C[i] + c1 * vb.w1S[i]) * 2.8;
            const wy    = (c2 * vb.w2C[i] - s2 * vb.w2S[i]) * 2.8;
            ctx.globalAlpha = flicker * vb.aB[i] * (0.22 + (sT * vb.alC[i] + cT * vb.alS[i]) * 0.10);
            ctx.fillStyle   = vb.color[i];
            ctx.fillRect(Math.round(cx + Math.cos(angle) * r + wx), Math.round(cy + Math.sin(angle) * r + wy), 1, 1);
          }
        }

        // ── Inner storm A: counter-spiral (280 grains) + wobble ───────────────
        {
          const sa = bh.stormA;
          const sW = Math.sin(t * 0.24),  cW = Math.cos(t * 0.24);
          const sR = Math.sin(t * 1.4),   cR = Math.cos(t * 1.4);
          const s1 = Math.sin(f * 0.058), c1 = Math.cos(f * 0.058);
          const s2 = Math.sin(f * 0.051), c2 = Math.cos(f * 0.051);
          const sT = Math.sin(t * 0.12),  cT = Math.cos(t * 0.12);
          for (let i = 0; i < 280; i++) {
            const r  = sa.rBase[i] * (0.87 + (sW * sa.wobC[i] + cW * sa.wobS[i]) * 0.13);
            const ca = sa.a0C![i] * cR + sa.a0S![i] * sR; // cos(a0 - t*1.4)
            const sn = sa.a0S![i] * cR - sa.a0C![i] * sR; // sin(a0 - t*1.4)
            const wx = (s1 * sa.w1C[i] + c1 * sa.w1S[i]) * 2.5;
            const wy = (c2 * sa.w2C[i] - s2 * sa.w2S[i]) * 2.5;
            const sz = sa.sz![i], half = sz >> 1;
            ctx.globalAlpha = flicker * sa.aB[i] * (0.60 + (sT * sa.alC[i] + cT * sa.alS[i]) * 0.24);
            ctx.fillStyle   = sa.color[i];
            ctx.fillRect(Math.round(cx + ca * r + wx) - half, Math.round(cy + sn * r + wy) - half, sz, sz);
          }
        }

        // ── Inner storm B: clockwise fast layer (180 grains) + wobble ─────────
        {
          const sb = bh.stormB;
          const sW = Math.sin(t * 0.30),  cW = Math.cos(t * 0.30);
          const sR = Math.sin(t * 2.1),   cR = Math.cos(t * 2.1);
          const s1 = Math.sin(f * 0.067), c1 = Math.cos(f * 0.067);
          const s2 = Math.sin(f * 0.055), c2 = Math.cos(f * 0.055);
          const sT = Math.sin(t * 0.16),  cT = Math.cos(t * 0.16);
          for (let i = 0; i < 180; i++) {
            const r  = sb.rBase[i] * (0.90 + (sW * sb.wobC[i] + cW * sb.wobS[i]) * 0.10);
            const ca = sb.a0C![i] * cR - sb.a0S![i] * sR; // cos(a0 + t*2.1)
            const sn = sb.a0S![i] * cR + sb.a0C![i] * sR; // sin(a0 + t*2.1)
            const wx = (s1 * sb.w1C[i] + c1 * sb.w1S[i]) * 2.2;
            const wy = (c2 * sb.w2C[i] - s2 * sb.w2S[i]) * 2.2;
            ctx.globalAlpha = flicker * sb.aB[i] * (0.45 + (sT * sb.alC[i] + cT * sb.alS[i]) * 0.18);
            ctx.fillStyle   = sb.color[i];
            ctx.fillRect(Math.round(cx + ca * r + wx), Math.round(cy + sn * r + wy), 1, 1);
          }
        }

        ctx.globalAlpha = 1;

        // ── Halo rings (original 11 rings) — static, non-rotating ────────────
        for (const ring of bh.halo) {
          const alpha = flicker * 0.88 * ring.powV;
          if (alpha < 0.02) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle   = ring.color;
          const { xs, ys, sz } = ring;
          for (let j = 0; j < xs.length; j++) ctx.fillRect(xs[j], ys[j], sz, sz);
        }

        // ── 4 spiral arms (90 dots/arm) + wobble jitter ───────────────────────
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t);
        {
          const am = bh.arm;
          const sJ = Math.sin(t * 0.28),  cJ = Math.cos(t * 0.28);
          const s1 = Math.sin(f * 0.053), c1 = Math.cos(f * 0.053);
          const sK = Math.sin(t * 0.23),  cK = Math.cos(t * 0.23);
          const s2 = Math.sin(f * 0.047), c2 = Math.cos(f * 0.047);
          for (let arm = 0; arm < 4; arm++) {
            ctx.rotate(Math.PI / 2);
            for (let i = 0; i < 90; i++) {
              const idx = arm * 90 + i;
              const jx = (sJ * am.j1C[idx] + cJ * am.j1S[idx]) * 4.0 + (s1 * am.j2C[idx] + c1 * am.j2S[idx]) * 4.0;
              const jy = (cK * am.k1C[idx] - sK * am.k1S[idx]) * 3.5 + (c2 * am.k2C[idx] - s2 * am.k2S[idx]) * 4.0;
              const sz = am.sz[idx];
              ctx.globalAlpha = am.aB[idx] * flicker;
              ctx.fillStyle   = am.color[idx];
              ctx.fillRect(Math.round(am.bx[idx] + jx) - (sz >> 1), Math.round(am.by[idx] + jy) - (sz >> 1), sz, sz);
            }
          }
        }
        ctx.restore();

        // ── 16 outer tendrils (36 dots each) + wobble ─────────────────────────
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-t * 1.95);
        {
          const tn = bh.ten;
          const sJ = Math.sin(t * 0.38),  cJ = Math.cos(t * 0.38);
          const s1 = Math.sin(f * 0.059), c1 = Math.cos(f * 0.059);
          const sW = Math.sin(f * 0.043), cW = Math.cos(f * 0.043);
          for (let i = 0; i < 16; i++) {
            ctx.rotate(Math.PI / 8);
            for (let j = 0; j < 36; j++) {
              const idx = i * 36 + j;
              const jitter   = (sJ * tn.j1C[idx] + cJ * tn.j1S[idx]) * 3.5
                             + (s1 * tn.j2C[idx] + c1 * tn.j2S[idx]) * 3.0;
              const wobAlong = Math.round((cW * tn.wC[idx] - sW * tn.wS[idx]) * 2.5);
              ctx.globalAlpha = tn.aB[idx] * flicker;
              ctx.fillStyle   = tn.color[idx];
              ctx.fillRect(tn.x0[idx] + wobAlong, Math.round(jitter), 1, 1);
            }
          }
        }
        ctx.restore();

        // ── 5 counter-rotating rings (48–112 dots) + wobble ───────────────────
        {
          const s1 = Math.sin(f * 0.053), c1 = Math.cos(f * 0.053);
          const s2 = Math.sin(f * 0.047), c2 = Math.cos(f * 0.047);
          const sT = Math.sin(f * 0.09),  cT = Math.cos(f * 0.09);
          for (const ring of bh.rings) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-t * ring.spd);
            ctx.fillStyle = ring.color;
            const dotN = ring.bx.length;
            for (let i = 0; i < dotN; i++) {
              const wx = (s1 * ring.w1C[i] + c1 * ring.w1S[i]) * 2.5;
              const wy = (c2 * ring.w2C[i] - s2 * ring.w2S[i]) * 2.5;
              ctx.globalAlpha = flicker * (0.26 + (sT * ring.alC[i] + cT * ring.alS[i]) * 0.16);
              ctx.fillRect(Math.round(ring.bx[i] + wx) - 1, Math.round(ring.by[i] + wy) - 1, 2, 2);
            }
            ctx.restore();
          }
        }

        // ── Event horizon: solid near-black disc (smaller) ────────────────
        ctx.fillStyle = '#080004';
        for (const run of bh.horizon) {
          ctx.globalAlpha = run.alpha;
          const { xs, ys } = run;
          for (let j = 0; j < xs.length; j++) ctx.fillRect(xs[j], ys[j], 2, 2);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);

        // ── Accretion ring: triple-pass blood-red ─────────────────────────
        {
          const accPulse = (0.72 + Math.sin(g.frame * 0.11) * 0.28) * flicker;
          const s13 = Math.sin(g.frame * 0.13), c13 = Math.cos(g.frame * 0.13);
          for (const pass of bh.acc) {
            ctx.fillStyle = pass.color;
            const dotN = pass.xs.length;
            for (let i = 0; i < dotN; i++) {
              ctx.globalAlpha = accPulse * pass.factor * (0.68 + (s13 * pass.alC[i] + c13 * pass.alS[i]) * 0.32);
              ctx.fillRect(pass.xs[i], pass.ys[i], 2, 2);
            }
          }
        }
        // ── Purple flash on ball absorption ───────────────────────────────
        if (zone.flashTimer > 0) {
          const ft  = zone.flashTimer / 36; // 1→0 as it fades
          const exp = 1 - ft;               // 0→1 expansion progress

          // Expanding shockwave ring (grows from centre outward)
          const waveR = bhRange * exp * 0.82;
          const waveA = Math.min(1, ft < 0.35 ? ft * 2.5 : ft * 0.95);
          ctx.fillStyle = '#cc88ff';
          for (let i = 0; i < 72; i++) {
            const a = (i / 72) * Math.PI * 2;
            ctx.globalAlpha = waveA * (0.65 + Math.sin(i * 1.7) * 0.35);
            ctx.fillRect(Math.round(cx + Math.cos(a) * waveR) - 1, Math.round(cy + Math.sin(a) * waveR) - 1, 2, 2);
          }

          // 6 static glow rings (bright → fade)
          const glowColors = ['#ffffff', '#ff99ff', '#ee44ff', '#bb22ee', '#8800bb', '#550088'] as const;
          for (let ri = 0; ri < 6; ri++) {
            const fr   = maxR * (0.09 + ri * 0.19);
            const dotN = 44 + ri * 8;
            const sz   = ri < 2 ? 3 : 2;
            ctx.fillStyle = glowColors[ri];
            for (let i = 0; i < dotN; i++) {
              const a = (i / dotN) * Math.PI * 2;
              ctx.globalAlpha = ft * (0.95 - ri * 0.09) * (0.72 + Math.sin(i * 1.7) * 0.28);
              ctx.fillRect(Math.round(cx + Math.cos(a) * fr) - (sz >> 1), Math.round(cy + Math.sin(a) * fr) - (sz >> 1), sz, sz);
            }
          }

          // Core white burst (only first ~12 frames, ft > 0.67)
          if (ft > 0.67) {
            const coreT = (ft - 0.67) / 0.33;
            ctx.fillStyle = '#ffffff';
            for (let r = 2; r <= maxR * 0.48; r += 2.5) {
              const dc = Math.max(1, Math.round(2 * Math.PI * r / 2.8));
              ctx.globalAlpha = coreT * (1 - r / (maxR * 0.48)) * 0.92;
              for (let j = 0; j < dc; j++) {
                const a = (j / dc) * Math.PI * 2;
                ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
              }
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Wormholes ────────────────────────────────────────────────────────
      for (const wh of g.wormholes) {
        wh.cycleTimer = (wh.cycleTimer + 1) % WORMHOLE_CYCLE;
        if (wh.hitCool   > 0) wh.hitCool--;
        if (wh.flashTimer > 0) wh.flashTimer--;

        const cosA = Math.cos(wh.angle), sinA = Math.sin(wh.angle);

        // ── Teleport flash (drawn even during invisible phase) ────────────
        if (wh.flashTimer > 0) {
          const ft  = wh.flashTimer / 28;  // 1→0
          const exp = 1 - ft;               // 0→1 (expansion)

          // Outer expanding oval shockwave
          const rA  = wh.w * 0.5 + 4 + exp * 42;
          const rB  = 6 + exp * 28;
          const ringCol = ft > 0.6 ? '#ffffff' : ft > 0.3 ? '#ee88ff' : '#aa33ff';
          ctx.fillStyle = ringCol;
          for (let i = 0; i < 56; i++) {
            const a  = (i / 56) * Math.PI * 2;
            const lx = Math.cos(a) * rA, ly = Math.sin(a) * rB;
            const wx = wh.cx + lx * cosA - ly * sinA;
            const wy = wh.cy + lx * sinA + ly * cosA;
            ctx.globalAlpha = ft * 0.92;
            const sz = ft > 0.55 ? 3 : 2;
            ctx.fillRect(Math.round(wx) - (sz >> 1), Math.round(wy) - (sz >> 1), sz, sz);
          }

          // Inner oval ring (white, slightly smaller)
          if (ft > 0.2) {
            const rA2 = wh.w * 0.5 + 2 + exp * 20;
            const rB2 = 3 + exp * 14;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 36; i++) {
              const a  = (i / 36) * Math.PI * 2;
              const lx = Math.cos(a) * rA2, ly = Math.sin(a) * rB2;
              const wx = wh.cx + lx * cosA - ly * sinA;
              const wy = wh.cy + lx * sinA + ly * cosA;
              ctx.globalAlpha = ((ft - 0.2) / 0.8) * 0.80;
              ctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
            }
          }

          // Core bar bright glow (dense scanline fill along the bar)
          const coreCol = ft > 0.65 ? '#ffffff' : ft > 0.35 ? '#ddaaff' : '#aa55ff';
          ctx.fillStyle = coreCol;
          const hw = wh.w * 0.5 + 3, hh = 5;
          for (let bx = -hw; bx <= hw; bx += 2.0) {
            for (let by = -hh; by <= hh; by += 2.0) {
              const wx = wh.cx + bx * cosA - by * sinA;
              const wy = wh.cy + bx * sinA + by * cosA;
              ctx.globalAlpha = ft * 0.95;
              ctx.fillRect(Math.round(wx), Math.round(wy), 1, 1);
            }
          }
          ctx.globalAlpha = 1;
        }

        const ct = wh.cycleTimer;
        if (ct >= WORMHOLE_ACTIVE) continue; // invisible phase, skip normal draw

        let fadeAlpha = 1.0;
        if (ct < WORMHOLE_FADE)
          fadeAlpha = (ct + 1) / WORMHOLE_FADE;
        else if (ct >= WORMHOLE_ACTIVE - WORMHOLE_FADE)
          fadeAlpha = (WORMHOLE_ACTIVE - ct) / WORMHOLE_FADE;

        // Aura dots (purple mowa mowa cloud) — aura cosP2/sinP2 hold cos/sin(phase*1.3)
        const sJ = Math.sin(g.frame * 0.042), cJ = Math.cos(g.frame * 0.042);
        const sK = Math.sin(g.frame * 0.037), cK = Math.cos(g.frame * 0.037);
        const sL = Math.sin(g.frame * 0.055), cL = Math.cos(g.frame * 0.055);
        for (const d of wh.auraDots) {
          const jx = (sJ * d.cosP  + cJ * d.sinP)  * 1.4;
          const jy = (cK * d.cosP2 - sK * d.sinP2) * 1.4;
          const lx = d.x + jx, ly = d.y + jy;
          const ax = wh.cx + lx * cosA - ly * sinA;
          const ay = wh.cy + lx * sinA + ly * cosA;
          const col = d.phase < 2.1 ? '#6622cc' : d.phase < 4.2 ? '#aa44ff' : '#dd88ff';
          ctx.fillStyle = col;
          ctx.globalAlpha = d.alpha * fadeAlpha * (0.6 + (sL * d.cosP + cL * d.sinP) * 0.4);
          ctx.fillRect(Math.round(ax), Math.round(ay), d.size, d.size);
        }
        ctx.globalAlpha = 1;

        // Bar dots (purple, pulsing slightly out-of-phase per pair)
        const pulse = 0.72 + Math.sin(g.frame * 0.09 + wh.pairId * Math.PI) * 0.28;
        drawDots(ctx, wh.dots, wh.cx, wh.cy, wh.angle, g.frame, '#9933ee', fadeAlpha * pulse);
      }

      // ── Wind dust (non-storm): drifting streaks across the wind zone ─────
      // Handles BOTH the narrow rectangle and full-screen wind (previously the
      // full-screen case drew nothing, making the wind nearly invisible).
      if (g.windForce !== 0 && Math.abs(g.windForce) < WIND_STORM) {
        const dir      = g.windForce > 0 ? 1 : -1;
        const isNarrow = g.windRange < g.W;
        const zOff = isNarrow ? Math.round(g.windCenter - g.windRange / 2) : 0;
        const zW   = isNarrow ? g.windRange : W;
        const yTop = isNarrow ? g.windRectY0 : Math.round(H * 0.08 + 16);
        const zH   = isNarrow ? Math.max(1, g.windRectY1 - g.windRectY0) : (H - yTop);
        const windNormF = Math.min(1, Math.abs(g.windForce) / (WIND_MAX * WIND_NARROW_MULT));
        const COUNT = isNarrow ? 80 : 130;

        // Dotted border only around the localized (narrow) zone.
        if (isNarrow) {
          ctx.fillStyle = '#7a5830';
          for (let by = yTop; by < g.windRectY1; by += 6) {
            ctx.globalAlpha = 0.30;
            ctx.fillRect(zOff,          Math.round(by), 1, 3);
            ctx.fillRect(zOff + zW - 1, Math.round(by), 1, 3);
          }
          for (let bx = zOff; bx < zOff + zW; bx += 6) {
            ctx.globalAlpha = 0.30;
            ctx.fillRect(Math.round(bx), yTop,              3, 1);
            ctx.fillRect(Math.round(bx), g.windRectY1 - 1, 3, 1);
          }
          ctx.globalAlpha = 1;
        }

        // Drifting sand streaks — length points in the wind direction (clear motion cue).
        const dsh = (n: number) => ((n * 1664525 + 1013904223) >>> 0) / 0x100000000;
        for (let i = 0; i < COUNT; i++) {
          const h1 = dsh(i * 2053);
          const h2 = dsh(i * 2053 + 7919);
          const h3 = dsh(i * 2053 + 15731);
          const h4 = dsh(i * 2053 + 23557);
          const spdBase = h4 < 0.40 ? 0.6 + h4 * 2.5 : 3.0 + h4 * 5.0;
          const spd = spdBase * (0.20 + windNormF * 0.80);
          const spX = dir * spd;
          const spY = (h3 - 0.5) * 0.45;
          const baseY = (i + h2) / COUNT * zH;
          const px = zOff + ((h1 * zW + spX * g.frame) % zW + zW) % zW;
          const py = yTop  + ((baseY   + spY * g.frame) % zH  + zH) % zH;
          const streakLen = Math.round(3 + spd * 1.4);
          const sx = dir > 0 ? Math.round(px) : Math.round(px) - streakLen;
          ctx.fillStyle   = h1 < 0.48 ? '#8a5a28' : '#b58044';
          ctx.globalAlpha = 0.40 + h2 * 0.50;
          ctx.fillRect(sx, Math.round(py), streakLen, spd > 4 ? 2 : 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Sand storm particles (level 12+, zone-aware) ─────────────────────
      if (Math.abs(g.windForce) >= WIND_STORM) {
        const dir  = g.windForce > 0 ? 1 : -1;
        const zW   = g.windRange;
        const zOff = Math.round(g.windCenter - zW / 2);
        const sh   = (n: number) => ((n * 1664525 + 1013904223) >>> 0) / 0x100000000;
        for (let i = 0; i < 65; i++) {
          const h1 = sh(i), h2 = sh(i + 1000), h3 = sh(i + 2000), h4 = sh(i + 3000);
          const spX = dir * (1.5 + h3 * 2.5);
          const spY = (h4 - 0.5) * 0.8;
          const px  = zOff + ((h1 * zW + spX * g.frame) % zW + zW) % zW;
          const py  = ((h2 * H  + spY * g.frame) % H  + H)  % H;
          ctx.fillStyle   = h1 < 0.55 ? '#907050' : '#b09270';
          ctx.globalAlpha = 0.18 + h2 * 0.32;
          ctx.fillRect(Math.round(px), Math.round(py), h3 < 0.28 ? 2 : 1, h3 < 0.28 ? 2 : 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── Chain connections (drawn beneath pegs) ───────────────────────────
      {
        const drawnChains = new Set<number>();
        for (const peg of g.pegs) {
          if (peg.cleared || peg.chainId === undefined || drawnChains.has(peg.chainId)) continue;
          drawnChains.add(peg.chainId);
          const group = g.pegs.filter(p => !p.cleared && p.chainId === peg.chainId);
          const weak  = group.find(p => p.type === 'chain-weak');
          if (!weak) continue;
          for (const node of group) {
            if (node === weak) continue;
            const dx   = node.x - weak.x, dy = node.y - weak.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const steps = Math.floor(dist / 4);
            ctx.fillStyle = '#5c2a00';
            for (let s = 3; s < steps - 3; s++) {
              if (s % 3 === 0) continue; // dashed gap
              const t = s / steps;
              ctx.globalAlpha = 0.55;
              ctx.fillRect(Math.round(weak.x + dx * t) - 1, Math.round(weak.y + dy * t) - 1, 2, 2);
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Wall segment markers ──────────────────────────────────────────────
      for (const seg of g.wallSegments) {
        if (seg.type === 'warp') {
          // Blue pulse bar
          const wPulse = 0.5 + Math.abs(Math.sin(g.frame * 0.07)) * 0.5;
          ctx.fillStyle = '#4466ff';
          for (let sy = seg.yMin; sy < seg.yMax; sy += 4) {
            ctx.globalAlpha = 0.50 * wPulse;
            ctx.fillRect(seg.side === 'left' ? 0 : W - 4, Math.round(sy), 4, 2);
          }
        } else if (seg.type === 'void') {
          // Ball-vanishing zone: red haze (モヤモヤ) — soft glow band + drifting red dots.
          const segH2  = seg.yMax - seg.yMin;
          const spread = 16;
          const isLeft = seg.side === 'left';
          const vPulse = 0.6 + Math.abs(Math.sin(g.frame * 0.06)) * 0.4;
          const glow = ctx.createLinearGradient(isLeft ? 0 : W, 0, isLeft ? spread : W - spread, 0);
          glow.addColorStop(0, `rgba(216,30,30,${(0.30 * vPulse).toFixed(3)})`);
          glow.addColorStop(1, 'rgba(216,30,30,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(isLeft ? 0 : W - spread, seg.yMin, spread, segH2);
          const msh = (n: number) => ((n * 1664525 + 1013904223) >>> 0) / 0x100000000;
          for (let i = 0; i < 34; i++) {
            const h1 = msh(i * 7 + 13);
            const h2 = msh(i * 7 + 37);
            const h3 = msh(i * 7 + 71);
            const drift = (h3 - 0.5) * 0.6;
            const py = seg.yMin + ((h2 * segH2 + drift * g.frame) % segH2 + segH2) % segH2;
            const px = isLeft ? h1 * spread : W - h1 * spread;
            ctx.fillStyle   = h1 < 0.30 ? '#ff4a4a' : h1 < 0.66 ? '#c81818' : '#7a0c0c';
            ctx.globalAlpha = (0.20 + h2 * 0.45) * vPulse;
            const sz = h3 < 0.25 ? 3 : h3 < 0.6 ? 2 : 1;
            ctx.fillRect(Math.round(px), Math.round(py), sz, sz);
          }
        } else {
          // distort: same color as normal wall (background) — invisible trap
          ctx.fillStyle = '#ede9df';
          ctx.globalAlpha = 1;
          ctx.fillRect(seg.side === 'left' ? 0 : W - 4, seg.yMin, 4, seg.yMax - seg.yMin);
        }
        ctx.globalAlpha = 1;
      }

      // ── Gravitational lenses: swirling distortion rings ──────────────────
      for (const lens of g.lenses) {
        const spin = g.frame * 0.03 * lens.dir;
        for (let ring = 0; ring < 3; ring++) {
          const rr = lens.r * (0.4 + ring * 0.28);
          const n  = Math.max(10, Math.round(2 * Math.PI * rr / 6));
          ctx.fillStyle = ring === 0 ? '#c9a8ff' : ring === 1 ? '#8a6cff' : '#5a3ca0';
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + spin * (ring + 1) * 0.5;
            ctx.globalAlpha = 0.32 + (i % 2) * 0.24;
            ctx.fillRect(Math.round(lens.x + Math.cos(a) * rr) - 1, Math.round(lens.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.fillStyle = '#e0d0ff';
        ctx.globalAlpha = 0.2 + Math.abs(Math.sin(g.frame * 0.05)) * 0.2;
        ctx.fillRect(Math.round(lens.x) - 2, Math.round(lens.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Comets: moving deflectors (update + draw) ────────────────────────
      for (const comet of g.comets) {
        if (comet.hitCool > 0) comet.hitCool--;
        // Red (vanish) comets destroy balls; blue ones deflect. Palette branches on that.
        const warnCol = comet.vanish ? '#ff5a5a' : '#8fd3f4';
        const tailA   = comet.vanish ? '#ff8a6a' : '#9fd8f5';
        const tailB   = comet.vanish ? '#d83a3a' : '#5aa9df';
        const tailC   = comet.vanish ? '#a01818' : '#3f86c4';
        const coreCol = comet.vanish ? '#a01818' : '#1e4fa0';
        const hiCol   = comet.vanish ? '#ff7a6a' : '#5aa0ff';
        // Hit ripple: a bold bright shockwave from the impact point in the comet's colour.
        if (comet.hitFlash > 0) {
          comet.hitFlash--;
          const F = 26;
          const rt = 1 - comet.hitFlash / F;                          // 0 → 1
          const baseCol   = comet.vanish ? '#ff2a2a' : '#2a86ff';
          const brightCol = comet.vanish ? '#ffe2d4' : '#eaf6ff';
          // early white-hot flash burst at the centre
          if (rt < 0.45) {
            const fa = 1 - rt / 0.45;
            ctx.fillStyle = brightCol;
            const fr = comet.r * (0.7 + rt * 1.6);
            for (let i = 0; i < 20; i++) {
              const a = (i / 20) * Math.PI * 2;
              ctx.globalAlpha = fa * 0.9;
              ctx.fillRect(Math.round(comet.hitX + Math.cos(a) * fr) - 1, Math.round(comet.hitY + Math.sin(a) * fr) - 1, 3, 3);
            }
            ctx.globalAlpha = fa;
            ctx.fillRect(Math.round(comet.hitX) - 4, Math.round(comet.hitY) - 4, 8, 8);
          }
          // bold expanding double-tone ring
          const rr = comet.r + rt * 90;
          const n  = Math.max(32, Math.round(2 * Math.PI * rr / 4.2));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
            ctx.globalAlpha = (1 - rt) * 0.95;
            ctx.fillStyle = brightCol;
            ctx.fillRect(Math.round(comet.hitX + ca * rr) - 1, Math.round(comet.hitY + sa * rr) - 1, 3, 3);
            ctx.globalAlpha = (1 - rt) * 0.7;
            ctx.fillStyle = baseCol;
            ctx.fillRect(Math.round(comet.hitX + ca * (rr - 5)) - 1, Math.round(comet.hitY + sa * (rr - 5)) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        if (comet.respawnTimer > 0) {
          comet.respawnTimer--;
          // Approach warning: telegraph the entry edge + height for the last ~40 frames.
          if (comet.respawnTimer <= 40) {
            const wpulse = 0.4 + Math.abs(Math.sin(g.frame * 0.25)) * 0.6;
            const wx  = comet.warnFromLeft ? 0 : W - 8;
            ctx.fillStyle = warnCol;
            for (let yy = comet.warnY - 16; yy <= comet.warnY + 16; yy += 3) {
              ctx.globalAlpha = wpulse * Math.max(0, 0.75 - Math.abs(yy - comet.warnY) / 40);
              ctx.fillRect(wx, Math.round(yy), 8, 2);
            }
            // inward-pointing chevron ">"
            ctx.globalAlpha = wpulse;
            const dir = comet.warnFromLeft ? 1 : -1;
            const bx  = comet.warnFromLeft ? 12 : W - 12;
            for (let k = 0; k < 5; k++) {
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(comet.warnY - k * 2) - 1, 2, 2);
              ctx.fillRect(Math.round(bx + dir * k * 3) - 1, Math.round(comet.warnY + k * 2) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
          }
          if (comet.respawnTimer === 0) {
            const spd = 2.4 + Math.min(2.6, g.level * 0.05);
            comet.x  = comet.warnFromLeft ? -30 : W + 30;
            comet.y  = comet.warnY;
            comet.vx = (comet.warnFromLeft ? 1 : -1) * spd * (0.7 + Math.random() * 0.5);
            comet.vy = (Math.random() < 0.5 ? 1 : -1) * spd * (0.3 + Math.random() * 0.4);
          }
          continue;
        }
        comet.x += comet.vx;
        comet.y += comet.vy;
        // Top/bottom bounce keeps both kinds in the play field (vy guards let a comet
        // still fly in cleanly on its first entry from off-screen).
        if (comet.y < launcherY + 40 && comet.vy < 0) comet.vy = Math.abs(comet.vy);
        if (comet.y > H - 80         && comet.vy > 0) comet.vy = -Math.abs(comet.vy);
        if (comet.vanish) {
          // Red: cross and exit, then respawn + re-telegraph (transient, less oppressive).
          if (comet.x < -60 || comet.x > W + 60) {
            comet.respawnTimer = 50 + Math.floor(Math.random() * 50);
            comet.warnFromLeft = Math.random() < 0.5;
            comet.warnY        = (launcherY + 60) + Math.random() * ((H - launcherY) * 0.45);
            continue;
          }
        } else {
          // Blue: bounce off the left/right screen edges (stays on screen).
          if (comet.x < comet.r     && comet.vx < 0) { comet.x = comet.r;     comet.vx =  Math.abs(comet.vx); }
          if (comet.x > W - comet.r && comet.vx > 0) { comet.x = W - comet.r; comet.vx = -Math.abs(comet.vx); }
        }
        const cang = Math.atan2(comet.vy, comet.vx);
        for (let ti = 1; ti <= 28; ti++) {
          const td = ti * 4;
          const tx = comet.x - Math.cos(cang) * td + (Math.random() - 0.5) * 5;
          const ty = comet.y - Math.sin(cang) * td + (Math.random() - 0.5) * 5;
          ctx.fillStyle = ti < 8 ? tailA : ti < 18 ? tailB : tailC;
          ctx.globalAlpha = (1 - ti / 29) * 0.85;
          const tsz = ti < 10 ? 4 : ti < 20 ? 3 : 2;
          ctx.fillRect(Math.round(tx) - Math.floor(tsz / 2), Math.round(ty) - Math.floor(tsz / 2), tsz, tsz);
        }
        // solid nucleus — dark-on-cream contrast makes the head clearly visible
        drawSolidCircle(ctx, comet.x, comet.y, comet.r * 0.8, coreCol);
        ctx.fillStyle = hiCol;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(Math.round(comet.x) - 4, Math.round(comet.y) - 4, 8, 8);
        ctx.fillStyle = '#eaf4ff';
        ctx.globalAlpha = 1;
        ctx.fillRect(Math.round(comet.x) - 2, Math.round(comet.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── CME: periodic top→bottom shockwave sweep (update + draw) ─────────
      if (g.cmeActive) {
        const WARN = 40, SWEEP_SPD = 8, BAND = 52;
        if (g.cmeY < 0) {
          g.cmeTimer--;
          if (g.cmeTimer <= WARN && g.cmeTimer > 0) {
            const wt = 1 - g.cmeTimer / WARN;
            ctx.fillStyle = '#ff7a1a';
            ctx.globalAlpha = (0.15 + Math.abs(Math.sin(g.frame * 0.3)) * 0.25) * wt;
            ctx.fillRect(0, launcherY + 30, W, 6);
            ctx.globalAlpha = 1;
          }
          if (g.cmeTimer <= 0) g.cmeY = launcherY + 34;
        } else {
          g.cmeY += SWEEP_SPD;
          for (let i = 0; i < 70; i++) {
            const bx = Math.random() * W;
            const by = g.cmeY - Math.random() * BAND;
            const edge = by > g.cmeY - 10;
            ctx.fillStyle = edge ? '#ffe680' : (Math.random() < 0.5 ? '#ff8a1a' : '#d83a10');
            ctx.globalAlpha = edge ? 0.85 : 0.35 + Math.random() * 0.3;
            ctx.fillRect(Math.round(bx), Math.round(by), edge ? 2 : 1, edge ? 2 : 1);
          }
          ctx.globalAlpha = 1;
          if (g.cmeY > H) { g.cmeY = -1; g.cmeTimer = g.cmePeriod; }
        }
      }

      // ── Pulsars: rotating twin radiation beams (update + draw) ────────────
      for (const pu of g.pulsars) {
        pu.angle += pu.rotSpeed;
        const pux = Math.cos(pu.angle), puy = Math.sin(pu.angle);
        const pPulse = 0.55 + Math.abs(Math.sin(g.frame * 0.22)) * 0.45; // fast pulsar blink
        // twin beams: dotted, fading with distance, slight sinuous wobble.
        // A perpendicular scatter column widens the visual to match the physics band.
        for (let side = -1; side <= 1; side += 2) {
          for (let d = 10; d < pu.beamLen; d += 5) {
            const fade = 1 - d / pu.beamLen;
            const wob  = Math.sin(g.frame * 0.15 + d * 0.3) * 2;
            const bxp  = pu.x + pux * d * side - puy * wob;
            const byp  = pu.y + puy * d * side + pux * wob;
            ctx.fillStyle = d < 40 ? '#b8ecff' : '#28b8e8';
            ctx.globalAlpha = fade * pPulse * 0.8;
            ctx.fillRect(Math.round(bxp) - 1, Math.round(byp) - 1, 2, 2);
            // fringe dots at the physics-band edges (alternating sides)
            const fr3 = (d % 10 < 5 ? 1 : -1) * (PULSAR_BEAM_HALF - 2);
            ctx.globalAlpha = fade * pPulse * 0.35;
            ctx.fillRect(Math.round(bxp - puy * fr3), Math.round(byp + pux * fr3), 1, 1);
          }
        }
        // counter-rotating halo ring
        ctx.fillStyle = '#28b8e8';
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 - pu.angle * 2;
          ctx.globalAlpha = 0.35 + (i % 2) * 0.25;
          ctx.fillRect(Math.round(pu.x + Math.cos(a) * 12) - 1, Math.round(pu.y + Math.sin(a) * 12) - 1, 2, 2);
        }
        // core: tiny white-hot neutron star
        ctx.globalAlpha = 1;
        drawSolidCircle(ctx, pu.x, pu.y, 5, '#0a2a3a');
        ctx.fillStyle = pPulse > 0.8 ? '#ffffff' : '#b8ecff';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(Math.round(pu.x) - 2, Math.round(pu.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Gravitational waves: expanding spacetime ripple (update + draw) ───
      for (const gw of g.gravWaves) {
        const gwMaxR = Math.sqrt(W * W + H * H); // ring covers the board from any epicenter
        if (gw.radius < 0) {
          gw.timer--;
          if (gw.timer <= 0) gw.radius = 4; // first wave uses the level-seeded dir
        } else {
          gw.radius += GW_SPEED;
          if (gw.radius > gwMaxR) {
            gw.radius = -1;
            gw.timer  = gw.period;
            gw.dir    = Math.random() < 0.5 ? 1 : -1; // later waves re-roll (runtime-only)
          }
        }
        // epicenter: two tiny orbiting dots — the distant merging pair emitting the waves
        const oa = g.frame * 0.11;
        ctx.fillStyle = '#4a5578';
        ctx.globalAlpha = 0.75;
        ctx.fillRect(Math.round(gw.ex + Math.cos(oa) * 4) - 1, Math.round(gw.ey + Math.sin(oa) * 4) - 1, 3, 3);
        ctx.fillRect(Math.round(gw.ex - Math.cos(oa) * 4) - 1, Math.round(gw.ey - Math.sin(oa) * 4) - 1, 3, 3);
        ctx.globalAlpha = 1;
        if (gw.radius >= 0) {
          // wavefront ring + one trailing echo (dot count capped for perf)
          for (let ring = 0; ring < 2; ring++) {
            const rr = gw.radius - ring * 14;
            if (rr <= 0) continue;
            const n = Math.min(200, Math.max(24, Math.round(2 * Math.PI * rr / 9)));
            ctx.fillStyle = ring === 0 ? '#8a94b8' : '#b8bed4';
            for (let i = 0; i < n; i++) {
              const a  = (i / n) * Math.PI * 2;
              const rx = gw.ex + Math.cos(a) * rr;
              const ry = gw.ey + Math.sin(a) * rr;
              if (rx < -4 || rx > W + 4 || ry < -4 || ry > H + 4) continue;
              ctx.globalAlpha = (ring === 0 ? 0.7 : 0.35) * (0.6 + (i % 3) * 0.2);
              ctx.fillRect(Math.round(rx) - 1, Math.round(ry) - 1, 2, 2);
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Vacuum decay bubbles: expanding true-vacuum (update + draw) ───────
      for (const vb of g.vacuums) {
        if (vb.popFlash > 0) vb.popFlash--;
        if (vb.respawnTimer > 0) {
          vb.respawnTimer--;
          if (vb.respawnTimer === 0) vb.r = VAC_R0; // reseed and grow again
        } else {
          vb.r += vb.grow;
          if (vb.r >= vb.rMax) {
            spawnBurst(g, vb.x, vb.y, 10, 10, '#38c890');
            vb.popFlash = 20;
            vb.respawnTimer = VAC_RESPAWN;
          }
        }
        if (vb.popFlash > 0) {
          const pt2 = 1 - vb.popFlash / 20;
          ctx.fillStyle = '#a0f0d0';
          for (let i = 0; i < 30; i++) {
            const a  = (i / 30) * Math.PI * 2;
            const rr = vb.rMax * (0.3 + pt2 * 0.9);
            ctx.globalAlpha = (1 - pt2) * 0.7;
            ctx.fillRect(Math.round(vb.x + Math.cos(a) * rr) - 1, Math.round(vb.y + Math.sin(a) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        if (vb.respawnTimer > 0) continue;
        // membrane: shimmering eerie-green ring
        const vn = Math.max(20, Math.round(2 * Math.PI * vb.r / 6));
        const vShimmer = 0.6 + Math.abs(Math.sin(g.frame * 0.06)) * 0.4;
        ctx.fillStyle = '#38c890';
        for (let i = 0; i < vn; i++) {
          const a   = (i / vn) * Math.PI * 2 + g.frame * 0.004;
          const wob = Math.sin(g.frame * 0.08 + i * 1.7) * 1.5;
          ctx.globalAlpha = vShimmer * (0.5 + (i % 2) * 0.35);
          ctx.fillRect(Math.round(vb.x + Math.cos(a) * (vb.r + wob)) - 1, Math.round(vb.y + Math.sin(a) * (vb.r + wob)) - 1, 2, 2);
        }
        // interior: sparse pale specks drifting upward — physics is "wrong" in here
        ctx.fillStyle = '#a0f0d0';
        for (let i = 0; i < 12; i++) {
          const cyc = (g.frame * 0.5 + i * 41) % (vb.r * 2);
          const sdy = vb.r - cyc; // +r → -r as frames advance: specks rise
          const hw  = Math.sqrt(Math.max(0, vb.r * vb.r - sdy * sdy)) * 0.85;
          const fx  = Math.sin(i * 12.9898 + 78.233); // stable per-speck lane in [-1,1]
          ctx.globalAlpha = 0.45;
          ctx.fillRect(Math.round(vb.x + fx * hw) - 1, Math.round(vb.y + sdy) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // ── White holes: radial ejection swirl (the black hole's mirror) ─────
      for (const wh of g.whiteHoles) {
        const wr = WH_RANGE;
        const corePulse = 0.6 + Math.abs(Math.sin(g.frame * 0.08)) * 0.4;
        // 3 arms of dots streaming outward from the core, counter-rotating vs the black hole.
        // Icy blue reads as self-luminous on the cream field (the cold mirror of the BH's red).
        for (let arm = 0; arm < 3; arm++) {
          for (let d = 0; d < 14; d++) {
            const prog = ((g.frame * 0.8 + d * 10) % 120) / 120;       // 0→1 marching outward
            const rr   = 8 + prog * (wr - 8);
            const a    = (arm / 3) * Math.PI * 2 - g.frame * 0.02 + prog * 1.6; // counter-rot swirl
            ctx.fillStyle   = prog < 0.35 ? '#2f8fe8' : '#6ab6f2';
            ctx.globalAlpha = (1 - prog) * 0.85;                        // fade at the outer edge
            ctx.fillRect(Math.round(wh.x + Math.cos(a) * rr) - 1, Math.round(wh.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // bright inner ring (anti-horizon), counter-rotating
        ctx.fillStyle = '#1e78d8';
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2 - g.frame * 0.03;
          ctx.globalAlpha = 0.5 + (i % 2) * 0.4;
          ctx.fillRect(Math.round(wh.x + Math.cos(a) * 14) - 1, Math.round(wh.y + Math.sin(a) * 14) - 1, 2, 2);
        }
        // white-hot core with a blue rim so it stays visible on cream
        drawSolidCircle(ctx, wh.x, wh.y, 7, '#1663c0');
        drawSolidCircle(ctx, wh.x, wh.y, 4, '#bfe0ff');
        ctx.fillStyle   = '#ffffff';
        ctx.globalAlpha = corePulse;
        ctx.fillRect(Math.round(wh.x) - 2, Math.round(wh.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Magnetars: periodic starquake flare (update + draw) ──────────────
      for (const mg of g.magnetars) {
        // advance the charge/release cycle (once per frame, not per ball)
        if (mg.releaseTimer > 0) {
          mg.releaseTimer--;
        } else {
          mg.timer--;
          if (mg.timer <= 0) {
            mg.releaseTimer = MAG_RELEASE;
            mg.timer = mg.period;
            spawnBurst(g, mg.x, mg.y, 12, 12, '#ffe020'); // omnidirectional flare spark
          }
        }
        const charging  = mg.releaseTimer <= 0 && mg.timer <= MAG_WARN;
        const corePulse = 0.4 + Math.abs(Math.sin(g.frame * (charging ? 0.25 : 0.05))) * 0.6;
        // magnetic field arches: 3 counter-rotating dot rings, brightening while charging
        ctx.fillStyle = charging ? '#ffe020' : '#e0a818';
        for (let ring = 0; ring < 3; ring++) {
          const rr = 14 + ring * 9;
          const n  = 12 + ring * 3;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + g.frame * 0.01 * (ring % 2 === 0 ? 1 : -1);
            ctx.globalAlpha = corePulse * (0.45 + (i % 2) * 0.3) * (charging ? 1 : 0.7);
            ctx.fillRect(Math.round(mg.x + Math.cos(a) * rr) - 1, Math.round(mg.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // release shockwave ring
        if (mg.releaseTimer > 0) {
          const rt = 1 - mg.releaseTimer / MAG_RELEASE;
          ctx.fillStyle = '#ffcf1a';
          for (let i = 0; i < 44; i++) {
            const a  = (i / 44) * Math.PI * 2;
            const rr = rt * MAG_RANGE;
            ctx.globalAlpha = (1 - rt) * 0.9;
            ctx.fillRect(Math.round(mg.x + Math.cos(a) * rr) - 1, Math.round(mg.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        // iron-grey neutron core with a flaring center
        drawSolidCircle(ctx, mg.x, mg.y, 6, '#2a2a30');
        ctx.fillStyle   = (charging || corePulse > 0.85) ? '#fff2b0' : '#ffcf1a';
        ctx.globalAlpha = corePulse;
        ctx.fillRect(Math.round(mg.x) - 2, Math.round(mg.y) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Rogue planets: a starless world drifting through the field (update + draw) ──
      for (const rp of g.roguePlanets) {
        if (rp.hitCool > 0) rp.hitCool--;
        rp.x += rp.vx; rp.y += rp.vy;
        // drift and bounce off all four edges of the play field so it roams continuously
        if (rp.x < rp.r         && rp.vx < 0) rp.vx = Math.abs(rp.vx);
        if (rp.x > W - rp.r     && rp.vx > 0) rp.vx = -Math.abs(rp.vx);
        if (rp.y < launcherY + 40 + rp.r && rp.vy < 0) rp.vy = Math.abs(rp.vy);
        if (rp.y > H - 70 - rp.r         && rp.vy > 0) rp.vy = -Math.abs(rp.vy);
        // pale tilted ring (debris), non-luminous, breathing slowly — drawn behind the body
        const ringBreath = 1 + Math.sin(g.frame * 0.02) * 0.04;
        const ct = Math.cos(rp.ringTilt), st = Math.sin(rp.ringTilt);
        ctx.fillStyle = '#8890a0';
        for (let i = 0; i < 22; i++) {
          const a  = (i / 22) * Math.PI * 2 + g.frame * 0.004;
          const ex = Math.cos(a) * (rp.r + 8) * ringBreath;
          const ey = Math.sin(a) * (rp.r + 8) * 0.4 * ringBreath; // flattened into an ellipse
          const rx = ex * ct - ey * st;
          const ry = ex * st + ey * ct;
          ctx.globalAlpha = 0.45 + (i % 2) * 0.25;
          ctx.fillRect(Math.round(rp.x + rx) - 1, Math.round(rp.y + ry) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // dark navy body — the only non-luminous hazard (a cold, stray world)
        drawSolidCircle(ctx, rp.x, rp.y, rp.r, '#20283a');
        // faint surface stipple that turns slowly with the planet
        ctx.fillStyle = '#2e3850';
        for (let i = 0; i < 10; i++) {
          const a  = (i / 10) * Math.PI * 2 + g.frame * 0.004;
          const rr = rp.r * 0.55;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(Math.round(rp.x + Math.cos(a) * rr) - 1, Math.round(rp.y + Math.sin(a) * rr) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Quasar jets: fixed plasma column, dots streaming along the axis (draw) ──
      for (const qj of g.quasarJets) {
        const len     = qj.y1 - qj.y0;
        const nozzleY = qj.dir === 1 ? qj.y0 : qj.y1;
        const jetPulse = 0.5 + Math.abs(Math.sin(g.frame * 0.18)) * 0.5; // fast "danger" pulse
        // plasma stream: dense dots flow from the nozzle to the tip, widening + fading as they go
        for (let i = 0; i < 70; i++) {
          const along = (g.frame * 2.5 + i * 8) % len;    // 0 at nozzle → len at tip
          const prog  = along / len;
          const py    = nozzleY + qj.dir * along;
          const lane  = ((i * 2654435761) >>> 0) / 0xffffffff; // stable pseudo-random lane 0..1
          const spread = (lane * 2 - 1) * QJ_HALF * (0.4 + prog * 0.6);
          ctx.fillStyle   = prog < 0.35 ? '#c0a0ff' : '#8a5adc';
          ctx.globalAlpha = (1 - prog * 0.8) * 0.8;
          ctx.fillRect(Math.round(qj.bx + spread) - 1, Math.round(py) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // bright nozzle core
        drawSolidCircle(ctx, qj.bx, nozzleY, 5, '#5a2a9a');
        ctx.fillStyle   = '#e0c8ff';
        ctx.globalAlpha = jetPulse;
        ctx.fillRect(Math.round(qj.bx) - 2, Math.round(nozzleY) - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // ── Evaporating micro black holes: shrink → evaporate → re-form (update + draw) ──
      for (const mb of g.microBHs) {
        // advance the life/evaporation/dormant state machine (once per frame)
        if (mb.dormant > 0) {
          mb.dormant--;
          if (mb.dormant === 0) {
            mb.spotIdx = (mb.spotIdx + 1) % mb.spots.length; // re-form at the next site
            mb.x = mb.spots[mb.spotIdx].x;
            mb.y = mb.spots[mb.spotIdx].y;
            mb.life = mb.maxLife;
            mb.evap = 0;
            spawnBurst(g, mb.x, mb.y, 5, 5, '#c0d0ff'); // materialization shimmer
          }
        } else if (mb.evap > 0) {
          mb.evap--;
          if (mb.evap === 0) mb.dormant = 90;
        } else {
          mb.life--;
          if (mb.life <= 0) { mb.evap = 12; spawnBurst(g, mb.x, mb.y, 14, 14, '#ffffff'); }
        }
        if (mb.dormant > 0) continue; // invisible while evaporated
        if (mb.evap > 0) {
          // evaporation: white shockwave, no core
          const et = 1 - mb.evap / 12;
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 36; i++) {
            const a  = (i / 36) * Math.PI * 2;
            const rr = et * MBH_EVAP_RANGE;
            ctx.globalAlpha = (1 - et) * 0.85;
            ctx.fillRect(Math.round(mb.x + Math.cos(a) * rr) - 1, Math.round(mb.y + Math.sin(a) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
          continue;
        }
        const lifeRatio = mb.life / mb.maxLife;
        const nearEvap  = mb.life <= 45; // telegraph: whitens before evaporation
        const swirlR    = 8 + lifeRatio * 8; // visibly shrinks as it evaporates
        // blood-red accretion swirl (fast, busy rotation = a small BH)
        ctx.fillStyle = '#8a1420';
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + g.frame * 0.03;
          ctx.globalAlpha = 0.45 + (i % 2) * 0.3;
          ctx.fillRect(Math.round(mb.x + Math.cos(a) * swirlR) - 1, Math.round(mb.y + Math.sin(a) * swirlR) - 1, 2, 2);
        }
        // Hawking radiation: white sparks, more frequent as the BH shrinks
        ctx.fillStyle = nearEvap ? '#ffffff' : '#ffd0d0';
        const sparks = Math.round((1 - lifeRatio) * 8) + (nearEvap ? 4 : 0);
        for (let i = 0; i < sparks; i++) {
          const a  = Math.random() * Math.PI * 2;
          const rr = swirlR * (0.5 + Math.random());
          ctx.globalAlpha = 0.5 + Math.random() * 0.4;
          ctx.fillRect(Math.round(mb.x + Math.cos(a) * rr), Math.round(mb.y + Math.sin(a) * rr), 1, 1);
        }
        ctx.globalAlpha = 1;
        // maroon event-horizon core (whitens as it nears evaporation)
        drawSolidCircle(ctx, mb.x, mb.y, 4, nearEvap ? '#d04040' : '#2a0810');
        ctx.globalAlpha = 1;
      }

      // ── Dark matter halos: invisible pull, only a rare faint shimmer (update + draw) ──
      for (const dh of g.darkHalos) {
        dh.shimmer--;
        if (dh.shimmer <= 0) dh.shimmer = 90 + Math.floor(Math.random() * 60); // next reveal 90-150f
        // reveal a faint indigo ring during the last 40 frames of the cycle (smooth bump).
        // Kept ghostly, but perceptible enough to be a fair "there is something here" cue.
        if (dh.shimmer < 40) {
          const a  = Math.sin(Math.PI * (40 - dh.shimmer) / 40) * 0.35; // peak alpha 0.35
          const rr = DM_RANGE * 0.55;
          ctx.fillStyle = '#8a96d8';
          for (let i = 0; i < 44; i++) {
            const ang = (i / 44) * Math.PI * 2;
            ctx.globalAlpha = a * (0.6 + (i % 2) * 0.4);
            ctx.fillRect(Math.round(dh.x + Math.cos(ang) * rr) - 1, Math.round(dh.y + Math.sin(ang) * rr) - 1, 2, 2);
          }
          // brief brighter centre flash so the reveal clearly points to the pull source
          ctx.globalAlpha = a * 1.6;
          ctx.fillRect(Math.round(dh.x) - 1, Math.round(dh.y) - 1, 3, 3);
          ctx.globalAlpha = 1;
        }
      }

      // ── Ergospheres: frame-dragging ring band (double ring spins at different speeds,
      // same direction; a static black core marks the non-rotating BH itself) ──
      for (const eg of g.ergospheres) {
        const bandCenter = (eg.r0 + eg.r1) / 2;
        // outer ring — slow
        const outerSpin = g.frame * 0.012 * eg.dir;
        ctx.fillStyle = '#5a2a8a';
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2 + outerSpin;
          ctx.globalAlpha = 0.5 + (i % 2) * 0.3;
          ctx.fillRect(Math.round(eg.x + Math.cos(a) * eg.r1) - 1, Math.round(eg.y + Math.sin(a) * eg.r1) - 1, 2, 2);
        }
        // inner ring — faster, same direction
        const innerSpin = g.frame * 0.03 * eg.dir;
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * Math.PI * 2 + innerSpin;
          ctx.globalAlpha = 0.45 + (i % 2) * 0.3;
          ctx.fillRect(Math.round(eg.x + Math.cos(a) * eg.r0) - 1, Math.round(eg.y + Math.sin(a) * eg.r0) - 1, 2, 2);
        }
        // tangential flow streaks inside the band
        ctx.fillStyle = '#7a4ab0';
        const streakSpin = (g.frame * 1.2 * eg.dir) / bandCenter;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + streakSpin;
          ctx.globalAlpha = 0.35;
          ctx.fillRect(Math.round(eg.x + Math.cos(a) * bandCenter) - 1, Math.round(eg.y + Math.sin(a) * bandCenter) - 1, 1, 1);
        }
        ctx.globalAlpha = 1;
        // static black core — the non-rotating BH itself
        drawSolidCircle(ctx, eg.x, eg.y, 8, '#0a0a12');
      }

      // ── Magnetic reconnection: X of field lines, inert until a periodic snap (update + draw) ──
      for (const mr of g.magReconnections) {
        // advance the charge/release cycle (once per frame, not per ball)
        if (mr.releaseTimer > 0) {
          mr.releaseTimer--;
        } else {
          mr.timer--;
          if (mr.timer <= 0) {
            mr.releaseTimer = MR_RELEASE;
            mr.timer = mr.period;
            spawnBurst(g, mr.x, mr.y, 10, 10, '#e040a0');
          }
        }
        const snapping   = mr.releaseTimer > 0;
        const charging   = !snapping && mr.timer <= MR_WARN;
        const flowSpd    = snapping ? 4 : (charging ? 1.2 : 0.4);
        const dotsPerDir = 14;
        const step       = MR_HALFLEN / dotsPerDir;
        const dirs       = [mr.angle, mr.angle + Math.PI, mr.angle + Math.PI / 2, mr.angle + Math.PI * 1.5];
        ctx.fillStyle = snapping || charging ? '#e040a0' : '#701854';
        for (const da of dirs) {
          const dx = Math.cos(da), dy = Math.sin(da);
          for (let i = 0; i < dotsPerDir; i++) {
            // at rest, dots drift inward toward the crossing; a snap reverses them outward
            const raw = snapping
              ? (g.frame * flowSpd + i * step) % MR_HALFLEN
              : MR_HALFLEN - ((g.frame * flowSpd + i * step) % MR_HALFLEN);
            const px = mr.x + dx * raw, py = mr.y + dy * raw;
            const pulse = charging ? (0.5 + Math.abs(Math.sin(g.frame * 0.3)) * 0.5)
                                    : (0.35 + Math.abs(Math.sin(g.frame * 0.03 + i)) * 0.25);
            ctx.globalAlpha = snapping ? 0.9 : pulse;
            const sz = snapping ? 2 : 1;
            ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, sz, sz);
          }
        }
        ctx.globalAlpha = 1;
        if (charging || snapping) drawSolidCircle(ctx, mr.x, mr.y, 3, '#e040a0');
      }

      // ── Pre-supernova stars: swell → boom → collapse cycle (update + draw) ──
      for (const sn of g.preSupernovae) {
        // advance the swell/boom/shrink cycle (once per frame, not per ball)
        if (sn.hitCool  > 0) sn.hitCool--;
        if (sn.hitFlash > 0) sn.hitFlash--;
        if (sn.boomTimer > 0) {
          sn.boomTimer--;
          if (sn.boomTimer === 0) sn.shrinkTimer = SN_SHRINK;
        } else if (sn.shrinkTimer > 0) {
          sn.shrinkTimer--;
        } else {
          sn.timer--;
          if (sn.timer <= 0) {
            sn.boomTimer = SN_BOOM;
            sn.timer = sn.period;
            spawnBurst(g, sn.x, sn.y, 14, 14, '#ffffff');
            spawnBurst(g, sn.x, sn.y, 10, 10, '#ff6a30');
          }
        }
        const snR = sn.boomTimer > 0 ? SN_R_MAX
          : sn.shrinkTimer > 0 ? SN_R_MIN + (sn.shrinkTimer / SN_SHRINK) * (SN_R_MAX - SN_R_MIN)
          : SN_R_MIN + (1 - sn.timer / sn.period) * (SN_R_MAX - SN_R_MIN);
        const growT    = (snR - SN_R_MIN) / (SN_R_MAX - SN_R_MIN); // 0 (calm) → 1 (about to pop)
        const charging = sn.boomTimer <= 0 && sn.shrinkTimer <= 0 && sn.timer <= SN_WARN;
        const flicker  = 0.06 + growT * 0.16 + (charging ? 0.06 : 0); // k: 0.06 → 0.22, faster near boom
        const bodyR    = snR * (1 + Math.sin(g.frame * 0.03) * 0.03); // slow breathing

        // stippled convective body — deepens from red toward orange as it swells
        const coreColor = sn.hitFlash > 0 ? '#ffffff' : (growT > 0.5 ? '#ff6a30' : '#d84a20');
        for (let ring = 1; ring <= 3; ring++) {
          const rr = bodyR * (ring / 3);
          const n  = Math.max(8, Math.round(2 * Math.PI * rr / 4));
          for (let i = 0; i < n; i++) {
            const a     = (i / n) * Math.PI * 2;
            const flick = 0.5 + Math.abs(Math.sin(g.frame * flicker + i * 1.7 + ring)) * 0.5;
            const fleck = charging && Math.sin(g.frame * 0.5 + i * 3.1 + ring) > 0.7;
            ctx.fillStyle   = fleck ? '#ffffff' : coreColor;
            ctx.globalAlpha = 0.35 + flick * 0.45;
            ctx.fillRect(Math.round(sn.x + Math.cos(a) * rr) - 1, Math.round(sn.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        drawSolidCircle(ctx, sn.x, sn.y, bodyR * 0.35, sn.hitFlash > 0 ? '#ffffff' : '#5a1408');

        // boom shockwave ring (white → red-orange, expands to the full push range)
        if (sn.boomTimer > 0) {
          const bt = 1 - sn.boomTimer / SN_BOOM;
          ctx.fillStyle = bt < 0.4 ? '#ffffff' : '#ff6a30';
          for (let i = 0; i < 48; i++) {
            const a  = (i / 48) * Math.PI * 2;
            const rr = bt * SN_BOOM_RANGE;
            ctx.globalAlpha = (1 - bt) * 0.85;
            ctx.fillRect(Math.round(sn.x + Math.cos(a) * rr) - 1, Math.round(sn.y + Math.sin(a) * rr) - 1, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
      }

      // ── Boss core ─────────────────────────────────────────────────────────
      if (g.boss && g.boss.hp > 0) {
        const b   = g.boss;
        const fr2 = g.frame;
        const pulse = 0.5 + Math.abs(Math.sin(fr2 * 0.06)) * 0.5;
        const flash = b.hitFlash > 0 ? b.hitFlash / 10 : 0;
        const enraged = b.hp <= b.maxHp * 0.30;
        // menacing aura — intensifies when enraged (HP < 30%)
        ctx.fillStyle = enraged ? '#ff1a3a' : '#6a0030';
        const auraR = enraged ? b.r + 9 : b.r + 6;
        for (let i = 0; i < 40; i++) {
          const a  = (i / 40) * Math.PI * 2;
          const ar = auraR + Math.sin(fr2 * (enraged ? 0.12 : 0.05) + i) * (enraged ? 5 : 3);
          ctx.globalAlpha = enraged ? (0.18 + pulse * 0.22) : (0.10 + pulse * 0.12);
          ctx.fillRect(Math.round(b.x + Math.cos(a) * ar) - 1, Math.round(b.y + Math.sin(a) * ar) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        // filled core body
        drawSolidCircle(ctx, b.x, b.y, b.r, flash > 0 ? '#ff5a33' : '#2a0a18');
        // inner detail rings (dot stipple)
        for (let ring = 1; ring <= 2; ring++) {
          const rr = b.r * (0.40 + ring * 0.22);
          const n  = Math.round(2 * Math.PI * rr / 4);
          ctx.fillStyle = ring === 1 ? '#c01040' : '#7a0828';
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + fr2 * (ring === 1 ? 0.01 : -0.008);
            ctx.globalAlpha = 0.5 + (i % 2) * 0.3;
            ctx.fillRect(Math.round(b.x + Math.cos(a) * rr) - 1, Math.round(b.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // single bright eye
        ctx.globalAlpha = 0.7 + pulse * 0.3;
        ctx.fillStyle = flash > 0 ? '#ffffff' : '#ff4466';
        ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y) - 2, 4, 4);
        // re-arm shockwave ring
        if (b.rearmFlash > 0) {
          const rt = 1 - b.rearmFlash / 18;
          ctx.fillStyle = '#66aaff';
          for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            const rr = (b.r + 10) + rt * 30;
            ctx.globalAlpha = (1 - rt) * 0.7;
            ctx.fillRect(Math.round(b.x + Math.cos(a) * rr) - 1, Math.round(b.y + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        // HP ring: one segment per maxHp, lit = remaining hp
        const ringR = b.r + 11;
        for (let i = 0; i < b.maxHp; i++) {
          const a  = (i / b.maxHp) * Math.PI * 2 - Math.PI / 2;
          const hx = Math.round(b.x + Math.cos(a) * ringR);
          const hy = Math.round(b.y + Math.sin(a) * ringR);
          ctx.globalAlpha = i < b.hp ? 1 : 0.35;
          ctx.fillStyle   = i < b.hp ? '#ff3344' : '#3a0a14';
          ctx.fillRect(hx - 2, hy - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }

      // ── Lightning arcs ────────────────────────────────────────────────────
      g.lightningArcs = g.lightningArcs.filter(arc => arc.age < arc.maxAge);
      for (const arc of g.lightningArcs) {
        arc.age++;
        const arcFade = 1 - arc.age / arc.maxAge;
        ctx.fillStyle = arc.age < arc.maxAge * 0.35 ? '#ffffff' : '#ffee44';
        for (let i = 0; i < arc.pts.length - 1; i++) {
          const pt = arc.pts[i];
          ctx.globalAlpha = arcFade * 0.90;
          ctx.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Pegs ─────────────────────────────────────────────────────────────
      const bombPulse = 0.55 + Math.abs(Math.sin(g.frame * 0.14)) * 0.45; // ~2.7 beats/sec
      for (const peg of g.pegs) {
        if (peg.cleared) continue;
        if (peg.hitCool > 0) peg.hitCool--;

        if (peg.type === 'bomb') {
          const pulse  = bombPulse;
          // Outer glow ring (expands/contracts)
          const outerR = PEG_R + 3 + pulse * 4;
          const oCount = Math.max(6, Math.round(2 * Math.PI * outerR / 3.5));
          ctx.fillStyle = '#ff2200';
          for (let i = 0; i < oCount; i++) {
            const a = (i / oCount) * Math.PI * 2;
            ctx.globalAlpha = pulse * 0.28;
            ctx.fillRect(Math.round(peg.x + Math.cos(a) * outerR) - 1, Math.round(peg.y + Math.sin(a) * outerR) - 1, 2, 2);
          }
          // Inner glow ring
          const innerR = PEG_R + 1;
          const iCount = Math.max(6, Math.round(2 * Math.PI * innerR / 3.0));
          for (let i = 0; i < iCount; i++) {
            const a = (i / iCount) * Math.PI * 2;
            ctx.globalAlpha = pulse * 0.55;
            ctx.fillRect(Math.round(peg.x + Math.cos(a) * innerR) - 1, Math.round(peg.y + Math.sin(a) * innerR) - 1, 1, 1);
          }
          ctx.globalAlpha = 1;
          drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#cc1100', pulse);
        } else {
          if (peg.type === 'magnet') {
            drawSolidCircle(ctx, peg.x, peg.y, PEG_R, '#000000');
          } else if (peg.type === 'chain-node') {
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#8090a8', 1.0);
          } else if (peg.type === 'chain-weak') {
            const hpRatio = (peg.hp ?? 1) / (peg.maxHp ?? 1);
            const cx = Math.round(peg.x), cy = Math.round(peg.y);
            // Body: shifts dark rust → bright red as HP drops
            const bodyCol = hpRatio > 0.6 ? '#380c00' : hpRatio > 0.3 ? '#5a1600' : '#8a2200';
            drawSolidCircle(ctx, peg.x, peg.y, PEG_R, bodyCol);
            // Crosshair target symbol: "aim here"
            const aimCol = hpRatio > 0.6 ? '#b82000' : hpRatio > 0.3 ? '#d03000' : '#ff4400';
            ctx.fillStyle = aimCol;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(cx - 7, cy - 1, 15, 2);  // horizontal bar
            ctx.fillRect(cx - 1, cy - 7,  2, 15); // vertical bar
            // HP ring: 3x3 segments, high contrast
            const ringR   = PEG_R + 7;
            const maxSegs = peg.maxHp ?? CHAIN_HP_BASE;
            const litSegs = peg.hp   ?? (peg.maxHp ?? CHAIN_HP_BASE);
            for (let i = 0; i < maxSegs; i++) {
              const a  = (i / maxSegs) * Math.PI * 2 - Math.PI / 2;
              const hx = Math.round(peg.x + Math.cos(a) * ringR);
              const hy = Math.round(peg.y + Math.sin(a) * ringR);
              ctx.fillStyle   = i < litSegs ? '#ff3300' : '#1e0400';
              ctx.globalAlpha = i < litSegs ? 1.0 : 0.40;
              ctx.fillRect(hx - 1, hy - 1, 3, 3);
            }
            ctx.globalAlpha = 1;
          } else if (peg.type === 'shield') {
            // Blue core + animated shield ring when hp >= 2
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#0a2040', 1.0);
            if ((peg.hp ?? SHIELD_HP) >= SHIELD_HP) {
              const shRingR = PEG_R + 5;
              const shCount = Math.round(2 * Math.PI * shRingR / 3.5);
              const shPulse = 0.55 + Math.abs(Math.sin(g.frame * 0.11)) * 0.45;
              ctx.fillStyle = '#4488ff';
              for (let i = 0; i < shCount; i++) {
                const sa = (i / shCount) * Math.PI * 2 + g.frame * 0.025;
                ctx.globalAlpha = shPulse * 0.72;
                ctx.fillRect(Math.round(peg.x + Math.cos(sa) * shRingR) - 1, Math.round(peg.y + Math.sin(sa) * shRingR) - 1, 2, 2);
              }
              ctx.globalAlpha = 1;
            }
          } else if (peg.type === 'lightning') {
            // Electric glow ring + bright core
            const ePulse = 0.45 + Math.abs(Math.sin(g.frame * 0.24 + peg.x * 0.04)) * 0.55;
            ctx.fillStyle = '#ffee22';
            for (let i = 0; i < 8; i++) {
              const ea = (i / 8) * Math.PI * 2 + g.frame * 0.07;
              const esr = PEG_R + 4 + Math.sin(g.frame * 0.33 + i) * 2;
              ctx.globalAlpha = ePulse * 0.55;
              ctx.fillRect(Math.round(peg.x + Math.cos(ea) * esr) - 1, Math.round(peg.y + Math.sin(ea) * esr) - 1, 2, 2);
            }
            ctx.globalAlpha = 1;
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#201800', ePulse * 0.5 + 0.5);
          } else if (peg.type === 'freeze') {
            // Ice-blue snowflake with shimmer
            const fpulse = 0.7 + Math.abs(Math.sin(g.frame * 0.07 + peg.y * 0.03)) * 0.3;
            drawDots(ctx, peg.dots, peg.x, peg.y, g.frame * 0.008, g.frame, '#001830', fpulse);
            ctx.fillStyle = '#88ccff';
            ctx.globalAlpha = fpulse * 0.35;
            ctx.fillRect(Math.round(peg.x) - 1, Math.round(peg.y) - 1, 2, 2);
            ctx.globalAlpha = 1;
          } else if (peg.type === 'hash') {
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, '#18103a', 1.0);
          } else if (peg.type === 'mud') {
            if (peg.mudBroken) {
              // broken: faint mud-puddle residue marking where it will reform
              ctx.fillStyle = '#4a2f18';
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                ctx.globalAlpha = 0.14;
                ctx.fillRect(Math.round(peg.x + Math.cos(a) * PEG_R * 0.7) - 1, Math.round(peg.y + Math.sin(a) * PEG_R * 0.35 + 3) - 1, 2, 1);
              }
              ctx.globalAlpha = 1;
            } else {
              // solid / reforming: gloopy dark-brown blob (scales up while reviving, slow ooze wobble)
              const s   = (peg.mudAnim && peg.mudAnim > 0) ? 1 - peg.mudAnim / MUD_REVIVE : 1;
              const wob = 1 + Math.sin(g.frame * 0.06 + peg.x * 0.05) * 0.06;
              drawSolidCircle(ctx, peg.x, peg.y, Math.max(1, PEG_R * s * wob), '#4a2f18');
              ctx.fillStyle = '#8a5a2e';
              for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2 + g.frame * 0.01;
                const rr = PEG_R * s * 0.5;
                ctx.globalAlpha = 0.6;
                ctx.fillRect(Math.round(peg.x + Math.cos(a) * rr) - 1, Math.round(peg.y + Math.sin(a) * rr) - 1, 2, 2);
              }
              ctx.fillStyle = '#6a4423';
              ctx.globalAlpha = 0.9;
              ctx.fillRect(Math.round(peg.x) - 2, Math.round(peg.y) - 2, 3, 3);
              ctx.globalAlpha = 1;
              if (peg.mudAnim && peg.mudAnim > 0) {
                const rt = 1 - peg.mudAnim / MUD_REVIVE;
                ctx.fillStyle = '#6a4423';
                for (let i = 0; i < 6; i++) {
                  const a = (i / 6) * Math.PI * 2;
                  const rr = PEG_R * (0.4 + rt * 0.9);
                  ctx.globalAlpha = (1 - rt) * 0.7;
                  ctx.fillRect(Math.round(peg.x + Math.cos(a) * rr) - 1, Math.round(peg.y + Math.sin(a) * rr - rt * 4) - 1, 2, 2);
                }
                ctx.globalAlpha = 1;
                peg.mudAnim--;
              }
            }
          } else {
            const col = peg.type === 'orange' ? '#1a1205'
                      : peg.type === 'blue'   ? '#0c1520'
                      : peg.type === 'purple' ? '#180c1a'
                      :                         '#08082a'; // split
            drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, col, 1.0);
          }
        }
      }

      // ── Fog: cosmic dark mist ─────────────────────────────────────────────
      if (g.fogActive && g.fogAlpha > 0 && g.fogClouds.length > 0) {
        const bufW    = W + 200;
        const fr      = g.frame;
        const fogTop  = Math.round(launcherY + 24);

        // clip fog rendering to below fogTop — prevents any dark pixel from bleeding into the launcher area
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, fogTop, W, H - fogTop);
        ctx.clip();

        // ambient haze — single gradient fogTop→bottom so no visible mid-screen color band
        {
          const hazeGr = ctx.createLinearGradient(0, fogTop + 80, 0, H);
          hazeGr.addColorStop(0, 'rgba(26,20,48,0)');
          hazeGr.addColorStop(1, 'rgba(26,20,48,1)');
          ctx.globalAlpha = g.fogAlpha * 0.22;
          ctx.fillStyle   = hazeGr;
          ctx.fillRect(0, fogTop, W, H - fogTop);
        }

        const staticDefs: [string, number, number, number][] = [
          ['#ffffff', 0.70, 35, 2],  // white flash
          ['#f0ecff', 0.50, 55, 1],  // bright snow
          ['#c0a0ff', 0.28, 65, 2],  // light purple grain
          ['#201440', 0.42, 50, 2],  // dark purple
          ['#050210', 0.55, 30, 1],  // near-black
        ];
        for (const cloud of g.fogClouds) {
          const cx = ((cloud.bx + cloud.spd * fr) % bufW + bufW) % bufW - 100;
          const cy = cloud.by;
          const ca = g.fogAlpha * cloud.alpha;
          if (ca < 0.01) continue;

          // build sprite once (or rebuild if device pixel ratio changed)
          if (!cloud.sprite || cloud.spriteDpr !== dpr) bakeFogCloudSprite(cloud, dpr);
          if (!cloud.sprite) continue;

          // blit pre-baked cloud (fill + noise + rings) — one cheap drawImage per cloud
          ctx.globalAlpha = ca;
          ctx.drawImage(cloud.sprite, cx + cloud.sox!, cy + cloud.soy!, cloud.sw!, cloud.sh!);

          // TV static (live, no clip): sample baked in-cloud positions, fresh random each frame
          const pool = cloud.staticPool!;
          const pl = pool.length;
          if (pl > 0) {
            for (const [col, af, count, sz] of staticDefs) {
              ctx.fillStyle   = col;
              ctx.globalAlpha = ca * af;
              const half = sz >> 1;
              for (let i = 0; i < count; i++) {
                const p = pool[(Math.random() * pl) | 0];
                ctx.fillRect(Math.round(cx + p[0]) - half, Math.round(cy + p[1]) - half, sz, sz);
              }
            }
          }
        }

        ctx.restore(); // release fog clip

        // top boundary: tight 70px cream fade — avoids height-based opacity variation in fog below
        const fadeGr = ctx.createLinearGradient(0, fogTop, 0, fogTop + 70);
        fadeGr.addColorStop(0, '#ede9df');
        fadeGr.addColorStop(1, 'rgba(237,233,223,0)');
        ctx.fillStyle   = fadeGr;
        ctx.globalAlpha = g.fogAlpha;
        ctx.fillRect(0, fogTop, W, 70);
        ctx.globalAlpha = 1;
      }

      // ── Wind indicator ────────────────────────────────────────────────────
      if (g.windForce !== 0) {
        const dir      = g.windForce > 0 ? 1 : -1;
        const isNarrow = g.windRange < g.W;
        const isStorm  = Math.abs(g.windForce) >= WIND_STORM;
        const normF    = Math.min(1, Math.abs(g.windForce) / (isNarrow ? WIND_MAX * WIND_NARROW_MULT : WIND_MAX));
        const chevN    = Math.round(2 + normF * 3);              // 2..5 chevrons by strength
        const sz       = isStorm ? 8 : 5 + Math.round(normF * 3); // bigger when stronger
        const indX     = isNarrow ? g.windCenter : (dir > 0 ? W * 0.30 : W * 0.70);
        const indY     = launcherY - 18;
        ctx.fillStyle  = isStorm ? '#b03010' : isNarrow ? '#a05010' : '#7a5020';
        const pulse    = 0.6 + Math.abs(Math.sin(g.frame * 0.12)) * 0.4;
        for (let k = 0; k < chevN; k++) {
          const cx = indX + dir * k * (sz + 2);
          ctx.globalAlpha = pulse * (0.45 + k / chevN * 0.55);
          // ">" / "<" chevron pointing in the wind direction
          for (let j = 0; j <= sz; j++) {
            const arm = Math.round(j * 0.7);
            ctx.fillRect(Math.round(cx + dir * j) - 1, Math.round(indY - arm) - 1, 2, 2);
            ctx.fillRect(Math.round(cx + dir * j) - 1, Math.round(indY + arm) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Trajectory preview ───────────────────────────────────────────────
      if (g.phase === 'aiming') {
        const vx = Math.sin(g.aimAngle) * BALL_SPEED;
        const vy = Math.cos(g.aimAngle) * BALL_SPEED;
        const trajN = computeTrajectory(launcherX, launcherY + 8, vx, vy, g.pegs, W, g.windForce, g.warpWalls, g.windRange, g.windCenter, g.windRectY0, g.windRectY1);
        ctx.fillStyle = '#0f0f0d';
        for (let i = 0; i < trajN; i += 3) {
          const fade = (1 - i / trajN) * 0.38;
          ctx.globalAlpha = fade;
          ctx.fillRect(Math.round(_trajBuf[i].x - 1), Math.round(_trajBuf[i].y - 1), 2, 2);
        }
        ctx.globalAlpha = 1;
      }

      // ── Launcher ring ────────────────────────────────────────────────────
      ctx.fillStyle = '#0f0f0d';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
        ctx.globalAlpha = 0.48;
        ctx.fillRect(
          Math.round(launcherX + Math.cos(a) * 8 - 1.5),
          Math.round(launcherY + Math.sin(a) * 8 - 1.5),
          3, 3,
        );
      }
      // Aim arm
      if (g.phase === 'aiming') {
        const ax = launcherX + Math.sin(g.aimAngle) * 20;
        const ay = launcherY + Math.cos(g.aimAngle) * 20;
        ctx.strokeStyle = '#0f0f0d';
        ctx.globalAlpha = 0.50;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.moveTo(launcherX, launcherY);
        ctx.lineTo(ax, ay);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── Burst: launch balls one by one ───────────────────────────────────
      if (g.phase === 'firing' && g.burstRemaining > 0) {
        g.burstTimer--;
        if (g.burstTimer <= 0) {
          const wobble       = (Math.random() - 0.5) * BURST_SPREAD;
          const angle        = g.burstAngle + wobble;
          const ballIdx      = BALLS_PER_SHOT - g.burstRemaining;
          const isBucketBall = ballIdx === g.burstLuckyIdx || Math.random() < g.burstBucketProb;
          g.balls.push({
            x: g.launcherX,
            y: g.launcherY + 8,
            vx: Math.sin(angle) * BALL_SPEED,
            vy: Math.cos(angle) * BALL_SPEED,
            dots: makeBallDots(),
            isBucketBall,
            stuckTimer: 0, stuckBaseY: g.launcherY + 8, freezeTimer: 0, mudTimer: 0,
          });
          g.burstRemaining--;
          g.burstTimer = BURST_INTERVAL;
        }
      }

      // ── Ball physics & collision (all active balls) ───────────────────────
      if (g.phase === 'firing') {
        g.burstTime++;
        // Speed ramp: gravity and minimum speed increase over time so slow balls
        // don't stall. Caps at +75% gravity and +4 px/s min after ~8 seconds.
        const gravBoost   = Math.min(GRAVITY * 0.75, g.burstTime * 0.00028);
        const dynMinSpeed = MIN_SPEED + Math.min(4.0, g.burstTime * 0.007);
        const bucketTop = H - 44;
        const alive: Ball[] = [];

        for (const ball of g.balls) {
          // Freeze / mud timer decay
          if (ball.freezeTimer > 0) ball.freezeTimer--;
          if (ball.mudTimer > 0) ball.mudTimer--;
          // While frozen or stuck in mud, suppress dynMinSpeed so the slow isn't overridden
          const effMinSpeed = ball.mudTimer > 0   ? Math.min(dynMinSpeed, BALL_SPEED * MUD_SLOW * 1.2)
                            : ball.freezeTimer > 0 ? Math.min(dynMinSpeed, BALL_SPEED * FREEZE_SLOW * 0.95)
                            :                        dynMinSpeed;

          // Stuck detection: reset timer when ball advances downward sufficiently
          ball.stuckTimer++;
          if (ball.y > ball.stuckBaseY + STUCK_PROGRESS) {
            ball.stuckTimer = 0;
            ball.stuckBaseY = ball.y;
          }
          // Rescue: force downward with random horizontal jitter after prolonged stall
          if (ball.stuckTimer >= STUCK_FRAMES) {
            ball.vy = Math.abs(ball.vy) * 0.7 + 3.0;
            ball.vx += (Math.random() - 0.5) * 5;
            ball.stuckTimer = 0;
            ball.stuckBaseY = ball.y;
            if (ball.freezeTimer > 0) ball.freezeTimer = 0; // rescue clears freeze
            if (ball.mudTimer > 0)    ball.mudTimer = 0;    // rescue clears mud slow
          }

          // Gravity + black hole radial pull
          const effGrav = GRAVITY + gravBoost;
          ball.vy += effGrav;
          let absorbed = false;
          for (const zone of g.gravZones) {
            const bhCx  = zone.x + zone.w / 2;
            const bhCy  = zone.y + zone.h / 2;
            const bhRange = zone.h * BH_PULL_RANGE_FACTOR;
            const bhEhR   = zone.h * 0.27;
            const dx = bhCx - ball.x, dy = bhCy - ball.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= bhRange * bhRange || dist2 === 0) continue;
            const dist = Math.sqrt(dist2);
            if (dist < bhEhR) {
              spawnBHAbsorb(g, ball.x, ball.y);
              zone.flashTimer = 36;
              absorbed = true; break;
            }
            const t = 1 - dist / bhRange;
            const strength = BH_PULL_FORCE * t * t;
            ball.vx += (dx / dist) * strength;
            ball.vy += (dy / dist) * strength;
          }
          if (absorbed) { ball.y = H + 100; continue; }

          // Gravitational lens: tangential (swirl) force that bends the path around it.
          for (const lens of g.lenses) {
            const ldx = ball.x - lens.x, ldy = ball.y - lens.y;
            const ldist2 = ldx * ldx + ldy * ldy;
            const lrange = lens.r * 2.4;
            if (ldist2 >= lrange * lrange || ldist2 === 0) continue;
            const ldist = Math.sqrt(ldist2);
            const lt = 1 - ldist / lrange;
            const lf = lens.strength * lt * lt;
            // tangent = perpendicular to the radial direction, signed by swirl dir
            ball.vx += (-ldy / ldist) * lf * lens.dir;
            ball.vy += ( ldx / ldist) * lf * lens.dir;
            // slight inward component so paths curve around rather than fling off
            ball.vx += (-ldx / ldist) * lf * 0.25;
            ball.vy += (-ldy / ldist) * lf * 0.25;
          }

          // Wind (zone-aware, Y-bounded for narrow wind to match visual rect)
          if (g.windForce !== 0 && Math.abs(ball.x - g.windCenter) <= g.windRange / 2) {
            const inWindY = g.windRange >= g.W || (ball.y >= g.windRectY0 && ball.y <= g.windRectY1);
            if (inWindY) {
              ball.vx += g.windForce;
              ball.vx = Math.max(-BALL_SPEED * 2, Math.min(BALL_SPEED * 2, ball.vx));
            }
          }

          // CME shockwave: while a sweep band passes over the ball, shove it down + outward.
          if (g.cmeY >= 0 && ball.y >= g.cmeY - 52 && ball.y <= g.cmeY) {
            const cmePush = 0.8 + Math.min(1.4, (g.level - 20) * 0.03);
            ball.vy += cmePush;
            ball.vx += (ball.x < W / 2 ? -1 : 1) * 0.5;
          }

          // Pulsar: balls caught in either radiation beam get pushed outward along it.
          for (const pu of g.pulsars) {
            const pdx = ball.x - pu.x, pdy = ball.y - pu.y;
            const pd2 = pdx * pdx + pdy * pdy;
            if (pd2 >= pu.beamLen * pu.beamLen || pd2 === 0) continue;
            const pux = Math.cos(pu.angle), puy = Math.sin(pu.angle);
            const along = pdx * pux + pdy * puy;           // signed distance along the beam axis
            const perp  = Math.abs(pdx * puy - pdy * pux); // distance from the beam line
            if (perp > PULSAR_BEAM_HALF) continue;
            const pf  = PULSAR_FORCE * (1 - Math.abs(along) / pu.beamLen);
            const sgn = along >= 0 ? 1 : -1;               // twin beams share one axis
            ball.vx += pux * sgn * pf;
            ball.vy += puy * sgn * pf;
          }

          // Gravitational wave: while the wavefront band passes over the ball, rotate
          // its velocity — a speed-preserving bend (spacetime jiggles the path), so it
          // can never stall a ball or create a softlock.
          for (const gw of g.gravWaves) {
            if (gw.radius < 0) continue;
            const gdx = ball.x - gw.ex, gdy = ball.y - gw.ey;
            const gd  = Math.sqrt(gdx * gdx + gdy * gdy);
            if (Math.abs(gd - gw.radius) > GW_BAND) continue;
            const gca = Math.cos(GW_BEND * gw.dir), gsa = Math.sin(GW_BEND * gw.dir);
            const nvx = ball.vx * gca - ball.vy * gsa;
            ball.vy   = ball.vx * gsa + ball.vy * gca;
            ball.vx   = nvx;
          }

          // Vacuum decay bubble: inside the membrane gravity flips to a net 0.5x upward
          // buoyancy. Sideways momentum still carries balls out, and the bubble's pop
          // cycle (rMax → burst → respawn) guarantees any loiterer is released.
          for (const vb of g.vacuums) {
            if (vb.respawnTimer > 0) continue;
            const vdx = ball.x - vb.x, vdy = ball.y - vb.y;
            if (vdx * vdx + vdy * vdy < vb.r * vb.r) {
              ball.vy -= effGrav * VAC_ANTIGRAV;
            }
          }

          // White hole: radial repulsion (the black hole's mirror). No absorption, so the
          // ball is only ever pushed away — it can never be trapped.
          for (const wh of g.whiteHoles) {
            const wdx = ball.x - wh.x, wdy = ball.y - wh.y;
            const wd2 = wdx * wdx + wdy * wdy;
            if (wd2 >= WH_RANGE * WH_RANGE || wd2 === 0) continue;
            const wd = Math.sqrt(wd2);
            const wt = 1 - wd / WH_RANGE;
            const wf = wh.strength * wt * wt;
            ball.vx += (wdx / wd) * wf;
            ball.vy += (wdy / wd) * wf;
          }

          // Magnetar: during the brief flare (releaseTimer > 0, advanced in the draw block),
          // shove every ball in range outward. Impulsive repulsion only, so no trap.
          for (const mg of g.magnetars) {
            if (mg.releaseTimer <= 0) continue;
            const gdx = ball.x - mg.x, gdy = ball.y - mg.y;
            const gd2 = gdx * gdx + gdy * gdy;
            if (gd2 >= MAG_RANGE * MAG_RANGE || gd2 === 0) continue;
            const gd = Math.sqrt(gd2);
            const gt = 1 - gd / MAG_RANGE;
            const gf = MAG_FORCE * gt * gt;
            ball.vx += (gdx / gd) * gf;
            ball.vy += (gdy / gd) * gf;
          }

          // Rogue planet: drifting attraction well (pull toward the planet). No absorption,
          // and the well itself moves every frame, so a stable capture orbit can't form.
          for (const rp of g.roguePlanets) {
            const rdx = rp.x - ball.x, rdy = rp.y - ball.y;
            const rd2 = rdx * rdx + rdy * rdy;
            if (rd2 >= RP_RANGE * RP_RANGE || rd2 === 0) continue;
            const rd = Math.sqrt(rd2);
            const rt = 1 - rd / RP_RANGE;
            const rf = RP_PULL * rt * rt;
            ball.vx += (rdx / rd) * rf;
            ball.vy += (rdy / rd) * rf;
          }

          // Quasar jet: inside the plasma column, accelerate the ball along the jet axis
          // (strongest at the nozzle) plus a small sideways spray. The spray guarantees the
          // ball drifts out the side, so even an up-jet can never hold it (no trap).
          for (const qj of g.quasarJets) {
            if (Math.abs(ball.x - qj.bx) > QJ_HALF) continue;
            if (ball.y < qj.y0 || ball.y > qj.y1) continue;
            const len        = qj.y1 - qj.y0;
            const fromNozzle = qj.dir === 1 ? (ball.y - qj.y0) : (qj.y1 - ball.y);
            const qt         = 1 - fromNozzle / len;                     // 1 at nozzle → 0 at tip
            ball.vy += qj.dir * qj.accel * (0.35 + 0.65 * Math.max(0, qt));
            ball.vx += (ball.x >= qj.bx ? 1 : -1) * QJ_FAN;
            const qspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (qspd > BALL_SPEED * 2) { const sc = BALL_SPEED * 2 / qspd; ball.vx *= sc; ball.vy *= sc; }
          }

          // Evaporating micro black hole: pull toward it while alive (range shrinks as it
          // evaporates); during the evaporation burst it repels instead. No absorption, and
          // it periodically vanishes/re-forms, so it can never permanently hold a ball.
          for (const mb of g.microBHs) {
            if (mb.dormant > 0) continue;
            const mdx = mb.x - ball.x, mdy = mb.y - ball.y; // toward the BH
            const md2 = mdx * mdx + mdy * mdy;
            if (mb.evap > 0) {
              if (md2 >= MBH_EVAP_RANGE * MBH_EVAP_RANGE || md2 === 0) continue;
              const md = Math.sqrt(md2);
              const mt = 1 - md / MBH_EVAP_RANGE;
              const mf = MBH_EVAP_FORCE * mt * mt;
              ball.vx -= (mdx / md) * mf; // push outward (away from the BH)
              ball.vy -= (mdy / md) * mf;
            } else {
              const R = 40 + (mb.life / mb.maxLife) * 80; // range shrinks as it evaporates
              if (md2 >= R * R || md2 === 0) continue;
              const md = Math.sqrt(md2);
              const mt = 1 - md / R;
              const mf = MBH_PULL * mt * mt;
              ball.vx += (mdx / md) * mf; // pull inward
              ball.vy += (mdy / md) * mf;
            }
          }

          // Dark matter halo: an invisible, weak attraction (no core, no absorption). The
          // ball just curves toward it — you can't see why, which is the whole point.
          for (const dh of g.darkHalos) {
            const hdx = dh.x - ball.x, hdy = dh.y - ball.y;
            const hd2 = hdx * hdx + hdy * hdy;
            if (hd2 >= DM_RANGE * DM_RANGE || hd2 === 0) continue;
            const hd = Math.sqrt(hd2);
            const ht = 1 - hd / DM_RANGE;
            const hf = dh.strength * ht * ht;
            ball.vx += (hdx / hd) * hf;
            ball.vy += (hdy / hd) * hf;
          }

          // Ergosphere: frame-dragging ring band. Only balls inside r0..r1 feel a one-way
          // tangential drag (plus a slight inward pull); the centre and the outside are inert,
          // so a ball can only ever be swept around the band, never held.
          for (const eg of g.ergospheres) {
            const gdx2 = ball.x - eg.x, gdy2 = ball.y - eg.y;
            const gd2b = gdx2 * gdx2 + gdy2 * gdy2;
            if (gd2b === 0) continue;
            const gdb = Math.sqrt(gd2b);
            if (gdb < eg.r0 || gdb > eg.r1) continue;
            const bandCenter = (eg.r0 + eg.r1) / 2;
            const halfWidth  = (eg.r1 - eg.r0) / 2;
            const egt = 1 - Math.abs(gdb - bandCenter) / halfWidth;
            const egf = eg.strength * egt * egt;
            ball.vx += (-gdy2 / gdb) * egf * eg.dir;
            ball.vy += ( gdx2 / gdb) * egf * eg.dir;
            ball.vx += (-gdx2 / gdb) * egf * 0.15;
            ball.vy += (-gdy2 / gdb) * egf * 0.15;
          }

          // Magnetic reconnection: inert X of field lines that only acts during the brief
          // snap (releaseTimer > 0, advanced in the draw block) — ejecting balls outward
          // along whichever line they're sitting on. Fully passable between snaps.
          for (const mr of g.magReconnections) {
            if (mr.releaseTimer <= 0) continue;
            const mrAngles = [mr.angle, mr.angle + Math.PI / 2];
            for (const la of mrAngles) {
              const lax = Math.cos(la), lay = Math.sin(la);
              const rdx = ball.x - mr.x, rdy = ball.y - mr.y;
              const along = rdx * lax + rdy * lay;
              const perp  = Math.abs(rdx * lay - rdy * lax);
              if (perp > MR_HALF || Math.abs(along) > MR_HALFLEN) continue;
              const mt  = 1 - Math.abs(along) / MR_HALFLEN;
              const mf  = MR_FORCE * mt * mt;
              const sgn = along >= 0 ? 1 : -1;
              ball.vx += lax * sgn * mf;
              ball.vy += lay * sgn * mf;
            }
          }

          // Pre-supernova star: during the 12f boom (boomTimer > 0, advanced in the draw
          // block), shove every nearby ball outward. Impulsive only — swelling and bounce
          // are handled by the solid body in the sub-step loop above.
          for (const sn of g.preSupernovae) {
            if (sn.boomTimer <= 0) continue;
            const bdx = ball.x - sn.x, bdy = ball.y - sn.y;
            const bd2 = bdx * bdx + bdy * bdy;
            if (bd2 >= SN_BOOM_RANGE * SN_BOOM_RANGE || bd2 === 0) continue;
            const bd = Math.sqrt(bd2);
            const bt = 1 - bd / SN_BOOM_RANGE;
            const bf = SN_BOOM_FORCE * bt * bt;
            ball.vx += (bdx / bd) * bf;
            ball.vy += (bdy / bd) * bf;
          }

          // Magnet attraction
          for (const peg of g.pegs) {
            if (peg.cleared || peg.type !== 'magnet') continue;
            const mdx = peg.x - ball.x, mdy = peg.y - ball.y;
            const mdist2 = mdx * mdx + mdy * mdy;
            if (mdist2 < MAGNET_RANGE * MAGNET_RANGE && mdist2 > 0) {
              const mdist = Math.sqrt(mdist2);
              const strength = MAGNET_FORCE * (1 - mdist / MAGNET_RANGE);
              ball.vx += (mdx / mdist) * strength;
              ball.vy += (mdy / mdist) * strength;
            }
          }

          // Sub-step movement: split frame into ≤BALL_R px steps so the ball
          // never skips over thin collision zones (bumpers, wormhole bars).
          {
            const spd0 = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const substeps = Math.max(1, Math.ceil(spd0 / BALL_R));
            const sx = ball.vx / substeps;
            const sy = ball.vy / substeps;
            let teleported = false;

            for (let sub = 0; sub < substeps; sub++) {
              ball.x += sx;
              ball.y += sy;

              // Wall bounces / warp / wall segments
              if (g.warpWalls) {
                if (ball.x < -BALL_R)    ball.x = W + BALL_R;
                if (ball.x > W + BALL_R) ball.x = -BALL_R;
              } else {
                const hitLeft  = ball.x - BALL_R < 0;
                const hitRight = ball.x + BALL_R > W;
                if (hitLeft || hitRight) {
                  const hitSide: 'left' | 'right' = hitLeft ? 'left' : 'right';
                  const seg = g.wallSegments.find(s => s.side === hitSide && ball.y >= s.yMin && ball.y <= s.yMax);
                  if (seg) {
                    if (seg.type === 'void') {
                      ball.y = H + 100; // remove ball from play
                    } else if (seg.type === 'warp') {
                      ball.x = hitLeft ? W - BALL_R - 1 : BALL_R + 1;
                      ball.vx = hitLeft ? Math.abs(ball.vx) : -Math.abs(ball.vx);
                    } else { // distort
                      ball.x = hitLeft ? BALL_R : W - BALL_R;
                      ball.vx = hitLeft ? Math.abs(ball.vx) : -Math.abs(ball.vx);
                      const dSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                      const dAngle = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 1.1;
                      ball.vx = Math.cos(dAngle) * dSpd;
                      ball.vy = Math.sin(dAngle) * dSpd;
                    }
                  } else {
                    if (hitLeft)  { ball.x = BALL_R;     ball.vx =  Math.abs(ball.vx); }
                    if (hitRight) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
                  }
                }
              }

              // Bumper collisions
              for (const bumper of g.bumpers) {
                if (collideBallBumper(ball, bumper)) {
                  spawnBurst(g, ball.x, ball.y, ball.vx * 0.35, ball.vy * 0.35);
                  bumper.hitFlash = BUMPER_FLASH;
                  if (bumper.hitCool === 0) { bumper.hitCount++; bumper.hitCool = HIT_COOL; }
                  const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                  if (spd < effMinSpeed) { const sc = effMinSpeed / spd; ball.vx *= sc; ball.vy *= sc; }
                  // Downward bias: gradually push upward-moving balls toward the field
                  if (ball.vy < 0) ball.vy += BUMPER_DN_BIAS;
                }
              }

              // Comet collision: red (vanish) comets destroy the ball; blue ones deflect it
              // (reflect + carry momentum so the bounce direction is unpredictable).
              for (const comet of g.comets) {
                if (comet.hitCool > 0 || comet.respawnTimer > 0) continue;
                const cdx = ball.x - comet.x, cdy = ball.y - comet.y;
                const cd2 = cdx * cdx + cdy * cdy;
                const crr = BALL_R + comet.r;
                if (cd2 >= crr * crr) continue;
                // emit a ripple + colored spark burst at the comet (ripple drawn in render loop)
                comet.hitFlash = 26; comet.hitX = comet.x; comet.hitY = comet.y;
                spawnBurst(g, comet.x, comet.y, 8, 8, comet.vanish ? '#ff5a5a' : '#8fd3f4');
                if (comet.vanish) {
                  spawnBurst(g, ball.x, ball.y, 12, 12, '#ff5a5a'); // big red ball-destruction pop
                  ball.y = H + 100; // destroy the ball
                  comet.hitCool = HIT_COOL;
                  break;
                }
                const cd = Math.sqrt(cd2) || 1;
                const cnx = cdx / cd, cny = cdy / cd;
                const cdot = ball.vx * cnx + ball.vy * cny;
                ball.vx -= 2 * cdot * cnx;
                ball.vy -= 2 * cdot * cny;
                ball.x  += cnx * (crr - cd + 1.5);
                ball.y  += cny * (crr - cd + 1.5);
                ball.vx += comet.vx * 0.6; // carry some of the comet's momentum
                ball.vy += comet.vy * 0.6;
                const cspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (cspd < effMinSpeed) { const sc = effMinSpeed / cspd; ball.vx *= sc; ball.vy *= sc; }
                comet.hitCool = HIT_COOL;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#8fd3f4');
              }

              // Rogue planet: solid-body bounce (reflect + carry the planet's drift). In the
              // sub-step loop so fast balls can't tunnel through the r=22 world.
              for (const rp of g.roguePlanets) {
                if (rp.hitCool > 0) continue;
                const pdx = ball.x - rp.x, pdy = ball.y - rp.y;
                const pd2 = pdx * pdx + pdy * pdy;
                const prr = BALL_R + rp.r;
                if (pd2 >= prr * prr) continue;
                const pd = Math.sqrt(pd2) || 1;
                const pnx = pdx / pd, pny = pdy / pd;
                const pdot = ball.vx * pnx + ball.vy * pny;
                ball.vx -= 2 * pdot * pnx;
                ball.vy -= 2 * pdot * pny;
                ball.x  += pnx * (prr - pd + 1.5);
                ball.y  += pny * (prr - pd + 1.5);
                ball.vx += rp.vx * 0.5; // carry a little of the planet's drift
                ball.vy += rp.vy * 0.5;
                const pspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (pspd < effMinSpeed) { const sc = effMinSpeed / pspd; ball.vx *= sc; ball.vy *= sc; }
                rp.hitCool = HIT_COOL;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#3a4a68');
              }

              // Pre-supernova star: solid bounce body whose radius swells (14→30) with its
              // cycle. The hitbox always matches the drawn radius, so "bigger = more
              // dangerous" is a fair, visible warning. In the sub-step loop so fast balls
              // can't tunnel through it at any size.
              for (const sn of g.preSupernovae) {
                if (sn.hitCool > 0) continue;
                const snR = sn.boomTimer > 0 ? SN_R_MAX
                  : sn.shrinkTimer > 0 ? SN_R_MIN + (sn.shrinkTimer / SN_SHRINK) * (SN_R_MAX - SN_R_MIN)
                  : SN_R_MIN + (1 - sn.timer / sn.period) * (SN_R_MAX - SN_R_MIN);
                const sdx = ball.x - sn.x, sdy = ball.y - sn.y;
                const sd2 = sdx * sdx + sdy * sdy;
                const srr = BALL_R + snR;
                if (sd2 >= srr * srr) continue;
                const sd = Math.sqrt(sd2) || 1;
                const snx = sdx / sd, sny = sdy / sd;
                const sdot = ball.vx * snx + ball.vy * sny;
                ball.vx -= 2 * sdot * snx;
                ball.vy -= 2 * sdot * sny;
                ball.x  += snx * (srr - sd + 1.5);
                ball.y  += sny * (srr - sd + 1.5);
                const sspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (sspd < effMinSpeed) { const sc = effMinSpeed / sspd; ball.vx *= sc; ball.vy *= sc; }
                sn.hitCool  = HIT_COOL;
                sn.hitFlash = 8;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.3, ball.vy * 0.3, '#d84a20');
              }

              // Wormhole teleportation (inside sub-step to catch thin bars at high speed).
              // Physics hitbox uses aura dimensions (w+32, h=44) so the full visible
              // cloud area is interactive. cycleTimer is not checked so balls can always
              // teleport regardless of the visual fade phase.
              for (const wh of g.wormholes) {
                if (wh.hitCool > 0) continue;
                if (!testBallOBB(ball, wh.cx, wh.cy, wh.w + 32, 44, wh.angle)) continue;
                const partner = g.wormholes.find(
                  o => o.pairId === wh.pairId && o.pairSlot !== wh.pairSlot
                );
                if (!partner || partner.hitCool > 0) continue;
                spawnWHBurst(g, ball.x, ball.y);
                spawnWHBurst(g, partner.cx, partner.cy);
                ball.x = partner.cx;
                ball.y = Math.min(partner.cy + 6, H - 60);
                wh.hitCool         = 30;
                partner.hitCool    = 30;
                wh.flashTimer      = 28;
                partner.flashTimer = 28;
                teleported = true;
                break;
              }
              if (teleported) break;
            }
          }

          // Peg collision
          for (const peg of g.pegs) {
            if (peg.cleared || peg.hitCool > 0 || peg.mudBroken) continue;
            const dx = ball.x - peg.x, dy = ball.y - peg.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= (BALL_R + PEG_R) ** 2) continue;

            const dist = Math.sqrt(dist2) || 1; // dead-center overlap guard (same as comet/boss)
            const nx = dx / dist, ny = dy / dist;

            // Reflect ball
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx -= 2 * dot * nx;
            ball.vy -= 2 * dot * ny;
            ball.x  += nx * (BALL_R + PEG_R - dist + 1.5);
            ball.y  += ny * (BALL_R + PEG_R - dist + 1.5);

            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (spd < effMinSpeed) { const sc = effMinSpeed / spd; ball.vx *= sc; ball.vy *= sc; }

            if (peg.type === 'magnet') {
              // Permanent obstacle — never clears, only cooldown
              peg.hitCool = HIT_COOL;
            } else if (peg.type === 'chain-node') {
              // Indestructible node — bounce only
              peg.hitCool = HIT_COOL;
            } else if (peg.type === 'chain-weak') {
              peg.hitCool = HIT_COOL;
              peg.hp = (peg.hp ?? 1) - 1;
              if (peg.hp <= 0) {
                for (const cp of g.pegs) {
                  if (cp.chainId === peg.chainId && !cp.cleared) {
                    spawnPegBreak(g, cp);
                    cp.cleared = true;
                    cp.hitCool = HIT_COOL;
                  }
                }
                g.score += 80;
                setScore(g.score);
              }
            } else if (peg.type === 'shield') {
              peg.hitCool = HIT_COOL;
              peg.hp = (peg.hp ?? SHIELD_HP) - 1;
              if (peg.hp <= 0) {
                spawnPegBreak(g, peg);
                peg.cleared = true;
                g.score += 30;
                setScore(g.score);
                if (peg.bossArmor) armorRefill();
              } else {
                spawnBurst(g, peg.x, peg.y, 0, 0);
              }
            } else if (peg.type === 'hash') {
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              // Randomize ball direction (keep speed, ensure downward)
              const hashSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
              const hashAngle = Math.random() * Math.PI * 2;
              ball.vx = Math.cos(hashAngle) * hashSpd;
              ball.vy = Math.abs(Math.sin(hashAngle)) * hashSpd;
              g.score += 20;
              setScore(g.score);
            } else if (peg.type === 'freeze') {
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              // Slow ball and start freeze timer
              const freezeSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * FREEZE_SLOW;
              const freezeAngle = Math.atan2(ball.vy, ball.vx);
              ball.vx = Math.cos(freezeAngle) * freezeSpd;
              ball.vy = Math.sin(freezeAngle) * freezeSpd;
              ball.freezeTimer = FREEZE_DUR;
              g.score += 20;
              setScore(g.score);
            } else if (peg.type === 'mud') {
              // Kill the ball's momentum, break the peg (revives before next shot).
              const mudSpd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) * MUD_SLOW;
              const mudAngle = Math.atan2(ball.vy, ball.vx);
              ball.vx = Math.cos(mudAngle) * mudSpd;
              ball.vy = Math.sin(mudAngle) * mudSpd;
              ball.mudTimer = MUD_DUR;
              peg.mudBroken = true;                                  // not cleared → revives
              spawnBurst(g, peg.x, peg.y, 9, 9, '#5a3a1e');          // brown mud splat
              g.score += 10;
              setScore(g.score);
            } else if (peg.type === 'lightning') {
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;
              g.score += 20;
              // Cascade: find 2 nearest non-cleared non-chain-node pegs in range
              const lcandidates = g.pegs
                .filter(p => !p.cleared && p !== peg && p.type !== 'chain-node')
                .map(p => ({ p, d2: (p.x - peg.x) ** 2 + (p.y - peg.y) ** 2 }))
                .filter(({ d2 }) => d2 <= LIGHTNING_RANGE ** 2)
                .sort((a, b) => a.d2 - b.d2)
                .slice(0, 2)
                .map(({ p }) => p);
              for (const lt of lcandidates) {
                if (lt.cleared) continue;
                g.lightningArcs.push({ x1: peg.x, y1: peg.y, x2: lt.x, y2: lt.y, age: 0, maxAge: 22, pts: makeLightningPath(peg.x, peg.y, lt.x, lt.y) });
                if (lt.type === 'shield') {
                  lt.hp = (lt.hp ?? SHIELD_HP) - 1; lt.hitCool = HIT_COOL;
                  if ((lt.hp ?? 0) <= 0) { spawnPegBreak(g, lt); lt.cleared = true; g.score += 30; if (lt.bossArmor) armorRefill(); }
                } else {
                  spawnPegBreak(g, lt); lt.cleared = true; lt.hitCool = HIT_COOL;
                  if (lt.type === 'orange') { g.orangeLeft--; g.score += 100; }
                  else if (lt.type === 'purple') { g.shotsLeft++; g.score += 50; }
                  else if (lt.type === 'chain-weak') {
                    for (const cp of g.pegs) {
                      if (cp.chainId === lt.chainId && !cp.cleared) { spawnPegBreak(g, cp); cp.cleared = true; cp.hitCool = HIT_COOL; }
                    }
                    g.score += 80;
                  } else { g.score += 10; }
                }
                // 2nd-level cascade if the zapped peg is also a cleared lightning peg
                if (lt.type === 'lightning' && lt.cleared) {
                  const lc2 = g.pegs
                    .filter(p => !p.cleared && p !== lt && p.type !== 'chain-node')
                    .map(p => ({ p, d2: (p.x - lt.x) ** 2 + (p.y - lt.y) ** 2 }))
                    .filter(({ d2 }) => d2 <= LIGHTNING_RANGE ** 2)
                    .sort((a, b) => a.d2 - b.d2)
                    .slice(0, 2)
                    .map(({ p }) => p);
                  for (const lt2 of lc2) {
                    if (lt2.cleared) continue;
                    g.lightningArcs.push({ x1: lt.x, y1: lt.y, x2: lt2.x, y2: lt2.y, age: 0, maxAge: 22, pts: makeLightningPath(lt.x, lt.y, lt2.x, lt2.y) });
                    if (lt2.type === 'shield') {
                      lt2.hp = (lt2.hp ?? SHIELD_HP) - 1; lt2.hitCool = HIT_COOL;
                      if ((lt2.hp ?? 0) <= 0) { spawnPegBreak(g, lt2); lt2.cleared = true; g.score += 30; if (lt2.bossArmor) armorRefill(); }
                    } else {
                      spawnPegBreak(g, lt2); lt2.cleared = true; lt2.hitCool = HIT_COOL;
                      if (lt2.type === 'orange') { g.orangeLeft--; g.score += 100; }
                      else if (lt2.type === 'purple') { g.shotsLeft++; g.score += 50; }
                      else if (lt2.type === 'chain-weak') {
                        for (const cp of g.pegs) {
                          if (cp.chainId === lt2.chainId && !cp.cleared) { spawnPegBreak(g, cp); cp.cleared = true; cp.hitCool = HIT_COOL; }
                        }
                        g.score += 80;
                      } else { g.score += 10; }
                    }
                  }
                }
              }
              setScore(g.score);
              setOrangeLeft(g.orangeLeft);
              setShotsLeft(g.shotsLeft);
            } else {
              spawnPegBreak(g, peg);
              peg.cleared = true;
              peg.hitCool = HIT_COOL;

              if (peg.type === 'bomb') {
                g.score += 50;
                spawnBombBurst(g, peg.x, peg.y);
                // Chain explosion
                const br2 = BOMB_RADIUS ** 2;
                for (const other of g.pegs) {
                  if (other.cleared || other === peg) continue;
                  const ex = other.x - peg.x, ey = other.y - peg.y;
                  if (ex * ex + ey * ey < br2) {
                    if (other.type === 'chain-weak') {
                      // Bomb on weak point → instant chain destroy
                      for (const cp of g.pegs) {
                        if (cp.chainId === other.chainId && !cp.cleared) {
                          spawnPegBreak(g, cp);
                          cp.cleared = true; cp.hitCool = HIT_COOL;
                        }
                      }
                      g.score += 80;
                      setScore(g.score);
                    } else if (other.type === 'chain-node') {
                      // Bomb has no effect on chain nodes
                    } else {
                      spawnPegBreak(g, other);
                      other.cleared = true; other.hitCool = HIT_COOL;
                      if (other.type === 'orange') { g.orangeLeft--; g.score += 100; }
                      else if (other.type === 'purple') { g.shotsLeft++; g.score += 50; }
                      else { g.score += 10; }
                      if (other.bossArmor) armorRefill();
                    }
                  }
                }
                setOrangeLeft(g.orangeLeft);
                setShotsLeft(g.shotsLeft);
              } else if (peg.type === 'split') {
                g.score += 30;
                // Spawn 2 balls at ±36° from current direction
                const bspd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                const ba   = Math.atan2(ball.vy, ball.vx);
                const sa   = Math.PI / 5;
                alive.push({ x: ball.x, y: ball.y, vx: Math.cos(ba + sa) * bspd, vy: Math.sin(ba + sa) * bspd, dots: makeBallDots(), isBucketBall: false, stuckTimer: 0, stuckBaseY: ball.y, freezeTimer: 0, mudTimer: 0 });
                alive.push({ x: ball.x, y: ball.y, vx: Math.cos(ba - sa) * bspd, vy: Math.sin(ba - sa) * bspd, dots: makeBallDots(), isBucketBall: false, stuckTimer: 0, stuckBaseY: ball.y, freezeTimer: 0, mudTimer: 0 });
              } else if (peg.type === 'orange') {
                g.orangeLeft--; g.score += 100;
                setOrangeLeft(g.orangeLeft);
              } else if (peg.type === 'purple') {
                g.shotsLeft++; g.score += 50;
                setShotsLeft(g.shotsLeft);
              } else {
                g.score += 10;
              }
              setScore(g.score);
            }
          }

          // Boss core collision — solid body (always bounces), damage gated by cooldown
          if (g.boss && g.boss.hp > 0) {
            const b = g.boss;
            const bdx = ball.x - b.x, bdy = ball.y - b.y;
            const bd2 = bdx * bdx + bdy * bdy;
            const rr  = BALL_R + b.r;
            if (bd2 < rr * rr) {
              const bd = Math.sqrt(bd2) || 1;
              const nx = bdx / bd, ny = bdy / bd;
              const dotp = ball.vx * nx + ball.vy * ny;
              ball.vx -= 2 * dotp * nx;
              ball.vy -= 2 * dotp * ny;
              ball.x  += nx * (rr - bd + 1.5);
              ball.y  += ny * (rr - bd + 1.5);
              const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
              if (spd < effMinSpeed) { const sc = effMinSpeed / spd; ball.vx *= sc; ball.vy *= sc; }
              if (b.hitCool === 0) {
                b.hp--; b.hitFlash = 10; b.hitCool = BOSS_HIT_COOL;
                g.score += 60;
                spawnBurst(g, ball.x, ball.y, ball.vx * 0.4, ball.vy * 0.4);
                if (b.hp <= 0) {
                  // DEFEAT: shockwave wipes the board with a cascade of breaks
                  for (const p of g.pegs) {
                    if (p.cleared) continue;
                    spawnPegBreak(g, p);
                    p.cleared = true; p.hitCool = HIT_COOL;
                  }
                  g.orangeLeft = 0;
                  for (let i = 0; i < 10; i++) {
                    const a = (i / 10) * Math.PI * 2;
                    spawnBurst(g, b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, Math.cos(a) * 6, Math.sin(a) * 6);
                  }
                  g.bucketFlashTimer = 18;
                  g.score += 2500;
                  setOrangeLeft(0);
                }
                setScore(g.score);
              } else {
                spawnBurst(g, ball.x, ball.y, 0, 0);
              }
            }
          }

          // Bucket catch
          if (
            ball.y + BALL_R > bucketTop &&
            ball.y - BALL_R < bucketTop + BUCKET_H &&
            ball.x > g.bucketX && ball.x < g.bucketX + g.bucketW
          ) {
            if (ball.isBucketBall) {
              g.shotsLeft++;
              setShotsLeft(g.shotsLeft);
              const bCx = g.bucketX + g.bucketW / 2;
              spawnBucketBurst(g, bCx, bucketTop);
              g.bucketGlowTimer = 45;
              g.bucketFlashTimer = 14;
            }
            ball.y = H + 60;
          }

          if (ball.y <= H + 40) {
            if (ball.isBucketBall) {
              const pulse = 0.7 + Math.sin(g.frame * 0.18) * 0.3;
              const bloomPasses = [
                { extra: 7, aFactor: 0.07, color: '#ffe8a0' },
                { extra: 3, aFactor: 0.16, color: '#f5d46a' },
                { extra: 1, aFactor: 0.36, color: GOLD_GLOW_COLOR },
              ] as const;
              const sA = Math.sin(g.frame * 0.038), cA = Math.cos(g.frame * 0.038);
              const sB = Math.sin(g.frame * 0.031), cB = Math.cos(g.frame * 0.031);
              for (const pass of bloomPasses) {
                ctx.fillStyle = pass.color;
                for (const d of ball.dots) {
                  const jx = (sA * d.cosP  + cA * d.sinP)  * 0.55;
                  const jy = (cB * d.cosP2 - sB * d.sinP2) * 0.55;
                  const sz = d.size + pass.extra;
                  ctx.globalAlpha = d.alpha * pass.aFactor * pulse;
                  ctx.fillRect(Math.round(ball.x + d.x + jx - sz * 0.5), Math.round(ball.y + d.y + jy - sz * 0.5), sz, sz);
                }
              }
              ctx.globalAlpha = 1;
              drawDots(ctx, ball.dots, ball.x, ball.y, 0, g.frame, GOLD_GLOW_COLOR, 1.0);
            } else {
              drawDots(ctx, ball.dots, ball.x, ball.y, 0, g.frame, '#0f0f0d', 1.0);
            }
            // Ice crystal overlay when frozen
            if (ball.freezeTimer > 0) {
              const iceAlpha = Math.min(1, ball.freezeTimer / 30) * 0.85;
              ctx.fillStyle = '#88ccff';
              for (let arm = 0; arm < 6; arm++) {
                const ia = arm * Math.PI / 3 + g.frame * 0.025;
                const ilen = BALL_R + 4;
                ctx.globalAlpha = iceAlpha;
                ctx.fillRect(Math.round(ball.x + Math.cos(ia) * ilen) - 1, Math.round(ball.y + Math.sin(ia) * ilen) - 1, 2, 2);
                ctx.fillRect(Math.round(ball.x + Math.cos(ia) * (ilen - 3)) - 1, Math.round(ball.y + Math.sin(ia) * (ilen - 3)) - 1, 1, 1);
              }
              ctx.globalAlpha = 1;
            }
            // Mud clumps clinging to the ball while slowed
            if (ball.mudTimer > 0) {
              const mudAlpha = Math.min(1, ball.mudTimer / 30) * 0.9;
              for (let c = 0; c < 7; c++) {
                const ca = c * (Math.PI * 2 / 7) + Math.sin(c * 3.1) * 0.4;
                const clen = BALL_R + 1 + (c % 3);
                const drip = Math.max(0, Math.sin(g.frame * 0.05 + c)) * 2; // gooey sag
                ctx.fillStyle   = c % 2 === 0 ? '#4a2f18' : '#6a4423';
                ctx.globalAlpha = mudAlpha;
                ctx.fillRect(Math.round(ball.x + Math.cos(ca) * clen) - 1, Math.round(ball.y + Math.sin(ca) * clen + drip) - 1, 3, 3);
              }
              ctx.globalAlpha = 1;
            }
            alive.push(ball);
          }
        }
        g.balls = alive;

        // All balls exited and burst finished → next phase
        if (g.balls.length === 0 && g.burstRemaining === 0) {
          if (g.orangeLeft <= 0 && (!g.boss || g.boss.hp <= 0)) {
            g.phase = 'levelclear';
            g.levelClearTimer = 95;
            setPhase('levelclear');
          } else if (g.shotsLeft <= 0) {
            g.phase = 'gameover';
            setPhase('gameover');
          } else {
            g.phase = 'aiming';
            setPhase('aiming');
            // Balls have all dropped → revive broken mud pegs before the next shot
            // (mudAnim plays the reform animation during aiming).
            for (const p of g.pegs) {
              if (p.type === 'mud' && p.mudBroken) { p.mudBroken = false; p.mudAnim = MUD_REVIVE; }
            }
          }
        }
      }

      // ── Fog reveal timer + alpha update ──────────────────────────────────
      if (g.fogActive && g.phase !== 'paused') {
        if (g.fogRevealTimer > 0) g.fogRevealTimer--;
        // Fade in during aiming (after reveal window), fade out during firing
        if (g.fogRevealTimer <= 0 && g.phase === 'aiming') {
          g.fogAlpha = Math.min(1, g.fogAlpha + 0.10); // ~10 frames to full
        } else {
          g.fogAlpha = Math.max(0, g.fogAlpha - 0.050); // ~20 frames to clear
        }
      } else {
        g.fogAlpha = 0;
      }

      // ── Bucket ───────────────────────────────────────────────────────────
      if (g.phase === 'aiming' || g.phase === 'firing') {
        g.bucketX += g.bucketSpd * g.bucketDir;
        if (g.bucketX <= 0)               { g.bucketX = 0;                g.bucketDir =  1; }
        if (g.bucketX + g.bucketW >= W)   { g.bucketX = W - g.bucketW;   g.bucketDir = -1; }
      }
      const bY = H - 44;
      const bucketPulse = 0.78 + Math.sin(g.frame * 0.12) * 0.22;

      // Glow aura when recently caught a bucket ball
      if (g.bucketGlowTimer > 0) {
        g.bucketGlowTimer--;
        const t = g.bucketGlowTimer / 45;
        ctx.fillStyle = '#ffe8a0';
        ctx.globalAlpha = t * 0.16 * bucketPulse;
        ctx.fillRect(g.bucketX - 12, bY - 10, g.bucketW + 24, BUCKET_H + 20);
        ctx.fillStyle = '#f5d46a';
        ctx.globalAlpha = t * 0.28 * bucketPulse;
        ctx.fillRect(g.bucketX - 6, bY - 5, g.bucketW + 12, BUCKET_H + 10);
        ctx.fillStyle = GOLD_GLOW_COLOR;
        ctx.globalAlpha = t * 0.42 * bucketPulse;
        ctx.fillRect(g.bucketX - 2, bY - 2, g.bucketW + 4, BUCKET_H + 4);
        ctx.globalAlpha = 1;
      }

      // Core bucket (bright gold, denser dots)
      ctx.fillStyle = GOLD_GLOW_COLOR;
      for (let bx = g.bucketX; bx < g.bucketX + g.bucketW; bx += 4) {
        ctx.globalAlpha = 0.75 * bucketPulse;
        ctx.fillRect(Math.round(bx), bY, 2, 2);
        ctx.fillRect(Math.round(bx), bY + BUCKET_H, 2, 2);
      }
      for (let by = bY; by <= bY + BUCKET_H; by += 3) {
        ctx.globalAlpha = 0.75 * bucketPulse;
        ctx.fillRect(Math.round(g.bucketX),                 Math.round(by), 2, 2);
        ctx.fillRect(Math.round(g.bucketX + g.bucketW - 2), Math.round(by), 2, 2);
      }
      ctx.globalAlpha = 1;

      // ── Low-ammo danger: pulsing red edge vignette when shots run low ──────
      if ((g.phase === 'aiming' || g.phase === 'firing') && g.shotsLeft > 0 && g.shotsLeft <= 2) {
        const danger = g.shotsLeft === 1 ? 1 : 0.6;
        const pulse  = 0.45 + 0.55 * Math.abs(Math.sin(g.frame * (g.shotsLeft === 1 ? 0.16 : 0.10)));
        const peak   = (0.5 * danger * pulse).toFixed(3);
        const band   = 64;
        // top
        let gr = ctx.createLinearGradient(0, 0, 0, band);
        gr.addColorStop(0, `rgba(216,30,30,${peak})`); gr.addColorStop(1, 'rgba(216,30,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, band);
        // bottom
        gr = ctx.createLinearGradient(0, H, 0, H - band);
        gr.addColorStop(0, `rgba(216,30,30,${peak})`); gr.addColorStop(1, 'rgba(216,30,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, H - band, W, band);
        // left
        gr = ctx.createLinearGradient(0, 0, band, 0);
        gr.addColorStop(0, `rgba(216,30,30,${peak})`); gr.addColorStop(1, 'rgba(216,30,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, band, H);
        // right
        gr = ctx.createLinearGradient(W, 0, W - band, 0);
        gr.addColorStop(0, `rgba(216,30,30,${peak})`); gr.addColorStop(1, 'rgba(216,30,30,0)');
        ctx.fillStyle = gr; ctx.fillRect(W - band, 0, band, H);
        ctx.globalAlpha = 1;
      }

      // ── Level clear countdown → next level ────────────────────────────────
      if (g.phase === 'levelclear') {
        g.levelClearTimer--;
        if (g.levelClearTimer <= 0) {
          const sk = specialKind(g.level);
          // Clear replenishment tightens with level: <5 → +5, 5-9 → +4, 10+ → +3.
          const refill = g.level >= 10 ? 3 : g.level >= 5 ? 4 : 5;
          g.score += g.shotsLeft * 200 + (sk === 'boss' ? 3000 : sk === 'special' ? 1500 : 0);
          g.shotsLeft += refill;
          setScore(g.score);
          setShotsLeft(g.shotsLeft);
          setRefillPopup({ n: refill, key: g.frame }); // floating "+N", fades out
          initLevel(g.level + 1);
        }
      }

      // ── Bursts ────────────────────────────────────────────────────────────
      // Dead particles/bursts are compacted in place (write-index pass) instead of
      // rebuilding fresh arrays every frame — same elements, same order, no GC churn.
      let burstW = 0;
      for (const burst of g.bursts) {
        const ps = burst.particles;
        let pw = 0;
        for (const p of ps) {
          p.x  += p.vx; p.y  += p.vy;
          p.vy += 0.22; // gravity drag on particles
          p.vx *= 0.98;
          p.life--;
          if (p.life > 0) {
            const fade = Math.min(1, p.life / Math.max(1, p.maxLife * 0.5));
            ctx.fillStyle   = p.color ?? '#0f0f0d';
            ctx.globalAlpha = fade * 0.85;
            ctx.fillRect(
              Math.round(p.x - p.size * 0.5),
              Math.round(p.y - p.size * 0.5),
              p.size, p.size,
            );
            ps[pw++] = p;
          }
        }
        ps.length = pw;
        if (pw > 0) g.bursts[burstW++] = burst;
      }
      g.bursts.length = burstW;
      ctx.globalAlpha = 1;

      // ── Peg break animations ──────────────────────────────────────────────
      ctx.fillStyle = '#0f0f0d';
      let pbW = 0;
      for (const pb of g.pegBreaks) {
        const ps = pb.particles;
        let pw = 0;
        for (const p of ps) {
          p.x  += p.vx; p.y  += p.vy;
          p.vy += 0.14; // lighter gravity than burst
          p.vx *= 0.97;
          p.life--;
          if (p.life > 0) {
            const fade = Math.min(1, p.life / Math.max(1, p.maxLife * 0.55));
            ctx.globalAlpha = fade * 0.92;
            ctx.fillRect(
              Math.round(p.x - p.size * 0.5),
              Math.round(p.y - p.size * 0.5),
              p.size, p.size,
            );
            ps[pw++] = p;
          }
        }
        ps.length = pw;
        if (pw > 0) g.pegBreaks[pbW++] = pb;
      }
      g.pegBreaks.length = pbW;
      ctx.globalAlpha = 1;

      // Screen flash on bucket catch
      if (g.bucketFlashTimer > 0) {
        g.bucketFlashTimer--;
        const ft = g.bucketFlashTimer / 14;
        ctx.fillStyle = '#f5d46a';
        ctx.globalAlpha = ft * 0.28;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      } // end steps loop
      rafRef.current = requestAnimationFrame(loop);
    };

    loopFnRef.current = loop;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initLevel]);

  // ── Visibility change ────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      if (document.hidden) cancelAnimationFrame(rafRef.current);
      else { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(loopFnRef.current); }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // ── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    syncSize();
    const ro = new ResizeObserver(() => syncSize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [syncSize]);

  // ── EIP-6963 wallet detection ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const addWallet = (detail: EIP6963Wallet) => {
      if (!detail?.info?.uuid) return;
      setDetectedWallets(prev => prev.some(w => w.info.uuid === detail.info.uuid) ? prev : [...prev, detail]);
    };
    const handler = (e: Event) => addWallet((e as CustomEvent).detail as EIP6963Wallet);
    window.addEventListener('eip6963:announceProvider', handler);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const win = window as { ethereum?: Eip1193Provider & { isRabby?: boolean; isMetaMask?: boolean; isCoinbaseWallet?: boolean; isBraveWallet?: boolean } };
    if (win.ethereum) {
      const eth  = win.ethereum;
      const name = eth.isRabby ? 'Rabby' : eth.isCoinbaseWallet ? 'Coinbase Wallet' : eth.isBraveWallet ? 'Brave Wallet' : eth.isMetaMask ? 'MetaMask' : 'Injected Wallet';
      addWallet({ info: { uuid: 'legacy', name, icon: '', rdns: 'window.ethereum' }, provider: eth });
    }
    return () => window.removeEventListener('eip6963:announceProvider', handler);
  }, []);

  // ── Farcaster context ─────────────────────────────────────────────────────
  useEffect(() => {
    import('@farcaster/miniapp-sdk').then(({ sdk }) => {
      sdk.actions.ready().catch(() => {});
      sdk.context.then(ctx => { if (ctx?.user?.fid) setInFarcaster(true); }).catch(() => {});
    }).catch(() => {});
  }, []);

  // ── Wallet connect ────────────────────────────────────────────────────────
  const handleConnectWallet   = useCallback(() => setShowWalletModal(true), []);

  const connectWithProvider = useCallback(async (wallet: 'farcaster' | EIP6963Wallet) => {
    setShowWalletModal(false);
    setWalletConnecting(true);
    try {
      let provider: Eip1193Provider;
      if (wallet === 'farcaster') {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        const p = sdk.wallet.ethProvider;
        if (!p) throw new Error('no provider');
        provider = p as Eip1193Provider;
      } else {
        provider = wallet.provider;
      }
      selectedProviderRef.current = provider;
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (accounts[0]) setWalletAddress(accounts[0]);
    } catch (err) { console.error(err); }
    finally { setWalletConnecting(false); }
  }, []);

  // ── Record score on-chain ─────────────────────────────────────────────────
  const handleRecordScore = useCallback(async () => {
    if (txState !== 'idle' && txState !== 'error') return;
    setTxState('pending');
    try {
      const provider = selectedProviderRef.current;
      if (!provider) throw new Error('no wallet');

      // Switch to Base mainnet; add it first if missing (4902)
      try {
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
      } catch (switchErr) {
        const code = (switchErr as { code?: number }).code;
        if (code === 4001) throw switchErr; // user rejected
        if (code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
        }
        // other errors (e.g. already on Base) — continue
      }

      const { createWalletClient, custom } = await import('viem');
      const { base }                       = await import('viem/chains');
      const { CONTRACT_ADDRESS, LEADERBOARD_ABI } = await import('@/lib/contract');
      const { DATA_SUFFIX }                = await import('@/lib/attribution');

      console.log('[DotShot] submitScore →', CONTRACT_ADDRESS, 'score:', G.current.score, 'level:', G.current.level);

      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider as Parameters<typeof custom>[0]),
      });
      const address = (walletAddress ?? (await walletClient.getAddresses())[0]) as `0x${string}`;
      const hash = await walletClient.writeContract({
        account: address,
        address: CONTRACT_ADDRESS,
        abi: LEADERBOARD_ABI,
        functionName: 'submitScore',
        args: [BigInt(G.current.score), BigInt(G.current.level)],
        dataSuffix: DATA_SUFFIX, // ERC-8021 builder attribution for Base Build tracking
      });
      setTxHash(hash);
      setTxState('success');
    } catch (err) { console.error('[DotShot] tx error:', err); setTxState('error'); }
  }, [txState, walletAddress]);

  // ── Share on Farcaster ────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const g      = G.current;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const url    = appUrl ? `${appUrl}/share?score=${g.score}&level=${g.level}` : '';
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk');
      await sdk.actions.composeCast({
        text: `I scored ${g.score} pts in DotShot (Level ${g.level})! Can you beat me?`,
        embeds: url ? [url] : [],
      });
    } catch { /* not in Farcaster */ }
  }, []);

  // ── Styles ────────────────────────────────────────────────────────────────
  const FONT  = `"Helvetica Neue", Arial, sans-serif`;
  const CREAM = '#ede9df';
  const INK   = '#0f0f0d';
  const MUTED = '#7a7670';

  const pillBtn = (filled: boolean): React.CSSProperties => ({
    padding: '13px 34px',
    border: `1.5px solid ${filled ? INK : 'rgba(15,15,13,0.45)'}`,
    borderRadius: 9999,
    background: filled ? INK : 'transparent',
    color: filled ? CREAM : INK,
    fontSize: 14, fontWeight: 700,
    fontFamily: FONT, letterSpacing: '0.04em',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  });

  const labelStyle: React.CSSProperties = {
    color: MUTED, fontSize: 10, fontWeight: 700,
    letterSpacing: '0.16em', fontFamily: FONT,
    textTransform: 'uppercase', marginBottom: 10,
  };

  const WalletIcon = () => (
    <svg width="20" height="20" viewBox="0 0 1000 1000" fill="none">
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" fill="white"/>
      <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.444H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z" fill="white"/>
      <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.444H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z" fill="white"/>
    </svg>
  );

  return (
    <div style={{ width: '100%', height: '100dvh', display: 'flex', justifyContent: 'center', background: '#0f0f0d' }}>
    <div
      ref={wrapRef}
      style={{
        width: '100%', maxWidth: 430, height: '100dvh',
        position: 'relative',
        background: CREAM, overflow: 'hidden',
        touchAction: 'none', userSelect: 'none',
      }}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />

      {/* ── IDLE ──────────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 36px 64px', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 28, left: 36 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>{t.miniGame}</span>
          </div>
          <button
            style={{ position: 'absolute', top: 24, right: 36, background: 'transparent', border: `1px solid rgba(15,15,13,0.22)`, borderRadius: 9999, color: MUTED, fontSize: 11, fontFamily: FONT, fontWeight: 700, cursor: 'pointer', padding: '4px 10px', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.06em', pointerEvents: 'all' }}
            onPointerDown={(e) => { e.stopPropagation(); setLang(l => l === 'en' ? 'ja' : 'en'); }}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {lang === 'en' ? 'JA' : 'EN'}
          </button>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ color: INK, fontSize: 'clamp(58px, 17vw, 98px)', fontWeight: 900, lineHeight: 0.87, fontFamily: FONT, margin: 0, letterSpacing: '-0.025em' }}>
              DOT<br />SHOT
            </h1>
          </div>
          <p style={{ color: MUTED, fontSize: 15, fontFamily: FONT, lineHeight: 1.65, marginBottom: 40, maxWidth: 270 }}>
            {t.tagline1}<br />
            {t.tagline2}
          </p>
          <div style={{ pointerEvents: 'all' }}>
            <button
              style={pillBtn(true)}
              onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
              onPointerUp={(e) => e.stopPropagation()}
            >
              {t.startPlaying}
            </button>
          </div>
        </div>
      )}

      {/* ── PLAYING HUD ───────────────────────────────────────────────────── */}
      {(phase === 'aiming' || phase === 'firing') && (
        <>
          <div style={{ position: 'absolute', top: 42, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ ...labelStyle, textAlign: 'center' }}>{warpWalls ? 'LOOP' : 'WALL'}</div>
            <div style={{ width: 36, height: 3, borderRadius: 2, background: warpWalls ? '#6688ff' : '#c8a000' }} />
          </div>
          <div style={{ position: 'absolute', top: 20, left: 22, pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.levelLabel}</div>
            <div style={{ color: INK, fontSize: 42, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{level}</div>
            {specialKind(level) && (
              <div style={{ marginTop: 5, display: 'inline-flex', alignSelf: 'flex-start', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', fontFamily: FONT, padding: '2px 7px', borderRadius: 9999, color: specialKind(level) === 'boss' ? '#ede9df' : '#0f0f0d', background: specialKind(level) === 'boss' ? '#c8a000' : 'rgba(15,15,13,0.10)' }}>
                {specialKind(level) === 'boss' ? t.bossLabel : t.specialLabel}
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', top: 20, right: 22, textAlign: 'right', pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.targetsLabel}</div>
            <div style={{ color: INK, fontSize: 42, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{orangeLeft}</div>
          </div>
          <div style={{ position: 'absolute', bottom: 54, left: 22, pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.shotsLabel}</div>
            <div style={{ color: shotsLeft > 0 && shotsLeft <= 2 ? '#d81e1e' : INK, fontSize: 34, fontWeight: 900, lineHeight: 1, fontFamily: FONT, transformOrigin: 'left center', animation: shotsLeft > 0 && shotsLeft <= 2 ? 'ammoLow 0.6s ease-in-out infinite' : 'none' }}>{shotsLeft}</div>
            {refillPopup && (
              <div
                key={refillPopup.key}
                onAnimationEnd={() => setRefillPopup(null)}
                style={{ position: 'absolute', left: 0, bottom: 48, color: '#c8a000', fontSize: 22, fontWeight: 900, fontFamily: FONT, whiteSpace: 'nowrap', animation: 'refillPop 1.5s ease-out forwards' }}
              >
                +{refillPopup.n}
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: 54, right: 22, textAlign: 'right', pointerEvents: 'none' }}>
            <div style={labelStyle}>{t.scoreLabel}</div>
            <div style={{ color: INK, fontSize: 34, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{score}</div>
          </div>
          <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'all', display: 'flex', gap: 8 }}>
            <button
              style={{ background: 'transparent', border: `1px solid rgba(15,15,13,0.22)`, borderRadius: 9999, color: MUTED, fontSize: 13, fontFamily: FONT, fontWeight: 700, cursor: 'pointer', padding: '5px 14px', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.06em' }}
              onPointerDown={(e) => { e.stopPropagation(); handlePause(); }}
              onPointerUp={(e) => e.stopPropagation()}
            >
              II
            </button>
            <button
              style={{ background: speed > 1 ? INK : 'transparent', border: `1px solid rgba(15,15,13,0.22)`, borderRadius: 9999, color: speed > 1 ? '#ede9df' : MUTED, fontSize: 13, fontFamily: FONT, fontWeight: 700, cursor: 'pointer', padding: '5px 14px', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.06em' }}
              onPointerDown={(e) => { e.stopPropagation(); setSpeed(s => { const n: 1|2|3 = s === 1 ? 2 : s === 2 ? 3 : 1; speedRef.current = n; return n; }); }}
              onPointerUp={(e) => e.stopPropagation()}
            >
              ×{speed}
            </button>
          </div>
        </>
      )}

      {/* ── PAUSE ─────────────────────────────────────────────────────────── */}
      {phase === 'paused' && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(237,233,223,0.93)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 10, pointerEvents: 'all' }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {!confirmRetire ? (
            <>
              <div style={{ ...labelStyle, marginBottom: 0 }}>{t.paused}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <button style={{ ...pillBtn(true), minWidth: 180 }} onPointerDown={(e) => { e.stopPropagation(); handleResume(); }}>{t.resume}</button>
                <button style={{ ...pillBtn(false), minWidth: 180 }} onPointerDown={(e) => { e.stopPropagation(); setConfirmRetire(true); }}>{t.retire}</button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: INK, fontSize: 15, fontFamily: FONT, textAlign: 'center', margin: 0, padding: '0 40px', lineHeight: 1.6 }}>
                {t.confirmRetireText}<br />
                <span style={{ color: MUTED, fontSize: 13 }}>{t.confirmRetireSub}</span>
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={pillBtn(true)} onPointerDown={(e) => { e.stopPropagation(); handleRetire(); }}>{t.retireConfirm}</button>
                <button style={pillBtn(false)} onPointerDown={(e) => { e.stopPropagation(); setConfirmRetire(false); }}>{t.cancel}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LEVEL CLEAR ───────────────────────────────────────────────────── */}
      {phase === 'levelclear' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            {specialKind(level) && (
              <div style={{ fontSize: 'clamp(18px, 5vw, 26px)', fontWeight: 900, fontFamily: FONT, letterSpacing: '0.18em', marginBottom: 10, color: specialKind(level) === 'boss' ? '#c8a000' : INK }}>
                {specialKind(level) === 'boss' ? t.bossLabel : t.specialLabel}
              </div>
            )}
            <div style={{ color: INK, fontSize: 'clamp(50px, 14vw, 78px)', fontWeight: 900, fontFamily: FONT, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {lang === 'ja' ? `レベル${level}` : `LEVEL ${level}`}<br />
              <span style={{ fontSize: '0.50em', letterSpacing: '0.12em', color: MUTED }}>{t.cleared}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── WALLET MODAL ──────────────────────────────────────────────────── */}
      {showWalletModal && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(237,233,223,0.88)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 24px 56px', zIndex: 20 }}
          onPointerDown={(e) => { e.stopPropagation(); setShowWalletModal(false); }}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div
            style={{ background: CREAM, border: `1.5px solid rgba(15,15,13,0.18)`, borderRadius: 20, padding: '20px 18px', display: 'flex', flexDirection: 'column' }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <div style={{ ...labelStyle, marginBottom: 16 }}>{t.selectWallet}</div>
            {inFarcaster && (
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', borderBottom: detectedWallets.length > 0 ? `1px solid rgba(15,15,13,0.1)` : 'none', padding: '12px 0', cursor: 'pointer', width: '100%', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={(e) => { e.stopPropagation(); connectWithProvider('farcaster'); }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 9, background: '#7c65c1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <WalletIcon />
                </div>
                <div>
                  <div style={{ color: INK, fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{t.fcWalletName}</div>
                  <div style={{ color: MUTED, fontSize: 11, fontFamily: FONT, marginTop: 2 }}>{t.fcWalletSub}</div>
                </div>
              </button>
            )}
            {detectedWallets.map((wallet, i) => (
              <button
                key={wallet.info.uuid}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', borderBottom: i < detectedWallets.length - 1 ? `1px solid rgba(15,15,13,0.1)` : 'none', padding: '12px 0', cursor: 'pointer', width: '100%', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={(e) => { e.stopPropagation(); connectWithProvider(wallet); }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 9, overflow: 'hidden', flexShrink: 0, background: '#e8e4da', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {wallet.info.icon?.startsWith('data:image/')
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={wallet.info.icon} alt={wallet.info.name} width={38} height={38} style={{ display: 'block' }} />
                    : <div style={{ color: INK, fontSize: 14, fontWeight: 700 }}>{wallet.info.name[0]}</div>}
                </div>
                <div>
                  <div style={{ color: INK, fontSize: 14, fontWeight: 700, fontFamily: FONT }}>{wallet.info.name}</div>
                  <div style={{ color: MUTED, fontSize: 11, fontFamily: FONT, marginTop: 2 }}>{wallet.info.rdns}</div>
                </div>
              </button>
            ))}
            {!inFarcaster && detectedWallets.length === 0 && (
              <div style={{ color: MUTED, fontSize: 13, fontFamily: FONT, padding: '12px 0', lineHeight: 1.6 }}>
                {t.noWallets}
              </div>
            )}
            <button
              style={{ marginTop: 14, padding: '12px 0', background: 'transparent', border: `1px solid rgba(15,15,13,0.25)`, borderRadius: 9999, color: MUTED, fontSize: 13, fontFamily: FONT, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              onPointerDown={(e) => { e.stopPropagation(); setShowWalletModal(false); }}
            >
              {t.walletCancel}
            </button>
          </div>
        </div>
      )}

      {/* ── GAME OVER ─────────────────────────────────────────────────────── */}
      {phase === 'gameover' && (
        <div
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 36px 64px', background: 'rgba(237,233,223,0.88)', pointerEvents: 'all', containerType: 'inline-size' }}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div style={{ position: 'absolute', top: 26, left: 28 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>{retired ? t.retiredLabel : t.gameOver}</span>
          </div>
          <button
            style={{ position: 'absolute', top: 24, right: 28, background: 'transparent', border: `1px solid rgba(15,15,13,0.22)`, borderRadius: 9999, color: MUTED, fontSize: 11, fontFamily: FONT, fontWeight: 700, cursor: 'pointer', padding: '4px 10px', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.06em', pointerEvents: 'all' }}
            onPointerDown={(e) => { e.stopPropagation(); setLang(l => l === 'en' ? 'ja' : 'en'); }}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {lang === 'en' ? 'JA' : 'EN'}
          </button>
          {walletAddress && (
            <div style={{ position: 'absolute', top: 22, right: 90, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: MUTED, fontSize: 10, fontFamily: FONT, letterSpacing: '0.06em' }}>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <button
                style={{ background: 'transparent', border: `1px solid rgba(15,15,13,0.25)`, borderRadius: 9999, color: MUTED, fontSize: 10, fontFamily: FONT, padding: '3px 10px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={(e) => { e.stopPropagation(); setWalletAddress(null); setTxState('idle'); setTxHash(null); selectedProviderRef.current = null; }}
              >
                {t.disconnect}
              </button>
            </div>
          )}
          <div style={{ marginBottom: 6, maxWidth: '100%' }}>
            <div style={labelStyle}>{t.scoreLabel}</div>
            <div style={{ color: INK, fontSize: 'clamp(56px, 22cqw, 120px)', fontWeight: 900, lineHeight: 0.86, fontFamily: FONT, letterSpacing: '-0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip' }}>
              {score}
            </div>
          </div>
          <p style={{ color: MUTED, fontSize: 15, fontFamily: FONT, marginBottom: 10 }}>
            {t.levelSummary(retired, level, orangeLeft)}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <button style={pillBtn(true)} onPointerDown={(e) => { e.stopPropagation(); startGame(); }} onPointerUp={(e) => e.stopPropagation()}>{t.playAgain}</button>
            <button style={pillBtn(false)} onPointerDown={(e) => { e.stopPropagation(); handleShare(); }}>{t.share}</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {score === 0 ? (
                <span style={{ color: MUTED, fontSize: 12, fontFamily: FONT }}>{t.scoreZero}</span>
              ) : (
                <>
                  {!walletAddress && txState === 'idle' && (
                    <button
                      style={{ ...pillBtn(false), opacity: walletConnecting ? 0.5 : 1 }}
                      onPointerDown={(e) => { e.stopPropagation(); handleConnectWallet(); }}
                    >
                      {walletConnecting ? t.connecting : t.connectWallet}
                    </button>
                  )}
                  {walletAddress && txState !== 'success' && (
                    <button
                      style={{ ...pillBtn(false), opacity: txState === 'pending' ? 0.5 : 1, pointerEvents: txState === 'pending' ? 'none' : 'auto' }}
                      onPointerDown={(e) => { e.stopPropagation(); handleRecordScore(); }}
                    >
                      {txState === 'idle' ? t.recordOnChain : txState === 'pending' ? t.recording : t.failedRetry}
                    </button>
                  )}
                </>
              )}
              {txState === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ color: MUTED, fontSize: 12, fontFamily: FONT, letterSpacing: '0.08em' }}>{t.scoreRecorded}</span>
                  {txHash && (
                    <button
                      style={{ ...pillBtn(false), fontSize: 12 }}
                      onPointerDown={async (e) => {
                        e.stopPropagation();
                        try { const { sdk } = await import('@farcaster/miniapp-sdk'); await sdk.actions.openUrl(`https://basescan.org/tx/${txHash}`); } catch { /* no-op */ }
                      }}
                    >
                      {t.viewOnBasescan}
                    </button>
                  )}
                </div>
              )}
            </div>
        </div>
      )}
    </div>
    </div>
  );
}
