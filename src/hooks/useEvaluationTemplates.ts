import { useEffect, useState } from 'react';
import { subscribeTemplates, type TemplateSet } from '../services/evaluationTemplateService';
import type { EvalTemplate, TemplateKind } from '../lib/evaluationTemplate';
import { defaultTemplate } from '../lib/evaluationTemplate';

export interface TemplatesState {
  /** แบบปัจจุบัน (โหลดไม่สำเร็จ/ยังไม่พร้อม = null — ห้ามเปิดให้ให้คะแนนจนกว่าจะพร้อม) */
  current: EvalTemplate | null;
  /** แบบตามเวอร์ชันที่ผลบันทึกไว้ — เวอร์ชันที่หาไม่เจอคืนแบบตั้งต้น v1 ถ้าเป็น 1 ไม่งั้น null */
  byVersion: (v: number | undefined) => EvalTemplate | null;
  versions: EvalTemplate[];
  loading: boolean;
  error: string | null;
}

export function useEvaluationTemplates(kind: TemplateKind): TemplatesState {
  const [state, setState] = useState<{ set: TemplateSet | null; loading: boolean; error: string | null }>({ set: null, loading: true, error: null });
  useEffect(() => subscribeTemplates(
    kind,
    set => setState({ set, loading: false, error: null }),
    e => setState({ set: null, loading: false, error: e.message }),
  ), [kind]);
  const { set } = state;
  return {
    current: set?.current ?? null,
    byVersion: v => { const n = v ?? 1; return set?.versions.get(n) ?? (n === 1 ? defaultTemplate(kind) : null); },
    versions: set ? [...set.versions.values()].sort((a, b) => a.version - b.version) : [],
    loading: state.loading,
    error: state.error,
  };
}
