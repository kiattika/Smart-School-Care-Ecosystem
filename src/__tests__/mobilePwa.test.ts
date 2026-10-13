import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { readSource } from './helpers/readSource';
import { isMobilePath, canRegisterServiceWorker } from '../lib/pwa';
import { mobileMenuFor } from '../mobile/mobileMenu';
import { isTwoQDue } from '../lib/mobileDue';
import { buildTeacherDaySchedule } from '../lib/teacherDaySchedule';

const root = path.resolve(__dirname, '../..');

describe('pwa: เส้นทาง + การลงทะเบียน', () => {
  it('isMobilePath', () => {
    expect(isMobilePath('/m')).toBe(true);
    expect(isMobilePath('/m/')).toBe(true);
    expect(isMobilePath('/m/anything')).toBe(true);
    expect(isMobilePath('/')).toBe(false);
    expect(isMobilePath('/mx')).toBe(false);
    expect(isMobilePath('/admin/m')).toBe(false);
  });
  it('ลงทะเบียน SW เฉพาะ production + รองรับ + secure', () => {
    expect(canRegisterServiceWorker({ prod: true, hasSW: true, secure: true })).toBe(true);
    expect(canRegisterServiceWorker({ prod: false, hasSW: true, secure: true })).toBe(false);
    expect(canRegisterServiceWorker({ prod: true, hasSW: false, secure: true })).toBe(false);
    expect(canRegisterServiceWorker({ prod: true, hasSW: true, secure: false })).toBe(false);
  });
});

describe('pwa: ไฟล์ manifest / icons / service worker / hosting', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
  it('manifest ครบและไอคอนมีอยู่จริง', () => {
    expect(manifest.start_url).toBe('/m');
    expect(manifest.display).toBe('standalone');
    expect(manifest.scope).toBe('/');
    const sizes = manifest.icons.map((i: any) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
    for (const i of manifest.icons) expect(fs.existsSync(path.join(root, 'public', i.src))).toBe(true);
    expect(fs.existsSync(path.join(root, 'public/icons/apple-touch-icon.png'))).toBe(true);
  });
  it('index.html ผูก manifest + theme-color + viewport-fit', () => {
    const html = readSource('index.html');
    expect(html).toMatch(/rel="manifest" href="\/manifest\.webmanifest"/);
    expect(html).toMatch(/name="theme-color"/);
    expect(html).toMatch(/viewport-fit=cover/);
    expect(html).toMatch(/apple-touch-icon/);
  });
  it('service worker: ไม่แตะข้ามโดเมน/__/ , ไม่แคช API, ไม่ skipWaiting เอง', () => {
    const sw = readSource('public/sw.js');
    expect(sw).toMatch(/url\.origin !== self\.location\.origin\) return/);
    expect(sw).toMatch(/startsWith\('\/__\/'\)/);
    expect(sw).toMatch(/req\.method !== 'GET'\) return/);
    const code = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/firestore|googleapis|identitytoolkit/i);
    // skipWaiting ต้องมาจากข้อความของผู้ใช้เท่านั้น ไม่ใช่ใน install
    const install = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('activate'"));
    expect(install).not.toMatch(/skipWaiting/);
    expect(sw).toMatch(/SKIP_WAITING/);
  });
  it('firebase.json: sw.js ไม่แคช + manifest content-type', () => {
    const fb = JSON.parse(readSource('firebase.json'));
    const hdrs = fb.hosting.headers as { source: string; headers: { key: string; value: string }[] }[];
    expect(hdrs.find(h => h.source === '/sw.js')?.headers).toEqual([{ key: 'Cache-Control', value: 'no-cache' }]);
    expect(hdrs.find(h => h.source === '/manifest.webmanifest')?.headers.some(h => h.value === 'application/manifest+json')).toBe(true);
    // หน้า HTML (/, /index.html, /m) ต้องไม่ถูกแคชของเบราว์เซอร์ — ไม่งั้นหลัง deploy ผู้ใช้ยังได้ index.html เก่า (ชี้ไฟล์ JS รุ่นเก่า) นานถึง 1 ชม.
    for (const src of ['/', '/index.html', '/m', '/m/**']) {
      expect(hdrs.find(h => h.source === src)?.headers).toEqual([{ key: 'Cache-Control', value: 'no-cache' }]);
    }
    expect(fb.hosting.rewrites).toEqual([{ source: '**', destination: '/index.html' }]);
  });
  it('App ส่ง /m ไป MobileApp หลังล็อกอิน', () => {
    const app = readSource('src/App.tsx');
    expect(app).toMatch(/isMobilePath\(window\.location\.pathname\)/);
    expect(app.indexOf('isMobilePath(')).toBeGreaterThan(app.indexOf('if (!user)'));
  });
});

describe('mobileMenuFor', () => {
  const ids = (x: ReturnType<typeof mobileMenuFor>) => x.map(i => i.id);
  it('นักเรียน', () => {
    expect(ids(mobileMenuFor({ appRole: 'student', roles: ['STUDENT'] }))).toEqual(['checkin', 'schedule', 'homeLocation', 'chat']);
  });
  it('ผู้ปกครอง: ไม่มีเช็คอิน/พิกัดบ้าน; ไม่มีบทบาท PARENT = ไม่มีเมนู', () => {
    expect(ids(mobileMenuFor({ appRole: 'parent', roles: ['PARENT'] }))).toEqual(['childGate', 'schedule', 'leave', 'appointment', 'homeVisit', 'chat']);
    expect(mobileMenuFor({ appRole: 'parent', roles: [] })).toEqual([]);
  });
  it('ครูประจำวิชา: เช็คอิน + ตารางสอน ไม่มีเช็คชื่อโฮมรูม', () => {
    expect(ids(mobileMenuFor({ appRole: 'teacher', roles: ['SUBJECT_TEACHER'] }))).toEqual(['checkin', 'schedule']);
  });
  it('ครูประจำชั้น: มีเช็คชื่อโฮมรูม + ข้อความ', () => {
    expect(ids(mobileMenuFor({ appRole: 'advisor', roles: ['SUBJECT_TEACHER', 'HOMEROOM_TEACHER'] }))).toEqual(['checkin', 'schedule', 'homeroom', 'chat']);
  });
  it('บทบาทไม่มีตารางสอน (เช่น การเงิน) มีแค่เช็คอิน', () => {
    expect(ids(mobileMenuFor({ appRole: 'teacher', roles: ['FINANCE_STAFF'] }))).toEqual(['checkin']);
  });
});

