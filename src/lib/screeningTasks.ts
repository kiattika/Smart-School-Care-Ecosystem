/**
 * งานค้างจากการคัดกรองสุขภาพจิต (2Q → 9Q) สำหรับกระดิ่งของครูแนะแนว/ครูที่ปรึกษา — ตรรกะล้วน ไม่แตะ Firestore
 * ให้กระดิ่งแสดง "จำนวน" เท่านั้น (ไม่ระบุชื่อ/ผล) เพราะเป็นข้อมูลอ่อนไหว; รายละเอียดดูในหน้าคัดกรองซึ่งมีสิทธิ์ตามบทบาท
 *
 * นิยาม "จัดการแล้ว" (ผู้ใช้ยืนยัน):
 *  - 2Q บวก → หายเมื่อนักเรียนส่งผล 9Q แล้ว (9Q ที่ทำวันเดียวกันหรือหลัง 2Q ฉบับนั้น หรือฐาน 9Q ใช้ 2Q ฉบับนั้นแล้ว)
 *  - 9Q ธงแดง (ข้อ 9 > 0) → หายเมื่อบันทึกว่า "แจ้งผู้ปกครองแล้ว" หรือ "พบนักเรียนแล้ว" ผูกกับผล 9Q ฉบับนั้น
 */
export interface ScreeningTaskRecord {
  twoQ?: { id: string; isPositive: boolean; conductedAt?: string } | null;
  nineSummary?: { id: string; redFlagItem9: boolean; conductedAt?: string } | null;
  progress?: { usedBasisIds?: string[] } | null;
}

/** screeningId ของผล 9Q ที่จัดการแล้ว (แจ้งผู้ปกครอง 9Q หรือพบนักเรียน) */
export type HandledNineQIds = ReadonlySet<string>;

const day = (s?: string) => (s || '').slice(0, 10);

export function isOpenTwoQ(r: ScreeningTaskRecord): boolean {
  const twoQ = r.twoQ;
  if (!twoQ || twoQ.isPositive !== true) return false;
  if (r.progress?.usedBasisIds?.includes(twoQ.id)) return false;
  const nine = r.nineSummary;
  if (nine && day(nine.conductedAt) && day(twoQ.conductedAt) && day(nine.conductedAt) >= day(twoQ.conductedAt)) return false;
  return true;
}

export function isOpenRedFlag(r: ScreeningTaskRecord, handled: HandledNineQIds): boolean {
  const nine = r.nineSummary;
  return !!nine && nine.redFlagItem9 === true && !handled.has(nine.id);
}

/** ธงแดงที่ยังไม่จัดการ — ใช้หาว่าต้องไปอ่านบันทึกแจ้งผู้ปกครอง/พบนักเรียนของใครบ้าง */
export function redFlagStudentIds(records: ReadonlyMap<string, ScreeningTaskRecord>): string[] {
  return [...records.entries()].filter(([, r]) => r.nineSummary?.redFlagItem9 === true).map(([sid]) => sid);
}

export function countScreeningTasks(
  records: ReadonlyMap<string, ScreeningTaskRecord>,
  handledBySid: ReadonlyMap<string, HandledNineQIds>,
): { twoQ: number; redFlag: number } {
  let twoQ = 0;
  let redFlag = 0;
  records.forEach((r, sid) => {
    if (isOpenTwoQ(r)) twoQ++;
    if (isOpenRedFlag(r, handledBySid.get(sid) ?? new Set())) redFlag++;
  });
  return { twoQ, redFlag };
}
