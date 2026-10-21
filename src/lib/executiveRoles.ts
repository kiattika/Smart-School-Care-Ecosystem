/**
 * กลุ่มบทบาทผู้บริหาร — สิทธิ์เท่ากับ EXECUTIVE ทุกประการ
 * (รองผู้อำนวยการกลุ่มบริหารงบประมาณ / กลุ่มบริหารบุคคล / กลุ่มบริหารทั่วไป)
 * ต้องตรงกับ isExec() ใน firestore.rules.comments (มี test เทียบ)
 */
export const EXECUTIVE_EQUIVALENT_ROLES = [
  'EXECUTIVE',
  'DEPUTY_DIRECTOR_BUDGET',
  'DEPUTY_DIRECTOR_PERSONNEL',
  'DEPUTY_DIRECTOR_GENERAL',
] as const;

export function isExecutiveRole(role: string | null | undefined): boolean {
  return !!role && (EXECUTIVE_EQUIVALENT_ROLES as readonly string[]).includes(role);
}

/** มีบทบาทใดบทบาทหนึ่งในกลุ่มผู้บริหารหรือไม่ */
export function hasExecutiveRole(roles: readonly string[] | null | undefined): boolean {
  return !!roles && roles.some(isExecutiveRole);
}
