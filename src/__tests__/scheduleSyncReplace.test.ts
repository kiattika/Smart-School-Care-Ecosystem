import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';
import {
  computeSyncReplacePlan, scheduleDocIdFor, primaryTeacherKey, isScheduleInTerm,
  scheduleReferenceKeys, collectReferenceValues, partitionStaleByReferences, SCHEDULE_REFERENCING_COLLECTIONS,
  type ScheduleSemester,
} from '../lib/scheduleSyncReplace';

const SEM: ScheduleSemester = { academicYear: '2569', term: '1' };

/** helper: แถว teacher-load-report แบบย่อ */
const row = (over: Record<string, any> = {}, isValid = true) => ({
  isValid,
  parsedData: {
    isTeacherLoadReport: true,
    subjectCode: 'ค32101', subjectName: 'คณิตศาสตร์พื้นฐาน', room: '943', level: 'M.5/8',
    subjectType: 'MAIN', teacherName: 'Mr.Kiattisak', teacherEmail: 'kiattika@utd.ac.th',
    matchedTeacherId: 'kiattika-uid', matchedTeacherEmail: 'kiattika@utd.ac.th',
    slots: [{ dayOfWeek: 'monday', periodNumber: 6 }],
    ...over,
  },
});

/** helper: schedule doc ที่มีอยู่แล้วใน Firestore */
const existing = (id: string, data: Record<string, any> = {}) => ({
  id,
  data: {
    subjectCode: 'ค32101', room: '943', dayOfWeek: 'monday', periodNumber: 6, subjectType: 'MAIN',
    teacherId: 'kiattika-uid', teacherEmail: 'kiattika@utd.ac.th', teacherIds: ['kiattika-uid'],
    ...data,
  },
});

