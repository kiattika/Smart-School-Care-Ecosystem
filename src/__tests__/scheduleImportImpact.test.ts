import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';
import { scheduleDocIdFor, computeSyncReplacePlan, type ScheduleSemester } from '../lib/scheduleSyncReplace';
import {
  computeImportImpact, planRecordStamps, summarizeRecordAuthors, recordHasAuthor,
  reviewKeysOf, isImpactFullyConfirmed, slotSignature, teacherIdsOfDoc, capList,
  type StaffLite,
} from '../lib/scheduleImportImpact';
import { canViewPostTeachingRecord, postTeachingAuthorNote } from '../lib/postTeachingVisibility';

const SEM: ScheduleSemester = { academicYear: '2569', term: '1' };

const STAFF: StaffLite[] = [
  { id: 'tch-old', fullName: 'ครูเก่า ใจดี', status: 'INACTIVE' },
  { id: 'tch-new', fullName: 'ครูใหม่ มาแทน', status: 'ACTIVE' },
  { id: 'tch-b', fullName: 'ครูบี', status: '' },
  { id: 'tch-gone', fullName: 'ครูที่ปิดแล้ว', status: 'INACTIVE' },
];

/** แถว teacher-load-report แบบย่อ (วิชาหลัก ม.5/8 ห้อง 943 จันทร์ คาบ 6) */
const row = (over: Record<string, any> = {}, isValid = true) => ({
  isValid,
  parsedData: {
    isTeacherLoadReport: true,
    subjectCode: 'ค32101', subjectName: 'คณิตศาสตร์พื้นฐาน', room: '943', level: 'M.5/8', department: 'คณิตศาสตร์',
    subjectType: 'MAIN', teacherName: 'ครูใหม่', matchedTeacherId: 'tch-new', matchedTeacherEmail: 'new@utd.ac.th',
    slots: [{ dayOfWeek: 'monday', periodNumber: 6 }],
    ...over,
  },
});

const mainId = scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', undefined, SEM);

const existingMain = (teacherIds: string[], over: Record<string, any> = {}) => ({
  id: mainId,
  data: {
    academicYear: '2569', term: '1',
    subjectCode: 'ค32101', subjectName: 'คณิตศาสตร์พื้นฐาน', room: '943', level: 'M.5/8', department: 'คณิตศาสตร์',
    subjectType: 'MAIN', dayOfWeek: 'monday', periodNumber: 6, credits: 1.5,
    teacherId: teacherIds[0] ?? null, teacherIds, ...over,
  },
});

