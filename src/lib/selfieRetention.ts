/**
 * รูปเซลฟี่เช็คอินเป็นข้อมูลส่วนบุคคลของนักเรียน (PDPA) — เก็บเท่าที่จำเป็นต่อการตรวจย้อนหลัง
 * เก็บในคอลเลกชันแยก gps_checkin_selfies พร้อม field expireAt ให้ Firestore TTL ลบเอกสารเองเมื่อครบกำหนด
 * (ต้องเปิด TTL policy ที่ Console ครั้งเดียว: collection group gps_checkin_selfies, field expireAt)
 * พิกัด/เวลา/สถานะใน gps_check_in_logs ยังอยู่ตามเดิม
 */
export const SELFIE_RETENTION_DAYS = 30;
export const SELFIE_COLLECTION = 'gps_checkin_selfies';

export function selfieExpiresAt(now: Date, days: number = SELFIE_RETENTION_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
