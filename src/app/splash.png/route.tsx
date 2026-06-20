import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: 200, height: 200, background: '#0f0f0d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>

        {/* Orange peg — top accent */}
        <div style={{ position: 'absolute', top: 20, left: 86, width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(145deg, #ff6622 20%, #cc2200 100%)', display: 'flex' }} />

        {/* Blue peg — top-left */}
        <div style={{ position: 'absolute', top: 30, left: 44, width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(145deg, #4488ee 20%, #1133aa 100%)', display: 'flex' }} />

        {/* Blue peg — top-right */}
        <div style={{ position: 'absolute', top: 30, left: 138, width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(145deg, #4488ee 20%, #1133aa 100%)', display: 'flex' }} />

        {/* DS monogram */}
        <div style={{ display: 'flex', fontSize: 76, fontWeight: 900, color: '#ede9df', letterSpacing: '-0.04em', lineHeight: 1 }}>DS</div>

        {/* Bottom peg row */}
        <div style={{ display: 'flex', flexDirection: 'row', marginTop: 14 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4488ee', marginRight: 10, display: 'flex' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#e84400', marginRight: 10, display: 'flex' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#4488ee', display: 'flex' }} />
        </div>

      </div>
    ),
    { width: 200, height: 200 },
  );
}
