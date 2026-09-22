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
  saveSeen,
  positionFrom,
  saveSettings,
  sessionReducer,
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
  type Countdown,
  type ReleaseWakeLock,
  type Settings,
} from '../lib';
import type { ShareChannel } from './SharePanel';
import type { Category, Mode } from '../lib/types';
import { dictionaries, fill, type Locale } from '../i18n';
import { getCategories, getCategoryById } from '../data/topics';
import { ModeSwitch } from './ModeSwitch';
import { CategorySelect } from './CategorySelect';
import { TopicReel, type TopicReelHandle } from './TopicReel';
import { TimerOverlay } from './TimerOverlay';
import { SettingsDialog } from './SettingsDialog';
import { ErrorBoundary } from './ErrorBoundary';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Logo';

/** How long the "süre." screen stays before the share screen takes over. */
const AUTO_SHARE_DELAY_MS = 1600;

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
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [landKey, setLandKey] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timerTotalSec, setTimerTotalSec] = useState(0);
  // Research stages: the clock moves the stage forward; "sonraki bölüm" can only jump ahead of it.
  const [researchStage, setResearchStage] = useState(0);
  // The stage already decided on — set synchronously, because the state itself only lands once the
  // view transition's update runs, and a clock tick in between must not advance (and chime) twice.
  const researchStageRef = useRef(0);
  const [gatherChecked, setGatherChecked] = useState<boolean[]>([false, false, false, false, false]);

  const soundRef = useRef(createSoundEngine());
  const countdownRef = useRef<Countdown | null>(null);
  const wakeLockReleaseRef = useRef<ReleaseWakeLock | null>(null);
  const wakeLockTokenRef = useRef(0);
  const lastCategoryIdRef = useRef<string>(DEFAULT_CATEGORY_ID);
  const rafRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
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

  // Load persisted settings on the client only, after the SSR-safe defaults have rendered.
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    soundRef.current.setMuted(loaded.muted);
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

  const topics = useMemo(
    () => getCategoryById(locale, effectiveCategoryId)?.topics ?? [],
    [locale, effectiveCategoryId],
  );

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
        // Natural time-out counts the same as the matching manual action below.
        if (wasResearch && !researchDoneSentRef.current) {
          researchDoneSentRef.current = true;
          tracker.track('research_done');
        } else if (wasSpeech && !speechDoneSentRef.current) {
          speechDoneSentRef.current = true;
          tracker.track('speech_done');
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

  const handleSpin = (): void => {
    // `state.spinning` only flips a render later (and, on a re-spin, inside a view transition), so a
    // fast double tap would pass the state check twice — the ref is the real lock.
    if (spinBusyRef.current || isLocked(state) || topics.length === 0) return;
    spinBusyRef.current = true;
    soundRef.current.warmUp();
    const draw = drawFromBag(topics, loadSeen(locale, effectiveCategoryId), state.topicIndex);
    tracker.track('spin', {
      m: state.mode,
      c: state.mode === 'off-the-cuff' ? effectiveCategoryId : undefined,
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
      saveSeen(locale, effectiveCategoryId, draw.seen);
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
        c: state.mode === 'off-the-cuff' ? effectiveCategoryId : undefined,
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
    setGatherChecked([false, false, false, false, false]);
    researchDoneSentRef.current = false;
    speechDoneSentRef.current = false;
    tracker.track(nextPhase === 'research' ? 'start_research' : 'start_speech', {
      m: state.mode,
      t: state.topic,
      c: state.mode === 'off-the-cuff' ? effectiveCategoryId : undefined,
    });
  };

  const handleDoneResearching = (): void => {
    if (state.phase !== 'research') return;
    stopCountdown();
    soundRef.current.land();
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
    dispatch({ type: 'READY_TO_SPEAK' });
    beginCountdown(settings.speechSec);
    tracker.track('start_speech', { m: state.mode, t: state.topic ?? undefined });
  };

  const handleClose = (): void => {
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

  // Time crossing a stage boundary moves the stage forward (never back — a skipped-ahead stage
  // stays). The new stage's guide arrives inside a view transition, with a soft chord as the cue.
  useEffect(() => {
    if (state.phase !== 'research') return;
    const byTime = researchStageAt(researchPlan, elapsedSec);
    if (byTime <= researchStageRef.current) return;
    researchStageRef.current = byTime;
    soundRef.current.land();
    void runViewTransition(() => setResearchStage(byTime));
  }, [state.phase, elapsedSec, researchPlan]);

  const handleNextStage = (): void => {
    if (state.phase !== 'research' || researchStageRef.current >= researchPlan.length - 1) return;
    const next = researchStageRef.current + 1;
    researchStageRef.current = next;
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

  const spinning = state.spinning;
  const locked = isLocked(state);
  const sessionOpen = state.phase !== 'idle';
  const contentInert = sessionOpen || settingsOpen;

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

  return (
    <>
      <div class="app-shell" inert={contentInert || undefined}>
        <header class="top-bar">
          <h1 class="brand-heading">
            <a class="brand-link" href="#top" aria-label={dict.brand}>
              <Logo state={spinning ? 'spinning' : 'idle'} />
              <span class="wordmark">{dict.wordmark}</span>
            </a>
          </h1>
          <div class="top-actions">
            <LanguageSwitch locale={locale} dict={dict} />
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

        <div class="controls-row">
          <ModeSwitch mode={state.mode} disabled={locked} dict={dict} onChange={handleModeChange} />
          {state.mode === 'off-the-cuff' && (
            <CategorySelect
              categories={categories}
              value={effectiveCategoryId}
              disabled={locked}
              dict={dict}
              onChange={handleCategoryChange}
            />
          )}
        </div>

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

        <p class="mode-blurb">
          {state.mode === 'off-the-cuff' ? dict.modes.offTheCuffBlurb : dict.modes.deepResearchBlurb}
        </p>

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
              <button
                ref={startTriggerRef}
                type="button"
                class="btn btn-primary"
                disabled={locked}
                onClick={handleStart}
              >
                {startLabel}
              </button>
            </>
          )}
        </div>
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
        onShareOpen={handleShareOpen}
        sharePanelOpen={sharePanelOpen}
        shareImageUrl={shareImageUrl}
        shareText={shareTextValue}
        shareUrl={shareUrlValue}
        onShareBack={handleShareBack}
        onShareTrack={handleShareTrack}
        researchStages={researchStageIds}
        researchStage={researchStage}
        gatherChecked={gatherChecked}
        onToggleGather={handleToggleGather}
        onNextStage={handleNextStage}
        hideClock={settings.hideClock}
        onToggleClock={handleToggleClock}
      />

      <SettingsDialog
        open={settingsOpen}
        speechMinutes={speechMinutes}
        researchMinutes={researchMinutes}
        muted={settings.muted}
        hideClock={settings.hideClock}
        dict={dict}
        onSpeechChange={handleSpeechMinutesChange}
        onResearchChange={handleResearchMinutesChange}
        onMutedChange={handleMutedChange}
        onHideClockChange={handleHideClockChange}
        onClose={closeSettings}
      />
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
