import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import {
  visibleSidebarItems,
  resolveActiveSidebarId,
  readSidebarPinned,
  writeSidebarPinned,
  sidebarMode,
  SIDEBAR_PIN_STORAGE_KEY,
  SIDEBAR_OPEN_DELAY_MS,
  SIDEBAR_CLOSE_DELAY_MS,
} from '../components/shared/portalSidebarLogic';
import { readSource } from './helpers/readSource';

/** รายการเมนูแบบเดียวกับ TeacherPortal (teaching-load ซ่อนสำหรับ SUBJECT_TEACHER) */
const teacherTabs = [
  { id: 'courses' },
  { id: 'gps-geofence' },
  { id: 'teaching-load', hideForRoles: ['SUBJECT_TEACHER'] },
  { id: 'leaderboard' },
  { id: 'substitutions' },
  { id: 'records' },
  { id: 'gradebook' },
];

describe('visibleSidebarItems (menus visible by role)', () => {
  it('hides items whose hideForRoles includes the active role', () => {
    const ids = visibleSidebarItems(teacherTabs, 'SUBJECT_TEACHER').map((t) => t.id);
    expect(ids).not.toContain('teaching-load');
    expect(ids).toHaveLength(6);
  });

  it('keeps them for other roles (e.g. HOMEROOM_TEACHER / HEAD_OF_DEPARTMENT) and keeps order', () => {
    expect(visibleSidebarItems(teacherTabs, 'HOMEROOM_TEACHER').map((t) => t.id)).toEqual(teacherTabs.map((t) => t.id));
    expect(visibleSidebarItems(teacherTabs, 'HEAD_OF_DEPARTMENT')).toHaveLength(7);
  });

  it('no role → nothing hidden by role', () => {
    expect(visibleSidebarItems(teacherTabs, null)).toHaveLength(7);
    expect(visibleSidebarItems(teacherTabs, undefined)).toHaveLength(7);
    expect(visibleSidebarItems([], 'SUBJECT_TEACHER')).toEqual([]);
  });
});

describe('resolveActiveSidebarId (current menu)', () => {
  const visible = visibleSidebarItems(teacherTabs, 'SUBJECT_TEACHER');

  it('keeps the current id when it is still visible', () => {
    expect(resolveActiveSidebarId(visible, 'records')).toBe('records');
  });

  it('falls back to the first visible item when the current one is hidden or unknown (role switch)', () => {
    expect(resolveActiveSidebarId(visible, 'teaching-load')).toBe('courses');
    expect(resolveActiveSidebarId(visible, 'nope')).toBe('courses');
    expect(resolveActiveSidebarId(visible, null)).toBe('courses');
  });

  it('no visible items → null', () => {
    expect(resolveActiveSidebarId([], 'courses')).toBeNull();
  });
});

describe('pin value (localStorage, guarded with try/catch)', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: vi.fn((k: string) => m.get(k) ?? null), setItem: vi.fn((k: string, v: string) => { m.set(k, v); }) };
  };

  it('round-trips true/false under the shared key', () => {
    const st = memory();
    expect(readSidebarPinned(st)).toBe(false); // ยังไม่เคยตั้ง = ไม่ปักหมุด
    expect(writeSidebarPinned(st, true)).toBe(true);
    expect(st.setItem).toHaveBeenCalledWith(SIDEBAR_PIN_STORAGE_KEY, '1');
    expect(readSidebarPinned(st)).toBe(true);
    writeSidebarPinned(st, false);
    expect(readSidebarPinned(st)).toBe(false);
  });

  it('unavailable or throwing storage → not pinned, write reports failure (no crash)', () => {
    const throwing = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(readSidebarPinned(throwing)).toBe(false);
    expect(writeSidebarPinned(throwing, true)).toBe(false);
    expect(readSidebarPinned(null)).toBe(false);
    expect(writeSidebarPinned(undefined, true)).toBe(false);
    expect(readSidebarPinned({ getItem: () => 'true', setItem: () => {} })).toBe(false); // เฉพาะ '1' เท่านั้น
  });
});

