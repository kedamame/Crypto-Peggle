import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BG   = '#ede9df';
const INK  = '#0f0f0d';
const GOLD = '#c8a000';

// Hollow peg (outlined circle)
const hollow = (top: number, left: number, size: number) => (
  <div style={{ position: 'absolute', top, left, width: size, height: size, borderRadius: '50%', borderWidth: 4, borderStyle: 'solid', borderColor: INK, background: 'transparent', display: 'flex' }} />
);

// Filled peg (stipple-dense target)
const filled = (top: number, left: number, size: number) => (
  <div style={{ position: 'absolute', top, left, width: size, height: size, borderRadius: '50%', background: INK, display: 'flex' }} />
);

// Gold accent peg
const gold = (top: number, left: number, size: number) => (
  <div style={{ position: 'absolute', top, left, width: size, height: size, borderRadius: '50%', background: GOLD, display: 'flex' }} />
);

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: 1024, height: 1024, background: BG, display: 'flex', flexDirection: 'column' }}>

        {/* ── Game scene (600px) ── */}
        <div style={{ display: 'flex', position: 'relative', width: 1024, height: 600, flexShrink: 0 }}>

          {/* Ball */}
          {filled(72, 504, 20)}

          {/* Trajectory dots */}
          <div style={{ position: 'absolute', top: 96,  left: 513, width: 4, height: 4, borderRadius: '50%', background: INK, display: 'flex', opacity: 0.5 }} />
          <div style={{ position: 'absolute', top: 112, left: 513, width: 4, height: 4, borderRadius: '50%', background: INK, display: 'flex', opacity: 0.4 }} />
          <div style={{ position: 'absolute', top: 128, left: 513, width: 4, height: 4, borderRadius: '50%', background: INK, display: 'flex', opacity: 0.3 }} />
          <div style={{ position: 'absolute', top: 144, left: 513, width: 4, height: 4, borderRadius: '50%', background: INK, display: 'flex', opacity: 0.2 }} />

          {/* Row 1 — y:200 */}
          {hollow(200, 296, 64)}
          {hollow(190, 448, 64)}
          {hollow(190, 520, 64)}
          {hollow(200, 668, 64)}

          {/* Row 2 — y:296 — gold centre target */}
          {hollow(296, 190, 56)}
          {gold(304, 452, 72)}
          {hollow(296, 766, 56)}

          {/* Row 3 — y:390 */}
          {hollow(390, 330, 56)}
          {filled(390, 510, 56)}
          {hollow(390, 648, 56)}
          {hollow(400, 130, 48)}
          {hollow(400, 840, 48)}

          {/* Bumper bar */}
          <div style={{ position: 'absolute', top: 484, left: 332, width: 360, height: 16, borderRadius: 8, background: INK, display: 'flex' }} />

          {/* Row 4 — y:516 */}
          {hollow(516, 240, 48)}
          {hollow(516, 420, 48)}
          {hollow(516, 600, 48)}
          {hollow(516, 740, 48)}

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
