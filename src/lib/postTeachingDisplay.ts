import type { PostTeachingRecord } from '../types';

/** คาบที่สอน: ใช้ `periodNumber` ที่บันทึกไว้ ไม่มี = ถอดจากท้าย scheduleId/courseId (`…_p3`); ไม่รู้ = null (ห้ามเดา) */
export function periodOfRecord(r: Pick<PostTeachingRecord, 'courseId' | 'scheduleId'> & { periodNumber?: number | string | null }): number | null {
  if (r.periodNumber !== undefined && r.periodNumber !== null && r.periodNumber !== '') {
    const n = Number(r.periodNumber);
    if (Number.isFinite(n)) return n;
  }
  for (const id of [r.scheduleId, r.courseId]) {
    const m = /_p(\d+)$/i.exec(String(id || ''));
    if (m) return Number(m[1]);
  }
  return null;
}

/** ใหม่ → เก่า: วันที่สอนมาก→น้อย, คาบมาก→น้อย, เวลาส่งใหม่→เก่า (ไม่แก้ array เดิม) */
export function sortPostTeachingRecords<T extends PostTeachingRecord>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    const d = String(b.date || '').localeCompare(String(a.date || ''));
    if (d !== 0) return d;
    const pa = periodOfRecord(a) ?? -1, pb = periodOfRecord(b) ?? -1;
    if (pa !== pb) return pb - pa;
    return String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''));
  });
}
