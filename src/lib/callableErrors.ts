/**
 * ข้อความ error จาก callable Cloud Function (HttpsError) ให้ผู้ใช้อ่าน — function ส่งข้อความภาษาไทยมาแล้ว
 * แต่ client SDK ต่อท้ายรหัส HTTP (เช่น " [400]") ให้ตัดออก; error ที่ไม่ใช่จาก function (เครือข่าย/internal)
 * ใช้ข้อความ fallback
 */
export function callableErrorMessage(err: unknown, fallback = 'ทำรายการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'): string {
  const e = err as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' ? e.code : '';
  const message = typeof e?.message === 'string' ? e.message.replace(/\s*\[\d{3}\]\s*$/, '').trim() : '';
  if (code === 'functions/internal' || code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
    return fallback;
  }
  return message || fallback;
}
