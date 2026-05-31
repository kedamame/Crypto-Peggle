'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const BALL_R        = 7;
const PEG_R         = 11;
const GRAVITY       = 0.12;
const BALL_SPEED    = 9;
const MIN_SPEED     = 5.0;
const BUCKET_W      = 82;
const BUCKET_H      = 12;
const BUCKET_SPD    = 1.7;
const SHOTS_START   = 3;           // throws per game
const BALLS_PER_SHOT = 8;          // balls per throw
const BURST_INTERVAL = 4;          // frames between ball launches in a burst
const BURST_SPREAD   = 0.04;       // ±rad random wobble per ball so paths diverge
const HIT_COOL      = 4;

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
interface BurstP  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }
interface Burst   { particles: BurstP[] }
interface BreakP  { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }
interface PegBreak { particles: BreakP[] }
interface TrajPt  { x: number; y: number }

type PegType = 'orange' | 'blue' | 'purple';
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
  dots: Dot[];
}

interface Ball { x: number; y: number; vx: number; vy: number; dots: Dot[] }

interface GameState {
  phase: Phase;
  pegs: Peg[];
  bumpers: Bumper[];
  balls: Ball[];           // all active balls
  burstRemaining: number;  // balls yet to be launched in current burst
  burstTimer: number;      // frames until next ball launch
  burstAngle: number;      // locked aim angle for the current burst
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
  rng: () => number;
  levelClearTimer: number;
  orangeLeft: number;
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
  } else {
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
function generateLevel(W: number, H: number, launcherY: number, rng: () => number): { pegs: Peg[], orangeTotal: number, bumpers: Bumper[] } {
  const pegs: Peg[] = [];
  const topPad    = launcherY + 65;
  const bottomPad = H * 0.18;
  const playH     = H - topPad - bottomPad;
  const playW     = W * 0.86;
  const startX    = W * 0.07;
  const rows      = 11;
  const BASE_COLS = 9;
  const STEP_X    = playW / BASE_COLS;
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

  // ── Bumpers (3 per level, placed in the mid-field) ─────────────────────────
  const bumpers: Bumper[] = [];
  const bPositions = [0.22, 0.50, 0.78]; // horizontal positions
  for (let i = 0; i < 3; i++) {
    const cx = W * bPositions[i] + (rng() - 0.5) * W * 0.12;
    const cy = topPad + playH * (0.28 + rng() * 0.42);
    const angle = (rng() - 0.5) * Math.PI * 0.65; // ±58°
    const w = 52 + Math.floor(rng() * 28);         // 52–80 px wide
    bumpers.push({ cx, cy, w, h: 10, angle, dots: makeBumperDots(w, 10) });
  }

  return { pegs, orangeTotal: pegs.filter(p => p.type === 'orange').length, bumpers };
}

// ─── Trajectory preview ───────────────────────────────────────────────────────
function computeTrajectory(sx: number, sy: number, vx: number, vy: number, pegs: Peg[], W: number): TrajPt[] {
  const pts: TrajPt[] = [];
  let x = sx, y = sy, tvx = vx, tvy = vy;
  for (let i = 0; i < 90; i++) {
    tvy += GRAVITY;
    x  += tvx; y += tvy;
    if (x - BALL_R < 0)  { x = BALL_R;     tvx =  Math.abs(tvx); }
    if (x + BALL_R > W)  { x = W - BALL_R; tvx = -Math.abs(tvx); }
    pts.push({ x, y });
    let hit = false;
    for (const p of pegs) {
      if (p.cleared) continue;
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
    burstRemaining: 0, burstTimer: 0, burstAngle: 0,
    shotsLeft: SHOTS_START, score: 0, level: 1,
    aimAngle: 0,
    bursts: [], pegBreaks: [],
    bgDots: [], bgClusterTimer: 0,
    frame: 0,
    W: 390, H: 780,
    launcherX: 195, launcherY: 60,
    bucketX: 155, bucketDir: 1,
    rng: () => 0,
    levelClearTimer: 0,
    orangeLeft: 0,
  });

  const preventNextFire = useRef(false);

  const [phase,      setPhase]      = useState<Phase>('idle');
  const [shotsLeft,  setShotsLeft]  = useState(SHOTS_START);
  const [score,      setScore]      = useState(0);
  const [level,      setLevel]      = useState(1);
  const [orangeLeft, setOrangeLeft] = useState(0);
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
    g.bucketX   = Math.min(g.bucketX, W - BUCKET_W);
  }, []);

  // ── Init level ───────────────────────────────────────────────────────────
  const initLevel = useCallback((lv: number) => {
    const g = G.current;
    const { pegs, orangeTotal, bumpers } = generateLevel(g.W, g.H, g.launcherY, g.rng);
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
    setLevel(lv);
    setOrangeLeft(orangeTotal);
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
    g.bucketX   = g.W / 2 - BUCKET_W / 2;
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

      // ── Bumpers ───────────────────────────────────────────────────────────
      for (const bumper of g.bumpers) {
        drawDots(ctx, bumper.dots, bumper.cx, bumper.cy, bumper.angle, g.frame, '#0f0f0d', 1.0);
      }

      // ── Pegs ─────────────────────────────────────────────────────────────
      for (const peg of g.pegs) {
        if (peg.cleared) continue;
        if (peg.hitCool > 0) peg.hitCool--;
        const col = peg.type === 'orange' ? '#1a1205'
                  : peg.type === 'blue'   ? '#0c1520'
                  :                         '#180c1a';
        drawDots(ctx, peg.dots, peg.x, peg.y, 0, g.frame, col, 1.0);
      }

      // ── Trajectory preview ───────────────────────────────────────────────
      if (g.phase === 'aiming') {
        const vx = Math.sin(g.aimAngle) * BALL_SPEED;
        const vy = Math.cos(g.aimAngle) * BALL_SPEED;
        const pts = computeTrajectory(launcherX, launcherY + 8, vx, vy, g.pegs, W);
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
          const wobble = (Math.random() - 0.5) * BURST_SPREAD;
          const angle  = g.burstAngle + wobble;
          g.balls.push({
            x: g.launcherX,
            y: g.launcherY + 8,
            vx: Math.sin(angle) * BALL_SPEED,
            vy: Math.cos(angle) * BALL_SPEED,
            dots: makeBallDots(),
          });
          g.burstRemaining--;
          g.burstTimer = BURST_INTERVAL;
        }
      }

      // ── Ball physics & collision (all active balls) ───────────────────────
      if (g.phase === 'firing') {
        const bucketTop = H - 44;
        const alive: Ball[] = [];

        for (const ball of g.balls) {
          ball.vy += GRAVITY;
          ball.x  += ball.vx;
          ball.y  += ball.vy;

          // Wall bounces
          if (ball.x - BALL_R < 0)  { ball.x = BALL_R;     ball.vx =  Math.abs(ball.vx); }
          if (ball.x + BALL_R > W)  { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }

          // Bumper collisions
          for (const bumper of g.bumpers) {
            if (collideBallBumper(ball, bumper)) {
              spawnBurst(g, ball.x, ball.y, ball.vx * 0.35, ball.vy * 0.35);
              const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
              if (spd < MIN_SPEED) { const sc = MIN_SPEED / spd; ball.vx *= sc; ball.vy *= sc; }
            }
          }

          // Peg collision — pegs shatter and clear IMMEDIATELY on hit
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
            if (spd < MIN_SPEED) { const sc = MIN_SPEED / spd; ball.vx *= sc; ball.vy *= sc; }

            // Immediate shatter + clear
            spawnPegBreak(g, peg);
            peg.cleared = true;
            peg.hitCool = HIT_COOL;

            if (peg.type === 'orange') {
              g.orangeLeft--;
              g.score += 100;
              setOrangeLeft(g.orangeLeft);
            } else if (peg.type === 'purple') {
              g.shotsLeft++;
              g.score += 50;
              setShotsLeft(g.shotsLeft);
            } else {
              g.score += 10;
            }
            setScore(g.score);
          }

          // Bucket catch → bonus shot
          if (
            ball.y + BALL_R > bucketTop &&
            ball.y - BALL_R < bucketTop + BUCKET_H &&
            ball.x > g.bucketX && ball.x < g.bucketX + BUCKET_W
          ) {
            g.shotsLeft++;
            setShotsLeft(g.shotsLeft);
            ball.y = H + 60;
          }

          if (ball.y <= H + 40) {
            drawDots(ctx, ball.dots, ball.x, ball.y, 0, g.frame, '#0f0f0d', 1.0);
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
        g.bucketX += BUCKET_SPD * g.bucketDir;
        if (g.bucketX <= 0)            { g.bucketX = 0;            g.bucketDir =  1; }
        if (g.bucketX + BUCKET_W >= W) { g.bucketX = W - BUCKET_W; g.bucketDir = -1; }
      }
      const bY = H - 44;
      ctx.fillStyle = '#0f0f0d';
      for (let bx = g.bucketX; bx < g.bucketX + BUCKET_W; bx += 5) {
        ctx.globalAlpha = 0.55;
        ctx.fillRect(Math.round(bx), bY, 2, 2);
        ctx.fillRect(Math.round(bx), bY + BUCKET_H, 2, 2);
      }
      for (let by = bY; by <= bY + BUCKET_H; by += 4) {
        ctx.globalAlpha = 0.55;
        ctx.fillRect(Math.round(g.bucketX),               Math.round(by), 2, 2);
        ctx.fillRect(Math.round(g.bucketX + BUCKET_W - 2), Math.round(by), 2, 2);
      }
      ctx.globalAlpha = 1;

      // ── Level clear countdown → next level ────────────────────────────────
      if (g.phase === 'levelclear') {
        g.levelClearTimer--;
        if (g.levelClearTimer <= 0) {
          g.score += g.shotsLeft * 200;
          setScore(g.score);
          initLevel(g.level + 1);
        }
      }

      // ── Bursts ────────────────────────────────────────────────────────────
      ctx.fillStyle = '#0f0f0d';
      const aliveBursts: Burst[] = [];
      for (const burst of g.bursts) {
        const aliveP: BurstP[] = [];
        for (const p of burst.particles) {
          p.x  += p.vx; p.y  += p.vy;
          p.vy += 0.22; // gravity drag on particles
          p.vx *= 0.98;
          p.life--;
          if (p.life > 0) {
            // Fade out in the last half of the particle's life
            const fade = Math.min(1, p.life / Math.max(1, p.maxLife * 0.5));
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
    <div
      ref={wrapRef}
      style={{
        width: '100%', height: '100dvh',
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
  );
}
