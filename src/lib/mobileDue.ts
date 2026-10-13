/** ตรรกะ "ถึงเวลาทำแล้วหรือยัง" ของแบบประเมินบนมือถือ — ล้วน ๆ (test ได้) */

export const TWO_Q_INTERVAL_DAYS = 14;

/** 2Q ทำทุก 2 สัปดาห์: ยังไม่เคยทำ/วันที่ผิดรูปแบบ = ถึงกำหนด; ทำล่าสุดเมื่อ ≥ 14 วันก่อน = ถึงกำหนด */
export function isTwoQDue(lastConductedYmd: string | null | undefined, todayYmd: string): boolean {
  if (!lastConductedYmd || !/^\d{4}-\d{2}-\d{2}$/.test(lastConductedYmd)) return true;
  const last = Date.parse(`${lastConductedYmd}T00:00:00Z`);
  const today = Date.parse(`${todayYmd}T00:00:00Z`);
  if (Number.isNaN(last) || Number.isNaN(today)) return true;
  return Math.floor((today - last) / 86_400_000) >= TWO_Q_INTERVAL_DAYS;
}

/** สถานะที่ตัดสินเมนูแบบประเมิน — undefined = ยังโหลดไม่เสร็จ (ซ่อนไว้ก่อน กันเมนูโผล่แล้วหาย) */
export interface MobileDueStatus {
  healthDone?: boolean; // บันทึกสุขภาพภาคเรียนนี้แล้ว (นักเรียน)
  sdqDone?: boolean;    // ประเมิน SDQ ปีการศึกษานี้แล้ว (ฉบับของผู้ใช้เอง)
  twoQDue?: boolean;    // ถึงกำหนดทำ 2Q (นักเรียน)
}
