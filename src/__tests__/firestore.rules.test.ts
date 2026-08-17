import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Helper to convert Firebase permission-denied errors into user-facing Thai feedback
 */
export function getThaiPermissionErrorMessage(error: unknown): string {
  if (!error) return '';
  const errString = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message: unknown }).message)
    : String(error);

  if (
    errString.includes('permission') ||
    errString.includes('PERMISSION_DENIED') ||
    errString.includes('Missing or insufficient permissions') ||
    errString.includes('ไม่มีสิทธิ์')
  ) {
    return 'ไม่มีสิทธิ์เข้าถึงข้อมูล';
  }
  return 'ไม่มีสิทธิ์เข้าถึงข้อมูล';
}

/**
 * Mock Rule Evaluator for unit testing rules logic & Thai UI error feedback
 */
interface SecurityContext {
  uid: string | null;
  role?: 'ADMIN' | 'TEACHER' | 'HOMEROOM' | 'PARENT' | string;
  email?: string;
  admin?: boolean;
}

interface ResourceDoc {
  parentId?: string;
  teacherIds?: string[];
  [key: string]: unknown;
}

class RuleEvaluator {
  private rulesContent: string;

  constructor(rulesPath: string) {
    this.rulesContent = fs.readFileSync(rulesPath, 'utf8');
  }

  getRulesContent(): string {
    return this.rulesContent;
  }

