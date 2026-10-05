/**
 * ทะเบียนเลขประจำตัวนักเรียน — student_id_registry/{studentId}
 * เก็บประวัติว่าเลขนี้เคยถูกใครถือ (เมื่อนักเรียนไม่ได้ศึกษาต่อ เลขถูกเรียกคืน แล้วอาจออกให้คนใหม่)
 *
 * logic ล้วน (ไม่แตะ Firestore) — ทดสอบที่ src/__tests__/studentIdRegistry.test.ts
 * วันที่เก็บเป็นสตริง 'YYYY-MM-DD' (ใส่ serverTimestamp ใน array ไม่ได้)
 */
import { isStudentActive, type StudentStatusReason, type StudentStatusFields } from './studentStatus';

export interface RegistryEntry {
  heldBy: string;                       // ชื่อผู้ถือเลข
  from: string | null;                  // วันที่เริ่มถือ (null = ไม่ทราบ — นักเรียนเดิมก่อนมีทะเบียน)
  to: string | null;                    // วันที่ปล่อยเลข (null = ยังถืออยู่)
  reason: StudentStatusReason | null;   // statusReason ตอนปล่อยเลข
}

export interface RegistryDoc {
  studentId: string;
  entries: RegistryEntry[];
}

export const openEntryIndex = (entries: RegistryEntry[]): number => entries.findIndex((e) => e.to === null);

export function todayISO(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface StatusChangeInput {
  heldBy: string;
  /** สถานะก่อนเปลี่ยน */
  previous: StudentStatusFields;
  target: StudentStatusReason;
  /** วันที่มีผล */
  at: string;
  /** วันเริ่มถือเลขถ้าทราบ (เช่น createdAt ของนักเรียน) ใช้เมื่อต้องสร้างรายการย้อนหลัง */
  knownFrom?: string | null;
}

/**
 * คืน entries ใหม่หลังเปลี่ยนสถานะ (ไม่แก้ array เดิม)
 * - ACTIVE → ไม่ใช่ ACTIVE: ปิดรายการที่เปิดอยู่ (to=at, reason=target); ไม่มีรายการเปิด (นักเรียนก่อนมีทะเบียน)
 *   = สร้างรายการปิดให้ทันที {from: knownFrom ?? null}
 * - ไม่ใช่ ACTIVE → ไม่ใช่ ACTIVE (แก้เหตุผล): แก้ reason ของรายการล่าสุด ไม่เพิ่มแถว
 * - ไม่ใช่ ACTIVE → ACTIVE (กลับมาเรียน): เพิ่มรายการเปิดใหม่ของผู้ถือคนเดิม (ประวัติเดิมคงอยู่)
 */
export function applyStatusChange(entries: RegistryEntry[], input: StatusChangeInput): RegistryEntry[] {
  const next = entries.map((e) => ({ ...e }));
  const wasActive = isStudentActive(input.previous);
  const willBeActive = input.target === 'ACTIVE';
  const open = openEntryIndex(next);

  if (wasActive && !willBeActive) {
    if (open >= 0) next[open] = { ...next[open], to: input.at, reason: input.target };
    else next.push({ heldBy: input.heldBy, from: input.knownFrom ?? null, to: input.at, reason: input.target });
    return next;
  }
  if (!wasActive && !willBeActive) {
    if (open >= 0) next[open] = { ...next[open], to: input.at, reason: input.target };
    else if (next.length > 0) next[next.length - 1] = { ...next[next.length - 1], reason: input.target };
    else next.push({ heldBy: input.heldBy, from: input.knownFrom ?? null, to: input.at, reason: input.target });
    return next;
  }
  if (!wasActive && willBeActive) {
    if (open < 0) next.push({ heldBy: input.heldBy, from: input.at, to: null, reason: null });
    return next;
  }
  return next; // ACTIVE → ACTIVE: ไม่มีอะไรเปลี่ยน
}

/** เพิ่มรายการเปิดสำหรับผู้ถือเลขคนใหม่; ปิดรายการค้างเปิดของคนก่อน (ถ้ามี) */
export function assignId(
  entries: RegistryEntry[],
  heldBy: string,
  at: string,
  closePreviousReason: StudentStatusReason | null = null,
): RegistryEntry[] {
  const next = entries.map((e) => ({ ...e }));
  const open = openEntryIndex(next);
  if (open >= 0) next[open] = { ...next[open], to: at, reason: closePreviousReason };
  next.push({ heldBy, from: at, to: null, reason: null });
  return next;
}

export type IdConflict =
  | { level: 'none' }
  | { level: 'history'; entries: RegistryEntry[]; existingHolder?: string }
  | { level: 'active-holder'; entries: RegistryEntry[]; existingHolder: string };

/**
 * ตรวจเลขประจำตัวก่อนเพิ่มนักเรียนใหม่ — แค่ "เตือน" ไม่บล็อก
 * - มีเอกสาร students/{id} ที่ยังศึกษาอยู่ = active-holder (การบันทึกจะเขียนทับคนที่ถืออยู่จริง)
 * - เคยมีประวัติในทะเบียน หรือมีเอกสารนักเรียนที่ไม่ใช่ ACTIVE = history
 */
export function detectIdConflict(
  registry: RegistryDoc | null | undefined,
  existing: (StudentStatusFields & { fullName?: string }) | null | undefined,
): IdConflict {
  const entries = registry?.entries ?? [];
  if (existing) {
    const name = existing.fullName || '(ไม่ทราบชื่อ)';
    return isStudentActive(existing)
      ? { level: 'active-holder', entries, existingHolder: name }
      : { level: 'history', entries, existingHolder: name };
  }
  if (entries.length > 0) return { level: 'history', entries };
  return { level: 'none' };
}

/** ผู้ที่ถือเลขนี้อยู่ตอนนี้ (รายการเปิด) */
export function currentHolder(entries: RegistryEntry[]): RegistryEntry | null {
  const i = openEntryIndex(entries);
  return i >= 0 ? entries[i] : null;
}