describe('computeImportImpact — ผลของการนำเข้าซ้ำ', () => {
  it('ไฟล์เดิมซ้ำ (ครูเดิม ข้อมูลเดิม) → ไม่เปลี่ยนแปลง ไม่มีรายการให้ยืนยัน', () => {
    const impact = computeImportImpact([row()], [existingMain(['tch-new'])], SEM, STAFF);
    expect(impact).toMatchObject({ slotsInFile: 1, created: 0, unchanged: 1, detailsChanged: 0, teacherAdded: 0 });
    expect(impact.teacherChanges).toEqual([]);
    expect(reviewKeysOf(impact)).toEqual([]);
    expect(isImpactFullyConfirmed(impact, new Set())).toBe(true); // ไม่มีรายการ = ผ่าน
  });

  it('คาบใหม่ที่ไม่เคยมี → นับเป็น created', () => {
    const impact = computeImportImpact([row()], [], SEM, STAFF);
    expect(impact.created).toBe(1);
    expect(impact.unchanged).toBe(0);
  });

  it('ชื่อวิชา/กลุ่มสาระเปลี่ยนแต่ครูเดิม → detailsChanged', () => {
    const impact = computeImportImpact([row({ subjectName: 'คณิตศาสตร์เพิ่มเติม' })], [existingMain(['tch-new'])], SEM, STAFF);
    expect(impact.detailsChanged).toBe(1);
    expect(impact.unchanged).toBe(0);
  });

  it('เปลี่ยนครูในคาบเดิม (MAIN id เดิม) → teacherChanges พร้อมชื่อครูที่ออก/ครูใหม่ และต้องยืนยัน', () => {
    const impact = computeImportImpact([row()], [existingMain(['tch-old'])], SEM, STAFF);
    expect(impact.teacherChanges).toHaveLength(1);
    const c = impact.teacherChanges[0];
    expect(c.id).toBe(mainId);
    expect(c.leavingTeacherIds).toEqual(['tch-old']);
    expect(c.leavingTeacherNames).toEqual(['ครูเก่า ใจดี']);
    expect(c.toTeacherNames).toEqual(['ครูใหม่ มาแทน']);
    expect(c.label).toContain('ค32101');
    expect(reviewKeysOf(impact)).toEqual([`change:${mainId}`]);
  });

  it('ได้ครูร่วมสอนเพิ่มโดยไม่มีใครออก → teacherAdded ไม่ใช่ teacherChanges (ไม่ต้องโอนประวัติ)', () => {
    const impact = computeImportImpact(
      [row(), row({ matchedTeacherId: 'tch-b' })], [existingMain(['tch-new'])], SEM, STAFF,
    );
    expect(impact.teacherAdded).toBe(1);
    expect(impact.teacherChanges).toEqual([]);
  });

  it('แถวที่ไม่ผ่านตรวจ (isValid=false) ไม่ถูกนับเป็นคาบในไฟล์', () => {
    const impact = computeImportImpact([row({}, false)], [existingMain(['tch-new'])], SEM, STAFF);
    expect(impact.slotsInFile).toBe(0);
  });

  it('เปลี่ยนภาคเรียน: schedule ของภาคเรียนอื่นไม่ถูกนับเลย', () => {
    const otherTerm = { ...existingMain(['tch-old']), data: { ...existingMain(['tch-old']).data, term: '2' } };
    const impact = computeImportImpact([row()], [otherTerm], SEM, STAFF);
    expect(impact.teacherChanges).toEqual([]);
    expect(impact.cleanupEligible).toEqual([]);
    expect(impact.untouchedTotal).toBe(0);
  });

  describe('เก็บกวาดตารางของครูที่ปิดการใช้งาน', () => {
    const plcOldId = scheduleDocIdFor('PLC', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'tch-old', SEM);
    const plcOldDoc = {
      id: plcOldId,
      data: {
        academicYear: '2569', term: '1', subjectCode: 'PLC', room: '', level: 'Non-Student', subjectType: 'ACTIVITY',
        dayOfWeek: 'wednesday', periodNumber: 8, teacherId: 'tch-old', teacherIds: ['tch-old'],
      },
    };
    const plcNewRow = row({
      subjectCode: 'PLC', subjectName: 'PLC', room: '', level: 'Non-Student', subjectType: 'ACTIVITY',
      matchedTeacherId: 'tch-new', slots: [{ dayOfWeek: 'wednesday', periodNumber: 8 }],
    });

    it('ครูปิดการใช้งาน + มีครูอื่นรับคาบเดียวกัน (กิจกรรมที่ id ต่างกันเพราะฝัง teacherKey) → cleanupEligible', () => {
      const impact = computeImportImpact([plcNewRow], [plcOldDoc], SEM, STAFF);
      expect(impact.cleanupEligible).toHaveLength(1);
      expect(impact.cleanupEligible[0]).toMatchObject({ id: plcOldId, inactiveTeacherIds: ['tch-old'], inactiveTeacherNames: ['ครูเก่า ใจดี'] });
      expect(impact.cleanupEligible[0].replacementIds).toHaveLength(1);
      expect(impact.inactiveNotReplaced).toEqual([]);
      expect(reviewKeysOf(impact)).toEqual([`cleanup:${plcOldId}`]);
    });

    it('ครูปิดการใช้งานแต่ยังไม่มีใครมาแทนคาบนี้ในไฟล์ → ไม่ลบ แจ้งเตือน (inactiveNotReplaced)', () => {
      const impact = computeImportImpact([row()], [plcOldDoc], SEM, STAFF);
      expect(impact.cleanupEligible).toEqual([]);
      expect(impact.inactiveNotReplaced.map(s => s.id)).toEqual([plcOldId]);
    });

    it('ครูที่ยัง ACTIVE แต่ไม่มีแถวในไฟล์ → ไม่ถูกแตะ (untouched) แม้มีคนรับคาบเดียวกัน', () => {
      const activeDoc = { id: plcOldId, data: { ...plcOldDoc.data, teacherId: 'tch-b', teacherIds: ['tch-b'] } };
      const impact = computeImportImpact([plcNewRow], [activeDoc], SEM, STAFF);
      expect(impact.cleanupEligible).toEqual([]);
      expect(impact.untouchedTotal).toBe(1);
      expect(impact.untouched[0]).toEqual({ teacher: 'ครูบี', docCount: 1 });
    });

    it('ต้องปิดการใช้งาน "ทุกคน" ในตาราง — ถ้ามีครูร่วมที่ยัง ACTIVE ไม่เก็บกวาด', () => {
      const mixed = { id: plcOldId, data: { ...plcOldDoc.data, teacherIds: ['tch-old', 'tch-b'] } };
      const impact = computeImportImpact([plcNewRow], [mixed], SEM, STAFF);
      expect(impact.cleanupEligible).toEqual([]);
      expect(impact.untouchedTotal).toBe(1);
    });

    it('ตารางที่ไม่ผูกครู (unlinked) ไม่ถูกเก็บกวาด', () => {
      const unlinked = { id: plcOldId, data: { ...plcOldDoc.data, teacherId: null, teacherIds: [], unlinkedTeacherName: 'ครูคนหนึ่ง' } };
      const impact = computeImportImpact([plcNewRow], [unlinked], SEM, STAFF);
      expect(impact.cleanupEligible).toEqual([]);
      expect(impact.untouched[0].teacher).toBe('ครูคนหนึ่ง');
    });

    it('doc ที่ sync/replace จะลบอยู่แล้วไม่ถูกนับซ้ำเป็นเก็บกวาด', () => {
      const impact = computeImportImpact([plcNewRow], [plcOldDoc], SEM, STAFF, [plcOldId]);
      expect(impact.cleanupEligible).toEqual([]);
      expect(impact.untouchedTotal).toBe(0);
    });

    it('ใช้ร่วมกับ computeSyncReplacePlan จริงได้ (ครู INACTIVE ไม่อยู่ในไฟล์ → ไม่อยู่ใน plan.stale แต่เข้าเก็บกวาด)', () => {
      const plan = computeSyncReplacePlan([plcNewRow], [plcOldDoc], SEM);
      expect(plan.stale).toEqual([]);
      const impact = computeImportImpact([plcNewRow], [plcOldDoc], SEM, STAFF, plan.stale.map(s => s.id));
      expect(impact.cleanupEligible).toHaveLength(1);
    });
  });
});

