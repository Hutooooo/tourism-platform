import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import i18n from './i18n';
// Ensure HTML lang attribute matches current i18n language
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language;
}
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider } from './context/AuthContext';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <BrowserRouter basename={(() => {
          const match = window.location.pathname.match(/^\/(en|si|it)(?:\/|$)/);
          return match ? '/' + match[1] : '';
        })()} >
          <App />
        </BrowserRouter>
      </AuthProvider>
    </SettingsProvider>
  </StrictMode>
);
