import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ParsedScheduleSegment {
  day: number; // 1 = จ, 2 = อ, 3 = พ, 4 = ฤ / พฤ, 5 = ศ, 6 = ส, 0 = อา
  periodIndex: number;
}

export function parseThaiSchedule(scheduleStr?: string): ParsedScheduleSegment[] {
  if (!scheduleStr) return [];

  // Split by comma, semicolon, or whitespace delimiter (e.g., "อ2, พ4, ฤ1, ศ3" or "จ1, พ8, ฤ2, ศ2")
  const segments = scheduleStr.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  const result: ParsedScheduleSegment[] = [];

  const dayMap: Record<string, number> = {
    'จ': 1,
    'จันทร์': 1,
    'อ': 2,
    'อัง': 2,
    'อังคาร': 2,
    'พ': 3,
    'พุ': 3,
    'พุธ': 3,
    'พฤ': 4,
    'ฤ': 4,
    'พฤหัส': 4,
    'พฤหัสบดี': 4,
    'ศ': 5,
    'ศุกร์': 5,
    'ส': 6,
    'เสาร์': 6,
    'อา': 0,
    'อาทิตย์': 0
  };

  segments.forEach(segment => {
    // Matches Thai day prefix and period range (e.g., "พ4", "พ8", "พ0", "จ6-7", "อ3-4", "ฤ1", "ศ3")
    const match = segment.match(/^([^\d]+)([\d\-]+)$/);
    if (!match) return;

    const dayStr = match[1].trim();
    const periodsStr = match[2].trim();
    const targetDay = dayMap[dayStr] !== undefined ? dayMap[dayStr] : 1;

    const periods: number[] = [];
    if (periodsStr.includes('-')) {
      const [start, end] = periodsStr.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          periods.push(i);
        }
      }
    } else {
      const p = Number(periodsStr);
      if (!isNaN(p)) {
        periods.push(p);
      }
    }

    periods.forEach(p => {
      if (!result.some(r => r.day === targetDay && r.periodIndex === p)) {
        result.push({ day: targetDay, periodIndex: p });
      }
    });
  });

  return result;
}

export function isSameRoom(r1?: string, r2?: string): boolean {
  if (!r1 || !r2) return false;
  
  const normalize = (r: string) => {
    let str = r.trim().toLowerCase();
    // Remove common prefixes like 'hr_', 'hr', 'homeroom', 'ห้อง', 'ชั้น', bracket notes like '[943]'
    str = str.replace(/\[.*?\]/g, '').trim();
    str = str.replace(/^(hr_|hr\s*|homeroom\s*|ห้อง\s*|ชั้น\s*)/i, '').trim();
    
    // Extract Grade/Room pattern e.g. "5/8", "5 / 8", "ม.5/8", "M.5/8"
    const match = str.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
    
    // Fallback normalization
    return str.replace(/^[mม]\.?\s*/i, '').replace(/[^a-z0-9]/g, '');
  };

  const n1 = normalize(r1);
  const n2 = normalize(r2);
  
  if (n1 && n2 && n1 === n2) return true;
  return false;
}

export function formatRoomName(room?: string): string {
  if (!room) return 'ม.5/8';
  const match = room.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    return `ม.${match[1]}/${match[2]}`;
  }
  if (room.startsWith('ม.') || room.startsWith('M.')) {
    return room.replace(/^M\./i, 'ม.');
  }
  return room;
}

/**
 * รูปแบบมาตรฐานสำหรับแสดงรายวิชา + ระดับชั้น + ห้องเรียน ทั้งโปรเจกต์
 *   มีครบ:      "คณิตศาสตร์พื้นฐาน - ม.5/8 (943)"
 *   ไม่มี level: "คณิตศาสตร์พื้นฐาน (943)"
 *   ไม่มี room:  "คณิตศาสตร์พื้นฐาน - ม.5/8"
 *   level == room (เช่น ห้อง = "ม.5/8"): ไม่ซ้ำ → "คณิตศาสตร์พื้นฐาน - ม.5/8"
 */
export function formatCourseTitle(name?: string, level?: string, room?: string): string {
  const n = (name || '').trim();
  // normalize "M.5/8" -> "ม.5/8" ให้ทั้งโปรเจกต์แสดงรูปแบบเดียว
  const lv = (level || '').trim().replace(/^M\.\s*/i, 'ม.');
  const rm = (room || '').trim();
  let out = n || 'รายวิชา';
  if (lv) out += ` - ${lv}`;
  if (rm && !isSameRoom(rm, lv)) out += ` (${rm})`;
  return out;
}


