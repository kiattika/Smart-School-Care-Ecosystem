/**
 * งานหลังเขียนตารางสอนจากไฟล์ภาระงานสอน (Bulk Import COURSE) — ส่วนที่ต้องคุยกับ Firestore
 * ตรรกะตัดสินใจอยู่ใน scheduleImportImpact.ts (บริสุทธิ์ + มี test) ไฟล์นี้แค่เอาแผนไปลงมือ
 *
 *  1) โอนประวัติ: ประทับชื่อครูคนเดิมลงบันทึกหลังสอนเก่าของคาบที่เปลี่ยนครู (ไม่แก้เนื้อหาบันทึก)
 *  2) เก็บกวาด: ลบตารางของครูที่ปิดการใช้งานและมีครูมาแทนคาบเดียวกันแล้ว — ประทับชื่อผู้บันทึกก่อนลบเสมอ
 *     (fail-closed: ประทับไม่สำเร็จ = ไม่ลบอะไรเลย)
 *  3) log: schedule_import_logs (เพิ่มอย่างเดียว แก้/ลบไม่ได้) บอกว่าใครนำเข้า เปลี่ยน/ลบอะไร และใครเคยเป็นผู้บันทึก
 */
import { collection, doc, getDocs, serverTimestamp, setDoc, writeBatch, type Firestore } from 'firebase/firestore';
import {
  capList, planRecordStamps, summarizeRecordAuthors,
  type ImportImpact, type RecordAuthorSummary, type RecordStampRequest,
} from './scheduleImportImpact';
import { scheduleReferenceKeys, type ScheduleSemester } from './scheduleSyncReplace';

export const IMPORT_LOG_COLLECTION = 'schedule_import_logs';
const BATCH = 450;
const LOG_LIST_CAP = 300;

export interface CleanupResult {
  scheduleId: string;
  label: string;
  inactiveTeacherIds: string[];
  inactiveTeacherNames: string[];
  replacementIds: string[];
  referencingRecords: { post_teaching_records: number; late_attendance_requests: number; substitute_assignments: number };
  recordAuthors: RecordAuthorSummary[];
}

export interface AftercareResult {
  /** จำนวนบันทึกหลังสอนที่ประทับชื่อครูคนเดิม ต่อ schedule id */
  stampedBySchedule: Record<string, number>;
  cleaned: CleanupResult[];
  errors: string[];
}

async function readAll(db: Firestore, name: string): Promise<{ id: string; data: Record<string, any> }[]> {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, any> }));
}

