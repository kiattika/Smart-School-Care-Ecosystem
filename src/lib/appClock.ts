/**
 * นาฬิกาของแอป (store.currentDate) — pure logic ทดสอบได้ (src/__tests__/appClock.test.ts)
 *
 * - production: currentDate = เวลาจริงเสมอ (useAppClock เรียก tickClock ทุก CLOCK_TICK_MS และทันทีเมื่อกลับมาที่แท็บ)
 * - DEV + กำลังจำลองเวลา (Time Simulation modal ใน TeacherPortal): คงชั่วโมง/นาทีที่จำลองไว้
 *   แต่ยังเลื่อน "วัน" ให้ตรงวันจริงถ้าแท็บค้างข้ามวัน (กันวันค้างแบบเงียบๆ เหมือนเดิม)
 * - timestamp ที่เขียนลง Firestore (เช่น submittedAt ของบันทึกหลังสอน) = เวลาตอนกดบันทึกจริง
 *   ยกเว้น DEV ที่กำลังจำลองเวลา (ใช้เวลาจำลองเพื่อทดสอบ isLate / midnight lock ได้)
 *
 * production ไม่มีทางอยู่ในโหมดจำลอง — ถึง isTimeSimulated จะถูกตั้งค่า ก็ไม่มีผลเมื่อ isDev = false
 */

/** เดินนาฬิกาทุก 30 วินาที (โจทย์: ไม่เกิน 60 วินาที) */
export const CLOCK_TICK_MS = 30_000;

export function nextClockValue(current: Date, now: Date, isTimeSimulated: boolean, isDev: boolean): Date {
  if (!(isDev && isTimeSimulated)) return now;
  if (now.toDateString() === current.toDateString()) return current;
  const rolled = new Date(now);
  rolled.setHours(current.getHours(), current.getMinutes(), 0, 0);
  return rolled;
}

/** เวลาที่ใช้เขียนลง Firestore / คำนวณ isLate ตอนกดบันทึก */
export function writeTimestamp(current: Date, now: Date, isTimeSimulated: boolean, isDev: boolean): Date {
  return isDev && isTimeSimulated ? current : now;
}
