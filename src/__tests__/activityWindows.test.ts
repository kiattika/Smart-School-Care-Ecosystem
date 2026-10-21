import { describe, it, expect } from 'vitest';
import { parseActivityWindows, activityWindowState, activityWindowBlockMessage, isActivityWindowOpen } from '../lib/activityWindows';
import { activityWindowEntries } from '../lib/countdownRegistry';
import { readSource } from './helpers/readSource';

const H = 3_600_000;
const NOW = Date.parse('2026-10-21T10:00:00Z');

describe('activityWindows', () => {
  it('ไม่มีเอกสาร/ไม่มีช่วง/ค่าผิดรูปแบบ = ไม่จำกัด (เปิด)', () => {
    expect(parseActivityWindows(null)).toEqual({});
    expect(parseActivityWindows({ windows: { SDQ_ROUND1: { opensAt: null, closesAt: null }, X: {} } })).toEqual({});
    expect(isActivityWindowOpen('SDQ_ROUND1', {}, NOW)).toBe(true);
    expect(activityWindowBlockMessage('LESSON_PLAN', {}, NOW)).toBeNull();
  });
  it('ก่อนเปิด = NOT_YET, หลังปิด = CLOSED, อยู่ในช่วง = OPEN พร้อม deadline', () => {
    const w = parseActivityWindows({ windows: { LESSON_PLAN: { opensAt: NOW + H, closesAt: NOW + 5 * H } } });
    expect(activityWindowState('LESSON_PLAN', w, NOW).phase).toBe('NOT_YET');
    expect(activityWindowState('LESSON_PLAN', w, NOW + 2 * H).phase).toBe('OPEN');
    expect(activityWindowState('LESSON_PLAN', w, NOW + 6 * H).phase).toBe('CLOSED');
    expect(activityWindowBlockMessage('LESSON_PLAN', w, NOW + 6 * H)).toMatch(/ปิดแล้ว/);
    expect(activityWindowBlockMessage('LESSON_PLAN', w, NOW)).toMatch(/ยังไม่เปิด/);
  });
  it('kind อื่นไม่กระทบกัน', () => {
    const w = parseActivityWindows({ windows: { SDQ_ROUND1: { opensAt: null, closesAt: NOW - H } } });
    expect(isActivityWindowOpen('CLUB_ENROLLMENT', w, NOW)).toBe(true);
    expect(isActivityWindowOpen('SDQ_ROUND1', w, NOW)).toBe(false);
  });
  it('ตัวนับถอยหลังแสดงเฉพาะที่มีเวลา และเป็น kind ของผู้ใช้', () => {
    const w = parseActivityWindows({ windows: { LESSON_PLAN: { opensAt: null, closesAt: NOW + 3 * H }, SDQ_ROUND1: { opensAt: null, closesAt: NOW - H } } });
    const e = activityWindowEntries(w, ['LESSON_PLAN', 'SDQ_ROUND1', 'CLUB_ENROLLMENT'], NOW);
    expect(e).toHaveLength(1);
    expect(e[0].targetMs).toBe(NOW + 3 * H);
  });
  it('guard: store/lessonPlanService เรียก assertActivityWindowOpen และ rules ชุมนุมตรวจ activityWindowOpen', () => {
    expect(readSource('src/store.ts')).toMatch(/assertActivityWindowOpen\('SDQ_ROUND1'\)/);
    expect(readSource('src/services/lessonPlanService.ts')).toMatch(/assertActivityWindowOpen\('LESSON_PLAN'\)/);
    expect(readSource('firestore.rules.comments')).toMatch(/function activityEnrollmentOpen[\s\S]{0,200}activityWindowOpen\('CLUB_ENROLLMENT'\)/);
  });
});
