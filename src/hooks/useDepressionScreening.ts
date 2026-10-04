import { useCallback, useEffect, useMemo, useState } from 'react';
import { TwoQuestionScreening } from '../types';
import { NineQBasis, pickNineQBasis } from '../lib/depressionScreening';
import {
  EightQDoc,
  EightQFlagDoc,
  NineQDetailDoc,
  NineQGrantDoc,
  NineQProgressDoc,
  NineQSummaryDoc,
  listenCollection,
  listenDoc,
  loadNineQGrants,
  readDocOrNull,
} from '../services/screeningService';

/**
 * ข้อมูลคัดกรอง 2Q/9Q/8Q ของนักเรียน "คนเดียว" ที่ฝั่ง UI ต่างๆ ใช้ร่วมกัน (ฟิลด์ที่ไม่มีสิทธิ์อ่าน/ไม่มีเอกสาร = null)
 *  - nineDetail: ครูแนะแนวเสมอ; ครูที่ปรึกษาเฉพาะเมื่อไม่มีครูแนะแนวที่ใช้งานอยู่
 *  - eightQ: เหมือน nineDetail; eightQFlag: ครูที่ปรึกษาเห็นเสมอ
 */
export interface StudentScreeningRecord {
  studentId: string;
  twoQ: TwoQuestionScreening | null;
  nineSummary: NineQSummaryDoc | null;
  nineDetail: NineQDetailDoc | null;
  eightQ: EightQDoc | null;
  eightQFlag: EightQFlagDoc | null;
  progress: NineQProgressDoc | null;
}

export const emptyScreeningRecord = (studentId: string): StudentScreeningRecord => ({
  studentId, twoQ: null, nineSummary: null, nineDetail: null, eightQ: null, eightQFlag: null, progress: null,
});

// ───────── สถานะ "มีครูแนะแนวที่ใช้งานอยู่" (cache ที่ Cloud Functions คำนวณ) ─────────

/**
 * school_settings/guidance_status — ตัวเดียวกับที่ firestore.rules ใช้ตัดสินสิทธิ์ครูที่ปรึกษา (ดู functions/src/guidanceStatus.ts)
 * ไม่มี doc / อ่านไม่ได้ = ถือว่า "มีครูแนะแนว" (fail-closed เหมือน rules): UI ครูที่ปรึกษาจึงเห็นแค่ระดับ ไม่เสนอปุ่มที่ rules จะปฏิเสธ
 */
export function useGuidanceStatus(): { hasActiveCounselor: boolean; known: boolean; loading: boolean } {
  const [state, setState] = useState<{ hasActiveCounselor: boolean; known: boolean; loading: boolean }>({ hasActiveCounselor: true, known: false, loading: true });
  useEffect(() => listenDoc<{ hasActiveCounselor?: boolean }>(
    'school_settings/guidance_status',
    (d) => setState(typeof d?.hasActiveCounselor === 'boolean'
      ? { hasActiveCounselor: d.hasActiveCounselor, known: true, loading: false }
      : { hasActiveCounselor: true, known: false, loading: false }),
    (err) => { console.warn('[useGuidanceStatus] listener notice — treating as "has counselor":', err.message); setState({ hasActiveCounselor: true, known: false, loading: false }); },
  ), []);
  return state;
}

// ───────── นักเรียน: 9Q เปิดให้ทำได้ไหม ─────────

export interface StudentNineQGate {
  loading: boolean;
  error: string | null;
  /** ฐานที่ใช้ทำได้ตอนนี้ (null = ปิด — ไม่แสดงปุ่ม/ฟอร์มเลย) */
  basis: NineQBasis | null;
  usedBasisIds: string[];
  /** ส่งแล้วในรอบนี้ (ฐานล่าสุดถูกใช้แล้ว) — ใช้แสดงข้อความ "ส่งแล้ว" กลางๆ โดยไม่เห็นผล */
  hasAnswered: boolean;
}

/**
 * นักเรียน (เจ้าของบัญชี) ฟังเอกสารของตัวเอง: 2Q ล่าสุด + progress + grants — ไม่อ่าน 9Q/8Q (rules ห้าม)
 * 9Q เปิดได้เฉพาะเมื่อ 2Q ล่าสุดเป็นบวกที่ยังไม่เคยใช้ หรือมีใบอนุญาตที่ครูเปิดให้ที่ยังไม่เคยใช้ (pickNineQBasis)
 * ปิด = basis null (ผู้เรียกไม่แสดงอะไรเลย)
 */
export function useStudentNineQGate(studentId: string | undefined, enabled: boolean): StudentNineQGate {
  const [twoQ, setTwoQ] = useState<TwoQuestionScreening | null>(null);
  const [progress, setProgress] = useState<NineQProgressDoc | null>(null);
  const [grants, setGrants] = useState<Array<NineQGrantDoc & { _docId: string }>>([]);
  const [loaded, setLoaded] = useState({ twoQ: false, progress: false, grants: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !studentId) return;
    setLoaded({ twoQ: false, progress: false, grants: false });
    const fail = (e: Error) => { setError(e.message); };
    const unsubs = [
      listenDoc<TwoQuestionScreening>(`student_screenings_2q/${studentId}`, (d) => { setTwoQ(d); setLoaded((l) => ({ ...l, twoQ: true })); }, fail),
      listenDoc<NineQProgressDoc>(`student_screening_progress/${studentId}`, (d) => { setProgress(d); setLoaded((l) => ({ ...l, progress: true })); }, fail),
      listenCollection<NineQGrantDoc>(`student_screening_progress/${studentId}/grants`, (list) => { setGrants(list); setLoaded((l) => ({ ...l, grants: true })); }, fail),
    ];
    return () => unsubs.forEach((u) => u());
  }, [studentId, enabled]);

  const usedBasisIds = useMemo(() => (Array.isArray(progress?.usedBasisIds) ? progress!.usedBasisIds : []), [progress]);
  const basis = useMemo(
    () => (enabled ? pickNineQBasis({ twoQ, grantIds: grants.map((g) => g._docId), usedBasisIds }) : null),
    [enabled, twoQ, grants, usedBasisIds],
  );
  const loading = enabled && !(loaded.twoQ && loaded.progress && loaded.grants);
  return { loading, error, basis, usedBasisIds, hasAnswered: usedBasisIds.length > 0 };
}

