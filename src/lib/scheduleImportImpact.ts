/**
 * ผลกระทบของการ "นำเข้าภาระงานสอนซ้ำ" (Bulk Import COURSE / Teacher Load Report) — ตรรกะบริสุทธิ์ (test ได้)
 *
 * ใช้ 3 อย่าง:
 *  1) แสดงผลที่จะเกิดขึ้นให้แอดมินอ่านก่อนกดยืนยัน (computeImportImpact)
 *  2) ตอนเปลี่ยนครูในคาบเดิม: ประวัติ "บันทึกหลังสอน" ต้องอยู่กับครูคนเดิมต่อไป และครูคนใหม่ต้องเห็นว่าครูคนเดิม
 *     สอนอะไรไว้ถึงไหนแล้ว (planRecordStamps — ประทับชื่อครูคนเดิมลงบันทึกเก่าที่ยังไม่มีผู้บันทึก)
 *  3) เก็บกวาดตารางของครูที่ "ปิดการใช้งาน" และมีครูอื่นมาสอนคาบเดียวกันแล้ว (cleanupEligible) พร้อม log ผู้บันทึกเดิม
 *
 * กติกา id: schedule doc id ของวิชาหลัก (MAIN) ไม่มีครูอยู่ใน id → คาบเดิม/ห้องเดิม/วัน-คาบเดิมที่เปลี่ยนครู
 * คือ doc เดิม (teacherIds ถูกเขียนทับ) ส่วนกิจกรรมไม่มีห้อง (ACTIVITY) มี teacherKey ใน id → เปลี่ยนครู = doc ใหม่
 * จึงต้องจับคู่ "คาบเดียวกัน" ด้วยลายเซ็น (วิชา+ห้อง+วัน+คาบ) ด้วย (slotSignature)
 */
import { isScheduleInTerm, primaryTeacherKey, scheduleDocIdFor, scheduleReferenceKeys, type ScheduleSemester } from './scheduleSyncReplace';
import { isStaffActive } from './staffStatus';

export interface StaffLite { id: string; fullName?: string; status?: unknown }

export interface ImpactDocRef { id: string; label: string }

export interface TeacherChangeItem extends ImpactDocRef {
  fromTeacherIds: string[];
  toTeacherIds: string[];
  /** ครูที่ "ออก" จากคาบนี้ (อยู่ใน doc เดิมแต่ไม่อยู่ในไฟล์ใหม่) — ประวัติของคนกลุ่มนี้ต้องถูกเก็บไว้ให้ */
  leavingTeacherIds: string[];
  leavingTeacherNames: string[];
  toTeacherNames: string[];
}

export interface CleanupItem extends ImpactDocRef {
  inactiveTeacherIds: string[];
  inactiveTeacherNames: string[];
  /** schedule doc ใหม่ในไฟล์ที่เป็นคาบเดียวกัน (ครูที่มาแทน) */
  replacementIds: string[];
}

export interface UntouchedTeacherGroup { teacher: string; docCount: number }

export interface ImportImpact {
  slotsInFile: number;
  created: number;
  unchanged: number;
  detailsChanged: number;
  /** คาบเดิมที่ได้ครูเพิ่ม/เชื่อมครูได้ใหม่ โดยไม่มีครูคนใดออก */
  teacherAdded: number;
  /** คาบเดิมที่มีครูออก (ต้องโอนประวัติ) */
  teacherChanges: TeacherChangeItem[];
  /** ครูปิดการใช้งาน + มีครูมาแทนแล้ว → เก็บกวาดได้ */
  cleanupEligible: CleanupItem[];
  /** ครูปิดการใช้งาน แต่ยังไม่มีใครมาแทนคาบนี้ในไฟล์ → ไม่ลบ แจ้งเตือน */
  inactiveNotReplaced: ImpactDocRef[];
  /** ตารางเดิมในภาคเรียนนี้ที่ไม่มีแถวตรงกันในไฟล์และไม่เข้าเงื่อนไขข้างบน → ไม่ถูกแตะ */
  untouched: UntouchedTeacherGroup[];
  untouchedTotal: number;
}

const DAY_TH: Record<string, string> = {
  monday: 'จันทร์', tuesday: 'อังคาร', wednesday: 'พุธ', thursday: 'พฤหัสบดี', friday: 'ศุกร์', saturday: 'เสาร์', sunday: 'อาทิตย์',
};

