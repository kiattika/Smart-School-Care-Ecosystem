/**
 * authDomain ที่ใช้กับ Firebase Auth
 *
 * Chrome บน Android แยกพื้นที่เก็บข้อมูล (storage partitioning) ระหว่างโดเมนต่างกัน — ถ้าแอปเปิดที่
 * <project>.web.app แต่ authDomain เป็น <project>.firebaseapp.com หน้า /__/auth/handler จะอ่านสถานะตั้งต้น
 * ที่ SDK เขียนไว้ไม่เจอ → "Unable to process request due to missing initial state" (โหมดไม่ระบุตัวตนไม่เป็น)
 * ทางแก้ที่ Firebase แนะนำ: ให้ handler อยู่โดเมนเดียวกับแอป — Firebase Hosting เสิร์ฟ /__/auth/* ให้ทุกโดเมนอยู่แล้ว
 *
 * เปลี่ยนเฉพาะเมื่อเปิดที่ <projectId>.web.app พอดี; localhost/โดเมนอื่น/ค่าเดิมในไฟล์ config ไม่เปลี่ยน
 * ต้องเพิ่ม https://<projectId>.web.app/__/auth/handler ใน Authorized redirect URIs ของ OAuth Web client ก่อน deploy
 */
export function resolveAuthDomain(
  config: { projectId: string; authDomain: string },
  hostname: string | undefined,
): string {
  if (hostname && hostname === `${config.projectId}.web.app`) return hostname;
  return config.authDomain;
}
