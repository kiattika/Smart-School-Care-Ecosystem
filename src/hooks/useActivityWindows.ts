import { useEffect, useState } from 'react';
import { subscribeActivityWindows } from '../services/activityWindowService';
import type { ActivityWindows } from '../lib/activityWindows';

/** school_settings/activity_windows (ล็อกอินอ่านได้) — ยังไม่โหลด/อ่านไม่ได้ = {} (ไม่จำกัด) */
export function useActivityWindows(): ActivityWindows {
  const [w, setW] = useState<ActivityWindows>({});
  useEffect(() => subscribeActivityWindows(setW), []);
  return w;
}
