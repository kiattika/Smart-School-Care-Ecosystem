import type { CourseScoreSetting } from '../types';

export const DEFAULT_SCORE_FORM = { preMidterm: 25, midterm: 20, postMidterm: 25, final: 30 };

/** แปลงค่าที่เก็บไว้ (maxXxx) เป็นรูปแบบฟอร์ม; ไม่มี = ค่าเริ่มต้น (เดิมส่ง object คีย์ maxXxx เข้าฟอร์มตรงๆ ทำให้ช่องว่าง/เพี้ยน) */
export function scoreSettingToForm(s?: CourseScoreSetting | null) {
  return s ? { preMidterm: s.maxPreMidterm, midterm: s.maxMidterm, postMidterm: s.maxPostMidterm, final: s.maxFinal } : { ...DEFAULT_SCORE_FORM };
}

export function scoreSettingDocId(staffId: string, courseId: string): string {
  return `${staffId}__${courseId.replace(/\//g, '_')}`;
}

export function isValidScoreSetting(s: { maxPreMidterm: number; maxMidterm: number; maxPostMidterm: number; maxFinal: number }): boolean {
  const v = [s.maxPreMidterm, s.maxMidterm, s.maxPostMidterm, s.maxFinal];
  return v.every(n => Number.isInteger(n) && n >= 0 && n <= 100) && v.reduce((a, b) => a + b, 0) === 100;
}