describe('computeSyncReplacePlan — Bulk Import COURSE sync/replace', () => {
  it('doc id ตรงกับสูตร write path', () => {
    expect(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, undefined, undefined, SEM)).toBe('sch_1_2569_ค32101_943_monday_p6');
    expect(scheduleDocIdFor('PLC', '', 'Non-Student', 'friday', 10, undefined, undefined, SEM)).toBe('sch_1_2569_PLC_Non_Student_friday_p10');
    expect(scheduleDocIdFor('HR', '943', 'M.5/8', 'monday', 0, undefined, undefined, SEM)).toBe('sch_1_2569_HR_943_monday_p0'); // คาบ 0 จริง
  });

  it('flag doc ที่ไม่มีในไฟล์ใหม่ (เช่นห้องผี 944) เป็น stale', () => {
    const plan = computeSyncReplacePlan(
      [row()],
      [
        existing('sch_1_2569_ค32101_943_monday_p6'),                                   // ยังอยู่ในไฟล์
        existing('sch_1_2569_ค32101_944_tuesday_p3', { room: '944', periodNumber: 3, dayOfWeek: 'tuesday' }), // ผี
      ],
      SEM,
    );
    expect(plan.stale.map(s => s.id)).toEqual(['sch_1_2569_ค32101_944_tuesday_p3']);
  });

  it('REGRESSION: import MAIN + ACTIVITY ของครูคนเดียวกัน — คาบกิจกรรมที่เพิ่ง import ต้องไม่ถูก flag ว่า stale', () => {
    const mainRow = row(); // ค32101 943 monday p6
    const activityRow = row({
      subjectCode: 'HR', subjectName: 'HomeRoom (กิจกรรม)', room: '', level: 'M.5/8', subjectType: 'ACTIVITY',
      slots: [{ dayOfWeek: 'monday', periodNumber: 0 }, { dayOfWeek: 'tuesday', periodNumber: 0 }],
    });
    // doc เดิม = ที่เขียนโดย code path เดียวกัน (ใช้ scheduleDocIdFor เพื่อให้ id ตรงเป๊ะ)
    // ACTIVITY ต้องส่ง subjectType + teacherKey ด้วย (ดู ROOT CAUSE FIX ด้านล่าง) ไม่งั้น id ไม่ตรงกับ
    // ที่ computeSyncReplacePlan คำนวณจริง แล้วจะโดน flag stale ผิดๆ
    const hrMon = scheduleDocIdFor('HR', '', 'M.5/8', 'monday', 0, 'ACTIVITY', primaryTeacherKey(activityRow.parsedData), SEM);
    const hrTue = scheduleDocIdFor('HR', '', 'M.5/8', 'tuesday', 0, 'ACTIVITY', primaryTeacherKey(activityRow.parsedData), SEM);
    const plan = computeSyncReplacePlan(
      [mainRow, activityRow],
      [
        existing(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, undefined, undefined, SEM)),
        existing(hrMon, { subjectCode: 'HR', subjectType: 'ACTIVITY', periodNumber: 0, room: '', level: 'M.5/8' }),
        existing(hrTue, { subjectCode: 'HR', subjectType: 'ACTIVITY', periodNumber: 0, dayOfWeek: 'tuesday', room: '', level: 'M.5/8' }),
      ],
      SEM,
    );
    // ทั้ง 3 doc มีในไฟล์ใหม่ → ไม่มีอะไรถูกลบ
    expect(plan.stale).toHaveLength(0);
    expect(plan.newIdCount).toBe(3);
  });

  it('REGRESSION: ครูมีแถว import ไม่ผ่าน → ไม่แตะ schedule เก่าของครูคนนั้นเลย (กัน "คาบกิจกรรมหายหมด")', () => {
    const validAcademic = row(); // valid
    const brokenActivity = row({
      subjectCode: 'ACT_ชุมนุม', subjectType: 'ACTIVITY', slots: [], // parse ไม่ผ่าน → 0 slots
    }, false);
    const plan = computeSyncReplacePlan(
      [validAcademic, brokenActivity],
      [
        existing('sch_1_2569_ค32101_943_monday_p6'),                                    // ยังอยู่
        existing('sch_1_2569_ACT_ชุมนุม_943_wednesday_p8', {                            // กิจกรรมเดิมของครู
          subjectCode: 'ACT_ชุมนุม', subjectType: 'ACTIVITY', dayOfWeek: 'wednesday', periodNumber: 8,
        }),
        existing('sch_1_2569_HR_943_monday_p0', { subjectCode: 'HR', subjectType: 'ACTIVITY', periodNumber: 0 }),
      ],
      SEM,
    );
    // ครู kiattika มี error ในไฟล์ → schedule เก่าทั้งหมดของเขาถูก "เก็บไว้"
    expect(plan.stale).toHaveLength(0);
    expect(plan.teachersWithErrors).toContain('kiattika@utd.ac.th');
  });

  it('ไม่แตะ schedule ของครูที่ไม่ได้อยู่ในไฟล์ import รอบนี้', () => {
    const plan = computeSyncReplacePlan(
      [row()], // เฉพาะ kiattika
      [
        existing('sch_1_2569_อ21101_101_monday_p1', {
          subjectCode: 'อ21101', teacherId: 'somchai-uid', teacherEmail: 'somchai@utd.ac.th',
          teacherIds: ['somchai-uid'],
        }),
      ],
      SEM,
    );
    expect(plan.stale).toHaveLength(0);
  });

  describe('ROOT CAUSE FIX: ACTIVITY doc id ชนกันข้ามครู (คาบกิจกรรมของครูบางคนหายไปทั้งหมด)', () => {
    // พิสูจน์ด้วย Firestore Emulator จริงแล้วว่า: ครูหลายคนที่มีกิจกรรมชื่อเดียวกัน + วัน-คาบเดียวกัน
    // (PLC/โฮมรูม/ลูกเสือ/แนะแนว ฯลฯ ไม่มีห้องเรียนเฉพาะ) เดิมคำนวณ doc id เดียวกันหมด →
    // batch.set({merge:true}) ของครูคนที่ถูกประมวลผลทีหลังในไฟล์ทับ teacherId ของครูคนก่อนเงียบๆ
    // ครูที่ไม่ใช่คนสุดท้าย (เช่น kiattika ซึ่งมักอยู่ต้นไฟล์) เหลือคาบกิจกรรม 0 คาบเสมอ

    it('scheduleDocIdFor: แถว ACTIVITY ไม่มีห้อง+ชื่อ+วัน-คาบเดียวกัน แต่ครูต่างกัน → ต้องได้ id ต่างกัน', () => {
      const idKiattika = scheduleDocIdFor('ACT_PLC', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'kiattika-uid', SEM);
      const idSomchai = scheduleDocIdFor('ACT_PLC', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'somchai-uid', SEM);
      expect(idKiattika).not.toBe(idSomchai);
      expect(idKiattika).toContain('kiattika-uid');
      expect(idSomchai).toContain('somchai-uid');
    });

    it('scheduleDocIdFor: ไม่ส่ง subjectType/teacherKey (เรียกแบบเดิม) ยังคง backward-compatible กับ id รูปแบบเก่า', () => {
      expect(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, undefined, undefined, SEM)).toBe('sch_1_2569_ค32101_943_monday_p6');
      expect(scheduleDocIdFor('PLC', '', 'Non-Student', 'friday', 10, undefined, undefined, SEM)).toBe('sch_1_2569_PLC_Non_Student_friday_p10');
    });

    it('scheduleDocIdFor: แถว MAIN (มีห้องเรียนจริง) ไม่ถูกฝัง teacherKey แม้จะส่ง teacherKey มาด้วย — กัน id เดิมของ production เปลี่ยนรูปแบบ', () => {
      expect(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', 'kiattika-uid', SEM))
        .toBe('sch_1_2569_ค32101_943_monday_p6');
    });

    it('TASK 3 (ครูร่วมสอน): ACTIVITY ที่มีห้องเรียนจริง (เช่น HR ม.5/8 ห้อง 943) ไม่ฝัง teacherKey — ครูร่วมรับผิดชอบหลายคนต้องได้ id เดียวกัน (merge เป็น doc เดียวกัน ไม่แยกคนละ doc แบบ PLC)', () => {
      const idTeacherA = scheduleDocIdFor('HR', '943', 'M.5/8', 'monday', 0, 'ACTIVITY', 'teacher-a-uid', SEM);
      const idTeacherB = scheduleDocIdFor('HR', '943', 'M.5/8', 'monday', 0, 'ACTIVITY', 'teacher-b-uid', SEM);
      expect(idTeacherA).toBe(idTeacherB);
      expect(idTeacherA).toBe('sch_1_2569_HR_943_monday_p0');
    });

    it('primaryTeacherKey: เลือก UID จริงก่อนเสมอ ไม่ fabricate ตัวใหม่', () => {
      expect(primaryTeacherKey({ matchedTeacherId: 'uid-1', matchedTeacherEmail: 'a@utd.ac.th', teacherName: 'A' })).toBe('uid-1');
      expect(primaryTeacherKey({ matchedTeacherEmail: 'a@utd.ac.th', teacherName: 'A' })).toBe('a@utd.ac.th');
      expect(primaryTeacherKey({ teacherName: 'ครู เอ' })).toBe('ครู เอ');
      expect(primaryTeacherKey({})).toBe('');
    });

    it('REGRESSION: 2 ครูมีกิจกรรม PLC ชื่อเดียวกัน+วัน-คาบเดียวกัน → newIds ต้องมี 2 รายการแยกกัน (เดิมยุบเหลือ 1)', () => {
      const kiattikaPlc = row({
        subjectCode: '-', subjectName: 'PLC', room: '', level: 'Non-Student', subjectType: 'ACTIVITY',
        matchedTeacherId: 'kiattika-uid', matchedTeacherEmail: 'kiattika@utd.ac.th',
        slots: [{ dayOfWeek: 'wednesday', periodNumber: 8 }],
      });
      const somchaiPlc = row({
        subjectCode: '-', subjectName: 'PLC', room: '', level: 'Non-Student', subjectType: 'ACTIVITY',
        matchedTeacherId: 'somchai-uid', matchedTeacherEmail: 'somchai@utd.ac.th', teacherName: 'Mr.Somchai',
        slots: [{ dayOfWeek: 'wednesday', periodNumber: 8 }],
      });
      // ทั้งสองแถวมี subjectCode/room/level/day/period เหมือนกันทุกอย่าง ต่างแค่ตัวครู
      const plan = computeSyncReplacePlan([kiattikaPlc, somchaiPlc], [], SEM);
      expect(plan.newIdCount).toBe(2); // เดิม (ก่อนแก้) จะได้ 1 เพราะ id ชนกัน
    });

    it('REGRESSION: หลัง import แล้วมี doc เก่าของครูทั้งสองคน (id ต่างกันแล้ว) → ไม่มีใครถูก flag stale', () => {
      const kiattikaPlc = row({
        subjectCode: '-', subjectName: 'PLC', room: '', level: 'Non-Student', subjectType: 'ACTIVITY',
        matchedTeacherId: 'kiattika-uid', matchedTeacherEmail: 'kiattika@utd.ac.th',
        slots: [{ dayOfWeek: 'wednesday', periodNumber: 8 }],
      });
      const somchaiPlc = row({
        subjectCode: '-', subjectName: 'PLC', room: '', level: 'Non-Student', subjectType: 'ACTIVITY',
        matchedTeacherId: 'somchai-uid', matchedTeacherEmail: 'somchai@utd.ac.th', teacherName: 'Mr.Somchai',
        slots: [{ dayOfWeek: 'wednesday', periodNumber: 8 }],
      });
      const kiattikaId = scheduleDocIdFor('-', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'kiattika-uid', SEM);
      const somchaiId = scheduleDocIdFor('-', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'somchai-uid', SEM);
      const plan = computeSyncReplacePlan(
        [kiattikaPlc, somchaiPlc],
        [
          existing(kiattikaId, { subjectCode: '-', subjectType: 'ACTIVITY', room: '', level: 'Non-Student', dayOfWeek: 'wednesday', periodNumber: 8, teacherId: 'kiattika-uid', teacherEmail: 'kiattika@utd.ac.th', teacherIds: ['kiattika-uid'] }),
          existing(somchaiId, { subjectCode: '-', subjectType: 'ACTIVITY', room: '', level: 'Non-Student', dayOfWeek: 'wednesday', periodNumber: 8, teacherId: 'somchai-uid', teacherEmail: 'somchai@utd.ac.th', teacherIds: ['somchai-uid'] }),
        ],
        SEM,
      );
      expect(plan.stale).toHaveLength(0);
    });
  });
});

