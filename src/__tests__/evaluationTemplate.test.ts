import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import {
  defaultTemplate, nextCriterionId, numberedLabel, stripNumbering, templateDocFields, templateFromDoc, validateTemplateDraft,
  type EvalTemplate,
} from '../lib/evaluationTemplate';
import { DEFAULT_SUPERVISION_TEMPLATE, SUPERVISION_ITEMS, buildObservationFields, computeObservation, summarizeObservations, validateForSubmit, type ObservationFormInput } from '../lib/supervision';
import { DEFAULT_LESSON_PLAN_TEMPLATE, PLAN_CRITERIA, averageScore, scoresComplete } from '../lib/lessonPlans';

const sup2: EvalTemplate = {
  kind: 'SUPERVISION', version: 2,
  criteria: [{ id: 'c1', label: 'ข้อหนึ่ง', section: 1 }, { id: 'c2', label: '2.9 ข้อสอง', section: 1, assessmentMethod: true }, { id: 'c3', label: 'ข้อสาม', section: 2 }],
  sections: [{ no: 1, title: 'หมวดแรก' }, { no: 2, title: 'หมวดสอง' }],
};

describe('แบบตั้งต้น (เวอร์ชัน 1) ต้องเหมือนเดิมทุกประการ', () => {
  it('แบบนิเทศ 20 ข้อ/5 หมวด และข้อ s5_2 มีช่องวิธีประเมิน; แบบแผน 15 ข้อ', () => {
    expect(DEFAULT_SUPERVISION_TEMPLATE.criteria).toHaveLength(20);
    expect(DEFAULT_SUPERVISION_TEMPLATE.criteria.filter(c => c.assessmentMethod).map(c => c.id)).toEqual(['s5_2']);
    expect(DEFAULT_SUPERVISION_TEMPLATE.version).toBe(1);
    expect(DEFAULT_LESSON_PLAN_TEMPLATE.criteria.map(c => c.id)).toEqual(PLAN_CRITERIA.map(c => c.id));
    expect(defaultTemplate('LESSON_PLAN')).toBe(DEFAULT_LESSON_PLAN_TEMPLATE);
  });
  it('ข้อความที่เลขนำหน้าของแบบเดิมแสดงเท่าเดิม', () => {
    for (const it2 of SUPERVISION_ITEMS) {
      const c = DEFAULT_SUPERVISION_TEMPLATE.criteria.find(x => x.id === it2.id)!;
      expect(numberedLabel(DEFAULT_SUPERVISION_TEMPLATE, c)).toBe(it2.label);
    }
  });
  it('คำนวณเดิมไม่เปลี่ยน (ไม่ส่งแบบ = v1)', () => {
    const all5 = Object.fromEntries(SUPERVISION_ITEMS.map(i => [i.id, 5]));
    expect(computeObservation(all5)).toMatchObject({ complete: true, total: 100, percent: 100, band: 'ดีมาก' });
    expect(scoresComplete(Object.fromEntries(PLAN_CRITERIA.map(c => [c.id, 3])))).toBe(true);
  });
});

