import { useEffect } from 'react';
import { useStore } from '../store';
import { CLOCK_TICK_MS } from '../lib/appClock';

/**
 * เดินนาฬิกาของแอป (store.currentDate) — mount ครั้งเดียวที่ App
 * tick ทุก CLOCK_TICK_MS และทันทีเมื่อกลับมาที่แท็บ (visibilitychange / focus) เพราะเบราว์เซอร์
 * หน่วง setInterval ของแท็บพื้นหลัง — production เดินตามเวลาจริงเสมอ, DEV ที่จำลองเวลาอยู่คงค่าจำลอง
 * (ตรรกะอยู่ใน store.tickClock → src/lib/appClock.ts)
 */
export function useAppClock() {
  const tickClock = useStore((s) => s.tickClock);

  useEffect(() => {
    tickClock();
    const interval = setInterval(() => tickClock(), CLOCK_TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tickClock();
    };
    const onFocus = () => tickClock();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [tickClock]);
}
