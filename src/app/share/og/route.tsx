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

/**
 * Silent anomaly silhouettes gated by ZONE_MARK-like thresholds.
 * Optional z (zone etch count) and a (anomaly-day seen) deepen the foreign marks.
 * No labels, no cosmos words - only ink that should not be there.
 */
function anomalySilhouettes(level: number, w: number, h: number, zMarks = 0, anomalySeen = 0) {
  const out: ReturnType<typeof dot>[] = [];
  if (level < 54) return out;
  const cx = Math.round(w * 0.78);
  const cy = Math.round(h * 0.38);
  const z = Math.min(24, Math.max(0, zMarks));
  const aFlag = anomalySeen > 0;

  // lv54+: gapped arc + 1px core (first foreign mark)
  {
    const r = 26 + Math.min(8, Math.floor(z / 3));
    for (let i = 0; i < 18; i++) {
      if (i % 3 === 0) continue;
      const ang = (i / 18) * Math.PI * 1.45 - 0.4;
      out.push(dot(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 2, INK, `z54_${i}`));
    }
    out.push(dot(cx, cy, 2, INK, 'z54c'));
  }

  // Zone etch count → sparse left-rim ticks (run memory, not a table)
  if (z > 0) {
    const n = Math.min(12, z);
    for (let i = 0; i < n; i++) {
      if (i % 3 === 0) continue;
      out.push(dot(22, Math.round(h * 0.22 + i * 14), 1, DIM, `zm_${i}`));
    }
  }

  // Anomaly day seen → second 1px nucleus offset from the main core
  if (aFlag) {
    out.push(dot(cx - 18, cy + 22, 2, GOLD, 'a_core'));
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) continue;
      const ang = (i / 6) * Math.PI * 2;
      out.push(dot(Math.round(cx - 18 + Math.cos(ang) * 10), Math.round(cy + 22 + Math.sin(ang) * 10), 1, DIM, `a_${i}`));
    }
  }

  // lv100+: tilted ribbon of dots
  if (level >= 100) {
    for (let i = 0; i < 14; i++) {
      if (i % 4 === 0) continue;
      const t = i / 13;
      out.push(dot(
        Math.round(cx - 52 + t * 96),
        Math.round(cy + 48 + (t - 0.5) * 18),
        2,
        DIM,
        `z100_${i}`,
      ));
    }
  }

  // lv200+: second gapped arc, colder offset
  if (level >= 200) {
    const r2 = 40;
    const ox = cx - 70;
    const oy = cy + 20;
    for (let i = 0; i < 20; i++) {
      if (i % 3 === 0) continue;
      const ang = (i / 20) * Math.PI * 1.35 + 0.8;
      out.push(dot(Math.round(ox + Math.cos(ang) * r2), Math.round(oy + Math.sin(ang) * r2), 2, DIM, `z200_${i}`));
    }
    out.push(dot(ox, oy, 3, GOLD, 'z200c'));
  }

  // lv300+: thin vertical seam (open, not a closed contour)
  if (level >= 300) {
    for (let i = 0; i < 16; i++) {
      if (i % 3 === 0) continue;
      out.push(dot(Math.round(w * 0.22), Math.round(h * 0.28 + i * 12), 2, INK, `z300_${i}`));
    }
  }

  // lv400+: sparse double halo fragment
  if (level >= 400) {
    const hx = Math.round(w * 0.55);
    const hy = Math.round(h * 0.62);
    for (let ring = 0; ring < 2; ring++) {
      const rr = 18 + ring * 12;
      for (let i = 0; i < 14; i++) {
        if (i % 3 === 0) continue;
        const ang = (i / 14) * Math.PI * 1.5 + ring * 0.3;
        out.push(dot(
          Math.round(hx + Math.cos(ang) * rr),
          Math.round(hy + Math.sin(ang) * rr),
          ring === 0 ? 2 : 1,
          ring === 0 ? INK : DIM,
          `z400_${ring}_${i}`,
        ));
      }
    }
  }

  // lv500+: denser fringe near the number - alphabet-end mark
  if (level >= 500) {
    for (let i = 0; i < 10; i++) {
      if (i % 2 === 0) continue;
      const ang = (i / 10) * Math.PI * 2;
      out.push(dot(
        Math.round(w * 0.42 + Math.cos(ang) * 22),
        Math.round(h * 0.48 + Math.sin(ang) * 14),
        2,
        GOLD,
        `z500_${i}`,
      ));
    }
  }

  // lv520+: open hollow rim - Zone AA mark (gapped, not closed)
  if (level >= 520) {
    const hx = Math.round(w * 0.68);
    const hy = Math.round(h * 0.58);
    const rr = 20;
    for (let i = 0; i < 16; i++) {
      if (i % 3 === 0) continue;
      if (i < 2 || i > 13) continue;
      const ang = (i / 16) * Math.PI * 1.7 - 0.2;
      out.push(dot(
        Math.round(hx + Math.cos(ang) * rr),
        Math.round(hy + Math.sin(ang) * rr),
        1,
        DIM,
        `z520_${i}`,
      ));
    }
  }

  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const level = clampInt(searchParams.get('level'), 1, 9999, 1);
  const score = clampInt(searchParams.get('score'), 0, 999999999, 0);
  const zMarks = clampInt(searchParams.get('z'), 0, 48, 0);
  const anomalySeen = clampInt(searchParams.get('a'), 0, 1, 0);
  const scoreLabel = score.toLocaleString('en-US');
  const levelLabel = `${level}`;
  const scoreLine = `${scoreLabel} pts`;
  const W = 1200;
  const H = 630;
  const specks = depthSpecks(level, W, H);
  const anomalies = anomalySilhouettes(level, W, H, zMarks, anomalySeen);

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
        {anomalies}
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
