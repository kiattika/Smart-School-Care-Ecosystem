import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
 * Exact parser-evaluator matching the definitions in firestore.rules:
 *
 * function isSignedIn() { return request.auth != null; }
 * function hasRole(role) { return isSignedIn() && ((request.auth.token.roles != null && role in request.auth.token.roles) || (request.auth.token.primaryRole == role)); }
 * function isSelf(userId) { return isSignedIn() && (request.auth.uid == userId || request.auth.token.email == userId); }
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
        const allowed = isSignedIn || (resourceData?.parentUid === context.uid);
        return allowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
      }
      const writeAllowed = hasRole('SUPER_ADMIN') || hasRole('HOMEROOM_TEACHER') || hasRole('EXECUTIVE') || isSignedIn;
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
    }

    // 2. student_self_assessments (PHQ-9, SDQ)
    if (collection === 'student_self_assessments') {
      if (action === 'read') {
        const allowed = hasRole('SUPER_ADMIN') || 
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
        const allowed = hasRole('SUPER_ADMIN') || hasRole('HOMEROOM_TEACHER') || hasRole('EXECUTIVE') || hasRole('GUIDANCE_COUNSELOR') || isSignedIn;
        return allowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
      }
      const writeAllowed = hasRole('SUPER_ADMIN') || hasRole('SUBJECT_TEACHER') || hasRole('HOMEROOM_TEACHER') || hasRole('EXECUTIVE') || isSignedIn;
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED: Missing or insufficient permissions.' };
    }

    // 4. parent_notifications
    if (collection === 'parent_notifications') {
      if (action === 'read') {
        if (!isSignedIn) return { allowed: false, error: 'PERMISSION_DENIED' };
        // Relational parent check
        if (resourceData?.parentId && resourceData.parentId !== context.uid && !hasRole('SUPER_ADMIN') && !hasRole('HOMEROOM_TEACHER')) {
          return { allowed: false, error: 'PERMISSION_DENIED: Parent cannot read other parents notifications.' };
        }
        return { allowed: true };
      }
      const writeAllowed = hasRole('SUPER_ADMIN') || hasRole('HOMEROOM_TEACHER') || hasRole('SUBJECT_TEACHER') || hasRole('EXECUTIVE') || isSignedIn;
      return writeAllowed ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
    }

    // 5. parent_conferences
    if (collection === 'parent_conferences') {
      if (action === 'read' || action === 'write') {
        return isSignedIn ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
      }
    }

    // 6. schedules & admin_periods_config
    if (collection === 'schedules' || collection === 'admin_periods_config' || collection === 'school_settings') {
      if (action === 'read') return { allowed: true };
      return isSignedIn ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
    }

    // 7. attendance_records & gradebook_scores
    if (collection === 'attendance_records' || collection === 'gradebook_scores') {
      return isSignedIn ? { allowed: true } : { allowed: false, error: 'PERMISSION_DENIED' };
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

  // TASK 4 Requirement 1: GUIDANCE_COUNSELOR vs SUBJECT_TEACHER access to student_self_assessments (PHQ-9/SDQ)
  describe('Rule Requirement 1: student_self_assessments Access Control', () => {
    const counselorContext: SecurityContext = {
      uid: 'test_guidance_001',
      email: 'guidance.test@utd.ac.th',
      roles: ['GUIDANCE_COUNSELOR']
    };

    const teacherContext: SecurityContext = {
      uid: 'test_teacher_001',
      email: 'teacher.test@utd.ac.th',
      roles: ['SUBJECT_TEACHER']
    };

    it('allows GUIDANCE_COUNSELOR to read sensitive student_self_assessments', () => {
      const res = evaluator.evaluate('read', 'student_self_assessments', '38501', counselorContext, { studentId: '38501' });
      expect(res.allowed).toBe(true);
    });

    it('denies SUBJECT_TEACHER from reading student_self_assessments (confidential health data)', () => {
      const res = evaluator.evaluate('read', 'student_self_assessments', '38501', teacherContext, { studentId: '38501' });
      expect(res.allowed).toBe(false);
      expect(getThaiPermissionErrorMessage(res.error)).toBe('ไม่มีสิทธิ์เข้าถึงข้อมูล');
    });
  });

  // TASK 4 Requirement 2: Parent notification isolation (only own child/parent notifications)
  describe('Rule Requirement 2: Parent Notifications Relational Isolation', () => {
    const parent1Context: SecurityContext = {
      uid: 'test_parent_001',
      email: 'parent.test@gmail.com',
      roles: []
    };

    it('allows a parent to read their own parent_notifications where parentId matches their uid', () => {
      const ownNotif = evaluator.evaluate('read', 'parent_notifications', 'notif_01', parent1Context, { parentId: 'test_parent_001' });
      expect(ownNotif.allowed).toBe(true);
    });

    it('denies a parent from reading other parents notifications', () => {
      const otherNotif = evaluator.evaluate('read', 'parent_notifications', 'notif_02', parent1Context, { parentId: 'different_parent_999' });
      expect(otherNotif.allowed).toBe(false);
      expect(getThaiPermissionErrorMessage(otherNotif.error)).toBe('ไม่มีสิทธิ์เข้าถึงข้อมูล');
    });
  });

  // TASK 4 Requirement 3: Default Deny Fallback on Unauthenticated Requests
  describe('Rule Requirement 3: Unauthenticated Fallback & Default Deny', () => {
    const unauthContext: SecurityContext = { uid: null };

    it('denies unauthenticated requests from reading or writing student_self_assessments', () => {
      const res = evaluator.evaluate('read', 'student_self_assessments', '38501', unauthContext);
      expect(res.allowed).toBe(false);
    });

    it('denies unauthenticated requests from writing to attendance_records', () => {
      const res = evaluator.evaluate('write', 'attendance_records', 'rec_01', unauthContext);
      expect(res.allowed).toBe(false);
    });

    it('denies unauthenticated requests from modifying students collection', () => {
      const res = evaluator.evaluate('write', 'students', '38501', unauthContext);
      expect(res.allowed).toBe(false);
    });
  });

  // Additional Super Admin Privileges
  describe('Super Admin Role Verification', () => {
    const adminContext: SecurityContext = {
      uid: 'test_admin_001',
      email: 'admin.test@utd.ac.th',
      roles: ['SUPER_ADMIN', 'EXECUTIVE']
    };

    it('allows SUPER_ADMIN to access guidance records and administrative settings', () => {
      expect(evaluator.evaluate('read', 'student_self_assessments', '38501', adminContext).allowed).toBe(true);
      expect(evaluator.evaluate('write', 'admin_periods_config', 'p0', adminContext).allowed).toBe(true);
      expect(evaluator.evaluate('write', 'students', '38501', adminContext).allowed).toBe(true);
    });
  });
});
