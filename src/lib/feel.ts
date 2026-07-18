/** Short click / haptic feedback. No BGM. Mute via setFeelMuted. */

export type FeelKind = 'fire' | 'peg' | 'orange' | 'bucket' | 'clear' | 'lowammo' | 'rearm';

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

export function feel(kind: FeelKind): void {
  if (muted) return;
  switch (kind) {
    case 'fire':
      vibe(8);
      blip(180, 0.04, 0.04, 'triangle');
      break;
    case 'peg':
      vibe(5);
      blip(420, 0.025, 0.03);
      break;
    case 'orange':
      vibe(10);
      blip(520, 0.04, 0.045, 'triangle');
      break;
    case 'bucket':
      vibe(12);
      blip(660, 0.05, 0.05, 'sine');
      blip(880, 0.03, 0.025, 'sine');
      break;
    case 'clear':
      vibe(18);
      blip(300, 0.06, 0.05, 'triangle');
      blip(450, 0.08, 0.035, 'sine');
      break;
    case 'lowammo':
      vibe(14);
      blip(140, 0.07, 0.04, 'sawtooth');
      break;
    case 'rearm':
      vibe(10);
      blip(240, 0.05, 0.04, 'triangle');
      break;
  }
}
