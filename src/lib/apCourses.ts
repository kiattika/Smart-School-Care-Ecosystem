/**
 * วิชา AP (ฟิสิกส์ AP / เคมี AP / ชีววิทยา AP / คณิตศาสตร์ AP) — นักเรียนหลายห้อง (เช่น ม.6/1, ม.6/2)
 * เรียนคาบเดียวกัน ห้องกายภาพเดียวกัน แล้วแยกกลุ่มไปตามวิชาที่ตนเลือก
 *
 * - ตารางสอนเก็บ `levels` (ทุกห้องที่รวมกัน) ที่ schedule doc ไม่ให้ห้องใดห้องหนึ่งทับอีกห้อง
 * - ครูผู้สอนคัดรายชื่อเอง (ถอนคนที่ไม่ได้เลือกวิชานี้ออก) แล้ว "ยืนยันรายชื่อ" ที่ `ap_rosters`
 *   ยังไม่ยืนยัน = แสดงนักเรียนทุกห้องที่รวมกัน (ไม่เดาแทนครู)
 * - ตรวจนักเรียนตกหล่น: อยู่ในห้องที่รวมกันในคาบ AP แต่ยังไม่อยู่ในรายชื่อ AP ของครูคนใดเลย
 */
import { isSameRoom } from './utils';

/** รหัส AP ต้องเป็นคำ "AP" ตัวพิมพ์ใหญ่ที่ไม่ติดตัวอักษรละติน (กันชื่อ Apply/Happy) */
export function isApCourse(name: string | undefined | null): boolean {
  return /(?<![A-Za-z])AP(?![A-Za-z])/.test(String(name || ''));
}

/** ห้อง/ชั้นที่รวมกันในคาบนี้ — `levels` (ใหม่) มาก่อน ไม่มี = ชั้นเดี่ยวตามเดิม */
export function levelsOfSchedule(sch: { levels?: unknown; level?: unknown }): string[] {
  const raw = Array.isArray(sch.levels) ? sch.levels : [];
  const out: string[] = [];
  for (const v of [...raw, sch.level]) {
    const s = String(v ?? '').trim();
    if (s && !out.some(o => isSameRoom(o, s))) out.push(s);
  }
  return out;
}

const safeCode = (code: string) => String(code || 'X').replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '_').slice(0, 40);

/** courseKey ของรายชื่อ AP = รหัสวิชา (ใช้ร่วมทุกคาบของวิชานั้นที่ครูคนเดียวกันสอน) */
export function apCourseKey(code: string): string { return safeCode(code); }

/** doc id = `{semesterId}_{courseKey}_{ownerStaffId}` (rules บังคับรูปแบบนี้) */
export function apRosterDocId(semesterId: string, code: string, ownerStaffId: string): string {
  return `${semesterId}_${apCourseKey(code)}_${ownerStaffId}`;
}

export interface ApRosterDoc {
  id?: string;
  semesterId: string;
  courseKey: string;
  courseName: string;
  ownerStaffId: string;
  levels: string[];
  studentIds: string[];
  confirmed?: boolean;
}

interface StudentLike { studentId: string; room?: string; className?: string; }

/** นักเรียนที่เป็นไปได้ = อยู่ในห้อง/ชั้นใดชั้นหนึ่งที่รวมกัน */
export function apCandidates<T extends StudentLike>(students: T[], levels: string[]): T[] {
  if (levels.length === 0) return [];
  return students.filter(s => levels.some(l => isSameRoom(s.room, l) || isSameRoom(s.className, l)));
}

/** รายชื่อที่ใช้จริงในคาบ: ครูยืนยันแล้ว = เฉพาะที่เลือก, ยังไม่ยืนยัน = ผู้สมัครทั้งหมด */
export function resolveApRoster<T extends StudentLike>(candidates: T[], roster: ApRosterDoc | null | undefined): T[] {
  if (!roster) return candidates;
  const ids = new Set(roster.studentIds);
  return candidates.filter(s => ids.has(s.studentId));
}

export interface ApScheduleLike {
  id: string; subjectCode?: string; courseCode?: string; subjectName?: string; courseName?: string;
  dayOfWeek?: string; periodNumber?: number | string; level?: string; levels?: string[];
  teacherIds?: string[]; teacherId?: string | null;
}

const teacherIdsOf = (s: ApScheduleLike): string[] =>
  Array.isArray(s.teacherIds) && s.teacherIds.length ? s.teacherIds : (s.teacherId ? [s.teacherId] : []);
const codeOf = (s: ApScheduleLike) => String(s.subjectCode || s.courseCode || '');
const slotOf = (s: ApScheduleLike) => `${String(s.dayOfWeek || '').toLowerCase()}|${String(s.periodNumber ?? '')}`;

/** schedule 2 แถวคาบเดียวกัน วิชาเดียวกัน ครูร่วมกัน = ห้องที่รวมกันของวิชานั้น (กรณีไฟล์ไม่มีห้องกายภาพ จึงแยก doc ตามชั้น) */
function sameCourseSameTeacher(a: ApScheduleLike, b: ApScheduleLike): boolean {
  return codeOf(a) === codeOf(b) && slotOf(a) === slotOf(b) && teacherIdsOf(a).some(t => teacherIdsOf(b).includes(t));
}

