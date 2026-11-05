import { createRoot } from 'react-dom/client';
import React from 'react';
import { StrictMode } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider } from './context/AuthContext';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter basename={(() => {
            const match = window.location.pathname.match(/^\/(en|si|it)(?:\/|$)/);
            return match ? '/' + match[1] : '';
          })()}>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  </StrictMode>
);