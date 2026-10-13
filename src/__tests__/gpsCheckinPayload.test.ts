import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { omitUndefined } from '../lib/firestorePayload';
import { fitWithin } from '../lib/selfieThumbnail';

describe('omitUndefined', () => {
  it('ตัด key ที่เป็น undefined แต่คงค่า null/0/""/false', () => {
    expect(omitUndefined({ a: 1, b: undefined, c: null, d: 0, e: '', f: false })).toEqual({ a: 1, c: null, d: 0, e: '', f: false });
  });
});

describe('fitWithin', () => {
  it('ย่อด้านยาวไม่เกินเพดานคงสัดส่วน และไม่ขยายรูปเล็ก', () => {
    expect(fitWithin(4000, 3000, 240)).toEqual({ width: 240, height: 180 });
    expect(fitWithin(100, 80, 240)).toEqual({ width: 100, height: 80 });
  });
});

describe('guard: เช็คอิน GPS เขียน Firestore ได้จริง', () => {
  const fs = readSource('src/services/firestoreService.ts');
  const body = (name: string) => {
    const i = fs.indexOf(`export async function ${name}`);
    return fs.slice(i, fs.indexOf('\n}\n', i));
  };
  it('ตัวบันทึก GPS log / gate log ตัด undefined ก่อน setDoc', () => {
    expect(body('saveGPSCheckInLogFirestore')).toMatch(/omitUndefined\(/);
    expect(body('saveGateAttendanceRecordFirestore')).toMatch(/omitUndefined\(/);
  });
  it('โมดัลไม่เก็บ data URL ของรูปเต็ม (ย่อภาพก่อน)', () => {
    const m = readSource('src/components/GPSGeofenceCheckinModal.tsx');
    expect(m).not.toMatch(/readAsDataURL/);
    expect(m).toMatch(/selfieThumbnailDataUrl\(/);
  });
  it('store ใส่ authUid ใน GPS log และ rules เทียบ authUid', () => {
    expect(readSource('src/store.ts')).toMatch(/\{ authUid \}/);
    expect(readSource('firestore.rules')).toMatch(/request\.resource\.data\.authUid == request\.auth\.uid/);
  });
});

import { describeCheckinError } from '../components/GPSGeofenceCheckinModal';
describe('describeCheckinError', () => {
  it('แยกสาเหตุ: สิทธิ์ / เครือข่าย / อื่น ๆ พร้อมรหัส', () => {
    expect(describeCheckinError(new Error("FIRESTORE_PERMISSION-DENIED: Operation 'write' failed on resource."))).toMatch(/ไม่อนุญาต.*PERMISSION-DENIED/);
    expect(describeCheckinError(new Error("FIRESTORE_UNAVAILABLE: x"))).toMatch(/อินเทอร์เน็ต/);
    expect(describeCheckinError(new Error("FIRESTORE_INVALID-ARGUMENT: x"))).toMatch(/INVALID-ARGUMENT/);
    expect(describeCheckinError('boom')).toMatch(/ไม่สำเร็จ/);
  });
  it('store ใช้ authUid เป็น studentUid ก่อนค่าใน students doc', () => {
    expect(readSource('src/store.ts')).toMatch(/studentUid = authUid \|\| matchedStudent\?\.studentUid/);
  });
});
