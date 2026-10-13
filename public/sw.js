/* Service worker ของ Smart School Care (PWA หน้ามือถือ /m)
 * - แคชเฉพาะ "เปลือกแอป" (HTML/JS/CSS/ไอคอนของโดเมนเราเอง) ให้เปิดแอปได้เร็วและมีหน้าสำรองตอนออฟไลน์
 * - ไม่แตะคำขอข้ามโดเมนทั้งหมด (Firestore / Auth / Functions / Storage / LINE) และ /__/ ของ Firebase Hosting
 *   → ข้อมูลนักเรียน/ผลเช็คชื่อไม่ถูกเก็บในแคชของ service worker เด็ดขาด
 * - เวอร์ชันใหม่ "รอ" จนผู้ใช้กดอัปเดต (ข้อความ SKIP_WAITING) ไม่รีโหลดกลางงาน
 */
const VERSION = 'v1';
const SHELL_CACHE = `ssc-shell-${VERSION}`;
const ASSET_CACHE = `ssc-assets-${VERSION}`;
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).catch(() => undefined)
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // ข้ามโดเมน = ไม่แตะ
  if (url.pathname.startsWith('/__/')) return; // Firebase Hosting reserved URLs (auth handler ฯลฯ)
  if (url.pathname === '/sw.js') return;

  // เปิดหน้า (SPA): ออนไลน์ใช้ของใหม่เสมอ, ออฟไลน์ใช้เปลือกที่แคชไว้
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(SHELL_CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // ไฟล์ที่มี hash ในชื่อ (/assets/...) ไม่เปลี่ยนเนื้อหา → cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(ASSET_CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // ไอคอน/manifest: stale-while-revalidate
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
