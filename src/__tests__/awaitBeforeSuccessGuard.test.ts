import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('guard: ห้ามแจ้งสำเร็จก่อนเขียน Firestore จริง (บันทึกหลังสอน / ข้อความผู้ปกครอง / ตั้งค่าพิกัดโรงเรียน)', () => {
  const svc = readSource('src/services/firestoreService.ts');
  const store = readSource('src/store.ts');

  it('บริการบันทึกหลังสอน/ข้อความผู้ปกครอง throw ผ่าน handleFirestoreError', () => {
    for (const fn of ['savePostTeachingRecordFirestore', 'sendParentTeacherMessageFirestore']) {
      const i = svc.indexOf(`export async function ${fn}`);
      const block = svc.slice(i, svc.indexOf('\n}\n', i) + 3);
      expect(block).toContain('handleFirestoreError(error, OperationType.WRITE');
      expect(block).not.toMatch(/console\.warn/);
    }
  });
  it('store: await การเขียนก่อนอัปเดต state', () => {
    expect(store).toMatch(/submitPostTeachingRecord: async[\s\S]{0,200}await savePostTeachingRecordFirestore\(record\)/);
    expect(store).toMatch(/sendParentTeacherMessage: async[\s\S]{0,800}await sendParentTeacherMessageFirestore\(newMsg\)/);
  });
  it('store: updateSchoolGeofenceConfig ไม่เขียน Firestore ซ้ำ (ผู้เรียก await เอง)', () => {
    const i = store.indexOf('updateSchoolGeofenceConfig: (config)');
    const block = store.slice(i, i + 400);
    expect(block).not.toMatch(/saveSchoolGeofenceConfigFirestore/);
  });
  it('UI: จับ error แล้วแจ้งผู้ใช้ ไม่ล้างฟอร์ม/ปิดโมดัลเมื่อบันทึกไม่สำเร็จ', () => {
    const tp = readSource('src/TeacherPortal.tsx');
    expect(tp).toMatch(/await submitPostTeachingRecord\(/);
    expect(tp).toMatch(/บันทึกหลังสอนไม่สำเร็จ/);
    const pe = readSource('src/components/student-parent/ParentEngagementServices.tsx');
    expect(pe).toMatch(/await sendParentTeacherMessage\(/);
    expect(pe).toMatch(/setMsgError\(/);
  });
  it('โหมดจำลองพิกัดไม่มีพิกัดสำรองฝังตายตัว', () => {
    expect(readSource('src/components/GPSGeofenceCheckinModal.tsx')).not.toMatch(/17\.625|100\.093|100\.094/);
  });
});
