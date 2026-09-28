import { useEffect, useRef, useState } from 'preact/hooks';
import type { Locale, RecordMode } from '../lib/types';
import {
  CAMERA_CONSTRAINTS,
  MIC_ONLY_CONSTRAINTS,
  SCREEN_CONSTRAINTS,
  VIDEO_MIME_CANDIDATES,
  buildRecordingFileName,
  downgradeRecordMode,
  isRecordingFeatureAvailable,
  pickSupportedMimeType,
  recordingPlanForMode,
  revokeObjectUrl,
  stopMediaStream,
  stopRecorderIfActive,
  visibleRecordModes,
  type RecordingCapabilities,
  type RecordingVariant,
} from '../lib/recorder';

export interface RecordingFile {
  url: string;
  name: string;
}

interface SlotState {
  status: 'idle' | 'active' | 'stopped' | 'failed';
  file: RecordingFile | null;
}

const SLOT_IDLE: SlotState = { status: 'idle', file: null };

function hasGetUserMedia(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
  } catch {
    return false;
  }
}

function hasGetDisplayMedia(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  } catch {
    return false;
  }
}

function hasMediaRecorder(): boolean {
  try {
    return typeof MediaRecorder !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * One recorder + its own file — used twice (once for the camera file, once for the screen file) so
 * "both" mode can run two independent MediaRecorders that start and stop together.
 */
function useRecordingSlot(variant: RecordingVariant) {
  const [state, setState] = useState<SlotState>(SLOT_IDLE);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef('');
  const keepRef = useRef(false);
  const fileRef = useRef<RecordingFile | null>(null);
  const topicRef = useRef('');
  const localeRef = useRef<Locale>('tr');
  const mountedRef = useRef(true);

  const hardStop = (): void => {
    stopRecorderIfActive(recorderRef.current);
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      hardStop();
      revokeObjectUrl(fileRef.current?.url ?? null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (keep: boolean): void => {
    const mime = mimeRef.current;
    const chunks = chunksRef.current;
    chunksRef.current = [];
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    if (mountedRef.current) setPreviewStream(null);

    if (keep && chunks.length > 0) {
      try {
        const blob = new Blob(chunks, mime ? { type: mime } : undefined);
        const url = URL.createObjectURL(blob);
        const name = buildRecordingFileName({ topic: topicRef.current, locale: localeRef.current, mimeType: mime, variant });
        fileRef.current = { url, name };
        if (mountedRef.current) setState({ status: 'stopped', file: fileRef.current });
      } catch {
        if (mountedRef.current) setState({ status: 'failed', file: null });
      }
      return;
    }
    if (mountedRef.current) setState({ status: 'idle', file: null });
  };

  /** Starts recording an already-acquired stream. `watchTrackEnd` finalizes (kept) if the visitor
   * stops sharing/permission via the browser's own UI (the video track's `ended` event). */
  const startWithStream = (stream: MediaStream, topic: string, locale: Locale, watchTrackEnd: boolean): boolean => {
    topicRef.current = topic;
    localeRef.current = locale;
    const mimeType = pickSupportedMimeType(VIDEO_MIME_CANDIDATES, (type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      stopMediaStream(stream);
      if (mountedRef.current) setState({ status: 'failed', file: null });
      return false;
    }
    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mimeRef.current = mimeType;
      keepRef.current = false;
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => finish(keepRef.current);
      recorder.start();
      streamRef.current = stream;
      recorderRef.current = recorder;
      if (watchTrackEnd) {
        const track = stream.getVideoTracks()[0];
        if (track) {
          // The visitor used the browser's own "Stop sharing" control — that recording ends here
          // (kept, however much was captured); any sibling recorder (see 'both' mode) keeps going.
          track.onended = () => {
            keepRef.current = true;
            stopRecorderIfActive(recorderRef.current);
          };
        }
      }
      if (mountedRef.current) {
        setState({ status: 'active', file: null });
        setPreviewStream(stream);
      }
      return true;
    } catch {
      stopMediaStream(stream);
      if (mountedRef.current) setState({ status: 'failed', file: null });
      return false;
    }
  };

  const markFailed = (): void => {
    if (mountedRef.current) setState({ status: 'failed', file: null });
  };

  const stop = (keep: boolean): void => {
    keepRef.current = keep;
    if (!recorderRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      if (mountedRef.current) setState((prev) => (prev.status === 'active' ? { status: 'idle', file: null } : prev));
      return;
    }
    stopRecorderIfActive(recorderRef.current);
  };

  const reset = (): void => {
    revokeObjectUrl(fileRef.current?.url ?? null);
    fileRef.current = null;
    if (mountedRef.current) setState(SLOT_IDLE);
  };

  return { state, previewStream, startWithStream, markFailed, stop, hardStop, reset };
}

export interface SelfRecordingApi {
  /** Both MediaRecorder and getUserMedia exist — otherwise the whole setting/UI must stay hidden. */
  available: boolean;
  capabilities: RecordingCapabilities;
  /** The record-mode options Settings should actually offer, given this browser's capabilities. */
  visibleModes: readonly RecordMode[];
  /** The effective mode of the current/last session (after any capability downgrade). */
  mode: RecordMode;
  active: boolean;
  /** Camera preview only — screen capture is never shown as a live preview. */
  previewStream: MediaStream | null;
  /** Nothing could be recorded at all; the talk continues unrecorded. */
  startFailed: boolean;
  /** 'both' mode only: the screen half failed/was declined but the camera half is still recording. */
  screenFailed: boolean;
  cameraFile: RecordingFile | null;
  screenFile: RecordingFile | null;
  /** Resolves once the screen-share picker (if any) has settled — camera/mic negotiation continues
   * in the background either way, matching "the timer never waits on camera/mic permission". */
  start: (mode: RecordMode, topic: string, locale: Locale) => Promise<void>;
  /** `keep=true` finalizes downloadable file(s); `keep=false` (early close) discards everything. */
  stop: (keep: boolean) => void;
  discardDownload: () => void;
}

/**
 * Orchestrates "kendini kaydet": requests camera/mic/screen only at the moment the speech timer
 * starts, records locally, and guarantees every track is stopped (camera/share light off) on a
 * natural finish, an early close, a tab hide, or unmount. Nothing is ever uploaded.
 */
export function useSelfRecording(): SelfRecordingApi {
  const cameraSlot = useRecordingSlot('kamera');
  const screenSlot = useRecordingSlot('ekran');
  const [mode, setMode] = useState<RecordMode>('off');
  const sessionTokenRef = useRef(0);

  const [capabilities] = useState<RecordingCapabilities>(() => {
    const camera = isRecordingFeatureAvailable(hasMediaRecorder(), hasGetUserMedia());
    return { camera, screen: camera && hasGetDisplayMedia() };
  });

  useEffect(() => {
    const onPageHide = (): void => {
      cameraSlot.hardStop();
      screenSlot.hardStop();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (requestedMode: RecordMode, topic: string, locale: Locale): Promise<void> => {
    const effective = downgradeRecordMode(requestedMode, capabilities);
    const plan = recordingPlanForMode(effective);
    if (!plan) {
      setMode('off');
      return Promise.resolve();
    }

    cameraSlot.reset();
    screenSlot.reset();
    setMode(effective);
    const token = (sessionTokenRef.current += 1);
    const stale = (): boolean => token !== sessionTokenRef.current;

    if (plan.camera) {
      navigator.mediaDevices
        .getUserMedia(CAMERA_CONSTRAINTS)
        .then((stream) => {
          if (stale()) {
            stopMediaStream(stream);
            return;
          }
          cameraSlot.startWithStream(stream, topic, locale, false);
        })
        .catch(() => {
          if (!stale()) cameraSlot.markFailed();
        });
    }

    const needsScreen = plan.screenOnly || plan.combineScreenWithMic;
    if (!needsScreen) return Promise.resolve();

    // MUST be the first call in this synchronous tick (no prior `await`) — Safari/Firefox only allow
    // getDisplayMedia while still inside the user gesture that triggered `start`.
    return navigator.mediaDevices
      .getDisplayMedia(SCREEN_CONSTRAINTS)
      .catch(() => null)
      .then((screenStream) => {
        if (stale()) {
          stopMediaStream(screenStream);
          return;
        }
        if (!screenStream) {
          screenSlot.markFailed();
          return;
        }
        if (plan.screenOnly) {
          // 'both': its own file, no mic (the camera file already carries the mic audio).
          screenSlot.startWithStream(screenStream, topic, locale, true);
          return;
        }
        // 'screen' mode: merge in the mic once it resolves — screen alone would have no audio.
        return navigator.mediaDevices
          .getUserMedia(MIC_ONLY_CONSTRAINTS)
          .catch(() => null)
          .then((micStream) => {
            if (stale()) {
              stopMediaStream(screenStream);
              stopMediaStream(micStream);
              return;
            }
            const combined = new MediaStream([
              ...screenStream.getVideoTracks(),
              ...(micStream ? micStream.getAudioTracks() : []),
            ]);
            screenSlot.startWithStream(combined, topic, locale, true);
          });
      });
  };

  const stop = (keep: boolean): void => {
    sessionTokenRef.current += 1;
    cameraSlot.stop(keep);
    screenSlot.stop(keep);
  };

  const discardDownload = (): void => {
    cameraSlot.reset();
    screenSlot.reset();
  };

  const cameraFailed = cameraSlot.state.status === 'failed';
  const screenFailed = screenSlot.state.status === 'failed';
  const active = cameraSlot.state.status === 'active' || screenSlot.state.status === 'active';
  const startFailed =
    mode !== 'off' &&
    ((mode === 'camera' && cameraFailed) ||
      (mode === 'screen' && screenFailed) ||
      (mode === 'both' && cameraFailed && screenFailed));
  const screenPartialFailed = mode === 'both' && screenFailed && !cameraFailed;

  return {
    available: capabilities.camera,
    capabilities,
    visibleModes: visibleRecordModes(capabilities),
    mode,
    active,
    previewStream: mode === 'camera' || mode === 'both' ? cameraSlot.previewStream : null,
    startFailed,
    screenFailed: screenPartialFailed,
    cameraFile: cameraSlot.state.file,
    screenFile: screenSlot.state.file,
    start,
    stop,
    discardDownload,
  };
}
