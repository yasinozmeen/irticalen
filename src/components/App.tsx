import { useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_RESEARCH_SEC,
  DEFAULT_SPEECH_SEC,
  createCountdown,
  createSoundEngine,
  initialSession,
  isLocked,
  loadSettings,
  planSpinFrom,
  drawFromBag,
  loadSeen,
  recordPractice,
  loadDays,
  currentStreak,
  practisedToday,
  saveSeen,
  positionFrom,
  saveSettings,
  hasSavedRecordAspect,
  sessionReducer,
  ALL_FIELD_ID,
  loadResearchField,
  saveResearchField,
  topicsForField,
  researchBagKey,
  SPIN_DURATION_MS,
  SPIN_SAFETY_MS,
  acquireWakeLock,
  runViewTransition,
  shareText as buildShareText,
  shareUrl,
  topicPageUrl,
  getTracker,
  buildTopicIndex,
  planResearchStages,
  researchStageAt,
  researchStageMinutes,
  sessionChapters,
  researchMinutes as spentResearchMinutes,
  youtubePrompt as buildYoutubePrompt,
  downgradeRecordMode,
  effectiveRecordFormat,
  allowedRecordFormats,
  normalizeStyleId,
  getStyle,
  resolveAspectForStyle,
  RICH_VIEW_MIN_WIDTH,
  type CompositorAppState,
  type FrameStage,
  type SessionMarks,
  type Countdown,
  type ReleaseWakeLock,
  type Settings,
  type DayLog,
} from '../lib';
import { formatClock, speechArcStep } from '../lib/timer';
import type { ShareChannel } from './SharePanel';
import type { Category, Mode, RecordAspect, RecordFormat, RecordMode } from '../lib/types';
import { useSelfRecording } from './useSelfRecording';
import { dictionaries, fill, type Locale } from '../i18n';
import { getCategories, getCategoryById } from '../data/topics';
import { ModeSwitch } from './ModeSwitch';
import { CategorySelect } from './CategorySelect';
import { CategoryIndex } from './CategoryIndex';
import { SpeechPlan } from './SpeechPlan';
import { TopicReel, type TopicReelHandle } from './TopicReel';
import { TimerOverlay } from './TimerOverlay';
import { SettingsDialog } from './SettingsDialog';
import { RecordingLive, RecordingSwitch } from './RecordingSwitch';
import { RecordingPreview } from './RecordingPreview';
import { RecordingShareButton, canShareVideoFiles } from './RecordingShareButton';
import { isDevHost } from '../lib/devHost';
import { ErrorBoundary } from './ErrorBoundary';
import { RecDebugPanel } from './RecDebugPanel';
import { installFakeCameraIfAsked, recLog } from '../lib/recDebug';

// GEÇİCİ tanı (recDebug.ts): ?sahtekamera=1 iken kamera yerine yapay görüntü.
installFakeCameraIfAsked();
import { Logo } from './Logo';
import { StreakSheet } from './StreakSheet';

/** How long the "süre." screen stays before the share screen takes over. */
const AUTO_SHARE_DELAY_MS = 1600;
const RECORDING_CAP_MS = 30 * 60 * 1000;

interface Props {
  locale: Locale;
}

const DEFAULT_CATEGORY_ID = 'general';
/** How long to let the "word slides back into the wheel" view transition play before the wheel
 * itself starts turning on a re-spin — roughly the ~70% mark of the transition's own duration. */
const RESPIN_TRANSITION_LEAD_MS = 320;

