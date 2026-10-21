import { describe, it, expect } from 'vitest';
import { classPlanDocId, normalizeClassPlan, validateClassPlan, isClassPlanDirty, CLASS_PLAN_LIMITS } from '../lib/sdqClassPlan';
import { readSource } from './helpers/readSource';

describe('แนวทางช่วยเหลือในรายงาน SDQ ชั้นเรียน', () => {
  it('รหัสเอกสารไม่มี "/" และแยกตามปี/รอบ/ห้อง', () => {
    expect(classPlanDocId('2569', 1, 'ม.5/8')).toBe('2569_1_ม.5-8');
    expect(classPlanDocId('2569', 2, 'ม.5/8')).not.toBe(classPlanDocId('2569', 1, 'ม.5/8'));
    expect(classPlanDocId('2569', 1, 'ม.5 / 8')).not.toContain('/');
  });

  it('normalize: ตัดช่องว่าง ทิ้งรายว่างและรหัสนักเรียนที่ไม่ได้อยู่ในห้อง', () => {
    const r = normalizeClassPlan({ studentPlans: { a: '  ติดตาม ', b: '   ', z: 'ย้ายห้องไปแล้ว' }, activityPlan: ' กิจกรรม ' }, ['a', 'b']);
    expect(r).toEqual({ studentPlans: { a: 'ติดตาม' }, activityPlan: 'กิจกรรม' });
  });

  it('validate: เกินขีดจำกัดต้องไม่ผ่าน', () => {
    const ok = { studentPlans: { a: 'x' }, activityPlan: '' };
    expect(validateClassPlan(ok)).toBeNull();
    expect(validateClassPlan({ ...ok, studentPlans: { a: 'ก'.repeat(CLASS_PLAN_LIMITS.perStudent + 1) } })).toContain('รายบุคคล');
    expect(validateClassPlan({ ...ok, activityPlan: 'ก'.repeat(CLASS_PLAN_LIMITS.activity + 1) })).toContain('กิจกรรม');
    const many = Object.fromEntries(Array.from({ length: CLASS_PLAN_LIMITS.maxStudents + 1 }, (_, i) => [`s${i}`, 'x']));
    expect(validateClassPlan({ studentPlans: many, activityPlan: '' })).toContain('ไม่เกิน');
  });

  it('dirty: ไม่มีที่บันทึก+ฟอร์มว่าง = ไม่ dirty; แก้แล้ว = dirty; กลับเป็นค่าเดิม = ไม่ dirty', () => {
    const ids = ['a', 'b'];
    expect(isClassPlanDirty({ studentPlans: {}, activityPlan: '' }, undefined, ids)).toBe(false);
    expect(isClassPlanDirty({ studentPlans: { a: 'x' }, activityPlan: '' }, undefined, ids)).toBe(true);
    const saved = { studentPlans: { a: 'x' }, activityPlan: 'h' };
    expect(isClassPlanDirty({ studentPlans: { a: ' x ', b: '' }, activityPlan: 'h' }, saved, ids)).toBe(false);
    expect(isClassPlanDirty({ studentPlans: { a: 'x' }, activityPlan: 'h2' }, saved, ids)).toBe(true);
  });

  it('ต่อสาย: บริการ throw เมื่อเขียนไม่สำเร็จ (ไม่กลืน), อ่านด้วย query room, UI ใช้ปุ่มบันทึกจริง', () => {
    const svc = readSource('src/services/sdqClassPlanService.ts');
    expect(svc).toContain("where('room', '==', room)");
    expect(svc).toContain('await setDoc(');
    expect(svc).not.toMatch(/catch\s*\(/);
    expect(svc).not.toContain('getDoc(');
    const ui = readSource('src/components/sdq/SdqClassReport.tsx');
    expect(ui).toContain('saveClassPlan(');
    expect(ui).toContain('sdq-plan-save');
  });

  it('rules: บล็อก sdq_class_plans จำกัดครูที่ปรึกษาของห้อง ไม่มี bare isSignedIn และไม่ให้ SUPER_ADMIN/ลบ', () => {
    const rules = readSource('firestore.rules.comments');
    const i = rules.indexOf('match /sdq_class_plans/');
    const block = rules.slice(i, rules.indexOf('\n    }\n', i));
    expect(block).toContain('isHomeroomTeacherOf(resource.data.room)');
    expect(block).not.toContain('isSignedIn()');
    expect(block).not.toContain('SUPER_ADMIN');
    expect(block).toContain('allow delete: if false');
  });
});
