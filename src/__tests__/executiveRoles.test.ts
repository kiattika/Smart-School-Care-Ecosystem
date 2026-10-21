import { describe, it, expect } from 'vitest';
import { EXECUTIVE_EQUIVALENT_ROLES, isExecutiveRole, hasExecutiveRole } from '../lib/executiveRoles';
import { ROLE_PERMISSIONS } from '../types/auth';
import { ROLE_NAMES_TH, ROLE_COLORS } from '../components/StaffRoleManagementPage';
import { overviewQuery, resultsQuery } from '../lib/supervisionView';
import { teachingLoadFor, filterTeacherRows, staffFullName } from '../lib/executiveTeacherInfo';
import { readSource } from './helpers/readSource';

const NEW_ROLES = ['DEPUTY_DIRECTOR_BUDGET', 'DEPUTY_DIRECTOR_PERSONNEL', 'DEPUTY_DIRECTOR_GENERAL'] as const;

describe('กลุ่มบทบาทผู้บริหาร (EXECUTIVE + รองผอ. 3 กลุ่มงาน)', () => {
  it('isExecutiveRole / hasExecutiveRole', () => {
    for (const r of ['EXECUTIVE', ...NEW_ROLES]) expect(isExecutiveRole(r)).toBe(true);
    for (const r of ['DIRECTOR', 'SUPER_ADMIN', 'SUBJECT_TEACHER', '', null, undefined]) expect(isExecutiveRole(r as any)).toBe(false);
    expect(hasExecutiveRole(['SUBJECT_TEACHER', 'DEPUTY_DIRECTOR_PERSONNEL'])).toBe(true);
    expect(hasExecutiveRole(['SUBJECT_TEACHER'])).toBe(false);
    expect(hasExecutiveRole(undefined)).toBe(false);
  });
  it('สิทธิ์ใน ROLE_PERMISSIONS เท่ากับ EXECUTIVE และมีชื่อ/สีครบ', () => {
    for (const r of NEW_ROLES) {
      expect(ROLE_PERMISSIONS[r]).toEqual(ROLE_PERMISSIONS.EXECUTIVE);
      expect(ROLE_NAMES_TH[r]).toBeTruthy();
      expect(ROLE_COLORS[r]).toBeTruthy();
    }
  });
  it('รายการใน isExec() ของ rules ตรงกับ EXECUTIVE_EQUIVALENT_ROLES', () => {
    const rules = readSource('firestore.rules.comments');
    const fn = rules.match(/function isExec\(\) \{([\s\S]*?)\n    \}/)?.[1] || '';
    const found = [...fn.matchAll(/hasRole\('([A-Z_]+)'\)/g)].map(m => m[1]).sort();
    expect(found).toEqual([...EXECUTIVE_EQUIVALENT_ROLES].sort());
  });
  it('rules: ไม่เหลือ hasRole(\'EXECUTIVE\') นอกนิยาม isExec และ plans/projects/PLC เปิดอ่านให้ isExec', () => {
    const rules = readSource('firestore.rules.comments');
    expect(rules.match(/hasRole\('EXECUTIVE'\)/g)?.length).toBe(1);
    for (const m of ['lesson_plan_submissions', 'teaching_projects', 'plc_logs']) {
      const blk = rules.match(new RegExp(`match /${m}/\\{[a-z]+\\} \\{[\\s\\S]*?allow create`))?.[0] || '';
      expect(blk, m).toContain('isExec()');
    }
    // สิทธิ์เขียนห้ามมี isExec (ดูอย่างเดียว)
    for (const m of ['lesson_plan_submissions', 'teaching_projects', 'plc_logs']) {
      const blk = rules.match(new RegExp(`match /${m}/\\{[a-z]+\\} \\{[\\s\\S]*?\\n    \\}`))?.[0] || '';
      expect(blk.replace(/allow read[\s\S]*?\);/, '')).not.toContain('isExec()');
    }
  });
  it('client: role ใหม่ไป ExecutivePortal (legacy executive) และ overviewQuery อ่านทั้งโรงเรียนเฉพาะที่ส่งแล้ว', () => {
    expect(readSource('src/lib/auth.ts')).toContain('isExecutiveRole(activeRole)');
    expect(readSource('src/App.tsx')).toContain('isExecutiveRole(role)');
    for (const r of NEW_ROLES) {
      expect(overviewQuery([r])).toEqual({ scope: 'ALL', submittedOnly: true });
      expect(resultsQuery([r], 's1', 'd1')).toBeNull();
    }
  });
  it('ExecutivePortal มีแท็บข้อมูลครูรายบุคคล', () => {
    const src = readSource('src/ExecutivePortal.tsx');
    expect(src).toContain("id: 'teacherinfo'");
    expect(src).toContain('<ExecutiveTeacherInfoPanel />');
  });
});

