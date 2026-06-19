import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import esriConfig from '@arcgis/core/config.js';
import { App } from './components/App';
import './styles/index.css';

// Public, anonymous app: the basemaps and feature layers are all shared publicly,
// so never attach a credential or prompt for sign-in. Setting an empty apiKey would
// send an invalid token and trigger a login dialog — so only set it when present
// (it's only needed if a profile turns on the walk-time routing feature).
esriConfig.request.useIdentity = false;
const apiKey = import.meta.env.VITE_ARCGIS_API_KEY as string | undefined;
if (apiKey) {
  esriConfig.apiKey = apiKey;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
