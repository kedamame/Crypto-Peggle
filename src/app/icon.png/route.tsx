import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BG   = '#ede9df';
const INK  = '#0f0f0d';
const GOLD = '#c8a000';
const DIM  = '#9a9690';

// 8-direction unit vectors (cos, sin)
const R8: [number, number][] = [
  [1, 0], [0.707, 0.707], [0, 1], [-0.707, 0.707],
  [-1, 0], [-0.707, -0.707], [0, -1], [0.707, -0.707],
];
// 4 diagonal unit vectors
const D4: [number, number][] = [
  [0.707, 0.707], [-0.707, 0.707], [-0.707, -0.707], [0.707, -0.707],
];

/** Single dot */
function d(left: number, top: number, sz: number, col: string, k: string) {
  return <div key={k} style={{ position: 'absolute', top, left, width: sz, height: sz, borderRadius: '50%', background: col, display: 'flex' }} />;
}

/** Stipple peg: outer ring + optional inner dots for dense pegs */
function peg(cx: number, cy: number, r: number, col: string, dense: boolean) {
  const rr = Math.round(r * 0.70);
  const sz = Math.max(5, Math.round(r * 0.22));
  const h  = Math.round(sz / 2);
  const dots = R8.map(([c, s], i) =>
    d(Math.round(cx + rr * c) - h, Math.round(cy + rr * s) - h, sz, col, `${cx}-${cy}-r${i}`)
  );
  if (dense) {
    const mr = Math.round(r * 0.36);
    D4.forEach(([c, s], i) =>
      dots.push(d(Math.round(cx + mr * c) - h, Math.round(cy + mr * s) - h, sz, col, `${cx}-${cy}-m${i}`))
    );
    dots.push(d(Math.round(cx) - h, Math.round(cy) - h, sz, col, `${cx}-${cy}-ctr`));
  }
  return dots;
}

/** Row of dots forming a bumper bar */
function bumper(cx: number, cy: number, w: number, col: string) {
  const sz = 9; const sp = 15;
  const n  = Math.round(w / sp);
  const x0 = Math.round(cx - (n - 1) * sp / 2);
  return Array.from({ length: n }, (_, i) =>
    d(x0 + i * sp - 4, Math.round(cy) - 4, sz, col, `bmp${cx}-${i}`)
  );
}

export async function GET() {
  const scene = [
    // ─ Ball ─
    ...peg(512, 82, 10, INK, true),
    // ─ Trajectory ─
    d(510, 102, 4, DIM, 'tj0'), d(510, 118, 3, DIM, 'tj1'), d(510, 134, 3, DIM, 'tj2'),
    // ─ Row 1 hollow pegs ─
    ...peg(296, 208, 28, INK, false),
    ...peg(452, 192, 28, INK, false),
    ...peg(572, 192, 28, INK, false),
    ...peg(728, 208, 28, INK, false),
    // ─ Row 2: gold target centre ─
    ...peg(188, 310, 26, INK, false),
    ...peg(514, 330, 34, GOLD, true),
    ...peg(836, 310, 26, INK, false),
    // ─ Row 3 ─
    ...peg(350, 416, 24, INK, false),
    ...peg(512, 420, 24, INK, true),
    ...peg(674, 416, 24, INK, false),
    ...peg(122, 418, 22, INK, false),
    ...peg(902, 418, 22, INK, false),
    // ─ Bumper bar ─
    ...bumper(512, 490, 320, INK),
    // ─ Row 4 ─
    ...peg(274, 534, 22, INK, false),
    ...peg(440, 534, 22, INK, false),
    ...peg(584, 534, 22, INK, false),
    ...peg(752, 534, 22, INK, false),
    // ─ Background scatter ─
    d(186, 150, 3, DIM, 'bg0'), d(820, 166, 3, DIM, 'bg1'),
    d(374, 170, 3, DIM, 'bg2'), d(682, 174, 3, DIM, 'bg3'),
    d(106, 260, 3, DIM, 'bg4'), d(926, 258, 3, DIM, 'bg5'),
    d(142, 468, 3, DIM, 'bg6'), d(888, 474, 3, DIM, 'bg7'),
    d(358, 478, 3, DIM, 'bg8'), d(658, 478, 3, DIM, 'bg9'),
  ];

  return new ImageResponse(
    (
      <div style={{ width: 1024, height: 1024, background: BG, display: 'flex', flexDirection: 'column' }}>
        {/* ── Game scene ── */}
        <div style={{ display: 'flex', position: 'relative', width: 1024, height: 602, flexShrink: 0 }}>
          {scene}
        </div>
        {/* ── Separator ── */}
        <div style={{ width: 864, height: 1, background: '#c0bcb4', marginLeft: 80, display: 'flex', flexShrink: 0 }} />
        {/* ── Title ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 148, fontWeight: 900, color: INK,  lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>DOT</div>
          <div style={{ display: 'flex', fontSize: 148, fontWeight: 900, color: GOLD, lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>SHOT</div>
        </div>
      </div>
    ),
    { width: 1024, height: 1024 },
  );
}
