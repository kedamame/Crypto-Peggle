import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const BG = '#ede9df';
const INK = '#0f0f0d';
const GOLD = '#c8a000';
const MUT = '#7a7670';
const DIM = '#9a9690';

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function dot(left: number, top: number, sz: number, col: string, k: string) {
  return (
    <div
      key={k}
      style={{
        position: 'absolute',
        top,
        left,
        width: sz,
        height: sz,
        borderRadius: '50%',
        background: col,
        display: 'flex',
      }}
    />
  );
}

/** Milestone-gated paper grain - deeper runs look quieter / stranger, no labels. */
function depthSpecks(level: number, w: number, h: number) {
  const out: ReturnType<typeof dot>[] = [];
  const seed = ((level * 2654435761) ^ 0x9e3779b9) >>> 0;
  const count = 10 + Math.min(36, Math.floor(level / 4));
  const rimBias = level >= 140 ? 0.55 : level >= 100 ? 0.45 : level >= 71 ? 0.35 : level >= 40 ? 0.18 : 0;
  for (let i = 0; i < count; i++) {
    const hv = (Math.imul(seed ^ (i * 0x85ebca6b), 0xc2b2ae35) >>> 0);
    let x = 40 + (hv % Math.max(1, w - 80));
    let y = 40 + ((hv >>> 10) % Math.max(1, h - 80));
    if (rimBias > 0 && (hv & 7) < Math.floor(rimBias * 8)) {
      const side = hv % 4;
      if (side === 0) y = 28 + (hv % 40);
      else if (side === 1) y = h - 68 + (hv % 40);
      else if (side === 2) x = 28 + (hv % 40);
      else x = w - 68 + (hv % 40);
    }
    // Hollow center: skip some mid-board dots on deep runs.
    if (level >= 71) {
      const cx = w * 0.5, cy = h * 0.48;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < (Math.min(w, h) * 0.18) ** 2 && (hv & 3) !== 0) continue;
    }
    const sz = level >= 100 && (hv & 15) === 0 ? 4 : 2;
    const col =
      level >= 200 && (hv & 15) === 0 ? GOLD
      : level >= 140 && (hv & 31) === 0 ? GOLD
      : level >= 81 && (hv & 23) === 0 ? DIM
      : INK;
    out.push(dot(x, y, sz, col, `sp${i}`));
  }
  // Edge ticks from lv40
  if (level >= 40) {
    const gap = level >= 160 ? 11 : 14;
    for (let y = 48; y < h - 48; y += gap) {
      if (level >= 160 && (Math.floor(y / gap) % 5) === 2) continue;
      out.push(dot(18, y, 1, DIM, `el${y}`));
      out.push(dot(w - 20, y, 1, DIM, `er${y}`));
    }
  }
  // Corner hum seeds lv140+
  if (level >= 140) {
    for (const [cx, cy, k] of [[22, 22, 'c0'], [w - 24, 22, 'c1'], [22, h - 24, 'c2'], [w - 24, h - 24, 'c3']] as const) {
      out.push(dot(cx, cy, level >= 180 ? 3 : 2, GOLD, k));
    }
  }
  // Blank stitch band lv200+
  if (level >= 200) {
    for (let x = 80; x < w - 80; x += 12) {
      if ((x / 12) % 5 === 2) continue;
      out.push(dot(x, Math.round(h * 0.5), 1, DIM, `st${x}`));
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const level = clampInt(searchParams.get('level'), 1, 9999, 1);
  const score = clampInt(searchParams.get('score'), 0, 999999999, 0);
  const scoreLabel = score.toLocaleString('en-US');
  const levelLabel = `${level}`;
  const scoreLine = `${scoreLabel} pts`;
  const W = 1200;
  const H = 630;
  const specks = depthSpecks(level, W, H);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          background: BG,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          padding: 64,
        }}
      >
        {specks}
        <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: GOLD, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
          {`DOTSHOT`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 36, flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: MUT, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
            {`LEVEL`}
          </div>
          <div style={{ display: 'flex', fontSize: 168, fontWeight: 900, color: INK, lineHeight: 0.9, letterSpacing: '-0.04em', whiteSpace: 'nowrap', marginTop: 8 }}>
            {levelLabel}
          </div>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 600, color: MUT, marginTop: 28, whiteSpace: 'nowrap' }}>
            {scoreLine}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 22, color: MUT, whiteSpace: 'nowrap' }}>
          {`Clear all the orange pegs.`}
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