describe('คำนวณตามแบบเวอร์ชันใหม่', () => {
  it('เปอร์เซ็นต์คิดจาก (จำนวนข้อ × 5)', () => {
    expect(computeObservation({ c1: 5, c2: 5, c3: 5 }, sup2)).toMatchObject({ complete: true, total: 15, percent: 100, band: 'ดีมาก' });
    expect(computeObservation({ c1: 4, c2: 4, c3: 4 }, sup2)).toMatchObject({ total: 12, percent: 80, band: 'พอใช้' });
    expect(computeObservation({ c1: 4, c2: 4 }, sup2)).toMatchObject({ complete: false, percent: null });
    expect(computeObservation({ s1_1: 5 }, sup2).answered).toBe(0); // id ของแบบเก่าไม่นับ
  });
  it('ส่งผล/บันทึก: เก็บเวอร์ชัน + ไม่เก็บ id นอกแบบ', () => {
    const input: ObservationFormInput = {
      roundId: '2569_1', teacher: { staffId: 't', name: 'ครู', departmentId: 'D' }, supervisor: { staffId: 's', name: 'ผู้นิเทศ' },
      courseCode: '', courseName: 'ไทย', level: '', observedDate: '2026-09-01', observedTime: '', scores: { c1: 5, c2: 4, c3: 3, s1_1: 5 },
      assessmentMethod: '', strengths: '', improvements: '', comment: '', photos: [],
    };
    expect(validateForSubmit(input, sup2)).toBeNull();
    expect(validateForSubmit({ ...input, scores: { c1: 5 } }, sup2)).toMatch(/1\/3|ไม่ครบ/);
    const f = buildObservationFields(input, true, sup2);
    expect(f.templateVersion).toBe(2);
    expect(Object.keys(f.scores).sort()).toEqual(['c1', 'c2', 'c3']);
    expect(f).toMatchObject({ total: 12, percent: 80, band: 'พอใช้' });
    expect(buildObservationFields(input, false).templateVersion).toBe(1);
  });
  it('ภาพรวม: รายหมวด/รายข้อนับเฉพาะผลที่ใช้แบบเวอร์ชันเดียวกัน', () => {
    const mk = (v: number, scores: Record<string, number>, percent: number) => ({ submitted: true, acknowledged: false, percent, band: 'ดี' as const, scores: scores as any, templateVersion: v });
    const o = summarizeObservations([mk(2, { c1: 5, c2: 3, c3: 4 }, 80), mk(1, { s1_1: 1 }, 50)], sup2);
    expect(o.submitted).toBe(2);
    expect(o.sectionAverages).toEqual([{ no: 1, title: 'หมวดแรก', average: 4 }, { no: 2, title: 'หมวดสอง', average: 4 }]);
    expect(o.lowestItems[0]).toMatchObject({ id: 'c2', average: 3 });
  });
  it('แบบแผนการสอน: ครบ/เฉลี่ยตามแบบที่ระบุ; ไม่ระบุแบบ = เฉลี่ยทุกข้อใน scores', () => {
    const t: EvalTemplate = { kind: 'LESSON_PLAN', version: 2, criteria: [{ id: 'c1', label: 'ก' }, { id: 'c2', label: 'ข' }], sections: [] };
    expect(scoresComplete({ c1: 4, c2: 5 }, t)).toBe(true);
    expect(scoresComplete({ c1: 4 }, t)).toBe(false);
    expect(scoresComplete({ c1: 4, c2: 5 })).toBe(false); // v1 ต้องการ q1–q15
    expect(averageScore({ c1: 4, c2: 5 })).toBe(4.5);
    expect(averageScore({ c1: 4, c2: 5 }, t)).toBe(4.5);
  });
});

describe('ตรวจแบบร่างก่อนบันทึกเวอร์ชันใหม่', () => {
  it('แบบนิเทศถูกต้อง = ผ่าน', () => expect(validateTemplateDraft('SUPERVISION', sup2)).toBeNull());
  it('จับข้อผิดพลาด', () => {
    const v = (c: Partial<typeof sup2>) => validateTemplateDraft('SUPERVISION', { ...sup2, ...c });
    expect(v({ criteria: [] })).toMatch(/อย่างน้อย 1 ข้อ/);
    expect(v({ criteria: [{ id: 'c1', label: ' ', section: 1 }, ...sup2.criteria.slice(2)] })).toMatch(/ยังไม่ได้พิมพ์/);
    expect(v({ criteria: [{ id: 'c1', label: 'ก', section: 1 }, { id: 'c1', label: 'ข', section: 2 }] })).toMatch(/ซ้ำ/);
    expect(v({ criteria: [{ id: 'C 1', label: 'ก', section: 1 }] })).toMatch(/รหัส/);
    expect(v({ criteria: [{ id: 'c1', label: 'ก' }] })).toMatch(/หมวด/);
    expect(v({ criteria: [{ id: 'c1', label: 'ก', section: 9 }] })).toMatch(/หมวด/);
    expect(v({ sections: [{ no: 1, title: 'ก' }, { no: 2, title: 'ข' }, { no: 3, title: 'ว่างไม่มีข้อ' }] })).toMatch(/หมวด 3/);
    expect(v({ criteria: sup2.criteria.map(c => ({ ...c, assessmentMethod: true })) })).toMatch(/วิธีประเมิน/);
    expect(v({ criteria: Array.from({ length: 41 }, (_, i) => ({ id: `c${i + 1}`, label: 'x', section: 1 })), sections: [{ no: 1, title: 'ก' }] })).toMatch(/40/);
  });
  it('แบบแผนการสอนห้ามมีหมวด', () => {
    expect(validateTemplateDraft('LESSON_PLAN', { criteria: [{ id: 'c1', label: 'ก' }], sections: [] })).toBeNull();
    expect(validateTemplateDraft('LESSON_PLAN', { criteria: [{ id: 'c1', label: 'ก', section: 1 }], sections: [] })).toMatch(/ไม่มีหมวด/);
  });
});

