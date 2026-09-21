/** Ses motoru: Web Audio ile dosyasız efektler üretir. */
export interface SoundEngine {
  /** İlk kullanıcı etkileşiminde AudioContext'i ısıtır (tembel oluşturma). */
  warmUp(): void;
  /** Çevirme tıkı: ~18 ms bant geçiren beyaz gürültü. */
  tick(volume01: number): void;
  /** İniş akoru: C5-E5-G5 sinüs. */
  land(): void;
  /** Bitiş fanfarı: G4-C5-E5-G5 + final C6 üçgen dalga. */
  fanfare(): void;
  /** Sessiz bayrağını ayarlar. */
  setMuted(muted: boolean): void;
  /** Sessiz mi? */
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

/** createSoundEngine: AudioContext tembel oluşturulur, yoksa tüm fonksiyonlar no-op'tur. */
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
      // sessizce yok say
    }
  }

  function playNoiseBurst(audioCtx: AudioContext, volume01: number): void {
    try {
      const durationSec = 0.018;
      const sampleRate = audioCtx.sampleRate ?? 44100;
      const frameCount = Math.max(1, Math.floor(sampleRate * durationSec));
      const buffer = audioCtx.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.min(1, Math.max(0, volume01));
      }
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      const bandpass = audioCtx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 2600;
      bandpass.Q.value = 1.2;

      const gain = audioCtx.createGain();
      gain.gain.value = Math.min(1, Math.max(0, volume01));

      source.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(audioCtx.destination);
      source.start();
      source.stop(safeNow(audioCtx) + durationSec + 0.01);
    } catch {
      // sessizce yok say
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
