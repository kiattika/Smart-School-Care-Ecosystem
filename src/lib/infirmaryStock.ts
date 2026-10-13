/**
 * คลังยา/เวชภัณฑ์ห้องพยาบาล — ตรรกะบริสุทธิ์ (ต้องตรงกับ firestore.rules: infirmary_medicines / infirmary_stock_movements)
 *
 * ทุกการเปลี่ยนจำนวนคงเหลือต้องมี "รายการเคลื่อนไหว" (movement) คู่กันใน batch/transaction เดียวกัน (append-only):
 *   RESTOCK (รับเข้า, delta > 0) · DISPENSE (จ่ายยาให้นักเรียน, delta < 0) · DISCARD (ทิ้ง/หมดอายุ, delta < 0)
 *   ADJUST (ปรับยอดตามการนับจริง, delta ≠ 0) · INITIAL (ยอดตั้งต้นตอนเพิ่มรายการ, delta > 0)
 * ยอดคงเหลือห้ามติดลบ
 */
export type StockMovementType = 'INITIAL' | 'RESTOCK' | 'DISPENSE' | 'DISCARD' | 'ADJUST';

export const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  INITIAL: 'ยอดตั้งต้น',
  RESTOCK: 'รับเข้า',
  DISPENSE: 'จ่ายยา',
  DISCARD: 'ทิ้ง/หมดอายุ',
  ADJUST: 'ปรับยอด',
};

export interface MedicineLike {
  stock: number;
  minAlert: number;
  active?: boolean;
}

export const isLowStock = (m: MedicineLike): boolean => m.active !== false && m.stock <= m.minAlert;

export const isPositiveInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

/** delta ที่อนุญาตของแต่ละชนิด */
export function deltaAllowed(type: StockMovementType, delta: number): boolean {
  if (!Number.isInteger(delta) || delta === 0) return false;
  switch (type) {
    case 'INITIAL':
    case 'RESTOCK':
      return delta > 0;
    case 'DISPENSE':
    case 'DISCARD':
      return delta < 0;
    case 'ADJUST':
      return true;
  }
}

export type StockChangeResult =
  | { ok: true; balanceAfter: number }
  | { ok: false; error: 'INVALID_DELTA' | 'INSUFFICIENT_STOCK' };

export function applyStockChange(current: number, type: StockMovementType, delta: number): StockChangeResult {
  if (!deltaAllowed(type, delta)) return { ok: false, error: 'INVALID_DELTA' };
  const next = current + delta;
  if (next < 0) return { ok: false, error: 'INSUFFICIENT_STOCK' };
  return { ok: true, balanceAfter: next };
}

export interface DispenseLine { medicineId: string; name: string; unit: string; qty: number }

/** ข้อความ "ยาที่จ่าย" สำหรับบันทึกเคส (medicationGiven) จากรายการเบิกจากคลัง + ข้อความอิสระ */
export function composeMedicationGiven(lines: DispenseLine[], freeText: string): string {
  const parts = lines.filter(l => l.qty > 0).map(l => `${l.name} ${l.qty} ${l.unit}`);
  const extra = (freeText || '').trim();
  if (extra) parts.push(extra);
  return parts.join(', ');
}

/** ตรวจรายการเบิกก่อนส่ง — คืนข้อความ error ภาษาไทย หรือ null ถ้าผ่าน */
export function validateDispenseLines(lines: DispenseLine[], stockById: Record<string, number>): string | null {
  const seen = new Set<string>();
  for (const l of lines) {
    if (!isPositiveInt(l.qty)) return `จำนวนของ "${l.name}" ต้องเป็นจำนวนเต็มมากกว่า 0`;
    if (seen.has(l.medicineId)) return `เลือก "${l.name}" ซ้ำ`;
    seen.add(l.medicineId);
    const have = stockById[l.medicineId];
    if (typeof have !== 'number') return `ไม่พบ "${l.name}" ในคลัง`;
    if (l.qty > have) return `"${l.name}" คงเหลือ ${have} ${l.unit} ไม่พอจ่าย ${l.qty}`;
  }
  return null;
}