// ───────── ครูแนะแนว: ทั้งโรงเรียน (list ได้เพราะสิทธิ์ตามบทบาทล้วน) ─────────

export function useGuidanceScreeningRecords(): { records: Map<string, StudentScreeningRecord>; loading: boolean; error: string | null } {
  const [data, setData] = useState({
    twoQ: [] as Array<TwoQuestionScreening & { _docId: string }>,
    nineSummary: [] as Array<NineQSummaryDoc & { _docId: string }>,
    nineDetail: [] as Array<NineQDetailDoc & { _docId: string }>,
    eightQ: [] as Array<EightQDoc & { _docId: string }>,
    flags: [] as Array<EightQFlagDoc & { _docId: string }>,
    progress: [] as Array<NineQProgressDoc & { _docId: string }>,
  });
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mark = (k: string) => setLoaded((l) => ({ ...l, [k]: true }));
    const fail = (k: string) => (e: Error) => { console.error(`[useGuidanceScreeningRecords] ${k} listener error:`, e); setError(e.message); mark(k); };
    const unsubs = [
      listenCollection<TwoQuestionScreening>('student_screenings_2q', (l) => { setData((d) => ({ ...d, twoQ: l })); mark('twoQ'); }, fail('twoQ')),
      listenCollection<NineQSummaryDoc>('student_screenings_9q', (l) => { setData((d) => ({ ...d, nineSummary: l })); mark('nineSummary'); }, fail('nineSummary')),
      listenCollection<NineQDetailDoc>('student_screenings_9q_detail', (l) => { setData((d) => ({ ...d, nineDetail: l })); mark('nineDetail'); }, fail('nineDetail')),
      listenCollection<EightQDoc>('student_screenings_8q', (l) => { setData((d) => ({ ...d, eightQ: l })); mark('eightQ'); }, fail('eightQ')),
      listenCollection<EightQFlagDoc>('student_8q_case_flags', (l) => { setData((d) => ({ ...d, flags: l })); mark('flags'); }, fail('flags')),
      listenCollection<NineQProgressDoc>('student_screening_progress', (l) => { setData((d) => ({ ...d, progress: l })); mark('progress'); }, fail('progress')),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const records = useMemo(() => {
    const map = new Map<string, StudentScreeningRecord>();
    const get = (sid: string) => { let r = map.get(sid); if (!r) { r = emptyScreeningRecord(sid); map.set(sid, r); } return r; };
    for (const d of data.twoQ) get(d._docId).twoQ = d;
    for (const d of data.nineSummary) get(d._docId).nineSummary = d;
    for (const d of data.nineDetail) get(d._docId).nineDetail = d;
    for (const d of data.eightQ) get(d._docId).eightQ = d;
    for (const d of data.flags) get(d._docId).eightQFlag = d;
    for (const d of data.progress) get(d._docId).progress = d;
    return map;
  }, [data]);

  return { records, loading: Object.keys(loaded).length < 6, error };
}

// ───────── ครูที่ปรึกษา: เฉพาะนักเรียนในห้อง (อ่านรายคน — rules ผูกห้องต่อเอกสาร) ─────────

/**
 * โหลดผลคัดกรองของนักเรียนในห้อง (getDoc รายคน) — ไม่ใช่ live: เรียก reload() หลังทำรายการ (เปิด 9Q / บันทึก 8Q / แจ้งผู้ปกครอง)
 * ชั้นที่ครูที่ปรึกษาไม่มีสิทธิ์อ่าน (เช่น คำตอบ 9Q เมื่อมีครูแนะแนว) ได้ null ตามที่ rules กำหนด ไม่ใช่ error
 */
export function useRoomScreeningRecords(studentIds: readonly string[], enabled: boolean): {
  records: Map<string, StudentScreeningRecord>;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [records, setRecords] = useState<Map<string, StudentScreeningRecord>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const key = studentIds.join('|');

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled || studentIds.length === 0) { setRecords(new Map()); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const rows = await Promise.all(studentIds.map(async (sid): Promise<StudentScreeningRecord> => {
          const [twoQ, nineSummary, nineDetail, eightQ, eightQFlag, progress] = await Promise.all([
            readDocOrNull<TwoQuestionScreening>(`student_screenings_2q/${sid}`),
            readDocOrNull<NineQSummaryDoc>(`student_screenings_9q/${sid}`),
            readDocOrNull<NineQDetailDoc>(`student_screenings_9q_detail/${sid}`),
            readDocOrNull<EightQDoc>(`student_screenings_8q/${sid}`),
            readDocOrNull<EightQFlagDoc>(`student_8q_case_flags/${sid}`),
            readDocOrNull<NineQProgressDoc>(`student_screening_progress/${sid}`),
          ]);
          return { studentId: sid, twoQ, nineSummary, nineDetail, eightQ, eightQFlag, progress };
        }));
        if (!cancelled) setRecords(new Map(rows.map((r) => [r.studentId, r])));
      } catch (err) {
        console.error('[useRoomScreeningRecords] load failed:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, tick]);

  return { records, loading, error, reload };
}

export { loadNineQGrants };