/** teacher id ทั้งหมดของ schedule doc (teacherIds + teacherId) — ไม่ซ้ำ, ตัดค่าว่าง */
export function teacherIdsOfDoc(data: Record<string, any> | null | undefined): string[] {
  const out: string[] = [];
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.trim() !== '' && !out.includes(v)) out.push(v);
  };
  if (data) {
    if (Array.isArray(data.teacherIds)) data.teacherIds.forEach(add);
    add(data.teacherId);
  }
  return out;
}

/** ลายเซ็น "คาบเดียวกัน" — วิชา + ห้อง/ชั้น + วัน + คาบ (ไม่รวมครู) */
export function slotSignature(subjectCode: unknown, room: unknown, level: unknown, dayOfWeek: unknown, periodNumber: unknown): string {
  const place = String(room || level || '').trim().toLowerCase().replace(/^m\./, 'ม.');
  return `${String(subjectCode || '').trim().toLowerCase()}|${place}|${String(dayOfWeek || '')}|${periodNumber ?? ''}`;
}

export function scheduleDocLabel(data: Record<string, any>): string {
  const day = DAY_TH[String(data.dayOfWeek || '')] || data.dayOfWeek || '';
  return `${data.subjectCode || data.courseCode || '?'}${data.subjectType === 'ACTIVITY' ? ' (กิจกรรม)' : ''} · ห้อง ${data.room || data.level || '?'} · ${day} คาบ ${data.periodNumber ?? '?'}`;
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every(x => b.includes(x));
}

interface TargetSlot {
  id: string;
  subjectCode: string; subjectName: string; room: string; level: string; department: string;
  credits: number; subjectType: string; dayOfWeek: string; periodNumber: number;
  teacherIds: string[];
}

/** schedule ที่ "จะถูกเขียน" จากแถวที่ผ่านตรวจในไฟล์ — สูตร id/การรวมครูตรงกับ handleConfirmImport */
export function buildTargetSlots(
  loadRows: { isValid: boolean; parsedData: Record<string, any> }[],
  semester: ScheduleSemester,
): Map<string, TargetSlot> {
  const targets = new Map<string, TargetSlot>();
  for (const r of loadRows) {
    if (!r.isValid) continue;
    const p = r.parsedData;
    if (!p?.isTeacherLoadReport) continue;
    const teacherKey = primaryTeacherKey(p);
    for (const slot of (p.slots || [])) {
      const id = scheduleDocIdFor(p.subjectCode, p.room, p.level, slot.dayOfWeek, slot.periodNumber, p.subjectType, teacherKey, semester);
      const t = targets.get(id) || {
        id,
        subjectCode: p.subjectCode, subjectName: p.subjectName || '', room: p.room || '', level: p.level || '',
        department: p.department || '', credits: Number(p.credits || 1.5), subjectType: p.subjectType || 'MAIN',
        dayOfWeek: slot.dayOfWeek, periodNumber: slot.periodNumber, teacherIds: [],
      };
      if (p.matchedTeacherId && !t.teacherIds.includes(p.matchedTeacherId)) t.teacherIds.push(p.matchedTeacherId);
      targets.set(id, t);
    }
  }
  return targets;
}

