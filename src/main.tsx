import { cn } from "./lib/utils";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './lib/pwa';
import { notifyUpdateReady } from './mobile/updateBus';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker(notifyUpdateReady);
