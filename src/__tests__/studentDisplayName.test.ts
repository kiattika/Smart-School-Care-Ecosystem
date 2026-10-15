import { describe, it, expect } from 'vitest';
import { studentDisplayName } from '../lib/studentDisplayName';
import { readSource } from './helpers/readSource';

describe('studentDisplayName', () => {
  it('ไม่ต่อคำนำหน้าซ้ำเมื่อชื่อเต็มมีอยู่แล้ว', () => {
    expect(studentDisplayName({ title: 'ด.ช.', fullName: 'ด.ช.นักเรียนทดสอบ ระบบ' })).toBe('ด.ช.นักเรียนทดสอบ ระบบ');
  });
  it('ต่อคำนำหน้าเมื่อชื่อเต็มไม่มี', () => {
    expect(studentDisplayName({ title: 'ด.ช.', fullName: 'นักเรียนทดสอบ ระบบ' })).toBe('ด.ช.นักเรียนทดสอบ ระบบ');
  });
  it('ไม่มีคำนำหน้า/ไม่มี fullName ใช้ name', () => {
    expect(studentDisplayName({ fullName: 'สมชาย ใจดี' })).toBe('สมชาย ใจดี');
    expect(studentDisplayName({ title: 'นาย', name: 'สมชาย ใจดี' })).toBe('นายสมชาย ใจดี');
  });
  it('กระดานคะแนนและตัวสุ่มชื่อใช้ฟังก์ชันนี้ ไม่ต่อ title เอง', () => {
    expect(readSource('src/components/ClassroomLeaderboard.tsx')).toContain('studentDisplayName(student)');
    expect(readSource('src/components/RandomStudentPickerModal.tsx')).toContain('studentDisplayName(winner)');
    expect(readSource('src/components/ClassroomLeaderboard.tsx')).not.toMatch(/\{student\.title \|\| ''\}/);
  });
});