describe('ภาคเรียนใน schedule doc id / replace plan', () => {
  const T1: ScheduleSemester = { academicYear: '2569', term: '1' };
  const T2: ScheduleSemester = { academicYear: '2569', term: '2' };
  const Y2: ScheduleSemester = { academicYear: '2570', term: '1' };

  it('วิชา+ห้อง+วัน+คาบเดิม แต่ภาคเรียนต่างกัน → id ต่างกัน (import ภาคเรียนใหม่ไม่ทับของเก่า)', () => {
    const a = scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', undefined, T1);
    const b = scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', undefined, T2);
    const c = scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', undefined, Y2);
    expect(a).toBe('sch_1_2569_ค32101_943_monday_p6');
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('ภาคเรียนเดียวกัน → id เดิมเสมอ (idempotent)', () => {
    expect(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', undefined, T1))
      .toBe(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', undefined, { ...T1 }));
  });

  it('ไม่มี academicYear/term → throw (ห้ามสร้าง id โดยเดาภาคเรียน)', () => {
    expect(() => scheduleDocIdFor('X', '1', 'L', 'monday', 1, 'MAIN', undefined, { academicYear: '', term: '1' })).toThrow();
    expect(() => scheduleDocIdFor('X', '1', 'L', 'monday', 1, 'MAIN', undefined, { academicYear: '2569', term: '' })).toThrow();
  });

  it('isScheduleInTerm: field ตรง = ใช่, ต่างภาคเรียน = ไม่, ไม่มี field (ข้อมูลเก่า) = นับเป็นภาคเรียนปัจจุบัน', () => {
    expect(isScheduleInTerm({ academicYear: '2569', term: '1' }, T1)).toBe(true);
    expect(isScheduleInTerm({ academicYear: '2569', term: '2' }, T1)).toBe(false);
    expect(isScheduleInTerm({ academicYear: '2568', term: '1' }, T1)).toBe(false);
    expect(isScheduleInTerm({}, T1)).toBe(true);
  });

  it('replace plan: ไม่ลบ schedule ของภาคเรียนอื่น แม้ไม่อยู่ในไฟล์ใหม่', () => {
    const t1Doc = scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', undefined, T1);
    const plan = computeSyncReplacePlan(
      [row({ subjectCode: 'ค99999', room: '101' })],
      [
        existing(t1Doc, { academicYear: '2569', term: '1' }),
        existing('sch_2_2569_ค32101_943_monday_p6', { academicYear: '2569', term: '2' }),
      ],
      T2,
    );
    // ไฟล์ใหม่เป็นของภาคเรียน 2: ลบได้เฉพาะ doc ภาคเรียน 2 — doc ภาคเรียน 1 ต้องไม่ถูกแตะ
    expect(plan.stale.map(s => s.id)).toEqual(['sch_2_2569_ค32101_943_monday_p6']);
  });
});

describe('กันลบ schedule ที่ยังมีข้อมูลที่ครูบันทึกไว้อ้างถึง (sync/replace)', () => {
  const T1: ScheduleSemester = { academicYear: '2569', term: '1' };
  const schId = scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', undefined, T1);
  const courseId = `course_${schId.slice(4)}`;
  const otherId = scheduleDocIdFor('ค32101', '943', 'M.5/8', 'tuesday', 2, 'MAIN', undefined, T1);
  const stale = [{ id: schId, label: 'a' }, { id: otherId, label: 'b' }];

  it('scheduleReferenceKeys: คืนทั้ง id และ courseId ที่ derive จาก id เดียวกัน', () => {
    expect(scheduleReferenceKeys(schId)).toEqual([schId, courseId]);
    expect(scheduleReferenceKeys('legacy-id')).toEqual(['legacy-id']);
  });

  it('ไม่มีข้อมูลอ้างอิง → ลบได้ทั้งหมด', () => {
    const r = partitionStaleByReferences(stale, new Set());
    expect(r.deletable.map(s => s.id)).toEqual([schId, otherId]);
    expect(r.protectedDocs).toEqual([]);
  });

  it('บันทึกหลังสอนที่อ้างด้วย courseId (รูป course_...) → ต้องเก็บ schedule ไว้', () => {
    const refs = collectReferenceValues([{ courseId, date: '2026-10-01' }], ['scheduleId', 'courseId']);
    const r = partitionStaleByReferences(stale, refs);
    expect(r.protectedDocs.map(s => s.id)).toEqual([schId]);
    expect(r.deletable.map(s => s.id)).toEqual([otherId]);
  });

  it('คำขอเช็คชื่อย้อนหลังที่อ้างด้วย scheduleId (รูป sch_...) → ต้องเก็บ schedule ไว้', () => {
    const refs = collectReferenceValues([{ scheduleId: otherId }], ['scheduleId']);
    const r = partitionStaleByReferences(stale, refs);
    expect(r.protectedDocs.map(s => s.id)).toEqual([otherId]);
    expect(r.deletable.map(s => s.id)).toEqual([schId]);
  });

  it('collectReferenceValues: ข้ามค่าว่าง/undefined/null และไม่พังเมื่อ doc ไม่มี field', () => {
    const refs = collectReferenceValues([{ scheduleId: '' }, { scheduleId: null }, {}, { courseId: courseId }], ['scheduleId', 'courseId']);
    expect([...refs]).toEqual([courseId]);
  });

  it('รายการ collection ที่ตรวจ ครอบคลุมทุกที่ที่ผูกกับ schedule และไม่รวม gradebook_scores', () => {
    const names = SCHEDULE_REFERENCING_COLLECTIONS.map(c => c.collection);
    expect(names).toEqual(expect.arrayContaining(['attendance_records', 'post_teaching_records', 'late_attendance_requests', 'substitute_assignments']));
    expect(names).not.toContain('gradebook_scores');
  });

  it('BulkDataImportModal ใช้ตัวกันนี้จริง และไม่เหลือโค้ดเช็คเฉพาะ attendance_records แบบเดิม', () => {
    const src = readSource(path.resolve(__dirname, '../components/BulkDataImportModal.tsx'));
    expect(src).toContain('partitionStaleByReferences(staleSchedules');
    expect(src).toContain('SCHEDULE_REFERENCING_COLLECTIONS');
    expect(src).not.toContain("collection(db, 'attendance_records')");
  });
});
