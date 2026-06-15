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
interface Dot { x: number; y: number; size: number; alpha: number; phase: number }
interface BgDot { x: number; y: number; vx: number; vy: number; size: number; alpha: number; targetAlpha: number; age: number; maxAge: number }
interface BurstP  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color?: string }
interface Burst   { particles: BurstP[] }
interface BreakP  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }
interface PegBreak { particles: BreakP[] }
interface TrajPt  { x: number; y: number }
interface GravZone { x: number; y: number; w: number; h: number }
interface Wormhole {
  cx: number; cy: number;
  w: number; h: number;
  angle: number;
  pairId: number;
  pairSlot: 0 | 1;
  cycleTimer: number;
  hitCool: number;
  dots: Dot[];
  auraDots: Dot[];
}

type PegType = 'orange' | 'blue' | 'purple' | 'bomb' | 'split' | 'magnet';
type Phase   = 'idle' | 'aiming' | 'firing' | 'levelclear' | 'gameover';

interface Peg {
  x: number; y: number;
  type: PegType;
  cleared: boolean;
  hitCool: number;
  dots: Dot[];
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

interface Ball { x: number; y: number; vx: number; vy: number; dots: Dot[]; isBucketBall: boolean }

interface GameState {
  phase: Phase;
  pegs: Peg[];
  bumpers: Bumper[];
  balls: Ball[];           // all active balls
  burstRemaining: number;  // balls yet to be launched in current burst
  burstTimer: number;      // frames until next ball launch
  burstAngle: number;      // locked aim angle for the current burst
  burstLuckyIdx: number;   // index of the guaranteed bucket ball in current burst
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
  warpWalls: boolean;
  gravZones: GravZone[];
  wormholes: Wormhole[];
  rng: () => number;
  levelClearTimer: number;
  orangeLeft: number;
  bucketGlowTimer: number;
  bucketFlashTimer: number;
  burstTime: number;
}

type Eip1193Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type EIP6963Wallet   = { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193Provider };

// ─── Dot helpers ──────────────────────────────────────────────────────────────
function rnd(n: number) { return (Math.random() - 0.5) * n; }

function makeDot(x: number, y: number, sizeW = 1.0): Dot {
  const s = Math.random();
  return {
    x: x + rnd(2),
    y: y + rnd(2),
    size: Math.max(1, Math.round((s < 0.55 ? 1 : s < 0.88 ? 2 : 3) * sizeW)),
    alpha: 0.58 + Math.random() * 0.42,
    phase: Math.random() * Math.PI * 2,
  };
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
    dots.push({ x: 0, y: 0, size: 3, alpha: 1.0, phase: 0 });
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
  dots.push({ x: 0, y: 0, size: 2, alpha: 0.90, phase: 0 });
  return dots;
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
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
  for (const d of dots) {
    const jx = Math.sin(frame * 0.038 + d.phase) * 0.55;
    const jy = Math.cos(frame * 0.031 + d.phase * 1.27) * 0.55;
    const rx = (d.x + jx) * cos - (d.y + jy) * sin;
    const ry = (d.x + jx) * sin + (d.y + jy) * cos;
    ctx.globalAlpha = d.alpha * alphaMult;
    ctx.fillRect(Math.round(cx + rx - d.size * 0.5), Math.round(cy + ry - d.size * 0.5), d.size, d.size);
  }
  ctx.globalAlpha = 1;
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

// ─── Velocity-scaled burst ────────────────────────────────────────────────────
// Intensity scales from 0 (dead slow) to 1 (full speed). The visible difference
// between a graze and a direct fast hit is the whole point of this system.
//
//  speed  3  → intensity 0.09 →  9 particles, speed×1.0  (gentle poof)
//  speed 10  → intensity 0.53 → 31 particles, speed×3.4  (solid burst)
//  speed 18  → intensity 1.00 → 55 particles, speed×6.0  (explosive scatter)
function spawnBurst(g: GameState, cx: number, cy: number, bvx: number, bvy: number) {
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
    };
  });
  g.bursts.push({ particles });
}