function AppContent({ locale }: Props) {
  const dict = dictionaries[locale];

  const [state, dispatch] = useReducer(sessionReducer, undefined, initialSession);
  const [settings, setSettings] = useState<Settings>({
    speechSec: DEFAULT_SPEECH_SEC,
    researchSec: DEFAULT_RESEARCH_SEC,
    muted: false,
    hideClock: false,
    record: 'camera',
    recordFormat: 'template',
    recordStyle: normalizeStyleId(undefined),
    recordAspect: 'wide',
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Desktop "rich" (open-book) view is purely a function of viewport width (no setting any more) —
  // SSR-safe default (not wide); the real width is only known on the client, below.
  const [isWide, setIsWide] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);
  // SSR-safe empty default; the real log loads on the client below. Kept only in this browser.
  const [days, setDays] = useState<DayLog>({});
  const [landKey, setLandKey] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  // Read by the composite recording engine's per-tick callback, which runs outside React's render
  // cycle — the same "ref mirrors state for a closure that can't wait for the next render" pattern
  // used elsewhere in this file (e.g. `stateRef`).
  const elapsedSecRef = useRef(0);
  elapsedSecRef.current = elapsedSec;
  const [timerTotalSec, setTimerTotalSec] = useState(0);
  // Read by the recording engine's per-tick `getAppState` callback — same "ref mirrors state" pattern
  // as `elapsedSecRef` just above.
  const timerTotalSecRef = useRef(0);
  timerTotalSecRef.current = timerTotalSec;
  // The planned speech length, for a recording's frames before the speech timer runs (the timer
  // state above holds the RESEARCH timer's numbers during research, and zeros before any timer).
  const speechSecRef = useRef(DEFAULT_SPEECH_SEC);
  speechSecRef.current = settings.speechSec;
  // Research stages: the clock moves the stage forward; "sonraki bölüm" can only jump ahead of it.
  const [researchStage, setResearchStage] = useState(0);
  // The stage already decided on — set synchronously, because the state itself only lands once the
  // view transition's update runs, and a clock tick in between must not advance (and chime) twice.
  const researchStageRef = useRef(0);
  // Wall-clock marks of the running session — the YouTube prompt turns them into chapter hints.
  const marksRef = useRef<SessionMarks | null>(null);
  const [gatherChecked, setGatherChecked] = useState<boolean[]>([false, false, false, false, false]);
  // The selected "field" (a group within the deep-research pool) — 'all' means every topic in the
  // pool, unfiltered. SSR-safe default; the saved value loads on the client below.
  const [researchField, setResearchField] = useState<string>(ALL_FIELD_ID);

  const recording = useSelfRecording();
  // Read inside timer callbacks, which close over an older render.
  const recordingActiveRef = useRef(false);
  recordingActiveRef.current = recording.active;
  // True from the moment the main-screen switch is flicked on until the engine/streams have actually
  // settled (permission prompt, negotiation) — lets the switch itself flip instantly on click (the
  // permission prompt is the "kayıt o an başlar" feedback) while `recording.active` catches up a beat
  // later. Reset once `start()` settles either way (success or failure).
  const [recordingPending, setRecordingPending] = useState(false);
  // Safety cap: a forgotten recording stops (and is kept) after 30 minutes so memory cannot run out.
  useEffect(() => {
    if (!recording.active) return;
    const cap = setTimeout(() => recording.stop(true), RECORDING_CAP_MS);
    return () => clearTimeout(cap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording.active]);
  // The screen stays on for as long as a recording runs — it may start long before the speech timer
  // (whose own wake lock covers only the timer), and a phone locking itself mid-intro would cut the
  // camera. The browser drops a wake lock whenever the page is hidden, so it is taken again on return.
  const recordingKeepsScreenOn = recording.active || recordingPending;
  useEffect(() => {
    if (!recordingKeepsScreenOn) return;
    let alive = true;
    let release: ReleaseWakeLock | null = null;
    const take = (): void => {
      void acquireWakeLock().then((next) => {
        if (!alive) {
          next();
          return;
        }
        release?.();
        release = next;
      });
    };
    take();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') take();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      release?.();
    };
  }, [recordingKeepsScreenOn]);

  // The main-screen switch's own mm:ss readout — independent of the speech timer (see CLAUDE.md's
  // task notes: recording can run before/after/without a speech session).
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);
  useEffect(() => {
    if (!recording.active) {
      setRecordingElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    setRecordingElapsedSec(0);
    const id = setInterval(() => setRecordingElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(id);
  }, [recording.active]);
  const soundRef = useRef(createSoundEngine());
  const countdownRef = useRef<Countdown | null>(null);
  const wakeLockReleaseRef = useRef<ReleaseWakeLock | null>(null);
  const wakeLockTokenRef = useRef(0);
  const lastCategoryIdRef = useRef<string>(DEFAULT_CATEGORY_ID);
  const rafRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const streakTriggerRef = useRef<HTMLButtonElement>(null);
  const startTriggerRef = useRef<HTMLButtonElement>(null);
  const wheelRef = useRef<TopicReelHandle>(null);
  const trackerRef = useRef(getTracker(locale));
  const tracker = trackerRef.current;
  const stateRef = useRef(state);
  stateRef.current = state;
  const mountTimeRef = useRef(0);
  // One-shot guards: state updates land a render later, so a timer hitting zero and a tap in the
  // same instant must not report the same milestone twice (or a finish as an early close).
  const researchDoneSentRef = useRef(false);
  const speechDoneSentRef = useRef(false);
  const leaveSentRef = useRef(false);
  const autoShareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const respinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinBusyRef = useRef(false);

  const categories: Category[] = useMemo(() => getCategories(locale), [locale]);

  // page_view once on mount, leave (with elapsed seconds + current phase) on pagehide, and the two
  // window-level error hooks (uncaught errors + unhandled rejections both count as js_error).
  useEffect(() => {
    mountTimeRef.current = Date.now();
    tracker.track('page_view');

    const onPageHide = (): void => {
      if (leaveSentRef.current) return;
      leaveSentRef.current = true;
      const elapsedSec = Math.max(0, Math.round((Date.now() - mountTimeRef.current) / 1000));
      tracker.track('leave', { v: elapsedSec, ph: stateRef.current.phase });
    };
    const errorMessage = (value: unknown): string => {
      if (value instanceof Error) return value.message;
      try {
        return String(value);
      } catch {
        return 'error';
      }
    };
    const onError = (event: ErrorEvent): void => {
      tracker.track('js_error', { t: event.message });
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      tracker.track('js_error', { t: errorMessage(event.reason) });
    };

    // Back/forward cache: the page comes back without re-mounting — start a fresh visit clock.
    const onPageShow = (event: PageTransitionEvent): void => {
      if (!event.persisted) return;
      mountTimeRef.current = Date.now();
      leaveSentRef.current = false;
      tracker.track('page_view');
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load persisted settings on the client only, after the SSR-safe defaults have rendered. A saved
  // record mode this browser can no longer do (e.g. no getDisplayMedia) is clamped and re-saved.
  useEffect(() => {
    const loaded = loadSettings();
    const record = downgradeRecordMode(loaded.record, recording.capabilities);
    if (record !== loaded.record) saveSettings({ record });
    // A phone is held upright: without a saved choice its recording is vertical (not persisted, so
    // the same visitor on a laptop still gets the wide default).
    const recordAspect =
      !recording.capabilities.screen && !hasSavedRecordAspect()
        ? resolveAspectForStyle(getStyle(loaded.recordStyle), 'tall')
        : loaded.recordAspect;
    setSettings({ ...loaded, record, recordAspect });
    soundRef.current.setMuted(loaded.muted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same for the practice log that drives the streak indicator — client only.
  useEffect(() => {
    setDays(loadDays());
  }, []);

  // The rich view is only ever applied at >=1100px — a narrow window (or a phone) always gets the
  // minimalist layout. Tracks live resizes too, not just the initial width, so dragging a window
  // across the threshold switches layouts immediately — but only once per crossing (matchMedia's
  // `change` event fires exactly at the threshold, never per resize frame), and through a view
  // transition so the switch slides instead of popping (see CLAUDE.md's "Geçişler" rule).
  useEffect(() => {
    let mql: MediaQueryList | undefined;
    try {
      mql = matchMedia(`(min-width: ${RICH_VIEW_MIN_WIDTH}px)`);
      setIsWide(mql.matches);
      const onChange = (event: MediaQueryListEvent): void => {
        void runViewTransition(() => setIsWide(event.matches));
      };
      mql.addEventListener('change', onChange);
      return () => mql?.removeEventListener('change', onChange);
    } catch {
      return undefined;
    }
  }, []);

  // Load the persisted research field the same way — runs before the `?konu=` preset effect below,
  // which may override it (unsaved) for a single preset topic.
  useEffect(() => {
    const validIds = (getCategoryById(locale, 'deep-research')?.groups ?? []).map((group) => group.id);
    setResearchField(loadResearchField(validIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `/?konu=<slug>` (tr) or `/en/?topic=<slug>` (en): preset the topic from a shared link, mark it
  // seen, then strip the param from the address bar. Runs once, mount-only; an invalid/missing slug
  // is silently ignored.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const paramName = locale === 'tr' ? 'konu' : 'topic';
      const slugParam = params.get(paramName);
      if (slugParam) {
        const entry = buildTopicIndex(locale).find((item) => item.slug === slugParam);
        if (entry) {
          const mode: Mode = entry.categoryId === 'deep-research' ? 'deep-research' : 'off-the-cuff';
          // A link-preset research topic must land in the currently displayed wheel — the simplest
          // way to guarantee that is to show it against the unfiltered pool ('all'), same as the
          // index below (computed from the whole category, not a group). Not saved: the visitor's
          // own field preference is untouched for next time.
          if (mode === 'deep-research') setResearchField(ALL_FIELD_ID);
          const category = getCategoryById(locale, entry.categoryId);
          const idx = category ? category.topics.indexOf(entry.topic) : -1;
          dispatch({ type: 'PRESET_TOPIC', mode, categoryId: entry.categoryId, topicIndex: idx, topic: entry.topic });
          if (mode === 'off-the-cuff') lastCategoryIdRef.current = entry.categoryId;
          const seen = loadSeen(locale, entry.categoryId);
          if (!seen.includes(entry.topic)) saveSeen(locale, entry.categoryId, [...seen, entry.topic]);
          // Reuses the existing `land` contract (no new event name) with ph:'idle' to mark a
          // link-preset topic, distinct from a real spin's ph.
          tracker.track('land', {
            t: entry.topic,
            m: mode,
            c: mode === 'off-the-cuff' ? entry.categoryId : undefined,
            ph: 'idle',
          });
        }
        params.delete(paramName);
        const search = params.toString();
        const newUrl = window.location.pathname + (search ? `?${search}` : '') + window.location.hash;
        window.history.replaceState(null, '', newUrl);
      }
    } catch {
      // never let a bad URL param break the app
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.mode === 'off-the-cuff' && state.categoryId) {
      lastCategoryIdRef.current = state.categoryId;
    }
  }, [state.categoryId, state.mode]);

  const effectiveCategoryId =
    state.mode === 'deep-research' ? 'deep-research' : state.categoryId ?? lastCategoryIdRef.current;

  const deepResearchCategory = useMemo(() => getCategoryById(locale, 'deep-research'), [locale]);

  // The field options shown in the (reused) category select while in deep-research mode: "Hepsi"
  // first, then one option per group. `topics` is unused by CategorySelect itself but keeps these
  // objects shaped like `Category`.
  const researchFieldOptions: Category[] = useMemo(() => {
    const groups = deepResearchCategory?.groups ?? [];
    return [
      { id: ALL_FIELD_ID, label: dict.category.all, topics: deepResearchCategory?.topics ?? [] },
      ...groups.map((group) => ({ id: group.id, label: group.label, topics: group.topics })),
    ];
  }, [deepResearchCategory, dict.category.all]);

  const topics = useMemo(() => {
    if (state.mode === 'deep-research') return topicsForField(deepResearchCategory, researchField);
    return getCategoryById(locale, effectiveCategoryId)?.topics ?? [];
  }, [locale, effectiveCategoryId, state.mode, deepResearchCategory, researchField]);

  // The topic-bag (seen-list) key: per-field in deep-research mode (so switching fields doesn't
  // burn the other field's topics), the plain category id everywhere else.
  const bagKey =
    state.mode === 'deep-research' ? researchBagKey(effectiveCategoryId, researchField) : effectiveCategoryId;

  const topicIndex = useMemo(() => buildTopicIndex(locale), [locale]);
  const currentSlug = useMemo(() => {
    if (!state.topic) return null;
    const inCategory = topicIndex.find(
      (entry) => entry.topic === state.topic && entry.categoryId === effectiveCategoryId,
    );
    return inCategory?.slug ?? topicIndex.find((entry) => entry.topic === state.topic)?.slug ?? null;
  }, [topicIndex, state.topic, effectiveCategoryId]);

  const clearSpinTimers = (): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (safetyTimeoutRef.current !== null) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    if (respinTimeoutRef.current !== null) {
      clearTimeout(respinTimeoutRef.current);
      respinTimeoutRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearSpinTimers();
      if (autoShareTimerRef.current !== null) clearTimeout(autoShareTimerRef.current);
    },
    [],
  );

  // Development copies only: ends the running countdown as if time had run out (same sounds,
  // tracking, streak and share flow) — no waiting out a full minute while testing.
  const handleFinishEarly = (): void => {
    countdownRef.current?.finishNow();
  };

  const stopCountdown = (): void => {
    countdownRef.current?.stop();
    countdownRef.current = null;
  };

  const releaseWakeLock = (): void => {
    // Invalidate any acquisition still in flight so it is released as soon as it resolves.
    wakeLockTokenRef.current += 1;
    wakeLockReleaseRef.current?.();
    wakeLockReleaseRef.current = null;
  };

  const holdWakeLock = (): void => {
    releaseWakeLock();
    const token = wakeLockTokenRef.current;
    void acquireWakeLock().then((release) => {
      if (token !== wakeLockTokenRef.current) {
        release();
        return;
      }
      wakeLockReleaseRef.current = release;
    });
  };

  const beginCountdown = (phaseSeconds: number): void => {
    stopCountdown();
    setTimerTotalSec(phaseSeconds);
    setRemainingSec(phaseSeconds);
    setElapsedSec(0);
    countdownRef.current = createCountdown({
      seconds: phaseSeconds,
      onTick: (remaining) => {
        setRemainingSec(remaining);
        setElapsedSec(phaseSeconds - remaining);
      },
      onDone: () => {
        soundRef.current.fanfare();
        const wasResearch = stateRef.current.phase === 'research';
        const wasSpeech = stateRef.current.phase === 'speech';
        dispatch({ type: 'TIME_UP' });
        countdownRef.current = null;
        if (wasResearch && marksRef.current) marksRef.current.researchEndAt = Date.now();
        // Natural time-out counts the same as the matching manual action below.
        if (wasResearch && !researchDoneSentRef.current) {
          researchDoneSentRef.current = true;
          tracker.track('research_done');
        } else if (wasSpeech && !speechDoneSentRef.current) {
          speechDoneSentRef.current = true;
          tracker.track('speech_done');
          // The day counts for the practice streak (kept only in this browser) — the indicator and
          // the "bugün tamam" line both read the updated log straight from state.
          setDays(recordPractice(stateRef.current.mode));
          // A self-recording keeps running past the timer until the speaker stops it — no auto share
          // screen then (the stop button stays in front).
          if (recordingActiveRef.current) return;
          // The speech is over — after the "süre." beat, move on to the share screen by itself.
          if (autoShareTimerRef.current !== null) clearTimeout(autoShareTimerRef.current);
          autoShareTimerRef.current = setTimeout(() => {
            autoShareTimerRef.current = null;
            if (stateRef.current.phase !== 'done') return;
            tracker.track('share_click', { t: 'auto' });
            void runViewTransition(() => setSharePanelOpen(true));
          }, AUTO_SHARE_DELAY_MS);
        }
      },
    });
    holdWakeLock();
  };

  const handleModeChange = (mode: Mode): void => {
    if (isLocked(state)) return;
    dispatch({ type: 'SET_MODE', mode });
    tracker.track('mode_change', { m: mode });
  };

  const handleCategoryChange = (categoryId: string): void => {
    if (isLocked(state)) return;
    const category = getCategoryById(locale, categoryId);
    const list = category?.topics ?? [];
    if (list.length === 0) return;
    // A new category starts empty, like a new mode: the topic only comes from a spin, so browsing
    // the category list never uses up topics from the bag.
    if (categoryId === state.categoryId) return;
    dispatch({ type: 'SET_CATEGORY', categoryId, topicIndex: -1, topic: null });
    tracker.track('category_change', { c: categoryId });
  };

  // Field change in deep-research mode: behaves like `handleCategoryChange` above (empties the
  // topic, never touches the bag), but the session's categoryId stays 'deep-research' — only the
  // App-level field selection changes, so it uses CLEAR_TOPIC instead of SET_CATEGORY.
  const handleResearchFieldChange = (fieldId: string): void => {
    if (isLocked(state)) return;
    if (fieldId === researchField) return;
    setResearchField(fieldId);
    saveResearchField(fieldId);
    dispatch({ type: 'CLEAR_TOPIC' });
    tracker.track('category_change', { m: 'deep-research', c: fieldId });
  };

  const handleSpin = (): void => {
    // `state.spinning` only flips a render later (and, on a re-spin, inside a view transition), so a
    // fast double tap would pass the state check twice — the ref is the real lock.
    if (spinBusyRef.current || isLocked(state) || topics.length === 0) return;
    spinBusyRef.current = true;
    soundRef.current.warmUp();
    const draw = drawFromBag(topics, loadSeen(locale, bagKey), state.topicIndex);
    tracker.track('spin', {
      m: state.mode,
      c: state.mode === 'off-the-cuff' ? effectiveCategoryId : researchField,
    });

    let reduced = false;
    try {
      reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduced = false;
    }

    const finalize = (): void => {
      spinBusyRef.current = false;
      clearSpinTimers();
      const index = draw.index;
      // Marked as seen only once it is actually shown — an interrupted spin does not burn a topic.
      saveSeen(locale, bagKey, draw.seen);
      soundRef.current.land();
      // Landing hands the topic word's view-transition name from the wheel's center face to the
      // big topic display — the dispatch itself is the swap moment the transition captures.
      void runViewTransition(() => {
        dispatch({ type: 'SPIN_LAND', index, topic: topics[index] });
        setLandKey((key) => key + 1);
      });
      tracker.track('land', {
        t: topics[index],
        m: state.mode,
        c: state.mode === 'off-the-cuff' ? effectiveCategoryId : researchField,
      });
    };

    // The wheel's position is anchored to index 0 and persists across spins/idle drift (see
    // TopicReel) — reading it here, right before the wheel starts turning, is what lets the spin
    // continue from wherever it already is instead of jumping back to a standing start.
    const runSpinLoop = (): void => {
      if (reduced || topics.length === 1) {
        finalize();
        return;
      }

      const p0 = wheelRef.current?.getPosition() ?? 0;
      const plan = planSpinFrom(p0, 0, topics.length, draw.index);
      const start = performance.now();
      let lastTickStep = Math.floor(p0);

      const frame = (now: number): void => {
        const elapsed = now - start;
        const progress = Math.min(1, elapsed / SPIN_DURATION_MS);
        const position = positionFrom(p0, plan.target, progress);
        wheelRef.current?.setPosition(position);
        const step = Math.floor(position);
        if (step !== lastTickStep) {
          lastTickStep = step;
          soundRef.current.tick(Math.max(0.08, 1 - progress));
        }
        if (elapsed >= SPIN_DURATION_MS) {
          finalize();
          return;
        }
        rafRef.current = requestAnimationFrame(frame);
      };

      rafRef.current = requestAnimationFrame(frame);
      safetyTimeoutRef.current = setTimeout(finalize, SPIN_SAFETY_MS);
    };

    if (state.topic !== null && !reduced) {
      // "tekrar çevir": the big word slides back into the wheel's center face first — SPIN_START is
      // the swap moment — then, once that transition is mostly done, the wheel starts turning.
      void runViewTransition(() => {
        dispatch({ type: 'SPIN_START' });
      });
      respinTimeoutRef.current = setTimeout(() => {
        respinTimeoutRef.current = null;
        runSpinLoop();
      }, RESPIN_TRANSITION_LEAD_MS);
    } else {
      dispatch({ type: 'SPIN_START' });
      runSpinLoop();
    }
  };

  // Everything a `Frame` (and, for 'raw' format, just the eventual filename) needs about the live
  // session — read fresh every draw tick / at stop time, never captured once. `stateRef`/
  // `elapsedSecRef`/`timerTotalSecRef` all mirror state a render behind, same pattern used throughout
  // this file. `state.phase`'s own values ('research'/'ready'/'speech'/'done') line up 1:1 with
  // `FrameStage` — only 'idle' needs splitting (no topic yet vs. landed) and a spin overrides both.
  const getRecordingAppState = (): CompositorAppState => {
    const s = stateRef.current;
    let stage: FrameStage;
    if (s.spinning) stage = 'spinning';
    else if (s.phase === 'idle') stage = s.topic === null ? 'idle' : 'landed';
    else stage = s.phase;
    // `Frame.elapsedSec/totalSec` are the SPEECH timer's: 0 / planned length until it starts.
    const speechRunning = stage === 'speech' || stage === 'done';
    const elapsed = speechRunning ? elapsedSecRef.current : 0;
    const total = speechRunning ? timerTotalSecRef.current : speechSecRef.current;
    return {
      stage,
      // Lowercase, like every topic on the site ("Konu küçük harf").
      topic: s.topic === null ? null : s.topic.toLocaleLowerCase(locale),
      sessionMode: s.mode,
      elapsedSec: elapsed,
      totalSec: total,
      arcStep: speechArcStep(elapsed, total),
    };
  };

  // Turns the main-screen "kayıt" switch on: recording is now independent of the speech timer — it
  // can start before a topic has even landed and keeps running across research/ready/speech/done (see
  // CLAUDE.md's task notes). MUST be called directly from the click handler with no prior `await`:
  // getDisplayMedia/getUserMedia (inside `recording.start`) only work inside the user gesture that
  // triggered them on Safari/Firefox.
  const startSelfRecording = (): void => {
    if (recording.active || recordingPending) return;
    // Inside the click: iOS only lets an AudioContext start from a gesture (see `mixAudio` below).
    soundRef.current.unlock();
    // A previous session's finished recording (if not yet downloaded) is gone once a new one starts.
    recording.discardDownload();
    setRecordingPending(true);
    void recording
      .start({
        mode: settings.record,
        format: effectiveRecordFormat(settings.recordFormat, recording.capabilities),
        style: getStyle(settings.recordStyle),
        aspect: resolveAspectForStyle(getStyle(settings.recordStyle), settings.recordAspect),
        locale,
        getAppState: getRecordingAppState,
        // The site's own sounds (spin ticks, landing chord, end fanfare) and a shared tab's sound go
        // into the file too. Muted with nothing else to mix → the mic is recorded directly.
        mixAudio: (inputs) =>
          settings.muted && inputs.length <= 1 ? null : soundRef.current.mixForRecording(inputs),
      })
      .then(() => setRecordingPending(false));
  };

  const handleRecordingToggle = (): void => {
    recLog(`kişi: kayıt anahtarı (${recording.active || recordingPending ? 'kapat' : 'aç'})`);
    if (recording.active || recordingPending) {
      recording.stop(true);
      setRecordingPending(false);
      return;
    }
    startSelfRecording();
  };

  const handleStart = (): void => {
    if (isLocked(state) || state.topic === null) return;
    soundRef.current.warmUp();
    const nextPhase = state.mode === 'deep-research' ? 'research' : 'speech';
    // Opening the timer hands the topic word's view-transition name from the big landed display to
    // `.timer-topic` — the dispatch is the swap moment the transition captures.
    void runViewTransition(() => {
      dispatch({ type: 'START' });
    });
    beginCountdown(nextPhase === 'research' ? settings.researchSec : settings.speechSec);
    setResearchStage(0);
    researchStageRef.current = 0;
    const startedAt = Date.now();
    marksRef.current = {
      startedAt,
      stages: nextPhase === 'research' ? [{ stage: 'gather', at: startedAt }] : [],
      researchEndAt: null,
      speechAt: nextPhase === 'speech' ? startedAt : null,
      speechSec: settings.speechSec,
    };
    setGatherChecked([false, false, false, false, false]);
    researchDoneSentRef.current = false;
    speechDoneSentRef.current = false;
    tracker.track(nextPhase === 'research' ? 'start_research' : 'start_speech', {
      m: state.mode,
      t: state.topic,
      c: state.mode === 'off-the-cuff' ? effectiveCategoryId : researchField,
    });
  };

  const handleDoneResearching = (): void => {
    if (state.phase !== 'research') return;
    stopCountdown();
    soundRef.current.land();
    if (marksRef.current) marksRef.current.researchEndAt = Date.now();
    dispatch({ type: 'RESEARCH_DONE' });
    setTimerTotalSec(settings.speechSec);
    setRemainingSec(settings.speechSec);
    setElapsedSec(0);
    if (!researchDoneSentRef.current) {
      researchDoneSentRef.current = true;
      tracker.track('research_done');
    }
  };

  const handleReadyToSpeak = (): void => {
    if (state.phase !== 'ready') return;
    const topic = state.topic;
    const mode = state.mode;
    dispatch({ type: 'READY_TO_SPEAK' });
    if (marksRef.current) marksRef.current.speechAt = Date.now();
    beginCountdown(settings.speechSec);
    tracker.track('start_speech', { m: mode, t: topic ?? undefined });
  };

  const handleStopRecording = (): void => {
    recording.stop(true);
  };

  const handleClose = (): void => {
    // Escape while a past-the-timer recording runs means "stop recording", not "throw it away".
    if (state.phase === 'done' && recording.active) {
      recording.stop(true);
      return;
    }
    if (autoShareTimerRef.current !== null) {
      clearTimeout(autoShareTimerRef.current);
      autoShareTimerRef.current = null;
    }
    // `ready` has no running clock, so it carries no remaining time — the phase alone tells the story.
    const phase = state.phase;
    if (!speechDoneSentRef.current && (phase === 'research' || phase === 'speech' || phase === 'ready')) {
      tracker.track('close_early', { v: phase === 'ready' ? undefined : remainingSec, ph: phase });
    }
    stopCountdown();
    releaseWakeLock();
    // Recording is independent of the speech session now (see CLAUDE.md's task notes): closing early
    // no longer discards it — it just keeps running, controlled only by the main-screen switch, the
    // overlay's own "kaydı durdur", Escape once 'done', the 30-minute cap, or pagehide.
    setSharePanelOpen(false);
    // Closing hands the topic word's view-transition name back from `.timer-topic` to the big
    // landed display it came from.
    // Focus goes back only once the shell is no longer inert — a focus() on an inert subtree is dropped.
    void runViewTransition(
      () => {
        dispatch({ type: 'CLOSE' });
      },
      () => startTriggerRef.current?.focus(),
    );
  };

  const researchPlan = useMemo(() => planResearchStages(settings.researchSec), [settings.researchSec]);
  const researchStageIds = useMemo(() => researchPlan.map((entry) => entry.stage), [researchPlan]);
  // Rich view only: the same split, expressed as each stage's own minute length, for the "önce topla
  // n dk · kur n dk · ısın n dk" line shown above the action row before the timer ever opens.
  const researchStagesMinutes = useMemo(
    () => researchStageMinutes(settings.researchSec),
    [settings.researchSec],
  );

  // Time crossing a stage boundary moves the stage forward (never back — a skipped-ahead stage
  // stays). The new stage's guide arrives inside a view transition, with a soft chord as the cue.
  useEffect(() => {
    if (state.phase !== 'research') return;
    const byTime = researchStageAt(researchPlan, elapsedSec);
    if (byTime <= researchStageRef.current) return;
    researchStageRef.current = byTime;
    marksRef.current?.stages.push({ stage: researchPlan[byTime].stage, at: Date.now() });
    soundRef.current.land();
    void runViewTransition(() => setResearchStage(byTime));
  }, [state.phase, elapsedSec, researchPlan]);

  const handleNextStage = (): void => {
    if (state.phase !== 'research' || researchStageRef.current >= researchPlan.length - 1) return;
    const next = researchStageRef.current + 1;
    researchStageRef.current = next;
    marksRef.current?.stages.push({ stage: researchPlan[next].stage, at: Date.now() });
    soundRef.current.land();
    void runViewTransition(() => setResearchStage(next));
  };

  const handleToggleGather = (index: number): void => {
    setGatherChecked((prev) => prev.map((checked, i) => (i === index ? !checked : checked)));
  };

  const handleToggleClock = (): void => {
    const hideClock = !settings.hideClock;
    setSettings((prev) => ({ ...prev, hideClock }));
    saveSettings({ hideClock });
  };

  const shareTextValue = buildShareText(dict.share.text, {
    topic: state.topic ?? '',
    minutes: Math.round(settings.speechSec / 60),
  });
  const shareUrlValue = currentSlug ? topicPageUrl(locale, currentSlug) : shareUrl(locale);
  const shareImageUrl = currentSlug ? `/og/${locale}/${currentSlug}.png` : '';

  const marks = marksRef.current;
  const youtubePromptValue =
    state.phase === 'done' && marks && state.topic
      ? buildYoutubePrompt({
          intro: dict.share.youtubeIntro,
          topic: state.topic,
          lang: locale,
          mode: state.mode,
          researchMin: spentResearchMinutes(marks),
          speechMin: Math.round(marks.speechSec / 60),
          topicUrl: shareUrlValue,
          chapters: sessionChapters(marks, {
            stages: dict.timer.stages,
            arc: dict.timer.arc,
            research: dict.share.chapterResearch,
            speech: dict.share.chapterSpeech,
          }),
        })
      : '';

  const handleShareOpen = (): void => {
    tracker.track('share_click', { t: 'open' });
    // Opened by hand — the automatic opening must not fire again behind the visitor's back.
    if (autoShareTimerRef.current !== null) {
      clearTimeout(autoShareTimerRef.current);
      autoShareTimerRef.current = null;
    }
    void runViewTransition(() => setSharePanelOpen(true));
  };

  const handleShareBack = (): void => {
    void runViewTransition(() => setSharePanelOpen(false));
  };

  const handleShareTrack = (channel: ShareChannel): void => {
    tracker.track('share_click', { t: channel });
  };

  // Time ran out naturally (research -> ready). Show the upcoming speech duration.
  useEffect(() => {
    if (state.phase === 'ready' && countdownRef.current === null) {
      setTimerTotalSec(settings.speechSec);
      setRemainingSec(settings.speechSec);
      setElapsedSec(0);
    }
  }, [state.phase, settings.speechSec]);

  useEffect(() => {
    if (state.phase === 'idle') releaseWakeLock();
  }, [state.phase]);

  const handleSpeechMinutesChange = (minutes: number): void => {
    const speechSec = minutes * 60;
    setSettings((prev) => ({ ...prev, speechSec }));
    saveSettings({ speechSec });
  };

  const handleResearchMinutesChange = (minutes: number): void => {
    const researchSec = minutes * 60;
    setSettings((prev) => ({ ...prev, researchSec }));
    saveSettings({ researchSec });
  };

  const handleHideClockChange = (hideClock: boolean): void => {
    setSettings((prev) => ({ ...prev, hideClock }));
    saveSettings({ hideClock });
  };

  const handleMutedChange = (muted: boolean): void => {
    setSettings((prev) => ({ ...prev, muted }));
    saveSettings({ muted });
    soundRef.current.setMuted(muted);
  };

  const handleRecordChange = (record: RecordMode): void => {
    setSettings((prev) => ({ ...prev, record }));
    saveSettings({ record });
  };

  const handleRecordFormatChange = (recordFormat: RecordFormat): void => {
    setSettings((prev) => ({ ...prev, recordFormat }));
    saveSettings({ recordFormat });
  };

  const handleRecordStyleChange = (recordStyle: string): void => {
    setSettings((prev) => ({ ...prev, recordStyle, recordAspect: resolveAspectForStyle(getStyle(recordStyle), prev.recordAspect) }));
    saveSettings({ recordStyle, recordAspect: resolveAspectForStyle(getStyle(recordStyle), settings.recordAspect) });
  };

  const handleRecordAspectChange = (recordAspect: RecordAspect): void => {
    setSettings((prev) => ({ ...prev, recordAspect }));
    saveSettings({ recordAspect });
  };

  const openSettings = (): void => {
    void runViewTransition(() => setSettingsOpen(true));
    tracker.track('settings_open');
  };
  const closeSettings = (): void => {
    void runViewTransition(
      () => setSettingsOpen(false),
      () => settingsTriggerRef.current?.focus(),
    );
  };

  // The top-bar streak indicator: hidden until at least one day is on record, dimmed (pencil) when
  // today isn't practised yet (the chain is at risk of breaking), inked once it is.
  const hasPracticeHistory = Object.keys(days).length > 0;
  const streakCount = useMemo(() => currentStreak(days), [days]);
  const doneToday = useMemo(() => practisedToday(days), [days]);
  const streakDayText =
    streakCount > 0 ? fill(streakCount === 1 ? dict.streak.dayOne : dict.streak.dayOther, { n: streakCount }) : dict.streak.chipZero;
  const streakAriaLabel =
    streakCount > 0 ? fill(dict.streak.aria, { days: streakDayText }) : dict.streak.ariaZero;

  const openStreakSheet = (): void => {
    void runViewTransition(() => setStreakSheetOpen(true));
    tracker.track('sheet_open', { t: 'streak' });
  };
  const closeStreakSheet = (): void => {
    void runViewTransition(
      () => setStreakSheetOpen(false),
      () => streakTriggerRef.current?.focus(),
    );
  };

  const spinning = state.spinning;
  const locked = isLocked(state);
  const sessionOpen = state.phase !== 'idle';
  const contentInert = sessionOpen || settingsOpen;
  // The rich (open-book) layout is purely the viewport-width check — no user setting any more.
  const richActive = isWide;

  // The bottom dock (and, on article pages, the site footer) lives outside this island; make it inert too while a dialog is open.
  useEffect(() => {
    const outside = document.querySelectorAll<HTMLElement>('[data-outside-app]');
    outside.forEach((el) => {
      el.inert = contentInert;
    });
    return () => {
      outside.forEach((el) => {
        el.inert = false;
      });
    };
  }, [contentInert]);
  const speechMinutes = Math.round(settings.speechSec / 60);
  const researchMinutes = Math.round(settings.researchSec / 60);

  const spinLabel = spinning ? dict.actions.spinning : state.topic ? dict.actions.spinAgain : dict.actions.spin;
  const startLabel =
    state.mode === 'deep-research'
      ? fill(dict.actions.startResearch, { min: researchMinutes })
      : fill(dict.actions.startSpeech, { min: speechMinutes });

  // Shared between the two layouts below (minimalist: flat column; rich: open-book "spread") so
  // neither the JSX nor the state/handlers it closes over are duplicated — only one of the two
  // branches ever mounts at a time, picked by `richActive`.
  const modeSwitchNode = <ModeSwitch mode={state.mode} disabled={locked} dict={dict} onChange={handleModeChange} />;

  // Same data in both: off-the-cuff shows the plain category list, deep-research shows "Hepsi" + the
  // research pool's fields — only the options/value/handler differ (see the deep-research comment
  // near `researchFieldOptions` above).
  const categorySelectNode =
    state.mode === 'off-the-cuff' ? (
      <CategorySelect
        categories={categories}
        value={effectiveCategoryId}
        disabled={locked}
        dict={dict}
        onChange={handleCategoryChange}
      />
    ) : (
      <CategorySelect
        categories={researchFieldOptions}
        value={researchField}
        disabled={locked}
        dict={dict}
        onChange={handleResearchFieldChange}
      />
    );

  // Rich view's open-list equivalent of the dropdown above — same categories/value/handler.
  const categoryIndexNode =
    state.mode === 'off-the-cuff' ? (
      <CategoryIndex
        title={dict.category.title}
        categories={categories}
        value={effectiveCategoryId}
        disabled={locked}
        locale={locale}
        onChange={handleCategoryChange}
      />
    ) : (
      <CategoryIndex
        title={dict.category.groupsTitle}
        categories={researchFieldOptions}
        value={researchField}
        disabled={locked}
        locale={locale}
        onChange={handleResearchFieldChange}
      />
    );

  const topicReelNode = (
    <TopicReel
      ref={wheelRef}
      topics={topics}
      topic={state.topic}
      spinning={spinning}
      landKey={landKey}
      dict={dict}
      locale={locale}
      wordOwner={!sessionOpen}
    />
  );

  const modeBlurbNode = (
    <p class="mode-blurb">{state.mode === 'off-the-cuff' ? dict.modes.offTheCuffBlurb : dict.modes.deepResearchBlurb}</p>
  );

  // The main-screen "kayıt" switch — always visible near the wheel/start button, independent of the
  // speech timer (see CLAUDE.md's task notes). Hidden entirely when the browser can't record at all
  // (`recording.available` false) rather than showing a switch that can never turn on. Session-only:
  // it starts 'kapalı' on every visit, so no persisted state is read here.
  const recordingSwitchNode = recording.available && (
    <RecordingSwitch
      on={recording.active || recordingPending}
      pending={recordingPending && !recording.active}
      elapsedLabel={recording.active ? formatClock(recordingElapsedSec) : null}
      dict={dict}
      onToggle={handleRecordingToggle}
    />
  );
  // Minimalist layout: the switch alone, beside the category picker (no extra line on a phone).
  const recordingSwitchCompactNode = recording.available && (
    <RecordingSwitch
      on={recording.active || recordingPending}
      pending={recordingPending && !recording.active}
      elapsedLabel={null}
      dict={dict}
      onToggle={handleRecordingToggle}
      compact
    />
  );
  const recordingOn = recording.active || recordingPending;
  // A phone's share sheet also saves to Files, so it replaces the download link there.
  const shareInsteadOfDownload = useMemo(canShareVideoFiles, []);
  const devHost = useMemo(() => isDevHost(), []);

  const recordingStartFailedMainNode = recording.startFailed && !sessionOpen && (
    <p class="record-note">{dict.record.startFailed}</p>
  );

  // Stopped from the main screen (switch/"durdur", not the timer overlay): the finished file's
  // download link(s) show right here, under the switch — the overlay's own copy of this (see
  // `TimerOverlay`) only ever appears while a session is actually open.
  const mainRecordDownloadNode = !sessionOpen &&
    (recording.compositeFile || recording.cameraFile || recording.screenFile) && (
      <div class="record-download-inline">
        <div class="record-download-inline-links">
          {recording.compositeFile &&
            (shareInsteadOfDownload ? (
              <RecordingShareButton file={recording.compositeFile} dict={dict} />
            ) : (
              <a class="btn btn-secondary" href={recording.compositeFile.url} download={recording.compositeFile.name}>
                {dict.record.downloadRecording}
              </a>
            ))}
          {recording.cameraFile && (
            <a class="btn btn-secondary" href={recording.cameraFile.url} download={recording.cameraFile.name}>
              {dict.record.downloadCamera}
            </a>
          )}
          {recording.screenFile && (
            <a class="btn btn-secondary" href={recording.screenFile.url} download={recording.screenFile.name}>
              {dict.record.downloadScreen}
            </a>
          )}
        </div>
        <span class="record-download-inline-note">{dict.record.downloadNote}</span>
      </div>
    );

  // Rich (open-book) view only: a small live self-view in the right page's own top corner — the
  // minimalist layout has no spare vertical budget (it must stay scroll-free even for the longest
  // topic, see CLAUDE.md), so it shows no preview at all there.
  const recordingPreviewRichNode = recording.active && recording.previewStream && (
    <RecordingPreview stream={recording.previewStream} className="record-preview-corner" />
  );

  const actionRowNode = (
    <div class="action-row">
      {/* Before the first topic there is nothing to start — the only action is to spin. */}
      {state.topic === null ? (
        <button type="button" class="btn btn-primary" disabled={locked} onClick={handleSpin}>
          {spinLabel}
        </button>
      ) : (
        <>
          <button type="button" class="btn btn-secondary" disabled={locked} onClick={handleSpin}>
            {spinLabel}
          </button>
          <button ref={startTriggerRef} type="button" class="btn btn-primary" disabled={locked} onClick={handleStart}>
            {startLabel}
          </button>
        </>
      )}
    </div>
  );

  return (
    <>
      <div class={`app-shell${richActive ? ' rich' : ''}`} inert={contentInert || undefined}>
        <header class="top-bar">
          <h1 class="brand-heading">
            <a class="brand-link" href="#top" aria-label={dict.brand}>
              <Logo state={spinning ? 'spinning' : 'idle'} />
              <span class="wordmark">{dict.wordmark}</span>
            </a>
          </h1>
          <div class="top-actions">
            {hasPracticeHistory && (
              <button
                ref={streakTriggerRef}
                type="button"
                class={`streak-chip${doneToday ? '' : ' is-risk'}`}
                aria-haspopup="dialog"
                aria-expanded={streakSheetOpen}
                aria-label={streakAriaLabel}
                onClick={openStreakSheet}
              >
                {streakDayText}
              </button>
            )}
            {/* Language moved into the settings dialog (see SettingsDialog) — the top bar now carries
                only the streak indicator and the settings icon, in both views and at every width. */}
            <button
              ref={settingsTriggerRef}
              type="button"
              class="chip chip-icon"
              aria-label={dict.settings.open}
              onClick={openSettings}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="8" cy="17" r="2" />
              </svg>
            </button>
          </div>
        </header>

        {richActive ? (
          <div class="spread">
            <aside class="page-left">
              {modeSwitchNode}
              {categoryIndexNode}
              <dl class="word-card">
                <dt>
                  <span class="word-term" lang="tr">
                    {dict.about.word.term}
                  </span>
                  <span class="word-pron">{dict.about.word.pronunciation}</span>
                </dt>
                <dd class="word-kind">{dict.about.word.kind}</dd>
                <dd class="word-def">{dict.about.word.definition}</dd>
                <dd class="word-ex">{dict.about.word.example}</dd>
              </dl>
            </aside>
            <main class="page-right">
              {recordingPreviewRichNode}
              {topicReelNode}
              {modeBlurbNode}
              {recordingSwitchNode}
              {recordingStartFailedMainNode}
              {mainRecordDownloadNode}
              <SpeechPlan
                mode={state.mode}
                dict={dict}
                researchStages={researchStagesMinutes}
                speechMinutes={speechMinutes}
              />
              {actionRowNode}
            </main>
          </div>
        ) : (
          <>
            <div class="controls-row">
              {modeSwitchNode}
              {/* Same component in both modes, at the same position — only its options/value/handler
                  change, so switching modes never mounts/unmounts it (no "pat" pop-in/out). */}
              <div class="controls-sub">
                {categorySelectNode}
                {recordingSwitchCompactNode}
              </div>
            </div>

            {topicReelNode}
            {/* The page must stay scroll-free on a phone even for the longest topic: while there is
                recording news (live readout, a failure, the finished file) it takes the blurb's
                line instead of adding lines of its own. */}
            {recordingOn || recordingStartFailedMainNode || mainRecordDownloadNode ? (
              <div class="record-status">
                {recordingOn && (
                  <RecordingLive
                    pending={recordingPending && !recording.active}
                    elapsedLabel={recording.active ? formatClock(recordingElapsedSec) : null}
                    dict={dict}
                    onStop={handleRecordingToggle}
                  />
                )}
                {recordingStartFailedMainNode}
                {mainRecordDownloadNode}
              </div>
            ) : (
              modeBlurbNode
            )}
            {actionRowNode}
          </>
        )}
      </div>

      <TimerOverlay
        mode={state.mode}
        phase={state.phase}
        topic={state.topic}
        remainingSec={remainingSec}
        totalSec={timerTotalSec}
        elapsedSec={elapsedSec}
        speechMinutes={speechMinutes}
        dict={dict}
        onDoneResearching={handleDoneResearching}
        onReadyToSpeak={handleReadyToSpeak}
        onClose={handleClose}
        onFinishEarly={devHost ? handleFinishEarly : undefined}
        onShareOpen={handleShareOpen}
        onStopRecording={handleStopRecording}
        sharePanelOpen={sharePanelOpen}
        shareImageUrl={shareImageUrl}
        shareText={shareTextValue}
        shareUrl={shareUrlValue}
        youtubePrompt={youtubePromptValue}
        onShareBack={handleShareBack}
        onShareTrack={handleShareTrack}
        researchStages={researchStageIds}
        researchStage={researchStage}
        gatherChecked={gatherChecked}
        onToggleGather={handleToggleGather}
        onNextStage={handleNextStage}
        hideClock={settings.hideClock}
        onToggleClock={handleToggleClock}
        streakDay={streakCount}
        recordingActive={recording.active}
        recordingPreviewStream={recording.previewStream}
        recordingStartFailed={recording.startFailed}
        recordingScreenFailed={recording.screenFailed}
        recordingCameraFile={recording.cameraFile}
        recordingScreenFile={recording.screenFile}
        recordingCompositeFile={recording.compositeFile}
      />

      <StreakSheet open={streakSheetOpen} onClose={closeStreakSheet} dict={dict} locale={locale} days={days} />

      <SettingsDialog
        open={settingsOpen}
        locale={locale}
        speechMinutes={speechMinutes}
        researchMinutes={researchMinutes}
        muted={settings.muted}
        hideClock={settings.hideClock}
        record={settings.record}
        recordModes={recording.visibleModes}
        recordFormat={effectiveRecordFormat(settings.recordFormat, recording.capabilities)}
        recordFormats={allowedRecordFormats(recording.capabilities)}
        recordStyle={settings.recordStyle}
        recordAspect={resolveAspectForStyle(getStyle(settings.recordStyle), settings.recordAspect)}
        isWide={isWide}
        dict={dict}
        onSpeechChange={handleSpeechMinutesChange}
        onResearchChange={handleResearchMinutesChange}
        onMutedChange={handleMutedChange}
        onHideClockChange={handleHideClockChange}
        onRecordChange={handleRecordChange}
        onRecordFormatChange={handleRecordFormatChange}
        onRecordStyleChange={handleRecordStyleChange}
        onRecordAspectChange={handleRecordAspectChange}
        onClose={closeSettings}
      />
      <RecDebugPanel />
    </>
  );
}

/** App island root: wraps the interactive experience in an error boundary. */
export default function App({ locale }: Props) {
  const dict = dictionaries[locale];
  return (
    <ErrorBoundary dict={dict} locale={locale}>
      <AppContent locale={locale} />
    </ErrorBoundary>
  );
}
