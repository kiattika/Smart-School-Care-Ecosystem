/** PWA: ตรวจเส้นทางหน้ามือถือ + ลงทะเบียน service worker (เฉพาะ production บน https/localhost) */

export const MOBILE_BASE_PATH = '/m';

export function isMobilePath(pathname: string): boolean {
  return pathname === MOBILE_BASE_PATH || pathname.startsWith(`${MOBILE_BASE_PATH}/`);
}

export function canRegisterServiceWorker(env: { prod: boolean; hasSW: boolean; secure: boolean }): boolean {
  return env.prod && env.hasSW && env.secure;
}

/** คืนฟังก์ชันสั่งให้ worker ตัวใหม่ทำงานทันที (เรียกเมื่อผู้ใช้กดอัปเดต) ผ่าน callback onUpdateReady */
export function registerServiceWorker(onUpdateReady: (activate: () => void) => void): void {
  if (typeof window === 'undefined') return;
  const ok = canRegisterServiceWorker({
    prod: import.meta.env.PROD,
    hasSW: 'serviceWorker' in navigator,
    secure: window.isSecureContext,
  });
  if (!ok) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      const notify = (worker: ServiceWorker | null) => {
        if (!worker) return;
        onUpdateReady(() => worker.postMessage({ type: 'SKIP_WAITING' }));
      };
      if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) notify(w);
        });
      });
    }).catch((err) => console.warn('[pwa] service worker register failed:', err?.message || err));
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
