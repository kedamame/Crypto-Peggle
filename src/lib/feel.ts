/** Short click / haptic feedback. No BGM. Mute via setFeelMuted. */

export type FeelKind =
  | 'fire'
  | 'peg'
  | 'orange'
  | 'lastOrange'
  | 'bucket'
  | 'clear'
  | 'lowammo'
  | 'rearm'
  | 'anomaly'
  | 'zone'
  | 'bossBreak'
  | 'streak';

let muted = false;
let audioCtx: AudioContext | null = null;

export function setFeelMuted(next: boolean): void {
  muted = next;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem('dotshot.feelMuted', next ? '1' : '0');
  } catch { /* ignore */ }
}

export function isFeelMuted(): boolean {
  return muted;
}

export function loadFeelMuted(): boolean {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('dotshot.feelMuted') === '1') {
      muted = true;
    }
  } catch { /* ignore */ }
  return muted;
}

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

function blip(freq: number, dur: number, gain: number, type: OscillatorType = 'square'): void {
  const ac = ensureAudio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function vibe(ms: number): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms);
    }
  } catch { /* ignore */ }
}

/** Depth scales pitch/vibe slightly (cap +12% / +25%). Silent - no labels. */
function depthScale(level: number): { pitch: number; vibe: number } {
  const t = Math.min(1, Math.max(0, (level - 1) / 500));
  return { pitch: 1 + t * 0.12, vibe: 1 + t * 0.25 };
}

export function feel(kind: FeelKind, level = 1): void {
  if (muted) return;
  const { pitch: p, vibe: v } = depthScale(level);
  switch (kind) {
    case 'fire':
      vibe(Math.round(8 * v));
      blip(180 * p, 0.04, 0.04, 'triangle');
      break;
    case 'peg':
      vibe(Math.round(5 * v));
      blip(420 * p, 0.025, 0.03);
      break;
    case 'orange':
      vibe(Math.round(10 * v));
      blip(520 * p, 0.04, 0.045, 'triangle');
      break;
    case 'lastOrange':
      vibe(Math.round(16 * v));
      blip(560 * p, 0.05, 0.05, 'triangle');
      blip(720 * p, 0.06, 0.03, 'sine');
      break;
    case 'bucket':
      vibe(Math.round(12 * v));
      blip(660 * p, 0.05, 0.05, 'sine');
      blip(880 * p, 0.03, 0.025, 'sine');
      break;
    case 'clear':
      vibe(Math.round(18 * v));
      blip(300 * p, 0.06, 0.05, 'triangle');
      blip(450 * p, 0.08, 0.035, 'sine');
      break;
    case 'lowammo':
      vibe(Math.round(14 * v));
      blip(140 * p, 0.07, 0.04, 'sawtooth');
      break;
    case 'rearm':
      vibe(Math.round(10 * v));
      blip(240 * p, 0.05, 0.04, 'triangle');
      break;
    case 'anomaly':
      vibe(Math.round(11 * v));
      blip(210 * p, 0.055, 0.035, 'sine');
      blip(315 * p, 0.04, 0.022, 'triangle');
      break;
    case 'zone':
      vibe(Math.round(13 * v));
      blip(260 * p, 0.07, 0.04, 'sine');
      break;
    case 'bossBreak':
      vibe(Math.round(15 * v));
      blip(160 * p, 0.05, 0.045, 'sawtooth');
      blip(320 * p, 0.04, 0.03, 'triangle');
      break;
    case 'streak':
      vibe(Math.round(9 * v));
      blip(400 * p, 0.03, 0.035, 'sine');
      blip(520 * p, 0.045, 0.028, 'triangle');
      break;
  }
}
