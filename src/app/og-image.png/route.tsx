import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#ede9df',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          paddingLeft: 72,
          paddingRight: 72,
          paddingBottom: 64,
          paddingTop: 64,
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#7a7670',
            letterSpacing: '0.14em',
            display: 'flex',
            marginBottom: 20,
          }}
        >
          MINI GAME
        </div>
        <div
          style={{
            fontSize: 112,
            fontWeight: 900,
            color: '#0f0f0d',
            lineHeight: 0.88,
            letterSpacing: '-0.03em',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span style={{ display: 'flex' }}>DOT</span>
          <span style={{ display: 'flex' }}>SHOT</span>
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#7a7670',
            marginTop: 32,
            display: 'flex',
          }}
        >
          Clear all the orange pegs.
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
