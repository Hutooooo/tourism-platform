import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';
import { useDirectionLabels } from '../utils/directionLabels';

export default function Footer() {
  const { t } = useTranslation();
  const { settings, contact, stats } = useSettings();
  const DIRECTION_LABEL = useDirectionLabels();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="footer__brand">{settings.brand_name}</div>
            <p style={{ fontSize: '0.93rem', maxWidth: '34ch' }}>{settings.tagline || settings.footer_note}</p>
          </div>

          <div>
            <div className="footer__heading">{t('footer.explore')}</div>
            <ul className="footer__list">
              <li><Link to="/destinations">{t('nav.destinations')}</Link></li>
              <li><Link to="/packages">{t('nav.tours')}</Link></li>
              <li><Link to="/about">{t('nav.about')}</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>

          <div>
            <div className="footer__heading">{t('footer.directions')}</div>
            <ul className="footer__list">
              {(settings.directions || []).map((d) => (
                <li key={d}>{DIRECTION_LABEL[d]}</li>
              ))}
              <li className="muted" style={{ color: 'rgba(233,243,241,0.55)', fontSize: '0.86rem' }}>
                {stats.destinations} destinations · {stats.packages} packages
              </li>
            </ul>
          </div>

          <div>
            <div className="footer__heading">{t('footer.getInTouch')}</div>
            <ul className="footer__list footer__contact">
              {contact.email.href && (
                <li>
                  <span aria-hidden="true">✉</span>
                  <a href={contact.email.href}>{contact.email.display}</a>
                </li>
              )}
              {contact.phone.href && (
                <li>
                  <span aria-hidden="true">☎</span>
                  <a href={contact.phone.href}>{contact.phone.display}</a>
                </li>
              )}
              {contact.whatsapp.href && (
                <li>
                  <span aria-hidden="true">💬</span>
                  <a href={contact.whatsapp.href} target="_blank" rel="noopener noreferrer">
                    WhatsApp: {contact.whatsapp.display}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span>
            © {year} {settings.brand_name}. {settings.footer_note}
          </span>
          <span>{settings.tagline || 'Tourism services between Sri Lanka and Italy'}</span>
        </div>
      </div>
    </footer>
  );
}