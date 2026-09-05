'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useRootProgress } from './scroll';

/**
 * Chapter 8 — Progress rail.
 *
 * Fixed to the right edge on desktop; collapses to a top-edge bar on mobile,
 * where a vertical rail would sit under the thumb.
 *
 * Informational only — the ticks are `<a>` anchors so they still jump, but the
 * rail never traps focus or hijacks the scroll.
 */

export interface RailChapter {
  id: string;
  label: string;
  /** CSS colour for the active tick. Defaults to the cyan accent. */
  color?: string;
}

export function ScrollRail({ chapters }: { chapters: RailChapter[] }) {
  const rootProgress = useRootProgress();
  const [active, setActive] = useState(chapters[0]?.id ?? '');

  useEffect(() => {
    // The rail follows what is centred in the viewport rather than what has
    // merely entered it, so a tall pinned chapter does not light up its
    // successor the moment its final pixel scrolls into view.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );

    const nodes = chapters
      .map(({ id }) => document.getElementById(id))
      .filter((n): n is HTMLElement => n !== null);
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [chapters]);

  return (
    <>
      {rootProgress ? (
        <motion.div className="cc-ch-rail__bar" style={{ scaleX: rootProgress }} aria-hidden />
      ) : null}

      <nav className="cc-ch-rail" aria-label="Page sections">
        {chapters.map((chapter) => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            className={`cc-ch-rail__tick${active === chapter.id ? ' is-active' : ''}`}
            style={{ ['--tick-color' as string]: chapter.color ?? 'var(--accent-cyan)' }}
            aria-current={active === chapter.id ? 'true' : undefined}
          >
            <span>{chapter.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
