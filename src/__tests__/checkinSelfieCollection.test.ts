import { describe, it, expect } from 'vitest';
import { selfieExpiresAt, SELFIE_RETENTION_DAYS, SELFIE_COLLECTION } from '../lib/selfieRetention';
import { readSource } from './helpers/readSource';

describe('selfie retention', () => {
  it('หมดอายุใน 30 วันนับจากตอนบันทึก และอยู่ในกรอบที่ rules อนุญาต (≤ 31 วัน)', () => {
    const now = new Date('2026-10-13T00:00:00Z');
    expect(selfieExpiresAt(now).getTime() - now.getTime()).toBe(SELFIE_RETENTION_DAYS * 86_400_000);
    expect(SELFIE_RETENTION_DAYS).toBeLessThanOrEqual(31);
    expect(SELFIE_COLLECTION).toBe('gps_checkin_selfies');
  });
});

describe('guards: รูปเซลฟี่แยกเอกสาร + ครูอ่านเฉพาะห้อง', () => {
  const store = readSource('src/store.ts');
  it('addGPSCheckInLog ไม่ฝังรูปใน gps log / gate log แต่เซฟรูปแยกก่อน', () => {
    const i = store.indexOf('addGPSCheckInLog: async');
    const block = store.slice(i, i + 4500);
    expect(block).toContain('const { selfieUrl: selfieDataUrl, ...logNoSelfie } = log');
    expect(block).toContain('await saveCheckInSelfieFirestore(');
    expect(block).not.toMatch(/selfieUrl: log\.selfieUrl/);
    expect(block.indexOf('saveCheckInSelfieFirestore(')).toBeLessThan(block.indexOf('await saveGPSCheckInLogFirestore(newLog)'));
  });
  it('ห้องของรูป: ไม่พึ่ง store.students อย่างเดียว (ว่างในเซสชันนักเรียน) แต่อ่านจาก Firestore ด้วย uid ตัวเอง', () => {
    const i = store.indexOf('addGPSCheckInLog: async');
    const block = store.slice(i, i + 4500);
    expect(block).toContain('await getOwnStudentRoomFirestore(authUid)');
    const svc = readSource('src/services/firestoreService.ts');
    expect(svc).toMatch(/where\('studentUid', '==', studentUid\)/);
  });
  it('แผงครูดึงเฉพาะนักเรียนในห้อง ไม่ query ทั้งโรงเรียน และไม่ใช้ subscribe …Since แล้ว', () => {
    const panel = readSource('src/components/homevisit/AdvisorGpsCheckInPanel.tsx');
    expect(panel).toContain('subscribeGpsCheckInLogsForUsers(Array.from(idset)');
    expect(panel).not.toContain('subscribeGpsCheckInLogsSince');
    const svc = readSource('src/services/firestoreService.ts');
    expect(svc).not.toContain('export function subscribeGpsCheckInLogsSince');
    expect(svc).toMatch(/where\('userId', 'in', chunk\), where\('date', '>=', startDate\)/);
  });
  it('มี composite index (userId, date) สำหรับ query ของแผงครู', () => {
    const idx = JSON.parse(readSource('firestore.indexes.json'));
    const hit = idx.indexes.find((i: any) => i.collectionGroup === 'gps_check_in_logs');
    expect(hit?.fields.map((f: any) => f.fieldPath)).toEqual(['userId', 'date']);
  });
  it('rules: คอลเลกชันรูปสร้างได้เฉพาะเจ้าของ จำกัดขนาด/วันหมดอายุ ห้ามแก้ และอ่านเฉพาะห้องที่ไม่ว่าง', () => {
    const rules = readSource('firestore.rules');
    const i = rules.indexOf('match /gps_checkin_selfies/{logId}');
    expect(i).toBeGreaterThan(-1);
    const block = rules.slice(i, i + 1800);
    expect(block).toContain("request.resource.data.authUid == request.auth.uid");
    expect(block).toContain('dataUrl.size() <= 140000');
    expect(block).toContain("duration.value(31, 'd')");
    expect(block).toContain('allow update: if false');
    expect(block).toContain("resource.data.get('homeroomClass', '') != ''");
    expect(block).not.toMatch(/\|\|\s*isSignedIn\(\)\s*;/);
  });
});
