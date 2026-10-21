import { enrollmentState, toMillis, validateEnrollmentWindow, formatThaiDateTime, type EnrollmentState } from './enrollmentWindow';

/**
 * ช่วงเวลาเปิด–ปิดกิจกรรมที่แอดมินตั้งรวมที่เดียว (`school_settings/activity_windows`)
 * โครงเอกสาร: { windows: { [kind]: { opensAt: Timestamp|null, closesAt: Timestamp|null } }, updatedAt, updatedBy }
 *
 * - ไม่มีเอกสาร / ไม่มีช่วงของ kind นั้น / ทั้งสองเวลาว่าง = **ไม่จำกัด** (พฤติกรรมเดิมไม่เปลี่ยน)
 * - CLUB_ENROLLMENT: ใช้ "ร่วมกับ" ช่วงของแต่ละชุมนุม — เปิดสมัครได้ก็ต่อเมื่อผ่านทั้งสองชั้น
 *   (บังคับที่ firestore.rules `activityWindowOpen('CLUB_ENROLLMENT')` ด้วย — ต้องตรงกัน)
 * - SDQ_ROUND1 / LESSON_PLAN: บังคับฝั่ง client ตอนบันทึก (rules ยังไม่ตรวจเวลา) + แสดงตัวนับถอยหลัง
 * - สะท้อนคิด / PLC **ไม่มีช่วงเวลา** ทำได้ตลอดภาคเรียน (โรงเรียนกำหนด) — ใช้ `src/lib/teachingGuidance.ts` แนะนำแทน
 */
export const ACTIVITY_WINDOW_KINDS = ['CLUB_ENROLLMENT', 'SDQ_ROUND1', 'LESSON_PLAN'] as const;
export type ActivityWindowKind = (typeof ACTIVITY_WINDOW_KINDS)[number];

export const ACTIVITY_WINDOW_LABELS: Record<ActivityWindowKind, { title: string; hint: string }> = {
  CLUB_ENROLLMENT: { title: 'รับสมัครชุมนุม (ทั้งโรงเรียน)', hint: 'ใช้ร่วมกับช่วงเวลาของแต่ละชุมนุม — ต้องอยู่ในทั้งสองช่วงจึงสมัครได้' },
  SDQ_ROUND1: { title: 'ประเมิน SDQ รอบที่ 1', hint: 'นักเรียน/ผู้ปกครอง/ครูที่ปรึกษา — รอบติดตามผล (รอบ 2) ไม่ผูกช่วงนี้' },
  LESSON_PLAN: { title: 'ส่งแผน/โครงการสอน', hint: 'ครูส่งหรือส่งใหม่หลังขอแก้ไขได้เฉพาะในช่วงนี้' },
};

export interface ActivityWindowMs { opensAtMs: number | null; closesAtMs: number | null }
export type ActivityWindows = Partial<Record<ActivityWindowKind, ActivityWindowMs>>;

/** อ่านเอกสารดิบ → ms (ค่าผิดรูปแบบ = ไม่จำกัดฝั่งนั้น ไม่เดา) */
export function parseActivityWindows(data: unknown): ActivityWindows {
  const out: ActivityWindows = {};
  const raw = (data as { windows?: Record<string, { opensAt?: unknown; closesAt?: unknown }> } | null | undefined)?.windows;
  if (!raw || typeof raw !== 'object') return out;
  for (const kind of ACTIVITY_WINDOW_KINDS) {
    const w = raw[kind];
    if (!w || typeof w !== 'object') continue;
    const opensAtMs = toMillis(w.opensAt as never);
    const closesAtMs = toMillis(w.closesAt as never);
    if (opensAtMs === null && closesAtMs === null) continue;
    out[kind] = { opensAtMs, closesAtMs };
  }
  return out;
}

/** สถานะของช่วง (ไม่มีช่วง = OPEN ไม่มีเวลาปิด) */
export function activityWindowState(kind: ActivityWindowKind, windows: ActivityWindows, nowMs: number): EnrollmentState {
  const w = windows[kind];
  return enrollmentState(
    { enrollmentStatus: 'OPEN', enrollmentOpensAt: w?.opensAtMs ?? null, enrollmentClosesAt: w?.closesAtMs ?? null },
    nowMs,
  );
}

export const isActivityWindowOpen = (kind: ActivityWindowKind, windows: ActivityWindows, nowMs: number) =>
  activityWindowState(kind, windows, nowMs).phase === 'OPEN';

/** ข้อความอธิบายเมื่อยังไม่เปิด/ปิดแล้ว (OPEN = null) */
export function activityWindowBlockMessage(kind: ActivityWindowKind, windows: ActivityWindows, nowMs: number): string | null {
  const st = activityWindowState(kind, windows, nowMs);
  const name = ACTIVITY_WINDOW_LABELS[kind].title;
  if (st.phase === 'NOT_YET' && st.opensAtMs !== null) return `"${name}" ยังไม่เปิด — เปิด ${formatThaiDateTime(st.opensAtMs)}`;
  if (st.phase === 'CLOSED') return `"${name}" ปิดแล้ว${st.closesAtMs !== null ? ` (ปิด ${formatThaiDateTime(st.closesAtMs)})` : ''} — ติดต่อผู้ดูแลระบบหากต้องการเปิดเพิ่ม`;
  return null;
}

export { validateEnrollmentWindow as validateActivityWindow };
