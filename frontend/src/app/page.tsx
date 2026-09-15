'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { ArrowDown, ArrowRight, Cross, HeartPulse, MapPin, Menu, Navigation, ShieldCheck, Siren, Wind, X } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useLocationStore } from '../store/location.store';
import { organizations, schemes, live } from '../lib/endpoints';
import type { GovernmentScheme, Organization } from '../types';

const chapters = [
  { id: 'nearby', label: 'Nearby care', color: '#09a9ee' },
  { id: 'discover', label: 'Discover', color: '#09a9ee' },
  { id: 'environment', label: 'Live conditions', color: '#10b981' },
  { id: 'emergency', label: 'Emergency', color: '#d94e3b' },
  { id: 'services', label: 'Civic services', color: '#a981ff' },
];

const demoFacilities = [
  { name: 'Apollo Community Hospital', kind: 'Hospital', distance: '1.2 km', tone: 'blue', icon: Cross },
  { name: 'Greenline Pharmacy', kind: 'Pharmacy', distance: '2.4 km', tone: 'mint', icon: HeartPulse },
  { name: 'City Blood Centre', kind: 'Blood bank', distance: '3.1 km', tone: 'rose', icon: ShieldCheck },
];

function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <div className={`cc-kicker ${light ? 'cc-kicker-light' : ''}`}><span className="cc-kicker-dot" />{children}</div>;
}

function Noise() { return <div aria-hidden className="cc-noise" />; }

