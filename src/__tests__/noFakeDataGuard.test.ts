import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { readSource } from './helpers/readSource';

/**
 * Guard กฎ no-fake-data (CLAUDE.md) รอบ A — กันค่าสำรองปลอม / ปุ่มจำลอง / debug log กลับเข้ามาใน src/
 * สแกนเฉพาะ "โค้ด" (ข้ามบรรทัด comment) ของไฟล์ .ts/.tsx ทั้งหมดใน src/ ยกเว้น __tests__
 */
const root = path.resolve(__dirname, '../..');
const srcDir = path.join(root, 'src');

const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); }
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
};
walk(srcDir);

const rel = (f: string) => path.relative(root, f).replace(/\\/g, '/');
const isCommentLine = (line: string) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);

/** บรรทัดโค้ด (ไม่ใช่ comment) ที่ match regex ใดๆ — คืน "file:line: text" */
function scan(patterns: RegExp[], opts: { allowFiles?: string[]; onlyFiles?: string[] } = {}): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const r = rel(f);
    if (opts.allowFiles?.includes(r)) continue;
    if (opts.onlyFiles && !opts.onlyFiles.includes(r)) continue;
    readSource(f).split('\n').forEach((line, i) => {
      if (isCommentLine(line)) return;
      if (patterns.some((p) => p.test(line))) hits.push(`${r}:${i + 1}: ${line.trim().slice(0, 140)}`);
    });
  }
  return hits;
}

