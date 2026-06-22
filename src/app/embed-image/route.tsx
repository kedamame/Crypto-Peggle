import { ImageResponse } from 'next/og';

// Farcaster Mini App embeds render at a 3:2 aspect ratio. The 1.91:1 opengraph-image
// gets cropped in that frame, so this route renders the same art on a 1200x800 (3:2)
// cream canvas with the content centered — the cream letterbox is invisible.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BG   = '#ede9df';
const INK  = '#0f0f0d';
const GOLD = '#c8a000';
const MUT  = '#7a7670';
const DIM  = '#9a9690';

const R8: [number, number][] = [
  [1, 0], [0.707, 0.707], [0, 1], [-0.707, 0.707],
  [-1, 0], [-0.707, -0.707], [0, -1], [0.707, -0.707],
];
const D4: [number, number][] = [
  [0.707, 0.707], [-0.707, 0.707], [-0.707, -0.707], [0.707, -0.707],
];

function dot(left: number, top: number, sz: number, col: string, k: string) {
  return <div key={k} style={{ position: 'absolute', top, left, width: sz, height: sz, borderRadius: '50%', background: col, display: 'flex' }} />;
}

function peg(cx: number, cy: number, r: number, col: string, dense: boolean) {
  const rr = Math.round(r * 0.70);
  const sz = Math.max(4, Math.round(r * 0.22));
  const h  = Math.round(sz / 2);
  const dots = R8.map(([c, s], i) =>
    dot(Math.round(cx + rr * c) - h, Math.round(cy + rr * s) - h, sz, col, `${cx}-${cy}-r${i}`)
  );
  if (dense) {
    const mr = Math.round(r * 0.36);
    D4.forEach(([c, s], i) =>
      dots.push(dot(Math.round(cx + mr * c) - h, Math.round(cy + mr * s) - h, sz, col, `${cx}-${cy}-m${i}`))
    );
    dots.push(dot(Math.round(cx) - h, Math.round(cy) - h, sz, col, `${cx}-${cy}-ctr`));
  }
  return dots;
}

function bumper(cx: number, cy: number, w: number, col: string) {
  const sz = 8; const sp = 13;
  const n  = Math.round(w / sp);
  const x0 = Math.round(cx - (n - 1) * sp / 2);
  return Array.from({ length: n }, (_, i) =>
    dot(x0 + i * sp - 4, Math.round(cy) - 4, sz, col, `bmp${cx}-${i}`)
  );
}

export async function GET() {
  const rightDots = [
    ...peg(295, 28, 9, INK, true),
    dot(293, 46, 3, DIM, 'tj0'), dot(293, 58, 3, DIM, 'tj1'),
    ...peg(52,  80, 22, INK,  false),
    ...peg(208, 80, 22, GOLD, true),
    ...peg(364, 80, 22, INK,  false),
    ...peg(520, 80, 22, INK,  false),
    ...peg(130, 158, 22, INK,  true),
    ...peg(286, 158, 22, INK,  false),
    ...peg(442, 158, 22, GOLD, true),
    ...bumper(196, 226, 188, INK),
    ...peg(52,  276, 20, INK,  false),
    ...peg(208, 276, 20, INK,  false),
    ...peg(364, 276, 20, GOLD, true),
    ...peg(520, 276, 20, INK,  false),
    ...peg(130, 348, 20, INK,  false),
    ...peg(286, 348, 20, INK,  true),
    ...peg(442, 348, 20, INK,  false),
    ...peg(52,  416, 18, INK,  false),
    ...peg(208, 416, 18, GOLD, false),
    ...peg(364, 416, 18, INK,  true),
    ...peg(520, 416, 18, INK,  false),
    ...peg(130, 480, 18, INK,  false),
    ...peg(286, 480, 18, INK,  false),
    ...peg(442, 480, 18, GOLD, false),
    ...peg(52,  546, 16, INK,  false),
    ...peg(208, 546, 16, INK,  false),
    ...peg(364, 546, 16, INK,  false),
    ...peg(520, 546, 16, INK,  false),
    dot(88,  30, 3, DIM, 'bg0'), dot(460, 38, 3, DIM, 'bg1'),
    dot(22, 210, 3, DIM, 'bg2'), dot(600, 198, 3, DIM, 'bg3'),
    dot(22, 400, 3, DIM, 'bg4'), dot(600, 420, 3, DIM, 'bg5'),
  ];

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 800, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'row' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: 520, height: 630, paddingLeft: 72, paddingBottom: 60, flexShrink: 0 }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: GOLD, letterSpacing: '0.14em', marginBottom: 16, whiteSpace: 'nowrap' }}>MINI GAME</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 128, fontWeight: 900, color: INK,  lineHeight: 0.88, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>DOT</div>
              <div style={{ display: 'flex', fontSize: 128, fontWeight: 900, color: GOLD, lineHeight: 0.88, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>SHOT</div>
            </div>
            <div style={{ display: 'flex', fontSize: 22, color: MUT, marginTop: 28, whiteSpace: 'nowrap' }}>Clear all the orange pegs.</div>
          </div>
          <div style={{ width: 1, height: 500, background: '#c0bcb4', alignSelf: 'center', display: 'flex', flexShrink: 0 }} />
          <div style={{ display: 'flex', position: 'relative', flex: 1, height: 630 }}>
            {rightDots}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 800 },
  );
}
