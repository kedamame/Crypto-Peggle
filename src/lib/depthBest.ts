/**
 * Local personal-best depth (highest level reached on this device).
 * Wordless: only feeds unlabeled depth dots — never shown as a number label.
 */

export const BEST_LEVEL_KEY = 'dotshot.bestLevel.v1';

export function loadBestLevel(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const n = parseInt(localStorage.getItem(BEST_LEVEL_KEY) ?? '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Record a reached level; returns the new best. */
export function noteBestLevel(level: number): number {
  if (!(level > 0)) return loadBestLevel();
  const prev = loadBestLevel();
  const next = Math.max(prev, Math.floor(level));
  if (next > prev) {
    try {
      localStorage.setItem(BEST_LEVEL_KEY, String(next));
    } catch {
      /* ignore quota */
    }
  }
  return next;
}
