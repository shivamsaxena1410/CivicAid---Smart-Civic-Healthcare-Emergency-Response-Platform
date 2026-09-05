/**
 * Cinematic homepage chapters.
 *
 * Each chapter is self-contained: it measures its own scroll progress, fetches
 * its own data, and honours `prefers-reduced-motion` on its own. That means
 * they can be composed in any order, or used one at a time inside an existing
 * page, without a coordinating parent.
 *
 * Minimal use — the chapters work standalone:
 *
 *   <main>
 *     <HeroChapter />
 *     <HeroToMapChapter />
 *     <MapToFacilitiesChapter />
 *     <EnvironmentChapter />
 *   </main>
 *
 * Full use with the progress rail, which is the one piece that needs
 * document-level scroll:
 *
 *   const pageRef = useRef<HTMLElement>(null);
 *   const { scrollYProgress } = useScroll({
 *     target: pageRef,
 *     offset: ['start start', 'end end'],
 *   });
 *
 *   <main ref={pageRef}>
 *     <ScrollRoot progress={scrollYProgress}>
 *       <HeroChapter />
 *       <HeroToMapChapter />
 *       <MapToFacilitiesChapter />
 *       <FacilitiesToDiscoveryChapter />
 *       <EnvironmentChapter />
 *       <EmergencyChapter />
 *       <CivicChapter />
 *       <FinalCtaChapter />
 *       <ScrollRail chapters={DEFAULT_RAIL} />
 *     </ScrollRoot>
 *   </main>
 *
 * Styles live in the `cc-ch-*` block at the end of `globals.css`, namespaced so
 * they cannot collide with the existing `cc-*` homepage styles.
 */

export { HeroChapter } from './HeroChapter';
export { HeroToMapChapter } from './HeroToMapChapter';
export { MapToFacilitiesChapter } from './MapToFacilitiesChapter';
export { FacilitiesToDiscoveryChapter } from './FacilitiesToDiscoveryChapter';
export { EnvironmentChapter } from './EnvironmentChapter';
export { EmergencyChapter } from './EmergencyChapter';
export { CivicChapter } from './CivicChapter';
export { FinalCtaChapter } from './FinalCtaChapter';
export { ScrollRail, type RailChapter } from './ScrollRail';
export { ScrollRoot, useRootProgress, useChapterScroll, usePassThroughScroll } from './scroll';
export { ProvenanceLabel, formatClock, type Provenance } from './Provenance';
export { useLiveEnvironment, useLiveFacilities, useDemoOrganizations } from './useLiveData';

/** Rail entries matching the default chapter ids, in document order. */
export const DEFAULT_RAIL = [
  { id: 'nearby', label: 'Nearby care', color: 'var(--accent-cyan)' },
  { id: 'facilities', label: 'Real places', color: 'var(--accent-blue)' },
  { id: 'discover', label: 'Discover', color: 'var(--accent-purple)' },
  { id: 'environment', label: 'Live conditions', color: 'var(--accent-emerald)' },
  { id: 'emergency', label: 'Emergency', color: 'var(--accent-rose)' },
  { id: 'services', label: 'Civic services', color: 'var(--accent-amber)' },
  { id: 'start', label: 'Get started', color: 'var(--accent-cyan)' },
];
