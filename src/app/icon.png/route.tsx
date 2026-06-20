import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BG     = '#0f0f0d';
const CREAM  = '#ede9df';
const ORANGE = '#e84400';
const BLUE   = '#1133aa';

const orangePeg = 'linear-gradient(145deg, #ff6622 20%, #cc2200 100%)';
const bluePeg   = 'linear-gradient(145deg, #4488ee 20%, #1133aa 100%)';
const ballGrad  = 'linear-gradient(145deg, #f0ede6 20%, #b0ada8 100%)';

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: 1024, height: 1024, background: BG, display: 'flex', flexDirection: 'column' }}>

        {/* ── Game scene (620px) ── */}
        <div style={{ display: 'flex', position: 'relative', width: 1024, height: 620, flexShrink: 0 }}>

          {/* Ball */}
          <div style={{ position: 'absolute', top: 68, left: 492, width: 40, height: 40, borderRadius: '50%', background: ballGrad, display: 'flex' }} />

          {/* Trajectory – thin fading line */}
          <div style={{ position: 'absolute', top: 110, left: 511, width: 3, height: 180, background: `linear-gradient(180deg, ${CREAM}55 0%, ${CREAM}00 100%)`, display: 'flex' }} />

          {/* Orange glow halo */}
          <div style={{ position: 'absolute', top: 252, left: 432, width: 140, height: 140, borderRadius: '50%', background: 'rgba(232, 80, 0, 0.16)', display: 'flex' }} />

          {/* Centre orange peg */}
          <div style={{ position: 'absolute', top: 272, left: 452, width: 100, height: 100, borderRadius: '50%', background: orangePeg, display: 'flex' }} />

          {/* Upper-left blue */}
          <div style={{ position: 'absolute', top: 210, left: 270, width: 60, height: 60, borderRadius: '50%', background: bluePeg, display: 'flex' }} />

          {/* Upper-right blue */}
          <div style={{ position: 'absolute', top: 200, left: 694, width: 60, height: 60, borderRadius: '50%', background: bluePeg, display: 'flex' }} />

          {/* Mid-left blue */}
          <div style={{ position: 'absolute', top: 340, left: 156, width: 52, height: 52, borderRadius: '50%', background: bluePeg, display: 'flex' }} />

          {/* Mid-right blue */}
          <div style={{ position: 'absolute', top: 340, left: 816, width: 52, height: 52, borderRadius: '50%', background: bluePeg, display: 'flex' }} />

          {/* Lower-left orange */}
          <div style={{ position: 'absolute', top: 438, left: 350, width: 56, height: 56, borderRadius: '50%', background: orangePeg, display: 'flex' }} />

          {/* Lower-right orange */}
          <div style={{ position: 'absolute', top: 438, left: 618, width: 56, height: 56, borderRadius: '50%', background: orangePeg, display: 'flex' }} />

          {/* Small upper blue pair */}
          <div style={{ position: 'absolute', top: 228, left: 406, width: 40, height: 40, borderRadius: '50%', background: bluePeg, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 228, left: 578, width: 40, height: 40, borderRadius: '50%', background: bluePeg, display: 'flex' }} />

          {/* Bumper bar */}
          <div style={{ position: 'absolute', top: 518, left: 352, width: 320, height: 18, borderRadius: 9, background: CREAM, display: 'flex' }} />

          {/* Bottom blue pair */}
          <div style={{ position: 'absolute', top: 554, left: 210, width: 44, height: 44, borderRadius: '50%', background: bluePeg, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 554, left: 770, width: 44, height: 44, borderRadius: '50%', background: bluePeg, display: 'flex' }} />

        </div>

        {/* ── Separator ── */}
        <div style={{ width: 864, height: 2, background: '#2a2a28', marginLeft: 80, display: 'flex', flexShrink: 0 }} />

        {/* ── Title ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 148, fontWeight: 900, color: CREAM, lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>DOT</div>
          <div style={{ display: 'flex', fontSize: 148, fontWeight: 900, color: ORANGE, lineHeight: 1, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>SHOT</div>
        </div>

      </div>
    ),
    { width: 1024, height: 1024 },
  );
}
