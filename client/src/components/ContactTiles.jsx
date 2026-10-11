import { useSettings } from '../context/SettingsContext';

/**
 * The three contact methods the business supplied, as tappable tiles.
 * Values come from persistent settings so admins can update them.
 */
export default function ContactTiles({ variant = 'default' }) {
  const { contact } = useSettings();

  const tiles = [
    contact.email.href && {
      key: 'email',
      label: 'Email',
      value: contact.email.display,
      href: contact.email.href,
      hint: 'We reply as soon as we can',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M3.5 7.5l8.5 6 8.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      ),
    },
    contact.phone.href && {
      key: 'phone',
      label: 'Telephone',
      value: contact.phone.display,
      href: contact.phone.href,
      hint: 'Tap to call',
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6.2 3.7h3l1.5 4-2 1.4a12 12 0 006.2 6.2l1.4-2 4 1.5v3a2 2 0 01-2.2 2A17.5 17.5 0 014.2 5.9a2 2 0 012-2.2z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    contact.whatsapp.href && {
      key: 'whatsapp',
      label: 'WhatsApp',
      value: contact.whatsapp.display,
      href: contact.whatsapp.href,
      hint: 'Message us directly',
      external: true,
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3a9 9 0 00-7.7 13.7L3 21l4.4-1.2A9 9 0 1012 3z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M8.8 9.2c.3-.6.6-.6.9-.6h.6c.2 0 .5 0 .7.6l.7 1.6c.1.3 0 .5-.1.7l-.4.5c-.1.2-.2.4 0 .7a7 7 0 003.1 2.7c.3.1.5.1.7-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.4.4.6 0 .9-.7 1.7-1.6 1.8-3.6.3-8.4-4.5-7.7-8.2z"
            fill="currentColor"
          />
        </svg>
      ),
    },
  ].filter(Boolean);

  return (
    <div className={`contact-grid${variant === 'compact' ? ' contact-grid--compact' : ''}`}>
      {tiles.map((tile) => (
        <a
          key={tile.key}
          className="contact-tile"
          href={tile.href}
          {...(tile.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <span className="contact-tile__icon">{tile.icon}</span>
          <span>
            <span className="contact-tile__label">{tile.label}</span>
            <span className="contact-tile__value">{tile.value}</span>
            <span className="contact-tile__hint">{tile.hint}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
