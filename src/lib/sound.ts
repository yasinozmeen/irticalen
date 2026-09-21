/** Sound engine: produces file-less effects with the Web Audio API. */
export interface SoundEngine {
  /** Warms up the AudioContext on the first user interaction (lazy creation). */
  warmUp(): void;
  /** Spin tick: ~30 ms of band-passed, decaying white noise (rate-limited). */
  tick(volume01: number): void;
  /** Landing chord: C5-E5-G5 sine. */
  land(): void;
  /** End fanfare: G4-C5-E5-G5 + final C6 triangle wave. */
  fanfare(): void;
  /** Sets the muted flag. */
  setMuted(muted: boolean): void;
  /** Whether sound is muted. */
  isMuted(): boolean;
}

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | undefined {
  try {
    const w = globalThis as unknown as {
      AudioContext?: AudioContextCtor;
      webkitAudioContext?: AudioContextCtor;
    };
    return w.AudioContext ?? w.webkitAudioContext;
  } catch {
    return undefined;
  }
}

/** createSoundEngine: the AudioContext is created lazily; if unavailable, every function is a no-op. */
export function createSoundEngine(): SoundEngine {
  let muted = false;
  let ctx: AudioContext | undefined;
  let attemptedInit = false;

  const ensureContext = (): AudioContext | undefined => {
    if (ctx) return ctx;
    if (attemptedInit) return ctx;
    attemptedInit = true;
    try {
      const Ctor = getAudioContextCtor();
      if (!Ctor) return undefined;
      ctx = new Ctor();
    } catch {
      ctx = undefined;
    }
    return ctx;
  };

  const safeNow = (audioCtx: AudioContext): number => {
    try {
      return audioCtx.currentTime;
    } catch {
      return 0;
    }
  };

  function playTone(
    audioCtx: AudioContext,
    freq: number,
    startAt: number,
    durationSec: number,
    type: OscillatorType,
    peakGain: number,
  ): void {
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(startAt);
      osc.stop(startAt + durationSec + 0.02);
    } catch {
      // ignore
    }
  }

  /** Minimum gap between ticks. Without it the fast start of a spin stacks dozens of bursts and distorts. */
  const MIN_TICK_GAP_MS = 45;
  const TICK_DURATION_SEC = 0.03;
  const TICK_PEAK_GAIN = 0.22;
  let lastTickAt = 0;
  let tickBuffer: AudioBuffer | undefined;

  /** Builds the tick sample once: white noise with an exponential decay baked in, so it never starts or ends abruptly. */
  function getTickBuffer(audioCtx: AudioContext): AudioBuffer {
    if (tickBuffer) return tickBuffer;
    const sampleRate = audioCtx.sampleRate ?? 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * TICK_DURATION_SEC));
    const buffer = audioCtx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    const attackFrames = Math.max(1, Math.floor(sampleRate * 0.001));
    for (let i = 0; i < frameCount; i++) {
      const attack = Math.min(1, i / attackFrames);
      const decay = Math.exp((-6 * i) / frameCount);
      data[i] = (Math.random() * 2 - 1) * attack * decay;
    }
    tickBuffer = buffer;
    return buffer;
  }

  function playNoiseBurst(audioCtx: AudioContext, volume01: number): void {
    try {
      const nowMs = Date.now();
      if (nowMs - lastTickAt < MIN_TICK_GAP_MS) return;
      lastTickAt = nowMs;

      const source = audioCtx.createBufferSource();
      source.buffer = getTickBuffer(audioCtx);

      const bandpass = audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 2400;
      bandpass.Q.value = 1.2;

      const gain = audioCtx.createGain();
      gain.gain.value = TICK_PEAK_GAIN * Math.min(1, Math.max(0, volume01));

      source.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(audioCtx.destination);
      source.start();
    } catch {
      // ignore
    }
  }

  return {
    warmUp(): void {
      if (muted) return;
      try {
        ensureContext();
      } catch {
        // no-op
      }
    },
    tick(volume01: number): void {
      if (muted) return;
      try {
        const audioCtx = ensureContext();
        if (!audioCtx) return;
        playNoiseBurst(audioCtx, volume01);
      } catch {
        // no-op
      }
    },
    land(): void {
      if (muted) return;
      try {
        const audioCtx = ensureContext();
        if (!audioCtx) return;
        const start = safeNow(audioCtx);
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, i) => {
          playTone(audioCtx, freq, start + i * 0.06, 0.18, 'sine', 0.2);
        });
      } catch {
        // no-op
      }
    },
    fanfare(): void {
      if (muted) return;
      try {
        const audioCtx = ensureContext();
        if (!audioCtx) return;
        const start = safeNow(audioCtx);
        const notes = [392, 523.25, 659.25, 783.99];
        notes.forEach((freq, i) => {
          playTone(audioCtx, freq, start + i * 0.12, 0.22, 'triangle', 0.22);
        });
        playTone(audioCtx, 1046.5, start + notes.length * 0.12, 0.4, 'triangle', 0.26);
      } catch {
        // no-op
      }
    },
    setMuted(next: boolean): void {
      muted = next;
    },
    isMuted(): boolean {
      return muted;
    },
  };
}