export default function Home() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('nearby');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [schemeList, setSchemeList] = useState<GovernmentScheme[]>([]);
  const [liveEnv, setLiveEnv] = useState<{
    temperatureC: number | null;
    usAqi: number | null;
    aqiCategory: string | null;
  } | null>(null);
  const [liveEnvLoading, setLiveEnvLoading] = useState<boolean>(false);
  const prefersReduced = useReducedMotion();
  const { user } = useAuthStore();
  const { lat, lng, radiusKm, label, locate, locating } = useLocationStore();
  const { scrollYProgress } = useScroll({ target: pageRef, offset: ['start start', 'end end'] });
  const heroScale = useTransform(scrollYProgress, [0, 0.14], [1, 0.78]);
  const heroY = useTransform(scrollYProgress, [0, 0.14], [0, -90]);
  const tintOpacity = useTransform(scrollYProgress, [0, 0.22, 0.5], [0.2, 0.7, 0.12]);
  const tempSpring = useSpring(useTransform(scrollYProgress, [0.35, 0.5], [0, 1]), { stiffness: 110, damping: 18 });
  const tempScale = useTransform(tempSpring, [0, 1], [0.92, 1]);

  useEffect(() => {
    void organizations.search({ lat, lng, radiusKm, limit: 3 }).then((res) => setOrgs(res.items as Organization[])).catch(() => undefined);
    void schemes.list({ limit: 2 }).then((res) => setSchemeList(res.items)).catch(() => undefined);
  }, [lat, lng, radiusKm]);

  useEffect(() => {
    // Fetch live environment data
    if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
      setLiveEnvLoading(true);
      live.environment(lat, lng).then((env) => {
        setLiveEnv({
          temperatureC: env.weather?.temperatureC ?? null,
          usAqi: env.airQuality?.usAqi ?? null,
          aqiCategory: env.airQuality?.category ?? null,
        });
        setLiveEnvLoading(false);
      }).catch(() => {
        setLiveEnvLoading(false);
      });
    }
  }, [lat, lng]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && setActive(entry.target.id)), { rootMargin: '-35% 0px -55% 0px' });
    chapters.forEach(({ id }) => { const node = document.getElementById(id); if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, []);

  // Map organization type to display properties
  const getFacilityProps = (org: Organization) => {
    switch (org.type) {
      case 'HOSPITAL':
        return { kind: 'Hospital', tone: 'blue', icon: Cross };
      case 'PHARMACY':
        return { kind: 'Pharmacy', tone: 'mint', icon: HeartPulse };
      case 'BLOOD_BANK':
        return { kind: 'Blood bank', tone: 'rose', icon: ShieldCheck };
      case 'AMBULANCE_PROVIDER':
        return { kind: 'Ambulance', tone: 'emerald', icon: MapPin };
      case 'NGO':
        return { kind: 'NGO', tone: 'purple', icon: ShieldCheck };
      default:
        return { kind: 'Facility', tone: 'gray', icon: MapPin };
    }
  };

  const facilities = useMemo(() => {
    if (!orgs.length) return demoFacilities;

    return orgs.map((org, i) => {
      const { kind, tone, icon } = getFacilityProps(org);
      return {
        name: org.name,
        kind,
        distance: org.distanceKm != null ? `${org.distanceKm.toFixed(1)} km` : 'nearby',
        tone,
        icon
      };
    });
  }, [orgs]);

  return (
    <main ref={pageRef} className="cc-home">
      <motion.div className="cc-progress" style={{ scaleX: scrollYProgress }} />
      <Noise />
      <header className="cc-nav">
        <Link href="/" className="cc-wordmark" aria-label="CivicConnect home"><span className="cc-mark"><Cross size={16} strokeWidth={3} /></span>Civic<span>Connect</span></Link>
        <nav className="cc-nav-links" aria-label="Primary navigation"><a href="#nearby">Explore</a><a href="#services">Services</a><a href="#emergency">Emergency</a></nav>
        <div className="cc-nav-actions">{user ? <Link className="cc-nav-login" href="/dashboard">Open dashboard <ArrowRight size={15} /></Link> : <Link className="cc-nav-login" href="/login">Sign in</Link>}<button className="cc-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">{menuOpen ? <X /> : <Menu />}</button></div>
      </header>
      {menuOpen && <div className="cc-mobile-menu"><a href="#nearby" onClick={() => setMenuOpen(false)}>Explore nearby care</a><a href="#environment" onClick={() => setMenuOpen(false)}>Live conditions</a><a href="#emergency" onClick={() => setMenuOpen(false)}>Emergency help</a></div>}

      <section className="cc-hero" aria-labelledby="hero-title">
        <motion.div className="cc-hero-wash" style={prefersReduced ? undefined : { opacity: tintOpacity }} />
        <div className="cc-hero-orbit cc-orbit-one" /><div className="cc-hero-orbit cc-orbit-two" />
        <motion.div className="cc-hero-copy" style={prefersReduced ? undefined : { scale: heroScale, y: heroY }}>
          <SectionLabel>One calmer way to care</SectionLabel>
          <h1 id="hero-title">Health help,<br /><em>closer to home.</em></h1>
          <p>Find the right care, make sense of what’s around you, and get help when every minute matters.</p>
          <div className="cc-hero-actions"><a className="cc-btn cc-btn-primary" href="#nearby">Try the citizen experience <ArrowRight size={18} /></a><span className="cc-availability"><i /> No account needed to explore</span></div>
        </motion.div>
        <div className="cc-hero-aside"><span>01 / 05</span><span className="cc-vertical-copy">A connected civic health layer</span></div>
        <a href="#nearby" className="cc-scroll-cue"><span>Scroll to explore</span><ArrowDown size={17} /></a>
      </section>

      <section className="cc-story cc-nearby" id="nearby">
        <div className="cc-story-sticky"><div className="cc-story-grid"><div className="cc-story-intro"><SectionLabel>01 / Nearby care</SectionLabel><h2>Start with<br /><span>what’s near.</span></h2><p>Use your location to see real facilities around you, with the context to choose the next right step.</p><button className="cc-location-pill" onClick={locate}><Navigation size={16} />{locating ? 'Locating…' : 'Use my location'}</button><span className="cc-location-note"><MapPin size={13} /> {label}</span></div><div className="cc-map-card"><div className="cc-map-surface"><div className="cc-map-lines" /><div className="cc-map-radius" /><div className="cc-map-pin cc-pin-main"><MapPin size={22} fill="currentColor" /></div><div className="cc-map-pin cc-pin-a"><HeartPulse size={15} /></div><div className="cc-map-pin cc-pin-b"><Cross size={15} /></div><div className="cc-map-label"><span>YOUR SEARCH AREA</span><strong>{radiusKm} km radius</strong></div></div><div className="cc-map-footer"><span><i className="cc-live-dot" /> Live map preview</span><span>{lat.toFixed(2)}° N · {lng.toFixed(2)}° E</span></div></div></div></div>
      </section>

      <section className="cc-story cc-discover" id="discover">
        <div className="cc-story-sticky">
          <div className="cc-discover-head">
            <div>
              <SectionLabel>02 / Discovery</SectionLabel>
              <h2>Care is a<br /><span>shorter walk away.</span></h2>
            </div>
            <p>Real-world places, clearly surfaced. No noise. No guesswork.</p>
          </div>
          <div className="cc-facility-stack">
            {facilities.map((facility, i) => {
              const Icon = facility.icon;
              return <motion.article key={`${facility.name}-${i}`} className={`cc-facility-card cc-tone-${facility.tone}`} initial={prefersReduced ? false : { opacity: 0, y: 35 }} whileInView={prefersReduced ? undefined : { opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ delay: i * 0.12, type: 'spring', stiffness: 120, damping: 16 }}>
                <div className="cc-facility-icon"><Icon size={22} /></div>
                <div>
                  <span>{facility.kind}</span>
                  <h3>{facility.name}</h3>
                  <small>{facility.distance} from your search area</small>
                </div>
                <ArrowRight className="cc-facility-arrow" size={21} />
              </motion.article>;
            })}
          </div>
          <div className="cc-provenance">
            <span>Data layer</span>
            {orgs.length > 0 ? (
              orgs.some(org => org.type === 'HOSPITAL' || org.type === 'PHARMACY' || org.type === 'BLOOD_BANK' || org.type === 'AMBULANCE_PROVIDER' || org.type === 'NGO') ?
                'OpenStreetMap · refreshed for this visit' :
                'Seed data · for demonstration purposes'
            ) : (
              'Demo data · no results found'
            )}
          </div>
        </div>
      </section>

      <section className="cc-discovery-band">
        <div className="cc-discovery-art">
          <div className="cc-sticker">Made for<br /><strong>real life</strong></div>
          <div className="cc-blob cc-blob-pink" />
          <div className="cc-blob cc-blob-yellow" />
          <div className="cc-blob cc-blob-blue" />
          <div className="cc-mini-card">
            <HeartPulse size={18} />
            <span>Care, without<br /><strong>the friction.</strong></span>
          </div>
        </div>
        <div>
          <SectionLabel>03 / A better starting point</SectionLabel>
          <h2>Less searching.<br /><span>More finding.</span></h2>
          <p>CivicConnect brings hospitals, pharmacies, blood banks, ambulances, schemes and complaints into one shared civic layer.</p>
          <Link className="cc-text-link" href="/register">Create your citizen profile <ArrowRight size={17} /></Link>
        </div>
      </section>

      <section className="cc-environment" id="environment">
        <div className="cc-env-wash" />
        <div className="cc-env-inner">
          <div>
            <SectionLabel>04 / Live conditions</SectionLabel>
            <h2>Know the air<br />you’re <span>breathing.</span></h2>
            <p className="cc-env-location"><MapPin size={15} /> {label}</p>
          </div>
          <div className="cc-weather-readout">
            <span className="cc-readout-label"><Wind size={16} /> Live environment</span>
            {liveEnvLoading ? (
              <motion.div className="cc-temperature" style={prefersReduced ? undefined : { scale: tempScale }}>
                --<span>°C</span>
              </motion.div>
            ) : liveEnv && liveEnv.temperatureC !== null ? (
              <motion.div className="cc-temperature" style={prefersReduced ? undefined : { scale: tempScale }}>
                {Math.round(liveEnv.temperatureC)}<span>°C</span>
              </motion.div>
            ) : (
              <motion.div className="cc-temperature" style={prefersReduced ? undefined : { scale: tempScale }}>
                unavailable<span>°C</span>
              </motion.div>
            )}
            <div className="cc-aqi">
              {liveEnvLoading ? (
                <div>
                  <strong>--</strong>
                  <span>US EPA AQI<br /><em>Loading...</em></span>
                </div>
              ) : liveEnv && liveEnv.usAqi !== null ? (
                <div>
                  <strong>{Math.round(liveEnv.usAqi)}</strong>
                  <span>US EPA AQI<br /><em>{liveEnv.aqiCategory ?? 'Checking...'}</em></span>
                </div>
              ) : (
                <div>
                  <strong>unavailable</strong>
                  <span>US EPA AQI<br /><em>Data not available</em></span>
                </div>
              )}
            </div>
            <small>Weather and AQI are live public data. AQI shown is the US EPA index, not the Indian CPCB index.</small>
          </div>
        </div>
      </section>

      <section className="cc-emergency" id="emergency">
        <div className="cc-emergency-ring" />
        <div className="cc-emergency-inner">
          <SectionLabel light>05 / When it matters most</SectionLabel>
          <div className="cc-emergency-layout">
            <div>
              <h2>In an<br /><span>emergency.</span></h2>
              <p>Help is a clear next step, not another thing to figure out.</p>
              <div className="cc-emergency-actions">
                <Link href="/login" className="cc-btn cc-btn-danger"><Siren size={18} /> Request an ambulance</Link>
                <a href="#nearby" className="cc-btn cc-btn-danger-ghost">Find a hospital now <ArrowRight size={17} /></a>
              </div>
            </div>
            <div className="cc-emergency-badge">
              <div className="cc-pulse"><Siren size={24} /></div>
              <span>Emergency support</span>
              <strong>One tap<br />from help.</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="cc-services" id="services">
        <div className="cc-services-head">
          <SectionLabel>06 / Civic services</SectionLabel>
          <h2>The small things<br />that make life <span>work.</span></h2>
          <p>Health is bigger than a hospital. Find a scheme, raise a complaint, make your voice count.</p>
        </div>
        <div className="cc-service-pair">
          <Link href="/schemes" className="cc-service-card cc-service-purple">
            <span>01 / Government schemes</span>
            <strong>{schemeList[0]?.title ?? 'Find support you qualify for.'}</strong>
            <ArrowRight />
          </Link>
          <Link href="/complaints" className="cc-service-card cc-service-yellow">
            <span>02 / Civic complaints</span>
            <strong>Make the issue visible.<br />Move it forward.</strong>
            <ArrowRight />
          </Link>
        </div>
      </section>

      <footer className="cc-footer">
        <div className="cc-footer-mark">
          <SectionLabel>Ready when you are</SectionLabel>
          <h2>Let’s make<br /><span>care feel closer.</span></h2>
          <div className="cc-footer-actions">
            <Link className="cc-btn cc-btn-primary" href="/register">Register as a citizen <ArrowRight size={18} /></Link>
            <Link className="cc-btn cc-btn-outline" href={user ? '/dashboard' : '/login'}>{user ? 'Open dashboard' : 'Sign in'} <ArrowRight size={18} /></Link>
          </div>
        </div>
        <div className="cc-footer-bottom">
          <Link href="/" className="cc-wordmark"><span className="cc-mark"><Cross size={16} strokeWidth={3} /></span>Civic<span>Connect</span></Link>
          <span>Built for citizens, by the people who run it.</span>
          <span>© 2026 CivicConnect</span>
        </div>
      </footer>

      <aside className="cc-rail" aria-label="Page progress">
        {chapters.map((chapter) => <a key={chapter.id} href={`#${chapter.id}`} className={active === chapter.id ? 'is-active' : ''} style={{ '--tick-color': chapter.color } as React.CSSProperties} aria-label={chapter.label}><span>{chapter.label}</span></a>)}
      </aside>
    </main>
  );
}