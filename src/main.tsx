import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import esriConfig from '@arcgis/core/config.js';
import { App } from './components/App';
import './styles/index.css';

// Use API key for premium services (routing) — no user login required
esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY as string;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
