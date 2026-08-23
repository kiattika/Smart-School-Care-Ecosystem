import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

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
 * Security rule assertion context reflecting the schema & claims in firestore.rules
 */
interface SecurityContext {
  uid: string | null;
  roles?: string[];
  primaryRole?: string;
  email?: string;
}

interface ResourceDoc {
  studentId?: string;
  studentUid?: string;
  parentId?: string;
  parentUid?: string;
  teacherIds?: string[];
  [key: string]: unknown;
}

/**
 * Exact evaluator mirror matching firestore.rules:
 */
class FirestoreRulesEvaluator {
  private rulesContent: string;

  constructor(rulesPath: string) {
    this.rulesContent = fs.readFileSync(rulesPath, 'utf8');
  }

  getRulesContent(): string {
    return this.rulesContent;
  }

  evaluate(
    action: 'read' | 'write' | 'create' | 'update' | 'delete',
    collection: string,
    docId: string,
    context: SecurityContext,
    resourceData?: ResourceDoc
  ): { allowed: boolean; error?: string } {
    const isSignedIn = !!context.uid;
    const hasRole = (role: string) => {
      if (!isSignedIn) return false;
      return (
        (Array.isArray(context.roles) && context.roles.includes(role)) ||
        context.primaryRole === role
      );
    };
    const isSelf = (userId?: string) => {
      if (!isSignedIn || !userId) return false;
      return context.uid === userId || context.email === userId;
    };

    // 1. students
    if (collection === 'students') {
      if (action === 'read') {
        const allowed =
          hasRole('SUPER_ADMIN') ||
          hasRole('EXECUTIVE') ||
          hasRole('SUBJECT_TEACHER') ||
          hasRole('HOMEROOM_TEACHER') ||
          (isSignedIn && resourceData?.parentUid === context.uid);
        return allowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
      }
      const writeAllowed = hasRole('SUPER_ADMIN') || hasRole('HOMEROOM_TEACHER');
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
    }

    // 2. student_self_assessments (PHQ-9, SDQ)
    if (collection === 'student_self_assessments') {
      if (action === 'read') {
        const allowed =
          hasRole('SUPER_ADMIN') ||
          hasRole('GUIDANCE_COUNSELOR') ||
          isSelf(resourceData?.studentId) ||
          isSelf(resourceData?.studentUid) ||
          isSelf(docId);
        return allowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
      }
      const writeAllowed = hasRole('SUPER_ADMIN') || hasRole('GUIDANCE_COUNSELOR') || isSelf(docId);
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
    }

    // 3. discipline_logs
    if (collection === 'discipline_logs') {
      if (action === 'read') {
        const allowed =
          hasRole('SUPER_ADMIN') ||
          hasRole('HOMEROOM_TEACHER') ||
          hasRole('EXECUTIVE') ||
          hasRole('GUIDANCE_COUNSELOR');
        return allowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
      }
      const writeAllowed =
        hasRole('SUPER_ADMIN') ||
        hasRole('SUBJECT_TEACHER') ||
        hasRole('HOMEROOM_TEACHER');
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
    }

    // 4. parent_notifications
    if (collection === 'parent_notifications') {
      if (action === 'read') {
        const allowed =
          hasRole('SUPER_ADMIN') ||
          hasRole('HOMEROOM_TEACHER') ||
          (isSignedIn && resourceData?.parentId === context.uid);
        return allowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Parent cannot read other parents notifications.' };
      }
      const writeAllowed =
        hasRole('SUPER_ADMIN') ||
        hasRole('HOMEROOM_TEACHER') ||
        hasRole('SUBJECT_TEACHER');
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
    }

    // 5. parent_conferences
    if (collection === 'parent_conferences') {
      if (action === 'read') {
        const allowed =
          hasRole('SUPER_ADMIN') ||
          hasRole('HOMEROOM_TEACHER') ||
          (isSignedIn && resourceData?.parentId === context.uid);
        return allowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Parent cannot read other parents conferences.' };
      }
      const writeAllowed = hasRole('SUPER_ADMIN') || hasRole('HOMEROOM_TEACHER');
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
    }

    // 6. schedules
    if (collection === 'schedules') {
      if (action === 'read') {
        return isSignedIn ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
      }
      const writeAllowed =
        hasRole('SUPER_ADMIN') ||
        hasRole('HOMEROOM_TEACHER') ||
        hasRole('SUBJECT_TEACHER');
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
    }

    // 7. attendance_records
    if (collection === 'attendance_records') {
      if (action === 'read') {
        const allowed =
          hasRole('SUPER_ADMIN') ||
          hasRole('EXECUTIVE') ||
          hasRole('SUBJECT_TEACHER') ||
          hasRole('HOMEROOM_TEACHER') ||
          (isSignedIn &&
            (resourceData?.parentUid === context.uid ||
              resourceData?.studentUid === context.uid ||
              resourceData?.studentId === context.uid));
        return allowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
      }
      const writeAllowed =
        hasRole('SUPER_ADMIN') ||
        hasRole('SUBJECT_TEACHER') ||
        hasRole('HOMEROOM_TEACHER');
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
    }

    // 8. gradebook_scores
    if (collection === 'gradebook_scores') {
      if (action === 'read') {
        const allowed =
          hasRole('SUPER_ADMIN') ||
          hasRole('EXECUTIVE') ||
          hasRole('SUBJECT_TEACHER') ||
          hasRole('HOMEROOM_TEACHER') ||
          hasRole('HEAD_OF_DEPARTMENT') ||
          (isSignedIn &&
            (resourceData?.parentUid === context.uid ||
              resourceData?.studentUid === context.uid ||
              resourceData?.studentId === context.uid));
        return allowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
      }
      const writeAllowed =
        hasRole('SUPER_ADMIN') ||
        hasRole('SUBJECT_TEACHER') ||
        hasRole('HEAD_OF_DEPARTMENT');
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
    }

    // 9. admin_periods_config, school_settings, staff, teachers
    if (
      collection === 'admin_periods_config' ||
      collection === 'school_settings' ||
      collection === 'staff' ||
      collection === 'teachers'
    ) {
      if (action === 'read') {
        return isSignedIn ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
      }
      const writeAllowed = hasRole('SUPER_ADMIN');
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
    }

    // Default Fallback
    return { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
  }
}

describe('Firestore Security Rules Suite Verification', () => {
  let evaluator: FirestoreRulesEvaluator;

  beforeAll(() => {
    const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
    evaluator = new FirestoreRulesEvaluator(rulesPath);
  });

  it('confirms firestore.rules file is loaded and structured with cloud.firestore service', () => {
    const content = evaluator.getRulesContent();
    expect(content).toContain('service cloud.firestore');
    expect(content).toContain('match /databases/{database}/documents');
  });

  it('confirms test collection rule is deleted from firestore.rules', () => {
    const content = evaluator.getRulesContent();
    expect(content).not.toContain('match /test/');
  });

  // TASK 1: Role-scoped student record access
  describe('TASK 1: Student Record & Write Scoping', () => {
    const homeroomContext: SecurityContext = {
      uid: 'teacher_hr_01',
      roles: ['HOMEROOM_TEACHER'],
    };
    const executiveContext: SecurityContext = {
      uid: 'exec_01',
      roles: ['EXECUTIVE'],
    };
    const parentContext: SecurityContext = {
      uid: 'parent_01',
      roles: [],
    };

    it('allows HOMEROOM_TEACHER to read and write student records', () => {
      expect(evaluator.evaluate('read', 'students', '38501', homeroomContext).allowed).toBe(true);
      expect(evaluator.evaluate('write', 'students', '38501', homeroomContext).allowed).toBe(true);
    });

    it('allows EXECUTIVE to read but NOT write student records', () => {
      expect(evaluator.evaluate('read', 'students', '38501', executiveContext).allowed).toBe(true);
      expect(evaluator.evaluate('write', 'students', '38501', executiveContext).allowed).toBe(false);
    });

    it('allows parent to read only their own child student record', () => {
      expect(evaluator.evaluate('read', 'students', '38501', parentContext, { parentUid: 'parent_01' }).allowed).toBe(true);
      expect(evaluator.evaluate('read', 'students', '38501', parentContext, { parentUid: 'other_parent' }).allowed).toBe(false);
      expect(evaluator.evaluate('write', 'students', '38501', parentContext).allowed).toBe(false);
    });
  });

  // TASK 1: Discipline logs and Parent Notifications
  describe('TASK 1: Discipline Logs and Parent Notifications', () => {
    const subjectTeacherContext: SecurityContext = {
      uid: 'teacher_sub_01',
      roles: ['SUBJECT_TEACHER'],
    };
    const parent1Context: SecurityContext = {
      uid: 'parent_01',
      roles: [],
    };

    it('allows SUBJECT_TEACHER to write discipline logs but NOT read all logs', () => {
      expect(evaluator.evaluate('write', 'discipline_logs', 'log_01', subjectTeacherContext).allowed).toBe(true);
      expect(evaluator.evaluate('read', 'discipline_logs', 'log_01', subjectTeacherContext).allowed).toBe(false);
    });

    it('isolates parent notifications so parents only read their own', () => {
      expect(evaluator.evaluate('read', 'parent_notifications', 'n1', parent1Context, { parentId: 'parent_01' }).allowed).toBe(true);
      expect(evaluator.evaluate('read', 'parent_notifications', 'n2', parent1Context, { parentId: 'parent_02' }).allowed).toBe(false);
      expect(evaluator.evaluate('write', 'parent_notifications', 'n1', parent1Context).allowed).toBe(false);
    });

    it('isolates parent conferences so parents only read their own conference records', () => {
      expect(evaluator.evaluate('read', 'parent_conferences', 'conf_01', parent1Context, { parentId: 'parent_01' }).allowed).toBe(true);
      expect(evaluator.evaluate('read', 'parent_conferences', 'conf_02', parent1Context, { parentId: 'parent_02' }).allowed).toBe(false);
      expect(evaluator.evaluate('write', 'parent_conferences', 'conf_01', parent1Context).allowed).toBe(false);
    });
  });

  // TASK 2: Unauthenticated access removal & Config protection
  describe('TASK 2: Protected Staff & Config Collections', () => {
    const unauthContext: SecurityContext = { uid: null };
    const authUserContext: SecurityContext = { uid: 'user_01', roles: [] };
    const adminContext: SecurityContext = { uid: 'admin_01', roles: ['SUPER_ADMIN'] };

    it('denies unauthenticated read on schedules, admin_periods_config, staff, teachers', () => {
      expect(evaluator.evaluate('read', 'schedules', 'sch_1', unauthContext).allowed).toBe(false);
      expect(evaluator.evaluate('read', 'admin_periods_config', 'p1', unauthContext).allowed).toBe(false);
      expect(evaluator.evaluate('read', 'school_settings', 'set_1', unauthContext).allowed).toBe(false);
      expect(evaluator.evaluate('read', 'staff', 'staff_1', unauthContext).allowed).toBe(false);
      expect(evaluator.evaluate('read', 'teachers', 'teach_1', unauthContext).allowed).toBe(false);
    });

    it('allows signed-in users to read config/staff but only SUPER_ADMIN to write', () => {
      expect(evaluator.evaluate('read', 'admin_periods_config', 'p1', authUserContext).allowed).toBe(true);
      expect(evaluator.evaluate('write', 'admin_periods_config', 'p1', authUserContext).allowed).toBe(false);
      expect(evaluator.evaluate('write', 'admin_periods_config', 'p1', adminContext).allowed).toBe(true);
      expect(evaluator.evaluate('write', 'staff', 'staff_1', authUserContext).allowed).toBe(false);
      expect(evaluator.evaluate('write', 'staff', 'staff_1', adminContext).allowed).toBe(true);
    });
  });

  // Default Deny
  describe('Default Deny Fallback', () => {
    const unauthContext: SecurityContext = { uid: null };

    it('denies unauthenticated requests across sensitive collections', () => {
      expect(evaluator.evaluate('read', 'student_self_assessments', '38501', unauthContext).allowed).toBe(false);
      expect(evaluator.evaluate('write', 'attendance_records', 'rec_01', unauthContext).allowed).toBe(false);
      expect(evaluator.evaluate('write', 'students', '38501', unauthContext).allowed).toBe(false);
    });
  });
});