describe('buildTeacherDaySchedule', () => {
  const periods = [
    { periodNumber: 1, startTime: '08:30', endTime: '09:20' },
    { periodNumber: 2, startTime: '09:20', endTime: '10:10' },
    { periodNumber: 3, startTime: '10:10', endTime: '11:00' },
  ];
  // วันพุธ 14 ต.ค. 2569 → 2026-10-14
  const wed = (h: number, m: number) => new Date(2026, 9, 14, h, m);
  const schedules = [
    { id: 'a', dayOfWeek: 'wednesday', periodNumber: 1, subjectCode: 'ค21101', subjectName: 'คณิต', level: 'ม.5/8', teacherEmail: 'T@utd.ac.th' },
    { id: 'b', dayOfWeek: 'wednesday', periodNumber: 2, subjectCode: 'ว21101', subjectName: 'วิทย์', level: 'ม.5/1', teacherIds: ['tch-1'] },
    { id: 'c', dayOfWeek: 'wednesday', periodNumber: 3, subjectCode: 'อ21101', subjectName: 'อังกฤษ', level: 'ม.5/2', teacherEmail: 'other@utd.ac.th' },
    { id: 'd', dayOfWeek: 'thursday', periodNumber: 1, subjectCode: 'ค21101', subjectName: 'คณิต', level: 'ม.5/8', teacherEmail: 't@utd.ac.th' },
  ];
  it('เฉพาะของฉัน วันนี้ (อีเมล normalize หรือ staffId) พร้อมสถานะตามเวลา', () => {
    const { rows } = buildTeacherDaySchedule({ schedules, periods, user: { email: 't@utd.ac.th', staffId: 'tch-1' }, now: wed(9, 30) });
    expect(rows.map(r => r.key)).toEqual(['a', 'b']);
    expect(rows[0].status).toBe('DONE');
    expect(rows[1].status).toBe('NOW');
    expect(rows[0].classLabel).toBe('ม.5/8');
  });
  it('ไม่ตรงใคร = ว่าง ไม่เดา', () => {
    expect(buildTeacherDaySchedule({ schedules, periods, user: { email: 'x@utd.ac.th', staffId: null }, now: wed(9, 0) }).rows).toEqual([]);
  });
});


describe('เมนูแบบประเมินบนมือถือ (หายเมื่อทำแล้ว / โผล่เมื่อถึงกำหนด)', () => {
  const ids = (x: ReturnType<typeof mobileMenuFor>) => x.map(i => i.id);
  const student = (due: any) => ids(mobileMenuFor({ appRole: 'student', roles: ['STUDENT'], due }));
  it('นักเรียน: ยังไม่ทำสุขภาพ/SDQ และ 2Q ถึงกำหนด = เห็นครบ', () => {
    expect(student({ clubOpen: true, healthDone: false, sdqDone: false, twoQDue: true }))
      .toEqual(['checkin', 'schedule', 'club', 'health', 'sdq', 'twoQ', 'homeLocation', 'chat']);
  });
  it('นักเรียน: ทำแล้ว = เมนูหาย; ยังไม่รู้สถานะ = ซ่อนไว้ก่อน', () => {
    expect(student({ healthDone: true, sdqDone: true, twoQDue: false })).toEqual(['checkin', 'schedule', 'homeLocation', 'chat']);
    expect(student({})).toEqual(['checkin', 'schedule', 'homeLocation', 'chat']);
  });
  it('สมัครชุมนุม: โผล่เฉพาะตอนมีชุมนุมเปิดรับ — ปิดรับหมดหรือยังไม่รู้สถานะ = ซ่อน', () => {
    expect(student({ clubOpen: true })).toContain('club');
    expect(student({ clubOpen: false })).not.toContain('club');
    expect(student({})).not.toContain('club');
  });
  it('ผู้ปกครอง: SDQ หายเมื่อประเมินแล้ว และไม่เห็นเมนูสุขภาพ/2Q ของนักเรียน', () => {
    const p = (due: any) => ids(mobileMenuFor({ appRole: 'parent', roles: ['PARENT'], due }));
    expect(p({ sdqDone: false })).toContain('sdq');
    expect(p({ sdqDone: true })).not.toContain('sdq');
    expect(p({ healthDone: false, twoQDue: true })).not.toEqual(expect.arrayContaining(['health']));
    expect(p({ healthDone: false, twoQDue: true })).not.toContain('twoQ');
  });
  it('isTwoQDue: ครบ 14 วัน / ไม่เคยทำ / วันที่เพี้ยน', () => {
    expect(isTwoQDue(null, '2026-10-13')).toBe(true);
    expect(isTwoQDue('bad', '2026-10-13')).toBe(true);
    expect(isTwoQDue('2026-10-13', '2026-10-13')).toBe(false);
    expect(isTwoQDue('2026-09-30', '2026-10-13')).toBe(false); // 13 วัน
    expect(isTwoQDue('2026-09-29', '2026-10-13')).toBe(true);  // 14 วัน
  });
});
