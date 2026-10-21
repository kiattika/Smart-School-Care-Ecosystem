import { gradeLockDeadlines, type GradeLockLike } from './gradeLockWindow';
import { enrollmentState, type EnrollmentWindowInput } from './enrollmentWindow';
import { resolveLateRequest, type LateFlowRequest } from './lateAttendanceFlow';

/**
 * ทะเบียนตัวนับถอยหลังกลาง — ทุกกำหนดเวลาที่ผู้ใช้ต้องรีบทำ รวมไว้ที่นี่ที่เดียว (ตรรกะล้วน)
 * แหล่งใหม่: เพิ่ม builder ในไฟล์นี้ + ต่อใน `useAppCountdowns` — ห้ามทำตัวนับถอยหลังเฉพาะกิจกระจัดกระจาย
 * ตอนเปิดแอปแสดง "ใกล้สุด 3 อันดับแรก" (`topCountdowns`) ผ่าน AppCountdownStrip
 */
export type CountdownSource = 'GRADE_LOCK' | 'CLUB_ENROLLMENT' | 'LATE_ATTENDANCE';

export interface CountdownEntry {
  id: string;
  source: CountdownSource;
  title: string;
  /** คำนำหน้าเวลา เช่น "ล็อกระบบใน" / "ปิดรับใน" */
  label: string;
  targetMs: number;
}

export const TOP_COUNTDOWNS = 3;

export function gradeLockEntries(locks: GradeLockLike[], nowMs: number): CountdownEntry[] {
  return gradeLockDeadlines(locks, nowMs).map((d) => ({
    id: `grade-lock:${d.id}:${d.kind}`,
    source: 'GRADE_LOCK' as const,
    title: d.title,
    label: d.kind === 'OPENS' ? 'เปิดให้กรอกใน' : 'ล็อกระบบใน',
    targetMs: d.targetMs,
  }));
}

/** ชุมนุมที่เปิดรับอยู่และมีเวลาปิด (ไม่มีเวลาปิด = ไม่มีอะไรให้นับ) */
export function clubEntries(clubs: Array<EnrollmentWindowInput & { id: string; name?: string }>, nowMs: number): CountdownEntry[] {
  const out: CountdownEntry[] = [];
  for (const c of clubs) {
    const st = enrollmentState(c, nowMs);
    if (st.phase === 'OPEN' && st.closesAtMs !== null) {
      out.push({ id: `club:${c.id}`, source: 'CLUB_ENROLLMENT', title: c.name ? `สมัครชุมนุม: ${c.name}` : 'สมัครชุมนุม', label: 'ปิดรับใน', targetMs: st.closesAtMs });
    }
  }
  return out;
}

/** คำขอเช็คชื่อย้อนหลังของฉันที่อนุมัติแล้วและยังใช้สิทธิ์ได้ — นับถอยหลังถึงเวลาหมดสิทธิ์ (รวมเวลาที่ขยาย) */
export function lateAttendanceEntries(myRequests: Array<LateFlowRequest & { id: string; subjectName?: string; periodNumber?: number; teachingDate?: string }>, nowMs: number): CountdownEntry[] {
  const out: CountdownEntry[] = [];
  for (const r of myRequests) {
    const res = resolveLateRequest(r, nowMs);
    if (res.state === 'OPEN' && res.usableUntil !== null && res.usableUntil > nowMs) {
      const what = [r.subjectName, r.periodNumber !== undefined ? `คาบ ${r.periodNumber}` : '', r.teachingDate].filter(Boolean).join(' ');
      out.push({ id: `late:${r.id}`, source: 'LATE_ATTENDANCE', title: `เช็คชื่อย้อนหลัง${what ? `: ${what}` : ''}`, label: 'หมดสิทธิ์ใน', targetMs: res.usableUntil });
    }
  }
  return out;
}

/** เรียงใกล้สุดก่อน ตัดที่เลยเวลาแล้ว ซ้ำ id เหลือรายการเดียว และเอาแค่ `limit` อันดับแรก */
export function topCountdowns(entries: CountdownEntry[], nowMs: number, limit = TOP_COUNTDOWNS): CountdownEntry[] {
  const seen = new Set<string>();
  return entries
    .filter((e) => e.targetMs > nowMs && !seen.has(e.id) && (seen.add(e.id), true))
    .sort((a, b) => a.targetMs - b.targetMs)
    .slice(0, limit);
}
