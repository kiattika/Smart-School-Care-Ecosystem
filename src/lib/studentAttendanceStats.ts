/**
 * สถิติการเข้าเรียนต่อนักเรียน (ขาด/ลา/มาสาย/รวมเวลาเรียน) — ตรรกะบริสุทธิ์ (แยกออกมาให้ test ได้)
 *
 * ที่มาของข้อมูล: attendance_records จริง (ดู useStudentAttendanceStats.ts) — นับจาก "จำนวนครั้งที่
 * มีการเช็คชื่อจริง" ของนักเรียนคนนั้น (ทุก doc ที่ students[studentId] มีค่า ไม่ว่าจะเป็นคาบโฮมรูม
 * ตอนเช้า (HOMEROOM_DEFAULT) หรือคาบที่ครูผู้สอนเช็ค/แก้เอง (PERIOD_OVERRIDE)) — ไม่ใช่การ fabricate
 * "จำนวนคาบทั้งหมดตามหลักสูตร" ซึ่งต้องอ้างอิง schedules เพิ่มเติม (ยังไม่ได้ทำในรอบนี้ — ดู README
 * ของฟังก์ชันนี้ในรายงานผล)
 *
 * นิยามอัตราการเข้าเรียน: "ลา" (LEAVE) ไม่นับทั้งตัวตั้งและตัวหาร (ลาอนุมัติแล้วไม่ควรมีผลกับอัตรา
 * เข้าเรียน) — attendanceRate = (PRESENT + LATE) / (PRESENT + LATE + ABSENT) × 100
 * นี่คือ "ค่าเริ่มต้นที่สมเหตุสมผล" ตามที่ผู้ใช้อนุญาตให้ตั้งเองถ้าไม่มีเอกสารระบุไว้ — ยังไม่ได้
 * ยืนยันจากทางโรงเรียน รอการยืนยัน/ปรับภายหลัง
 */

import { format } from 'date-fns';

export type AttendanceStatusValue = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';

/** ค่าเริ่มต้น (ยังไม่ยืนยันจากโรงเรียน) — ต่ำกว่านี้ถือว่าน่าเป็นห่วง ต้องติดตาม/แจ้งเตือน */
export const DEFAULT_ATTENDANCE_THRESHOLD_PERCENT = 80;

export interface AttendanceRecordLite {
  date: string; // YYYY-MM-DD
  students: Record<string, AttendanceStatusValue>;
}

export interface StudentAttendanceStats {
  studentId: string;
  present: number;
  absent: number;
  late: number;
  leave: number;
  /** present + late + absent (ตัวหารของ attendanceRate — ไม่รวม leave) */
  countedSessions: number;
  /** present + late + absent + leave (จำนวนครั้งที่มีการเช็คชื่อจริงทั้งหมด รวม leave) */
  totalRecorded: number;
  /** เปอร์เซ็นต์ 0-100 — null ถ้ายังไม่มีข้อมูลเช็คชื่อเลยในช่วงที่เลือก (countedSessions === 0) */
  attendanceRate: number | null;
  isBelowThreshold: boolean;
  threshold: number;
}

/**
 * คำนวณ rate/ธงเตือนจากยอดรวม present/absent/late/leave ที่นับมาแล้ว — ใช้ร่วมกันทั้ง
 * computeStudentAttendanceStats (นับจาก records สด) และ attendanceStatsFromCounts (นับจาก
 * derived cache ที่ students/{id}.attendanceStats)
 */
function buildStatsFromCounts(
  studentId: string,
  present: number,
  absent: number,
  late: number,
  leave: number,
  threshold: number,
): StudentAttendanceStats {
  const countedSessions = present + late + absent;
  const totalRecorded = countedSessions + leave;
  const attendanceRate = countedSessions > 0
    ? Math.round(((present + late) / countedSessions) * 1000) / 10 // ทศนิยม 1 ตำแหน่ง
    : null;

  return {
    studentId,
    present,
    absent,
    late,
    leave,
    countedSessions,
    totalRecorded,
    attendanceRate,
    isBelowThreshold: attendanceRate !== null && attendanceRate < threshold,
    threshold,
  };
}

/**
 * สรุปสถิติของนักเรียนคนเดียวจาก attendance_records ที่ query มาแล้ว (ช่วงวันที่ + ห้องที่ต้องการ)
 * รับ records ที่ผ่านการกรองห้อง/ช่วงวันที่มาแล้ว (ดู useRoomAttendanceRecords) — ฟังก์ชันนี้แค่ดึง
 * สถานะของ studentId คนเดียวออกมานับ ไม่ query อะไรเพิ่ม — ใช้โดยครู/ครูที่ปรึกษา (เลือกช่วงวันที่ได้)
 */
export function computeStudentAttendanceStats(
  records: AttendanceRecordLite[],
  studentId: string,
  threshold: number = DEFAULT_ATTENDANCE_THRESHOLD_PERCENT,
): StudentAttendanceStats {
  let present = 0, absent = 0, late = 0, leave = 0;

  for (const rec of records) {
    const status = rec.students?.[studentId];
    if (!status) continue; // ไม่มีข้อมูลของนักเรียนคนนี้ใน record นี้ (เช่น เพิ่งย้ายเข้าห้องทีหลัง)
    if (status === 'PRESENT') present++;
    else if (status === 'ABSENT') absent++;
    else if (status === 'LATE') late++;
    else if (status === 'LEAVE') leave++;
  }

  return buildStatsFromCounts(studentId, present, absent, late, leave, threshold);
}

