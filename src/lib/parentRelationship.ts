/**
 * ความสัมพันธ์ของผู้ปกครองกับนักเรียน (คอลัมน์ Relationship ในไฟล์นำเข้าผู้ปกครอง)
 * — ใช้เป็นป้ายใต้ชื่อบน Navbar ของผู้ปกครอง
 * สำเนาของ functions/src/parentLineLogic.ts (แก้ต้องแก้ทั้งคู่ มี test เทียบ)
 */
export const PARENT_RELATIONSHIPS = ['บิดา', 'มารดา', 'ผู้ปกครอง'] as const;
export type ParentRelationship = typeof PARENT_RELATIONSHIPS[number];

/**
 * ชื่อผู้ปกครองตามทะเบียน (students.parentDisplayName ที่ฟังก์ชันคัดลอกให้ตอนเชื่อมบัญชี)
 * ว่าง/ไม่ใช่ข้อความ = '' (ผู้เรียกใช้ชื่อจากบัญชี LINE ตามเดิม — ไม่เดาชื่อ)
 */
export function parentDisplayNameOf(raw: unknown): string {
  const v = typeof raw === 'string' ? raw.trim() : '';
  return v.length > 0 && v.length <= 160 ? v : '';
}

/** ค่าที่รู้จัก → คืนตามนั้น; ว่าง/ไม่รู้จัก → "ผู้ปกครอง" (ป้ายกลางที่ไม่ผิดความจริง) */
export function parentRelationshipLabel(raw: unknown): ParentRelationship {
  const v = typeof raw === 'string' ? raw.trim() : '';
  return (PARENT_RELATIONSHIPS as readonly string[]).includes(v) ? (v as ParentRelationship) : 'ผู้ปกครอง';
}
