import { cn } from "./lib/utils";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './lib/pwa';
import { notifyUpdateReady } from './mobile/updateBus';
import { SchoolInfoPage } from './components/publicinfo/SchoolInfoPage';
import { isPublicInfoPath } from './lib/publicInfo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* /info = หน้าสาธารณะ ไม่ผ่านระบบล็อกอิน/store ของ App */}
    {isPublicInfoPath(window.location.pathname) ? <SchoolInfoPage /> : <App />}
  </StrictMode>,
);

registerServiceWorker(notifyUpdateReady);
