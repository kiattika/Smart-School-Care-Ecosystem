import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { rankForPoints } from '../lib/courseRank';

// ผู้ปกครองต้องเห็นการเช็คอินเข้าโรงเรียนของบุตรหลาน (เคยไม่เห็นเลย: บันทึก GPS ไม่มี parentUid เพราะอ่านจาก store ที่ว่างในเซสชันนักเรียน)
describe('การเช็คอินถึงผู้ปกครอง', () => {
  it('เช็คอิน GPS ของนักเรียนใส่ parentUid จากทะเบียนจริง (getStudentLinkIds) ไม่ใช่ store', () => {
    const store = readSource('src/store.ts');
    const block = store.slice(store.indexOf('addGPSCheckInLog: async'), store.indexOf('saveGateAttendanceRecordFirestore(gateLog)'));
    expect(block).toContain('await getStudentLinkIds(log.userId)');
    expect(block).not.toContain('matchedStudent?.parentId');
  });
  it('หน้าผู้ปกครอง query ประวัติประตูด้วย studentId ของบุตรหลาน (rules ตรวจตามทะเบียน)', () => {
    expect(readSource('src/ParentPortal.tsx')).toContain('subscribeGateAttendanceLogs(setGateAttendanceLogs, { studentId: gateStudentId })');
    expect(readSource('src/ParentPortal.tsx')).not.toContain('subscribeGateAttendanceLogs(setGateAttendanceLogs, { parentUid');
    expect(readSource('src/components/student-parent/GateAttendanceTracker.tsx')).toContain('isParentView ? { studentId: gateStudentId }');
    const rules = readSource('firestore.rules');
    const gate = rules.slice(rules.indexOf('match /gate_attendance_logs/{logId}'), rules.indexOf('match /detailed_leave_requests/'));
    expect(gate).toContain('isParentOfStudent(resource.data.studentId)');
  });
});

describe('แถบคะแนนกิจกรรม', () => {
  it('คะแนนพอดีจุดเริ่มระดับ = 0% ในระดับ แต่แถบยังแสดงจุดเริ่มต้น (minWidth)', () => {
    const r = rankForPoints(3);
    expect(r.progressPct).toBe(0);
    expect(r.next).not.toBeNull();
    expect(readSource('src/components/student-parent/CourseOverviewCards.tsx')).toContain("minWidth: p.points > 0 ? '0.5rem' : undefined");
    expect(readSource('src/components/QuickPointAwardModal.tsx')).toContain("minWidth: currentPoints > 0 ? '0.5rem' : undefined");
  });
});
