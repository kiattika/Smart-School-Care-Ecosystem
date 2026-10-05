import { describe, it, expect } from 'vitest';
import {
  applyStatusChange, assignId, currentHolder, detectIdConflict, todayISO, type RegistryEntry,
} from '../lib/studentIdRegistry';
import {
  INACTIVE_STATUS_REASONS, STUDENT_STATUS_REASONS, currentStatusReason, isStudentActive, statusFieldsFor, validateStatusChange,
} from '../lib/studentStatus';
import { readSource } from './helpers/readSource';

describe('สถานะนักเรียน', () => {
  it('มี 8 ค่าตามที่กำหนด และฟอร์มเลือกได้ 7 แบบ (ไม่รวม ACTIVE)', () => {
    expect([...STUDENT_STATUS_REASONS]).toEqual([
      'ACTIVE', 'GRADUATED', 'WITHDRAWN', 'TRANSFERRED', 'EXPELLED', 'ABSENT_WITHDRAWN', 'DECEASED', 'IMPRISONED',
    ]);
    expect(INACTIVE_STATUS_REASONS).toHaveLength(7);
    expect(INACTIVE_STATUS_REASONS).not.toContain('ACTIVE');
  });
  it('ข้อมูลเดิมที่ไม่มี field = ACTIVE; INACTIVE ที่ไม่มีเหตุผล = ไม่ได้ศึกษาต่อ', () => {
    expect(isStudentActive({})).toBe(true);
    expect(isStudentActive({ status: 'ACTIVE' })).toBe(true);
    expect(isStudentActive({ status: 'INACTIVE' })).toBe(false);
    expect(currentStatusReason({ status: 'INACTIVE' })).toBe('UNKNOWN_INACTIVE');
    expect(isStudentActive({ status: 'INACTIVE', statusReason: 'ACTIVE' })).toBe(true); // statusReason ชนะ
    expect(isStudentActive({ status: 'ACTIVE', statusReason: 'GRADUATED' })).toBe(false);
  });
  it('บังคับหมายเหตุทุกสถานะที่ไม่ใช่ ACTIVE; กลับ ACTIVE ไม่บังคับ; ห้ามเปลี่ยนเป็นสถานะเดิม', () => {
    for (const r of INACTIVE_STATUS_REASONS) {
      expect(validateStatusChange(r, '', {})).toEqual({ ok: false, error: expect.stringContaining('หมายเหตุ') });
      expect(validateStatusChange(r, '   ', {})).toMatchObject({ ok: false });
      expect(validateStatusChange(r, 'หนังสือที่ 1/2569', {})).toEqual({ ok: true });
    }
    expect(validateStatusChange('ACTIVE', '', { status: 'INACTIVE', statusReason: 'WITHDRAWN' })).toEqual({ ok: true });
    expect(validateStatusChange('WITHDRAWN', 'x', { status: 'INACTIVE', statusReason: 'WITHDRAWN' })).toMatchObject({ ok: false });
  });
  it('statusFieldsFor: status สอดคล้องกับ statusReason และเก็บ uid ผู้เปลี่ยน', () => {
    expect(statusFieldsFor('GRADUATED', ' จบ ม.6 ', 'uid-1')).toEqual({ status: 'INACTIVE', statusReason: 'GRADUATED', statusNote: 'จบ ม.6', statusChangedBy: 'uid-1' });
    expect(statusFieldsFor('ACTIVE', '', 'uid-1').status).toBe('ACTIVE');
  });
});

