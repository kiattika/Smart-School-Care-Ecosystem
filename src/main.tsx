import { cn } from "./lib/utils";
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './lib/pwa';
import { notifyUpdateReady } from './mobile/updateBus';
import { SchoolInfoPage } from './components/publicinfo/SchoolInfoPage';
import { isPublicInfoPath } from './lib/publicInfo';
import { installThemeTokens, loadCachedOverrides } from './lib/themeTokens';

// หน้าสาธารณะ /info ออกแบบเป็นหน้าพื้นสว่างอยู่แล้ว — ไม่ตามธีมส่วนตัว (ธีมสว่างของระบบสลับสเกลสีจึงจะกลับด้าน)
// และไม่ใช้โทเคนสีของธีม (ลบ data-palette ที่สคริปต์ใน index.html ตั้งไว้)
if (isPublicInfoPath(window.location.pathname)) {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.removeAttribute('data-palette');
} else {
  // โทเคนสีของธีม (ค่าตามเอกสาร + ค่าที่แอดมินแก้ซึ่งจำไว้ในเครื่อง) — ติดตั้งก่อนวาดหน้า; ค่าล่าสุดจาก Firestore ตามมาใน useThemeTokens
  installThemeTokens(loadCachedOverrides());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* /info = หน้าสาธารณะ ไม่ผ่านระบบล็อกอิน/store ของ App */}
    {isPublicInfoPath(window.location.pathname) ? <SchoolInfoPage /> : <App />}
  </StrictMode>,
);

registerServiceWorker(notifyUpdateReady);
