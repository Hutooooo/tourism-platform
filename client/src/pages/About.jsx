import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useSeo } from '../hooks/useSeo';
import Reveal from '../components/Reveal';
import ContactTiles from '../components/ContactTiles';

export default function About() {
  const { settings, stats } = useSettings();

  useSeo({
    title: 'About',
    description: settings.about_body?.slice(0, 300) || settings.tagline,
  });

  return (
    <div className="page-enter">
      <section className="section section--tight section--warm">
        <div className="container">
          <Reveal>
            <div className="eyebrow">About</div>
            <h1>{settings.about_title}</h1>
            <p className="lead" style={{ marginTop: '1rem' }}>
              {settings.tagline}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container split" style={{ alignItems: 'start' }}>
          <Reveal variant="left">
            <div className="prose">
              <p className="lead">{settings.about_body}</p>

              <h3>What we do</h3>
              <p>
                We arrange tourism services between Sri Lanka and Italy in both directions. That
                covers planned itineraries for travellers who want a framework, and fully custom
                trips for those who already know what they are after.
              </p>
              <p>
                On the ground that means transport, guides and accommodation arranged for you, with
                a single point of contact throughout. For the international leg we help with flight
                planning and the document preparation that goes with it.
              </p>

              <h3>How it works</h3>
              <ul className="feature-list">
                <li>Tell us your dates, direction, and roughly what you want to see</li>
                <li>We come back with a proposed itinerary and an honest price</li>
                <li>You adjust it until it fits — nothing is fixed until you say so</li>
                <li>We book, confirm and stay reachable throughout the trip</li>
              </ul>

              <h3>Why both directions</h3>
              <p>
                Travel between these two countries runs both ways: holidays out, family visits back,
                longer stays either direction. Working both sides means the same person can answer
                questions whether you are planning from Colombo, Rome or anywhere in between.
              </p>
            </div>
          </Reveal>

          <Reveal variant="right">
            <div className="stack">
              <div className="card">
                <div className="card__body" style={{ padding: 'clamp(24px, 3vw, 32px)' }}>
                  <div className="eyebrow">At a glance</div>
                  <div className="grid grid--2" style={{ gap: '1rem', marginTop: '0.6rem' }}>
                    <div>
                      <div className="stat__value" style={{ color: 'var(--teal-800)' }}>
                        {stats.destinations}
                      </div>
                      <div className="muted" style={{ fontSize: '0.86rem' }}>
                        Destinations
                      </div>
                    </div>
                    <div>
                      <div className="stat__value" style={{ color: 'var(--teal-800)' }}>
                        {stats.packages}
                      </div>
                      <div className="muted" style={{ fontSize: '0.86rem' }}>
                        Tour packages
                      </div>
                    </div>
                    <div>
                      <div className="stat__value" style={{ color: 'var(--teal-800)' }}>
                        2
                      </div>
                      <div className="muted" style={{ fontSize: '0.86rem' }}>
                        Countries
                      </div>
                    </div>
                    <div>
                      <div className="stat__value" style={{ color: 'var(--teal-800)' }}>
                        2
                      </div>
                      <div className="muted" style={{ fontSize: '0.86rem' }}>
                        Travel directions
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card__body" style={{ padding: 'clamp(24px, 3vw, 32px)' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Get in touch</h3>
                  <ContactTiles variant="compact" />
                </div>
              </div>

              <div className="row">
                <Link to="/packages" className="btn">
                  Browse tours
                </Link>
                <Link to="/contact" className="btn btn--outline">
                  Ask a question
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
