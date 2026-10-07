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

/** ภาคเรียนที่ schedule doc สังกัด — academicYear พ.ศ. 4 หลัก (เช่น "2569"), term "1" | "2" (ค่าเดียวกับ school_settings/academic_year) */
export interface ScheduleSemester { academicYear: string; term: string }

function semesterIdSegment(sem: ScheduleSemester): string {
  const clean = (v: unknown) => String(v ?? '').replace(/[^\p{L}\p{N}]+/gu, '');
  const term = clean(sem?.term);
  const year = clean(sem?.academicYear);
  // ห้ามสร้าง id โดยไม่มีภาคเรียน — เดิมคือสาเหตุที่ import ภาคเรียนใหม่ทับภาคเรียนเก่า
  if (!term || !year) throw new Error('scheduleDocIdFor: ต้องระบุ academicYear และ term');
  return `${term}_${year}`;
}

/**
 * schedule doc นี้อยู่ในภาคเรียนที่ระบุไหม — เอกสารเก่าที่ไม่มี academicYear/term (ก่อนมีการกำกับภาคเรียน)
 * ถือเป็นของภาคเรียนปัจจุบันเสมอ (ไม่ migrate ย้อนหลัง, ไม่ซ่อนเงียบๆ); มีแค่ field เดียวก็เทียบเฉพาะ field ที่มี
 */
export function isScheduleInTerm(data: Record<string, any> | null | undefined, sem: ScheduleSemester): boolean {
  if (!data) return false;
  const y = data.academicYear, t = data.term;
  if (y !== undefined && y !== null && y !== '' && String(y) !== String(sem.academicYear)) return false;
  if (t !== undefined && t !== null && t !== '' && String(t) !== String(sem.term)) return false;
  return true;
}

/** เอกสารที่ไม่มี academicYear/term ครบ (ข้อมูลก่อนงานนี้) */
export function isLegacyUnscopedSchedule(data: Record<string, any> | null | undefined): boolean {
  if (!data) return false;
  return !data.academicYear || !data.term;
}

/**
 * สร้าง schedule document id ให้ตรงกับ handleImport (Teacher Load Report path)
 *
 * ⚠️ ROOT CAUSE (คาบกิจกรรมของครูบางคนหายไปทั้งหมดหลัง import): แถวประเภท ACTIVITY (PLC,
 * กิจกรรมโฮมรูม, ลูกเสือ-เนตรนารี, แนะแนว ฯลฯ) มักไม่มีห้องเรียนเฉพาะ (room/level ว่างหรือ
 * "Non-Student") และมักเป็นกิจกรรม "ชื่อเดียวกัน + วัน-คาบเดียวกัน" ของครูหลายคนพร้อมกันทั้ง
 * โรงเรียน/กลุ่มสาระ — แต่ในรายงานภาระงานสอน แต่ละแถวคือภาระงานของครู "แต่ละคน" แยกกัน ไม่ใช่
 * คาบเรียนร่วมห้องเดียว ถ้าไม่ฝัง identity ครูเข้าไปใน id ครูที่ถูกประมวลผลทีหลังในไฟล์จะได้ id
 * เดียวกับครูคนก่อน แล้ว batch.set(..., {merge:true}) จะทับ teacherId/teacherIds ของครูคนก่อน
 * หน้าเงียบๆ (พิสูจน์แล้วด้วย Firestore Emulator จริง — ครูที่ไม่ใช่คนสุดท้ายในไฟล์ที่มีกิจกรรม
 * ชื่อเดียวกัน+วัน-คาบเดียวกัน จะเหลือคาบกิจกรรม 0 คาบเสมอ)
 *
 * แก้โดยฝัง teacherKey (primaryTeacherKey) เข้าไปใน id เฉพาะแถว subjectType === 'ACTIVITY'
 * เท่านั้น — แถว MAIN ไม่แตะ (room/level ของ MAIN ระบุห้องเรียนจริงที่ไม่ชนกันข้ามครูอยู่แล้ว
 * และมี schedule doc เก่าที่อ้างอิง id รูปแบบเดิมอยู่จริงใน production)
 *
 * TASK 3 (ครูร่วมสอน — ยืนยันจากข้อมูลจริง Teacher_Load_Report): แถว ACTIVITY ที่ "มีห้องเรียนจริง"
 * ระบุอยู่ (เช่น HR ม.5/8 ห้อง 943 ที่มี 2 ครูรับผิดชอบร่วมกัน) คือคาบ/ห้องเดียวกันจริง ไม่ใช่คนละ
 * session แบบ PLC/กิจกรรมทั้งโรงเรียนที่ไม่มีห้องเฉพาะ — ต้อง "รวม" เป็น schedule doc เดียวกัน
 * (ผ่าน teacherIds: string[] ในตัว doc เอง ดู generateScheduleDocuments/handleConfirmImport) ไม่ใช่
 * แยก doc ต่อครูแบบ ACTIVITY ไม่มีห้อง — จึงฝัง teacherKey เฉพาะตอน "ไม่มีห้องเรียนจริง" เท่านั้น
 * (room ว่าง — คือกรณีที่ root-cause fix เดิมตั้งใจแก้จริงๆ) ถ้ามี room ระบุอยู่ ถือว่าเป็นห้อง/คาบ
 * จริงที่ครูหลายคนแชร์กันได้ ไม่ฝัง teacherKey แม้จะเป็น ACTIVITY ก็ตาม
 */
