import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useSeo } from '../hooks/useSeo';
import Reveal from '../components/Reveal';
import DestinationCard from '../components/DestinationCard';
import PackageCard from '../components/PackageCard';
import ContactTiles from '../components/ContactTiles';

function RouteGraphic() {
  return (
    <svg viewBox="0 0 420 150" width="100%" height="150" role="img" aria-label="Route between Sri Lanka and Italy">
      <path
        className="route-line"
        d="M40 118 C 130 22, 250 22, 380 62"
        fill="none"
        stroke="#e8b860"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g>
        <circle cx="40" cy="118" r="7" fill="#f5f1e8" />
        <circle cx="40" cy="118" r="13" fill="none" stroke="#e8b860" strokeWidth="1.5" opacity=".55" />
        <text x="40" y="143" textAnchor="middle" fontSize="12" fill="#e9f3f1" fontFamily="Inter, sans-serif">
          Sri Lanka
        </text>
      </g>
      <g>
        <circle cx="380" cy="62" r="7" fill="#d47a62" />
        <circle cx="380" cy="62" r="13" fill="none" stroke="#d47a62" strokeWidth="1.5" opacity=".6" />
        <text x="380" y="42" textAnchor="middle" fontSize="12" fill="#e9f3f1" fontFamily="Inter, sans-serif">
          Italy
        </text>
      </g>
    </svg>
  );
}