describe('ทะเบียนเลขประจำตัว — applyStatusChange', () => {
  const at = '2026-10-05';
  it('ปิดรายการที่เปิดอยู่ (to=วันที่, reason=สถานะที่ปล่อยเลข) โดยไม่แก้ array เดิม', () => {
    const entries: RegistryEntry[] = [{ heldBy: 'สมชาย', from: '2024-05-15', to: null, reason: null }];
    const out = applyStatusChange(entries, { heldBy: 'สมชาย', previous: {}, target: 'WITHDRAWN', at });
    expect(out).toEqual([{ heldBy: 'สมชาย', from: '2024-05-15', to: at, reason: 'WITHDRAWN' }]);
    expect(entries[0].to).toBeNull();
    expect(currentHolder(out)).toBeNull();
  });
  it('ปิดเฉพาะรายการที่เปิด — ไม่แตะผู้ถือคนก่อนๆ', () => {
    const entries: RegistryEntry[] = [
      { heldBy: 'คนแรก', from: '2020-05-01', to: '2023-03-31', reason: 'GRADUATED' },
      { heldBy: 'คนที่สอง', from: '2023-05-15', to: null, reason: null },
    ];
    const out = applyStatusChange(entries, { heldBy: 'คนที่สอง', previous: {}, target: 'TRANSFERRED', at });
    expect(out[0]).toEqual(entries[0]);
    expect(out[1]).toEqual({ heldBy: 'คนที่สอง', from: '2023-05-15', to: at, reason: 'TRANSFERRED' });
  });
  it('นักเรียนเดิมก่อนมีทะเบียน (ไม่มีรายการเปิด) → สร้างรายการปิดให้ทันที', () => {
    const out = applyStatusChange([], { heldBy: 'สมศรี', previous: {}, target: 'GRADUATED', at, knownFrom: '2021-05-10' });
    expect(out).toEqual([{ heldBy: 'สมศรี', from: '2021-05-10', to: at, reason: 'GRADUATED' }]);
    expect(applyStatusChange([], { heldBy: 'x', previous: {}, target: 'DECEASED', at })[0].from).toBeNull();
  });
  it('แก้เหตุผลระหว่างสถานะที่ไม่ใช่ ACTIVE = แก้ reason ของรายการล่าสุด ไม่เพิ่มแถว', () => {
    const entries: RegistryEntry[] = [{ heldBy: 'ก', from: '2022-05-01', to: '2025-01-01', reason: 'WITHDRAWN' }];
    const out = applyStatusChange(entries, { heldBy: 'ก', previous: { status: 'INACTIVE', statusReason: 'WITHDRAWN' }, target: 'TRANSFERRED', at });
    expect(out).toEqual([{ heldBy: 'ก', from: '2022-05-01', to: '2025-01-01', reason: 'TRANSFERRED' }]);
  });
  it('กลับมาเรียน (→ ACTIVE) = เพิ่มรายการเปิดใหม่ ประวัติเดิมคงอยู่', () => {
    const entries: RegistryEntry[] = [{ heldBy: 'ก', from: '2022-05-01', to: '2025-01-01', reason: 'WITHDRAWN' }];
    const out = applyStatusChange(entries, { heldBy: 'ก', previous: { status: 'INACTIVE', statusReason: 'WITHDRAWN' }, target: 'ACTIVE', at });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(entries[0]);
    expect(out[1]).toEqual({ heldBy: 'ก', from: at, to: null, reason: null });
    // ACTIVE → ACTIVE ไม่เปลี่ยนอะไร
    expect(applyStatusChange(out, { heldBy: 'ก', previous: {}, target: 'ACTIVE', at })).toEqual(out);
  });
});

describe('ทะเบียนเลขประจำตัว — assignId / detectIdConflict', () => {
  const at = '2026-10-05';
  it('ออกเลขให้คนใหม่: เพิ่มรายการเปิด และปิดรายการค้างเปิดของคนก่อน', () => {
    const prev: RegistryEntry[] = [{ heldBy: 'เก่า', from: '2020-05-01', to: null, reason: null }];
    const out = assignId(prev, 'ใหม่', at, 'WITHDRAWN');
    expect(out).toEqual([
      { heldBy: 'เก่า', from: '2020-05-01', to: at, reason: 'WITHDRAWN' },
      { heldBy: 'ใหม่', from: at, to: null, reason: null },
    ]);
    expect(assignId([], 'แรก', at)).toEqual([{ heldBy: 'แรก', from: at, to: null, reason: null }]);
    expect(currentHolder(out)?.heldBy).toBe('ใหม่');
  });
  it('ตรวจพบเลขซ้ำ: ไม่มีประวัติ = none; มีประวัติ/เอกสารเดิมไม่ใช่ ACTIVE = history; ผู้ถือยังศึกษาอยู่ = active-holder', () => {
    const entries: RegistryEntry[] = [{ heldBy: 'เก่า', from: null, to: '2024-03-31', reason: 'GRADUATED' }];
    expect(detectIdConflict(null, null)).toEqual({ level: 'none' });
    expect(detectIdConflict({ studentId: '1', entries: [] }, null)).toEqual({ level: 'none' });
    expect(detectIdConflict({ studentId: '1', entries }, null)).toEqual({ level: 'history', entries });
    expect(detectIdConflict(null, { status: 'INACTIVE', statusReason: 'WITHDRAWN', fullName: 'เก่า' }))
      .toMatchObject({ level: 'history', existingHolder: 'เก่า' });
    expect(detectIdConflict({ studentId: '1', entries }, { status: 'ACTIVE', fullName: 'คนปัจจุบัน' }))
      .toMatchObject({ level: 'active-holder', existingHolder: 'คนปัจจุบัน' });
  });
  it('todayISO รูปแบบ YYYY-MM-DD', () => {
    expect(todayISO(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
});

describe('guard: หน้าจัดการนักเรียนห้ามลบถาวร', () => {
  it('ไม่มี deleteDoc / ไอคอนถังขยะ ใน StudentManagementPage และ rules ปฏิเสธ delete students', () => {
    const page = readSource('src/components/StudentManagementPage.tsx');
    expect(page).not.toMatch(/deleteDoc/);
    expect(page).not.toMatch(/Trash2/);
    const rules = readSource('firestore.rules');
    const block = rules.slice(rules.indexOf('match /students/{studentId}'));
    expect(block.slice(0, block.indexOf('match /student_id_registry')).match(/allow delete: if false;/)).not.toBeNull();
  });
});
