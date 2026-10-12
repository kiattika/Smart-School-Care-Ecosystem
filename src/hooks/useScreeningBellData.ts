import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  SCREENING_FOLLOWUP_EVENT,
  listenCollection,
  loadParentNotices,
  loadStudentFollowups,
  readDocOrNull,
} from '../services/screeningService';
import {
  countScreeningTasks,
  redFlagStudentIds,
  type HandledNineQIds,
  type ScreeningTaskRecord,
} from '../lib/screeningTasks';

type TwoQDoc = NonNullable<ScreeningTaskRecord['twoQ']>;
type NineDoc = NonNullable<ScreeningTaskRecord['nineSummary']>;
type ProgressDoc = NonNullable<ScreeningTaskRecord['progress']>;

export type ScreeningBellMode = 'GUIDANCE' | 'HOMEROOM' | null;

const HOMEROOM_REFRESH_MS = 5 * 60 * 1000;

/**
 * จำนวนงานค้างคัดกรอง 2Q/9Q สำหรับกระดิ่ง — เฉพาะ "จำนวน" (ไม่เก็บ/ไม่แสดงชื่อหรือผลใดๆ ออกจากฮุกนี้)
 *  - GUIDANCE (ครูแนะแนว): live listener ทั้งโรงเรียน (rules อนุญาต list เพราะสิทธิ์ตามบทบาทล้วน)
 *  - HOMEROOM (ครูที่ปรึกษา): rules ผูกห้องต่อเอกสาร list ทั้ง collection ไม่ได้ → อ่านรายคนของนักเรียนในห้องตัวเอง
 *    โหลดตอน mount / เปิดกระดิ่ง / หลังบันทึกจัดการ / ทุก 5 นาที (ไม่ live)
 * "จัดการแล้ว" ของ 9Q ธงแดง = มีบันทึกแจ้งผู้ปกครอง (scope 9Q) หรือพบนักเรียน ผูกกับผล 9Q ฉบับนั้น — อ่านเฉพาะนักเรียนที่มีธงแดง
 */
export function useScreeningBellData(mode: ScreeningBellMode, homeroomClass: string | undefined, refreshKey: number): { twoQ: number; redFlag: number } {
  const [records, setRecords] = useState<Map<string, ScreeningTaskRecord>>(new Map());
  const [handled, setHandled] = useState<Map<string, HandledNineQIds>>(new Map());
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener(SCREENING_FOLLOWUP_EVENT, refresh);
    return () => window.removeEventListener(SCREENING_FOLLOWUP_EVENT, refresh);
  }, [refresh]);

  // ครูแนะแนว: live
  useEffect(() => {
    if (mode !== 'GUIDANCE') return;
    const parts = { twoQ: [] as Array<TwoQDoc & { _docId: string }>, nine: [] as Array<NineDoc & { _docId: string }>, progress: [] as Array<ProgressDoc & { _docId: string }> };
    const rebuild = () => {
      const map = new Map<string, ScreeningTaskRecord>();
      const get = (sid: string) => { let r = map.get(sid); if (!r) { r = {}; map.set(sid, r); } return r; };
      parts.twoQ.forEach((d) => { get(d._docId).twoQ = d; });
      parts.nine.forEach((d) => { get(d._docId).nineSummary = d; });
      parts.progress.forEach((d) => { get(d._docId).progress = d; });
      setRecords(map);
    };
    const fail = (k: string) => (e: Error) => console.warn(`[screeningBell] ${k} listener notice:`, e.message);
    const unsubs = [
      listenCollection<TwoQDoc>('student_screenings_2q', (l) => { parts.twoQ = l; rebuild(); }, fail('2q')),
      listenCollection<NineDoc>('student_screenings_9q', (l) => { parts.nine = l; rebuild(); }, fail('9q')),
      listenCollection<ProgressDoc>('student_screening_progress', (l) => { parts.progress = l; rebuild(); }, fail('progress')),
    ];
    return () => unsubs.forEach((u) => u());
  }, [mode]);

  // ครูที่ปรึกษา: อ่านรายคนของห้องตัวเอง
  useEffect(() => {
    if (mode !== 'HOMEROOM' || !homeroomClass) return;
    let cancelled = false;
    const load = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'students'), where('room', '==', homeroomClass)));
        const ids = snap.docs.map((d) => (d.data().studentId as string) || d.id);
        const rows = await Promise.all(ids.map(async (sid): Promise<[string, ScreeningTaskRecord]> => {
          const [twoQ, nineSummary, progress] = await Promise.all([
            readDocOrNull<TwoQDoc>(`student_screenings_2q/${sid}`),
            readDocOrNull<NineDoc>(`student_screenings_9q/${sid}`),
            readDocOrNull<ProgressDoc>(`student_screening_progress/${sid}`),
          ]);
          return [sid, { twoQ, nineSummary, progress }];
        }));
        if (!cancelled) setRecords(new Map(rows));
      } catch (err) {
        console.warn('[screeningBell] homeroom load notice:', err instanceof Error ? err.message : err);
      }
    };
    load();
    const timer = window.setInterval(load, HOMEROOM_REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [mode, homeroomClass, tick, refreshKey]);

  // สถานะ "จัดการแล้ว" ของนักเรียนที่มีธงแดง
  const flagKey = useMemo(() => redFlagStudentIds(records).sort().join('|'), [records]);
  useEffect(() => {
    if (!mode || !flagKey) { setHandled(new Map()); return; }
    let cancelled = false;
    (async () => {
      try {
        const rows = await Promise.all(flagKey.split('|').map(async (sid): Promise<[string, HandledNineQIds]> => {
          const [notices, followups] = await Promise.all([loadParentNotices(sid), loadStudentFollowups(sid)]);
          const ids = new Set<string>();
          notices.filter((n) => n.scope === 'NINE_Q').forEach((n) => ids.add(n.screeningId));
          followups.forEach((f) => ids.add(f.screeningId));
          return [sid, ids];
        }));
        if (!cancelled) setHandled(new Map(rows));
      } catch (err) {
        console.warn('[screeningBell] handled load notice:', err instanceof Error ? err.message : err);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, flagKey, tick, refreshKey]);

  return useMemo(() => countScreeningTasks(records, handled), [records, handled]);
}
