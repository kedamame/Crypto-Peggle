'use client';

import dynamic from 'next/dynamic';

const DotShotGame = dynamic(
  () => import('@/components/CryptoPeggleGame').then((m) => ({ default: m.DotShotGame })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: '100dvh',
          background: '#ede9df',
        }}
      />
    ),
  },
);

export default function Home() {
  return <DotShotGame />;
}