describe('ยืนยันรายการที่ได้รับผลกระทบ (ทีละรายการ / ทั้งหมด)', () => {
  const impact = computeImportImpact([row()], [existingMain(['tch-old'])], SEM, STAFF);

  it('ยังไม่ยืนยัน = ยังไม่ผ่าน, ยืนยันครบ = ผ่าน, ยืนยันไม่ครบ = ไม่ผ่าน', () => {
    expect(isImpactFullyConfirmed(impact, new Set())).toBe(false);
    expect(isImpactFullyConfirmed(impact, new Set(['change:อื่น']))).toBe(false);
    expect(isImpactFullyConfirmed(impact, new Set(reviewKeysOf(impact)))).toBe(true);
  });

  it('หลายรายการ: ต้องยืนยันครบทุกรายการ', () => {
    const plcOld = scheduleDocIdFor('PLC', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'tch-gone', SEM);
    const both = computeImportImpact(
      [row(), row({ subjectCode: 'PLC', room: '', level: 'Non-Student', subjectType: 'ACTIVITY', slots: [{ dayOfWeek: 'wednesday', periodNumber: 8 }] })],
      [existingMain(['tch-old']), { id: plcOld, data: { academicYear: '2569', term: '1', subjectCode: 'PLC', room: '', level: 'Non-Student', subjectType: 'ACTIVITY', dayOfWeek: 'wednesday', periodNumber: 8, teacherId: 'tch-gone', teacherIds: ['tch-gone'] } }],
      SEM, STAFF,
    );
    expect(reviewKeysOf(both)).toHaveLength(2);
    expect(isImpactFullyConfirmed(both, new Set([reviewKeysOf(both)[0]]))).toBe(false);
    expect(isImpactFullyConfirmed(both, new Set(reviewKeysOf(both)))).toBe(true);
  });
});