describe('ข้อมูลครูรายบุคคล: ภาระงานสอน', () => {
  const sc = (o: Record<string, any>) => ({ courseCode: 'ค21101', courseName: 'คณิตศาสตร์', targetClass: 'ม.1/1', scheduleDay: 1, periodNumber: 1, teacherId: 't1', ...o });
  it('นับคาบไม่ซ้ำ รวมคาบ 0 ตัดคาบที่ไม่ใช่การสอนนักเรียน และจับคู่ด้วย staff id หรืออีเมล', () => {
    const docs = [
      sc({}), sc({ scheduleDay: 1, periodNumber: 0, courseCode: 'HR' }), sc({ scheduleDay: 2, periodNumber: 3, targetClass: 'ม.1/2' }),
      sc({ scheduleDay: 2, periodNumber: 3, targetClass: 'ม.1/2' }), // ซ้ำ
      sc({ courseCode: 'PLC', courseName: 'PLC', scheduleDay: 3, periodNumber: 8 }),
      sc({ teacherId: 'other', scheduleDay: 4, periodNumber: 2 }),
      { courseCode: 'ว21101', courseName: 'วิทย์', targetClass: 'ม.1/1', scheduleDay: 5, periodNumber: 4, teacherEmail: 'T1@UTD.ac.th' },
    ];
    expect(teachingLoadFor({ id: 'T1', email: 't1@utd.ac.th' }, docs)).toEqual({ periodsPerWeek: 4, subjects: 3, classes: 2 });
    expect(teachingLoadFor({ id: 'nobody', email: 'x@utd.ac.th' }, docs)).toEqual({ periodsPerWeek: 0, subjects: 0, classes: 0 });
  });
  it('ค้นหา/กรองกลุ่มสาระฯ/ซ่อนผู้ที่ปิดการใช้งานเป็นค่าเริ่มต้น', () => {
    const mk = (id: string, first: string, extra: Record<string, any> = {}) => {
      const staff = { id, email: `${id}@utd.ac.th`, prefix: 'นาย', firstName: first, lastName: 'ทดสอบ', position: 'ครู', ...extra };
      return { staff, name: staffFullName(staff) };
    };
    const rows = [mk('a', 'สมชาย', { assignments: { departmentId: 'd1' } }), mk('b', 'สมหญิง', { status: 'INACTIVE' }), mk('c', 'มานะ', { assignments: { departmentId: 'd2' } })];
    expect(filterTeacherRows(rows, { query: '', departmentId: '', includeInactive: false }).map(r => r.staff.id)).toEqual(['a', 'c']);
    expect(filterTeacherRows(rows, { query: '', departmentId: '', includeInactive: true })).toHaveLength(3);
    expect(filterTeacherRows(rows, { query: 'มานะ', departmentId: '', includeInactive: false }).map(r => r.staff.id)).toEqual(['c']);
    expect(filterTeacherRows(rows, { query: '', departmentId: 'd1', includeInactive: false }).map(r => r.staff.id)).toEqual(['a']);
  });
});
