import { describe, it, expect } from 'vitest';
import { DEFAULT_DEPARTMENTS } from '../lib/departments';
import { buildStaffImportWrite, matchDepartmentId, normalizeDepartmentName, type ParsedStaffRow } from '../lib/staffImportMerge';
import { readSource } from './helpers/readSource';

// ชื่อกลุ่มตามที่แอดมินตั้งในระบบ (ไม่มีคำนำหน้า "กลุ่มสาระฯ") — ตรงกับหน้าจอจริง
const DEPTS = [
  { id: 'd-thai', name: 'ภาษาไทย' },
  { id: 'd-sci', name: 'วิทยาศาสตร์และเทคโนโลยี' },
  { id: 'd-cs', name: 'วิทยาศาสตร์และเทคโนโลยี(คอมพิวเตอร์)' },
  { id: 'd-soc', name: 'สังคมศึกษา ศาสนา และวัฒนธรรม' },
  { id: 'd-guide', name: 'งานแนะแนว-ห้องสมุด' },
  { id: 'd-dir', name: 'กลุ่มอำนวยการ' },
];

const row = (over: Partial<ParsedStaffRow> = {}): ParsedStaffRow => ({
  teacherId: 'thai-01', prefix: 'นาย', firstName: 'ทัพไทย', lastName: 'ตันติอำไพ', fullName: 'นายทัพไทย ตันติอำไพ',
  position: 'ครู คศ.3', email: 'thapthai_2529@utd.ac.th', roles: ['SUBJECT_TEACHER', 'HOMEROOM_TEACHER'],
  department: 'ภาษาไทย', ...over,
});

describe('matchDepartmentId', () => {
  it('ชื่อตรง / รหัสตรง', () => {
    expect(matchDepartmentId('ภาษาไทย', DEPTS)).toBe('d-thai');
    expect(matchDepartmentId('d-sci', DEPTS)).toBe('d-sci');
    expect(matchDepartmentId('วิทยาศาสตร์และเทคโนโลยี(คอมพิวเตอร์)', DEPTS)).toBe('d-cs');
  });
  it('"อำนวยการ" ในไฟล์ = "กลุ่มอำนวยการ" ในระบบ', () => {
    expect(matchDepartmentId('อำนวยการ', DEPTS)).toBe('d-dir');
  });
  it('ไม่สนช่องว่าง/คำนำหน้ากลุ่มสาระฯ', () => {
    expect(matchDepartmentId('กลุ่มสาระฯ ภาษาไทย', DEPTS)).toBe('d-thai');
    expect(matchDepartmentId('วิทยาศาสตร์และเทคโนโลยี (คอมพิวเตอร์)', DEPTS)).toBe('d-cs');
    expect(matchDepartmentId('แนะแนว-ห้องสมุด', DEPTS)).toBe('d-guide');
  });
  it('กลุ่มหลักไม่ถูกจับไปเป็นกลุ่มย่อยคอมพิวเตอร์', () => {
    expect(matchDepartmentId('วิทยาศาสตร์และเทคโนโลยี', DEPTS)).toBe('d-sci');
  });
  it('ไม่รู้จัก/ว่าง = "" (ไม่เดา)', () => {
    expect(matchDepartmentId('', DEPTS)).toBe('');
    expect(matchDepartmentId('กลุ่มสาระที่ไม่มี', DEPTS)).toBe('');
  });
  it('ชื่อซ้ำหลังตัดคำนำหน้า = ไม่เดา', () => {
    expect(matchDepartmentId('ศิลปะ', [{ id: 'a', name: 'ศิลปะ' }, { id: 'b', name: 'กลุ่มสาระฯ ศิลปะ' }])).toBe('a'); // ตรงชื่อเป๊ะก่อน
    expect(matchDepartmentId('กลุ่มศิลปะ', [{ id: 'a', name: 'ศิลปะ' }, { id: 'b', name: 'กลุ่มสาระฯ ศิลปะ' }])).toBe('');
  });
  it('ค่าเริ่มต้นของระบบจับคู่ได้ทุกกลุ่มสาระที่ใช้ในไฟล์', () => {
    for (const name of ['ภาษาไทย', 'คณิตศาสตร์', 'การงานอาชีพ', 'ศิลปะ', 'ภาษาต่างประเทศ', 'สุขศึกษาและพลศึกษา', 'สังคมศึกษา ศาสนา และวัฒนธรรม', 'วิทยาศาสตร์และเทคโนโลยี', 'วิทยาศาสตร์และเทคโนโลยี(คอมพิวเตอร์)', 'อำนวยการ']) {
      expect(matchDepartmentId(name, DEFAULT_DEPARTMENTS), name).not.toBe('');
    }
  });
  it('normalize ไม่ทำให้ชื่อว่าง', () => {
    expect(normalizeDepartmentName('กลุ่มสาระฯ ภาษาไทย')).toBe('ภาษาไทย');
  });
});

