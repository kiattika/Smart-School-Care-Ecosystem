/**
 * สร้าง payload Thai QR Payment (PromptPay Credit Transfer — EMVCo/มาตรฐาน ธปท.) — ตรรกะบริสุทธิ์ (test ได้)
 *
 * ผู้รับเงิน 3 แบบ: เบอร์โทรศัพท์ (10 หลัก ขึ้นต้น 0), เลขบัตรประชาชน/เลขผู้เสียภาษี (13 หลัก), e-Wallet ID (15 หลัก)
 * ใส่จำนวนเงินได้ (จะเป็น QR แบบ dynamic) — ไม่ใส่ = QR แบบ static ให้ผู้โอนกรอกยอดเอง
 * หมายเหตุ: QR PromptPay ไม่มีช่องอ้างอิงเลขใบแจ้งหนี้ — ใช้การแนบสลิป + เลขอ้างอิงที่แสดงบนหน้าจอแทน
 */
export type PromptPayType = 'PHONE' | 'NATIONAL_ID' | 'EWALLET';

export interface PromptPayTarget { type: PromptPayType; id: string }

const AID_CREDIT_TRANSFER = 'A000000677010111';

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) ครอบทั้ง payload รวม "6304" */
export function crc16ccitt(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc;
}

/** เหลือเฉพาะตัวเลข (ตัดช่องว่าง/ขีด) */
export const digitsOnly = (v: string) => (v || '').replace(/\D+/g, '');

/** ข้อความ error ถ้ารูปแบบไม่ถูกต้อง ไม่มีปัญหา = null */
export function validatePromptPayId(type: PromptPayType, rawId: string): string | null {
  const id = digitsOnly(rawId);
  if (type === 'PHONE') return /^0\d{9}$/.test(id) ? null : 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลักและขึ้นต้นด้วย 0';
  if (type === 'NATIONAL_ID') return /^\d{13}$/.test(id) ? null : 'เลขบัตรประชาชน/เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก';
  if (type === 'EWALLET') return /^\d{15}$/.test(id) ? null : 'e-Wallet ID ต้องเป็นตัวเลข 15 หลัก';
  return 'ประเภทพร้อมเพย์ไม่ถูกต้อง';
}

/** จำนวนเงินที่ใส่ใน QR ได้: > 0 และไม่เกิน 2 ตำแหน่งทศนิยม */
export function isValidQrAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount < 1e9
    && Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
}

export function buildPromptPayPayload(target: PromptPayTarget, amount?: number | null): string {
  const err = validatePromptPayId(target.type, target.id);
  if (err) throw new Error(err);
  const id = digitsOnly(target.id);

  let sub: string;
  if (target.type === 'PHONE') sub = tlv('01', '0066' + id.slice(1)); // 0066 + เบอร์ตัดเลข 0 หน้า = 13 หลัก
  else if (target.type === 'NATIONAL_ID') sub = tlv('02', id);
  else sub = tlv('03', id);

  const withAmount = amount != null;
  if (withAmount && !isValidQrAmount(amount)) throw new Error('จำนวนเงินไม่ถูกต้อง');

  const body =
    tlv('00', '01') +
    tlv('01', withAmount ? '12' : '11') + // 11 = static, 12 = dynamic (มียอดเงิน)
    tlv('29', tlv('00', AID_CREDIT_TRANSFER) + sub) +
    tlv('53', '764') + // THB
    (withAmount ? tlv('54', (amount as number).toFixed(2)) : '') +
    tlv('58', 'TH') +
    '6304';
  return body + crc16ccitt(body).toString(16).toUpperCase().padStart(4, '0');
}
