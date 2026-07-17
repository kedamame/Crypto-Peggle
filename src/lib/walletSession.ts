/**
 * Persist which wallet the user last connected so a refresh can silently
 * reattach via eth_accounts (no eth_requestAccounts popup).
 */

export const WALLET_SESSION_KEY = 'dotshot.wallet.v1';
export const WALLET_SESSION_VERSION = 1;

export type WalletSession = {
  schemaVersion: number;
  /** How the provider was obtained on last connect. */
  source: 'farcaster' | 'eip6963' | 'injected';
  /** EIP-6963 rdns, or `window.ethereum` for the legacy injected provider. */
  rdns?: string;
  /** Last known address (informational; restored from eth_accounts). */
  address?: string;
  savedAt: number;
};

export function saveWalletSession(
  session: Omit<WalletSession, 'schemaVersion' | 'savedAt'> & {
    schemaVersion?: number;
    savedAt?: number;
  },
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: WalletSession = {
      schemaVersion: WALLET_SESSION_VERSION,
      source: session.source,
      rdns: session.rdns,
      address: session.address?.toLowerCase(),
      savedAt: Date.now(),
    };
    localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

export function loadWalletSession(): WalletSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WALLET_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WalletSession>;
    if (parsed.schemaVersion !== WALLET_SESSION_VERSION) return null;
    if (
      parsed.source !== 'farcaster' &&
      parsed.source !== 'eip6963' &&
      parsed.source !== 'injected'
    ) {
      return null;
    }
    return {
      schemaVersion: WALLET_SESSION_VERSION,
      source: parsed.source,
      rdns: typeof parsed.rdns === 'string' ? parsed.rdns : undefined,
      address: typeof parsed.address === 'string' ? parsed.address : undefined,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearWalletSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(WALLET_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
