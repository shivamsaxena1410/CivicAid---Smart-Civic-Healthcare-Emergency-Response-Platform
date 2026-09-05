'use client';

import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import { useScroll, type MotionValue } from 'motion/react';

/**
 * Scroll plumbing shared by the homepage chapters.
 *
 * The plan called for every chapter to read a hardcoded slice of one root
 * `scrollYProgress` (chapter 3 owns 0.35–0.5, and so on). That works only while
 * the chapter order is frozen — reordering or dropping one silently corrupts
 * every range after it. Since these chapters are meant to be composed into an
 * existing page in whatever order suits it, each one instead measures its *own*
 * progress from its own element. Chapters therefore know nothing about each
 * other and can be reordered freely.
 *
 * The root progress is still exposed through context for genuinely global
 * chrome (the progress rail), which is the one thing that does need to know
 * about the whole document.
 */

const RootScrollContext = createContext<MotionValue<number> | null>(null);

export function ScrollRoot({
  progress,
  children,
}: {
  progress: MotionValue<number>;
  children: ReactNode;
}) {
  return <RootScrollContext.Provider value={progress}>{children}</RootScrollContext.Provider>;
}

/** Root-document progress, or `null` when a chapter is used outside a ScrollRoot. */
export function useRootProgress(): MotionValue<number> | null {
  return useContext(RootScrollContext);
}

/**
 * Progress across a pinned chapter, 0 → 1.
 *
 * Pair with the `.cc-ch` / `.cc-ch__pin` class pair: the outer element is tall
 * (`--ch-length`, default 300vh) and scrolls normally; the inner element is
 * `position: sticky; height: 100vh` and stays put. The `start start → end end`
 * offset makes 0 the moment the pin engages and 1 the moment it releases, so a
 * transform range maps exactly onto the time the content is actually on screen.
 */
export function useChapterScroll(ref: RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  return scrollYProgress;
}

/**
 * Progress across an unpinned chapter that simply passes through the viewport,
 * 0 as it enters from below to 1 as it leaves past the top. Used by the hero
 * and the final panel, which are a single viewport tall.
 */
export function usePassThroughScroll(ref: RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  return scrollYProgress;
}
