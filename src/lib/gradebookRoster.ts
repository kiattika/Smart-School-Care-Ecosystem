/** รายชื่อในสมุดบันทึกคะแนน: ป้ายระดับชั้น / เรียงตามระดับชั้น → เลขที่ / ตัวกรองระดับชั้น */
export interface RosterStudent { studentId?: string; id?: string; room?: string; className?: string; studentNumber?: number; studentNo?: number; number?: number }

/** "M.5/8" → "ม.5/8"; ไม่มีข้อมูลห้อง → '' (ไม่เดา) */
export function studentLevelLabel(s: RosterStudent): string {
  return (s.room || s.className || '').trim().replace(/^M\.\s*/i, 'ม.');
}

/** คีย์เรียง: [ชั้น, ห้อง] จาก "ม.5/8"; ไม่มีรูปแบบนี้ไปท้ายสุด (เรียงตามข้อความ) */
function levelKey(label: string): [number, number, string] {
  const m = label.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), label] : [Infinity, Infinity, label];
}

export function rosterNumber(s: RosterStudent): number {
  return s.studentNumber ?? s.studentNo ?? s.number ?? Number.POSITIVE_INFINITY;
}

/** ระดับชั้น (ชั้น/ห้อง ตัวเลขน้อยไปมาก) → เลขที่ → รหัสนักเรียน */
export function sortRoster<T extends RosterStudent>(list: T[]): T[] {
  return list.slice().sort((a, b) => {
    const [ag, ar, at] = levelKey(studentLevelLabel(a));
    const [bg, br, bt] = levelKey(studentLevelLabel(b));
    if (ag !== bg) return ag < bg ? -1 : 1;
    if (ar !== br) return ar < br ? -1 : 1;
    if (at !== bt) return at.localeCompare(bt, 'th');
    const an = rosterNumber(a), bn = rosterNumber(b);
    if (an !== bn) return an < bn ? -1 : 1;
    return String(a.studentId || a.id || '').localeCompare(String(b.studentId || b.id || ''));
  });
}

/** ระดับชั้นที่มีในรายชื่อ (ไม่ซ้ำ เรียงแล้ว) สำหรับตัวกรอง */
export function rosterLevels(list: RosterStudent[]): string[] {
  return Array.from(new Set(sortRoster(list).map(studentLevelLabel).filter(Boolean)));
}

export function filterRosterByLevel<T extends RosterStudent>(list: T[], level: string): T[] {
  return level ? list.filter(s => studentLevelLabel(s) === level) : list;
}
