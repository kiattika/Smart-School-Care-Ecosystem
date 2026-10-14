import { describe, it, expect } from 'vitest';
import { advisorsOfRoom, counselorsOf } from '../lib/advisors';
import { readSource } from './helpers/readSource';

const staff = (o: Record<string, unknown>) => ({ id: 's', email: '', prefix: '', firstName: '', lastName: '', position: '', roles: [], ...o }) as never;

describe('advisorsOfRoom / counselorsOf', () => {
  const list = [
    staff({ id: 'a', roles: ['HOMEROOM_TEACHER'], prefix: 'นาย', firstName: 'ก', lastName: 'ข', assignments: { homeroomClass: 'ม.5/8' } }),
    staff({ id: 'b', roles: ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER'], fullName: 'นายครูภาษาไทย', assignments: { homeroomClass: 'ม.5/8' } }),
    staff({ id: 'c', roles: ['HOMEROOM_TEACHER'], firstName: 'ค', assignments: { homeroomClass: 'ม.6/1' } }),
    staff({ id: 'd', roles: ['SUBJECT_TEACHER'], firstName: 'ง', assignments: { homeroomClass: 'ม.5/8' } }),
    staff({ id: 'e', roles: ['HOMEROOM_TEACHER'], firstName: 'จ', status: 'INACTIVE', assignments: { homeroomClass: 'ม.5/8' } }),
    staff({ id: 'g', roles: ['GUIDANCE_COUNSELOR'], email: 'g@utd.ac.th' }),
  ];
  it('ครูที่ปรึกษาของห้อง: ต้องมีบทบาท + ห้องตรง + ยังใช้งาน; ชื่อ fallback ได้', () => {
    expect(advisorsOfRoom(list, 'ม.5/8').map(a => a.staffId)).toEqual(['a', 'b']);
    expect(advisorsOfRoom(list, 'ม.5/8').find(a => a.staffId === 'b')?.name).toBe('นายครูภาษาไทย');
    expect(advisorsOfRoom(list, undefined)).toEqual([]);
  });
  it('ครูแนะแนว: ชื่อ fallback เป็นอีเมลเมื่อไม่มีชื่อ', () => {
    expect(counselorsOf(list)).toEqual([{ staffId: 'g', name: 'g@utd.ac.th' }]);
  });
  it('subscribeStaffList ใช้ id ของเอกสาร (เอกสารนำเข้าอาจไม่มี field id)', () => {
    expect(readSource('src/services/firestoreService.ts')).toMatch(/\{ \.\.\.\(docSnap\.data\(\) as UserProfile\), id: docSnap\.id \}/);
  });
});
