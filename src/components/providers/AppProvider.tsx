'use client';

import { type ReactNode, useEffect } from 'react';

export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    (async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        const isMiniApp = await sdk.isInMiniApp();
        if (isMiniApp) {
          sdk.actions.ready();
        }
      } catch {}
    })();
  }, []);

  return <>{children}</>;
}
