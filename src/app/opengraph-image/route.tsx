import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BG      = '#0f0f0d';
const FIELD   = '#080806';
const CREAM   = '#ede9df';
const ORANGE  = '#e84400';
const MUTED   = '#7a7670';
const GOLD    = '#f5d46a';

const op = 'linear-gradient(145deg, #ff6622 20%, #cc2200 100%)';
const bp = 'linear-gradient(145deg, #4488ee 20%, #1133aa 100%)';

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, background: BG, display: 'flex', flexDirection: 'row' }}>

        {/* ── Left: title (560px) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: 560, height: 630, paddingLeft: 72, paddingBottom: 60, flexShrink: 0 }}>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: GOLD, letterSpacing: '0.14em', marginBottom: 18, whiteSpace: 'nowrap' }}>MINI GAME</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 130, fontWeight: 900, color: CREAM, lineHeight: 0.88, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>DOT</div>
            <div style={{ display: 'flex', fontSize: 130, fontWeight: 900, color: ORANGE, lineHeight: 0.88, letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>SHOT</div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: MUTED, marginTop: 30, whiteSpace: 'nowrap' }}>Clear all the orange pegs.</div>
        </div>

        {/* ── Divider ── */}
        <div style={{ width: 1, height: 480, background: '#222220', alignSelf: 'center', display: 'flex', flexShrink: 0 }} />

        {/* ── Right: peg field (639px) ── */}
        <div style={{ display: 'flex', position: 'relative', flex: 1, height: 630, background: FIELD }}>

          {/* Ball */}
          <div style={{ position: 'absolute', top: 22, left: 288, width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(145deg, #f0ede6 20%, #b0ada8 100%)', display: 'flex' }} />

          {/* Row 1 */}
          <div style={{ position: 'absolute', top: 78, left: 48,  width: 52, height: 52, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 78, left: 208, width: 52, height: 52, borderRadius: '50%', background: op, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 78, left: 368, width: 52, height: 52, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 78, left: 528, width: 52, height: 52, borderRadius: '50%', background: op, display: 'flex' }} />

          {/* Row 2 staggered */}
          <div style={{ position: 'absolute', top: 166, left: 128, width: 52, height: 52, borderRadius: '50%', background: op, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 166, left: 288, width: 52, height: 52, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 166, left: 448, width: 52, height: 52, borderRadius: '50%', background: op, display: 'flex' }} />

          {/* Bumper bar */}
          <div style={{ position: 'absolute', top: 248, left: 88, width: 220, height: 16, borderRadius: 8, background: CREAM, display: 'flex' }} />

          {/* Row 3 */}
          <div style={{ position: 'absolute', top: 296, left: 48,  width: 48, height: 48, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 296, left: 208, width: 48, height: 48, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 296, left: 368, width: 48, height: 48, borderRadius: '50%', background: op, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 296, left: 528, width: 48, height: 48, borderRadius: '50%', background: bp, display: 'flex' }} />

          {/* Row 4 staggered */}
          <div style={{ position: 'absolute', top: 378, left: 128, width: 44, height: 44, borderRadius: '50%', background: op, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 378, left: 288, width: 44, height: 44, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 378, left: 448, width: 44, height: 44, borderRadius: '50%', background: bp, display: 'flex' }} />

          {/* Row 5 */}
          <div style={{ position: 'absolute', top: 456, left: 48,  width: 44, height: 44, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 456, left: 208, width: 44, height: 44, borderRadius: '50%', background: op, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 456, left: 368, width: 44, height: 44, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 456, left: 528, width: 44, height: 44, borderRadius: '50%', background: op, display: 'flex' }} />

          {/* Row 6 staggered */}
          <div style={{ position: 'absolute', top: 534, left: 128, width: 38, height: 38, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 534, left: 288, width: 38, height: 38, borderRadius: '50%', background: bp, display: 'flex' }} />
          <div style={{ position: 'absolute', top: 534, left: 448, width: 38, height: 38, borderRadius: '50%', background: op, display: 'flex' }} />

        </div>

      </div>
    ),
    { width: 1200, height: 630 },
  );
}
