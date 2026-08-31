import { createRoot } from 'react-dom/client';
import esriConfig from '@arcgis/core/config.js';
import { App } from './components/App';
import './styles/index.css';

// NOTE: intentionally NOT wrapped in <StrictMode>. StrictMode double-invokes effects
// in dev (mount → cleanup → mount), which churns the ArcGIS MapView lifecycle
// (create → destroy → create) and breaks FeatureLayer layerviews on remount-heavy
// views like the Guided Finder. The SDK's imperative view lifecycle doesn't tolerate
// it. (StrictMode is dev-only, so this also makes dev match production behavior.)

// Public, anonymous app: basemaps + feature layers are shared publicly. Only set an
// API key when present (an empty one sends an invalid token and triggers a sign-in
// dialog). The GISC tiled basemap needs the key; routing would too if enabled.
esriConfig.request.useIdentity = false;
const apiKey = import.meta.env.VITE_ARCGIS_API_KEY as string | undefined;
if (apiKey) {
  esriConfig.apiKey = apiKey;
}

createRoot(document.getElementById('root')!).render(<App />);