export function computeImportImpact(
  loadRows: { isValid: boolean; parsedData: Record<string, any> }[],
  existingDocs: { id: string; data: Record<string, any> }[],
  semester: ScheduleSemester,
  staff: StaffLite[],
  /** id ของ schedule ที่ sync/replace (computeSyncReplacePlan) จะลบอยู่แล้ว — ไม่นับซ้ำ */
  syncReplaceStaleIds: Iterable<string> = [],
): ImportImpact {
  const staffById = new Map(staff.map(s => [s.id, s]));
  const nameOf = (id: string) => staffById.get(id)?.fullName || id;
  const targets = buildTargetSlots(loadRows, semester);
  const inTerm = existingDocs.filter(d => isScheduleInTerm(d.data, semester));
  const existingById = new Map(inTerm.map(d => [d.id, d]));

  let created = 0, unchanged = 0, detailsChanged = 0, teacherAdded = 0;
  const teacherChanges: TeacherChangeItem[] = [];

  for (const t of targets.values()) {
    const ex = existingById.get(t.id);
    if (!ex) { created++; continue; }
    const fromIds = teacherIdsOfDoc(ex.data);
    const toIds = t.teacherIds;
    if (!sameSet(fromIds, toIds)) {
      const leaving = fromIds.filter(id => !toIds.includes(id));
      if (leaving.length > 0) {
        teacherChanges.push({
          id: t.id,
          label: scheduleDocLabel(ex.data),
          fromTeacherIds: fromIds,
          toTeacherIds: toIds,
          leavingTeacherIds: leaving,
          leavingTeacherNames: leaving.map(nameOf),
          toTeacherNames: toIds.map(nameOf),
        });
      } else {
        teacherAdded++;
      }
      continue;
    }
    const d = ex.data;
    const differs =
      String(d.subjectName || '') !== t.subjectName ||
      String(d.department || '') !== t.department ||
      Number(d.credits ?? 1.5) !== t.credits ||
      String(d.subjectType || 'MAIN') !== t.subjectType;
    if (differs) detailsChanged++; else unchanged++;
  }

  const targetSigs = new Map<string, string[]>();
  for (const t of targets.values()) {
    const sig = slotSignature(t.subjectCode, t.room, t.level, t.dayOfWeek, t.periodNumber);
    targetSigs.set(sig, [...(targetSigs.get(sig) || []), t.id]);
  }

  const staleIds = new Set(syncReplaceStaleIds);
  const cleanupEligible: CleanupItem[] = [];
  const inactiveNotReplaced: ImpactDocRef[] = [];
  const untouchedByTeacher = new Map<string, number>();
  let untouchedTotal = 0;

  for (const d of inTerm) {
    if (targets.has(d.id) || staleIds.has(d.id)) continue;
    const docTeachers = teacherIdsOfDoc(d.data);
    const allInactive = docTeachers.length > 0 &&
      docTeachers.every(id => staffById.has(id) && !isStaffActive(staffById.get(id)));
    if (allInactive) {
      const replacement = targetSigs.get(slotSignature(d.data.subjectCode ?? d.data.courseCode, d.data.room, d.data.level, d.data.dayOfWeek, d.data.periodNumber)) || [];
      if (replacement.length > 0) {
        cleanupEligible.push({
          id: d.id, label: scheduleDocLabel(d.data),
          inactiveTeacherIds: docTeachers, inactiveTeacherNames: docTeachers.map(nameOf),
          replacementIds: replacement,
        });
      } else {
        inactiveNotReplaced.push({ id: d.id, label: scheduleDocLabel(d.data) });
      }
      continue;
    }
    const who = docTeachers.length > 0
      ? docTeachers.map(nameOf).join(', ')
      : String(d.data.sourceTeacherName || d.data.unlinkedTeacherName || 'ไม่ระบุครู');
    untouchedByTeacher.set(who, (untouchedByTeacher.get(who) || 0) + 1);
    untouchedTotal++;
  }

  return {
    slotsInFile: targets.size,
    created, unchanged, detailsChanged, teacherAdded,
    teacherChanges,
    cleanupEligible,
    inactiveNotReplaced,
    untouched: [...untouchedByTeacher.entries()]
      .map(([teacher, docCount]) => ({ teacher, docCount }))
      .sort((a, b) => b.docCount - a.docCount),
    untouchedTotal,
  };
}

/* ───────────── ประวัติบันทึกหลังสอน: ประทับผู้บันทึกเดิม ───────────── */

export interface RecordStampRequest {
  scheduleId: string;
  leavingTeacherIds: string[];
  leavingTeacherNames: string[];
}

export interface RecordStamp {
  recordDocId: string;
  scheduleId: string;
  patch: { previousTeacherStaffIds: string[]; previousTeacherNames: string[] };
}

/** บันทึกนี้รู้ตัวผู้บันทึกแล้วหรือยัง (บันทึกใหม่มี recordedByStaffId, บันทึกที่เคยประทับแล้วมี previousTeacherStaffIds) */
export function recordHasAuthor(data: Record<string, any>): boolean {
  return (typeof data.recordedByStaffId === 'string' && data.recordedByStaffId !== '') ||
    (Array.isArray(data.previousTeacherStaffIds) && data.previousTeacherStaffIds.length > 0);
}

