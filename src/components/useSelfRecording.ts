import { recLog } from '../lib/recDebug';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Locale, RecordAspect, RecordFormat, RecordMode } from '../lib/types';
import {
  CAMERA_CONSTRAINTS,
  MIC_ONLY_CONSTRAINTS,
  SCREEN_CONSTRAINTS,
  VIDEO_MIME_CANDIDATES,
  buildCompositeFileName,
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
import {
  CompositorEngine,
  compositeModeFor,
  type CompositeMode,
  type CompositorAppState,
  type StyleDefinition,
} from '../lib/compositor';

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
 * "both" mode can run two independent MediaRecorders that start and stop together. Only used for
 * `recordFormat: 'raw'` — see `useTemplateRecording` for `'template'`.
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
  // Read live at `finish()` time (stop), not captured at `start()` time — a recording can start
  // before a topic has landed and the topic can change mid-session (see CLAUDE.md's task notes).
  const getTopicRef = useRef<() => string>(() => '');
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
        const name = buildRecordingFileName({
          topic: getTopicRef.current(),
          locale: localeRef.current,
          mimeType: mime,
          variant,
        });
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
   * stops sharing/permission via the browser's own UI (the video track's `ended` event). `getTopic`
   * is read only once, at `finish()` time — see `getTopicRef`. */
  const startWithStream = (stream: MediaStream, getTopic: () => string, locale: Locale, watchTrackEnd: boolean): boolean => {
    getTopicRef.current = getTopic;
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

/** What `acquireTemplateStreams` got for a 'template'-format session — the exact streams the
 * `CompositorEngine` should composite/record, plus whether a secondary source (screen, in 'both')
 * failed while the primary one still succeeded. */
interface TemplateAcquisition {
  cameraStream?: MediaStream;
  screenStream?: MediaStream;
  audioStream?: MediaStream;
  /** 'both' mode only: the screen half failed/was declined but the camera half is usable. */
  screenFailed: boolean;
}

/**
 * Acquires the stream(s) a composited ('template' format) session needs, for a given mode. Unlike
 * the 'raw' path's `start` (below), this always awaits every permission prompt before returning —
 * the composited frame needs every source it will ever have before it draws its very first frame, so
 * there is no equivalent of "camera negotiates in the background while the clock already started".
 * That is a deliberate, documented trade-off (see CLAUDE.md's task notes): a template recording can
 * delay the speech timer's start by however long the visitor takes to answer a permission prompt.
 */
async function acquireTemplateStreams(mode: CompositeMode): Promise<TemplateAcquisition | null> {
  if (mode === 'camera') {
    const cameraStream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS).catch((error: unknown) => {
      recLog(`kamera isteği başarısız: ${String(error)}`);
      return null;
    });
    if (!cameraStream) return null;
    return { cameraStream, audioStream: cameraStream, screenFailed: false };
  }
  if (mode === 'screen') {
    // getDisplayMedia must be the first call in this tick (Safari/Firefox only allow it inside the
    // gesture that triggered `start`) — same rule the 'raw' path follows below.
    const screenStream = await navigator.mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS).catch(() => null);
    if (!screenStream) return null;
    const micStream = await navigator.mediaDevices.getUserMedia(MIC_ONLY_CONSTRAINTS).catch(() => null);
    return { screenStream, audioStream: micStream ?? undefined, screenFailed: false };
  }
  // 'both': screen first (the same gesture rule), camera right after — both must settle before the
  // engine starts, so there is no benefit to requesting them concurrently here.
  const screenStream = await navigator.mediaDevices.getDisplayMedia(SCREEN_CONSTRAINTS).catch(() => null);
  const cameraStream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS).catch((error: unknown) => {
      recLog(`kamera isteği başarısız: ${String(error)}`);
      return null;
    });
  if (!cameraStream && !screenStream) return null;
  return {
    cameraStream: cameraStream ?? undefined,
    screenStream: screenStream ?? undefined,
    audioStream: cameraStream ?? undefined,
    screenFailed: !screenStream && Boolean(cameraStream),
  };
}

interface TemplateStartParams {
  mode: CompositeMode;
  style: StyleDefinition;
  aspect: RecordAspect;
  locale: Locale;
  /** Forwarded straight to the `CompositorEngine` — see `CompositorAppState`. Also read (for its
   * `.topic`) once the file is finalized, to name it. */
  getAppState: () => CompositorAppState;
}

/** The 'template'-format counterpart of `useRecordingSlot`: a single `CompositorEngine` session
 * producing one composited file instead of one-file-per-slot. See `../lib/compositor/engine.ts` for
 * the actual drawing/recording orchestration — this hook only wires it into Preact state. */
