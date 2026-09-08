import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ExecutivePortal TASK 1-3 (audit ข้อมูลปลอม): dashboard tab เดิมมี "Annual Rewards & Promotions
 * Shortlist" (ตารางจัดอันดับครูปลอม 100%), "5 KPI Pillars" (4/5 hardcode คงที่ + 1 อ้าง session-local
 * fake), ปุ่ม export PDF ที่ดึง mockExecutiveData.globalKPIs และ modal "Download PDF" ที่เป็นแค่
 * setTimeout ไม่มีไฟล์ออกจริง — ตรวจสอบแล้วไม่มีแหล่งข้อมูลจริงรองรับการจัดอันดับครูรายบุคคล/PA เลย
 * ในระบบ (grep ทั้งโปรเจกต์) จึงเอาออกทั้งหมด เหลือแค่ 1 KPI ที่คำนวณจากข้อมูลจริง (postTeachingRecords
 * + schedules สด) ใช้ source-inspection เพราะ mount เต็มรูปแบบต้องพึ่ง Firestore listener จำนวนมาก
 */
describe('ExecutivePortal TASK 1-3: dashboard tab เอาข้อมูลปลอมออก เหลือแค่ KPI ที่มีข้อมูลจริงรองรับ', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../ExecutivePortal.tsx'), 'utf8');

  it('TASK 1: ไม่มีตารางจัดอันดับครู/รายชื่อครูปลอมหลงเหลืออยู่ (ชื่อฟีเจอร์เดิมอาจยังอยู่ในคอมเมนต์อธิบายเหตุผลได้)', () => {
    expect(src).not.toContain('คุณครู สมใจ รักสอน');
    expect(src).not.toContain('คุณครู มานะ บากบั่น');
    expect(src).not.toContain('Sort: Highest KPI');
  });

  it('TASK 2: ไม่มี hardcode 4 pillar เดิม (Classroom Engagement/Home Visit/School Duty/Admin Task) หลงเหลืออยู่', () => {
    expect(src).not.toContain("{ label: 'Classroom Engagement'");
    expect(src).not.toContain("{ label: 'School Duty Punctuality'");
    expect(src).not.toContain("{ label: 'Admin Task Delivery'");
    expect(src).not.toContain('homeVisits.filter(v => v.geoVerified)');
  });

  it('TASK 2: Academic Discipline คำนวณจาก postTeachingRecords จริง เทียบกับ schedules ของวันนี้ที่ query สด', () => {
    expect(src).toContain("await getDocs(collection(db, 'schedules'));");
    expect(src).toContain('postTeachingRecords.filter(r => r.date === todayStr).length');
    expect(src).toContain('isNonStudentSession(');
  });

  it('TASK 3: ปุ่ม export PDF ถูก disable พร้อมข้อความ "เร็วๆ นี้" แทนการเปิด modal ปลอม', () => {
    expect(src).toContain('ส่งออกรายงานสรุปผู้บริหาร (PDF) — เร็วๆ นี้');
    // ปุ่มต้องไม่มี onClick เรียก setShowReportModal(true) จริงๆ (state/modal ทั้งคู่ถูกลบไปแล้ว)
    expect(src).not.toContain('setShowReportModal(true)');
    expect(src).not.toContain('Executive Summary Report (Preview)');
    expect(src).not.toContain('setIsGeneratingReport(true)');
  });

  it('regression guard: dashboard tab (globalKPIs/attendanceTrends/riskProfile) ไม่เหลือ mockExecutiveData แล้ว — gis/health/policy ที่เหลือรอ TASK 4/5/6 ตามลำดับ', () => {
    expect(src).not.toContain('mockExecutiveData.globalKPIs');
    expect(src).not.toContain('mockExecutiveData.attendanceTrends');
    expect(src).not.toContain('mockExecutiveData.riskProfile');
  });
});
