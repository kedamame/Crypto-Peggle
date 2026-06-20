import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BG   = '#ede9df';
const INK  = '#0f0f0d';
const GOLD = '#c8a000';

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: 200, height: 200, background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>

        {/* Top peg row */}
        <div style={{ position: 'absolute', top: 18, left: 44, width: 20, height: 20, borderRadius: '50%', borderWidth: 2, borderStyle: 'solid', borderColor: INK, background: 'transparent', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 14, left: 90,  width: 24, height: 24, borderRadius: '50%', background: GOLD, display: 'flex' }} />
        <div style={{ position: 'absolute', top: 18, left: 136, width: 20, height: 20, borderRadius: '50%', borderWidth: 2, borderStyle: 'solid', borderColor: INK, background: 'transparent', display: 'flex' }} />

        {/* DS monogram */}
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 900, color: INK, letterSpacing: '-0.04em', lineHeight: 1 }}>DS</div>

        {/* Bottom peg row */}
        <div style={{ display: 'flex', flexDirection: 'row', marginTop: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', borderWidth: 2, borderStyle: 'solid', borderColor: INK, background: 'transparent', marginRight: 10, display: 'flex' }} />
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: INK, marginRight: 10, display: 'flex' }} />
          <div style={{ width: 14, height: 14, borderRadius: '50%', borderWidth: 2, borderStyle: 'solid', borderColor: INK, background: 'transparent', display: 'flex' }} />
        </div>

      </div>
    ),
    { width: 200, height: 200 },
  );
}
