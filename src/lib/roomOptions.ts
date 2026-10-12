import type { Student } from '../types';

/**
 * ตัวเลือกห้องเรียนสำหรับ dropdown — มาจากห้องที่มีนักเรียนอยู่จริงในระบบเท่านั้น
 * (ห้ามฝังรายชื่อห้องไว้ในโค้ด; โรงเรียนอื่น/ปีถัดไปมีห้องต่างกัน) เรียงตามระดับชั้นแล้วเลขห้อง
 * `keep` = ค่าที่เลือกไว้อยู่แล้ว (เช่น ห้องเดิมของครูที่เคยตั้งไว้) แสดงต่อได้แม้ไม่มีนักเรียนในห้องนั้นแล้ว
 */
export function roomOptionsFromStudents(
  students: Pick<Student, 'room'>[] & { className?: string }[] | Array<{ room?: string; className?: string }>,
  keep: string[] = [],
): string[] {
  const set = new Set<string>();
  for (const s of students) {
    for (const r of [s.room, (s as { className?: string }).className]) {
      const v = (r ?? '').trim();
      if (v) set.add(v);
    }
  }
  for (const k of keep) if (k && k.trim()) set.add(k.trim());
  const key = (r: string) => {
    const m = r.match(/(\d+)\s*\/\s*(\d+)/);
    return m ? [Number(m[1]), Number(m[2])] : [Infinity, 0];
  };
  return Array.from(set).sort((a, b) => {
    const [ga, ra] = key(a);
    const [gb, rb] = key(b);
    return ga - gb || ra - rb || a.localeCompare(b, 'th');
  });
}
