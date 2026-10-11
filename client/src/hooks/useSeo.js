import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';

function applyMeta({ title, description, keywords, canonical, og }) {
  if (title) document.title = title;

  const set = (selector, attr, key, value, createTag) => {
    if (!value) return;
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement(createTag);
      if (attr === 'property') el.setAttribute('property', key);
      else el.setAttribute('name', key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  };

  set('meta[name="description"]', 'name', 'description', description, 'meta');
  if (keywords && keywords.length) {
    set('meta[name="keywords"]', 'name', 'keywords', keywords.join(', '), 'meta');
  }

  set('meta[property="og:title"]', 'property', 'og:title', og && og.title, 'meta');
  set('meta[property="og:description"]', 'property', 'og:description', og && og.description, 'meta');
  set('meta[property="og:type"]', 'property', 'og:type', og && og.type, 'meta');
  set('meta[property="og:site_name"]', 'property', 'og:site_name', og && og.siteName, 'meta');

  if (canonical) {
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);
  }
}

/**
 * Sets document title and meta tags for the current route.
 *
 * SEO note: this is a client-rendered SPA, so crawlers that do not execute
 * JS see only the static index.html meta. The server still exposes
 * GET /api/public/seo for the same data, and the static tags in index.html
 * carry sensible defaults for the home page. For full per-page indexing a
 * prerender/SSR pass would be the next step.
 */
export function useSeo(overrides) {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const applyLocal = () => {
      if (cancelled || !overrides) return;
      applyMeta(overrides);
    };

    if (overrides && overrides.title) {
      // Local override wins immediately; no network round trip needed.
      applyLocal();
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const meta = await api.get(`/public/seo?path=${encodeURIComponent(location.pathname)}`);
        if (!cancelled) applyMeta(meta);
      } catch {
        // Leave whatever is already in place rather than blanking it.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, overrides && overrides.title, overrides && overrides.description]);
}
