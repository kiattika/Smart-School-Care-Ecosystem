import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  getIdTokenResult
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, UserProfile, UserRole, Role, MOCK_MULTI_ROLE_USERS } from '../types';

const googleProvider = new GoogleAuthProvider();
// Restrict to Uttaradit School Google Workspace domain
googleProvider.setCustomParameters({
  hd: 'utd.ac.th',
  prompt: 'select_account'
});

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  const fbUser = result.user;

  if (!fbUser.email) {
    await signOut(auth);
    throw new Error('AUTH_NO_EMAIL: Email address is required.');
  }

  // Client-side domain UX verification (Real server-side enforcement handled via Rules & Cloud Functions)
  const isSchoolDomain = fbUser.email.endsWith('@utd.ac.th') || fbUser.email.endsWith('@school.ac.th');
  if (!isSchoolDomain && !import.meta.env.DEV) {
    await signOut(auth);
    throw new Error('AUTH_DOMAIN_RESTRICTED: กรุณาใช้อีเมล Google Workspace ของโรงเรียน (@utd.ac.th) เท่านั้น');
  }

  const appUser = await buildAppUser(fbUser);
  return appUser;
}

/**
 * Sign in using email and password against Firebase Auth / Emulator,
 * with resilient development fallback for testing all school roles.
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const fbUser = result.user;
    const appUser = await buildAppUser(fbUser);
    return appUser;
  } catch (err: any) {
    // In dev mode / sandbox environments without active Firebase emulator or seeded Auth accounts,
    // fallback gracefully to generating the corresponding dev user profile so role switching works immediately.
    if (import.meta.env.DEV) {
      console.warn('Firebase email/password sign-in unavailable or unseeded. Falling back to Dev Account Profile for:', email);
      return buildDevUserFromEmail(email);
    }
    throw err;
  }
}

/**
 * Builds a local dev user profile based on email and role mappings for seamless testing
 */
