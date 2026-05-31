'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import('@farcaster/miniapp-sdk')
      .then(({ sdk }) => sdk.actions.ready())
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: '100dvh', background: '#ede9df' }} />
    );
  }

  return <>{children}</>;
}
