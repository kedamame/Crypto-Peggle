import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/components/providers/AppProvider';

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

// Minimal comlink APPLY message for ready() — runs before any React code.
// Sends directly to Farcaster host without waiting for the full SDK to load.
const READY_SCRIPT = `(function(){
  try {
    var id = Math.random().toString(36).slice(2);
    var msg = {type:'APPLY',path:['ready'],argumentList:[{type:'RAW',value:{}}],id:id};
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else if(window.parent && window.parent!==window){
      window.parent.postMessage(msg,'*');
    }
  } catch(e){}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script dangerouslySetInnerHTML={{ __html: READY_SCRIPT }} />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
