import { useEffect, useState } from 'react';
import { applyPreferences, loadLocalPreferences, saveLocalPreferences, type UserPreferences } from '../lib/userPreferences';
import { subscribeUserPreferences } from '../services/userPreferencesService';

/** ค่าตั้งค่าส่วนตัวของผู้ใช้ที่ล็อกอิน (live) — ใช้ธีม/ขนาดตัวอักษรกับหน้าทันทีที่ค่ามาถึง; ก่อนมีค่าใช้ของเครื่องนี้ (localStorage) */
export function useMyPreferences(uid: string | undefined): { prefs: UserPreferences; loaded: boolean; error: string } {
  const [prefs, setPrefs] = useState<UserPreferences>(() => loadLocalPreferences());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!uid) { setLoaded(false); return; }
    return subscribeUserPreferences(uid, (p, exists) => {
      setLoaded(true); setError('');
      // ยังไม่เคยตั้งค่าไว้บนบัญชี → คงค่าของเครื่องนี้ (ไม่เขียนทับด้วยค่าเริ่มต้น)
      if (exists) { setPrefs(p); saveLocalPreferences(p); }
    }, e => setError(e.message));
  }, [uid]);
  useEffect(() => {
    applyPreferences(prefs);
    if (prefs.theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyPreferences(prefs);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [prefs]);
  return { prefs, loaded, error };
}