describe('planRecordStamps — ประทับชื่อครูคนเดิมในบันทึกหลังสอน', () => {
  const courseId = `course_${mainId.slice(4)}`;
  const req = [{ scheduleId: mainId, leavingTeacherIds: ['tch-old'], leavingTeacherNames: ['ครูเก่า ใจดี'] }];

  it('บันทึกของคาบที่ยังไม่มีผู้บันทึก (อ้างด้วย courseId) → ประทับครูคนเดิม', () => {
    const stamps = planRecordStamps([{ id: `${courseId}_2026-09-01`, data: { courseId, date: '2026-09-01', summary: 'สอนบทที่ 1' } }], req);
    expect(stamps).toEqual([{
      recordDocId: `${courseId}_2026-09-01`, scheduleId: mainId,
      patch: { previousTeacherStaffIds: ['tch-old'], previousTeacherNames: ['ครูเก่า ใจดี'] },
    }]);
  });

  it('อ้างด้วย scheduleId (รูป sch_...) ก็จับคู่ได้', () => {
    expect(planRecordStamps([{ id: 'r1', data: { scheduleId: mainId, summary: 'x' } }], req)).toHaveLength(1);
  });

  it('ไม่ประทับทับบันทึกที่รู้ผู้บันทึกอยู่แล้ว (recordedByStaffId หรือเคยประทับแล้ว)', () => {
    const stamps = planRecordStamps([
      { id: 'a', data: { courseId, recordedByStaffId: 'tch-someone', summary: 'x' } },
      { id: 'b', data: { courseId, previousTeacherStaffIds: ['tch-earlier'], summary: 'x' } },
    ], req);
    expect(stamps).toEqual([]);
  });

  it('ไม่ประทับบันทึกที่เกิดจากการสอนแทน (ผู้เขียนคือครูสอนแทน ไม่ใช่เจ้าของคาบ)', () => {
    const stamps = planRecordStamps([{ id: 's', data: { courseId, summary: '[ปฏิบัติหน้าที่สอนแทน ครูเก่า โดย ครูบี] สอนแทนแล้ว' } }], req);
    expect(stamps).toEqual([]);
  });

  it('ไม่ประทับบันทึกของคาบอื่น และข้ามคำขอที่ไม่มีครูออก', () => {
    expect(planRecordStamps([{ id: 'o', data: { courseId: 'course_อื่น', summary: 'x' } }], req)).toEqual([]);
    expect(planRecordStamps([{ id: 'r', data: { courseId, summary: 'x' } }], [{ scheduleId: mainId, leavingTeacherIds: [], leavingTeacherNames: [] }])).toEqual([]);
  });

  it('recordHasAuthor', () => {
    expect(recordHasAuthor({ recordedByStaffId: 't' })).toBe(true);
    expect(recordHasAuthor({ previousTeacherStaffIds: ['t'] })).toBe(true);
    expect(recordHasAuthor({ previousTeacherStaffIds: [] })).toBe(false);
    expect(recordHasAuthor({})).toBe(false);
  });
});

