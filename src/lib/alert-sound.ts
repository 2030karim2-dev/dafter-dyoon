/**
 * Distinct alert sounds generated with the Web Audio API — no asset files, so
 * each alert type gets its own recognizable tone even offline.
 */
export type AlertSound = "reminder" | "overdue" | "promise" | "success";

const PATTERNS: Record<
  AlertSound,
  { freq: number; dur: number; gap: number; type: OscillatorType }[]
> = {
  // Soft two-note chime
  reminder: [
    { freq: 880, dur: 0.16, gap: 0.04, type: "sine" },
    { freq: 1175, dur: 0.22, gap: 0, type: "sine" },
  ],
  // Urgent low triple buzz
  overdue: [
    { freq: 320, dur: 0.14, gap: 0.06, type: "square" },
    { freq: 260, dur: 0.14, gap: 0.06, type: "square" },
    { freq: 200, dur: 0.26, gap: 0, type: "square" },
  ],
  // Rising alert for promises coming due
  promise: [
    { freq: 660, dur: 0.13, gap: 0.03, type: "triangle" },
    { freq: 830, dur: 0.13, gap: 0.03, type: "triangle" },
    { freq: 990, dur: 0.2, gap: 0, type: "triangle" },
  ],
  // Positive confirmation
  success: [
    { freq: 700, dur: 0.1, gap: 0.02, type: "sine" },
    { freq: 1050, dur: 0.18, gap: 0, type: "sine" },
  ],
};

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export const SOUND_ENABLED_KEY = "daftarak.alert.sound";

export function soundEnabled() {
  try {
    return localStorage.getItem(SOUND_ENABLED_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Plays the tone pattern for the given alert type. Safe to call anywhere. */
export function playAlertSound(sound: AlertSound, force = false) {
  if (!force && !soundEnabled()) return;
  const ac = audioCtx();
  if (!ac) return;
  let at = ac.currentTime + 0.02;
  for (const step of PATTERNS[sound]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = step.type;
    osc.frequency.setValueAtTime(step.freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + step.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(at);
    osc.stop(at + step.dur + 0.02);
    at += step.dur + step.gap;
  }
  try {
    navigator.vibrate?.(sound === "overdue" ? [60, 40, 60] : 40);
  } catch {
    /* ignore */
  }
}
