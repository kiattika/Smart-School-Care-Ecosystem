import { describe, it, expect } from 'vitest';
import { planNicknameBackfill, cleanNickname } from '../lib/nicknameBackfill';

describe('planNicknameBackfill', () => {
  it('เติมเฉพาะคนที่ยังไม่มีชื่อเล่น และไม่เติมค่าว่าง', () => {
    const plan = planNicknameBackfill(
      { a: { basicInfo: { nickname: ' ฟ้า ' } }, b: { basicInfo: { nickname: 'บี' } }, c: { basicInfo: { nickname: '  ' } } },
      [{ studentId: 'a', nickname: '' }, { studentId: 'b', nickname: 'เดิม' }, { studentId: 'c' }, { studentId: 'd' }],
    );
    expect(plan).toEqual([{ studentId: 'a', nickname: 'ฟ้า' }]);
  });
  it('จำกัด 30 ตัวอักษร', () => { expect(cleanNickname('ก'.repeat(40)).length).toBe(30); });
});
