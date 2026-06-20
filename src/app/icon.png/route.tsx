import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1024,
          height: 1024,
          background: '#ede9df',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 260,
              fontWeight: 900,
              color: '#0f0f0d',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              display: 'flex',
            }}
          >
            DS
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: '#7a7670',
              letterSpacing: '0.12em',
              display: 'flex',
              marginTop: 16,
            }}
          >
            DOTSHOT
          </div>
        </div>
      </div>
    ),
    { width: 1024, height: 1024 },
  );
}