// ─── Peg break animation (plays when ball exits and lit pegs are cleared) ─────
// Radially symmetric shatter: all dots fly outward simultaneously.
// Orange (filled) → many particles from the interior.
// Blue  (outline) → fewer particles arranged in a ring.
function spawnPegBreak(g: GameState, peg: Peg) {
  const isFilled = peg.type !== 'blue';
  const count    = peg.type === 'orange' ? 28 : peg.type === 'purple' ? 22 : 14;
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
    dots.push({ x, y, size: Math.random() < 0.55 ? 1 : 2, alpha: 0.28 + Math.random() * 0.48, phase: Math.random() * Math.PI * 2 });
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

// ─── Level generation ─────────────────────────────────────────────────────────
function generateLevel(W: number, H: number, launcherY: number, rng: () => number, level = 1): { pegs: Peg[], orangeTotal: number, bumpers: Bumper[], gravZones: GravZone[], wormholes: Wormhole[] } {
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

  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * STEP_X * 0.5;
    const cols   = row % 2 === 0 ? BASE_COLS : BASE_COLS - 1;
    for (let col = 0; col < cols; col++) {
      if (rng() > 0.82) continue;
      const x = startX + col * STEP_X + offset + rnd(STEP_X * 0.20);
      const y = topPad + row * STEP_Y + STEP_Y * 0.5 + rnd(STEP_Y * 0.18);
      const tooClose = pegs.some(p => { const dx = p.x - x, dy = p.y - y; return dx*dx + dy*dy < (PEG_R * 2.5) ** 2; });
      if (tooClose) continue;
      const tr   = rng();
      const type: PegType = tr < 0.38 ? 'orange' : tr < 0.97 ? 'blue' : 'purple';
      pegs.push({ x, y, type, cleared: false, hitCool: 0, dots: makePegDots(type) });
    }
  }

  // Guarantee at least 12 orange pegs
  const orangeCount = pegs.filter(p => p.type === 'orange').length;
  if (orangeCount < 12) {
    const blues = pegs.filter(p => p.type === 'blue');
    let toConvert = Math.min(12 - orangeCount, blues.length);
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

  // ── Gravity zones (level 7+) ──────────────────────────────────────────────
  const gravZones: GravZone[] = [];
  if (level >= 7) {
    const zoneW = W * 0.55;
    const zoneH = 55;
    const zoneX = (W - zoneW) * (0.1 + gimmickRng() * 0.8);
    const zoneY = topPad + playH * (0.25 + gimmickRng() * 0.40);
    gravZones.push({ x: zoneX, y: zoneY, w: zoneW, h: zoneH });
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
        wormholes.push({ cx, cy, w, h: 5, angle, pairId: p, pairSlot: slot as 0 | 1, cycleTimer: cycleOffset, hitCool: 0, dots: makeBumperDots(w, 5), auraDots: makeWormholeAura(w) });
      }
    }
  }

  return { pegs, orangeTotal: pegs.filter(p => p.type === 'orange').length, bumpers, gravZones, wormholes };
}

