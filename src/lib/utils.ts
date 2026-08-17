import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseThaiSchedule(scheduleStr: string) {
  if (!scheduleStr) return [];

  // e.g., "จ1-2, พ7"
  const segments = scheduleStr.split(',').map(s => s.trim());
  const result: { day: number; periodIndex: number }[] = [];

  const dayMap: Record<string, number> = {
    'จ': 1,
    'อ': 2,
    'พ': 3,
    'พฤ': 4,
    'ฤ': 4,
    'ศ': 5
  };

  segments.forEach(segment => {
    // Matches patterns like "จ1", "จ1-2", "พฤ3-4", "ศ5"
    const match = segment.match(/^([จอพศฤ]+)([\d\-]+)$/);
    if (!match) return;

    let dayStr = match[1];
    // Special handling if 'พฤ' is parsed correctly, otherwise might need adjustment.
    // In our regex `([จอพศฤ]+)` captures it. Note 'พฤ' will map properly.
    if (dayStr === 'พุ') dayStr = 'พ'; // just in case

    const periodsStr = match[2];
    const targetDay = dayMap[dayStr] || 1;

    const periods: number[] = [];
    if (periodsStr.includes('-')) {
      const [start, end] = periodsStr.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        periods.push(i);
      }
    } else {
      periods.push(Number(periodsStr));
    }

    periods.forEach(p => result.push({ day: targetDay, periodIndex: p }));
  });

  return result;
}

export function isSameRoom(r1?: string, r2?: string): boolean {
  if (!r1 || !r2) return false;
  const norm = (r: string) => r.replace(/^ม\./i, '').replace(/^M\./i, '').trim();
  return norm(r1) === norm(r2);
}