describe('buildStaffImportWrite', () => {
  const NOW = Symbol('now');

  it('คนใหม่: เขียนบทบาทตามไฟล์ + assignments.departmentId เป็นรหัส', () => {
    const w = buildStaffImportWrite(row(), 'a@utd.ac.th', DEPTS, undefined, NOW);
    expect(w.isNew).toBe(true);
    expect(w.staff.roles).toEqual(['SUBJECT_TEACHER', 'HOMEROOM_TEACHER']);
    expect((w.staff.assignments as any).departmentId).toBe('d-thai');
    expect(w.staff.createdAt).toBe(NOW);
  });

  it('คนที่มีอยู่แล้ว: ไม่เขียน roles / createdAt / status และไม่ทับ assignments อื่น', () => {
    const w = buildStaffImportWrite(row(), 'a@utd.ac.th', DEPTS, { id: 'thai-01', roles: ['SUBJECT_TEACHER', 'HEAD_OF_DEPARTMENT'] }, NOW);
    expect(w.isNew).toBe(false);
    expect('roles' in w.staff).toBe(false);
    expect('roles' in w.teacher).toBe(false);
    expect('createdAt' in w.staff).toBe(false);
    expect('status' in w.staff).toBe(false);
    expect(w.staff.assignments).toEqual({ departmentId: 'd-thai' }); // merge ระดับ field — ไม่มี homeroomClass/teachingSubjects
    expect(w.staff.position).toBe('ครู คศ.3');
    expect(w.staff.email).toBe('a@utd.ac.th');
  });

  it('คนที่มีอยู่แล้วแต่ไฟล์ไม่ระบุ/จับคู่กลุ่มไม่ได้: ไม่แตะกลุ่มสาระฯ เดิม', () => {
    for (const department of ['', 'กลุ่มที่ไม่มี']) {
      const w = buildStaffImportWrite(row({ department }), 'a@utd.ac.th', DEPTS, { id: 'thai-01', roles: ['SUBJECT_TEACHER'] }, NOW);
      expect('assignments' in w.staff).toBe(false);
      expect('departmentId' in w.teacher).toBe(false);
    }
  });

  it('doc เดิมที่ roles ว่าง: ใช้บทบาทจากไฟล์ (ไม่มีสิทธิ์อยู่แล้ว)', () => {
    const w = buildStaffImportWrite(row(), 'a@utd.ac.th', DEPTS, { id: 'thai-01', roles: [] }, NOW);
    expect(w.staff.roles).toEqual(['SUBJECT_TEACHER', 'HOMEROOM_TEACHER']);
  });
});

describe('guard: BulkDataImportModal นำเข้าบุคลากรผ่าน buildStaffImportWrite', () => {
  const src = readSource('src/components/BulkDataImportModal.tsx');
  it('ไม่เขียน roles ของ staff ตรง ๆ อีก', () => {
    expect(src).toContain('buildStaffImportWrite(');
    expect(src).not.toContain('departmentId: parsedData.departmentId');
    expect(src).not.toMatch(/batch\.set\(staffRef, teacherPayload/);
  });
});