export function scheduleDocIdFor(
  subjectCode: string, room: string, level: string, dayOfWeek: string, periodNumber: number,
  subjectType: string | undefined, teacherKey: string | undefined, semester: ScheduleSemester,
): string {
  const safeCode = String(subjectCode || 'X').replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '_');
  const cleanRoom = (room || level || 'all').replace(/[^a-zA-Z0-9]/g, '_');
  const safeTeacherKey = teacherKey
    ? String(teacherKey).replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '_').slice(0, 40)
    : '';
  const hasRealRoom = !!(room && String(room).trim());
  const teacherSegment = subjectType === 'ACTIVITY' && !hasRealRoom && safeTeacherKey ? `_t${safeTeacherKey}` : '';
  return `sch_${semesterIdSegment(semester)}_${safeCode}_${cleanRoom}${teacherSegment}_${dayOfWeek}_p${periodNumber}`;
}

/**
 * ตัวระบุครูหลักที่ใช้ฝังใน schedule doc id ของแถวกิจกรรม (ดู scheduleDocIdFor ด้านบน)
 * ต้องเป็นตัวเดียวกันทั้งตอนคำนวณ newIds (sync/replace) และตอนเขียนจริง (handleImport)
 * ลำดับความสำคัญ: UID จริงที่จับคู่ได้ > อีเมลที่จับคู่ได้ > อีเมลดิบจากไฟล์ > ชื่อครู
 * (ไม่ fabricate ID ใหม่ — ใช้ identity ที่มีอยู่แล้วของครูคนนั้นเป็น key เท่านั้น)
 */
export function primaryTeacherKey(p: Record<string, any>): string {
  return String(
    p.matchedTeacherId || p.matchedTeacherEmail || p.unlinkedTeacherEmail || p.teacherEmail || p.teacherName || p.unlinkedTeacherName || ''
  ).toLowerCase().trim();
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
  semester: ScheduleSemester,
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
      newIds.add(scheduleDocIdFor(p.subjectCode, p.room, p.level, slot.dayOfWeek, slot.periodNumber, p.subjectType, primaryTeacherKey(p), semester));
    }
  }

  if (teachersWithErrors.size > 0) {
    debug.push(`ครูที่มีแถว import ไม่ผ่าน → ข้ามการลบของเก่าทั้งหมด: ${[...teachersWithErrors].join(', ')}`);
  }

  const stale: StaleScheduleDoc[] = [];
  for (const d of existingDocs) {
    // เทียบเฉพาะภายในภาคเรียนเดียวกัน — ห้ามลบ schedule ของภาคเรียนอื่น (doc ไม่มี field ภาคเรียน = ภาคเรียนปัจจุบัน)
    if (!isScheduleInTerm(d.data, semester)) continue;
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

/**
 * ค่าที่ข้อมูลอื่นใช้อ้างถึง schedule doc หนึ่งใบ — ทั้ง id ตรงๆ (`sch_...`) และ courseId ที่ derive
 * จาก id เดียวกัน (`course_...` ดู handleImport/TeacherPortal) เพราะแต่ละ collection เก็บคนละรูปแบบ
 */
export function scheduleReferenceKeys(scheduleId: string): string[] {
  const keys = [scheduleId];
  if (scheduleId.startsWith('sch_')) keys.push(`course_${scheduleId.slice(4)}`);
  return keys;
}

/**
 * collection ที่ "ข้อมูลที่ครูบันทึกไว้" อ้างอิง schedule ผ่าน field เหล่านี้ — ก่อนลบ schedule เก่า (sync/replace)
 * ต้องไม่มีข้อมูลเหล่านี้ชี้มาที่ schedule นั้น ไม่งั้นข้อมูลจะกลายเป็นข้อมูลลอยที่ไม่มีคาบรองรับ
 * (gradebook_scores ไม่อยู่ในรายการ: คีย์ด้วย courseCode+ห้อง+ภาคเรียน ไม่ได้ผูกกับ schedule id)
 */
export const SCHEDULE_REFERENCING_COLLECTIONS: { collection: string; fields: string[] }[] = [
  { collection: 'attendance_records', fields: ['scheduleId'] },
  { collection: 'post_teaching_records', fields: ['scheduleId', 'courseId'] },
  { collection: 'late_attendance_requests', fields: ['scheduleId'] },
  { collection: 'substitute_assignments', fields: ['courseId', 'scheduleId'] },
];

/** ดึงค่าอ้างอิง (string) จาก doc ตาม field ที่กำหนด — รวมไว้ใน set เดียว */
export function collectReferenceValues(docs: Record<string, any>[], fields: string[], into: Set<string> = new Set()): Set<string> {
  for (const data of docs) {
    for (const f of fields) {
      const v = data?.[f];
      if (v !== undefined && v !== null && v !== '') into.add(String(v));
    }
  }
  return into;
}

/** แยก stale schedule เป็นลบได้ / ต้องเก็บไว้ (มีข้อมูลอื่นอ้างถึงอยู่) */
export function partitionStaleByReferences<T extends { id: string }>(
  stale: T[],
  referencedValues: Set<string>,
): { deletable: T[]; protectedDocs: T[] } {
  const deletable: T[] = [];
  const protectedDocs: T[] = [];
  for (const s of stale) {
    (scheduleReferenceKeys(s.id).some(k => referencedValues.has(k)) ? protectedDocs : deletable).push(s);
  }
  return { deletable, protectedDocs };
}
