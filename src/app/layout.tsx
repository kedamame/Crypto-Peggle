import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/providers/AppProvider';
import { FarcasterReady } from '@/components/FarcasterReady';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';

const miniAppEmbed = {
  version: '1',
  imageUrl: `${APP_URL}/opengraph-image`,
  button: {
    title: 'Play Crypto Peggle',
    action: {
      type: 'launch_miniapp',
      name: 'Crypto Peggle',
      url: APP_URL,
      splashImageUrl: `${APP_URL}/splash.png`,
      splashBackgroundColor: '#ede9df',
    },
  },
};

export const metadata: Metadata = {
  title: 'Crypto Peggle',
  description: 'Clear all orange pegs. Dot-art stippling style arcade game on Base.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: 'Crypto Peggle',
    description: 'Clear all the orange pegs. How far can you go?',
    type: 'website',
    images: ['/og-image.png'],
  },
  other: {
    'fc:miniapp': JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FarcasterReady />
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
