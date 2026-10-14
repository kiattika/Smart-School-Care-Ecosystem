import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('เคสแนะแนว: เห็นเฉพาะครูเจ้าของเคส', () => {
  it('rules ผูก read/update กับ counselorUid และห้ามลบ ยกเว้น SUPER_ADMIN', () => {
    const r = readSource('firestore.rules');
    const block = r.slice(r.indexOf('match /guidance_counseling_cases/'), r.indexOf('// 31. Infirmary Visits'));
    expect(block).toMatch(/hasRole\('GUIDANCE_COUNSELOR'\) && resource\.data\.counselorUid == request\.auth\.uid/);
    expect(block).toMatch(/hasOnly\(\['status', 'updatedAt', 'lastSessionDate'\]\)/);
    expect(block).toMatch(/allow delete: if hasRole\('SUPER_ADMIN'\);/);
  });
  it('พอร์ทัลส่ง uid กรอง query ให้ครูแนะแนว (ไม่ใช่ SUPER_ADMIN)', () => {
    expect(readSource('src/components/guidance/GuidancePortal.tsx')).toMatch(/isSuperAdmin \? undefined : user\.uid/);
    expect(readSource('src/services/firestoreService.ts')).toMatch(/where\('counselorUid', '==', ownerUid\)/);
  });
});
