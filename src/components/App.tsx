import { useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_RESEARCH_SEC,
  DEFAULT_SPEECH_SEC,
  createCountdown,
  createSoundEngine,
  initialSession,
  isLocked,
  loadSettings,
  planSpinTo,
  drawFromBag,
  loadSeen,
  saveSeen,
  positionAt,
  saveSettings,
  sessionReducer,
  stepAt,
  SPIN_DURATION_MS,
  SPIN_SAFETY_MS,
  acquireWakeLock,
  type Countdown,
  type ReleaseWakeLock,
  type Settings,
} from '../lib';
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

interface Props {
  locale: Locale;
}

const DEFAULT_CATEGORY_ID = 'general';

function AppContent({ locale }: Props) {
  const dict = dictionaries[locale];

  const [state, dispatch] = useReducer(sessionReducer, undefined, initialSession);
  const [settings, setSettings] = useState<Settings>({
    speechSec: DEFAULT_SPEECH_SEC,
    researchSec: DEFAULT_RESEARCH_SEC,
    muted: false,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [landKey, setLandKey] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timerTotalSec, setTimerTotalSec] = useState(0);

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
  const spinBaseIndexRef = useRef(0);

  const categories: Category[] = useMemo(() => getCategories(locale), [locale]);

  // Load persisted settings on the client only, after the SSR-safe defaults have rendered.
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    soundRef.current.setMuted(loaded.muted);
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

  const clearSpinTimers = (): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (safetyTimeoutRef.current !== null) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  };

  useEffect(() => clearSpinTimers, []);

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
        dispatch({ type: 'TIME_UP' });
        countdownRef.current = null;
      },
    });
    holdWakeLock();
  };

  const handleModeChange = (mode: Mode): void => {
    if (isLocked(state)) return;
    dispatch({ type: 'SET_MODE', mode });
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
  };

  const handleSpin = (): void => {
    if (isLocked(state) || topics.length === 0) return;
    soundRef.current.warmUp();
    const draw = drawFromBag(topics, loadSeen(locale, effectiveCategoryId), state.topicIndex);
    const plan = planSpinTo(state.topicIndex, topics.length, draw.index);
    dispatch({ type: 'SPIN_START' });

    const finalize = (): void => {
      clearSpinTimers();
      const index = plan.landIndex;
      // Marked as seen only once it is actually shown — an interrupted spin does not burn a topic.
      saveSeen(locale, effectiveCategoryId, draw.seen);
      dispatch({ type: 'SPIN_LAND', index, topic: topics[index] });
      setLandKey((key) => key + 1);
      soundRef.current.land();
    };

    let reduced = false;
    try {
      reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reduced = false;
    }

    if (reduced || topics.length === 1) {
      finalize();
      return;
    }

    const baseIndex = state.topicIndex >= 0 ? state.topicIndex : 0;
    spinBaseIndexRef.current = baseIndex;
    const start = performance.now();
    let lastStep = -1;

    const frame = (now: number): void => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / SPIN_DURATION_MS);
      wheelRef.current?.setPosition(positionAt(progress, plan.totalSteps));
      const step = Math.min(plan.totalSteps, stepAt(progress, plan.totalSteps));
      if (step !== lastStep) {
        lastStep = step;
        if (step >= plan.totalSteps) {
          finalize();
          return;
        }
        const index = ((baseIndex + step) % topics.length + topics.length) % topics.length;
        dispatch({ type: 'SPIN_TICK', index });
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

  const handleStart = (): void => {
    if (isLocked(state) || state.topic === null) return;
    soundRef.current.warmUp();
    const nextPhase = state.mode === 'deep-research' ? 'research' : 'speech';
    dispatch({ type: 'START' });
    beginCountdown(nextPhase === 'research' ? settings.researchSec : settings.speechSec);
  };

  const handleDoneResearching = (): void => {
    if (state.phase !== 'research') return;
    stopCountdown();
    soundRef.current.land();
    dispatch({ type: 'RESEARCH_DONE' });
    setTimerTotalSec(settings.speechSec);
    setRemainingSec(settings.speechSec);
    setElapsedSec(0);
  };

  const handleReadyToSpeak = (): void => {
    if (state.phase !== 'ready') return;
    dispatch({ type: 'READY_TO_SPEAK' });
    beginCountdown(settings.speechSec);
  };

  const handleClose = (): void => {
    stopCountdown();
    releaseWakeLock();
    dispatch({ type: 'CLOSE' });
    startTriggerRef.current?.focus();
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

  const handleMutedChange = (muted: boolean): void => {
    setSettings((prev) => ({ ...prev, muted }));
    saveSettings({ muted });
    soundRef.current.setMuted(muted);
  };

  const openSettings = (): void => setSettingsOpen(true);
  const closeSettings = (): void => {
    setSettingsOpen(false);
    settingsTriggerRef.current?.focus();
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
          startIndex={spinning ? spinBaseIndexRef.current : state.topicIndex}
          topic={state.topic}
          spinning={spinning}
          landKey={landKey}
          dict={dict}
          locale={locale}
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
      />

      <SettingsDialog
        open={settingsOpen}
        speechMinutes={speechMinutes}
        researchMinutes={researchMinutes}
        muted={settings.muted}
        dict={dict}
        onSpeechChange={handleSpeechMinutesChange}
        onResearchChange={handleResearchMinutesChange}
        onMutedChange={handleMutedChange}
        onClose={closeSettings}
      />
    </>
  );
}

/** App island root: wraps the interactive experience in an error boundary. */
export default function App({ locale }: Props) {
  const dict = dictionaries[locale];
  return (
    <ErrorBoundary dict={dict}>
      <AppContent locale={locale} />
    </ErrorBoundary>
  );
}