/**
 * หาบันทึกหลังสอนของคาบที่เปลี่ยนครู/ถูกเก็บกวาด ที่ "ยังไม่มีผู้บันทึก" แล้วสร้างคำสั่งประทับชื่อครูคนเดิม
 * (ไม่แตะบันทึกที่รู้ผู้บันทึกอยู่แล้ว — ห้ามเดาทับ, ไม่แก้เนื้อหา summary/problems/solutions)
 * จับคู่ด้วย courseId (`course_...`) หรือ scheduleId (`sch_...`) ที่ derive จาก schedule id เดียวกัน
 */
export function planRecordStamps(
  records: { id: string; data: Record<string, any> }[],
  requests: RecordStampRequest[],
): RecordStamp[] {
  const byRef = new Map<string, RecordStampRequest>();
  for (const req of requests) {
    if (req.leavingTeacherIds.length === 0) continue;
    for (const k of scheduleReferenceKeys(req.scheduleId)) byRef.set(k, req);
  }
  const out: RecordStamp[] = [];
  for (const r of records) {
    if (recordHasAuthor(r.data)) continue;
    // บันทึกที่เกิดจากการสอนแทน (store.completeSubstituteAssignment) ผู้เขียนคือครูสอนแทน ไม่ใช่เจ้าของคาบ — ไม่ประทับทับ
    if (String(r.data.summary || '').startsWith('[ปฏิบัติหน้าที่สอนแทน')) continue;
    const req = (r.data.scheduleId && byRef.get(String(r.data.scheduleId))) || (r.data.courseId && byRef.get(String(r.data.courseId)));
    if (!req) continue;
    out.push({
      recordDocId: r.id,
      scheduleId: req.scheduleId,
      patch: { previousTeacherStaffIds: [...req.leavingTeacherIds], previousTeacherNames: [...req.leavingTeacherNames] },
    });
  }
  return out;
}

export interface RecordAuthorSummary { staffId: string; name: string; count: number }

/** ใครเป็นผู้บันทึกบันทึกหลังสอนเหล่านี้ (ใช้ใน log) — ใช้ผู้บันทึกจริงก่อน แล้วค่อยครูที่ประทับไว้ */
export function summarizeRecordAuthors(records: Record<string, any>[]): RecordAuthorSummary[] {
  const acc = new Map<string, RecordAuthorSummary>();
  const bump = (staffId: string, name: string) => {
    const cur = acc.get(staffId);
    if (cur) { cur.count++; if (!cur.name && name) cur.name = name; } else acc.set(staffId, { staffId, name, count: 1 });
  };
  for (const r of records) {
    if (typeof r.recordedByStaffId === 'string' && r.recordedByStaffId) {
      bump(r.recordedByStaffId, String(r.recordedByName || ''));
    } else if (Array.isArray(r.previousTeacherStaffIds)) {
      r.previousTeacherStaffIds.forEach((id: string, i: number) => bump(String(id), String(r.previousTeacherNames?.[i] || '')));
    }
  }
  return [...acc.values()].sort((a, b) => b.count - a.count);
}

/* ───────────── ยืนยันรายการที่ได้รับผลกระทบ (แอดมินตรวจทีละรายการหรือยืนยันทั้งหมด) ───────────── */

/** คีย์ของรายการที่แอดมินต้องยืนยันก่อนนำเข้า: เปลี่ยนครู (โอนประวัติ) และเก็บกวาด (ลบตารางครูที่ปิดการใช้งาน) */
export function reviewKeysOf(impact: Pick<ImportImpact, 'teacherChanges' | 'cleanupEligible'>): string[] {
  return [
    ...impact.teacherChanges.map(c => `change:${c.id}`),
    ...impact.cleanupEligible.map(c => `cleanup:${c.id}`),
  ];
}

/** ยืนยันครบทุกรายการแล้วหรือยัง (ไม่มีรายการให้ยืนยัน = ผ่าน) */
export function isImpactFullyConfirmed(
  impact: Pick<ImportImpact, 'teacherChanges' | 'cleanupEligible'>,
  confirmed: ReadonlySet<string>,
): boolean {
  return reviewKeysOf(impact).every(k => confirmed.has(k));
}

/* ───────────── log ───────────── */

export function capList<T>(items: T[], max: number): { items: T[]; truncated: boolean; total: number } {
  return { items: items.slice(0, max), truncated: items.length > max, total: items.length };
}
