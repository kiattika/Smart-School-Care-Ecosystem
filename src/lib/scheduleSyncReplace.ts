/**
 * โหมด Sync/Replace ของ Bulk Import COURSE — ตรรกะบริสุทธิ์ (แยกออกมาให้ test ได้)
 *
 * Bulk Import COURSE เขียน `schedules` แบบ merge เท่านั้น ไม่เคยลบของเก่า → ข้อมูลผีสะสม
 * (เช่นห้อง 944 ที่ไม่เคยมีในไฟล์จริง). ฟังก์ชันนี้หา doc เก่าที่ควรลบเมื่อ import ไฟล์ใหม่
 *
 * ⚠️ SAFETY: ถ้าครูคนไหน "มีแถวที่ import ไม่ผ่าน" ในไฟล์ → **ไม่แตะ schedule เก่าของครูคนนั้นเลย**
 * เพราะ newIds จะมาจากแถว valid เท่านั้น (เช่นมีแต่วิชาการ ขาดกิจกรรมที่ parse ไม่ผ่าน)
 * → กิจกรรมเดิมของครูจะโดนตีความว่า stale แล้วโดนลบทั้งหมด (bug "คาบกิจกรรมหายหมด")
 */

/** สร้าง schedule document id ให้ตรงกับ handleImport (Teacher Load Report path) */
export function scheduleDocIdFor(
  subjectCode: string, room: string, level: string, dayOfWeek: string, periodNumber: number,
): string {
  const safeCode = String(subjectCode || 'X').replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '_');
  const cleanRoom = (room || level || 'all').replace(/[^a-zA-Z0-9]/g, '_');
  return `sch_${safeCode}_${cleanRoom}_${dayOfWeek}_p${periodNumber}`;
}

/** ตัวระบุครูของ schedule doc ที่มีอยู่แล้วใน Firestore (uid / อีเมล / ชื่อ) */
export function scheduleTeacherKeys(data: Record<string, any>): string[] {
  const keys: string[] = [];
  if (data.teacherId) keys.push(String(data.teacherId).toLowerCase());
  if (Array.isArray(data.teacherIds)) data.teacherIds.forEach((t: string) => keys.push(String(t).toLowerCase()));
  if (data.teacherEmail) keys.push(String(data.teacherEmail).toLowerCase());
  if (data.unlinkedTeacherEmail) keys.push(String(data.unlinkedTeacherEmail).toLowerCase());
  if (data.sourceTeacherName) keys.push(String(data.sourceTeacherName).trim());
  if (data.unlinkedTeacherName) keys.push(String(data.unlinkedTeacherName).trim());
  return keys.filter(Boolean).map(k => k.toLowerCase().trim());
}

/** ตัวระบุครูจาก parsedData ของแถวในไฟล์ที่ import */
export function rowTeacherKeys(p: Record<string, any>): string[] {
  return [p.matchedTeacherId, p.matchedTeacherEmail, p.teacherEmail, p.teacherName, p.unlinkedTeacherName]
    .filter(Boolean).map(k => String(k).toLowerCase().trim());
}

export interface StaleScheduleDoc {
  id: string;
  label: string;
  subjectType?: string;
}

export interface SyncReplacePlan {
  stale: StaleScheduleDoc[];
  teachersWithErrors: string[];
  fullyCoveredTeachers: string[];
  newIdCount: number;
  debug: string[];
}

/**
 * @param loadRows  ทุกแถว teacher-load-report (ทั้ง valid + invalid) — { isValid, parsedData }
 * @param existingDocs  schedule docs ที่มีอยู่แล้วใน Firestore — { id, data }
 */
export function computeSyncReplacePlan(
  loadRows: { isValid: boolean; parsedData: Record<string, any> }[],
  existingDocs: { id: string; data: Record<string, any> }[],
): SyncReplacePlan {
  const debug: string[] = [];
  const newIds = new Set<string>();
  const fullyCoveredTeacherKeys = new Set<string>();
  const teachersWithErrors = new Set<string>();

  for (const r of loadRows) {
    if (!r.isValid) rowTeacherKeys(r.parsedData).forEach(k => teachersWithErrors.add(k));
  }
  for (const r of loadRows) {
    if (!r.isValid) continue;
    const p = r.parsedData;
    const keys = rowTeacherKeys(p);
    const hasError = keys.some(k => teachersWithErrors.has(k));
    if (!hasError) keys.forEach(k => fullyCoveredTeacherKeys.add(k));
    for (const slot of (p.slots || [])) {
      newIds.add(scheduleDocIdFor(p.subjectCode, p.room, p.level, slot.dayOfWeek, slot.periodNumber));
    }
  }

  if (teachersWithErrors.size > 0) {
    debug.push(`ครูที่มีแถว import ไม่ผ่าน → ข้ามการลบของเก่าทั้งหมด: ${[...teachersWithErrors].join(', ')}`);
  }

  const stale: StaleScheduleDoc[] = [];
  for (const d of existingDocs) {
    if (newIds.has(d.id)) continue;
    const docKeys = scheduleTeacherKeys(d.data);
    const belongsToFullyCovered = docKeys.some(k => fullyCoveredTeacherKeys.has(k));
    if (!belongsToFullyCovered) {
      if (docKeys.some(k => teachersWithErrors.has(k))) {
        debug.push(`KEEP (ครูมี error ในไฟล์): ${d.id}`);
      }
      continue;
    }
    debug.push(`DELETE (ไม่มีในไฟล์ใหม่): ${d.id} [${d.data.subjectType || 'MAIN'}]`);
    stale.push({
      id: d.id,
      subjectType: d.data.subjectType,
      label: `${d.data.subjectCode || d.data.courseCode || '?'}${d.data.subjectType === 'ACTIVITY' ? ' (กิจกรรม)' : ''} · ห้อง ${d.data.room || d.data.level || '?'} · ${d.data.dayOfWeek || ''} คาบ ${d.data.periodNumber ?? '?'}`,
    });
  }

  debug.push(`สรุป: newIds=${newIds.size}, ครูครบถ้วน=${fullyCoveredTeacherKeys.size}, ครูมี error=${teachersWithErrors.size}, จะลบ=${stale.length}`);

  return {
    stale,
    teachersWithErrors: [...teachersWithErrors],
    fullyCoveredTeachers: [...fullyCoveredTeacherKeys],
    newIdCount: newIds.size,
    debug,
  };
}
