/**
 * รูปแบบอีเมลมาตรฐานก่อนเขียนลง staff / teachers / students: ตัดอักขระล่องหน + trim + lowercase
 *
 * blocking functions (functions/src/access.ts) ค้น staff/students ด้วย `where('email', '==', <lowercase>)`
 * แบบตรงตัว — อีเมลที่มีตัวพิมพ์ใหญ่/ช่องว่าง/zero-width char (เคยเจอในไฟล์ Teacher Load Report)
 * จะหาไม่เจอแล้วผู้ใช้ถูกปฏิเสธการ login ทั้งที่อยู่ในทะเบียน
 *
 * ใช้ร่วมกับ scripts/normalizeEmails.ts (แก้ doc ที่มีอยู่แล้ว)
 */
export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // zero-width space/joiner/non-joiner, word joiner, BOM — trim() ไม่ตัดตัวเหล่านี้ (NBSP trim() ตัดให้แล้ว)
  return raw.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim().toLowerCase();
}

// ─── scripts/normalizeEmails.ts: วางแผนแก้ doc ที่มีอยู่แล้ว (pure — unit test ได้) ───

/** field อีเมลที่ต้องเป็นรูปแบบมาตรฐานในแต่ละ collection */
export const EMAIL_FIELDS: Record<'staff' | 'teachers' | 'students', string[]> = {
  staff: ['email'],
  teachers: ['email'],
  students: ['email', 'parentEmail'],
};

export interface EmailDocSnapshot {
  collection: string;
  id: string;
  fields: Record<string, unknown>;
}

export interface EmailFix {
  collection: string;
  id: string;
  field: string;
  before: string;
  after: string;
}

export interface EmailDuplicate {
  collection: string;
  email: string;
  ids: string[];
}

/**
 * fixes: field ที่ค่าปัจจุบันไม่ตรงรูปแบบมาตรฐาน (ข้ามค่าที่ไม่ใช่ string / ว่าง / ถูกอยู่แล้ว)
 * duplicates: doc ใน collection เดียวกันที่ `email` (หลัง normalize) ซ้ำกัน — blocking function จะปฏิเสธ
 *   (AMBIGUOUS_RECORD) ต้องให้ admin แก้เอง; ข้าม doc alias เก่าที่ใช้อีเมลเป็น doc id
 *   (parentEmail ซ้ำได้ตามปกติ — พี่น้องผู้ปกครองคนเดียวกัน)
 */
export function planEmailFixes(docs: EmailDocSnapshot[]): { fixes: EmailFix[]; duplicates: EmailDuplicate[] } {
  const fixes: EmailFix[] = [];
  const byEmail = new Map<string, EmailDocSnapshot[]>();

  for (const d of docs) {
    const fields = EMAIL_FIELDS[d.collection as keyof typeof EMAIL_FIELDS] ?? [];
    for (const field of fields) {
      const before = d.fields[field];
      if (typeof before !== 'string' || before === '') continue;
      const after = normalizeEmail(before);
      if (after !== before) fixes.push({ collection: d.collection, id: d.id, field, before, after });
      if (field === 'email' && after && d.id.toLowerCase() !== after) {
        const key = `${d.collection}\u0000${after}`;
        byEmail.set(key, [...(byEmail.get(key) ?? []), d]);
      }
    }
  }

  const duplicates: EmailDuplicate[] = [];
  for (const [key, group] of byEmail) {
    if (group.length < 2) continue;
    const [collection, email] = key.split('\u0000');
    duplicates.push({ collection, email, ids: group.map((g) => g.id).sort() });
  }
  return { fixes, duplicates };
}