describe('ตัวช่วยอื่น', () => {
  it('nextCriterionId ไม่ซ้ำและไม่นำ id เดิมกลับมาใช้', () => {
    expect(nextCriterionId([{ id: 'q1' }, { id: 'c3' }, { id: 'c1' }])).toBe('c4');
    expect(nextCriterionId([])).toBe('c1');
  });
  it('stripNumbering/เลขข้อตามลำดับจริงในหมวด', () => {
    expect(stripNumbering('2.9 ข้อสอง')).toBe('ข้อสอง');
    expect(stripNumbering('ข้อ 1 ยังอยู่')).toBe('ข้อ 1 ยังอยู่');
    expect(sup2.criteria.map(c => numberedLabel(sup2, c))).toEqual(['1.1 ข้อหนึ่ง', '1.2 ข้อสอง', '2.1 ข้อสาม']);
  });
  it('templateDocFields ↔ templateFromDoc ไปกลับได้ และไม่มี undefined', () => {
    const f = templateDocFields(sup2);
    expect(JSON.stringify(f)).not.toContain('undefined');
    expect(f.ids).toEqual(['c1', 'c2', 'c3']);
    expect(templateFromDoc('SUPERVISION', 2, f)).toEqual({ ...sup2, criteria: sup2.criteria.map(c => ({ ...c, label: c.label.trim() })) });
    expect(templateFromDoc('SUPERVISION', 2, { criteria: 'x' })).toBeNull();
    expect(templateFromDoc('SUPERVISION', 2, null)).toBeNull();
  });
});

describe('rules และการต่อสาย', () => {
  const rules = readSource('firestore.rules');
  it('เวอร์ชันแบบสร้างครั้งเดียว ห้ามแก้/ลบ; ตัวชี้ +1 และต้องมีเวอร์ชันนั้น', () => {
    expect(rules).toMatch(/match \/evaluation_template_versions\/\{vid\}[\s\S]*?allow update, delete: if false;/);
    expect(rules).toMatch(/existsAfter\(\/databases\/\$\(database\)\/documents\/evaluation_template_versions/);
  });
  it('ผลนิเทศ/รีวิวแผนใหม่ผูกกับเวอร์ชันปัจจุบัน', () => {
    expect(rules).toMatch(/templateVersion == supTplCurrent\(\)/);
    expect(rules).toMatch(/lpTplCurrent\(\)/);
    expect(rules).not.toMatch(/d\.templateVersion == 1\n/);
  });
  it('หน้าจอใช้แบบจาก hook ไม่อิงค่าคงที่เดิม', () => {
    for (const f of ['src/components/supervision/ObservationForm.tsx', 'src/components/supervision/ObservationResultView.tsx', 'src/components/lessonplans/LessonPlanReviewPanel.tsx']) {
      expect(readSource(f)).toMatch(/useEvaluationTemplates/);
      expect(readSource(f)).not.toMatch(/SUPERVISION_ITEMS|PLAN_CRITERIA/);
    }
  });
});

describe('สิทธิ์แก้แบบประเมิน = หัวหน้างานนิเทศคนเดียว', () => {
  it('canEditEvaluationTemplates: เฉพาะ INSTRUCTIONAL_SUPERVISOR', async () => {
    const { canEditEvaluationTemplates } = await import('../lib/supervision');
    expect(canEditEvaluationTemplates(['INSTRUCTIONAL_SUPERVISOR'])).toBe(true);
    for (const r of ['SUPER_ADMIN', 'SUPERVISORY_TEACHER', 'HEAD_OF_DEPARTMENT', 'DIRECTOR', 'DEPUTY_DIRECTOR_ACADEMIC', 'SUBJECT_TEACHER']) {
      expect(canEditEvaluationTemplates([r])).toBe(false);
    }
    expect(canEditEvaluationTemplates(undefined)).toBe(false);
  });
  it('firestore.rules: เขียน evaluation_template* ใช้ etEditor() (ไม่รวม SUPER_ADMIN)', async () => {
    const { readSource } = await import('./helpers/readSource');
    const rules = readSource('firestore.rules.comments');
    expect(rules).toMatch(/function etEditor\(\) \{\s*return hasRole\('INSTRUCTIONAL_SUPERVISOR'\);\s*\}/);
    const block = rules.slice(rules.indexOf('match /evaluation_template_versions/'), rules.indexOf('match /supervision_rounds/'));
    expect(block).not.toContain('supManage()');
    expect(block).not.toContain('SUPER_ADMIN');
    expect((block.match(/etEditor\(\)/g) || []).length).toBe(2);
  });
});
