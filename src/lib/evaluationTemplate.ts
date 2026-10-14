/**
 * แบบประเมินที่แอดมิน/หัวหน้างานนิเทศแก้ไขได้ (แบบสังเกตการสอน + แบบประเมินแผนการสอน)
 *
 * - แบบเป็น "เวอร์ชัน" ที่แก้ย้อนหลังไม่ได้: Firestore `evaluation_template_versions/{KIND}_{n}` (สร้างครั้งเดียว) +
 *   ตัวชี้เวอร์ชันปัจจุบัน `evaluation_templates/{KIND}.currentVersion` (ต้องตรง firestore.rules บล็อก "evaluation_template*")
 * - เวอร์ชัน 1 = แบบตั้งต้นในโค้ด (ไม่มีเอกสาร): ผลเก่าทั้งหมดเป็นเวอร์ชัน 1 และยังแสดงด้วยแบบเดิมเสมอ
 * - ผลที่บันทึกเก็บ `templateVersion` ของแบบที่ใช้ — ฉบับร่างที่ค้างอยู่ใช้แบบเดิมจนส่ง; ผลใหม่ต้องใช้เวอร์ชันปัจจุบัน
 * - มาตราคะแนนยังเป็น 1–5 เสมอ (ระดับ/เกณฑ์ผลสรุปเดิมคงที่) — แก้ได้เฉพาะรายการข้อ (เพิ่ม/ลบ/เรียง/แก้ข้อความ) และหมวด
 */
import type { SupervisionItem } from './supervision';
import { DEFAULT_SUPERVISION_TEMPLATE } from './supervision';
import { DEFAULT_LESSON_PLAN_TEMPLATE } from './lessonPlans';

export type TemplateKind = 'SUPERVISION' | 'LESSON_PLAN';
export const TEMPLATE_KINDS: readonly TemplateKind[] = ['SUPERVISION', 'LESSON_PLAN'];
export const TEMPLATE_KIND_LABEL: Record<TemplateKind, string> = {
  SUPERVISION: 'แบบสังเกตการสอน (นิเทศ)',
  LESSON_PLAN: 'แบบประเมินแผนการสอน',
};

export interface EvalCriterion {
  id: string;
  label: string;
  /** เฉพาะแบบสังเกตการสอน: หมวดที่สังกัด */
  section?: number;
  /** เฉพาะแบบสังเกตการสอน: มีช่องระบุวิธีประเมินผลใต้ข้อนี้ (ข้อเดียวต่อแบบ) */
  assessmentMethod?: boolean;
}
export interface EvalSection { no: number; title: string }
export interface EvalTemplate {
  kind: TemplateKind;
  version: number;
  criteria: EvalCriterion[];
  sections: EvalSection[];
}

export const MAX_CRITERIA = 40;
export const MAX_SECTIONS = 10;
export const MAX_LABEL = 300;
export const MAX_SECTION_TITLE = 120;
export const CRITERION_ID_RE = /^[a-z][a-z0-9_]{0,19}$/;

export const templateVersionDocId = (kind: TemplateKind, version: number) => `${kind}_${version}`;

export function defaultTemplate(kind: TemplateKind): EvalTemplate {
  return kind === 'SUPERVISION' ? DEFAULT_SUPERVISION_TEMPLATE : DEFAULT_LESSON_PLAN_TEMPLATE;
}

/** ตัดเลขข้อนำหน้า ("1.2 การตรงต่อเวลา" → "การตรงต่อเวลา") — เลขข้อแสดงจากลำดับจริงในแบบ ไม่เก็บในข้อความ */
export const stripNumbering = (s: string) => (s || '').replace(/^\s*\d+(?:\.\d+)*[.)]?\s+/, '').trim();

/** ข้อความข้อสำหรับแสดง: แบบที่มีหมวด = "หมวด.ลำดับในหมวด ข้อความ" ส่วนแบบไม่มีหมวด = ข้อความตรงๆ */
export function numberedLabel(tpl: Pick<EvalTemplate, 'criteria'>, c: EvalCriterion): string {
  if (c.section === undefined) return c.label;
  const inSection = tpl.criteria.filter(x => x.section === c.section);
  return `${c.section}.${inSection.findIndex(x => x.id === c.id) + 1} ${stripNumbering(c.label)}`;
}

/** รหัสข้อใหม่ (c1, c2, …) ที่ไม่ซ้ำกับข้อที่มีอยู่ — รหัสเป็นคีย์ใน scores จึงห้ามเปลี่ยน/ใช้ซ้ำกับข้ออื่นในแบบเดียวกัน */
export function nextCriterionId(criteria: readonly Pick<EvalCriterion, 'id'>[]): string {
  let max = 0;
  for (const c of criteria) { const m = /^c(\d+)$/.exec(c.id); if (m) max = Math.max(max, Number(m[1])); }
  return `c${max + 1}`;
}

