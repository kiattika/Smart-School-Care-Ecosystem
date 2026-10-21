import { create } from 'zustand';
import { useEffect } from 'react';
import type { StaffTaskKind } from './staffTasks';
import type { StaffNotificationKind } from './staffNotifications';

/**
 * กระดิ่งกดแล้วพาไปหน้างาน: เป้าหมาย = บทบาทที่ต้องใช้ + แท็บในพอร์ทัลของบทบาทนั้น
 * StaffTaskBell เรียก `go()` (สลับบทบาทก่อนถ้าจำเป็น) แล้วพอร์ทัลปลายทางรับเป้าหมายผ่าน `useConsumeBellNav`
 * — state แยกเป็นร้านเล็กของตัวเอง (ไม่ผูกกับ StoreState) และเริ่มต้นเป็น null เสมอ
 */
export interface BellNavTarget {
  role: string;
  tab: string;
}

interface BellNavState {
  target: BellNavTarget | null;
  go: (t: BellNavTarget) => void;
  clear: () => void;
}

export const useBellNav = create<BellNavState>((set) => ({
  target: null,
  go: (t) => set({ target: t }),
  clear: () => set({ target: null }),
}));

/** รับเป้าหมายเมื่อเป็นของบทบาทนี้และแท็บอยู่ในรายการที่พอร์ทัลรองรับ — คืนแท็บ หรือ null */
export function acceptBellNav(target: BellNavTarget | null, role: string, allowedTabs: readonly string[]): string | null {
  if (!target || target.role !== role) return null;
  return allowedTabs.includes(target.tab) ? target.tab : null;
}

/**
 * พอร์ทัลเรียกใช้: เมื่อมีเป้าหมายของบทบาทตนเอง → apply(tab) แล้วล้างเป้าหมาย
 * ทำงานทั้งตอน mount (สลับบทบาทมาใหม่) และตอนเป้าหมายเปลี่ยน (อยู่บทบาทเดิมอยู่แล้ว)
 */
export function useConsumeBellNav(role: string, allowedTabs: readonly string[], apply: (tab: string) => void) {
  const target = useBellNav((s) => s.target);
  const clear = useBellNav((s) => s.clear);
  useEffect(() => {
    const tab = acceptBellNav(target, role, allowedTabs);
    if (tab === null) return;
    apply(tab);
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, role]);
}

export const LATE_APPROVER_ROLES_FOR_NAV = ['ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR'] as const;

const firstOwned = (myRoles: readonly string[], candidates: readonly string[]): string | null =>
  candidates.find((r) => myRoles.includes(r)) ?? null;

/** เป้าหมายของ "งานค้าง" — null = ไม่มีหน้าปลายทางที่เหมาะสม (ไม่เดา) */
export function taskTarget(kind: StaffTaskKind, activeRole: string, myRoles: readonly string[]): BellNavTarget | null {
  switch (kind) {
    case 'LEAVE':
      return { role: 'HOMEROOM_TEACHER', tab: 'dashboard' };
    case 'CHAT_UNREAD':
      return { role: 'HOMEROOM_TEACHER', tab: 'class-chat' };
    case 'APPOINTMENT':
      return activeRole === 'GUIDANCE_COUNSELOR' ? { role: 'GUIDANCE_COUNSELOR', tab: 'appointments' } : { role: 'HOMEROOM_TEACHER', tab: 'dashboard' };
    case 'SCREENING_2Q':
    case 'SCREENING_RED_FLAG':
      return activeRole === 'GUIDANCE_COUNSELOR' ? { role: 'GUIDANCE_COUNSELOR', tab: 'depression' } : { role: 'HOMEROOM_TEACHER', tab: 'screening' };
    case 'LATE_ATTENDANCE': {
      const role = (LATE_APPROVER_ROLES_FOR_NAV as readonly string[]).includes(activeRole) ? activeRole : firstOwned(myRoles, LATE_APPROVER_ROLES_FOR_NAV);
      return role ? { role, tab: 'late-attendance' } : null;
    }
    case 'SUBSTITUTE_APPROVAL':
      return { role: activeRole, tab: 'substitute' };
    case 'SUBSTITUTE_CONFIRM': {
      const role = firstOwned(myRoles, ['SUBJECT_TEACHER']);
      return role ? { role, tab: 'substitutions' } : null;
    }
    default:
      return null;
  }
}

/** เป้าหมายของ "ข้อความ" (staff_notifications) ตามชนิด — ผู้รับอาจเป็นครูผู้ยื่นหรือผู้อนุมัติ (เตือน 16:00 ส่งทั้งสองฝั่ง) */
export function messageTarget(kind: StaffNotificationKind, myRoles: readonly string[]): BellNavTarget | null {
  const teacher = firstOwned(myRoles, ['SUBJECT_TEACHER']);
  switch (kind) {
    case 'LATE_ATTENDANCE_DECISION':
      return teacher ? { role: teacher, tab: 'courses' } : null;
    case 'LATE_ATTENDANCE_REMINDER': {
      const approver = firstOwned(myRoles, LATE_APPROVER_ROLES_FOR_NAV);
      if (approver) return { role: approver, tab: 'late-attendance' };
      return teacher ? { role: teacher, tab: 'courses' } : null;
    }
    case 'SUBSTITUTE_UPDATE':
      return teacher ? { role: teacher, tab: 'substitutions' } : null;
    case 'LESSON_PLAN_REVIEW':
      return teacher ? { role: teacher, tab: 'my-lesson-plans' } : null;
    case 'LESSON_PLAN_SUBMITTED': {
      // ผู้ตรวจ: หัวหน้างานนิเทศก่อน (เห็นทุกแผน) แล้วค่อยหัวหน้า/รองหัวหน้ากลุ่มสาระฯ (หน้างานนิเทศในพอร์ทัลอนุมัติ)
      if (myRoles.includes('INSTRUCTIONAL_SUPERVISOR')) return { role: 'INSTRUCTIONAL_SUPERVISOR', tab: 'plans' };
      const head = firstOwned(myRoles, ['HEAD_OF_DEPARTMENT', 'DEPUTY_HEAD_OF_DEPARTMENT']);
      return head ? { role: head, tab: 'supervision-plans' } : null;
    }
    case 'SUPERVISION_RESULT':
      return teacher ? { role: teacher, tab: 'my-supervision' } : null;
    case 'CONDUCT_DECISION':
      return teacher ? { role: teacher, tab: 'conduct' } : null;
    default:
      return null;
  }
}
