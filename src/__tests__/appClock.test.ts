import { describe, it, expect, vi, afterEach } from 'vitest';
import * as path from 'path';
import { CLOCK_TICK_MS, nextClockValue, writeTimestamp } from '../lib/appClock';
import { readSource } from './helpers/readSource';

/**
 * นาฬิกาของแอป (store.currentDate):
 * - production เดินตามเวลาจริง (tick ≤ 60 วินาที + ทันทีเมื่อกลับมาที่แท็บ)
 * - DEV ที่กำลังจำลองเวลา คงค่าที่จำลองไว้
 * - timestamp ที่เขียนลง Firestore = เวลาตอนกดบันทึกจริง (ยกเว้น DEV ที่จำลองเวลา)
 */
const at = (iso: string) => new Date(iso);
const LOADED = at('2026-10-03T08:05:00');   // เวลาโหลดหน้า (ค่าค้างเดิมของ store)
const NOW = at('2026-10-03T14:42:30');      // เวลาจริงตอนนี้

describe('nextClockValue', () => {
  it('production: always real time — hours/minutes no longer stuck at page-load time', () => {
    expect(nextClockValue(LOADED, NOW, false, false)).toEqual(NOW);
  });

  it('production ignores a simulation flag (there is no simulation mode in production)', () => {
    expect(nextClockValue(LOADED, NOW, true, false)).toEqual(NOW);
  });

  it('DEV without simulation: real time', () => {
    expect(nextClockValue(LOADED, NOW, false, true)).toEqual(NOW);
  });

  it('DEV while simulating: keeps the simulated value on the same day', () => {
    const simulated = at('2026-10-03T23:58:00');
    expect(nextClockValue(simulated, NOW, true, true)).toBe(simulated);
  });

  it('DEV while simulating across midnight: keeps simulated HH:mm but rolls the day to today', () => {
    const simulated = at('2026-10-02T10:15:00');
    const rolled = nextClockValue(simulated, NOW, true, true);
    expect(rolled.toDateString()).toBe(NOW.toDateString());
    expect([rolled.getHours(), rolled.getMinutes()]).toEqual([10, 15]);
  });
});

describe('writeTimestamp (submittedAt / isLate)', () => {
  it('production: the moment of saving, never the store value', () => {
    expect(writeTimestamp(LOADED, NOW, false, false)).toBe(NOW);
    expect(writeTimestamp(LOADED, NOW, true, false)).toBe(NOW);
  });

  it('DEV: real time unless simulating; simulated time while simulating', () => {
    expect(writeTimestamp(LOADED, NOW, false, true)).toBe(NOW);
    const simulated = at('2026-10-03T23:58:00');
    expect(writeTimestamp(simulated, NOW, true, true)).toBe(simulated);
  });
});

describe('store clock actions (vitest runs as DEV)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('tickClock advances to real time; simulation holds; clearing returns to real time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(LOADED);
    const { useStore } = await import('../store');
    const s = () => useStore.getState();

    vi.setSystemTime(NOW);
    s().tickClock();
    expect(s().currentDate.getTime()).toBe(NOW.getTime());
    expect(s().isTimeSimulated).toBe(false);

    const simulated = at('2026-10-03T23:30:00');
    s().setSimulatedTime(simulated);
    expect(s().isTimeSimulated).toBe(true);
    vi.setSystemTime(at('2026-10-03T15:00:00'));
    s().tickClock();
    expect(s().currentDate.getTime()).toBe(simulated.getTime());

    s().clearTimeSimulation();
    expect(s().isTimeSimulated).toBe(false);
    vi.setSystemTime(at('2026-10-03T15:01:00'));
    s().tickClock();
    expect(s().currentDate.getTime()).toBe(at('2026-10-03T15:01:00').getTime());
  });
});

describe('wiring', () => {
  const root = path.resolve(__dirname, '../..');
  const src = (rel: string) => readSource(path.join(root, rel));

  it('ticks at most every 60 seconds', () => {
    expect(CLOCK_TICK_MS).toBeLessThanOrEqual(60_000);
  });

  it('useAppClock ticks on an interval and immediately when the tab becomes visible / focused; App mounts it', () => {
    const hook = src('src/hooks/useAppClock.ts');
    expect(hook).toContain('setInterval(() => tickClock(), CLOCK_TICK_MS)');
    expect(hook).toContain("document.addEventListener('visibilitychange', onVisible);");
    expect(hook).toContain("window.addEventListener('focus', onFocus);");
    expect(src('src/App.tsx')).toContain('  useAppClock();');
  });

  it('nothing sets currentDate directly any more (only tickClock / setSimulatedTime / clearTimeSimulation)', () => {
    expect(src('src/store.ts')).not.toContain('setCurrentDate');
    expect(src('src/TeacherPortal.tsx')).not.toContain('setCurrentDate');
    expect(src('src/store.ts')).toContain('if (!import.meta.env.DEV) return;');
  });

  it('post-teaching submittedAt / isLate use the moment of saving (writeTimestamp), not store.currentDate', () => {
    const tp = src('src/TeacherPortal.tsx');
    expect(tp).toContain('const submittedAt = writeTimestamp(currentDate, new Date(), isTimeSimulated, import.meta.env.DEV);');
    expect(tp).toContain('const submittedAtIso = submittedAt.toISOString();');
    expect(tp).toContain('const isLate = isAfter(submittedAt, teachingMidnight);');
    expect(tp).not.toContain('currentDate.toISOString()');
  });
});
