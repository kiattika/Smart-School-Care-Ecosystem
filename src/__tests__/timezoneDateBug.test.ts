import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';

/**
 * บั๊ก .toISOString().split('T')[0] คำนวณ "วันนี้"/วันที่ผิดช่วงเที่ยงคืน-ตี 6 กว่าๆ ตามเวลาไทย
 * (พบครั้งแรกใน SubstituteTeachingModule.tsx todayStr — หน้าลากิจ/ไปราชการ)
 *
 * .toISOString() แปลงเป็น UTC เสมอ — ประเทศไทยอยู่ UTC+7 ดังนั้นเวลาเที่ยงคืนถึงตี 6:59 ตามเวลาไทย
 * ยังเป็น "เมื่อวาน" ในมุมมอง UTC (เช่น อังคาร 01:00 น. เมืองไทย = จันทร์ 18:00 UTC) ทำให้ toISOString()
 * คืนวันที่ผิด (ลากถอยหลังไป 1 วัน) ในช่วงเวลานี้ทุกครั้ง — สภาพแวดล้อมทดสอบนี้ตั้ง timezone เป็น
 * Asia/Bangkok จริง (ยืนยันด้วย Intl.DateTimeFormat().resolvedOptions().timeZone) จึงจำลองบั๊กซ้ำได้จริง
 * ไม่ใช่แค่ทฤษฎี — ใช้ format() จาก date-fns แทนเสมอ (อ่านจาก local time fields ตรงๆ ไม่ผ่าน UTC)
 */
describe('บั๊ก timezone: .toISOString().split(\'T\')[0] ต้องไม่เหลืออยู่ในโปรเจกต์อีก', () => {
  it('ยืนยัน environment นี้ตั้งเป็น Asia/Bangkok จริง (เงื่อนไขที่ทำให้บั๊กนี้เกิดซ้ำได้)', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Asia/Bangkok');
  });

  it('พิสูจน์บั๊กจริง: เวลาตี 1 (01:00) วันอังคาร ตามเวลาไทย — toISOString() คืนวันจันทร์ (ผิด) แต่ format() คืนอังคาร (ถูก)', () => {
    // 2026-09-08 เป็นวันอังคารจริง (ตรงกับ TASK 1 ที่แก้ currentDate ไปแล้วก่อนหน้า)
    const tuesday1am = new Date(2026, 8, 8, 1, 0, 0); // เดือน 0-index: 8 = กันยายน
    expect(tuesday1am.getDay()).toBe(2); // 2 = อังคาร

    const buggyResult = tuesday1am.toISOString().split('T')[0];
    const fixedResult = format(tuesday1am, 'yyyy-MM-dd');

    expect(buggyResult).toBe('2026-09-07'); // ผิด — เพี้ยนไปเป็นวันจันทร์
    expect(fixedResult).toBe('2026-09-08'); // ถูก — ยังเป็นวันอังคารตามเวลาไทยจริง
  });

  it('เวลากลางวัน (13:00) ไม่มีบั๊กนี้ — ทั้งสองวิธีให้ผลตรงกัน (อธิบายว่าทำไมทดสอบตอนกลางวันถึงไม่เจอ)', () => {
    const tuesdayNoon = new Date(2026, 8, 8, 13, 0, 0);
    expect(tuesdayNoon.toISOString().split('T')[0]).toBe(format(tuesdayNoon, 'yyyy-MM-dd'));
  });

  // Regression guard: grep ซ้ำทั้ง src ว่าไม่มี pattern นี้หลงเหลืออยู่อีก (เจอ 12 จุดจาก 8 ไฟล์ตอนแก้รอบนี้)
  it('regression guard: ไม่มีไฟล์ไหนใน src ใช้ .toISOString().split(\'T\')[0] อีกแล้ว', () => {
    const srcDir = path.resolve(__dirname, '..');
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes(".toISOString().split('T')[0]")) {
            offenders.push(path.relative(srcDir, full));
          }
        }
      }
    }
    walk(srcDir);

    expect(offenders).toEqual([]);
  });
});
