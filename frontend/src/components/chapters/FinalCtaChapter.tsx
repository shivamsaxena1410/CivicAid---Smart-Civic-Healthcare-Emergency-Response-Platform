'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { usePassThroughScroll } from './scroll';

/**
 * Chapter 7 — Final CTA.
 *
 * The wordmark scales back up to display size, closing the loop with the hero.
 * The primary action depends on whether anyone is signed in, so a returning
 * user is not asked to register again.
 */
export function FinalCtaChapter({ id = 'start' }: { id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const progress = usePassThroughScroll(ref);
  const reduced = useReducedMotion();
  const user = useAuthStore((s) => s.user);

  const scale = useTransform(progress, [0, 0.55], [0.84, 1]);
  const opacity = useTransform(progress, [0, 0.35], [0, 1]);

  return (
    <section ref={ref} className="cc-ch cc-ch--final" id={id} aria-labelledby="cc-ch-final-title">
      <motion.div
        className="cc-ch-final__inner"
        style={reduced ? undefined : { scale, opacity }}
      >
        <h2 id="cc-ch-final-title" className="cc-ch-display cc-ch-final__mark">
          Civic<span>Connect</span>
        </h2>
        <p className="cc-ch-lede">Built for citizens, by the people who run it.</p>

        <div className="cc-ch-final__actions">
          {user ? (
            <Link className="cc-ch-btn cc-ch-btn--primary" href="/dashboard">
              Open the dashboard <ArrowRight size={18} aria-hidden />
            </Link>
          ) : (
            <>
              <Link className="cc-ch-btn cc-ch-btn--primary" href="/register">
                Register as a citizen <ArrowRight size={18} aria-hidden />
              </Link>
              <Link className="cc-ch-btn cc-ch-btn--ghost" href="/login">
                Sign in
              </Link>
            </>
          )}
        </div>

        <p className="cc-ch-note cc-ch-final__note">
          An academic demonstration. Facility locations and environmental readings come from public
          sources; every organisation in the database is fictional and its availability figures are
          simulated.
        </p>
      </motion.div>
    </section>
  );
}
