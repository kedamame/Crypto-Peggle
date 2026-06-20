import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BG   = '#ede9df';
const INK  = '#0f0f0d';
const GOLD = '#c8a000';

function dot(left: number, top: number, sz: number, col: string, k: string) {
  return <div key={k} style={{ position: 'absolute', top, left, width: sz, height: sz, borderRadius: '50%', background: col, display: 'flex' }} />;
}

// Mini stipple ring for tiny pegs
function miniPeg(cx: number, cy: number, r: number, col: string, k: string) {
  const rr = Math.round(r * 0.68);
  const sz = 4;
  const h  = 2;
  const angles: [number, number][] = [
    [1, 0], [0.707, 0.707], [0, 1], [-0.707, 0.707],
    [-1, 0], [-0.707, -0.707], [0, -1], [0.707, -0.707],
  ];
  return angles.map(([c, s], i) =>
    dot(Math.round(cx + rr * c) - h, Math.round(cy + rr * s) - h, sz, col, `${k}-${i}`)
  );
}

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: 200, height: 200, background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>

        {/* Top peg row */}
        {miniPeg(62,  36, 14, INK,  'tL')}
        {miniPeg(100, 28, 16, GOLD, 'tC')}
        {miniPeg(138, 36, 14, INK,  'tR')}

        {/* DS monogram */}
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 900, color: INK, letterSpacing: '-0.04em', lineHeight: 1 }}>DS</div>

        {/* Bottom peg row */}
        {miniPeg(62,  166, 12, INK, 'bL')}
        {miniPeg(100, 170, 12, INK, 'bC')}
        {miniPeg(138, 166, 12, INK, 'bR')}

        {/* Scatter */}
        {dot(24, 80, 3, '#b0aca8', 'sc0')}
        {dot(172, 92, 3, '#b0aca8', 'sc1')}
        {dot(20, 130, 2, '#b0aca8', 'sc2')}
        {dot(176, 124, 2, '#b0aca8', 'sc3')}

      </div>
    ),
    { width: 200, height: 200 },
  );
}
