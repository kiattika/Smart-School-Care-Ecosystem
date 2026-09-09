import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ExecutivePortal TASK 9 (audit ข้อมูลปลอม): ExecutiveEngagementDashboard/ExecutiveLearnerAnalytics
 * ใช้ students จริงแล้ว (useRealStudents) แต่ activeLearningPoints/activeLearningLogs/selfAssessments
 * ยังอ่านจาก Zustand store แบบ session-local (ไม่มี Firestore listener ผูกไว้เลย — ว่างเปล่าเสมอเมื่อ
 * เปิดหน้าใหม่/ล็อกอินใหม่) ตรวจสอบแล้วว่าการเขียนจริง (addActiveLearningPoints/saveSelfAssessment
 * ใน store.ts) เขียนลง Firestore จริงอยู่แล้ว (active_learning_logs, student_self_assessments) — แค่
 * ไม่เคยมี listener อ่านกลับ แก้โดยเพิ่ม subscribeActiveLearningLogs (มีอยู่แล้ว ใช้ใน
 * ClassroomLeaderboard) และ subscribeAllSelfAssessments (สร้างใหม่) ผูกกับ firestore.rules ที่เพิ่ม
 * EXECUTIVE อ่าน student_self_assessments ได้แล้ว (active_learning_logs อ่านได้อยู่แล้วด้วย bare
 * isSignedIn() ตามที่ CLAUDE.md อนุญาตสำหรับ read บน collection ไม่อ่อนไหว)
 */
describe('ExecutivePortal TASK 9: Engagement/Analytics tabs ใช้ข้อมูลจริงแทน session-local state', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../ExecutivePortal.tsx'), 'utf8');
  const firestoreServiceSrc = fs.readFileSync(path.resolve(__dirname, '../services/firestoreService.ts'), 'utf8');
  const rulesSrc = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

  it('firestoreService มี subscribeAllSelfAssessments ใหม่ (school-wide live listener)', () => {
    expect(firestoreServiceSrc).toContain('export function subscribeAllSelfAssessments(');
    expect(firestoreServiceSrc).toContain("onSnapshot(collection(db, 'student_self_assessments')");
  });

  it('firestore.rules: EXECUTIVE อ่าน student_self_assessments ได้แล้ว', () => {
    const block = rulesSrc.match(/match \/student_self_assessments\/\{studentId\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(block).toContain("hasRole('EXECUTIVE')");
  });

  it('ExecutivePortal: ไม่ destructure selfAssessments/activeLearningPoints/activeLearningLogs จาก useStore() อีกต่อไป', () => {
    expect(src).not.toMatch(/const \{\s*\n?\s*postTeachingRecords,\s*\n?\s*selfAssessments,/);
  });

  it('ExecutivePortal: subscribe ข้อมูลจริงทั้ง 2 แหล่ง (active learning logs + self assessments)', () => {
    expect(src).toContain('subscribeActiveLearningLogs(setActiveLearningLogs)');
    expect(src).toContain('subscribeAllSelfAssessments(setSelfAssessments)');
  });

  it('activeLearningPoints คำนวณจาก log จริง (sum points ต่อ studentId) ไม่ fabricate', () => {
    expect(src).toContain('totals[log.studentId] = Math.max(0, (totals[log.studentId] || 0) + log.points)');
  });
});