/** ข้อผิดพลาดที่อ่านรู้เรื่อง — null = บันทึกเป็นเวอร์ชันใหม่ได้ */
export function validateTemplateDraft(kind: TemplateKind, draft: Pick<EvalTemplate, 'criteria' | 'sections'>): string | null {
  const { criteria, sections } = draft;
  if (criteria.length < 1) return 'ต้องมีอย่างน้อย 1 ข้อ';
  if (criteria.length > MAX_CRITERIA) return `ใส่ได้ไม่เกิน ${MAX_CRITERIA} ข้อ`;
  const ids = new Set<string>();
  for (const c of criteria) {
    if (!CRITERION_ID_RE.test(c.id)) return `รหัสข้อไม่ถูกต้อง: ${c.id}`;
    if (ids.has(c.id)) return `รหัสข้อซ้ำ: ${c.id}`;
    ids.add(c.id);
    const label = (c.label || '').trim();
    if (!label) return 'มีข้อที่ยังไม่ได้พิมพ์ข้อความ';
    if (label.length > MAX_LABEL) return `ข้อความของข้อยาวเกิน ${MAX_LABEL} ตัวอักษร`;
  }
  if (kind === 'LESSON_PLAN') {
    if (sections.length > 0 || criteria.some(c => c.section !== undefined || c.assessmentMethod)) return 'แบบประเมินแผนการสอนไม่มีหมวด';
    return null;
  }
  if (sections.length < 1) return 'ต้องมีอย่างน้อย 1 หมวด';
  if (sections.length > MAX_SECTIONS) return `ใส่ได้ไม่เกิน ${MAX_SECTIONS} หมวด`;
  const nos = new Set<number>();
  for (const s of sections) {
    if (!Number.isInteger(s.no) || s.no < 1) return 'เลขหมวดไม่ถูกต้อง';
    if (nos.has(s.no)) return `เลขหมวดซ้ำ: ${s.no}`;
    nos.add(s.no);
    const t = (s.title || '').trim();
    if (!t) return 'มีหมวดที่ยังไม่ได้ตั้งชื่อ';
    if (t.length > MAX_SECTION_TITLE) return `ชื่อหมวดยาวเกิน ${MAX_SECTION_TITLE} ตัวอักษร`;
  }
  for (const c of criteria) if (c.section === undefined || !nos.has(c.section)) return 'มีข้อที่ยังไม่ได้เลือกหมวด';
  for (const s of sections) if (!criteria.some(c => c.section === s.no)) return `หมวด ${s.no} ยังไม่มีข้อ (ลบหมวดที่ไม่ใช้ออก)`;
  if (criteria.filter(c => c.assessmentMethod).length > 1) return 'ช่องระบุวิธีประเมินผลมีได้ข้อเดียว';
  return null;
}

/** ฟิลด์ที่เขียนลง evaluation_template_versions (ไม่รวม createdAt ที่ service ใส่เวลาเซิร์ฟเวอร์) — ไม่มีค่า undefined */
export function templateDocFields(tpl: EvalTemplate) {
  return {
    kind: tpl.kind,
    version: tpl.version,
    ids: tpl.criteria.map(c => c.id),
    criteria: tpl.criteria.map(c => ({
      id: c.id,
      label: c.label.trim(),
      ...(tpl.kind === 'SUPERVISION' && c.section !== undefined ? { section: c.section } : {}),
      ...(c.assessmentMethod ? { assessmentMethod: true } : {}),
    })),
    sections: tpl.sections.map(s => ({ no: s.no, title: s.title.trim() })),
  };
}

/** แปลงเอกสารจาก Firestore เป็นแบบ (ป้องกันรูปร่างผิด — ไม่ถูกต้อง = null) */
export function templateFromDoc(kind: TemplateKind, version: number, data: unknown): EvalTemplate | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.criteria)) return null;
  const criteria: EvalCriterion[] = [];
  for (const raw of d.criteria) {
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== 'string' || typeof c.label !== 'string') return null;
    criteria.push({
      id: c.id, label: c.label,
      ...(typeof c.section === 'number' ? { section: c.section } : {}),
      ...(c.assessmentMethod === true ? { assessmentMethod: true } : {}),
    });
  }
  const sections: EvalSection[] = Array.isArray(d.sections)
    ? (d.sections as unknown[]).flatMap(s => (s && typeof s === 'object' && typeof (s as any).no === 'number' && typeof (s as any).title === 'string' ? [{ no: (s as any).no, title: (s as any).title }] : []))
    : [];
  return { kind, version, criteria, sections };
}

/** ใช้กับตัวช่วยเดิมที่รับรายการข้อแบบ SupervisionItem */
export const asSupervisionItems = (tpl: EvalTemplate): SupervisionItem[] =>
  tpl.criteria.map(c => ({ id: c.id, section: c.section ?? 0, label: numberedLabel(tpl, c) }));
