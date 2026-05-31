'use client';

import { useEffect, type ReactNode } from 'react';

export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Call ready() as soon as possible so Farcaster dismisses the splash screen.
    // Children render immediately — do not block on this promise.
    import('@farcaster/miniapp-sdk')
      .then(({ sdk }) => sdk.actions.ready())
      .catch(() => {});
  }, []);

  return <>{children}</>;
}