describe('sidebarMode', () => {
  it('pinned pushes content; hover/focus expands as an overlay; otherwise collapsed', () => {
    expect(sidebarMode(true, false)).toBe('pinned');
    expect(sidebarMode(true, true)).toBe('pinned');
    expect(sidebarMode(false, true)).toBe('overlay');
    expect(sidebarMode(false, false)).toBe('collapsed');
  });

  it('opens with a short delay (longer than 0) so a passing mouse does not expand it', () => {
    expect(SIDEBAR_OPEN_DELAY_MS).toBeGreaterThan(0);
    expect(SIDEBAR_CLOSE_DELAY_MS).toBeGreaterThan(0);
  });
});

describe('guard: staff portals use the shared PortalSidebarLayout', () => {
  const root = path.resolve(__dirname, '../..');
  const src = (rel: string) => readSource(path.join(root, rel));
  const PORTALS = [
    'src/AdminPortal.tsx',
    'src/TeacherPortal.tsx',
    'src/AdvisorPortal.tsx',
    'src/ExecutivePortal.tsx',
    'src/ApprovalsPortal.tsx',
    'src/components/infirmary/InfirmaryPortal.tsx',
    'src/components/guidance/GuidancePortal.tsx',
    'src/components/supervision/SupervisionPortal.tsx',
  ];

  for (const p of PORTALS) {
    it(`${p} renders its submenu through PortalSidebarLayout`, () => {
      const s = src(p);
      expect(s).toMatch(/import \{ PortalSidebarLayout \} from '[./]+(components\/)?shared\/PortalSidebarLayout';/);
      expect(s).toContain('<PortalSidebarLayout');
      expect(s).toContain('</PortalSidebarLayout>');
      // ห้ามใส่ key ให้ component ที่ประกาศ props เอง (โปรเจกต์ไม่มี @types/react)
      expect(s).not.toMatch(/<PortalSidebarLayout[^>]*\bkey=/);
    });
  }

  it('old horizontal tab bars / bespoke sidebars are gone', () => {
    expect(src('src/TeacherPortal.tsx')).not.toContain('Sub Tabs Selection');
    const advisor = src('src/AdvisorPortal.tsx');
    expect(advisor).not.toContain('Mobile & Tablet Scrollable Sub-Navigation Bar');
    expect(advisor).not.toContain('Desktop Tab Switcher');
    for (const p of ['src/AdminPortal.tsx', 'src/ExecutivePortal.tsx']) {
      expect(src(p)).not.toMatch(/isSidebarCollapsed|isMobileMenuOpen/);
    }
    for (const p of ['src/components/infirmary/InfirmaryPortal.tsx', 'src/components/guidance/GuidancePortal.tsx', 'src/components/supervision/SupervisionPortal.tsx']) {
      expect(src(p)).not.toContain('Main Navigation Tabs');
    }
  });

  it('TeacherPortal: role-based hiding goes through the shared logic, and the sidebar only wraps the dashboard view', () => {
    const s = src('src/TeacherPortal.tsx');
    expect(s).toContain("return visibleSidebarItems(rawTabs, user?.activeRole || 'SUBJECT_TEACHER');");
    expect(s).toContain("{ id: 'teaching-load', label: 'ตารางภาระงานสอน (Teaching Load)', icon: NavLoadIcon, count: 6, hideForRoles: ['SUBJECT_TEACHER'] },");
    expect(s).toContain('const resolved = resolveActiveSidebarId(availableDashboardTabs, dashboardTab);');
    const dashboardBranch = s.indexOf("{view === 'dashboard' ? (");
    const layout = s.indexOf('<PortalSidebarLayout');
    const layoutEnd = s.indexOf('</PortalSidebarLayout>');
    const classView = s.indexOf('<ClassroomSeatingManager');
    expect(dashboardBranch).toBeGreaterThan(-1);
    expect(dashboardBranch).toBeLessThan(layout);
    expect(layoutEnd).toBeLessThan(classView); // class / active_learning view อยู่นอก layout — ไม่มีแถบเมนูนี้
    expect((s.match(/<PortalSidebarLayout/g) || []).length).toBe(1);
  });
});
