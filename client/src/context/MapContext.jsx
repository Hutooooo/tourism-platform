import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useTheme } from './ThemeContext';

/**
 * MapContext makes the MapLibre instance available to MapShell and other
 * components. It also respects reduced‑motion preferences.
 */
const MapContext = createContext(null);

export function useMap() {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMap must be used within a MapProvider');
  return ctx;
}

export function MapProvider({ children }) {
  const [mapInstance, setMapInstance] = useState(null);
  const [isReady, setReady] = useState(false);
  const { mode } = useTheme();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstance) {
        mapInstance.remove();
      }
    };
  }, [mapInstance]);

  const value = {
    mapInstance,
    isReady,
    setCamera: (opts) => {
      if (mapInstance && mapInstance.setCamera) {
        mapInstance.setCamera(opts);
      }
    },
    setCenterZoom: (c, z) => {
      if (mapInstance) {
        mapInstance.setCenter(c);
        mapInstance.setZoom(z);
      }
    },
    // Allow child to register the map instance
    registerMap: (map) => {
      setMapInstance(map);
      setReady(true);
    },
    unregisterMap: () => {
      setMapInstance(null);
      setReady(false);
    },
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}