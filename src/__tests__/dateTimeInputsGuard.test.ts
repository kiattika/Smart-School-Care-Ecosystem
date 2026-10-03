import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { readSource } from './helpers/readSource';

/**
 * ช่องวันที่/เวลาใช้ component กลางเท่านั้น (src/components/shared/DatePicker, TimePicker)
 * - ห้ามมี type="date" ใน src นอก components/shared
 * - ห้ามมี type="time" นอก components/shared ยกเว้นช่อง Time Simulation ใน TeacherPortal (DEV-only)
 * สแกนเฉพาะบรรทัดโค้ด (ข้าม comment)
 */
const root = path.resolve(__dirname, '../..');
const srcDir = path.join(root, 'src');
const SHARED = 'src/components/shared/';
const rel = (f: string) => path.relative(root, f).replace(/\\/g, '/');

const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); }
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
};
walk(srcDir);

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);

function hits(re: RegExp): string[] {
  const out: string[] = [];
  for (const f of files) {
    const r = rel(f);
    if (r.startsWith(SHARED)) continue;
    readSource(f).split('\n').forEach((line, i) => {
      if (!isComment(line) && re.test(line)) out.push(`${r}:${i + 1}: ${line.trim()}`);
    });
  }
  return out;
}

describe('date / time inputs use the shared pickers', () => {
  it('no type="date" outside src/components/shared (use DatePicker)', () => {
    expect(hits(/type=["'{]\s*["']?date["']?/)).toEqual([]);
  });

  it('no type="time" outside src/components/shared except the DEV-only Time Simulation in TeacherPortal', () => {
    const found = hits(/type=["'{]\s*["']?time["']?/);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/^src\/TeacherPortal\.tsx:/);

    // ช่องนั้นต้องอยู่ใน modal ที่ render เฉพาะ import.meta.env.DEV
    const tp = readSource(path.join(srcDir, 'TeacherPortal.tsx'));
    const devModal = tp.indexOf('{import.meta.env.DEV && showConfigModal && (');
    const timeInput = tp.search(/type="time"/);
    const modalTitle = tp.indexOf('Time Simulation (Admin Config)');
    expect(devModal).toBeGreaterThan(-1);
    expect(devModal).toBeLessThan(modalTitle);
    expect(modalTitle).toBeLessThan(timeInput);
  });

  it('the guard regex catches the old inline forms', () => {
    const re = /type=["'{]\s*["']?date["']?/;
    for (const old of ['<input type="date" value={hodStart} />', "type='date'", 'type={"date"}', '                    type="date"']) {
      expect(re.test(old), old).toBe(true);
    }
    expect(re.test('type="datetime-local"')).toBe(true); // datetime-local ก็ต้องใช้ component กลางเช่นกัน
  });
});