describe('summarizeRecordAuthors / ตัวช่วยอื่น', () => {
  it('นับผู้บันทึกจริงก่อน แล้วค่อยครูที่ประทับไว้', () => {
    const authors = summarizeRecordAuthors([
      { recordedByStaffId: 'tch-a', recordedByName: 'ครูเอ' },
      { recordedByStaffId: 'tch-a', recordedByName: 'ครูเอ' },
      { previousTeacherStaffIds: ['tch-old'], previousTeacherNames: ['ครูเก่า ใจดี'] },
      { summary: 'ไม่มีผู้บันทึก' },
    ]);
    expect(authors).toEqual([
      { staffId: 'tch-a', name: 'ครูเอ', count: 2 },
      { staffId: 'tch-old', name: 'ครูเก่า ใจดี', count: 1 },
    ]);
  });

  it('teacherIdsOfDoc รวม teacherIds + teacherId ไม่ซ้ำ ตัดค่าว่าง', () => {
    expect(teacherIdsOfDoc({ teacherIds: ['a', 'b'], teacherId: 'a' })).toEqual(['a', 'b']);
    expect(teacherIdsOfDoc({ teacherId: 'z' })).toEqual(['z']);
    expect(teacherIdsOfDoc({ teacherIds: ['', 'x'], teacherId: null })).toEqual(['x']);
    expect(teacherIdsOfDoc(null)).toEqual([]);
  });

  it('slotSignature ไม่สนใจ M./ม. และตัวพิมพ์', () => {
    expect(slotSignature('ค32101', '', 'M.5/8', 'monday', 6)).toBe(slotSignature('ค32101', '', 'ม.5/8', 'monday', 6));
  });

  it('capList ตัดรายการและบอกว่าถูกตัด', () => {
    expect(capList([1, 2, 3], 2)).toEqual({ items: [1, 2], truncated: true, total: 3 });
    expect(capList([1], 2)).toEqual({ items: [1], truncated: false, total: 1 });
  });
});

describe('postTeachingVisibility — ประวัติอยู่กับครูคนเดิม และครูใหม่เห็นพร้อมป้ายผู้บันทึก', () => {
  const courseId = `course_${mainId.slice(4)}`;
  const oldTeacher = { staffId: 'tch-old' };
  const newTeacher = { staffId: 'tch-new' };
  const outsider = { staffId: 'tch-x' };
  const noStaff = {};
  const stamped = { courseId, previousTeacherStaffIds: ['tch-old'], previousTeacherNames: ['ครูเก่า ใจดี'] };
  const authored = { courseId, recordedByStaffId: 'tch-old', recordedByName: 'ครูเก่า ใจดี' };
  const newTeacherCourses = new Set([courseId]);
  const oldTeacherCourses = new Set<string>(); // ไม่ได้สอนคาบนี้แล้ว

  it('ครูคนเดิมยังเห็นบันทึกที่ถูกประทับ/ที่ตัวเองบันทึก แม้ไม่ได้สอนคาบนี้แล้ว', () => {
    expect(canViewPostTeachingRecord(oldTeacher, stamped, oldTeacherCourses)).toBe(true);
    expect(canViewPostTeachingRecord(oldTeacher, authored, oldTeacherCourses)).toBe(true);
  });

  it('ครูคนใหม่เห็นบันทึกของคาบที่ตัวเองสอนอยู่ (รู้ว่าครูคนเดิมสอนถึงไหน)', () => {
    expect(canViewPostTeachingRecord(newTeacher, stamped, newTeacherCourses)).toBe(true);
    expect(canViewPostTeachingRecord(newTeacher, authored, newTeacherCourses)).toBe(true);
  });

  it('คนนอกคาบ/คนที่ไม่มี staffId ไม่เห็น', () => {
    expect(canViewPostTeachingRecord(outsider, stamped, new Set())).toBe(false);
    expect(canViewPostTeachingRecord(noStaff, authored, new Set())).toBe(false);
    expect(canViewPostTeachingRecord(null, authored, new Set())).toBe(false);
  });

  it('ป้ายผู้บันทึก: ครูใหม่เห็นชื่อครูคนเดิม / ครูคนเดิมเห็นว่าเป็นประวัติจากคาบที่เคยสอน', () => {
    expect(postTeachingAuthorNote(newTeacher, authored, newTeacherCourses)).toBe('บันทึกโดย ครูเก่า ใจดี');
    expect(postTeachingAuthorNote(newTeacher, stamped, newTeacherCourses)).toContain('ครูเก่า ใจดี');
    expect(postTeachingAuthorNote(newTeacher, stamped, newTeacherCourses)).toContain('ครูผู้สอนก่อนหน้า');
    expect(postTeachingAuthorNote(oldTeacher, stamped, oldTeacherCourses)).toContain('เคยสอน');
  });

  it('บันทึกของตัวเองในคาบที่ยังสอนอยู่ไม่มีป้าย; บันทึกเก่าที่ไม่มีผู้บันทึกไม่มีป้าย', () => {
    expect(postTeachingAuthorNote(oldTeacher, authored, new Set([courseId]))).toBeNull();
    expect(postTeachingAuthorNote(newTeacher, { courseId }, newTeacherCourses)).toBeNull();
  });
});

