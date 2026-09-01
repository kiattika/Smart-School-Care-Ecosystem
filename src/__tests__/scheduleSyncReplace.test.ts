import { describe, it, expect } from 'vitest';
import { computeSyncReplacePlan, scheduleDocIdFor } from '../lib/scheduleSyncReplace';

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
    const hrMon = scheduleDocIdFor('HR', '', 'M.5/8', 'monday', 0);
    const hrTue = scheduleDocIdFor('HR', '', 'M.5/8', 'tuesday', 0);
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
});
