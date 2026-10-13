/** หมู่เลือด ABO — ไม่เปลี่ยนตลอดชีวิต: นักเรียน/ผู้ปกครองเลือกได้ครั้งเดียว แก้ภายหลังได้เฉพาะพยาบาล/แอดมิน */
export const BLOOD_GROUPS = ['A', 'B', 'AB', 'O'] as const;
export type BloodGroup = typeof BLOOD_GROUPS[number];
export const isBloodGroup = (v: unknown): v is BloodGroup => typeof v === 'string' && (BLOOD_GROUPS as readonly string[]).includes(v);
