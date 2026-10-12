import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('แถบ "กิจกรรมร่วม/ครูสอนร่วม" ต้องมาจากข้อมูลจริง', () => {
  const list = readSource('src/components/TeacherScheduleList.tsx');
  it('ไม่ฝังจำนวนครู "(2 ท่าน)" ตายตัว', () => {
    expect(list).not.toMatch(/กิจกรรมร่วม \(2 ท่าน\)/);
  });
  it('แสดงเฉพาะเมื่อมีครูร่วมจริง (teacherCount > 1 หรือ teachingPartner)', () => {
    expect(list).toMatch(/count <= 1 && !period\.teachingPartner\) return null/);
    expect(list).toMatch(/\(\$\{count\} ท่าน\)/);
  });
  it('TeacherPortal ส่ง teacherCount จาก schedules.teacherIds', () => {
    expect(readSource('src/TeacherPortal.tsx')).toMatch(/teacherCount: Array\.isArray\(item\.teacherIds\)/);
  });
});
