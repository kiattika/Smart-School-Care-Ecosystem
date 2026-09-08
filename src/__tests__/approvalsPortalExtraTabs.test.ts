import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ApprovalsPortal.tsx เพิ่มแท็บ "จัดการชุมนุม"/"จัดการคณะสี" ให้เฉพาะ role ที่มีสิทธิ์เขียนจริง
 * ตาม firestore.rules (elective_activities_config/house_config: SUPER_ADMIN || ACADEMIC_HEAD)
 * — HEAD_OF_DEPARTMENT/DEPUTY_DIRECTOR_ACADEMIC/DIRECTOR ไม่มีสิทธิ์เขียน 2 collection นี้เลย
 * จึงต้องไม่เห็นแท็บเพิ่มเติม ใช้ source-inspection เพราะ mount เต็มรูปแบบต้องพึ่ง Zustand/Firestore
 * listener จำนวนมาก (ตามรูปแบบเดิมของโปรเจกต์ เช่น multiTeacherSchedule.test.ts)
 */
describe('ApprovalsPortal: แท็บเพิ่มเติมต้องตรงกับสิทธิ์จริงใน firestore.rules เท่านั้น', () => {
  const approvalsPortalSrc = fs.readFileSync(
    path.resolve(__dirname, '../ApprovalsPortal.tsx'), 'utf8'
  );
  const appSrc = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf8');
  const rulesSrc = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

  it('firestore.rules: มีแค่ ACADEMIC_HEAD (นอกจาก SUPER_ADMIN) ที่เขียน elective_activities_config/house_config ได้', () => {
    const electiveBlock = rulesSrc.match(/match \/elective_activities_config\/\{configId\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    const houseBlock = rulesSrc.match(/match \/house_config\/\{houseId\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(electiveBlock).toContain("hasRole('ACADEMIC_HEAD')");
    expect(houseBlock).toContain("hasRole('ACADEMIC_HEAD')");
    for (const role of ['HEAD_OF_DEPARTMENT', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR']) {
      expect(electiveBlock).not.toContain(`hasRole('${role}')`);
      expect(houseBlock).not.toContain(`hasRole('${role}')`);
    }
  });

  it('ApprovalsPortal: EXTRA_TAB_ROLES มีแค่ ACADEMIC_HEAD mapped ไปที่ elective+house', () => {
    expect(approvalsPortalSrc).toContain("ACADEMIC_HEAD: ['elective', 'house'],");
    // ต้องไม่ map role อื่นเข้าไปด้วย (regression guard กันเผลอเพิ่มให้ role ที่ไม่มีสิทธิ์จริง)
    for (const role of ['HEAD_OF_DEPARTMENT', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR']) {
      expect(approvalsPortalSrc).not.toContain(`${role}: ['elective'`);
      expect(approvalsPortalSrc).not.toContain(`${role}: ['house'`);
    }
  });

  it('ApprovalsPortal: reuse ElectiveActivityManagerPage/HouseManagerPage เดิม ไม่สร้าง component ใหม่', () => {
    expect(approvalsPortalSrc).toContain("import { ElectiveActivityManagerPage } from './components/admin/ElectiveActivityManagerPage';");
    expect(approvalsPortalSrc).toContain("import { HouseManagerPage } from './components/admin/HouseManagerPage';");
  });

  it('App.tsx: 4 role งานอนุมัติยังคง route ไป ApprovalsPortal เสมอ (ไม่เปลี่ยนไป AdminPortal เต็มรูปแบบ)', () => {
    expect(appSrc).toContain(
      "(['HEAD_OF_DEPARTMENT', 'ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR'] as const).includes(user.activeRole as any)"
    );
    expect(appSrc).toContain('<ApprovalsPortal />');
  });

  it("App.tsx: SUPER_ADMIN (user.role === 'admin') ยังเข้า AdminPortal เต็มรูปแบบได้ตามปกติ ไม่ถูกแตะ", () => {
    expect(appSrc).toContain("user.role === 'admin'");
    expect(appSrc).toContain('<AdminPortal />');
  });
});
