const AUDIO_MUTED_KEY = "chess_audio_muted";

let cachedMuted: boolean | null = null;
let audioCtx: AudioContext | null = null;
const mutedListeners = new Set<() => void>();

function notifyMutedListeners() {
  for (const l of mutedListeners) l();
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxClass) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioCtxClass();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function getAudioMuted(): boolean {
  if (cachedMuted !== null) return cachedMuted;
  if (typeof window === "undefined" || typeof localStorage === "undefined") return false;
  try {
    cachedMuted = localStorage.getItem(AUDIO_MUTED_KEY) === "true";
  } catch {
    cachedMuted = false;
  }
  return cachedMuted;
}

export function setAudioMuted(muted: boolean): void {
  cachedMuted = muted;
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(AUDIO_MUTED_KEY, String(muted));
    } catch {
      // Ignore storage error
    }
  }
  notifyMutedListeners();
}

export function subscribeAudioMuted(listener: () => void): () => void {
  mutedListeners.add(listener);
  return () => {
    mutedListeners.delete(listener);
  };
}

export function getAudioMutedSnapshot(): boolean {
  return getAudioMuted();
}

/**
 * Plays a wooden piece placement sound
 */
export function playMoveSound(): void {
  if (getAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.05);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Graceful no-op on audio errors
  }
}

/**
 * Plays a solid piece capture sound
 */
export function playCaptureSound(): void {
  if (getAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // First impact
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(480, now);
    osc1.frequency.exponentialRampToValueAtTime(90, now + 0.06);

    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.06);

    // Subtle resonant knock
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(240, now + 0.01);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain2.gain.setValueAtTime(0.3, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.01);
    osc2.stop(now + 0.08);
  } catch {
    // Graceful no-op
  }
}

/**
 * Plays a two-tone alert check sound
 */
export function playCheckSound(): void {
  if (getAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.setValueAtTime(750, now + 0.04);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // Graceful no-op
  }
}

/**
 * Plays game completion sound
 */
export function playGameEndSound(): void {
  if (getAudioMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const chords = [330, 392, 523.25]; // E4, G4, C5 major chord

    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + idx * 0.05;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch {
    // Graceful no-op
  }
}