// ─── Trajectory preview ───────────────────────────────────────────────────────
function computeTrajectory(sx: number, sy: number, vx: number, vy: number, pegs: Peg[], W: number, windForce = 0, warpWalls = false): TrajPt[] {
  const pts: TrajPt[] = [];
  let x = sx, y = sy, tvx = vx, tvy = vy;
  for (let i = 0; i < 90; i++) {
    tvy += GRAVITY;
    tvx += windForce;
    tvx = Math.max(-BALL_SPEED * 2, Math.min(BALL_SPEED * 2, tvx));
    x  += tvx; y += tvy;
    if (warpWalls) {
      if (x < -BALL_R)      x += W + BALL_R * 2;
      if (x > W + BALL_R)   x -= W + BALL_R * 2;
    } else {
      if (x - BALL_R < 0)  { x = BALL_R;     tvx =  Math.abs(tvx); }
      if (x + BALL_R > W)  { x = W - BALL_R; tvx = -Math.abs(tvx); }
    }
    pts.push({ x, y });
    let hit = false;
    for (const p of pegs) {
      if (p.cleared || p.type === 'magnet') continue;
      const dx = x - p.x, dy = y - p.y;
      if (dx*dx + dy*dy < (BALL_R + PEG_R) ** 2) { hit = true; break; }
    }
    if (hit || y > sy + 520) break;
  }
  return pts;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CryptoPeggleGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const rafRef    = useRef(0);

  const G = useRef<GameState>({
    phase: 'idle',
    pegs: [], bumpers: [],
    balls: [],
    burstRemaining: 0, burstTimer: 0, burstAngle: 0, burstLuckyIdx: 0,
    shotsLeft: SHOTS_START, score: 0, level: 1,
    aimAngle: 0,
    bursts: [], pegBreaks: [],
    bgDots: [], bgClusterTimer: 0,
    frame: 0,
    W: 390, H: 780,
    launcherX: 195, launcherY: 60,
    bucketX: 155, bucketDir: 1,
    bucketW: BUCKET_W, bucketSpd: BUCKET_SPD,
    windForce: 0,
    warpWalls: false,
    gravZones: [],
    wormholes: [],
    rng: () => 0,
    levelClearTimer: 0,
    orangeLeft: 0,
    bucketGlowTimer: 0,
    bucketFlashTimer: 0,
    burstTime: 0,
  });

  const preventNextFire = useRef(false);

  const [phase,      setPhase]      = useState<Phase>('idle');
  const [shotsLeft,  setShotsLeft]  = useState(SHOTS_START);
  const [score,      setScore]      = useState(0);
  const [level,      setLevel]      = useState(1);
  const [orangeLeft, setOrangeLeft] = useState(0);
  const [warpWalls,  setWarpWalls]  = useState(false);
  const [txState,    setTxState]    = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txHash,     setTxHash]     = useState<string | null>(null);
  const [walletAddress,    setWalletAddress]    = useState<string | null>(null);
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [showWalletModal,  setShowWalletModal]  = useState(false);
  const [detectedWallets,  setDetectedWallets]  = useState<EIP6963Wallet[]>([]);
  const [inFarcaster,      setInFarcaster]      = useState(false);
  const selectedProviderRef = useRef<Eip1193Provider | null>(null);

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
    const { pegs, orangeTotal, bumpers, gravZones, wormholes } = generateLevel(g.W, g.H, g.launcherY, g.rng, lv);
    g.level          = lv;
    g.pegs           = pegs;
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
    g.gravZones  = gravZones;
    g.wormholes  = wormholes;
    g.warpWalls = lv <= 2 ? false : g.rng() < 0.5;
    g.windForce = lv >= 4 ? Math.min(WIND_MAX, (lv - 3) * 0.003) * (lv % 2 === 0 ? 1 : -1) : 0;
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
    setTxState('idle');
    setTxHash(null);
    preventNextFire.current = true; // block the pointerUp that follows this tap
    initLevel(1);
  }, [syncSize, initLevel]);

  // ── Start burst ───────────────────────────────────────────────────────────
  const fireBall = useCallback(() => {
    const g = G.current;
    if (g.phase !== 'aiming' || g.shotsLeft <= 0) return;
    g.burstAngle     = g.aimAngle;
    g.burstRemaining = BALLS_PER_SHOT;
    g.burstTimer     = 0; // launch first ball immediately
    g.burstLuckyIdx  = Math.floor(Math.random() * BALLS_PER_SHOT);
    g.burstTime      = 0;
    g.shotsLeft--;
    g.phase = 'firing';
    setShotsLeft(g.shotsLeft);
    setPhase('firing');
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = () => {
      const g = G.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      const { W, H, launcherX, launcherY } = g;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W; canvas.height = H;
      }
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
      const aliveBg: BgDot[] = [];
      for (const d of g.bgDots) {
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
        aliveBg.push(d.age < d.maxAge ? d : spawnBgDot(W, H));
      }
      g.bgDots = aliveBg;
      ctx.globalAlpha = 1;

      if (g.phase === 'idle') { rafRef.current = requestAnimationFrame(loop); return; }

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
          for (const pass of bloomPasses) {
            ctx.fillStyle = pass.color;
            for (const d of bumper.dots) {
              const jx = Math.sin(g.frame * 0.038 + d.phase) * 0.55;
              const jy = Math.cos(g.frame * 0.031 + d.phase * 1.27) * 0.55;
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

      // ── Grav zones (black hole, swirling sand storm) ─────────────────────
      for (const zone of g.gravZones) {
        const cx      = zone.x + zone.w / 2;
        const cy      = zone.y + zone.h / 2;
        const maxR    = zone.h * 1.55;
        const t       = g.frame * 0.010; // very slow base rotation
        const f       = g.frame;         // shorthand for wobble phases
        const flicker = 0.80 + Math.sin(f * 0.19) * 0.20;
        const GOLDEN  = 2.39996; // golden angle (rad)

        // ── Sand veil A: outer fibonacci dust (360 grains) + wobble ──────────
        for (let i = 0; i < 360; i++) {
          const frac  = i / 359;
          const r     = maxR * (0.14 + frac * 0.90) * (0.91 + Math.sin(i * 2.7 + t * 0.18) * 0.09);
          if (r > maxR * 1.04) continue;
          const angle = i * GOLDEN + t * (0.50 + frac * 0.28);
          const wx    = Math.sin(f * 0.053 + i * 1.37) * 3.5;
          const wy    = Math.cos(f * 0.047 + i * 2.11) * 3.5;
          ctx.globalAlpha = flicker * (1 - frac * 0.50) * (0.32 + Math.sin(i * 1.91 + t * 0.07) * 0.14);
          ctx.fillStyle   = frac < 0.35 ? '#3a0016' : frac < 0.65 ? '#1e000a' : '#0c0006';
          ctx.fillRect(Math.round(cx + Math.cos(angle) * r + wx), Math.round(cy + Math.sin(angle) * r + wy), 1, 1);
        }

        // ── Sand veil B: second offset dust cloud (240 grains) + wobble ──────
        for (let i = 0; i < 240; i++) {
          const frac  = i / 239;
          const r     = maxR * (0.20 + frac * 0.72) * (0.89 + Math.sin(i * 3.3 + t * 0.14) * 0.11);
          if (r > maxR * 1.02) continue;
          const angle = i * GOLDEN * 2 + t * (0.35 + frac * 0.22) + Math.PI;
          const wx    = Math.sin(f * 0.061 + i * 2.39) * 2.8;
          const wy    = Math.cos(f * 0.044 + i * 1.73) * 2.8;
          ctx.globalAlpha = flicker * (1 - frac * 0.55) * (0.22 + Math.sin(i * 2.5 + t * 0.09) * 0.10);
          ctx.fillStyle   = frac < 0.4 ? '#280010' : '#120007';
          ctx.fillRect(Math.round(cx + Math.cos(angle) * r + wx), Math.round(cy + Math.sin(angle) * r + wy), 1, 1);
        }

        // ── Inner storm A: counter-spiral (280 grains) + wobble ───────────────
        for (let i = 0; i < 280; i++) {
          const frac  = i / 279;
          const r     = maxR * (0.06 + frac * 0.66) * (0.87 + Math.sin(i * 3.1 + t * 0.24) * 0.13);
          const angle = i * GOLDEN * 1.618 - t * 1.4;
          const wx    = Math.sin(f * 0.058 + i * 1.91) * 2.5;
          const wy    = Math.cos(f * 0.051 + i * 2.83) * 2.5;
          const sz    = frac < 0.20 ? 2 : 1;
          ctx.globalAlpha = flicker * (1 - frac * 0.65) * (0.60 + Math.sin(i * 2.3 + t * 0.12) * 0.24);
          ctx.fillStyle   = frac < 0.28 ? '#620024' : frac < 0.58 ? '#3a0018' : '#1e000c';
          ctx.fillRect(Math.round(cx + Math.cos(angle) * r + wx) - (sz >> 1), Math.round(cy + Math.sin(angle) * r + wy) - (sz >> 1), sz, sz);
        }

        // ── Inner storm B: clockwise fast layer (180 grains) + wobble ─────────
        for (let i = 0; i < 180; i++) {
          const frac  = i / 179;
          const r     = maxR * (0.10 + frac * 0.55) * (0.90 + Math.sin(i * 4.1 + t * 0.30) * 0.10);
          const angle = i * GOLDEN * 0.618 + t * 2.1;
          const wx    = Math.sin(f * 0.067 + i * 3.14) * 2.2;
          const wy    = Math.cos(f * 0.055 + i * 1.57) * 2.2;
          ctx.globalAlpha = flicker * (1 - frac * 0.72) * (0.45 + Math.sin(i * 1.7 + t * 0.16) * 0.18);
          ctx.fillStyle   = frac < 0.35 ? '#440018' : '#220010';
          ctx.fillRect(Math.round(cx + Math.cos(angle) * r + wx), Math.round(cy + Math.sin(angle) * r + wy), 1, 1);
        }

        ctx.globalAlpha = 1;

        // ── Halo rings (original 11 rings) — static, non-rotating ────────────
        for (let ri = 0; ri < 11; ri++) {
          const r        = maxR * (0.14 + ri * 0.09);
          if (r > maxR * 1.05) break;
          const alpha    = flicker * 0.88 * Math.pow(Math.max(0, 1 - r / maxR), 1.2);
          if (alpha < 0.02) continue;
          const dotGap   = 3.5 + ri * 0.6;
          const dotCount = Math.max(4, Math.round(2 * Math.PI * r / dotGap));
          const sz       = Math.max(1, 3 - Math.floor(ri * 0.5));
          ctx.globalAlpha = alpha;
          ctx.fillStyle   = ri < 4 ? '#1a0010' : ri < 7 ? '#0d000a' : '#000';
          for (let j = 0; j < dotCount; j++) {
            const a = (j / dotCount) * Math.PI * 2;
            ctx.fillRect(Math.round(cx + Math.cos(a) * r) - (sz >> 1), Math.round(cy + Math.sin(a) * r) - (sz >> 1), sz, sz);
          }
        }

        // ── 4 spiral arms (90 dots/arm) + wobble jitter ───────────────────────
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t);
        for (let arm = 0; arm < 4; arm++) {
          ctx.rotate(Math.PI / 2);
          for (let i = 0; i < 90; i++) {
            const frac = i / 89;
            const a  = frac * Math.PI * 2.2;
            const sr = frac * maxR * 0.94 + maxR * 0.07;
            const jx = Math.sin(i * 3.7 + t * 0.28) * 4.0 + Math.sin(f * 0.053 + arm * 1.1 + i * 1.37) * 4.0;
            const jy = Math.cos(i * 2.9 + t * 0.23) * 3.5 + Math.cos(f * 0.047 + arm * 1.1 + i * 2.11) * 4.0;
            const sz = Math.max(1, Math.round(3.4 - frac * 2.4));
            ctx.globalAlpha = (1 - frac) * 0.82 * flicker;
            ctx.fillStyle   = frac < 0.22 ? '#cc0022' : frac < 0.50 ? '#660033' : frac < 0.75 ? '#330022' : '#110011';
            ctx.fillRect(Math.round(Math.cos(a) * sr + jx) - (sz >> 1), Math.round(Math.sin(a) * sr + jy) - (sz >> 1), sz, sz);
          }
        }
        ctx.restore();

        // ── 16 outer tendrils (36 dots each) + wobble ─────────────────────────
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-t * 1.95);
        for (let i = 0; i < 16; i++) {
          ctx.rotate(Math.PI / 8);
          for (let j = 0; j < 36; j++) {
            const frac    = j / 35;
            const sr      = maxR * (0.45 + frac * 0.58);
            const jitter  = Math.sin(j * 2.1 + i * 0.9 + t * 0.38) * 3.5
                          + Math.sin(f * 0.059 + i * 1.9 + j * 0.7) * 3.0;
            const wobAlong = Math.round(Math.cos(f * 0.043 + i * 2.3 + j * 1.1) * 2.5);
            ctx.globalAlpha = (1 - frac) * 0.34 * flicker;
            ctx.fillStyle   = frac < 0.5 ? '#550022' : '#220011';
            ctx.fillRect(Math.round(sr) - 1 + wobAlong, Math.round(jitter), 1, 1);
          }
        }
        ctx.restore();

        // ── 5 counter-rotating rings (48–112 dots) + wobble ───────────────────
        for (let ring = 0; ring < 5; ring++) {
          const rr   = maxR * (0.42 + ring * 0.13);
          const spd  = 3.0 + ring * 0.85;
          const dotN = 48 + ring * 16;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(-t * spd);
          ctx.fillStyle = ring < 2 ? '#cc0033' : ring < 4 ? '#880022' : '#550018';
          for (let i = 0; i < dotN; i++) {
            const a    = (i / dotN) * Math.PI * 2;
            const wx   = Math.sin(f * 0.053 + ring * 0.7 + i * 1.73) * 2.5;
            const wy   = Math.cos(f * 0.047 + ring * 0.7 + i * 2.39) * 2.5;
            ctx.globalAlpha = flicker * (0.26 + Math.sin(f * 0.09 + i * 0.7) * 0.16);
            ctx.fillRect(Math.round(Math.cos(a) * rr + wx) - 1, Math.round(Math.sin(a) * rr + wy) - 1, 2, 2);
          }
          ctx.restore();
        }

        // ── Event horizon: solid near-black disc (original density) ───────
        ctx.fillStyle = '#080004';
        for (let r = 0; r <= maxR * 0.26; r += 2.5) {
          const dotCount = Math.max(1, Math.round(2 * Math.PI * r / 3.0));
          ctx.globalAlpha = r < maxR * 0.16 ? 1.0 : 0.92;
          for (let j = 0; j < dotCount; j++) {
            const a = (j / dotCount) * Math.PI * 2;
            ctx.fillRect(Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);

        // ── Accretion ring: triple-pass blood-red ─────────────────────────
        const accR     = maxR * 0.34;
        const accPulse = (0.72 + Math.sin(g.frame * 0.11) * 0.28) * flicker;
        for (let pass = 0; pass < 3; pass++) {
          const rr   = accR + pass * 3.5;
          const dotN = 56 + pass * 18;
          ctx.fillStyle = pass === 0 ? '#ee0033' : pass === 1 ? '#bb0022' : '#880018';
          for (let i = 0; i < dotN; i++) {
            const a = (i / dotN) * Math.PI * 2;
            ctx.globalAlpha = accPulse * (pass === 0 ? 0.85 : pass === 1 ? 0.50 : 0.28) * (0.68 + Math.sin(g.frame * 0.13 + i * 0.4) * 0.32);
            ctx.fillRect(Math.round(cx + Math.cos(a) * rr) - 1, Math.round(cy + Math.sin(a) * rr) - 1, 2, 2);
          }
        }
        ctx.globalAlpha = 1;
      }

      // ── Wormholes ────────────────────────────────────────────────────────
      for (const wh of g.wormholes) {
        wh.cycleTimer = (wh.cycleTimer + 1) % WORMHOLE_CYCLE;
        if (wh.hitCool > 0) wh.hitCool--;

        const ct = wh.cycleTimer;
        if (ct >= WORMHOLE_ACTIVE) continue; // invisible phase, skip draw

        let fadeAlpha = 1.0;
        if (ct < WORMHOLE_FADE)
          fadeAlpha = (ct + 1) / WORMHOLE_FADE;
        else if (ct >= WORMHOLE_ACTIVE - WORMHOLE_FADE)
          fadeAlpha = (WORMHOLE_ACTIVE - ct) / WORMHOLE_FADE;

        const cosA = Math.cos(wh.angle), sinA = Math.sin(wh.angle);

        // Aura dots (purple mowa mowa cloud)
        for (const d of wh.auraDots) {
          const jx = Math.sin(g.frame * 0.042 + d.phase) * 1.4;
          const jy = Math.cos(g.frame * 0.037 + d.phase * 1.3) * 1.4;
          const lx = d.x + jx, ly = d.y + jy;
          const ax = wh.cx + lx * cosA - ly * sinA;
          const ay = wh.cy + lx * sinA + ly * cosA;
          const col = d.phase < 2.1 ? '#6622cc' : d.phase < 4.2 ? '#aa44ff' : '#dd88ff';
          ctx.fillStyle = col;
          ctx.globalAlpha = d.alpha * fadeAlpha * (0.6 + Math.sin(g.frame * 0.055 + d.phase) * 0.4);
          ctx.fillRect(Math.round(ax), Math.round(ay), d.size, d.size);
        }
        ctx.globalAlpha = 1;

        // Bar dots (purple, pulsing slightly out-of-phase per pair)
        const pulse = 0.72 + Math.sin(g.frame * 0.09 + wh.pairId * Math.PI) * 0.28;
        drawDots(ctx, wh.dots, wh.cx, wh.cy, wh.angle, g.frame, '#9933ee', fadeAlpha * pulse);
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
          const col = peg.type === 'orange' ? '#1a1205'
                    : peg.type === 'blue'   ? '#0c1520'
                    : peg.type === 'purple' ? '#180c1a'
                    : peg.type === 'split'  ? '#08082a'
                    :                         '#0a1a0a'; // magnet
          drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, col, 1.0);
        }
      }

      // ── Wind indicator ────────────────────────────────────────────────────
      if (g.windForce !== 0) {
        const dir  = g.windForce > 0 ? 1 : -1;
        const mag  = Math.abs(g.windForce) / WIND_MAX;
        const dots_n = Math.round(2 + mag * 4);
        const startX = dir > 0 ? W * 0.35 : W * 0.65;
        ctx.fillStyle = '#5a4030';
        for (let d = 0; d < dots_n; d++) {
          ctx.globalAlpha = 0.18 + d * 0.08;
          ctx.fillRect(Math.round(startX + dir * d * 9) - 1, Math.round(launcherY - 18) - 1, 3, 3);
        }
        ctx.globalAlpha = 1;
      }

      // ── Trajectory preview ───────────────────────────────────────────────
      if (g.phase === 'aiming') {
        const vx = Math.sin(g.aimAngle) * BALL_SPEED;
        const vy = Math.cos(g.aimAngle) * BALL_SPEED;
        const pts = computeTrajectory(launcherX, launcherY + 8, vx, vy, g.pegs, W, g.windForce, g.warpWalls);
        ctx.fillStyle = '#0f0f0d';
        for (let i = 0; i < pts.length; i += 3) {
          const fade = (1 - i / pts.length) * 0.38;
          ctx.globalAlpha = fade;
          ctx.fillRect(Math.round(pts[i].x - 1), Math.round(pts[i].y - 1), 2, 2);
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
          const isBucketBall = ballIdx === g.burstLuckyIdx || Math.random() < BUCKET_BALL_PROB;
          g.balls.push({
            x: g.launcherX,
            y: g.launcherY + 8,
            vx: Math.sin(angle) * BALL_SPEED,
            vy: Math.cos(angle) * BALL_SPEED,
            dots: makeBallDots(),
            isBucketBall,
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
              absorbed = true; break;
            }
            const t = 1 - dist / bhRange;
            const strength = BH_PULL_FORCE * t * t;
            ball.vx += (dx / dist) * strength;
            ball.vy += (dy / dist) * strength;
          }
          if (absorbed) { ball.y = H + 100; continue; }

          // Wind
          if (g.windForce !== 0) {
            ball.vx += g.windForce;
            ball.vx = Math.max(-BALL_SPEED * 2, Math.min(BALL_SPEED * 2, ball.vx));
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
          // never skips over the bumper's thin collision zone (hh = 12 px).
          {
            const spd0 = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            const substeps = Math.max(1, Math.ceil(spd0 / BALL_R));
            const sx = ball.vx / substeps;
            const sy = ball.vy / substeps;

            for (let sub = 0; sub < substeps; sub++) {
              ball.x += sx;
              ball.y += sy;

              // Wall bounces / warp
              if (g.warpWalls) {
                if (ball.x < -BALL_R)    ball.x = W + BALL_R;
                if (ball.x > W + BALL_R) ball.x = -BALL_R;
              } else {
                if (ball.x - BALL_R < 0)  { ball.x = BALL_R;     ball.vx =  Math.abs(ball.vx); }
                if (ball.x + BALL_R > W)  { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
              }

              // Bumper collisions
              for (const bumper of g.bumpers) {
                if (collideBallBumper(ball, bumper)) {
                  spawnBurst(g, ball.x, ball.y, ball.vx * 0.35, ball.vy * 0.35);
                  bumper.hitFlash = BUMPER_FLASH;
                  if (bumper.hitCool === 0) { bumper.hitCount++; bumper.hitCool = HIT_COOL; }
                  const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                  if (spd < dynMinSpeed) { const sc = dynMinSpeed / spd; ball.vx *= sc; ball.vy *= sc; }
                }
              }
            }
          }

          // Peg collision
          for (const peg of g.pegs) {
            if (peg.cleared || peg.hitCool > 0) continue;
            const dx = ball.x - peg.x, dy = ball.y - peg.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= (BALL_R + PEG_R) ** 2) continue;

            const dist = Math.sqrt(dist2);
            const nx = dx / dist, ny = dy / dist;

            // Reflect ball
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx -= 2 * dot * nx;
            ball.vy -= 2 * dot * ny;
            ball.x  += nx * (BALL_R + PEG_R - dist + 1.5);
            ball.y  += ny * (BALL_R + PEG_R - dist + 1.5);

            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (spd < dynMinSpeed) { const sc = dynMinSpeed / spd; ball.vx *= sc; ball.vy *= sc; }

            if (peg.type === 'magnet') {
              // Permanent obstacle — never clears, only cooldown
              peg.hitCool = HIT_COOL;
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
                    spawnPegBreak(g, other);
                    other.cleared = true; other.hitCool = HIT_COOL;
                    if (other.type === 'orange') { g.orangeLeft--; g.score += 100; }
                    else if (other.type === 'purple') { g.shotsLeft++; g.score += 50; }
                    else { g.score += 10; }
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
                alive.push({ x: ball.x, y: ball.y, vx: Math.cos(ba + sa) * bspd, vy: Math.sin(ba + sa) * bspd, dots: makeBallDots(), isBucketBall: false });
                alive.push({ x: ball.x, y: ball.y, vx: Math.cos(ba - sa) * bspd, vy: Math.sin(ba - sa) * bspd, dots: makeBallDots(), isBucketBall: false });
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

          // Wormhole teleportation
          for (const wh of g.wormholes) {
            if (wh.hitCool > 0) continue;
            const ct = wh.cycleTimer;
            if (ct >= WORMHOLE_ACTIVE) continue;
            if (!testBallOBB(ball, wh.cx, wh.cy, wh.w, wh.h, wh.angle)) continue;
            const partner = g.wormholes.find(
              o => o.pairId === wh.pairId && o.pairSlot !== wh.pairSlot
            );
            if (!partner || partner.hitCool > 0) continue;
            spawnWHBurst(g, ball.x, ball.y);
            spawnWHBurst(g, partner.cx, partner.cy);
            ball.x = partner.cx;
            // Clamp exit y so ball never spawns below bucket zone
            ball.y = Math.min(partner.cy + 6, H - 60);
            wh.hitCool      = 30;
            partner.hitCool = 30;
            break;
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
              for (const pass of bloomPasses) {
                ctx.fillStyle = pass.color;
                for (const d of ball.dots) {
                  const jx = Math.sin(g.frame * 0.038 + d.phase) * 0.55;
                  const jy = Math.cos(g.frame * 0.031 + d.phase * 1.27) * 0.55;
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
            alive.push(ball);
          }
        }
        g.balls = alive;

        // All balls exited and burst finished → next phase
        if (g.balls.length === 0 && g.burstRemaining === 0) {
          if (g.orangeLeft <= 0) {
            g.phase = 'levelclear';
            g.levelClearTimer = 95;
            setPhase('levelclear');
          } else if (g.shotsLeft <= 0) {
            g.phase = 'gameover';
            setPhase('gameover');
          } else {
            g.phase = 'aiming';
            setPhase('aiming');
          }
        }
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

      // ── Level clear countdown → next level ────────────────────────────────
      if (g.phase === 'levelclear') {
        g.levelClearTimer--;
        if (g.levelClearTimer <= 0) {
          g.score += g.shotsLeft * 200;
          g.shotsLeft += 5;
          setScore(g.score);
          setShotsLeft(g.shotsLeft);
          initLevel(g.level + 1);
        }
      }

      // ── Bursts ────────────────────────────────────────────────────────────
      const aliveBursts: Burst[] = [];
      for (const burst of g.bursts) {
        const aliveP: BurstP[] = [];
        for (const p of burst.particles) {
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
            aliveP.push(p);
          }
        }
        burst.particles = aliveP;
        if (aliveP.length > 0) aliveBursts.push(burst);
      }
      g.bursts = aliveBursts;
      ctx.globalAlpha = 1;

      // ── Peg break animations ──────────────────────────────────────────────
      ctx.fillStyle = '#0f0f0d';
      const alivePegBreaks: PegBreak[] = [];
      for (const pb of g.pegBreaks) {
        const aliveP: BreakP[] = [];
        for (const p of pb.particles) {
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
            aliveP.push(p);
          }
        }
        pb.particles = aliveP;
        if (aliveP.length > 0) alivePegBreaks.push(pb);
      }
      g.pegBreaks = alivePegBreaks;
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
      try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] }); }
      catch (switchErr) { if ((switchErr as { code?: number }).code === 4001) throw switchErr; }

      const { createWalletClient, custom } = await import('viem');
      const { base }            = await import('viem/chains');
      const { DATA_SUFFIX }     = await import('@/lib/attribution');
      const { CONTRACT_ADDRESS, LEADERBOARD_ABI } = await import('@/lib/contract');

      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider as Parameters<typeof custom>[0]),
        dataSuffix: DATA_SUFFIX,
      });
      const address = (walletAddress ?? (await walletClient.getAddresses())[0]) as `0x${string}`;
      const hash = await walletClient.writeContract({
        account: address,
        address: CONTRACT_ADDRESS,
        abi: LEADERBOARD_ABI,
        functionName: 'submitScore',
        args: [BigInt(G.current.score), BigInt(G.current.level)],
      });
      setTxHash(hash);
      setTxState('success');
    } catch (err) { console.error(err); setTxState('error'); }
  }, [txState, walletAddress]);

  // ── Share on Farcaster ────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    const g      = G.current;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const url    = appUrl ? `${appUrl}/share?score=${g.score}&level=${g.level}` : '';
    try {
      const { sdk } = await import('@farcaster/miniapp-sdk');
      await sdk.actions.composeCast({
        text: `I scored ${g.score} pts in Crypto Peggle (Level ${g.level})! Can you beat me?`,
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
            <span style={{ ...labelStyle, marginBottom: 0 }}>Mini Game</span>
          </div>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ color: INK, fontSize: 'clamp(58px, 17vw, 98px)', fontWeight: 900, lineHeight: 0.87, fontFamily: FONT, margin: 0, letterSpacing: '-0.025em' }}>
              CRYPTO<br />PEGGLE
            </h1>
          </div>
          <p style={{ color: MUTED, fontSize: 15, fontFamily: FONT, lineHeight: 1.65, marginBottom: 40, maxWidth: 270 }}>
            Clear all the orange pegs.<br />
            Drag to aim, release to fire.
          </p>
          <div style={{ pointerEvents: 'all' }}>
            <button
              style={pillBtn(true)}
              onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
              onPointerUp={(e) => e.stopPropagation()}
            >
              Start Playing
            </button>
          </div>
        </div>
      )}

      {/* ── PLAYING HUD ───────────────────────────────────────────────────── */}
      {(phase === 'aiming' || phase === 'firing') && (
        <>
          <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ ...labelStyle, textAlign: 'center' }}>{warpWalls ? 'LOOP' : 'WALL'}</div>
            <div style={{ width: 36, height: 3, borderRadius: 2, background: warpWalls ? '#6688ff' : '#c8a000' }} />
          </div>
          <div style={{ position: 'absolute', top: 20, left: 22, pointerEvents: 'none' }}>
            <div style={labelStyle}>Level</div>
            <div style={{ color: INK, fontSize: 42, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{level}</div>
          </div>
          <div style={{ position: 'absolute', top: 20, right: 22, textAlign: 'right', pointerEvents: 'none' }}>
            <div style={labelStyle}>Targets</div>
            <div style={{ color: INK, fontSize: 42, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{orangeLeft}</div>
          </div>
          <div style={{ position: 'absolute', bottom: 54, left: 22, pointerEvents: 'none' }}>
            <div style={labelStyle}>Shots</div>
            <div style={{ color: INK, fontSize: 34, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{shotsLeft}</div>
          </div>
          <div style={{ position: 'absolute', bottom: 54, right: 22, textAlign: 'right', pointerEvents: 'none' }}>
            <div style={labelStyle}>Score</div>
            <div style={{ color: INK, fontSize: 34, fontWeight: 900, lineHeight: 1, fontFamily: FONT }}>{score}</div>
          </div>
        </>
      )}

      {/* ── LEVEL CLEAR ───────────────────────────────────────────────────── */}
      {phase === 'levelclear' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: INK, fontSize: 'clamp(50px, 14vw, 78px)', fontWeight: 900, fontFamily: FONT, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              LEVEL {level}<br />
              <span style={{ fontSize: '0.50em', letterSpacing: '0.12em', color: MUTED }}>CLEARED</span>
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
            <div style={{ ...labelStyle, marginBottom: 16 }}>Select Wallet</div>
            {inFarcaster && (
              <button
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', borderBottom: detectedWallets.length > 0 ? `1px solid rgba(15,15,13,0.1)` : 'none', padding: '12px 0', cursor: 'pointer', width: '100%', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={(e) => { e.stopPropagation(); connectWithProvider('farcaster'); }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 9, background: '#7c65c1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <WalletIcon />
                </div>
                <div>
                  <div style={{ color: INK, fontSize: 14, fontWeight: 700, fontFamily: FONT }}>Farcaster Wallet</div>
                  <div style={{ color: MUTED, fontSize: 11, fontFamily: FONT, marginTop: 2 }}>Built-in</div>
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
                No wallets detected. Install Rabby or MetaMask and reload.
              </div>
            )}
            <button
              style={{ marginTop: 14, padding: '12px 0', background: 'transparent', border: `1px solid rgba(15,15,13,0.25)`, borderRadius: 9999, color: MUTED, fontSize: 13, fontFamily: FONT, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
              onPointerDown={(e) => { e.stopPropagation(); setShowWalletModal(false); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── GAME OVER ─────────────────────────────────────────────────────── */}
      {phase === 'gameover' && (
        <div
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 36px 64px', background: 'rgba(237,233,223,0.88)', pointerEvents: 'all' }}
          onPointerUp={(e) => e.stopPropagation()}
        >
          <div style={{ position: 'absolute', top: 26, left: 28 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Game Over</span>
          </div>
          {walletAddress && (
            <div style={{ position: 'absolute', top: 22, right: 28, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: MUTED, fontSize: 10, fontFamily: FONT, letterSpacing: '0.06em' }}>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <button
                style={{ background: 'transparent', border: `1px solid rgba(15,15,13,0.25)`, borderRadius: 9999, color: MUTED, fontSize: 10, fontFamily: FONT, padding: '3px 10px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                onPointerDown={(e) => { e.stopPropagation(); setWalletAddress(null); setTxState('idle'); setTxHash(null); selectedProviderRef.current = null; }}
              >
                Disconnect
              </button>
            </div>
          )}
          <div style={{ marginBottom: 6 }}>
            <div style={labelStyle}>Score</div>
            <div style={{ color: INK, fontSize: 'clamp(76px, 22vw, 132px)', fontWeight: 900, lineHeight: 0.86, fontFamily: FONT, letterSpacing: '-0.03em' }}>
              {score}
            </div>
          </div>
          <p style={{ color: MUTED, fontSize: 15, fontFamily: FONT, marginBottom: 10 }}>
            Level {level} &nbsp;&mdash;&nbsp; {orangeLeft} target{orangeLeft !== 1 ? 's' : ''} remaining
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <button style={pillBtn(true)} onPointerDown={(e) => { e.stopPropagation(); startGame(); }} onPointerUp={(e) => e.stopPropagation()}>Play Again</button>
            <button style={pillBtn(false)} onPointerDown={(e) => { e.stopPropagation(); handleShare(); }}>Share</button>
          </div>

          {process.env.NEXT_PUBLIC_CONTRACT_ADDRESS && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {!walletAddress && txState === 'idle' && (
                <button
                  style={{ ...pillBtn(false), opacity: walletConnecting ? 0.5 : 1 }}
                  onPointerDown={(e) => { e.stopPropagation(); handleConnectWallet(); }}
                >
                  {walletConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              )}
              {walletAddress && txState !== 'success' && (
                <button
                  style={{ ...pillBtn(false), opacity: txState === 'pending' ? 0.5 : 1, pointerEvents: txState === 'pending' ? 'none' : 'auto' }}
                  onPointerDown={(e) => { e.stopPropagation(); handleRecordScore(); }}
                >
                  {txState === 'idle' ? 'Record On-Chain' : txState === 'pending' ? 'Recording...' : 'Failed - Retry'}
                </button>
              )}
              {txState === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span style={{ color: MUTED, fontSize: 12, fontFamily: FONT, letterSpacing: '0.08em' }}>Score recorded on Base</span>
                  {txHash && (
                    <button
                      style={{ ...pillBtn(false), fontSize: 12 }}
                      onPointerDown={async (e) => {
                        e.stopPropagation();
                        try { const { sdk } = await import('@farcaster/miniapp-sdk'); await sdk.actions.openUrl(`https://basescan.org/tx/${txHash}`); } catch { /* no-op */ }
                      }}
                    >
                      View on Basescan
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
