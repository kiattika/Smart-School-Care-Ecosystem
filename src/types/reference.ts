/**
 * ข้อมูลอ้างอิง (รายชื่อโรงเรียน/หมู่บ้าน) ที่แอดมินแก้ไขได้ — เก็บเฉพาะ "ส่วนที่ต่างจากข้อมูลชุดหลักที่ฝังในแอป"
 *   - เพิ่มใหม่:        docId `c_<เวลา>` (baseCode = null)
 *   - แก้/ซ่อนรายการหลัก: docId `b_<รหัสเดิม>` (baseCode = รหัสเดิม; disabled = true คือซ่อน)
 *   - คืนค่าเดิม/ลบรายการที่เพิ่มเอง = ลบเอกสาร
 */
export interface ReferenceMeta { id: string; disabled: boolean; baseCode: string | null; updatedAt: string; updatedBy: string }

export interface SchoolOverrideDoc extends ReferenceMeta {
  provinceCode: string;       // รหัสจังหวัด 2 หลัก
  name: string;               // ชื่อเต็ม เช่น "โรงเรียนบ้านตาโงะ"
  subdistrict: string; district: string;
  affiliation: string;        // สังกัด เช่น "สพป.อุตรดิตถ์ เขต 2"
  telephone: string;          // ตัวเลข 9-10 หลักขึ้นต้น 0 หรือว่าง
  classMax: string;           // ระดับสูงสุดที่เปิดสอน เช่น "ม.6" (ว่างได้)
}

export interface VillageOverrideDoc extends ReferenceMeta {
  provinceCode: string; amphoeCode: string;
  tambonCode: string;         // รหัสตำบล 6 หลัก
  moo: number | null;         // หมู่ที่ (null = ชุมชน/ไม่มีหมู่)
  name: string;
}

export type ReferenceKind = 'reference_schools' | 'reference_villages';
