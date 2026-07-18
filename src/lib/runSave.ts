/**
 * Aiming-checkpoint persistence for DotShot runs.
 * Stores a JSON snapshot in localStorage so a refresh can resume between shots.
 */

export const RUN_SAVE_KEY = 'dotshot.run.v1';
export const RUN_SAVE_VERSION = 1;

/** Relative board-size drift beyond which we discard the save (layout depends on W/H). */
export const RUN_SAVE_SIZE_TOLERANCE = 0.12;

export type RunSnapshot = {
  schemaVersion: number;
  savedAt: number;
  boardW: number;
  boardH: number;
  continuesUsed: number;
  extrasUsed: number;
  /** Plain JSON clone of GameState with non-serializable fields stripped. */
  state: Record<string, unknown>;
};

const SKIP_KEYS = new Set([
  'balls',
  'bursts',
  'pegBreaks',
  'scorePops',
  'bgDots',
  'rng',
  'chainGroups',
  'ctcStates',
  'ctcUsed',
  'holoSides',
  'gwMemories',
  'firePulse',
  'wrongPeg',
  'lightningArcs',
  'cdaGhosts',
  'cdaLights',
  'entanglePartner',
  'passingBalls',
  'lastSide',
  'prevBallAng',
  'insideBalls',
  'sprite',
]);

/** Strip WeakMap/WeakSet/Map/canvas/functions and transient play fields for JSON storage. */
export function serializeGameState(g: object): Record<string, unknown> {
  const raw = JSON.stringify(g, (key, value) => {
    if (key !== '' && SKIP_KEYS.has(key)) return undefined;
    if (typeof value === 'function') return undefined;
    if (value instanceof WeakMap || value instanceof WeakSet || value instanceof Map) return undefined;
    if (typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement) return undefined;
    return value;
  });
  return JSON.parse(raw) as Record<string, unknown>;
}

export function isBoardSizeCompatible(
  savedW: number,
  savedH: number,
  curW: number,
  curH: number,
): boolean {
  if (!(savedW > 0 && savedH > 0 && curW > 0 && curH > 0)) return false;
  const dw = Math.abs(savedW - curW) / savedW;
  const dh = Math.abs(savedH - curH) / savedH;
  return dw <= RUN_SAVE_SIZE_TOLERANCE && dh <= RUN_SAVE_SIZE_TOLERANCE;
}

export function saveRun(snapshot: RunSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[DotShot] run save failed:', err);
  }
}

export function loadRun(): RunSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(RUN_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RunSnapshot>;
    if (parsed.schemaVersion !== RUN_SAVE_VERSION) return null;
    if (!parsed.state || typeof parsed.state !== 'object') return null;
    if (typeof parsed.boardW !== 'number' || typeof parsed.boardH !== 'number') return null;
    if (typeof parsed.continuesUsed !== 'number' || typeof parsed.extrasUsed !== 'number') return null;
    return parsed as RunSnapshot;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(RUN_SAVE_KEY);
  } catch {
    /* ignore */
  }
}
