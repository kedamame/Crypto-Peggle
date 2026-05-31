'use client';

import Script from 'next/script';

export function FarcasterReady() {
  const callReady = () => {
    try {
      (window as any).miniapp?.sdk?.actions?.ready?.();
    } catch {}
  };

  return (
    <Script
      src="/miniapp-sdk.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        callReady();
        // Retry once after 500ms in case ReactNativeWebView injection was delayed
        setTimeout(callReady, 500);
      }}
    />
  );
}
