'use client';

import Script from 'next/script';

export function FarcasterReady() {
  return (
    <Script
      src="https://cdn.jsdelivr.net/npm/@farcaster/miniapp-sdk/dist/index.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        try {
          // CDN build exposes window.miniapp global
          (window as any).miniapp?.sdk?.actions?.ready();
        } catch {}
      }}
    />
  );
}
