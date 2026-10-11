import { useEffect, useRef, useState } from 'react';

/**
 * Adds `is-visible` to the element once it enters the viewport.
 *
 * Uses IntersectionObserver with a one-shot unobserve so the effect does
 * not keep firing. Falls back to visible immediately when the API is
 * missing or the user prefers reduced motion.
 */
export function useReveal(options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: options.threshold ?? 0.14, rootMargin: options.rootMargin ?? '0px 0px -8% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);

  return [ref, visible];
}

/**
 * Convenience wrapper: returns className for an element that animates in
 * on scroll.
 */
export function useRevealClass(baseClass = 'reveal', options = {}) {
  const [ref, visible] = useReveal(options);
  return [ref, `${baseClass}${visible ? ' is-visible' : ''}`];
}

/** True once the document has scrolled past `threshold` px. */
export function useScrolledPast(threshold = 12) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return past;
}
