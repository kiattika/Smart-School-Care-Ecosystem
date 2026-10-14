/**
 * สายงานนัดพบครูของผู้ปกครอง (parent_appointments) — ตรรกะบริสุทธิ์ที่ UI และเทสต์ใช้ร่วมกัน
 * (ต้องตรงกับ firestore.rules ของ parent_appointments — ทดสอบเทียบใน firestore.rules.test.ts)
 *
 *   ผู้ปกครองขอนัด → REQUESTED → (ครูผู้รับ) CONFIRMED | DECLINED
 *   CONFIRMED → (ครูผู้รับ) COMPLETED
 *   REQUESTED | CONFIRMED → (ผู้ปกครอง) CANCELLED
 *
 * ผู้รับ: HOMEROOM = ครูที่ปรึกษาของห้องนักเรียน (ตาม homeroomClass), GUIDANCE = ครูแนะแนว (ทุกคนที่มีบทบาทนี้)
 */
export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED';
export type AppointmentRecipient = 'HOMEROOM' | 'GUIDANCE';
export type AppointmentMeetingType = 'IN_PERSON' | 'ONLINE_MEET';

export const APPOINTMENT_RECIPIENT_LABEL: Record<AppointmentRecipient, string> = {
  HOMEROOM: 'ครูที่ปรึกษา',
  GUIDANCE: 'ครูแนะแนว',
};

export const APPOINTMENT_MEETING_LABEL: Record<AppointmentMeetingType, string> = {
  IN_PERSON: 'พบที่โรงเรียน',
  ONLINE_MEET: 'Google Meet',
};

/** ช่วงเวลาที่เปิดให้ขอนัด — ต้องตรงกับรายการใน firestore.rules */
export const APPOINTMENT_TIME_SLOTS = ['15:30 - 16:00 น.', '16:00 - 16:30 น.', '16:30 - 17:00 น.'] as const;

export const APPOINTMENT_TOPIC_MAX = 500;
export const APPOINTMENT_NOTE_MAX = 500;
export const APPOINTMENT_PLACE_MAX = 300;

export function appointmentStatusLabel(status: string): string {
  switch (status) {
    case 'REQUESTED': return '⏳ รอครูยืนยัน';
    case 'CONFIRMED': return '✓ ยืนยันการนัดแล้ว';
    case 'DECLINED': return 'ครูไม่สะดวก — ขอนัดใหม่ได้';
    case 'COMPLETED': return '✓ พบกันแล้ว';
    case 'CANCELLED': return 'ยกเลิกแล้ว';
    default: return status;
  }
}

/** ครูผู้รับตอบรับ/ปฏิเสธได้เฉพาะคำขอที่ยังรออยู่ */
export const canRespondAppointment = (status: string) => status === 'REQUESTED';
/** ปิดงานว่า "พบกันแล้ว" ได้เฉพาะนัดที่ยืนยันแล้ว */
export const canCompleteAppointment = (status: string) => status === 'CONFIRMED';
/** ผู้ปกครองยกเลิกได้ตราบที่ยังไม่จบ */
export const canCancelAppointment = (status: string) => status === 'REQUESTED' || status === 'CONFIRMED';
/** งานค้างของครู = คำขอที่ยังไม่ตอบ */
export const isAppointmentPending = (status: string) => status === 'REQUESTED';

/** ลิงก์ที่เปิดเป็น <a href> ได้อย่างปลอดภัย — เฉพาะ https:// (กัน javascript:/data:) */
export function safeMeetingLink(value: string | undefined | null): string | null {
  const v = (value || '').trim();
  return /^https:\/\/[^\s]+$/i.test(v) ? v : null;
}

/** นัดนี้ครูคนนี้ตอบ/ปิดงานได้ไหม — ตรงกับ canHandleAppointment ใน rules (นัดแนะแนวที่ระบุครู = เฉพาะครูคนนั้น; '' = ใครก็ได้) */
export function canStaffHandleAppointment(
  apt: { recipient: string; targetStaffId?: string },
  myStaffId: string | undefined,
): boolean {
  if (apt.recipient !== 'GUIDANCE') return true;
  const t = apt.targetStaffId || '';
  return t === '' || (!!myStaffId && t === myStaffId);
}

export interface AppointmentFormInput {
  recipient: AppointmentRecipient | '';
  /** เลือกครูแนะแนว (เฉพาะ recipient=GUIDANCE); '' / ไม่ส่ง = ใครก็ได้ */
  targetStaffId?: string;
  preferredDate: string;
  timeSlot: string;
  meetingType: AppointmentMeetingType | '';
  topic: string;
}

/** ตรวจฟอร์มขอนัด — คืนรายการข้อความผิดพลาด (ว่าง = ผ่าน); todayYmd ใช้กันวันที่ย้อนหลัง */
export function validateAppointmentForm(f: AppointmentFormInput, todayYmd: string): string[] {
  const errs: string[] = [];
  if (f.recipient !== 'HOMEROOM' && f.recipient !== 'GUIDANCE') errs.push('เลือกว่าต้องการพบครูที่ปรึกษาหรือครูแนะแนว');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.preferredDate)) errs.push('เลือกวันที่ต้องการนัดพบ');
  else if (f.preferredDate < todayYmd) errs.push('วันที่นัดพบต้องเป็นวันนี้หรือหลังจากนี้');
  if (f.targetStaffId && f.recipient !== 'GUIDANCE') errs.push('เลือกครูผู้รับได้เฉพาะการนัดพบครูแนะแนว');
  if (!(APPOINTMENT_TIME_SLOTS as readonly string[]).includes(f.timeSlot)) errs.push('เลือกช่วงเวลา');
  if (f.meetingType !== 'IN_PERSON' && f.meetingType !== 'ONLINE_MEET') errs.push('เลือกรูปแบบการพบ');
  const topic = f.topic.trim();
  if (!topic) errs.push('ระบุหัวข้อที่ต้องการปรึกษา');
  else if (topic.length > APPOINTMENT_TOPIC_MAX) errs.push(`หัวข้อยาวเกิน ${APPOINTMENT_TOPIC_MAX} ตัวอักษร`);
  return errs;
}

/** ตรวจตอนครูยืนยัน: นัดออนไลน์ต้องใส่ลิงก์ https; นัดที่โรงเรียนต้องระบุสถานที่ */
export function validateConfirmation(meetingType: string, locationOrLink: string): string[] {
  const v = locationOrLink.trim();
  if (meetingType === 'ONLINE_MEET') {
    if (!safeMeetingLink(v)) return ['ใส่ลิงก์ประชุมที่ขึ้นต้นด้วย https://'];
  } else if (!v) {
    return ['ระบุสถานที่นัดพบ'];
  }
  if (v.length > APPOINTMENT_PLACE_MAX) return [`ยาวเกิน ${APPOINTMENT_PLACE_MAX} ตัวอักษร`];
  return [];
}