/** ทุกชั้นที่เรียนรวมกันในคาบของ schedule นี้ (รวม doc พี่น้องที่แยกตามชั้น) */
export function apLevelsForSchedule(sch: ApScheduleLike, all: ApScheduleLike[]): string[] {
  const out = levelsOfSchedule(sch);
  for (const o of all) {
    if (o.id === sch.id || !sameCourseSameTeacher(o, sch)) continue;
    for (const l of levelsOfSchedule(o)) if (!out.some(x => isSameRoom(x, l))) out.push(l);
  }
  return out;
}

export interface ApGroupReport {
  key: string;
  day: string;
  period: string;
  levels: string[];
  courses: Array<{ code: string; name: string; teacherIds: string[]; confirmed: boolean; count: number }>;
  poolCount: number;
  /** มีอย่างน้อย 1 วิชาที่ครูยืนยันรายชื่อแล้ว — ถึงจะนับนักเรียนตกหล่นได้ */
  hasConfirmedRoster: boolean;
  unconfirmedCourses: string[];
  fallThrough: Array<{ studentId: string; room: string }>;
  duplicates: Array<{ studentId: string; courses: string[] }>;
}

/**
 * รายงานนักเรียนตกหล่น/ซ้ำของคาบ AP — จัดกลุ่ม schedule ที่คาบเดียวกันและมีชั้นซ้อนกัน
 * (ห้องที่ไม่ซ้อนกันคนละกลุ่ม) แล้วเทียบกับ `ap_rosters` ที่ครูยืนยัน
 * ⚠️ นักเรียนที่เรียนวิชาอื่น (ไม่ใช่ AP) ในคาบเดียวกันจะขึ้นเป็น "ตกหล่น" ด้วย — ผู้ใช้ต้องตรวจเอง
 */
export function computeApReport<T extends StudentLike>(
  schedules: ApScheduleLike[],
  rosters: ApRosterDoc[],
  students: T[],
): ApGroupReport[] {
  const ap = schedules.filter(s => isApCourse(s.subjectName || s.courseName));
  const slotMap = new Map<string, ApScheduleLike[]>();
  for (const s of ap) {
    const slot = `${String(s.dayOfWeek || '').toLowerCase()}|${String(s.periodNumber ?? '')}`;
    slotMap.set(slot, [...(slotMap.get(slot) || []), s]);
  }
  const reports: ApGroupReport[] = [];
  for (const [slot, list] of slotMap) {
    // รวมกลุ่มที่ชั้นซ้อนกัน (union-find แบบง่าย)
    const groups: Array<{ items: ApScheduleLike[]; levels: string[] }> = [];
    for (const s of list) {
      const lv = levelsOfSchedule(s);
      const hit = groups.filter(g => g.levels.some(a => lv.some(b => isSameRoom(a, b))) || g.items.some(o => sameCourseSameTeacher(o, s)));
      const merged = { items: [s], levels: [...lv] };
      for (const g of hit) {
        merged.items.push(...g.items);
        for (const l of g.levels) if (!merged.levels.some(m => isSameRoom(m, l))) merged.levels.push(l);
        groups.splice(groups.indexOf(g), 1);
      }
      groups.push(merged);
    }
    for (const g of groups) {
      const pool = apCandidates(students, g.levels);
      const courses = new Map<string, ApGroupReport['courses'][number]>();
      const membership = new Map<string, string[]>();
      for (const s of g.items) {
        const code = String(s.subjectCode || s.courseCode || '');
        const tids = Array.isArray(s.teacherIds) && s.teacherIds.length ? s.teacherIds : (s.teacherId ? [s.teacherId] : []);
        const r = rosters.find(x => x.courseKey === apCourseKey(code) && tids.includes(x.ownerStaffId));
        const name = String(s.subjectName || s.courseName || code);
        if (!courses.has(code)) courses.set(code, { code, name, teacherIds: tids, confirmed: !!r, count: r ? r.studentIds.length : 0 });
        if (r) for (const id of r.studentIds) membership.set(id, [...(membership.get(id) || []), name].filter((v, i, a) => a.indexOf(v) === i));
      }
      const cs = [...courses.values()];
      const hasConfirmed = cs.some(c => c.confirmed);
      const [day, period] = slot.split('|');
      reports.push({
        key: `${slot}|${g.levels.map(l => l.replace(/\s/g, '')).sort().join(',')}`,
        day, period, levels: g.levels, courses: cs, poolCount: pool.length,
        hasConfirmedRoster: hasConfirmed,
        unconfirmedCourses: cs.filter(c => !c.confirmed).map(c => c.name),
        fallThrough: hasConfirmed ? pool.filter(s => !membership.has(s.studentId)).map(s => ({ studentId: s.studentId, room: String(s.room || s.className || '') })) : [],
        duplicates: [...membership.entries()].filter(([, c]) => c.length > 1).map(([studentId, c]) => ({ studentId, courses: c })),
      });
    }
  }
  return reports.sort((a, b) => a.key.localeCompare(b.key));
}