function useTemplateRecording() {
  const [status, setStatus] = useState<'idle' | 'active' | 'failed'>('idle');
  const [screenFailed, setScreenFailed] = useState(false);
  const [file, setFile] = useState<RecordingFile | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const engineRef = useRef<CompositorEngine | null>(null);
  const fileRef = useRef<RecordingFile | null>(null);
  // Read live at `onFinished` time (for its `.topic`), not captured once at `start()` — see
  // `TemplateStartParams`'s doc.
  const getAppStateRef = useRef<(() => CompositorAppState) | null>(null);
  const localeRef = useRef<Locale>('tr');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      engineRef.current?.hardStop();
      revokeObjectUrl(fileRef.current?.url ?? null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async (params: TemplateStartParams): Promise<void> => {
    getAppStateRef.current = params.getAppState;
    localeRef.current = params.locale;
    if (mountedRef.current) {
      setScreenFailed(false);
      setPreviewStream(null);
    }
    const acquired = await acquireTemplateStreams(params.mode);
    recLog(acquired ? 'izinler alındı, motor başlıyor' : 'KAMERA/EKRAN ALINAMADI (izin reddi ya da hata)');
    if (!acquired) {
      if (mountedRef.current) setStatus('failed');
      return;
    }
    if (mountedRef.current) {
      setScreenFailed(acquired.screenFailed);
      // See CLAUDE.md's task notes for why this mirrors the raw camera preview rather than a second
      // live decode of the composited canvas — cheapest option that still shows what's being recorded.
      setPreviewStream(acquired.cameraStream ?? null);
    }
    const engine = new CompositorEngine(
      {},
      {
        onFailed: () => {
          if (mountedRef.current) setStatus('failed');
        },
        // iOS ended the camera mid-take and the engine fetched a new one — keep the self-view live.
        onCameraStreamReplaced: (stream) => {
          if (mountedRef.current) setPreviewStream(stream);
        },
        onFinished: ({ blob, mimeType }) => {
          try {
            const url = URL.createObjectURL(blob);
            const topic = getAppStateRef.current?.().topic ?? '';
            const name = buildCompositeFileName({ topic, locale: localeRef.current, mimeType });
            fileRef.current = { url, name };
            if (mountedRef.current) {
              setFile(fileRef.current);
              setStatus('idle');
              setPreviewStream(null);
            }
          } catch {
            if (mountedRef.current) setStatus('failed');
          }
        },
      },
    );
    engineRef.current = engine;
    const ok = await engine.start({
      mode: params.mode,
      aspect: params.aspect,
      style: params.style,
      locale: params.locale,
      cameraStream: acquired.cameraStream,
      screenStream: acquired.screenStream,
      audioStream: acquired.audioStream,
      getAppState: params.getAppState,
    });
    if (ok && mountedRef.current) setStatus('active');
  };

  const stop = (keep: boolean): void => {
    engineRef.current?.requestStop(keep);
    // A discard resolves synchronously inside the engine; a kept stop plays out an outro first and
    // reports back through `onFinished` — `active` (derived from `status`) must stay true until then
    // so the "still recording" UI doesn't disappear before the file is actually ready.
    if (!keep && mountedRef.current) {
      setStatus('idle');
      setPreviewStream(null);
    }
  };

  const hardStop = (): void => {
    engineRef.current?.hardStop();
  };

  const reset = (): void => {
    revokeObjectUrl(fileRef.current?.url ?? null);
    fileRef.current = null;
    if (mountedRef.current) {
      setFile(null);
      setStatus('idle');
      setScreenFailed(false);
      setPreviewStream(null);
    }
  };

  return { status, screenFailed, file, previewStream, start, stop, hardStop, reset };
}

export interface StartOptions {
  mode: RecordMode;
  format: RecordFormat;
  style: StyleDefinition;
  aspect: RecordAspect;
  locale: Locale;
  /** Live app-session state — read every draw tick by the 'template' path (see `CompositorAppState`);
   * only its `.topic` is read (once, at stop) by the 'raw' path, to name the file(s). */
  getAppState: () => CompositorAppState;
}

export interface SelfRecordingApi {
  /** Both MediaRecorder and getUserMedia exist — otherwise the whole setting/UI must stay hidden. */
  available: boolean;
  capabilities: RecordingCapabilities;
  /** The record-mode options Settings should actually offer, given this browser's capabilities. */
  visibleModes: readonly RecordMode[];
  /** The effective mode/format of the current/last session (after any capability downgrade). */
  mode: RecordMode;
  format: RecordFormat;
  active: boolean;
  /** Camera preview only — screen capture is never shown as a live preview, in either format. */
  previewStream: MediaStream | null;
  /** Nothing could be recorded at all; the talk continues unrecorded. */
  startFailed: boolean;
  /** 'both' mode only: the screen half failed/was declined but the camera half is still recording. */
  screenFailed: boolean;
  /** 'raw' format only. */
  cameraFile: RecordingFile | null;
  /** 'raw' format only. */
  screenFile: RecordingFile | null;
  /** 'template' format only — the single composited file. */
  compositeFile: RecordingFile | null;
  /** Resolves once the screen-share picker (if any) has settled — camera/mic negotiation continues
   * in the background either way in 'raw' format; 'template' format awaits every source (see
   * `acquireTemplateStreams`). */
  start: (options: StartOptions) => Promise<void>;
  /** `keep=true` finalizes downloadable file(s); `keep=false` (early close) discards everything. */
  stop: (keep: boolean) => void;
  discardDownload: () => void;
}

/**
 * Orchestrates "kendini kaydet": requests camera/mic/screen only at the moment the speech timer
 * starts, records locally, and guarantees every track is stopped (camera/share light off) on a
 * natural finish, an early close, a tab hide, or unmount. Nothing is ever uploaded. Two independent
 * recording paths live side by side — 'raw' (`useRecordingSlot`, one/two plain files) and 'template'
 * (`useTemplateRecording`, one composited file via `CompositorEngine`) — `format` at `start()` time
 * picks which one actually runs; only that path's fields are populated afterwards.
 */
export function useSelfRecording(): SelfRecordingApi {
  const cameraSlot = useRecordingSlot('kamera');
  const screenSlot = useRecordingSlot('ekran');
  const template = useTemplateRecording();
  const [mode, setMode] = useState<RecordMode>('off');
  const [format, setFormat] = useState<RecordFormat>('template');
  const sessionTokenRef = useRef(0);

  const [capabilities] = useState<RecordingCapabilities>(() => {
    const camera = isRecordingFeatureAvailable(hasMediaRecorder(), hasGetUserMedia());
    return { camera, screen: camera && hasGetDisplayMedia() };
  });

  useEffect(() => {
    const onPageHide = (): void => {
      cameraSlot.hardStop();
      screenSlot.hardStop();
      template.hardStop();
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async (options: StartOptions): Promise<void> => {
    const effective = downgradeRecordMode(options.mode, capabilities);
    setFormat(options.format);

    if (options.format === 'template') {
      const compositeMode = compositeModeFor(effective);
      if (!compositeMode) {
        setMode('off');
        return;
      }
      setMode(effective);
      const token = (sessionTokenRef.current += 1);
      await template.start({
        mode: compositeMode,
        style: options.style,
        aspect: options.aspect,
        locale: options.locale,
        getAppState: options.getAppState,
      });
      // A session started after this one (a fast re-start) must not have its state clobbered by this
      // one settling late — mirrors the same guard the 'raw' path uses below.
      // A discarding stop, not `hardStop`: the switch was flicked off while the permission prompt was
      // still open, so the 'active' status this start just set must go back to idle too.
      if (token !== sessionTokenRef.current) template.stop(false);
      return;
    }

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
    // 'raw' format has no per-tick Frame to draw a topic into — only the filename needs it, read
    // live at stop time (a recording can start before a topic has landed).
    const getTopic = (): string => options.getAppState().topic ?? '';

    if (plan.camera) {
      navigator.mediaDevices
        .getUserMedia(CAMERA_CONSTRAINTS)
        .then((stream) => {
          if (stale()) {
            stopMediaStream(stream);
            return;
          }
          cameraSlot.startWithStream(stream, getTopic, options.locale, false);
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
          screenSlot.startWithStream(screenStream, getTopic, options.locale, true);
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
            screenSlot.startWithStream(combined, getTopic, options.locale, true);
          });
      });
  };

  const stop = (keep: boolean): void => {
    sessionTokenRef.current += 1;
    cameraSlot.stop(keep);
    screenSlot.stop(keep);
    template.stop(keep);
  };

  const discardDownload = (): void => {
    cameraSlot.reset();
    screenSlot.reset();
    template.reset();
  };

  const isTemplate = format === 'template';
  const cameraFailed = cameraSlot.state.status === 'failed';
  const screenFailed = screenSlot.state.status === 'failed';
  const rawActive = cameraSlot.state.status === 'active' || screenSlot.state.status === 'active';
  const active = isTemplate ? template.status === 'active' : rawActive;
  const rawStartFailed =
    mode !== 'off' &&
    ((mode === 'camera' && cameraFailed) ||
      (mode === 'screen' && screenFailed) ||
      (mode === 'both' && cameraFailed && screenFailed));
  const startFailed = isTemplate ? mode !== 'off' && template.status === 'failed' : rawStartFailed;
  const rawScreenPartialFailed = mode === 'both' && screenFailed && !cameraFailed;

  return {
    available: capabilities.camera,
    capabilities,
    visibleModes: visibleRecordModes(capabilities),
    mode,
    format,
    active,
    previewStream: isTemplate
      ? mode === 'camera' || mode === 'both'
        ? template.previewStream
        : null
      : mode === 'camera' || mode === 'both'
        ? cameraSlot.previewStream
        : null,
    startFailed,
    screenFailed: isTemplate ? template.screenFailed : rawScreenPartialFailed,
    cameraFile: isTemplate ? null : cameraSlot.state.file,
    screenFile: isTemplate ? null : screenSlot.state.file,
    compositeFile: isTemplate ? template.file : null,
    start,
    stop,
    discardDownload,
  };
}
