import type { Locale, RecordFormat, RecordMode } from './types';
import { slugify } from './slug';
import { dayKey } from './streak';

/**
 * "Kendini kaydet" — an entirely local, device-only recording of the speaker while the speech
 * timer runs. Nothing here ever sends a byte anywhere: this module only decides what to request,
 * picks a MIME type, names the resulting file(s), and stops MediaStream tracks/recorders. The
 * actual MediaRecorder/getUserMedia/getDisplayMedia orchestration lives in the `useSelfRecording`
 * hook (impure, browser-only); everything here is pure and safe to unit test with fakes.
 */

const KNOWN_MODES: readonly RecordMode[] = ['off', 'camera', 'screen', 'both'];

/** Normalizes an untrusted (e.g. localStorage) value; anything unrecognized falls back to 'off'. */
export function normalizeRecordMode(raw: unknown): RecordMode {
  if (typeof raw === 'string' && (KNOWN_MODES as readonly string[]).includes(raw)) {
    return raw as RecordMode;
  }
  return 'off';
}

const KNOWN_FORMATS: readonly RecordFormat[] = ['template', 'raw'];

/** Normalizes an untrusted format value; anything unrecognized falls back to 'template' (the
 * default — a single composited file). */
export function normalizeRecordFormat(raw: unknown): RecordFormat {
  if (typeof raw === 'string' && (KNOWN_FORMATS as readonly string[]).includes(raw)) {
    return raw as RecordFormat;
  }
  return 'template';
}

/** What this browser can actually do. `screen` implies `camera` (MediaRecorder + getUserMedia). */
export interface RecordingCapabilities {
  camera: boolean;
  screen: boolean;
}

/** Both getUserMedia and MediaRecorder must exist — otherwise the whole feature stays hidden. */
export function isRecordingFeatureAvailable(hasMediaRecorderCtor: boolean, hasGetUserMedia: boolean): boolean {
  return hasMediaRecorderCtor && hasGetUserMedia;
}

/** The record-mode options to offer in Settings, given what this browser supports. */
export function visibleRecordModes(caps: RecordingCapabilities): readonly RecordMode[] {
  if (!caps.camera) return ['off'];
  return caps.screen ? ['off', 'camera', 'screen', 'both'] : ['off', 'camera'];
}

/**
 * A saved preference clamped to what this browser can do right now: `screen`/`both` fall back to
 * `camera` when there is no `getDisplayMedia`; everything falls back to `off` with no camera
 * support at all (no MediaRecorder / no getUserMedia).
 */
export function downgradeRecordMode(mode: RecordMode, caps: RecordingCapabilities): RecordMode {
  if (mode === 'off') return 'off';
  if (!caps.camera) return 'off';
  if ((mode === 'screen' || mode === 'both') && !caps.screen) return 'camera';
  return mode;
}

/** Which stream(s) a mode needs, and how they end up as file(s). Null means "record nothing". */
export interface RecordingPlan {
  /** Own file: getUserMedia({video:true, audio:true}) — camera video + mic audio together. */
  camera: boolean;
  /** Own file, video-only: a second, independent getDisplayMedia({video:true}) capture (used by 'both'). */
  screenOnly: boolean;
  /** One file: getDisplayMedia({video:true}) + getUserMedia({audio:true}) merged into a single stream. */
  combineScreenWithMic: boolean;
}

/** Pure decision table for what to request/record per mode — see docs in CLAUDE.md's task spec. */
export function recordingPlanForMode(mode: RecordMode): RecordingPlan | null {
  switch (mode) {
    case 'off':
      return null;
    case 'camera':
      return { camera: true, screenOnly: false, combineScreenWithMic: false };
    case 'screen':
      return { camera: false, screenOnly: false, combineScreenWithMic: true };
    case 'both':
      return { camera: true, screenOnly: true, combineScreenWithMic: false };
    default:
      return null;
  }
}

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = { video: true, audio: true };
export const MIC_ONLY_CONSTRAINTS: MediaStreamConstraints = { video: false, audio: true };
export const SCREEN_CONSTRAINTS: DisplayMediaStreamOptions = { video: true };

/** Tried in order; the first one `MediaRecorder.isTypeSupported` accepts wins. Safari needs mp4 first. */
export const VIDEO_MIME_CANDIDATES: readonly string[] = [
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm',
];

/** Returns the first supported candidate, or null when none are (that recording is then skipped). */
export function pickSupportedMimeType(
  candidates: readonly string[],
  isTypeSupported: (type: string) => boolean,
): string | null {
  for (const candidate of candidates) {
    try {
      if (isTypeSupported(candidate)) return candidate;
    } catch {
      // a throwing isTypeSupported counts as "not supported" for that candidate
    }
  }
  return null;
}

/** File extension implied by a recorded MIME type. Defaults to 'webm' for anything unrecognized. */
export function mimeExtension(mimeType: string): string {
  if (mimeType.startsWith('video/mp4') || mimeType.startsWith('audio/mp4')) return 'mp4';
  return 'webm';
}

/** Which of the (up to) two files a recording session produces. */
export type RecordingVariant = 'kamera' | 'ekran';

/** `irticalen-<konu-slug>-<YYYY-MM-DD>-<kamera|ekran>.<uzantı>` — local calendar day, locale-aware slug. */
export function buildRecordingFileName(params: {
  topic: string;
  locale: Locale;
  mimeType: string;
  variant: RecordingVariant;
  date?: Date;
}): string {
  const slug = slugify(params.topic, params.locale) || 'konu';
  const ext = mimeExtension(params.mimeType);
  const date = params.date ?? new Date();
  return `irticalen-${slug}-${dayKey(date)}-${params.variant}.${ext}`;
}

/** `irticalen-<konu-slug>-<YYYY-MM-DD>.<uzantı>` — the single composited ('template' format) file,
 * with no `<kamera|ekran>` suffix since there is only ever one file. */
export function buildCompositeFileName(params: {
  topic: string;
  locale: Locale;
  mimeType: string;
  date?: Date;
}): string {
  const slug = slugify(params.topic, params.locale) || 'konu';
  const ext = mimeExtension(params.mimeType);
  const date = params.date ?? new Date();
  return `irticalen-${slug}-${dayKey(date)}.${ext}`;
}

/** True for a getUserMedia/getDisplayMedia rejection that means "the person said no", not "no device". */
export function classifyMediaError(error: unknown): 'denied' | 'unavailable' {
  const name =
    error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  return 'unavailable';
}

/** Minimal shape needed to stop every track of a stream — deliberately loose so fakes/tests fit. */
export interface StoppableStream {
  getTracks(): { stop(): void }[];
}

/** Stops every track (turns the camera/mic/share light off). Never throws, tolerates null/undefined. */
export function stopMediaStream(stream: StoppableStream | null | undefined): void {
  if (!stream) return;
  try {
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // one bad track must not stop the others
      }
    }
  } catch {
    // getTracks itself failing is still a safe no-op
  }
}

/** Minimal shape of a MediaRecorder needed to stop it idempotently. */
export interface StoppableRecorder {
  state: string;
  stop(): void;
}

/** Stops a recorder only if it is actually running — calling `.stop()` twice throws in real browsers. */
export function stopRecorderIfActive(recorder: StoppableRecorder | null | undefined): void {
  if (!recorder) return;
  try {
    if (recorder.state !== 'inactive') recorder.stop();
  } catch {
    // best-effort
  }
}

/** Revokes a blob: URL if one was given. Never throws (e.g. during SSR, or an already-revoked URL). */
export function revokeObjectUrl(url: string | null | undefined): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // best-effort
  }
}
