import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';

const srcDir = path.resolve(__dirname, '..');

describe('เมนู "จัดผังที่นั่ง (ล่วงหน้า)" — guard', () => {
  const planner = readSource(path.join(srcDir, 'components/teacher/TeacherSeatingPlanner.tsx'));
  const csm = readSource(path.join(srcDir, 'components/ClassroomSeatingManager.tsx'));
  const tp = readSource(path.join(srcDir, 'TeacherPortal.tsx'));

  it('หน้าจัดผังล่วงหน้าเปิดตัวจัดผังเดิมด้วย planMode (ไม่สร้างตัวจัดผังที่สอง)', () => {
    expect(planner).toContain('<ClassroomSeatingManager');
    expect(planner).toMatch(/\bplanMode\b/);
  });

  it('planMode ซ่อนปุ่มสุ่ม/เช็คชื่อ/ให้คะแนน แต่การสุ่มในคาบสอนยังอยู่', () => {
    expect(csm).toMatch(/\{!planMode && \(\s*<button\s+onClick=\{\(\) => setShowRandomPicker\(true\)\}/);
    expect(csm).toContain('const isAttendanceDone = planMode || hasAttendanceRecords;');
    expect(csm).toContain('{!isAbsent && !attendanceOnly && !planMode && (');
    expect(csm).toContain('<RandomStudentPickerModal');
  });

  it('คาบสอนจริงกับเมนูล่วงหน้าใช้คีย์ผังเดียวกัน (seatingTargetFor) และส่ง physicalRoom เข้า activeCourse ทุกจุดเข้าคาบ', () => {
    expect(tp).toContain("dashboardTab === 'seating-plan'");
    expect(tp).toContain('seatingTargetFor({');
    expect((tp.match(/physicalRoom: physicalRoomOnly\(/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(tp).toContain('target={activeSeatingTarget}');
    expect(planner).toContain('listSeatingPlanItems');
  });

  it('ไม่มีผังผูกรหัสวิชาแบบเก่า (layout_{รหัสวิชา}_{ห้อง}) หลงเหลือ และ assignment id มี layoutId กันชนข้ามผัง', () => {
    expect(csm).not.toMatch(/`layout_\$\{/);
    expect(csm).not.toMatch(/`assign_\$\{(?!layoutId)/);
  });
});