export async function applyHandoverAndCleanup(db: Firestore, impact: ImportImpact): Promise<AftercareResult> {
  const result: AftercareResult = { stampedBySchedule: {}, cleaned: [], errors: [] };
  if (impact.teacherChanges.length === 0 && impact.cleanupEligible.length === 0) return result;

  const requests: RecordStampRequest[] = [
    ...impact.teacherChanges.map(c => ({ scheduleId: c.id, leavingTeacherIds: c.leavingTeacherIds, leavingTeacherNames: c.leavingTeacherNames })),
    ...impact.cleanupEligible.map(c => ({ scheduleId: c.id, leavingTeacherIds: c.inactiveTeacherIds, leavingTeacherNames: c.inactiveTeacherNames })),
  ];

  // 1) ประทับชื่อครูคนเดิม
  let records: { id: string; data: Record<string, any> }[] = [];
  let stampOk = true;
  try {
    records = await readAll(db, 'post_teaching_records');
    const stamps = planRecordStamps(records, requests);
    for (let i = 0; i < stamps.length; i += BATCH) {
      const batch = writeBatch(db);
      for (const s of stamps.slice(i, i + BATCH)) {
        batch.update(doc(db, 'post_teaching_records', s.recordDocId), s.patch);
      }
      await batch.commit();
    }
    const byId = new Map(records.map(r => [r.id, r]));
    for (const s of stamps) {
      result.stampedBySchedule[s.scheduleId] = (result.stampedBySchedule[s.scheduleId] || 0) + 1;
      const r = byId.get(s.recordDocId);
      if (r) r.data = { ...r.data, ...s.patch }; // มุมมองหลังประทับ ใช้สรุปผู้บันทึกใน log
    }
  } catch (err) {
    stampOk = false;
    result.errors.push(`ประทับชื่อครูคนเดิมในบันทึกหลังสอนไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2) เก็บกวาด — ต้องประทับสำเร็จก่อนเท่านั้น
  if (impact.cleanupEligible.length > 0) {
    if (!stampOk) {
      result.errors.push('ข้ามการเก็บกวาดตารางของครูที่ปิดการใช้งานทั้งหมด เพราะประทับชื่อผู้บันทึกเดิมไม่สำเร็จ (ยังไม่มีการลบใดๆ)');
      return result;
    }
    try {
      const [lateReqs, subs] = await Promise.all([readAll(db, 'late_attendance_requests'), readAll(db, 'substitute_assignments')]);
      const countRefs = (rows: { data: Record<string, any> }[], keys: string[], fields: string[]) =>
        rows.filter(r => fields.some(f => r.data[f] !== undefined && keys.includes(String(r.data[f])))).length;

      for (const c of impact.cleanupEligible) {
        const keys = scheduleReferenceKeys(c.id);
        const related = records.filter(r => keys.includes(String(r.data.scheduleId)) || keys.includes(String(r.data.courseId)));
        result.cleaned.push({
          scheduleId: c.id,
          label: c.label,
          inactiveTeacherIds: c.inactiveTeacherIds,
          inactiveTeacherNames: c.inactiveTeacherNames,
          replacementIds: c.replacementIds,
          referencingRecords: {
            post_teaching_records: related.length,
            late_attendance_requests: countRefs(lateReqs, keys, ['scheduleId']),
            substitute_assignments: countRefs(subs, keys, ['courseId', 'scheduleId']),
          },
          recordAuthors: summarizeRecordAuthors(related.map(r => r.data)),
        });
      }

      const ids = impact.cleanupEligible.map(c => c.id);
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = writeBatch(db);
        ids.slice(i, i + BATCH).forEach(id => batch.delete(doc(db, 'schedules', id)));
        await batch.commit();
      }
    } catch (err) {
      result.cleaned = [];
      result.errors.push(`เก็บกวาดตารางของครูที่ปิดการใช้งานไม่สำเร็จ (อาจลบไปบางส่วน ตรวจสอบจาก log): ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return result;
}

export interface ImportLogInput {
  actor: { uid: string; staffId?: string | null; email?: string | null; name?: string | null };
  semester: ScheduleSemester;
  fileName?: string;
  rowsValid: number;
  impact: ImportImpact;
  aftercare: AftercareResult;
  confirmedItemCount: number;
  syncReplace: { enabled: boolean; deleted: { id: string; label: string }[]; protectedDocs: { id: string; label: string }[] };
}

/** เขียน log การนำเข้า — คืน id ของ log (เขียนไม่สำเร็จจะ throw ให้ผู้เรียกแจ้งแอดมิน) */
export async function writeImportLog(db: Firestore, input: ImportLogInput): Promise<string> {
  const { impact, aftercare, syncReplace } = input;
  const ref = doc(collection(db, IMPORT_LOG_COLLECTION));
  const teacherChanges = capList(impact.teacherChanges.map(c => ({
    scheduleId: c.id, label: c.label,
    fromTeacherIds: c.fromTeacherIds, toTeacherIds: c.toTeacherIds,
    leavingTeacherNames: c.leavingTeacherNames, toTeacherNames: c.toTeacherNames,
    recordsStamped: aftercare.stampedBySchedule[c.id] || 0,
  })), LOG_LIST_CAP);
  const cleaned = capList(aftercare.cleaned, LOG_LIST_CAP);
  const syncDeleted = capList(syncReplace.deleted, LOG_LIST_CAP);
  const syncProtected = capList(syncReplace.protectedDocs, LOG_LIST_CAP);

  await setDoc(ref, {
    type: 'TEACHING_LOAD_IMPORT',
    createdAt: serverTimestamp(),
    importedByUid: input.actor.uid,
    importedByStaffId: input.actor.staffId || null,
    importedByEmail: input.actor.email || null,
    importedByName: input.actor.name || null,
    academicYear: input.semester.academicYear,
    term: input.semester.term,
    fileName: input.fileName || null,
    rowsValid: input.rowsValid,
    slotsInFile: impact.slotsInFile,
    created: impact.created,
    unchanged: impact.unchanged,
    detailsChanged: impact.detailsChanged,
    teacherAdded: impact.teacherAdded,
    adminConfirmedItems: input.confirmedItemCount,
    teacherChanges: teacherChanges.items,
    teacherChangesTotal: teacherChanges.total,
    cleanedSchedules: cleaned.items,
    cleanedSchedulesTotal: cleaned.total,
    inactiveNotReplaced: capList(impact.inactiveNotReplaced, LOG_LIST_CAP).items,
    inactiveNotReplacedTotal: impact.inactiveNotReplaced.length,
    syncReplaceEnabled: syncReplace.enabled,
    syncReplaceDeleted: syncDeleted.items,
    syncReplaceDeletedTotal: syncDeleted.total,
    syncReplaceProtected: syncProtected.items,
    syncReplaceProtectedTotal: syncProtected.total,
    errors: aftercare.errors,
  });
  return ref.id;
}
