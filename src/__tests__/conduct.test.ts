import { describe, it, expect } from 'vitest';
import {
  validatePoints, planConductEntry, nextConductFields, deductionAction, conductBand, riskOf, maxPointsFor,
} from '../lib/conduct';
import { readSource } from './helpers/readSource';

describe('conduct: เพดานคะแนนต่อครั้ง', () => {
  it('หักตามระดับ เบา ≤5 / ปานกลาง ≤10 / ร้ายแรง ≤20', () => {
    expect(maxPointsFor('DEDUCT', 'LIGHT')).toBe(5);
    expect(maxPointsFor('DEDUCT', 'MEDIUM')).toBe(10);
    expect(maxPointsFor('DEDUCT', 'SEVERE')).toBe(20);
    expect(validatePoints('DEDUCT', 'LIGHT', 6)).not.toBeNull();
    expect(validatePoints('DEDUCT', 'SEVERE', 20)).toBeNull();
    expect(validatePoints('DEDUCT', 'SEVERE', 21)).not.toBeNull();
  });
  it('หักต้องมีระดับ, เพิ่มห้ามมีระดับ, ต้องเป็นจำนวนเต็ม ≥ 1', () => {
    expect(validatePoints('DEDUCT', 'NONE', 3)).not.toBeNull();
    expect(validatePoints('ADD', 'LIGHT', 3)).not.toBeNull();
    expect(validatePoints('ADD', 'NONE', 0)).not.toBeNull();
    expect(validatePoints('ADD', 'NONE', 1.5)).not.toBeNull();
    expect(validatePoints('ADD', 'NONE', 7)).toBeNull();
  });
});

describe('conduct: ครูทำเองได้ ≤5 เกินส่งงานกิจการ', () => {
  const base = { level: 'NONE' as const, reason: 'ช่วยงานโรงเรียน', category: '' };
  it('ครู ≤5 = มีผลทันที, >5 = รอพิจารณา (ทั้งเพิ่มและหัก)', () => {
    expect(planConductEntry({ ...base, kind: 'ADD', points: 5 }, false)).toEqual({ mode: 'APPLY' });
    expect(planConductEntry({ ...base, kind: 'ADD', points: 6 }, false)).toEqual({ mode: 'PENDING' });
    expect(planConductEntry({ kind: 'DEDUCT', level: 'MEDIUM', points: 8, reason: 'x', category: '' }, false)).toEqual({ mode: 'PENDING' });
  });
  it('งานกิจการมีผลทันทีเสมอ และต้องมีเหตุผล', () => {
    expect(planConductEntry({ ...base, kind: 'ADD', points: 30 }, true)).toEqual({ mode: 'APPLY' });
    expect('error' in planConductEntry({ ...base, kind: 'ADD', points: 1, reason: '  ' }, true)).toBe(true);
  });
});

describe('conduct: แคชคะแนนนักเรียน', () => {
  it('เริ่ม 100 หัก 8 → 92; สร้างรายการใหม่', () => {
    const f = nextConductFields({}, null, { status: 'APPLIED', kind: 'DEDUCT', appliedPoints: 8 });
    expect(f).toMatchObject({ conductBase: 100, conductAdded: 0, conductDeducted: 8, behaviorScore: 92, riskLevel: 'NORMAL' });
  });
  it('ใช้คะแนนเดิมของระบบเก่าเป็นฐาน', () => {
    const f = nextConductFields({ behaviorScore: 85 }, null, { status: 'APPLIED', kind: 'ADD', appliedPoints: 5 });
    expect(f.conductBase).toBe(85);
    expect(f.behaviorScore).toBe(90);
  });
  it('ยกเลิกรายการ (APPLIED → REVERSED) คืนคะแนน', () => {
    const f = nextConductFields({ conductBase: 100, conductAdded: 0, conductDeducted: 10 }, { status: 'APPLIED', kind: 'DEDUCT', appliedPoints: 10 }, { status: 'REVERSED', kind: 'DEDUCT', appliedPoints: 10 });
    expect(f.conductDeducted).toBe(0);
    expect(f.behaviorScore).toBe(100);
  });
  it('แก้คะแนน 10 → 4', () => {
    const f = nextConductFields({ conductBase: 100, conductAdded: 0, conductDeducted: 10 }, { status: 'APPLIED', kind: 'DEDUCT', appliedPoints: 10 }, { status: 'APPLIED', kind: 'DEDUCT', appliedPoints: 4 });
    expect(f.conductDeducted).toBe(4);
    expect(f.behaviorScore).toBe(96);
  });
  it('คะแนนไม่เกิน 100 และไม่ต่ำกว่า 0', () => {
    expect(nextConductFields({}, null, { status: 'APPLIED', kind: 'ADD', appliedPoints: 50 }).behaviorScore).toBe(100);
    expect(nextConductFields({ conductBase: 10 }, null, { status: 'APPLIED', kind: 'DEDUCT', appliedPoints: 20 }).behaviorScore).toBe(0);
  });
  it('รายการที่ยังไม่มีผล (PENDING/REJECTED) ไม่กระทบคะแนน', () => {
    const f = nextConductFields({}, null, { status: 'PENDING', kind: 'DEDUCT', appliedPoints: 0 });
    expect(f.behaviorScore).toBe(100);
  });
  it('ระดับเสี่ยง', () => {
    expect(riskOf(79)).toBe('WARNING');
    expect(riskOf(69)).toBe('CRITICAL');
    expect(riskOf(80)).toBe('NORMAL');
  });
});

