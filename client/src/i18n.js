// i18n.js – i18next initialization
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation resources
import en from './locales/en/translation.json';
import si from './locales/si/translation.json';
import it from './locales/it/translation.json';

// Helper to detect language from URL prefix, localStorage, or browser
const languageDetector = {
  type: 'languageDetector',
  async: false,
  detect: () => {
    // 1. URL prefix
    const match = window.location.pathname.match(/^\/(en|si|it)(?:\/|$)/);
    if (match) return match[1];
    // 2. localStorage
    const stored = localStorage.getItem('lang');
    if (stored) return stored;
    // 3. Browser language (first two chars)
    const navLang = navigator.language.slice(0, 2);
    if (['en', 'si', 'it'].includes(navLang)) return navLang;
    // 4. Fallback
    return 'en';
  },
  init: () => {},
  cacheUserLanguage: (lng) => {
    localStorage.setItem('lang', lng);
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: { en, si, it },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    debug: false,
    detection: { order: ['customDetector'], caches: [] },
  })
  .catch((e) => console.error('i18n init error:', e));

export default i18n;
