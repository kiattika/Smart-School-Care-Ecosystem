import { useEffect } from 'react';
import { installThemeTokens, saveCachedOverrides } from '../lib/themeTokens';
import { subscribeThemeTokens } from '../services/themeTokensService';

/**
 * โทเคนสีของธีมจากเซิร์ฟเวอร์ (ที่แอดมินแก้) — ผู้ใช้ที่ล็อกอินแล้วรับค่าสด ติดตั้ง CSS และจำไว้ในเครื่อง
 * (หน้า Login/ก่อนล็อกอินใช้ค่าที่จำไว้ หรือค่าเริ่มต้นตามเอกสาร — main.tsx)
 */
export function useThemeTokens(signedIn: boolean): void {
  useEffect(() => {
    if (!signedIn) return;
    return subscribeThemeTokens(o => {
      installThemeTokens(o);
      saveCachedOverrides(o);
    }, e => console.error('[theme_tokens] อ่านโทเคนสีไม่สำเร็จ — ใช้ค่าที่จำไว้/ค่าเริ่มต้น', e));
  }, [signedIn]);
}