describe('conduct: เกณฑ์ตามระเบียบ', () => {
  it('คะแนนที่ถูกหักสะสม 15/30/40/50', () => {
    expect(deductionAction(14)).toBeNull();
    expect(deductionAction(15)?.label).toMatch(/หนังสือแจ้ง/);
    expect(deductionAction(30)?.label).toMatch(/เชิญผู้ปกครอง/);
    expect(deductionAction(40)?.label).toMatch(/ปรับเปลี่ยนพฤติกรรม/);
    expect(deductionAction(55)?.label).toMatch(/พักการเรียน/);
  });
  it('ผลการประเมินความประพฤติ', () => {
    expect(conductBand(100)).toBe('เรียบร้อยดีมาก');
    expect(conductBand(80)).toBe('เรียบร้อยดีมาก');
    expect(conductBand(79)).toBe('ดี');
    expect(conductBand(69)).toBe('เรียบร้อย');
    expect(conductBand(59)).toBe('พอใช้');
    expect(conductBand(49)).toBe('ควรปรับปรุง');
  });
});

describe('guard: ห้ามลบประวัติคะแนนความประพฤติ', () => {
  it('conductService ไม่ใช้ deleteDoc และเขียนผ่าน transaction', () => {
    const s = readSource('src/services/conductService.ts');
    expect(s).not.toMatch(/deleteDoc/);
    expect(s).toMatch(/runTransaction/);
  });
  it('rules: conduct_entries / change_requests ลบไม่ได้', () => {
    const r = readSource('firestore.rules');
    const i = r.indexOf('match /conduct_entries/{eid}');
    expect(i).toBeGreaterThan(0);
    expect(r.slice(i)).toMatch(/allow delete: if false/);
  });
});

describe('guard: ช่องแก้โปรไฟล์นักเรียนของครูที่ปรึกษา', () => {
  it('rules: HOMEROOM_TEACHER แก้ students ได้เฉพาะ allowlist (ไม่มี parentUid/behaviorScore) และไม่ใช่ bare hasRole', () => {
    const r = readSource('firestore.rules');
    const i = r.indexOf('match /students/{studentId}');
    const upd = r.slice(r.indexOf('allow update:', i), r.indexOf('// ทะเบียนเลขประจำตัวนักเรียน', i));
    expect(upd).not.toMatch(/hasRole\('SUPER_ADMIN'\) \|\| hasRole\('HOMEROOM_TEACHER'\)/);
    expect(upd).toMatch(/isHomeroomTeacherOf\(resource\.data\.get\('room'/);
    const allow = upd.slice(upd.indexOf("'nickname'"), upd.indexOf(']', upd.indexOf("'nickname'")));
    expect(allow).not.toMatch(/parentUid|parentId|behaviorScore|room'|status/);
  });
  it('UI: ครูไม่เห็นช่อง parentUid (เฉพาะ SUPER_ADMIN) และไม่แจ้งสำเร็จก่อนบันทึกจริง', () => {
    const a = readSource('src/AdvisorPortal.tsx');
    expect(a).toMatch(/canLinkParent = user\?\.activeRole === 'SUPER_ADMIN'/);
    expect(a).toMatch(/await updateStudentProfile\(/);
    const f = readSource('src/services/firestoreService.ts');
    const i = f.indexOf('export async function updateStudentProfileFirestore');
    expect(f.slice(i, f.indexOf('\n}\n', i))).toMatch(/handleFirestoreError/);
  });
  it('StudentManagementPage ไม่เขียนทับ behaviorScore ตอนแก้ข้อมูล', () => {
    expect(readSource('src/components/StudentManagementPage.tsx')).not.toMatch(/behaviorScore: editingStudent/);
  });
});
