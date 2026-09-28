/**
 * Desktop "rich" (open-book) layout vs the default minimalist page. There is no user setting any
 * more (Yasin, 2026-09-28): the layout is purely a function of viewport width — >=1100px is rich,
 * anything narrower (including a resized-down window) is always minimalist. See App.tsx/Dock.tsx for
 * the `matchMedia` listener that reads this threshold.
 */

/** Below this viewport width the rich view is never offered — the page is always minimalist. */
export const RICH_VIEW_MIN_WIDTH = 1100;
