import { describe, it, expect } from 'vitest';
import { computeSyncReplacePlan, scheduleDocIdFor, primaryTeacherKey } from '../lib/scheduleSyncReplace';

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
    expect(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6)).toBe('sch_ค32101_943_monday_p6');
    expect(scheduleDocIdFor('PLC', '', 'Non-Student', 'friday', 10)).toBe('sch_PLC_Non_Student_friday_p10');
    expect(scheduleDocIdFor('HR', '943', 'M.5/8', 'monday', 0)).toBe('sch_HR_943_monday_p0'); // คาบ 0 จริง
  });

  it('flag doc ที่ไม่มีในไฟล์ใหม่ (เช่นห้องผี 944) เป็น stale', () => {
    const plan = computeSyncReplacePlan(
      [row()],
      [
        existing('sch_ค32101_943_monday_p6'),                                   // ยังอยู่ในไฟล์
        existing('sch_ค32101_944_tuesday_p3', { room: '944', periodNumber: 3, dayOfWeek: 'tuesday' }), // ผี
      ],
    );
    expect(plan.stale.map(s => s.id)).toEqual(['sch_ค32101_944_tuesday_p3']);
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
    const hrMon = scheduleDocIdFor('HR', '', 'M.5/8', 'monday', 0, 'ACTIVITY', primaryTeacherKey(activityRow.parsedData));
    const hrTue = scheduleDocIdFor('HR', '', 'M.5/8', 'tuesday', 0, 'ACTIVITY', primaryTeacherKey(activityRow.parsedData));
    const plan = computeSyncReplacePlan(
      [mainRow, activityRow],
      [
        existing(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6)),
        existing(hrMon, { subjectCode: 'HR', subjectType: 'ACTIVITY', periodNumber: 0, room: '', level: 'M.5/8' }),
        existing(hrTue, { subjectCode: 'HR', subjectType: 'ACTIVITY', periodNumber: 0, dayOfWeek: 'tuesday', room: '', level: 'M.5/8' }),
      ],
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
        existing('sch_ค32101_943_monday_p6'),                                    // ยังอยู่
        existing('sch_ACT_ชุมนุม_943_wednesday_p8', {                            // กิจกรรมเดิมของครู
          subjectCode: 'ACT_ชุมนุม', subjectType: 'ACTIVITY', dayOfWeek: 'wednesday', periodNumber: 8,
        }),
        existing('sch_HR_943_monday_p0', { subjectCode: 'HR', subjectType: 'ACTIVITY', periodNumber: 0 }),
      ],
    );
    // ครู kiattika มี error ในไฟล์ → schedule เก่าทั้งหมดของเขาถูก "เก็บไว้"
    expect(plan.stale).toHaveLength(0);
    expect(plan.teachersWithErrors).toContain('kiattika@utd.ac.th');
  });

  it('ไม่แตะ schedule ของครูที่ไม่ได้อยู่ในไฟล์ import รอบนี้', () => {
    const plan = computeSyncReplacePlan(
      [row()], // เฉพาะ kiattika
      [
        existing('sch_อ21101_101_monday_p1', {
          subjectCode: 'อ21101', teacherId: 'somchai-uid', teacherEmail: 'somchai@utd.ac.th',
          teacherIds: ['somchai-uid'],
        }),
      ],
    );
    expect(plan.stale).toHaveLength(0);
  });

  describe('ROOT CAUSE FIX: ACTIVITY doc id ชนกันข้ามครู (คาบกิจกรรมของครูบางคนหายไปทั้งหมด)', () => {
    // พิสูจน์ด้วย Firestore Emulator จริงแล้วว่า: ครูหลายคนที่มีกิจกรรมชื่อเดียวกัน + วัน-คาบเดียวกัน
    // (PLC/โฮมรูม/ลูกเสือ/แนะแนว ฯลฯ ไม่มีห้องเรียนเฉพาะ) เดิมคำนวณ doc id เดียวกันหมด →
    // batch.set({merge:true}) ของครูคนที่ถูกประมวลผลทีหลังในไฟล์ทับ teacherId ของครูคนก่อนเงียบๆ
    // ครูที่ไม่ใช่คนสุดท้าย (เช่น kiattika ซึ่งมักอยู่ต้นไฟล์) เหลือคาบกิจกรรม 0 คาบเสมอ

    it('scheduleDocIdFor: แถว ACTIVITY ไม่มีห้อง+ชื่อ+วัน-คาบเดียวกัน แต่ครูต่างกัน → ต้องได้ id ต่างกัน', () => {
      const idKiattika = scheduleDocIdFor('ACT_PLC', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'kiattika-uid');
      const idSomchai = scheduleDocIdFor('ACT_PLC', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'somchai-uid');
      expect(idKiattika).not.toBe(idSomchai);
      expect(idKiattika).toContain('kiattika-uid');
      expect(idSomchai).toContain('somchai-uid');
    });

    it('scheduleDocIdFor: ไม่ส่ง subjectType/teacherKey (เรียกแบบเดิม) ยังคง backward-compatible กับ id รูปแบบเก่า', () => {
      expect(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6)).toBe('sch_ค32101_943_monday_p6');
      expect(scheduleDocIdFor('PLC', '', 'Non-Student', 'friday', 10)).toBe('sch_PLC_Non_Student_friday_p10');
    });

    it('scheduleDocIdFor: แถว MAIN (มีห้องเรียนจริง) ไม่ถูกฝัง teacherKey แม้จะส่ง teacherKey มาด้วย — กัน id เดิมของ production เปลี่ยนรูปแบบ', () => {
      expect(scheduleDocIdFor('ค32101', '943', 'M.5/8', 'monday', 6, 'MAIN', 'kiattika-uid'))
        .toBe('sch_ค32101_943_monday_p6');
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
      const plan = computeSyncReplacePlan([kiattikaPlc, somchaiPlc], []);
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
      const kiattikaId = scheduleDocIdFor('-', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'kiattika-uid');
      const somchaiId = scheduleDocIdFor('-', '', 'Non-Student', 'wednesday', 8, 'ACTIVITY', 'somchai-uid');
      const plan = computeSyncReplacePlan(
        [kiattikaPlc, somchaiPlc],
        [
          existing(kiattikaId, { subjectCode: '-', subjectType: 'ACTIVITY', room: '', level: 'Non-Student', dayOfWeek: 'wednesday', periodNumber: 8, teacherId: 'kiattika-uid', teacherEmail: 'kiattika@utd.ac.th', teacherIds: ['kiattika-uid'] }),
          existing(somchaiId, { subjectCode: '-', subjectType: 'ACTIVITY', room: '', level: 'Non-Student', dayOfWeek: 'wednesday', periodNumber: 8, teacherId: 'somchai-uid', teacherEmail: 'somchai@utd.ac.th', teacherIds: ['somchai-uid'] }),
        ],
      );
      expect(plan.stale).toHaveLength(0);
    });
  });
});
