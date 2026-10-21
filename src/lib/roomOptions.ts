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

/** ห้องจากตารางภาระงานสอนที่นำเข้า — schedule เก็บชั้น/ห้องเรียนไว้ที่ field `level` (`room` คือห้องกายภาพ) */
export function roomsFromSchedules(schedules: ReadonlyArray<{ level?: unknown }>): string[] {
  const set = new Set<string>();
  for (const s of schedules) {
    const v = typeof s.level === 'string' ? s.level.trim() : '';
    if (/\d+\s*\/\s*\d+/.test(v)) set.add(v);
  }
  return Array.from(set);
}

/**
 * ห้องประจำชั้นที่ผู้ดูแลพิมพ์/เลือกไว้ ตรงกับห้องที่รู้จัก (นักเรียน/ภาระงานสอนที่นำเข้า) หรือไม่ — ใช้ `isSameRoom`
 * ยังไม่มีข้อมูลห้องที่รู้จักเลย (known ว่าง) = ตัดสินไม่ได้ คืน true (ไม่เตือนมั่ว)
 */
export function isKnownHomeroom(room: string, known: readonly string[], same: (a?: string, b?: string) => boolean): boolean {
  const r = (room || '').trim();
  if (!r || known.length === 0) return true;
  return known.some(k => same(r, k));
}
