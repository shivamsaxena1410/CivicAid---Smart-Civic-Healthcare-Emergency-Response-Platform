'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useTransform } from 'motion/react';
import { ArrowRight, FileText, Landmark } from 'lucide-react';
import { useChapterScroll } from './scroll';
import { useAsync } from '../../lib/hooks';
import { schemes } from '../../lib/endpoints';

/**
 * Chapter 6 — Civic services.
 *
 * Pinned. A 2-up composition: schemes on the left sitting slightly forward,
 * complaints on the right sitting slightly back.
 *
 * The scheme title is read from the API when one is published, so the panel
 * shows a real headline rather than lorem. When nothing is published yet it
 * falls back to a generic prompt — which is a statement about the product, not
 * a fabricated record.
 */
export function CivicChapter({ id = 'services' }: { id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const progress = useChapterScroll(ref);
  const reduced = useReducedMotion();

  const { data } = useAsync(() => schemes.list({ limit: 1 }), []);
  const featured = data?.items?.[0] ?? null;

  const leftY = useTransform(progress, [0, 0.45], [60, -8]);
  const rightY = useTransform(progress, [0, 0.45], [90, 8]);
  const opacity = useTransform(progress, [0, 0.3], [0, 1]);

  return (
    <section ref={ref} className="cc-ch cc-ch--tall" id={id} aria-labelledby="cc-ch-civic-title">
      <div className="cc-ch__pin cc-ch-civic__pin">
        <div className="cc-ch-civic__head">
          <p className="cc-ch-eyebrow">
            <span className="cc-ch-eyebrow__dot" aria-hidden />
            06 / Civic services
          </p>
          <h2 id="cc-ch-civic-title" className="cc-ch-h2">
            The small things
            <br />
            <span>that make life work.</span>
          </h2>
        </div>

        <motion.div className="cc-ch-civic__pair" style={reduced ? undefined : { opacity }}>
          <motion.div style={reduced ? undefined : { y: leftY }}>
            <Link href="/schemes" className="cc-ch-civic__card cc-ch-civic__card--schemes">
              <span className="cc-ch-civic__index">
                <Landmark size={16} aria-hidden /> 01 / Government schemes
              </span>
              <strong>{featured?.title ?? 'Find the support you already qualify for.'}</strong>
              <span className="cc-ch-civic__go">
                Browse schemes <ArrowRight size={16} aria-hidden />
              </span>
            </Link>
          </motion.div>

          <motion.div style={reduced ? undefined : { y: rightY }}>
            <Link href="/complaints" className="cc-ch-civic__card cc-ch-civic__card--complaints">
              <span className="cc-ch-civic__index">
                <FileText size={16} aria-hidden /> 02 / Civic complaints
              </span>
              <strong>
                Make the issue visible.
                <br />
                Move it forward.
              </strong>
              <span className="cc-ch-civic__go">
                File a complaint <ArrowRight size={16} aria-hidden />
              </span>
            </Link>
          </motion.div>
        </motion.div>

        <p className="cc-ch-note cc-ch-civic__foot">
          These are the services citizens actually use.
        </p>
      </div>
    </section>
  );
}