/**
 * สรุปสถิติจากยอดสะสม (all-time) ที่ students/{id}.attendanceStats — ใช้โดยผู้ปกครอง/นักเรียน
 * ซึ่งไม่มีสิทธิ์ query attendance_records ทั้งห้องตาม firestore.rules (ดู
 * writeAttendanceRecordWithStatsSync ใน firestoreService.ts สำหรับที่มาของ derived cache นี้)
 * — ไม่มีตัวเลือกช่วงวันที่ (เป็นยอดสะสมทั้งหมดเสมอ) ต่างจาก computeStudentAttendanceStats
 */
export function attendanceStatsFromCounts(
  studentId: string,
  counts: { present?: number; absent?: number; late?: number; leave?: number } | undefined,
  threshold: number = DEFAULT_ATTENDANCE_THRESHOLD_PERCENT,
): StudentAttendanceStats {
  return buildStatsFromCounts(
    studentId,
    counts?.present || 0,
    counts?.absent || 0,
    counts?.late || 0,
    counts?.leave || 0,
    threshold,
  );
}

/** ช่วงวันที่เริ่มต้น (ยังไม่ยืนยันจากโรงเรียน) — ย้อนหลัง N วันจากวันนี้ ครอบคลุมถึงวันนี้ */
export function defaultAttendanceDateRange(days: number = 30, today: Date = new Date()): { start: string; end: string } {
  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  // .toISOString() แปลงเป็น UTC เสมอ — ช่วงเที่ยงคืน-ตี 6 กว่าๆ ตามเวลาไทย (UTC+7) จะลากวันถอยหลัง
  // ไป 1 วัน ใช้ format() จาก date-fns แทน (คำนวณจาก local time fields ตรงๆ)
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  return { start: fmt(start), end: fmt(end) };
}

export interface AttendanceStatusDelta {
  studentId: string;
  oldStatus?: AttendanceStatusValue;
  newStatus?: AttendanceStatusValue;
}

/**
 * เทียบ map สถานะ "เดิม" (จาก attendance_records doc ที่มีอยู่ก่อน) กับ "ใหม่" (ที่กำลังจะบันทึก)
 * คืนเฉพาะนักเรียนที่สถานะเปลี่ยนจริง — ใช้ก่อน apply increment() บน students/{id}.attendanceStats
 * ใน writeAttendanceRecordWithStatsSync (ดู firestoreService.ts) กันการนับซ้ำ/ตกหล่นเวลาแก้ไข
 * attendance ย้อนหลังหรือครูเปลี่ยนสถานะนักเรียนคนเดิมซ้ำในคาบเดิม
 *
 * ⚠️ สมมติฐาน: ผู้เรียก (TakeAttendanceModal / useHomeroomAttendance) ส่ง `newStudents` เป็นแผนที่
 * สถานะของนักเรียน "ทุกคน" ในคาบนั้นเสมอ ไม่ใช่ patch บางส่วน — ตรงกับวิธีใช้งานจริงในแอปทั้งหมด
 * (ถ้าส่งมาบางส่วน ผลลัพธ์ diff จะไม่ครบเพราะไม่รู้ว่านักเรียนที่ขาดหายไปตั้งใจลบหรือแค่ไม่ส่งมา)
 */
export function diffAttendanceStatuses(
  oldStudents: Record<string, AttendanceStatusValue>,
  newStudents: Record<string, AttendanceStatusValue>,
): AttendanceStatusDelta[] {
  const affectedStudentIds = new Set([...Object.keys(oldStudents), ...Object.keys(newStudents)]);
  const deltas: AttendanceStatusDelta[] = [];
  for (const studentId of affectedStudentIds) {
    const oldStatus = oldStudents[studentId];
    const newStatus = newStudents[studentId];
    if (oldStatus === newStatus) continue; // ไม่เปลี่ยน ไม่ต้อง touch counter
    deltas.push({ studentId, oldStatus, newStatus });
  }
  return deltas;
}

/**
 * สร้างรูปแบบ string ห้องที่เป็นไปได้ สำหรับ query Firestore แบบ `where('room', 'in', [...])`
 * (ห้ามใช้ === ตรงๆ เทียบห้อง — ข้อมูลเก่าปนกันระหว่างฟอร์แมต "ม.5/8" / "M.5/8" / "5/8" ดู
 * isSameRoom() ใน lib/utils.ts ซึ่งใช้เปรียบเทียบแบบ in-memory ได้ แต่ Firestore query ต้องรู้
 * ค่าที่เป็นไปได้ล่วงหน้าเพราะ query ฝั่งเซิร์ฟเวอร์ทำ fuzzy match ไม่ได้)
 */
export function roomQueryCandidates(room: string): string[] {
  const trimmed = (room || '').trim();
  if (!trimmed) return [];
  const match = trimmed.match(/(\d+)\s*\/\s*(\d+)/);
  const bare = match ? `${match[1]}/${match[2]}` : trimmed;
  return Array.from(new Set([trimmed, `ม.${bare}`, `M.${bare}`, bare].filter(Boolean)));
}
