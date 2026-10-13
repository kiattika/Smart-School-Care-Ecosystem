/** สะพานระหว่าง service worker (main.tsx) กับหน้า MobileApp: มีเวอร์ชันใหม่รออัปเดตหรือไม่ */
type Activate = () => void;
let pending: Activate | null = null;
const listeners = new Set<(a: Activate | null) => void>();

export function notifyUpdateReady(activate: Activate): void {
  pending = activate;
  listeners.forEach(l => l(pending));
}

export function subscribeUpdateReady(l: (a: Activate | null) => void): () => void {
  listeners.add(l);
  l(pending);
  return () => { listeners.delete(l); };
}
