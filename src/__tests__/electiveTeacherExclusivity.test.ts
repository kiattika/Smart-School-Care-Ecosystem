import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ElectiveActivityManagerPage.tsx: ครูที่รับผิดชอบชุมนุมอื่นอยู่แล้วต้องไม่ปรากฏในรายชื่อที่เลือก
 * เพิ่มได้อีก (1 คาบเวลาสอนจริง สอนได้แค่ที่เดียว) — ยกเว้นตอนแก้ไขชุมนุมเดิม ต้องยังเห็นครูของ
 * ชุมนุมนั้นเองตามปกติ ไม่ถูกกรองตัวเองออกไปด้วย ใช้ source-inspection เพราะ mount เต็มรูปแบบต้อง
 * พึ่ง Firestore listener จำนวนมาก (ตามรูปแบบเดิมของโปรเจกต์)
 */
describe('ElectiveActivityManagerPage: กรองครูที่มีชุมนุมอื่นอยู่แล้วออกจากตัวเลือก', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../components/admin/ElectiveActivityManagerPage.tsx'), 'utf8'
  );

  it('คำนวณ teacherUidsWithOtherClub จาก configs ทั้งหมด ยกเว้นชุมนุมที่กำลังแก้ไขอยู่ (editingId)', () => {
    expect(src).toContain('if (c.id === editingId) return;');
    expect(src).toContain('(c.responsibleTeacherUids || []).forEach(uid => set.add(uid));');
  });

  it('filteredTeachers ตัดครูที่มีชุมนุมอื่นออกจากรายชื่อค้นหา/เพิ่ม', () => {
    expect(src).toContain(
      'const base = teachers.filter(t => !teacherUidsInput.includes(t.uid) && !teacherUidsWithOtherClub.has(t.uid));'
    );
  });

  it('แสดงข้อความอธิบายในหน้า UI ว่าทำไมครูบางคนไม่ปรากฏ', () => {
    expect(src).toContain('ไม่แสดงครูที่รับผิดชอบชุมนุมอื่นอยู่แล้ว');
  });

  it('startEdit ยังคง set teacherUidsInput ตรงจาก cfg เสมอ (ครูของชุมนุมที่กำลังแก้ไขไม่ถูกกรองตัวเองออก)', () => {
    expect(src).toContain('setTeacherUidsInput(cfg.responsibleTeacherUids || []);');
  });
});

/**
 * ทดสอบตรรกะการกรองแบบ pure (จำลอง configs หลายชุมนุม) เพื่อยืนยันพฤติกรรมจริง ไม่ใช่แค่ตรวจ
 * literal string — ดึง logic เดียวกับใน component มาทดสอบตรงๆ
 */
describe('teacherUidsWithOtherClub logic (จำลองจาก component จริง)', () => {
  interface Cfg { id: string; responsibleTeacherUids: string[] }

  function computeExcluded(configs: Cfg[], editingId: string | null): Set<string> {
    const set = new Set<string>();
    configs.forEach(c => {
      if (c.id === editingId) return;
      c.responsibleTeacherUids.forEach(uid => set.add(uid));
    });
    return set;
  }

  it('สร้างชุมนุม B ใหม่ (editingId = null) — ครูของชุมนุม A ถูกตัดออก', () => {
    const configs: Cfg[] = [{ id: 'club-a', responsibleTeacherUids: ['teacher-1'] }];
    const excluded = computeExcluded(configs, null);
    expect(excluded.has('teacher-1')).toBe(true);
  });

  it('แก้ไขชุมนุม A เอง (editingId = "club-a") — ครูของชุมนุม A ไม่ถูกตัดออก', () => {
    const configs: Cfg[] = [{ id: 'club-a', responsibleTeacherUids: ['teacher-1'] }];
    const excluded = computeExcluded(configs, 'club-a');
    expect(excluded.has('teacher-1')).toBe(false);
  });

  it('แก้ไขชุมนุม A แต่ครูของชุมนุม B (คนละใบ) ยังถูกตัดออกตามปกติ', () => {
    const configs: Cfg[] = [
      { id: 'club-a', responsibleTeacherUids: ['teacher-1'] },
      { id: 'club-b', responsibleTeacherUids: ['teacher-2'] },
    ];
    const excluded = computeExcluded(configs, 'club-a');
    expect(excluded.has('teacher-1')).toBe(false);
    expect(excluded.has('teacher-2')).toBe(true);
  });
});