export default function Home() {
  const { settings, destinations, packages, destinationsByCountry, stats } = useSettings();

  useSeo({
    title: settings.brand_name,
    description: settings.hero_subtitle || settings.seo?.description,
    keywords: settings.seo?.keywords,
    og: {
      title: settings.brand_name,
      description: settings.hero_subtitle,
      type: 'website',
      siteName: settings.brand_name,
    },
  });

  const featuredDestinations = destinations.filter((d) => d.featured).slice(0, 6);
  const displayDestinations = featuredDestinations.length ? featuredDestinations : destinations.slice(0, 6);
  const featuredPackages = packages.filter((p) => p.featured).slice(0, 3);
  const displayPackages = featuredPackages.length ? featuredPackages : packages.slice(0, 3);

  const sriLanka = destinationsByCountry['Sri Lanka'] || [];
  const italy = destinationsByCountry.Italy || [];

  return (
    <div className="page-enter">
      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="container">
          <Reveal>
            <div className="direction-pills">
              <span className="pill pill--solid">Sri Lanka → Italy</span>
              <span className="pill">Italy → Sri Lanka</span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1>{settings.hero_title || 'Two islands of wonder, one journey'}</h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="hero__lead">{settings.hero_subtitle}</p>
          </Reveal>

          <Reveal delay={240}>
            <div className="hero__actions">
              <Link to="/packages" className="btn btn--brass btn--lg">
                Explore tours
              </Link>
              <a href="#enquire" className="btn btn--ghost btn--lg">
                Plan your trip
              </a>
            </div>
          </Reveal>

          <Reveal delay={320} stagger className="hero__stats">
            <div className="stat">
              <div className="stat__value">{stats.destinations}</div>
              <div className="stat__label">Destinations</div>
            </div>
            <div className="stat">
              <div className="stat__value">{stats.packages}</div>
              <div className="stat__label">Tour packages</div>
            </div>
            <div className="stat">
              <div className="stat__value">2</div>
              <div className="stat__label">Countries, both ways</div>
            </div>
            <div className="stat" style={{ flex: '1 1 200px', minWidth: 180 }}>
              <RouteGraphic />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- Two directions ---------- */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <Reveal className="section-head__text">
              <div className="eyebrow">Both directions</div>
              <h2>Travel either way between Sri Lanka and Italy</h2>
              <p className="lead" style={{ marginTop: '0.9rem' }}>
                Whether you are leaving the island for Europe or coming home the other direction, the
                same team arranges the journey end to end.
              </p>
            </Reveal>
          </div>

          <div className="grid grid--2">
            <Reveal variant="left">
              <div className="card" style={{ height: '100%' }}>
                <div className="card__body" style={{ padding: 'clamp(24px, 3vw, 34px)' }}>
                  <div className="eyebrow">Sri Lanka → Italy</div>
                  <h3 style={{ marginBottom: '0.7rem' }}>From the island to Europe</h3>
                  <p className="muted">
                    Holidays, family visits and longer stays in Italy — Rome, Florence, Venice, the
                    Amalfi Coast and Sicily — with flights, transfers and guiding arranged together.
                  </p>
                  <ul className="feature-list">
                    <li>Guided itineraries across Italy’s anchor cities</li>
                    <li>High-speed rail between regions where it makes sense</li>
                    <li>Assistance with planning and document preparation</li>
                  </ul>
                  <div style={{ marginTop: '1.5rem' }}>
                    <Link to="/packages?direction=SL_TO_IT" className="btn btn--outline">
                      Tours to Italy
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal variant="right">
              <div className="card" style={{ height: '100%' }}>
                <div className="card__body" style={{ padding: 'clamp(24px, 3vw, 34px)' }}>
                  <div className="eyebrow">Italy → Sri Lanka</div>
                  <h3 style={{ marginBottom: '0.7rem' }}>Back to the island</h3>
                  <p className="muted">
                    Sightseeing, safari and beach time across Sri Lanka, arranged for travellers
                    arriving from Italy — with private drivers, local guides and unhurried pacing.
                  </p>
                  <ul className="feature-list">
                    <li>Cultural Triangle, hill country and national parks</li>
                    <li>Family-friendly routes with shorter drive times</li>
                    <li>Local guides in the language you prefer</li>
                  </ul>
                  <div style={{ marginTop: '1.5rem' }}>
                    <Link to="/packages?direction=IT_TO_SL" className="btn btn--outline">
                      Tours to Sri Lanka
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- Featured destinations ---------- */}
      {displayDestinations.length > 0 && (
        <section className="section section--warm">
          <div className="container">
            <div className="section-head">
              <Reveal className="section-head__text">
                <div className="eyebrow">Destinations</div>
                <h2>Places we know well</h2>
              </Reveal>
              <Reveal>
                <Link to="/destinations" className="btn btn--outline">
                  All destinations →
                </Link>
              </Reveal>
            </div>

            <div className="grid grid--3 stagger-parent">
              {displayDestinations.map((d, i) => (
                <Reveal key={d.id || d.slug} delay={i * 60}>
                  <DestinationCard destination={d} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- Country split ---------- */}
      {(sriLanka.length > 0 || italy.length > 0) && (
        <section className="section">
          <div className="container">
            <div className="grid grid--2">
              <Reveal variant="left">
                <div className="card">
                  <div className="card__body" style={{ padding: 'clamp(24px, 3vw, 34px)' }}>
                    <div className="eyebrow">Sri Lanka</div>
                    <h3 style={{ marginBottom: '0.6rem' }}>
                      {sriLanka.length} destination{sriLanka.length === 1 ? '' : 's'}
                    </h3>
                    <p className="muted" style={{ marginBottom: '1rem' }}>
                      {sriLanka.slice(0, 5).map((d) => d.name).join(' · ')}
                    </p>
                    <Link to="/destinations?country=Sri%20Lanka" className="btn btn--outline btn--sm">
                      Explore Sri Lanka
                    </Link>
                  </div>
                </div>
              </Reveal>

              <Reveal variant="right">
                <div className="card">
                  <div className="card__body" style={{ padding: 'clamp(24px, 3vw, 34px)' }}>
                    <div className="eyebrow">Italy</div>
                    <h3 style={{ marginBottom: '0.6rem' }}>
                      {italy.length} destination{italy.length === 1 ? '' : 's'}
                    </h3>
                    <p className="muted" style={{ marginBottom: '1rem' }}>
                      {italy.slice(0, 5).map((d) => d.name).join(' · ')}
                    </p>
                    <Link to="/destinations?country=Italy" className="btn btn--outline btn--sm">
                      Explore Italy
                    </Link>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Featured packages ---------- */}
      {displayPackages.length > 0 && (
        <section className="section section--warm">
          <div className="container">
            <div className="section-head">
              <Reveal className="section-head__text">
                <div className="eyebrow">Tour packages</div>
                <h2>Journeys ready to tailor</h2>
                <p className="lead" style={{ marginTop: '0.9rem' }}>
                  Starting points rather than fixed products — every itinerary can be reshaped around
                  your dates, pace and interests.
                </p>
              </Reveal>
              <Reveal>
                <Link to="/packages" className="btn btn--outline">
                  All tours →
                </Link>
              </Reveal>
            </div>

            <div className="grid grid--3">
              {displayPackages.map((p, i) => (
                <Reveal key={p.id || p.slug} delay={i * 70}>
                  <PackageCard pkg={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- About teaser ---------- */}
      <section className="section">
        <div className="container split">
          <Reveal variant="left">
            <div>
              <div className="eyebrow">About</div>
              <h2>{settings.about_title}</h2>
              <p className="lead" style={{ marginTop: '1rem' }}>
                {settings.about_body}
              </p>
              <div className="row" style={{ marginTop: '1.6rem' }}>
                <Link to="/about" className="btn">
                  Read more
                </Link>
                <Link to="/contact" className="btn btn--outline">
                  Get in touch
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal variant="right">
            <div className="card" style={{ border: 0, boxShadow: 'var(--shadow-lg)' }}>
              <div className="card__body" style={{ padding: 'clamp(24px, 3vw, 36px)' }}>
                <div className="eyebrow">Contact</div>
                <h3 style={{ marginBottom: '1rem' }}>Talk to us directly</h3>
                <ContactTiles variant="compact" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="section section--teal" id="enquire">
        <div className="container center">
          <Reveal>
            <div className="eyebrow" style={{ color: 'var(--brass-500)' }}>
              Start planning
            </div>
            <h2 style={{ maxWidth: '20ch', marginInline: 'auto' }}>Tell us where you want to go</h2>
            <p
              className="lead"
              style={{ margin: '1.1rem auto 2rem', color: 'rgba(233,243,241,0.82)', textAlign: 'center' }}
            >
              Send an enquiry with your dates and we will come back with a plan. No obligation, no
              automated replies.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link to="/contact" className="btn btn--brass btn--lg">
                Send an enquiry
              </Link>
              <Link to="/packages" className="btn btn--ghost btn--lg">
                Browse tours
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
