import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 200,
          height: 200,
          background: '#ede9df',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            color: '#0f0f0d',
            letterSpacing: '-0.04em',
            display: 'flex',
          }}
        >
          CP
        </div>
      </div>
    ),
    { width: 200, height: 200 },
  );
}
