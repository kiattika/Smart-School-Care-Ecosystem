import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * TASK 5 (ชุดใหญ่ ครูร่วมสอน+สอนแทน/ลา): ยืนยันแล้วว่าระบบมอบหมายสอนแทน/ลา แบบเลือกเฉพาะบางคาบ
 * (ไม่บังคับทั้งวัน) ทำงานถูกต้องอยู่แล้วจริงใน SubstituteTeachingModule.tsx — ไม่ได้แก้โค้ดใน task
 * นี้ ตามที่ระบุไว้ แค่เพิ่ม regression test ยืนยันพฤติกรรมไว้กันการเผลอทำให้ regression ในอนาคต
 * (เช่น เผลอเปลี่ยนไปส่งคำขอครอบคลุมทั้งวันโดยไม่ได้ตั้งใจตอนแก้โค้ดจุดอื่น)
 *
 * ตรวจผ่านการอ่าน source โดยตรง (ตาม pattern เดียวกับ hooksWriteFailure.test.ts ในโปรเจกต์นี้)
 * เพราะ handlePropose ผูกกับ component state จริงหลายตัว การ mount component เต็มรูปแบบเพื่อทดสอบ
 * แค่ตรรกะกรองคาบนี้จุดเดียวจะหนักเกินความจำเป็น
 */
describe('Substitute assignment — per-period granularity (not forced whole-day)', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/components/SubstituteTeachingModule.tsx'),
    'utf8'
  );

  it('submits only the explicitly-selected slots, not every slot in the leave date range', () => {
    // slots ที่จะส่งคำขอจริงต้องมาจากการกรอง rangeSlots ด้วย selectedSlotKeys เท่านั้น
    // (ไม่ใช่ใช้ rangeSlots ทั้งก้อนตรงๆ ซึ่งจะเท่ากับบังคับทั้งวัน)
    expect(source).toContain('const slots = rangeSlots.filter(s => selectedSlotKeys.has(slotKey(s)));');
  });

  it('blocks submission when zero slots are selected (cannot silently default to "all day")', () => {
    expect(source).toContain('if (!absent || slots.length === 0)');
    // ปุ่มส่งคำขอเองก็ต้อง disabled ตอนยังไม่เลือกคาบไหนเลย ไม่ใช่แค่เช็คตอน submit
    expect(source).toMatch(/disabled=\{submitting \|\| !absentEmail \|\| selectedSlotKeys\.size === 0\}/);
  });

  it('renders each date/period slot as an independently toggleable checkbox (checked from selectedSlotKeys)', () => {
    expect(source).toContain('const checked = selectedSlotKeys.has(key);');
  });

  it('writes one substitute-assignment record per selected slot (not one record covering the whole range)', () => {
    // การเขียนจริงวนลูปต่อ "slot ที่เลือกเท่านั้น" (ตัวแปร slots ที่กรองแล้ว) ไม่ใช่ rangeSlots ดิบ
    expect(source).toContain('for (const slot of slots) {');
    expect(source).not.toContain('for (const slot of rangeSlots) {');
  });
});
