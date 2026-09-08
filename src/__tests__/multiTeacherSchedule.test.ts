import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TASK 3 (ครูร่วมสอน — ยืนยันจากข้อมูลจริง Teacher_Load_Report: HR ม.5/8 มี 2 ครูรับผิดชอบร่วมกัน)
 *
 * TeacherPortal.tsx เป็นไฟล์ใหญ่มาก (component เดียวหลายพันบรรทัด ผูกกับ Zustand/Firestore/context
 * จำนวนมาก) mount แบบเต็มรูปแบบเพื่อทดสอบ end-to-end ในนี้มีความเสี่ยง/ค่าใช้จ่ายสูงเกินจำเป็น —
 * ใช้วิธี source-inspection (อ่านซอร์สจริงแล้วยืนยันว่า literal code สำคัญมีอยู่จริง) ตามรูปแบบเดิม
 * ที่ใช้กับ substituteAssignmentGranularity.test.ts แทน เพื่อป้องกัน regression ของจุดที่แก้ไปแล้ว
 */
describe('TASK 3: schedules.teacherIds — ทุกจุดที่กรอง/จับคู่ครูต้องรองรับครูร่วมสอนหลายคนต่อคาบ', () => {
  const teacherPortalSrc = fs.readFileSync(
    path.resolve(__dirname, '../TeacherPortal.tsx'), 'utf8'
  );
  const teachingLoadTableSrc = fs.readFileSync(
    path.resolve(__dirname, '../components/TeachingLoadTable.tsx'), 'utf8'
  );
  const bulkImportSrc = fs.readFileSync(
    path.resolve(__dirname, '../components/BulkDataImportModal.tsx'), 'utf8'
  );
  const scheduleSyncSrc = fs.readFileSync(
    path.resolve(__dirname, '../lib/scheduleSyncReplace.ts'), 'utf8'
  );

  it('scheduleDocIdFor: ไม่ฝัง teacherKey ให้ ACTIVITY ที่มีห้องเรียนจริง (ครูร่วมสอนต้อง merge เป็น doc เดียว)', () => {
    expect(scheduleSyncSrc).toContain('const hasRealRoom = !!(room && String(room).trim());');
    expect(scheduleSyncSrc).toContain("subjectType === 'ACTIVITY' && !hasRealRoom && safeTeacherKey");
  });

  it('BulkDataImportModal: มี pre-pass merge teacherIds ต่อ scheduleDocId ก่อนเขียนจริง (กัน last-write-wins)', () => {
    expect(bulkImportSrc).toContain('mergedTeachersByScheduleId');
    // ต้องใช้ teacherIds ที่ merge แล้วตอนเขียนจริง ไม่ใช่ [ครูคนนี้คนเดียว] จากแถวเดียว
    expect(bulkImportSrc).toContain('const teacherIds = merged?.teacherIds.length ? merged.teacherIds : (parsedData.matchedTeacherId ? [parsedData.matchedTeacherId] : []);');
  });

  it('TeacherPortal daily schedule: กรอง todayFsSchedules ด้วยทั้ง teacherId เดี่ยวและ teacherIds array-contains', () => {
    expect(teacherPortalSrc).toContain(
      "(isTeacherEmailMatch(item.teacherEmail, user?.email) ||\n                        (user?.uid && (item.teacherId === user.uid ||\n                          (Array.isArray(item.teacherIds) && item.teacherIds.includes(user.uid))))) &&"
    );
  });

  it('TeacherPortal globalCourses: เก็บ teacherIds จาก schedule doc ไว้ด้วย (ไม่ใช่แค่ teacherEmail ของครูคนแรก)', () => {
    expect(teacherPortalSrc).toContain(
      "teacherIds: Array.isArray(sch.teacherIds) ? sch.teacherIds : (sch.teacherId ? [sch.teacherId] : []),"
    );
  });

  it('TeacherPortal myCourses: isOriginal ต้องตรวจ teacherIds.includes(user.uid) ด้วย ไม่ใช่แค่ email ของครูคนแรก (แก้บั๊กครูร่วมสอนหายจากสมุดคะแนน/ตารางสอน)', () => {
    expect(teacherPortalSrc).toContain(
      "const isOriginal = isTeacherEmailMatch(gc.teacherEmail, user?.email) ||\n          (!!user?.uid && (gc.teacherIds || []).includes(user.uid));"
    );
  });

  it('TeachingLoadTable: นับภาระงานสอนให้ทุกคนใน teacherIds ไม่ใช่แค่ teacherIds[0] (แก้บั๊กครูร่วมสอนคนที่ 2 หายจากรายงานภาระงานสอน)', () => {
    expect(teachingLoadTableSrc).toContain('const matchedStaffIds = new Set<string>();');
    expect(teachingLoadTableSrc).toContain(
      "sch.teacherIds.forEach((tid: string) => { if (tid && staffLoadsMap.has(tid)) matchedStaffIds.add(tid); });"
    );
    // Regression guard: ต้องไม่มีการ hardcode ดึงแค่ตัวแรกอีกต่อไป
    expect(teachingLoadTableSrc).not.toContain('matchedStaffId = sch.teacherIds[0];');
  });

  it('post_teaching_records ยังคงผูกกับ courseId+date (ไม่ผูกกับครูคนใดคนหนึ่ง) — ทุกคนในทีมแก้ record เดียวกันได้', () => {
    const firestoreServiceSrc = fs.readFileSync(
      path.resolve(__dirname, '../services/firestoreService.ts'), 'utf8'
    );
    expect(firestoreServiceSrc).toContain("const docId = `${record.courseId}_${record.date}`;");
  });
});
