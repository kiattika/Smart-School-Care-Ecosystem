/**
 * สถานะบุคลากร (staff/{id}.status) — 'INACTIVE' = ถูกปิดการใช้งานผ่าน callable setStaffActive
 * ไม่มี field / ค่าอื่น = ใช้งานได้ (ข้อมูลเดิมก่อนมีระบบปิดการใช้งาน) — ตรงกับ isStaffInactive() ฝั่ง functions
 *
 * ใช้กรองรายการ "ให้เลือก" บุคลากร (ครูรับผิดชอบชุมนุม, ผู้อนุมัติสำรอง, ครูสอนแทน) — ห้ามใช้กรองการแสดง
 * ชื่อในบันทึกย้อนหลัง (คนที่ถูกปิดแล้วยังต้องแสดงชื่อในประวัติได้)
 */
export function isStaffActive(staff: { status?: unknown } | null | undefined): boolean {
  return !!staff && staff.status !== 'INACTIVE';
}
