'use client';

import { type ReactNode } from 'react';

// Call ready() at module-evaluation time (before useEffect, before first render)
// so Farcaster dismisses the splash screen as fast as possible.
if (typeof window !== 'undefined') {
  import('@farcaster/miniapp-sdk')
    .then(({ sdk }) => sdk.actions.ready())
    .catch(() => {});
}

export function AppProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