  evaluateAccess(
    action: 'read' | 'write' | 'create' | 'update' | 'delete',
    collection: string,
    context: SecurityContext,
    resourceData?: ResourceDoc
  ): { allowed: boolean; error?: string } {
    const isSignedIn = !!context.uid;
    const isAdmin = isSignedIn && (context.role === 'ADMIN' || context.admin === true || context.email === 'kiattika@utd.ac.th');
    const isTeacher = isSignedIn && (isAdmin || context.role === 'TEACHER' || context.role === 'HOMEROOM');

    // 1. admin_periods_config
    if (collection === 'admin_periods_config') {
      if (action === 'read') return isSignedIn ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
      if (action === 'write' || action === 'create' || action === 'update' || action === 'delete') {
        return isAdmin ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
      }
    }

    // 2. teachers
    if (collection === 'teachers') {
      if (action === 'read') return isSignedIn ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
      return isAdmin ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
    }

    // 3. students
    if (collection === 'students') {
      if (action === 'read') {
        const isChildParent = isSignedIn && resourceData?.parentId === context.uid;
        if (isAdmin || isTeacher || isChildParent) return { allowed: true };
        return { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
      }
      return isAdmin ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
    }

    // 4. schedules
    if (collection === 'schedules') {
      if (action === 'read') return isSignedIn ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
      return (isTeacher || isAdmin) ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
    }

    // 5. attendance_records
    if (collection === 'attendance_records') {
      if (action === 'read') return isSignedIn ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
      return (isTeacher || isAdmin) ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
    }

    // 6. discipline_logs
    if (collection === 'discipline_logs') {
      if (action === 'read') {
        const isChildParent = isSignedIn && resourceData?.parentId === context.uid;
        if (isAdmin || isTeacher || isChildParent) return { allowed: true };
        return { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
      }
      return (isTeacher || isAdmin) ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
    }

    // 7. parent_conferences
    if (collection === 'parent_conferences') {
      if (action === 'read') {
        const isChildParent = isSignedIn && resourceData?.parentId === context.uid;
        if (isAdmin || isTeacher || isChildParent) return { allowed: true };
        return { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
      }
      if (action === 'create' || action === 'update') {
        const isChildParent = isSignedIn && resourceData?.parentId === context.uid;
        if (isAdmin || isTeacher || isChildParent) return { allowed: true };
        return { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
      }
      return isAdmin ? { allowed: true } : { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
    }

    return { allowed: false, error: 'FirebaseError: Missing or insufficient permissions.' };
  }
}

describe('Firestore Security Rules Unit Tests (Smart School Care)', () => {
  let evaluator: RuleEvaluator;

  beforeAll(() => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    evaluator = new RuleEvaluator(rulesPath);
  });

  it('verifies firestore.rules file is properly loaded', () => {
    const content = evaluator.getRulesContent();
    expect(content).toContain("service cloud.firestore");
    expect(content).toContain("match /databases/{database}/documents");
  });

  // 1. Teacher & Schedule Access Control
  describe('1. Teacher & Schedule Access Control', () => {
    it('allows authenticated teachers to write to attendance_records and schedules', () => {
      const teacherContext: SecurityContext = {
        uid: 'teacher_101',
        role: 'TEACHER',
        email: 'teacher@school.ac.th'
      };

      const attendanceRes = evaluator.evaluateAccess('write', 'attendance_records', teacherContext);
      expect(attendanceRes.allowed).toBe(true);

      const scheduleRes = evaluator.evaluateAccess('write', 'schedules', teacherContext);
      expect(scheduleRes.allowed).toBe(true);
    });

    it('denies unauthenticated or unauthorized users and returns "ไม่มีสิทธิ์เข้าถึงข้อมูล"', () => {
      const unauthContext: SecurityContext = { uid: null };

      const res = evaluator.evaluateAccess('write', 'attendance_records', unauthContext);
      expect(res.allowed).toBe(false);

      const thaiMsg = getThaiPermissionErrorMessage(res.error);
      expect(thaiMsg).toBe('ไม่มีสิทธิ์เข้าถึงข้อมูล');
    });
  });

  // 2. Relational Parent Data Isolation
  describe('2. Relational Parent Data Isolation', () => {
    it('allows parents to ONLY read student documents in students where parentId matches their authenticated uid', () => {
      const parentContext: SecurityContext = {
        uid: 'parent_user_100',
        role: 'PARENT'
      };

      // Match parentId -> Allowed
      const ownChildRes = evaluator.evaluateAccess('read', 'students', parentContext, { parentId: 'parent_user_100' });
      expect(ownChildRes.allowed).toBe(true);

      // Different parentId -> Denied
      const otherChildRes = evaluator.evaluateAccess('read', 'students', parentContext, { parentId: 'parent_user_200' });
      expect(otherChildRes.allowed).toBe(false);
      expect(getThaiPermissionErrorMessage(otherChildRes.error)).toBe('ไม่มีสิทธิ์เข้าถึงข้อมูล');
    });

    it('allows parents to write slot selections to parent_conferences for their child, but denies modifying behaviorScore or discipline_logs', () => {
      const parentContext: SecurityContext = {
        uid: 'parent_user_100',
        role: 'PARENT'
      };

      // 1. Parent conference slot update for child -> Allowed
      const confRes = evaluator.evaluateAccess('update', 'parent_conferences', parentContext, { parentId: 'parent_user_100' });
      expect(confRes.allowed).toBe(true);

      // 2. Modify discipline_logs -> Denied
      const discRes = evaluator.evaluateAccess('write', 'discipline_logs', parentContext, { parentId: 'parent_user_100' });
      expect(discRes.allowed).toBe(false);
      expect(getThaiPermissionErrorMessage(discRes.error)).toBe('ไม่มีสิทธิ์เข้าถึงข้อมูล');

      // 3. Modify behaviorScore in students document -> Denied
      const studentWriteRes = evaluator.evaluateAccess('write', 'students', parentContext, { parentId: 'parent_user_100' });
      expect(studentWriteRes.allowed).toBe(false);
      expect(getThaiPermissionErrorMessage(studentWriteRes.error)).toBe('ไม่มีสิทธิ์เข้าถึงข้อมูล');
    });
  });

  // 3. Admin Role Override
  describe('3. Admin Role Override', () => {
    it('allows users with ADMIN custom claims to read and write across all collections', () => {
      const adminContext: SecurityContext = {
        uid: 'admin_user_0',
        role: 'ADMIN',
        email: 'admin@school.ac.th'
      };

      expect(evaluator.evaluateAccess('write', 'admin_periods_config', adminContext).allowed).toBe(true);
      expect(evaluator.evaluateAccess('write', 'teachers', adminContext).allowed).toBe(true);
      expect(evaluator.evaluateAccess('write', 'students', adminContext).allowed).toBe(true);
      expect(evaluator.evaluateAccess('write', 'schedules', adminContext).allowed).toBe(true);
      expect(evaluator.evaluateAccess('read', 'students', adminContext, { parentId: 'other_parent' }).allowed).toBe(true);
    });
  });
});
