'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { ArrowRight, Siren } from 'lucide-react';
import { useChapterScroll } from './scroll';

/**
 * Chapter 5 — Emergency.
 *
 * Pinned, and the sharpest tonal shift on the page: the ambient palette gives
 * way to a rose composition, and the headline types itself in per character.
 *
 * Two restraints are deliberate. The background pulse runs on a 4-second cycle
 * rather than flashing — a strobing red panel is a genuine hazard for
 * photosensitive readers. And the whole chapter flattens to a static badge
 * under `prefers-reduced-motion`, because someone who has asked for less motion
 * should not be handed the most animated section of the page.
 */

const HEADLINE = 'In an emergency.';

export function EmergencyChapter({ id = 'emergency' }: { id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const progress = useChapterScroll(ref);
  const reduced = useReducedMotion();

  const washOpacity = useTransform(progress, [0, 0.25, 0.8, 1], [0, 1, 1, 0.5]);
  const badgeScale = useTransform(progress, [0.15, 0.5], [0.9, 1]);

  return (
    <section ref={ref} className="cc-ch cc-ch--tall cc-ch--emergency" id={id} aria-labelledby="cc-ch-em-title">
      <motion.div
        className="cc-ch-em__wash"
        aria-hidden
        style={reduced ? { opacity: 1 } : { opacity: washOpacity }}
      />
      <div className="cc-ch__pin cc-ch-em__pin">
        <p className="cc-ch-eyebrow cc-ch-eyebrow--light">
          <span className="cc-ch-eyebrow__dot" aria-hidden />
          05 / When it matters most
        </p>

        {/* The visible text is one accessible string; the per-character spans
            are decorative and hidden from assistive technology. */}
        <h2 id="cc-ch-em-title" className="cc-ch-h1 cc-ch-em__title">
          <span className="cc-sr-only">{HEADLINE}</span>
          <span aria-hidden className="cc-ch-em__chars">
            {HEADLINE.split('').map((char, i) => (
              <motion.span
                key={`${char}-${i}`}
                initial={reduced ? false : { opacity: 0, y: 26 }}
                whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 260, damping: 18 }}
              >
                {char === ' ' ? ' ' : char}
              </motion.span>
            ))}
          </span>
        </h2>

        <p className="cc-ch-lede cc-ch-em__lede">
          Help is a clear next step, not another thing to figure out.
        </p>

        <div className="cc-ch-em__actions">
          <Link href="/login" className="cc-ch-btn cc-ch-btn--danger">
            <Siren size={18} aria-hidden /> Request an ambulance
          </Link>
          <a href="#facilities" className="cc-ch-btn cc-ch-btn--danger-ghost">
            Find a hospital now <ArrowRight size={17} aria-hidden />
          </a>
        </div>

        <motion.p
          className="cc-ch-em__note"
          style={reduced ? undefined : { scale: badgeScale }}
        >
          Requesting an ambulance requires an account, so a dispatcher knows who to call back.
        </motion.p>
      </div>
    </section>
  );
}
