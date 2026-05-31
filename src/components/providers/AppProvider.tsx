'use client';

import { type ReactNode, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export function AppProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    sdk.actions.ready().catch(() => {});
  }, []);

  return <>{children}</>;
}