describe('การเชื่อมระบบ (source inspection) และ rules', () => {
  const modal = readSource(path.resolve(__dirname, '../components/BulkDataImportModal.tsx'));
  const portal = readSource(path.resolve(__dirname, '../TeacherPortal.tsx'));
  const rules = readSource(path.resolve(__dirname, '../../firestore.rules'));
  const aftercare = readSource(path.resolve(__dirname, '../lib/scheduleImportAftercare.ts'));

  it('หน้า import บังคับยืนยันรายการที่ได้รับผลกระทบก่อนนำเข้า มีปุ่มยืนยันทั้งหมด และเรียกโอนประวัติ/เก็บกวาด/log', () => {
    expect(modal).toContain('isImpactFullyConfirmed(importImpact, confirmedReviewKeys)');
    expect(modal).toContain('ยืนยันทั้งหมด (ตรวจสอบแล้ว)');
    expect(modal).toContain('applyHandoverAndCleanup(db, importImpact)');
    expect(modal).toContain('writeImportLog(db');
    expect(modal).toContain('impactBlocksImport');
  });

  it('โอนประวัติ/เก็บกวาด/log ทำเฉพาะ SUPER_ADMIN', () => {
    expect(modal).toContain("userRoles.includes('SUPER_ADMIN')");
  });

  it('เก็บกวาด fail-closed: ประทับชื่อไม่สำเร็จ = ไม่ลบ', () => {
    expect(aftercare).toContain('if (!stampOk)');
    expect(aftercare).toContain('ข้ามการเก็บกวาดตารางของครูที่ปิดการใช้งานทั้งหมด');
  });

  it('TeacherPortal ใช้กติกามองเห็นใหม่ และบันทึกผู้บันทึกเมื่อส่งบันทึกหลังสอน', () => {
    expect(portal).toContain('canViewPostTeachingRecord(user, r, myCourseIdSet)');
    expect(portal).toContain('recordedByStaffId');
    expect(portal).not.toContain('postTeachingRecords.filter(r => myCourses.some(c => c.id === r.courseId))');
  });

  it('rules: schedule_import_logs เพิ่มอย่างเดียว แก้/ลบไม่ได้ และไม่เปิด signed-in ทั่วไป', () => {
    const m = rules.match(/match \/schedule_import_logs\/\{logId\} \{[\s\S]*?\n    \}/);
    expect(m).not.toBeNull();
    const block = m![0];
    expect(block).toContain('allow update, delete: if false;');
    expect(block).toContain("hasRole('SUPER_ADMIN') &&");
    expect(block).toContain('importedByUid == request.auth.uid');
    expect(block).not.toContain('isSignedIn()');
  });
});
