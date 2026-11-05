import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useSeo } from '../hooks/useSeo';
import Reveal from '../components/Reveal';
import ContactTiles from '../components/ContactTiles';

import { useTranslation } from 'react-i18next';

export default function About() {
  const { t } = useTranslation();
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
            {t('about.heading')}
                <h1>{settings.about_title}</h1>
                <p className="lead" style={{ marginTop: '1rem' }}>
                  {settings.tagline}
                </p>
                <h3>{t('about.whatWeDo')}</h3>
                <p>
                  {t('about.description')}
                </p>
                <h3>{t('about.howItWorks')}</h3>
                <ul className="feature-list">
                  <li>{t('about.feature1')}</li>
                  <li>{t('about.feature2')}</li>
                  <li>{t('about.feature3')}</li>
                  <li>{t('about.feature4')}</li>
                </ul>
                <h3>{t('about.whyBoth')}</h3>
                <p>
                  {t('about.whyBothText')}
                </p>
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