export function buildDevUserFromEmail(email: string): User {
  const lower = email.toLowerCase().trim();
  
  // Check if predefined in mock multi-role users
  const matched = MOCK_MULTI_ROLE_USERS.find(
    u => u.email.toLowerCase() === lower
  );

  let roles: UserRole[] = [];
  let userProfile: UserProfile | undefined = matched;
  let displayName = '';

  if (matched) {
    roles = matched.roles;
    displayName = `${matched.prefix || ''}${matched.firstName} ${matched.lastName}`.trim();
  } else if (lower.includes('kiattika') || lower.startsWith('admin.') || lower.includes('super_admin')) {
    roles = ['SUPER_ADMIN', 'SUBJECT_TEACHER'];
    displayName = lower.includes('kiattika') ? 'นายเกียรติศักดิ์ แก้วหล้า' : 'ผู้ดูแลระบบ (Admin)';
  } else if (lower.startsWith('exec.') || lower.includes('executive') || lower.includes('director')) {
    roles = ['EXECUTIVE', 'SUPER_ADMIN'];
    displayName = 'ดร.สมเกียรติ บริหารวิชาการ (ผู้อำนวยการโรงเรียน)';
  } else if (lower.startsWith('advisor.') || lower.includes('advisor') || lower.includes('homeroom')) {
    roles = ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER'];
    displayName = 'ครูเกียรติศักดิ์ สถิตการุณย์ (ครูประจำชั้น ม.5/8)';
  } else if (lower.startsWith('guidance.') || lower.includes('guidance') || lower.includes('counselor')) {
    roles = ['GUIDANCE_COUNSELOR', 'SUBJECT_TEACHER'];
    displayName = 'ดร.สุดา จิตวิทยา (ครูแนะแนว/ให้คำปรึกษา)';
  } else if (lower.startsWith('infirmary.') || lower.startsWith('nurse.') || lower.includes('nurse')) {
    roles = ['INFIRMARY_STAFF'];
    displayName = 'น.ส.กนกวรรณ พยาบาล (งานพยาบาล)';
  } else if (lower.startsWith('finance.') || lower.includes('finance')) {
    roles = ['FINANCE_STAFF'];
    displayName = 'นางศิริพร การเงินพัสดุ (ฝ่ายการเงิน)';
  } else if (lower.startsWith('supervisor.')) {
    roles = ['INSTRUCTIONAL_SUPERVISOR', 'SUPERVISORY_TEACHER'];
    displayName = 'ดร.ณรงค์ วิชาการ (ศึกษานิเทศก์)';
  } else if (lower.startsWith('parent.') || lower.includes('parent')) {
    roles = ['PARENT' as UserRole];
    displayName = 'คุณพ่อมนตรี มงคลศิลป์ (ผู้ปกครอง)';
  } else if (lower.startsWith('student.') || lower.includes('student')) {
    roles = ['STUDENT' as UserRole];
    displayName = 'นายกิตติคุณ มงคลศิลป์ (นักเรียน ม.5/8)';
  } else {
    roles = ['SUBJECT_TEACHER'];
    displayName = 'ครูสมปอง สอนดี';
  }

  const activeRole: UserRole = roles[0];
  let legacyRole: Role = 'teacher';
  if (activeRole === 'SUPER_ADMIN') legacyRole = 'admin';
  else if (activeRole === 'EXECUTIVE') legacyRole = 'executive';
  else if (activeRole === 'HOMEROOM_TEACHER') legacyRole = 'advisor';
  else if (activeRole === ('PARENT' as any) || roles.includes('PARENT' as any)) legacyRole = 'parent';
  else if (activeRole === ('STUDENT' as any) || roles.includes('STUDENT' as any)) legacyRole = 'student';

  if (!userProfile) {
    userProfile = {
      id: `dev-${lower.replace(/[^a-z0-9]/g, '-')}`,
      email: email,
      prefix: '',
      firstName: displayName.split(' ')[0] || 'User',
      lastName: displayName.split(' ').slice(1).join(' ') || '',
      position: 'บุคลากรทางการศึกษา',
      roles: roles,
      assignments: {
        homeroomClass: lower.includes('advisor') || lower.includes('5/8') ? 'M.5/8' : undefined,
        departmentId: lower.includes('math') ? 'math-dept' : undefined
      }
    };
  }

  return {
    uid: `dev-${lower.replace(/[^a-z0-9]/g, '-')}`,
    email: email,
    displayName: displayName || userProfile.firstName,
    role: legacyRole,
    activeRole: activeRole,
    profile: userProfile
  };
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Builds the application user object with verified roles either from custom claims
 * or staff/users collection in Firestore, falling back safely.
 */
export async function buildAppUser(fbUser: FirebaseUser): Promise<User> {
  let claims: Record<string, any> = {};
  try {
    const tokenResult = await getIdTokenResult(fbUser, true);
    claims = tokenResult.claims || {};
  } catch {
    // Emulator or offline mode may not return claims
  }

  let roles: UserRole[] = [];
  let userProfile: UserProfile | undefined = undefined;

  // 1. Check custom claims for roles
  if (Array.isArray(claims.roles) && claims.roles.length > 0) {
    roles = claims.roles as UserRole[];
  } else if (typeof claims.role === 'string') {
    roles = [claims.role as UserRole];
  } else if (typeof claims.primaryRole === 'string') {
    roles = [claims.primaryRole as UserRole];
  }

  // 2. Fetch staff/user record from Firestore — ต้องทำเสมอ (ไม่ใช่เฉพาะตอน claims ว่าง)
  //    เพราะ staff doc คือแหล่งเดียวของ `assignments.homeroomClass` / `departmentId`
  //    ที่ AdvisorPortal ใช้หาห้องประจำชั้น — ถ้าข้ามขั้นนี้ ครูที่ปรึกษาจะได้ "No Room"
  try {
    const staffDocRef = doc(db, 'staff', fbUser.uid);
    const staffSnap = await getDoc(staffDocRef);
    if (staffSnap.exists()) {
      const staffData = staffSnap.data();
      if (roles.length === 0 && Array.isArray(staffData.roles)) {
        roles = staffData.roles as UserRole[];
      }
      userProfile = staffData as UserProfile;
    }
  } catch {
    // Ignore if firestore not yet seeded/rules deny
  }

  // 3. Fallback matching with predefined staff list if in dev or during initial bootstrap
  if (roles.length === 0 && fbUser.email) {
    const matched = MOCK_MULTI_ROLE_USERS.find(
      u => u.email.toLowerCase() === fbUser.email?.toLowerCase()
    );
    if (matched) {
      roles = matched.roles;
      userProfile = matched;
    } else if (fbUser.email.toLowerCase().includes('parent')) {
      roles = ['PARENT' as UserRole];
    } else if (fbUser.email.toLowerCase().includes('student')) {
      roles = ['STUDENT' as UserRole];
    }
  }

  // Default fallback role if no roles assigned
  if (roles.length === 0) {
    roles = ['SUBJECT_TEACHER'];
  }

  const activeRole: UserRole = roles[0];
  let legacyRole: Role = 'teacher';
  if (activeRole === 'SUPER_ADMIN') legacyRole = 'admin';
  else if (activeRole === 'EXECUTIVE') legacyRole = 'executive';
  else if (activeRole === 'HOMEROOM_TEACHER') legacyRole = 'advisor';
  else if (activeRole === ('PARENT' as any) || roles.includes('PARENT' as any)) legacyRole = 'parent';
  else if (activeRole === ('STUDENT' as any) || roles.includes('STUDENT' as any)) legacyRole = 'student';

  if (!userProfile) {
    userProfile = {
      id: fbUser.uid,
      email: fbUser.email || '',
      prefix: '',
      firstName: fbUser.displayName?.split(' ')[0] || 'User',
      lastName: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
      position: 'บุคลากรทางการศึกษา',
      roles: roles
    };
  }

  return {
    uid: fbUser.uid,
    email: fbUser.email || '',
    displayName: fbUser.displayName || `${userProfile.prefix}${userProfile.firstName} ${userProfile.lastName}`.trim(),
    avatar: fbUser.photoURL || undefined,
    role: legacyRole,
    activeRole: activeRole,
    profile: userProfile
  };
}

export function setupAuthListener(onUserChanged: (user: User | null) => void) {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      try {
        const appUser = await buildAppUser(fbUser);
        onUserChanged(appUser);
      } catch (err) {
        console.error('Error building authenticated user:', err);
        onUserChanged(null);
      }
    } else {
      onUserChanged(null);
    }
  });
}
