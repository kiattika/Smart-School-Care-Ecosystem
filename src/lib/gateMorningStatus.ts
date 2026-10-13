import type { GateAttendanceRecord, Student } from '../types';

export type MorningStatus = Student['attendance']['morningStatus'];

/** สถานะเช้าจากการเช็คอินเข้าโรงเรียน (ENTRY) ของวันนี้ — ON_TIME/NORMAL = มา, LATE = สาย */
export interface GateMorning {
  status: 'PRESENT' | 'LATE';
  time: string | null;
  method: 'SCAN' | 'GEOFENCE';
}

/**
 * เลือก ENTRY ล่าสุดต่อนักเรียนจาก gate_attendance_logs ของวันนี้ (คีย์ = studentId)
 * log ที่เวลาเข้าเร็วสุดคือเวลาเข้าจริง จึงเลือกอันที่ timestamp น้อยสุด ("HH:MM น." เรียงตามตัวอักษรได้)
 */
export function gateMorningByStudent(logs: GateAttendanceRecord[], today: string): Map<string, GateMorning> {
  const earliest = new Map<string, GateAttendanceRecord>();
  for (const l of logs) {
    if (l.type !== 'ENTRY' || l.date !== today || !l.studentId) continue;
    const prev = earliest.get(l.studentId);
    if (!prev || (l.timestamp || '') < (prev.timestamp || '')) earliest.set(l.studentId, l);
  }
  const out = new Map<string, GateMorning>();
  earliest.forEach((l, id) => {
    out.set(id, {
      status: l.status === 'LATE' ? 'LATE' : 'PRESENT',
      time: l.timestamp || null,
      method: l.method === 'GPS_GEOFENCE' ? 'GEOFENCE' : 'SCAN',
    });
  });
  return out;
}

/**
 * ลำดับสถานะเช้าในหน้าเช็คชื่อโฮมรูม:
 * 1) ที่ครูเพิ่งเลือกบนหน้าจอ (override)
 * 2) ที่ครูบันทึกและล็อกแล้ว (ครูยืนยันเอง)
 * 3) ผลเช็คอินผ่านประตูวันนี้ (สาย = สาย)
 * 4) ที่บันทึกไว้แต่ยังไม่ล็อก  5) ค่าใน student doc
 */
export function resolveMorningStatus(p: {
  override?: MorningStatus;
  hrStatus?: MorningStatus;
  hrLocked: boolean;
  gate?: GateMorning;
  docStatus: MorningStatus;
}): MorningStatus {
  if (p.override) return p.override;
  if (p.hrLocked && p.hrStatus) return p.hrStatus;
  if (p.gate) return p.gate.status;
  return p.hrStatus ?? p.docStatus;
}

/** เวลาที่แสดงในแผงพิกัด GPS — timestamp เก็บเป็น "HH:MM น." (ไม่ใช่ ISO) จึงห้าม new Date() ตรง ๆ */
export function formatCheckInClock(ts: string | undefined | null): string {
  if (!ts) return '-';
  if (/^\d{1,2}:\d{2}/.test(ts)) return ts;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
}
