/**
 * ข้อความแจ้งเตือนฝั่งนักเรียน/ผู้ปกครอง (parent_notifications) จากการดำเนินการของบุคลากร — ตรรกะบริสุทธิ์ที่ UI/เทสต์ใช้ร่วมกัน
 * หมายเหตุ: ไม่แจ้งนักเรียนเรื่องการคัดกรองสุขภาพจิตโดยตั้งใจ (ข้อมูลอ่อนไหว)
 */
export interface StudentNoticeText {
  title: string;
  message: string;
  type: 'info' | 'warning';
}

const baht = (n: number) => `${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท`;

export function invoiceIssuedNotice(inv: { title: string; totalAmount: number; dueDate: string }): StudentNoticeText {
  return {
    title: '🧾 มีใบแจ้งหนี้ใหม่',
    message: `${inv.title} จำนวน ${baht(inv.totalAmount)} กำหนดชำระ ${inv.dueDate} — ดูรายละเอียดและแนบสลิปได้ที่เมนูค่าใช้จ่าย`,
    type: 'info',
  };
}

export function slipVerifiedNotice(inv: { title: string; invoiceNumber: string }): StudentNoticeText {
  return {
    title: '✅ ยืนยันการชำระเงินแล้ว',
    message: `เจ้าหน้าที่การเงินยืนยันการชำระ "${inv.title}" (${inv.invoiceNumber}) เรียบร้อย — ดูใบเสร็จได้ที่เมนูค่าใช้จ่าย`,
    type: 'info',
  };
}

export function slipRejectedNotice(inv: { title: string; invoiceNumber: string }, reason: string): StudentNoticeText {
  return {
    title: '❌ สลิปไม่ผ่านการตรวจสอบ',
    message: `สลิปของ "${inv.title}" (${inv.invoiceNumber}) ไม่ผ่านการตรวจสอบ — เหตุผล: ${reason.trim() || 'ไม่ระบุ'} กรุณาแนบสลิปใหม่`,
    type: 'warning',
  };
}

export function portfolioDecisionNotice(entry: { title: string }, decision: 'APPROVED' | 'REJECTED', reviewerName: string, reason?: string): StudentNoticeText {
  return decision === 'APPROVED'
    ? { title: '✅ แฟ้มสะสมผลงานได้รับการอนุมัติ', message: `${reviewerName} อนุมัติรายการ "${entry.title}" ในแฟ้มสะสมผลงานแล้ว`, type: 'info' }
    : { title: '❌ แฟ้มสะสมผลงานไม่ได้รับการอนุมัติ', message: `${reviewerName} ไม่อนุมัติรายการ "${entry.title}"${reason ? ` — เหตุผล: ${reason}` : ''}`, type: 'warning' };
}
