import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { MapProvider, useMap } from '../context/MapContext';
import { gsap } from 'gsap';

function JourneyContent() {
  const { loading } = useSettings();
  const { t } = useTranslation();
  const { mapInstance, isReady, setCenterZoom, registerMap, unregisterMap } = useMap();

  const [center, setCenter] = useState([8.4, 8.2]);
  const [zoom, setZoom] = useState(4);
  const isAnimatingRef = useRef(false);
  const activeTween = useRef(null);
  const mapContainerRef = useRef(null);

  // Initialize map when container is available
  useEffect(() => {
    if (!mapContainerRef.current || mapInstance) return;

    let cancelled = false;
    import('maplibre-gl')
      .then((MapLibre) => {
        if (cancelled) return;

        const map = new MapLibre.Map({
          container: mapContainerRef.current,
          style: 'https://demotiles.maplibre.org/style.json',
          center,
          zoom,
          antialias: true,
          scrollZoomAnimation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        });

        map.addControl(
          new MapLibre.Control.Attribution({
            position: 'bottom-left',
            text: 'Map data © OpenStreetMap contributors',
          })
        );

        registerMap(map);
      })
      .catch((err) => {
        if (!cancelled) console.error('MapLibre load error:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [center, zoom, registerMap, mapInstance]);

  // Set initial camera when map is ready
  useEffect(() => {
    if (isReady && setCenterZoom && center) {
      setCenterZoom(center, zoom);
    }
  }, [isReady, center, zoom, setCenterZoom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeTween.current) activeTween.current.kill();
      unregisterMap();
    };
  }, [unregisterMap]);

  // Scroll-driven camera movement
  useEffect(() => {
    if (!isReady || !mapInstance) return;

    const handleScroll = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (window.scrollY > (window.innerHeight * 0.5)) {
          setCenterZoom([41.9, 12.5], 3);
        }
        return;
      }
      if (isAnimatingRef.current) return;
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const scrollThreshold = viewportHeight * 0.5;

      if (scrollY > scrollThreshold) {
        const newCenter = [41.9, 12.5];
        const newZoom = 3;
        if (activeTween.current) activeTween.current.kill();
        activeTween.current = gsap.to({}, {
          center: newCenter,
          zoom: newZoom,
          duration: 2,
          ease: 'power2.out',
          onUpdate: (self) => setCenterZoom(self.center, self.zoom),
          onComplete: () => { isAnimatingRef.current = false; activeTween.current = null; },
        });
        isAnimatingRef.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (activeTween.current) activeTween.current.kill();
    };
  }, [isReady, mapInstance, setCenterZoom]);

  const handleExploreItaly = () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCenterZoom([41.9, 12.5], 3);
      isAnimatingRef.current = false;
      return;
    }
    if (activeTween.current) activeTween.current.kill();
    activeTween.current = gsap.to({}, {
      center: [41.9, 12.5],
      zoom: 3,
      duration: 2,
      ease: 'power2.out',
      onUpdate: (self) => setCenterZoom(self.center, self.zoom),
      onComplete: () => { isAnimatingRef.current = false; activeTween.current = null; },
    });
  };

  const handleExploreSri = () => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCenterZoom([8.4, 8.2], 4);
      isAnimatingRef.current = false;
      return;
    }
    if (activeTween.current) activeTween.current.kill();
    activeTween.current = gsap.to({}, {
      center: [8.4, 8.2],
      zoom: 4,
      duration: 2,
      ease: 'power2.out',
      onUpdate: (self) => setCenterZoom(self.center, self.zoom),
      onComplete: () => { isAnimatingRef.current = false; activeTween.current = null; },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary-dark">
        <div className="p-8 text-center">
          <div className="spinner" />
          <p className="mt-4 text-muted">{t('journey.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="glass" id="map" ref={mapContainerRef} style={{ width: '100%', height: '100vh', minHeight: '600px' }} />
      <div className="explore-controls">
        <button className="explore-btn explore-btn--sri" aria-label={t('journey.exploreSriLanka') || 'Explore Sri Lanka'} onClick={handleExploreSri}>
          ← {t('journey.exploreSriLanka') || 'Explore Sri Lanka'}
        </button>
        <button className="explore-btn explore-btn--italy" aria-label={t('journey.exploreItaly') || 'Explore Italy'} onClick={handleExploreItaly}>
          {t('journey.exploreItaly') || 'Explore Italy'} →
        </button>
      </div>
    </>
  );
}

export default function Journey() {
  const [center] = useState([8.4, 8.2]);
  const [zoom] = useState(4);

  return (
    <MapProvider>
      <JourneyContent />
    </MapProvider>
  );
}