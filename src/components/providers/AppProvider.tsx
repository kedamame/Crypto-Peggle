'use client';

import { sdk } from '@farcaster/miniapp-sdk';
import { useEffect, type ReactNode } from 'react';

export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    sdk.actions.ready().catch(() => {});
  }, []);

  return <>{children}</>;
}
