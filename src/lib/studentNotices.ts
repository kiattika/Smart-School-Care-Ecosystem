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

export function infirmaryVisitNotice(visit: { symptoms: string; visitTime: string; isUrgentAlert: boolean }, studentName: string): { title: string; message: string; type: 'info' | 'warning' | 'critical' } {
  return {
    title: visit.isUrgentAlert ? '🚨 แจ้งเตือนด่วน: นักเรียนเข้าห้องพยาบาล' : '🏥 แจ้งเตือน: นักเรียนเข้าห้องพยาบาล',
    message: `น้อง${studentName} เข้ารับบริการห้องพยาบาลด้วยอาการ "${visit.symptoms}" เมื่อเวลา ${visit.visitTime} กรุณากดรับทราบที่เมนูห้องพยาบาล`,
    type: visit.isUrgentAlert ? 'critical' : 'warning',
  };
}

/** ผลคำร้องขอฝึกงาน (งานแนะแนวอนุมัติ/ไม่อนุมัติ) — เลขที่หนังสือไม่ใส่ในข้อความ (นักเรียนดูได้ที่หน้าคำร้อง) */
export function internshipDecisionNotice(r: { periodLabel: string; companyName: string }, to: 'APPROVED' | 'REJECTED', staffNote?: string): StudentNoticeText {
  const where = `${r.companyName || 'สถานประกอบการ'}${r.periodLabel ? ` (${r.periodLabel})` : ''}`;
  const note = staffNote && staffNote.trim() ? ` — หมายเหตุ: ${staffNote.trim()}` : '';
  return to === 'APPROVED'
    ? { title: '✅ คำร้องขอฝึกงานได้รับการอนุมัติ', message: `งานแนะแนวอนุมัติคำร้องขอฝึกงาน ${where}${note} — ดูรายละเอียดและหนังสือได้ที่เมนูฝึกงาน`, type: 'info' }
    : { title: '❌ คำร้องขอฝึกงานไม่ได้รับการอนุมัติ', message: `งานแนะแนวไม่อนุมัติคำร้องขอฝึกงาน ${where}${note} — ยื่นคำร้องใหม่ได้ขณะที่ยังเปิดรับ`, type: 'warning' };
}

const FUND_KIND_TH = { SCHOLARSHIP: 'ทุนการศึกษา', STUDENT_LOAN: 'กองทุนกู้ยืม (กยศ.)' } as const;

/** ผลคัดเลือกทุน/กยศ. — แจ้งเฉพาะสถานะที่เป็นผลต่อนักเรียน (รายชื่อสำรอง/ได้รับ/ไม่ได้รับ) */
export function fundDecisionNotice(kind: keyof typeof FUND_KIND_TH, programTitle: string, to: 'SHORTLISTED' | 'AWARDED' | 'NOT_SELECTED', staffNote?: string): StudentNoticeText | null {
  const k = FUND_KIND_TH[kind] || 'ทุน';
  const note = staffNote && staffNote.trim() ? ` — หมายเหตุ: ${staffNote.trim()}` : '';
  if (to === 'AWARDED') return { title: `🎉 ได้รับ${k}`, message: `งานกองทุนและทุนการศึกษาบันทึกผล "${programTitle}": ได้รับการคัดเลือก${note}`, type: 'info' };
  if (to === 'SHORTLISTED') return { title: `📋 ผ่านการคัดเลือกเบื้องต้น (${k})`, message: `"${programTitle}": ท่านอยู่ในรายชื่อผ่านการคัดเลือกเบื้องต้น รอผลขั้นสุดท้าย${note}`, type: 'info' };
  if (to === 'NOT_SELECTED') return { title: `ℹ️ ผลคัดเลือก${k}`, message: `"${programTitle}": ไม่ได้รับการคัดเลือกในรอบนี้${note}`, type: 'warning' };
  return null;
}

/** ผลแก้ตัว/เรียนซ้ำที่งานทะเบียนบันทึก — เกรดใหม่เป็นผลทางวิชาการของนักเรียน (ไม่ใช่ข้อมูลอ่อนไหวด้านสุขภาพ) */
export function retakeResultNotice(r: { courseCode: string; courseName: string; kind: 'MAKEUP' | 'REPEAT'; originalGrade: string; newGrade: string }, isUpdate: boolean): StudentNoticeText {
  const kind = r.kind === 'REPEAT' ? 'เรียนซ้ำ' : 'แก้ตัว';
  return {
    title: isUpdate ? `📝 แก้ไขผล${kind}` : `📝 บันทึกผล${kind}`,
    message: `${r.courseCode} ${r.courseName}: เกรดเดิม ${r.originalGrade || '-'} → เกรดใหม่ ${r.newGrade} — ดูในเมนูผลการเรียน (ไม่เป็นทางการ ผลทางการยึดงานทะเบียน/SGS)`,
    type: 'info',
  };
}