describe('no-fake-data guard — hardcoded identity fallbacks (item 4)', () => {
  // บัญชีทดสอบ emulator ใน LoginPage แสดงเฉพาะ DEV (ตรวจแยกด้านล่าง) — ที่เดียวที่อนุญาต
  const LOGIN_PAGE = 'src/LoginPage.tsx';

  it('no fake user identity used as a fallback anywhere in src/', () => {
    const hits = scan([
      /kiattika@utd\.ac\.th/,
      /kiattisak@utd\.ac\.th/,
      /Mr\.\s?Kiattisak/,
      /['"`]teacher_001['"`]/,
      /['"`]teacher@utd\.ac\.th['"`]/,
      /['"`]advisor@utd\.ac\.th['"`]/,
      /includes\(['"`]Kiattisak['"`]\)/,
    ], { allowFiles: [LOGIN_PAGE] });
    expect(hits).toEqual([]);
  });

  it('LoginPage test-account list is rendered only under import.meta.env.DEV', () => {
    const s = readSource(path.join(root, LOGIN_PAGE));
    expect(s).toContain('{import.meta.env.DEV && (');
    expect(s.indexOf('{import.meta.env.DEV && (')).toBeLessThan(s.indexOf('EMULATOR_TEST_USERS.map('));
  });
});

describe('no-fake-data guard — hardcoded room / count / label fallbacks (item 4)', () => {
  it("no 'ม.5/8' fallback (|| / ?? / useState default)", () => {
    expect(scan([
      /(\|\||\?\?)\s*['"`]ม\.5\/8['"`]/,
      /useState\(\s*['"`]ม\.5\/8['"`]\s*\)/,
      /return\s+['"`]ม\.5\/8['"`]/,
      /isSameRoom\([^)]*['"`]ม\.5\/8['"`]\)/,
    ])).toEqual([]);
  });

  it('no hardcoded studentsCount numbers', () => {
    // ห้ามตัวเลขปลอม (40/38/...) — `|| 0` ตอนแสดงผลจำนวนจริงที่ยังไม่มี ไม่ใช่ค่าปลอม
    expect(scan([/studentsCount:\s*[1-9]/, /studentsCount\s*(\|\||\?\?)\s*[1-9]/, /\?\s*40\s*:\s*[^:]*\?\s*38\s*:/])).toEqual([]);
  });

  it("no fabricated room labels ('[943] HR 5/8', '[935] HR 5/9')", () => {
    expect(scan([/['"`]\[943\] HR 5\/8['"`]/, /['"`]\[935\] HR 5\/9['"`]/])).toEqual([]);
  });

  it('TeacherPortal header shows the department from the real profile, not a hardcoded one', () => {
    expect(scan([/กลุ่มสาระฯ คณิตศาสตร์/], { onlyFiles: ['src/TeacherPortal.tsx'] })).toEqual([]);
    const s = readSource(path.join(srcDir, 'TeacherPortal.tsx'));
    expect(s).toContain("const myDepartmentName = myDepartmentId ? departmentNameOf(myDepartmentId) : '';");
  });

  it('no claims for features the system does not implement', () => {
    expect(scan([/Anti-Mock Location/, /ระบบป้องกันการจำลองพิกัดเสมือน/, /แจ้งเตือนผู้ปกครองผ่าน LINE ทันที/])).toEqual([]);
  });

  it('writes abort with a visible error when there is no logged-in user (no fake writer)', () => {
    const tp = readSource(path.join(srcDir, 'TeacherPortal.tsx'));
    expect(tp).toContain("setToast('❌ ไม่พบข้อมูลผู้ใช้ที่เข้าสู่ระบบ — ยกเลิกการบันทึกการเช็คชื่อ กรุณาเข้าสู่ระบบใหม่');");
    const hook = readSource(path.join(srcDir, 'hooks/useHomeroomAttendance.ts'));
    expect(hook).toContain('const teacherEmail = user?.email;\n    if (!teacherEmail) {');
    expect(hook).toContain('const requesterEmail = user?.email;\n    if (!requesterEmail) {');
    const csm = readSource(path.join(srcDir, 'components/ClassroomSeatingManager.tsx'));
    expect(csm).toContain('const requireActorUid = (): string | null => {');
    expect((csm.match(/const actorUid = requireActorUid\(\);\n\s+if \(!actorUid\) return;/g) || []).length).toBe(3);
    expect(csm).toContain("if (!props.course || !props.course.room) {");
    const modal = readSource(path.join(srcDir, 'components/seating/TakeAttendanceModal.tsx'));
    expect(modal).toContain('if (!teacherId) {');
  });
});

describe('no-fake-data guard — removed simulate buttons / seeders / debug output (item 2)', () => {
  it('none of the removed fake features come back', () => {
    expect(scan([
      /จำลองเช็คชื่อสำเร็จ/,
      /จำลองครูร่วมเช็คชื่อ/,
      /onTogglePartnerAttendance/,
      /handleSimulateScan/,
      /Smart Gate Simulator/,
      /seedDatabaseWeb/,
      /Zustand Mock/,
      /Real-time Sync Status/,
      /\[TASK1-DATE-DEBUG\]/,
      /\[DEBUG-ATT\]/,
      /จำลองการเข้าสู่ระบบ/,
    ])).toEqual([]);
  });

  it('deleted mock data files stay deleted; mockData.ts only keeps MOCK_VISIT_DATA (round B)', () => {
    for (const f of ['mockStudentParentData.ts', 'mockSelfAssessments.ts', 'mockStudents.ts', 'mockStudentsData.ts', 'realStudents.ts', 'teachingLoadData.ts']) {
      expect(fs.existsSync(path.join(srcDir, 'data', f)), f).toBe(false);
    }
    expect(fs.existsSync(path.join(srcDir, 'LandingPortal.tsx'))).toBe(false);
    const exports = readSource(path.join(srcDir, 'data/mockData.ts')).match(/^export .*/gm) || [];
    expect(exports).toEqual(['export const MOCK_VISIT_DATA = [']);
  });
});

describe('no-fake-data guard — simulation tools are DEV-only (item 3)', () => {
  it('TeacherPortal Time Simulation button + modal render only under import.meta.env.DEV', () => {
    const s = readSource(path.join(srcDir, 'TeacherPortal.tsx'));
    expect(s).toMatch(/\{import\.meta\.env\.DEV && \(\n\s+<button \n\s+onClick=\{\(\) => setShowConfigModal\(true\)\}/);
    expect(s).toContain('{import.meta.env.DEV && showConfigModal && (');
    expect((s.match(/setShowConfigModal\(true\)/g) || []).length).toBe(1);
  });

  it('"Simulated Time" label appears only behind import.meta.env.DEV (production shows "เวลาปัจจุบัน")', () => {
    const hits = scan([/Simulated Time/]);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h, h).toContain('import.meta.env.DEV');
    expect(readSource(path.join(srcDir, 'TeacherPortal.tsx'))).toContain("'เวลาจำลอง (Simulated Time):' : 'เวลาปัจจุบัน:'");
  });

  it('GPS check-in "Simulation Quick Testing" presets render only under import.meta.env.DEV', () => {
    const s = readSource(path.join(srcDir, 'components/GPSGeofenceCheckinModal.tsx'));
    const dev = s.indexOf('{import.meta.env.DEV && (', s.indexOf('Simulation & Preset Location Buttons'));
    const label = s.indexOf('Simulation Quick Testing');
    expect(dev).toBeGreaterThan(-1);
    expect(dev).toBeLessThan(label);
  });
});
