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

function depthSpecks(level: number, w: number, h: number) {
  const out: ReturnType<typeof dot>[] = [];
  const seed = ((level * 2654435761) ^ 0x9e3779b9) >>> 0;
  const count = 8 + Math.min(28, Math.floor(level / 5));
  for (let i = 0; i < count; i++) {
    const hv = (Math.imul(seed ^ (i * 0x85ebca6b), 0xc2b2ae35) >>> 0);
    let x = 40 + (hv % Math.max(1, w - 80));
    let y = 40 + ((hv >>> 10) % Math.max(1, h - 80));
    const rimBias = level >= 71 ? 0.35 : level >= 40 ? 0.15 : 0;
    if (rimBias > 0 && (hv & 7) < Math.floor(rimBias * 8)) {
      const side = hv % 4;
      if (side === 0) y = 28 + (hv % 40);
      else if (side === 1) y = h - 68 + (hv % 40);
      else if (side === 2) x = 28 + (hv % 40);
      else x = w - 68 + (hv % 40);
    }
    const sz = level >= 100 && (hv & 15) === 0 ? 4 : 2;
    const col = level >= 140 && (hv & 31) === 0 ? GOLD : level >= 81 && (hv & 23) === 0 ? DIM : INK;
    out.push(dot(x, y, sz, col, `sp${i}`));
  }
  if (level >= 200) {
    for (let x = 80; x < w - 80; x += 14) {
      if ((x / 14) % 5 === 2) continue;
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
  const H = 800;
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
          padding: 72,
        }}
      >
        {specks}
        <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: GOLD, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
          {`DOTSHOT`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 48, flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: MUT, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
            {`LEVEL`}
          </div>
          <div style={{ display: 'flex', fontSize: 180, fontWeight: 900, color: INK, lineHeight: 0.9, letterSpacing: '-0.04em', whiteSpace: 'nowrap', marginTop: 8 }}>
            {levelLabel}
          </div>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 600, color: MUT, marginTop: 32, whiteSpace: 'nowrap' }}>
            {scoreLine}
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: MUT, whiteSpace: 'nowrap' }}>
          {`Clear all the orange pegs.`}
        </div>
      </div>
    ),
    { width: W, height: H },
  );
}
