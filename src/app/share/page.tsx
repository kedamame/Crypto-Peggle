import type { Metadata } from 'next';
import Link from 'next/link';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crypto-peggle.vercel.app';

function clampInt(raw: string | string[] | undefined, min: number, max: number, fallback: number): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(s ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

type ShareSearch = { level?: string; score?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ShareSearch> | ShareSearch;
}): Promise<Metadata> {
  const sp = await Promise.resolve(searchParams);
  const level = clampInt(sp.level, 1, 9999, 1);
  const score = clampInt(sp.score, 0, 999999999, 0);
  // v=3 cache-bust for Farcaster when OG art changes (silent anomaly silhouettes)
  const ogImage = `${APP_URL}/share/og?level=${level}&score=${score}&v=3`;
  const embedImage = `${APP_URL}/share/embed?level=${level}&score=${score}&v=3`;
  const title = `DotShot - Level ${level}`;
  const description = `Reached Level ${level} (${score.toLocaleString('en-US')} pts). Clear all the orange pegs.`;

  const miniAppEmbed = {
    version: '1',
    imageUrl: embedImage,
    button: {
      title: 'Play DotShot',
      action: {
        type: 'launch_miniapp',
        name: 'DotShot',
        url: APP_URL,
        splashImageUrl: `${APP_URL}/splash.png`,
        splashBackgroundColor: '#ede9df',
      },
    },
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    other: {
      'fc:miniapp': JSON.stringify(miniAppEmbed),
      'base:app_id': '6a3610e0369a7e3c4dc5d71e',
    },
  };
}

/** Cast embeds land here for OG scrape. Keep HTML (no server redirect) so crawlers keep meta tags. */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<ShareSearch> | ShareSearch;
}) {
  const sp = await Promise.resolve(searchParams);
  const level = clampInt(sp.level, 1, 9999, 1);
  const score = clampInt(sp.score, 0, 999999999, 0);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: '#ede9df',
        color: '#0f0f0d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        padding: 32,
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', color: '#c8a000' }}>
        DOTSHOT
      </div>
      <div style={{ display: 'flex', fontSize: 48, fontWeight: 900, letterSpacing: '-0.03em' }}>
        {`Level ${level}`}
      </div>
      <div style={{ display: 'flex', fontSize: 18, color: '#7a7670' }}>
        {`${score.toLocaleString('en-US')} pts`}
      </div>
      <Link
        href="/"
        style={{
          display: 'flex',
          marginTop: 24,
          padding: '13px 34px',
          border: '1.5px solid #0f0f0d',
          borderRadius: 9999,
          background: '#0f0f0d',
          color: '#ede9df',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textDecoration: 'none',
        }}
      >
        Play
      </Link>
    </main>
  );
}
