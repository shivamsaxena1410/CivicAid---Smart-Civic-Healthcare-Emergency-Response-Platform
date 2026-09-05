'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { usePassThroughScroll } from './scroll';

/**
 * Chapter 0 — Hero.
 *
 * One viewport, mostly typographic: no card grid, no product screenshot. The
 * only motion is the headline receding as the reader leaves, which hands off to
 * `HeroToMapChapter` where it becomes the persistent masthead.
 */
export function HeroChapter({
  eyebrow = 'One calmer way to care',
  headline = 'Health help,',
  headlineEm = 'closer to home.',
  body = 'Find the right care, make sense of what’s around you, and get help when every minute matters.',
  ctaHref = '#nearby',
  ctaLabel = 'Try the citizen experience',
}: {
  eyebrow?: string;
  headline?: string;
  headlineEm?: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const progress = usePassThroughScroll(ref);
  const reduced = useReducedMotion();

  // Only the outbound half of the range is used: the hero is already on screen
  // at load, so animating its entrance would mean animating from nothing on
  // first paint.
  const scale = useTransform(progress, [0.5, 1], [1, 0.82]);
  const y = useTransform(progress, [0.5, 1], [0, -70]);
  const opacity = useTransform(progress, [0.5, 0.95], [1, 0]);

  return (
    <section ref={ref} className="cc-ch cc-ch--hero" aria-labelledby="cc-ch-hero-title">
      <div className="cc-ch__pin cc-ch-hero__pin">
        <motion.div
          className="cc-ch-hero__copy"
          style={reduced ? undefined : { scale, y, opacity }}
        >
          <p className="cc-ch-eyebrow">
            <span className="cc-ch-eyebrow__dot" aria-hidden />
            {eyebrow}
          </p>
          <h1 id="cc-ch-hero-title" className="cc-ch-display">
            {headline}
            <br />
            <em>{headlineEm}</em>
          </h1>
          <p className="cc-ch-lede">{body}</p>
          <div className="cc-ch-hero__actions">
            <a className="cc-ch-btn cc-ch-btn--primary" href={ctaHref}>
              {ctaLabel} <ArrowRight size={18} />
            </a>
            <Link className="cc-ch-btn cc-ch-btn--ghost" href="/register">
              Register as a citizen
            </Link>
          </div>
          <p className="cc-ch-note">No account needed to explore.</p>
        </motion.div>

        <a href={ctaHref} className="cc-ch-hero__cue">
          <span>Scroll to explore</span>
          <ArrowDown size={17} aria-hidden />
        </a>
      </div>
    </section>
  );
}
