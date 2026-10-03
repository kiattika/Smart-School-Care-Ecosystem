/**
 * staff doc id ของบัญชีทดสอบใน emulator — รูปแบบ teacherId (เช่น test_advisor_001 → tch-advisor-001)
 * ที่ **ไม่เท่ากับ Auth UID เสมอ** เหมือน production (staff key ด้วย teacherId จากไฟล์ import)
 * เพื่อให้บั๊กที่เทียบ staff id กับ user.uid โผล่บน emulator ด้วย (ดู src/lib/staffIdentity.ts)
 */
export function seedStaffIdFor(uid: string): string {
  const id = `tch-${uid.replace(/^test_/, '').replace(/_/g, '-')}`;
  if (id === uid) throw new Error(`seed staffId must differ from uid (${uid})`);
  return id;
}
