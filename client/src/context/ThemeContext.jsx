import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * ThemeContext provides a light/dark mode toggle shared across the app.
 * It also injects the Liquid‑Glass CSS variables that depend on the mode.
 *
 * The implementation respects any existing theme preferences stored in
 * localStorage under the key "theme" and falls back to the OS‑level
 * "prefers‑color‑scheme" media query when none is set.
 *
 * The context is deliberately lightweight and does not conflict with any
 * other context (SettingsContext, AuthContext). It can be imported anywhere
 * with `useTheme()`.
 */

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Resolve initial mode: localStorage > OS preference > light
  const getInitialMode = () => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [mode, setMode] = useState(getInitialMode);

  // Apply CSS class and persist selection
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${mode}`);
    window.localStorage.setItem('theme', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const value = { mode, toggleTheme };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
