import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  defaultTemplate, templateDocFields, templateFromDoc, templateVersionDocId, validateTemplateDraft,
  type EvalTemplate, type TemplateKind,
} from '../lib/evaluationTemplate';

const VERSIONS = 'evaluation_template_versions';
const POINTER = 'evaluation_templates';

export interface TemplateSet { current: EvalTemplate; versions: Map<number, EvalTemplate> }

/**
 * ฟังแบบทุกเวอร์ชันของชนิดนี้ + ตัวชี้เวอร์ชันปัจจุบัน — เวอร์ชัน 1 (แบบตั้งต้นในโค้ด) ไม่มีเอกสาร
 * ตัวชี้ชี้ไปเวอร์ชันที่ยังโหลดไม่มา/รูปร่างเสีย = ถือว่ายังไม่พร้อม (ไม่ตกลงไปใช้แบบตั้งต้น เพราะจะให้คะแนนผิดแบบ)
 */
export function subscribeTemplates(kind: TemplateKind, cb: (set: TemplateSet | null) => void, onError?: (e: Error) => void): () => void {
  const versions = new Map<number, EvalTemplate>([[1, defaultTemplate(kind)]]);
  let pointer: number | null = 1;
  let gotVersions = false, gotPointer = false;
  const emit = () => {
    if (!gotVersions || !gotPointer) return;
    const cur = versions.get(pointer ?? 1);
    cb(cur ? { current: cur, versions: new Map(versions) } : null);
  };
  const u1 = onSnapshot(query(collection(db, VERSIONS), where('kind', '==', kind)), snap => {
    versions.clear(); versions.set(1, defaultTemplate(kind));
    for (const d of snap.docs) {
      const x = d.data();
      const t = typeof x.version === 'number' ? templateFromDoc(kind, x.version, x) : null;
      if (t && x.version >= 2) versions.set(x.version, t);
    }
    gotVersions = true; emit();
  }, e => onError?.(e));
  const u2 = onSnapshot(doc(db, POINTER, kind), snap => {
    const v = snap.exists() ? snap.data().currentVersion : 1;
    pointer = typeof v === 'number' && v >= 1 ? v : 1;
    gotPointer = true; emit();
  }, e => onError?.(e));
  return () => { u1(); u2(); };
}

/**
 * บันทึกเป็นเวอร์ชันใหม่ (= ปัจจุบัน + 1) — ผลเก่ายังใช้เวอร์ชันเดิม; ต้องเปิดแก้จากเวอร์ชันปัจจุบันจริง
 * (ถ้ามีคนอื่นบันทึกเวอร์ชันใหม่ไปก่อน จะไม่เขียนทับ — ให้โหลดใหม่แล้วแก้ซ้ำ)
 */
export async function saveNewTemplateVersion(kind: TemplateKind, draft: Pick<EvalTemplate, 'criteria' | 'sections'>, baseVersion: number, staffId: string): Promise<number> {
  const err = validateTemplateDraft(kind, draft);
  if (err) throw new Error(err);
  const next = baseVersion + 1;
  await runTransaction(db, async tx => {
    const ptrRef = doc(db, POINTER, kind);
    const ptr = await tx.get(ptrRef);
    const cur = ptr.exists() && typeof ptr.data().currentVersion === 'number' ? ptr.data().currentVersion : 1;
    if (cur !== baseVersion) throw new Error('มีการบันทึกแบบเวอร์ชันใหม่ไปแล้ว — โหลดหน้านี้ใหม่แล้วแก้อีกครั้ง');
    const tpl: EvalTemplate = { kind, version: next, criteria: draft.criteria, sections: draft.sections };
    tx.set(doc(db, VERSIONS, templateVersionDocId(kind, next)), { ...templateDocFields(tpl), createdAt: serverTimestamp(), createdByStaffId: staffId });
    tx.set(ptrRef, { kind, currentVersion: next, updatedAt: serverTimestamp(), updatedByStaffId: staffId });
  });
  return next;
}
