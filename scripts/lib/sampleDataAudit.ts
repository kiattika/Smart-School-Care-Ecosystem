/**
 * ตรรกะของ scripts/auditSampleData.ts — "อ่านอย่างเดียว" (ไม่มี method เขียน/ลบใน AuditStore เลยโดยโครงสร้าง)
 * แยกออกมาเป็น pure function ให้ unit test ได้ (src/__tests__/auditSampleData.test.ts)
 *
 * ⚠️ ห้ามเดาเกินกติกาที่ผู้ใช้ให้ไว้ (ดู classifyDoc) — collection นอกกติกา = UNCLASSIFIED ให้มนุษย์ตัดสินเอง
 */
import { normalizeEmail } from '../../src/lib/normalizeEmail';

export type Confidence = 'CERTAIN_REAL' | 'LIKELY_REAL' | 'LIKELY_SAMPLE' | 'UNCLASSIFIED';

/** อีเมลของบัญชีจริงที่ยืนยันแล้วว่าเป็นของจริงแน่นอน (staff / teachers) */
export const CERTAIN_REAL_EMAIL = 'kiattika@utd.ac.th';
/** staff doc id ที่ schedules จริงอ้างถึงใน teacherIds (กติกาจากผู้ใช้) */
export const REAL_SCHEDULE_TEACHER_ID = 'teacher_kiattisak';

/** field ที่ต้องอ่านเพื่อจัดกลุ่ม (ไม่อ่านที่เหลือ — ลดปริมาณข้อมูล) ; students = ไม่ต้องอ่าน field ใดเลย */
export const CLASSIFY_FIELDS: Record<string, string[]> = {
  staff: ['email'],
  teachers: ['email'],
  schedules: ['academicYear', 'term', 'teacherIds'],
  students: [],
};

/** field ที่น่าสนใจสำหรับ "ตัวอย่าง 3 เอกสารแรก" ของ collection ที่ไม่จัดกลุ่ม (แสดงเฉพาะที่มีอยู่จริงในเอกสาร) */
export const SAMPLE_FIELDS = [
  'studentId', 'teacherUid', 'teacherId', 'staffId', 'parentUid', 'createdBy', 'createdAt', 'updatedAt',
  'date', 'academicYear', 'term', 'scheduleId', 'classroom', 'room', 'email',
] as const;

export function classifyDoc(collection: string, data: Record<string, unknown>): Confidence {
  if (collection === 'staff' || collection === 'teachers') {
    return normalizeEmail(data.email) === CERTAIN_REAL_EMAIL ? 'CERTAIN_REAL' : 'LIKELY_SAMPLE';
  }
  if (collection === 'schedules') {
    const hasTerm = !!data.academicYear && !!data.term;
    const teacherIds = Array.isArray(data.teacherIds) ? data.teacherIds : [];
    return hasTerm && teacherIds.includes(REAL_SCHEDULE_TEACHER_ID) ? 'LIKELY_REAL' : 'LIKELY_SAMPLE';
  }
  if (collection === 'students') return 'LIKELY_SAMPLE'; // ยังไม่เคย import จริง — ทุกเอกสารเป็นตัวอย่าง (ตรวจสอบ)
  return 'UNCLASSIFIED';
}

export const isClassifiedCollection = (collection: string): boolean => collection in CLASSIFY_FIELDS;

/** อ่านอย่างเดียวเท่านั้น — ห้ามเพิ่ม method เขียน/ลบ */
export interface AuditStore {
  listCollections(): Promise<string[]>;
  /** อ่านทุกเอกสาร; fields = เฉพาะ field ที่ระบุ ([] = ได้แค่ id) */
  readAll(collection: string, fields: string[]): Promise<Array<{ id: string; data: Record<string, unknown> }>>;
  /** อ่าน n เอกสารแรก (ทุก field) */
  readFirst(collection: string, n: number): Promise<Array<{ id: string; data: Record<string, unknown> }>>;
}

export interface CollectionAudit {
  name: string;
  total: number;
  certainReal: string[];
  likelyReal: string[];
  likelySampleCount: number;
  likelySampleFirstIds: string[];
  unclassifiedCount: number;
  /** เฉพาะ collection ที่ไม่จัดกลุ่ม: 3 เอกสารแรก + field สำคัญที่มีอยู่จริง */
  samples: Array<{ id: string; fields: Record<string, string> }>;
}

