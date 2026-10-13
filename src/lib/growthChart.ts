/**
 * จัดรูปข้อมูลน้ำหนัก/ส่วนสูง/BMI รายภาคเรียนให้เป็นจุดสำหรับกราฟพัฒนาการ (ฟังก์ชันล้วน ทดสอบได้)
 * ไม่สร้างข้อมูลเอง — ใช้เฉพาะ log จริง เรียงตามปีการศึกษา/ภาคเรียน และข้ามค่าที่ไม่ใช่ตัวเลขจำกัด
 */
export const BMI_HEALTHY_MIN = 18.5;
export const BMI_HEALTHY_MAX = 22.9;

export interface GrowthPoint {
  key: string;
  label: string; // "1/2569"
  height: number;
  weight: number;
  bmi: number;
}

interface LogLike {
  id?: string;
  semester?: string;
  academicYear?: string;
  term?: string;
  height?: number;
  weight?: number;
  bmi?: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function buildGrowthPoints(logs: LogLike[]): GrowthPoint[] {
  return logs
    .filter((l) => isNum(l.height) && isNum(l.weight) && isNum(l.bmi))
    .map((l) => ({
      key: l.id || `${l.academicYear}_${l.term}`,
      label: l.semester || `${l.term}/${l.academicYear}`,
      sortKey: `${l.academicYear ?? ''}${l.term ?? ''}`,
      height: l.height as number,
      weight: l.weight as number,
      bmi: l.bmi as number,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ sortKey, ...p }) => p);
}

/** ช่วงแกน y ที่เว้นขอบเล็กน้อย; รวมค่าอ้างอิง (เช่น แถบ BMI ปกติ) ถ้ามี */
export function paddedDomain(values: number[], include: number[] = []): [number, number] {
  const all = [...values, ...include];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = Math.max(max - min, 1);
  const pad = span * 0.15;
  return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
}
