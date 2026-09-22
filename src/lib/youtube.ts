import type { ResearchStage } from './researchStages';

/** Wall-clock marks of one session, collected while it runs (all `Date.now()` ms). */
export interface SessionMarks {
  startedAt: number;
  /** Research stages in the order they began (the first one at `startedAt`). Empty off-the-cuff. */
  stages: { stage: ResearchStage; at: number }[];
  /** When research ended (button or time-out); null if there was no research. */
  researchEndAt: number | null;
  /** When the speech clock started. */
  speechAt: number | null;
  speechSec: number;
}

export interface Chapter {
  atSec: number;
  label: string;
}

/** YouTube only turns a description into chapters if every chapter is at least this long. */
const MIN_CHAPTER_SEC = 10;
/** …and there are at least this many, the first one at 0:00. */
const MIN_CHAPTERS = 3;

/** `m:ss` under an hour, `h:mm:ss` from an hour on — the formats YouTube recognises. */
export function formatTimestamp(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = String(safe % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * Makes a chapter list YouTube will accept: sorted, first at 0:00, each at least 10 s before the
 * next one (and before `endSec`, the end of the video). A too-short chapter gives way to the one
 * after it — e.g. a stage skipped after 3 s is simply not listed. Returns [] when fewer than three
 * chapters survive, because YouTube would ignore them anyway.
 */
export function fitChapters(entries: Chapter[], endSec: number): Chapter[] {
  // Anything outside the video (negative, or too close to / past the end) can't be a chapter.
  const sorted = entries
    .filter((entry) => entry.atSec >= 0 && entry.atSec <= endSec - MIN_CHAPTER_SEC)
    .sort((a, b) => a.atSec - b.atSec);
  const kept: Chapter[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const nextAt = i + 1 < sorted.length ? sorted[i + 1].atSec : endSec;
    if (nextAt - sorted[i].atSec >= MIN_CHAPTER_SEC) kept.push({ ...sorted[i] });
  }
  if (kept.length === 0) return [];
  kept[0].atSec = 0;
  // Pulling the first chapter back to 0 can only lengthen it, so the 10 s rule still holds.
  return kept.length >= MIN_CHAPTERS ? kept : [];
}

export interface ChapterLabels {
  /** Research stage names, indexed gather/shape/warm. */
  stages: readonly string[];
  /** The three speech outline steps. */
  arc: readonly string[];
  /** e.g. 'Araştırma: {stage}' */
  research: string;
  /** e.g. 'Konuşma: {step}' */
  speech: string;
}

const STAGE_ORDER: Record<ResearchStage, number> = { gather: 0, shape: 1, warm: 2 };

/**
 * Chapters for a recording that starts when the timer starts: each research stage as it actually
 * began, then the speech's three outline steps (the speech is split into thirds, like on screen).
 * The wait between research and "ready to speak" stays inside the last research chapter.
 */
export function sessionChapters(marks: SessionMarks, labels: ChapterLabels): Chapter[] {
  if (marks.speechAt === null) return [];
  const sec = (at: number): number => Math.max(0, Math.round((at - marks.startedAt) / 1000));
  const entries: Chapter[] = marks.stages.map(({ stage, at }) => ({
    atSec: sec(at),
    label: labels.research.replace('{stage}', labels.stages[STAGE_ORDER[stage]]),
  }));
  const speechStart = sec(marks.speechAt);
  labels.arc.forEach((step, i) => {
    entries.push({
      atSec: speechStart + Math.round((marks.speechSec * i) / labels.arc.length),
      label: labels.speech.replace('{step}', step),
    });
  });
  return fitChapters(entries, speechStart + marks.speechSec);
}

/** Whole research minutes as actually spent (at least 1), or null when there was no research. */
export function researchMinutes(marks: SessionMarks): number | null {
  if (marks.researchEndAt === null || marks.stages.length === 0) return null;
  return Math.max(1, Math.round((marks.researchEndAt - marks.startedAt) / 60000));
}

/** Where agents fetch the skill from (raw file, so any agent that can read a URL gets plain text). */
export const YOUTUBE_SKILL_URL =
  'https://raw.githubusercontent.com/yasinozmeen/irticalen/main/skills/irticalen-youtube/SKILL.md';

export interface YouTubePromptInput {
  /** Intro sentence(s) in the visitor's language; `{skill}` is replaced by the skill URL. */
  intro: string;
  topic: string;
  lang: 'tr' | 'en';
  mode: 'off-the-cuff' | 'deep-research';
  researchMin: number | null;
  speechMin: number;
  topicUrl: string;
  chapters: Chapter[];
}

/**
 * The text the "YouTube" button copies: a one-line ask + the skill link + the session block the
 * skill expects (keys stay English so every agent parses them the same way).
 */
export function youtubePrompt(input: YouTubePromptInput): string {
  const block = [
    `topic: ${input.topic}`,
    `lang: ${input.lang}`,
    `mode: ${input.mode}`,
    ...(input.researchMin !== null ? [`research_min: ${input.researchMin}`] : []),
    `speech_min: ${input.speechMin}`,
    `topic_url: ${input.topicUrl}`,
    ...(input.chapters.length > 0
      ? ['timer_chapters:', ...input.chapters.map((c) => `  ${formatTimestamp(c.atSec)} ${c.label}`)]
      : []),
  ];
  return `${input.intro.replace('{skill}', YOUTUBE_SKILL_URL)}\n\n\`\`\`\n${block.join('\n')}\n\`\`\`\n`;
}