export function summarizeValue(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'object' && typeof (v as { toDate?: unknown }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}

export async function auditCollection(store: AuditStore, name: string): Promise<CollectionAudit> {
  const result: CollectionAudit = {
    name, total: 0, certainReal: [], likelyReal: [], likelySampleCount: 0, likelySampleFirstIds: [], unclassifiedCount: 0, samples: [],
  };
  const docs = await store.readAll(name, isClassifiedCollection(name) ? CLASSIFY_FIELDS[name] : []);
  result.total = docs.length;
  for (const d of docs) {
    switch (classifyDoc(name, d.data)) {
      case 'CERTAIN_REAL': result.certainReal.push(d.id); break;
      case 'LIKELY_REAL': result.likelyReal.push(d.id); break;
      case 'LIKELY_SAMPLE':
        result.likelySampleCount++;
        if (result.likelySampleFirstIds.length < 5) result.likelySampleFirstIds.push(d.id);
        break;
      default: result.unclassifiedCount++;
    }
  }
  if (!isClassifiedCollection(name) && result.total > 0) {
    const first = await store.readFirst(name, 3);
    result.samples = first.map((d) => {
      const fields: Record<string, string> = {};
      for (const k of SAMPLE_FIELDS) if (k in d.data) fields[k] = summarizeValue(d.data[k]);
      return { id: d.id, fields };
    });
  }
  return result;
}

export async function runAudit(store: AuditStore): Promise<CollectionAudit[]> {
  const names = (await store.listCollections()).slice().sort();
  const out: CollectionAudit[] = [];
  for (const n of names) out.push(await auditCollection(store, n));
  return out;
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const idList = (ids: string[]) => (ids.length ? ids.map((i) => `\`${cell(i)}\``).join(', ') : '—');

export function renderReport(audits: CollectionAudit[], meta: { date: string; targetLabel: string; databaseId: string }): string {
  const L: string[] = [];
  L.push(`# รายงานตรวจข้อมูลตัวอย่าง (Sample Data Audit) — ${meta.date}`, '');
  L.push(`- เป้าหมาย: ${meta.targetLabel} / database \`${meta.databaseId}\``);
  L.push('- **อ่านอย่างเดียว** — สคริปต์ไม่เขียน/ลบข้อมูลใดๆ รายงานนี้ให้มนุษย์ตัดสินใจ ไม่ใช่ข้อเสนอให้ลบ');
  L.push('- ครอบคลุมเฉพาะ collection ระดับบนสุด (ไม่รวม subcollection เช่น `student_screening_progress/{sid}/grants`)');
  L.push('- ⚠️ ไฟล์นี้มี id/อีเมลจริงบางส่วน — ตรวจก่อน commit', '');
  L.push('## กติกาจัดกลุ่ม', '');
  L.push(`- staff / teachers: email = \`${CERTAIN_REAL_EMAIL}\` (หลัง normalize) → **ของจริงแน่นอน**; ที่เหลือ → น่าจะเป็นตัวอย่าง`);
  L.push(`- schedules: มี academicYear + term ครบ **และ** teacherIds มี \`${REAL_SCHEDULE_TEACHER_ID}\` → **น่าจะของจริง**; ที่เหลือ → น่าจะเป็นตัวอย่าง`);
  L.push('- students: ทุกเอกสาร → น่าจะเป็นตัวอย่าง (ยังไม่เคย import จริง)');
  L.push('- collection อื่น: ไม่จัดกลุ่ม แสดงจำนวน + ตัวอย่าง field ของ 3 เอกสารแรก', '');

  L.push('## สรุปทุก collection', '');
  L.push('| collection | เอกสารทั้งหมด | ของจริงแน่นอน | น่าจะของจริง | น่าจะเป็นตัวอย่าง | ไม่จัดกลุ่ม |');
  L.push('|---|---:|---:|---:|---:|---:|');
  for (const a of audits) {
    L.push(`| ${cell(a.name)} | ${a.total} | ${a.certainReal.length} | ${a.likelyReal.length} | ${a.likelySampleCount} | ${a.unclassifiedCount} |`);
  }
  L.push('');

  const classified = audits.filter((a) => isClassifiedCollection(a.name));
  L.push('## รายละเอียด collection ที่จัดกลุ่มได้', '');
  for (const a of classified) {
    L.push(`### ${a.name} (${a.total} เอกสาร)`, '');
    L.push(`- **ของจริงแน่นอน (${a.certainReal.length}) — ห้ามลบ:** ${idList(a.certainReal)}`);
    if (a.name === 'schedules') L.push(`- **น่าจะของจริง (${a.likelyReal.length}) — ครบทุก id:** ${idList(a.likelyReal)}`);
    L.push(`- น่าจะเป็นตัวอย่าง (${a.likelySampleCount}) — 5 id แรก: ${idList(a.likelySampleFirstIds)}`, '');
  }

  const unclassified = audits.filter((a) => !isClassifiedCollection(a.name));
  L.push('## collection ที่ไม่จัดกลุ่ม (ให้มนุษย์ตัดสินใจ)', '');
  for (const a of unclassified) {
    L.push(`### ${a.name} (${a.total} เอกสาร)`, '');
    if (a.total === 0) { L.push('ว่างเปล่า', ''); continue; }
    for (const s of a.samples) {
      const f = Object.entries(s.fields).map(([k, v]) => `${k}=${cell(v)}`).join(', ');
      L.push(`- \`${cell(s.id)}\`${f ? ` — ${f}` : ''}`);
    }
    L.push('');
  }

  L.push('## คำถามที่ต้องให้ผู้ใช้ตอบ (ยังไม่มีข้อเสนอให้ลบ)', '');
  let n = 1;
  for (const a of classified) {
    if (a.total === 0) continue;
    if (a.name === 'students') {
      L.push(`${n++}. **students** มี ${a.total} เอกสาร ทั้งหมดดูเหมือนตัวอย่าง (ยังไม่เคย import จริง) ยืนยันว่าลบได้ทั้งหมดไหม`);
    } else if (a.likelySampleCount > 0) {
      const keep = a.certainReal.length + a.likelyReal.length;
      L.push(`${n++}. **${a.name}** มี ${a.total} เอกสาร: ${a.likelySampleCount} ดูเหมือนตัวอย่าง, ${keep} ดูเหมือนของจริง (ดูรายการด้านบน) ยืนยันว่า ${a.likelySampleCount} ที่ดูเหมือนตัวอย่างลบได้ทั้งหมดไหม`);
    } else {
      L.push(`${n++}. **${a.name}** มี ${a.total} เอกสาร ไม่พบเอกสารที่ดูเหมือนตัวอย่าง — ถูกต้องไหม`);
    }
  }
  for (const a of unclassified) {
    if (a.total === 0) continue;
    L.push(`${n++}. **${a.name}** มี ${a.total} เอกสาร ผูกกับ staff/students/schedules ตัวอย่างไหม ควรลบตามหรือเก็บไว้`);
  }
  L.push('');
  return L.join('\n');
}
