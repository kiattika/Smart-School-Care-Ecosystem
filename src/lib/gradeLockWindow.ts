import { composeLocalMillis } from './enrollmentWindow';

/** ช่วงเปิดระบบกรอกคะแนน/ประเมิน (school_settings/system_locks → lockConfigs[]) — ตรรกะล้วนสำหรับตัวนับถอยหลัง */
export interface GradeLockLike {
  id: string; title: string; isOpen: boolean;
  startDate?: string; startTime?: string; endDate?: string; endTime?: string;
}

export interface GradeLockDeadline {
  id: string;
  title: string;
  kind: 'OPENS' | 'CLOSES';
  targetMs: number;
}

/**
 * ระบบที่ผู้ใช้ต้อง "รีบทำ": เปิดอยู่ (isOpen) และมีเวลาล็อก (endDate) ที่ยังไม่ถึง → นับถอยหลังถึงเวลาล็อก;
 * ถ้ายังไม่ถึงเวลาเปิด (startDate ในอนาคต) → นับถอยหลังถึงเวลาเปิด; ปิดอยู่/ไม่กำหนดเวลา/เลยเวลาแล้ว = ไม่แสดง
 * เวลาล็อกที่ไม่ระบุเวลา = สิ้นวัน 23:59; เวลาเปิดที่ไม่ระบุเวลา = 00:00
 */
export function gradeLockDeadlines(locks: GradeLockLike[], nowMs: number): GradeLockDeadline[] {
  const out: GradeLockDeadline[] = [];
  for (const l of locks || []) {
    if (!l?.isOpen) continue;
    const start = composeLocalMillis(l.startDate || '', l.startTime || '', '00:00');
    const end = composeLocalMillis(l.endDate || '', l.endTime || '', '23:59');
    if (start !== null && nowMs < start) { out.push({ id: l.id, title: l.title, kind: 'OPENS', targetMs: start }); continue; }
    if (end !== null && nowMs < end) out.push({ id: l.id, title: l.title, kind: 'CLOSES', targetMs: end });
  }
  return out.sort((a, b) => a.targetMs - b.targetMs);
}
