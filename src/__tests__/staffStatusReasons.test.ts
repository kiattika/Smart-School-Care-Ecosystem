import { describe, it, expect } from 'vitest';
import * as client from '../lib/staffStatusReasons';
import * as server from '../../functions/src/staffStatusReasons';
import { readSource } from './helpers/readSource';

const { validateStatusRequest, INACTIVE_STAFF_REASONS, STAFF_STATUS_LABELS_TH, inactiveStaffLabelTh } = client;

describe('เหตุผลสิ้นสุดการใช้งานบุคลากร (มาตรา 107)', () => {
  it('enum ครบ 7 ค่า; ฟอร์มเลือกได้ 6 แบบ (ไม่รวม ACTIVE) และทุกค่ามีป้ายภาษาไทย', () => {
    expect([...client.STAFF_STATUS_REASONS]).toEqual([
      'ACTIVE', 'RETIRED', 'RESIGNED', 'TRANSFERRED', 'ORDERED_TO_LEAVE', 'DISCIPLINARY_DISMISSAL', 'DECEASED',
    ]);
    expect(INACTIVE_STAFF_REASONS).toHaveLength(6);
    expect(INACTIVE_STAFF_REASONS).not.toContain('ACTIVE');
    for (const r of client.STAFF_STATUS_REASONS) expect(STAFF_STATUS_LABELS_TH[r]).toBeTruthy();
  });

  describe('ปิดการใช้งาน (active=false)', () => {
    it('ไม่มี statusReason / ACTIVE / ค่าที่ไม่รู้จัก / ชนิดผิด → ปฏิเสธ (แม้มีหมายเหตุ)', () => {
      for (const bad of [undefined, null, '', 'ACTIVE', 'FIRED', 'retired', 5, {}]) {
        expect(validateStatusRequest({ active: false, statusReason: bad, reason: 'มีหมายเหตุ' })).toMatchObject({ ok: false });
      }
    });
    it('เหตุผลทั้ง 6 แบบผ่านโดยไม่ต้องมีหมายเหตุ ยกเว้น ORDERED_TO_LEAVE', () => {
      for (const r of INACTIVE_STAFF_REASONS.filter((x) => x !== 'ORDERED_TO_LEAVE')) {
        expect(validateStatusRequest({ active: false, statusReason: r })).toEqual({ ok: true, statusReason: r, note: '' });
        expect(validateStatusRequest({ active: false, statusReason: r, reason: '   ' })).toEqual({ ok: true, statusReason: r, note: '' });
      }
    });
    it('ORDERED_TO_LEAVE บังคับหมายเหตุ (ว่าง/ช่องว่างล้วน/ไม่ใช่สตริง = ปฏิเสธ)', () => {
      for (const reason of [undefined, '', '   ', 7]) {
        const r = validateStatusRequest({ active: false, statusReason: 'ORDERED_TO_LEAVE', reason });
        expect(r).toMatchObject({ ok: false, message: expect.stringContaining('หมายเหตุ') });
      }
      expect(validateStatusRequest({ active: false, statusReason: 'ORDERED_TO_LEAVE', reason: ' มาตรา 107 (4) ' }))
        .toEqual({ ok: true, statusReason: 'ORDERED_TO_LEAVE', note: 'มาตรา 107 (4)' });
    });
    it('หมายเหตุยาวเกิน 500 ตัวอักษร → ปฏิเสธ', () => {
      expect(validateStatusRequest({ active: false, statusReason: 'RETIRED', reason: 'ก'.repeat(501) })).toMatchObject({ ok: false });
      expect(validateStatusRequest({ active: false, statusReason: 'RETIRED', reason: 'ก'.repeat(500) })).toMatchObject({ ok: true });
    });
  });

  describe('เปิดการใช้งาน (active=true)', () => {
    it('statusReason เป็น ACTIVE เสมอ; ไม่ส่งมาก็ได้; ส่งค่าอื่นมา = ปฏิเสธ', () => {
      expect(validateStatusRequest({ active: true })).toEqual({ ok: true, statusReason: 'ACTIVE', note: '' });
      expect(validateStatusRequest({ active: true, statusReason: 'ACTIVE', reason: '' })).toMatchObject({ ok: true });
      expect(validateStatusRequest({ active: true, statusReason: 'RETIRED' })).toMatchObject({ ok: false });
    });
  });

  it('ป้ายในรายการ: ใช้คำไทยของเหตุผล; ข้อมูลเก่าที่ปิดไว้ก่อนมีระบบนี้ = "ปิดการใช้งาน"', () => {
    expect(inactiveStaffLabelTh('RETIRED')).toBe('เกษียณอายุราชการ');
    expect(inactiveStaffLabelTh('DECEASED')).toBe('ถึงแก่กรรม');
    expect(inactiveStaffLabelTh(undefined)).toBe('ปิดการใช้งาน');
    expect(inactiveStaffLabelTh('ACTIVE')).toBe('ปิดการใช้งาน');
    expect(inactiveStaffLabelTh('bogus')).toBe('ปิดการใช้งาน');
  });

  it('สำเนา functions/src/staffStatusReasons.ts ตรงกับ client ทั้งค่า enum และผลการตรวจ', () => {
    expect([...server.STAFF_STATUS_REASONS]).toEqual([...client.STAFF_STATUS_REASONS]);
    expect([...server.REASONS_REQUIRING_NOTE]).toEqual([...client.REASONS_REQUIRING_NOTE]);
    expect(server.MAX_NOTE_LENGTH).toBe(client.MAX_NOTE_LENGTH);
    const reasons: unknown[] = [undefined, null, '', 'ACTIVE', 'FIRED', ...client.STAFF_STATUS_REASONS];
    const notes: unknown[] = [undefined, '', '  ', 'x', 'ก'.repeat(501)];
    for (const active of [true, false]) for (const statusReason of reasons) for (const reason of notes) {
      expect(server.validateStatusRequest({ active, statusReason, reason })).toEqual(client.validateStatusRequest({ active, statusReason, reason }));
    }
  });

  it('setStaffActive ใช้ validateStatusRequest และเขียน statusReason ลงเอกสาร (guard)', () => {
    const src = readSource('functions/src/staffAdmin.ts');
    expect(src).toMatch(/validateStatusRequest\(\{ active, statusReason, reason \}\)/);
    expect(src).toMatch(/statusReason: request\.statusReason/);
    expect(src).toMatch(/statusReason: 'ACTIVE'/);
  });
});
