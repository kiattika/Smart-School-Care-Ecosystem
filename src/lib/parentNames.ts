import type { FamilyHomeVisitInfo, ParentInfo } from '../types';

/** ชื่อ-สกุลเต็มของบิดา/มารดาจากแบบเยี่ยมบ้านฝั่งผู้ปกครอง (ว่าง = ผู้ปกครองยังไม่กรอกชื่อ) */
export const parentFullName = (p: Pick<ParentInfo, 'title' | 'firstName' | 'lastName'> | null | undefined): string =>
  p && p.firstName?.trim() ? [p.title, p.firstName, p.lastName].map(s => (s || '').trim()).filter(Boolean).join(' ').slice(0, 120) : '';

export interface ParentNames { fatherName: string; motherName: string }

export const deriveParentNames = (info: Pick<FamilyHomeVisitInfo, 'father' | 'mother'>): ParentNames => ({
  fatherName: parentFullName(info.father),
  motherName: parentFullName(info.mother),
});
