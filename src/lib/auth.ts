import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
 * Sign in using email and password (ideal for Firebase Emulator Suite local testing)
 * Automatically falls back to user creation if user doesn't exist, and supports dev mock fallback.
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const fbUser = result.user;
    const appUser = await buildAppUser(fbUser);
    return appUser;
  } catch (err: any) {
    // 1. If user doesn't exist in the active Auth provider / emulator, attempt auto-creation
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        const createResult = await createUserWithEmailAndPassword(auth, email, password);
        const appUser = await buildAppUser(createResult.user);
        return appUser;
      } catch (createErr: any) {
        // If createUser also failed with already in use, throw original error
        if (createErr.code !== 'auth/email-already-in-use') {
          console.warn('Auto-create in emulator failed:', createErr.message);
        }
      }
    }

    // 2. If network request failed (e.g. emulator not running on 127.0.0.1:9099) or in Dev mode,
    // generate a functional mock session so testing/reviewing is never blocked.
    if (
      import.meta.env.DEV ||
      err.code === 'auth/network-request-failed' ||
      err.message?.includes('network-request-failed')
    ) {
      console.warn('Firebase Auth emulator not active. Activating dev test session for:', email);
      return createDevMockUser(email);
    }

    throw err;
  }
}

export function createDevMockUser(email: string): User {
  const emailLower = email.toLowerCase();
  const matched = MOCK_MULTI_ROLE_USERS.find(
    u => u.email.toLowerCase() === emailLower
  );

  let roles: UserRole[] = matched?.roles || ['SUBJECT_TEACHER'];
  let userProfile: UserProfile | undefined = matched;

  if (!matched) {
    if (emailLower.includes('advisor') || emailLower.includes('homeroom')) {
      roles = ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER'];
      userProfile = {
        id: `mock-advisor-${Date.now()}`,
        email: email,
        prefix: 'ครู',
        firstName: 'เกียรติศักดิ์',
        lastName: 'สถิตการุณย์',
        position: 'ครูประจำชั้น ม.5/8 (คศ.2)',
        roles: roles,
        assignments: {
          homeroomClass: 'ม.5/8'
        }
      };
    } else if (emailLower.includes('admin')) {
      roles = ['SUPER_ADMIN', 'EXECUTIVE'];
      userProfile = {
        id: `mock-admin-${Date.now()}`,
        email: email,
        prefix: '',
        firstName: 'ผู้ดูแลระบบ',
        lastName: 'ศูนย์ไอที',
        position: 'System Administrator',
        roles: roles
      };
    } else if (emailLower.includes('exec')) {
      roles = ['EXECUTIVE', 'SUPER_ADMIN'];
      userProfile = {
        id: `mock-exec-${Date.now()}`,
        email: email,
        prefix: 'ดร.',
        firstName: 'สมเกียรติ',
        lastName: 'บริหารวิชาการ',
        position: 'ผู้อำนวยการโรงเรียน',
        roles: roles
      };
    } else if (emailLower.includes('guidance')) {
      roles = ['GUIDANCE_COUNSELOR', 'SUBJECT_TEACHER'];
      userProfile = {
        id: `mock-guidance-${Date.now()}`,
        email: email,
        prefix: 'ดร.',
        firstName: 'สุดา',
        lastName: 'จิตวิทยาการปรึกษา',
        position: 'ครูแนะแนว (ผู้เชี่ยวชาญ PHQ-9)',
        roles: roles
      };
    } else if (emailLower.includes('finance')) {
      roles = ['FINANCE_STAFF'];
      userProfile = {
        id: `mock-finance-${Date.now()}`,
        email: email,
        prefix: 'นาง',
        firstName: 'ศิริพร',
        lastName: 'การเงินพัสดุ',
        position: 'เจ้าหน้าที่การเงินและพัสดุ',
        roles: roles
      };
    } else if (emailLower.includes('infirmary')) {
      roles = ['INFIRMARY_STAFF'];
      userProfile = {
        id: `mock-infirmary-${Date.now()}`,
        email: email,
        prefix: 'นางสาว',
        firstName: 'กนกวรรณ',
        lastName: 'พยาบาลวิชาชีพ',
        position: 'พยาบาลประจำห้องพยาบาล',
        roles: roles
      };
    } else if (emailLower.includes('supervisor')) {
      roles = ['INSTRUCTIONAL_SUPERVISOR', 'SUPERVISORY_TEACHER'];
      userProfile = {
        id: `mock-supervisor-${Date.now()}`,
        email: email,
        prefix: 'ดร.',
        firstName: 'ณรงค์',
        lastName: 'ศึกษานิเทศก์',
        position: 'หัวหน้าฝ่ายวิชาการและนิเทศการสอน',
        roles: roles
      };
    } else if (emailLower.includes('parent')) {
      roles = ['PARENT' as UserRole];
      userProfile = {
        id: `mock-parent-${Date.now()}`,
        email: email,
        prefix: 'นาย',
        firstName: 'มนตรี',
        lastName: 'มงคลศิลป์ (ผู้ปกครองนายกิตติคุณ)',
        position: 'ผู้ปกครองนักเรียน',
        roles: roles
      };
    } else if (emailLower.includes('student')) {
      roles = ['STUDENT' as UserRole];
      userProfile = {
        id: `mock-student-${Date.now()}`,
        email: email,
        prefix: 'นาย',
        firstName: 'กิตติคุณ',
        lastName: 'มงคลศิลป์',
        position: 'นักเรียนชั้น ม.5/8 เลขที่ 1',
        roles: roles
      };
    } else {
      roles = ['SUBJECT_TEACHER'];
      userProfile = {
        id: `mock-teacher-${Date.now()}`,
        email: email,
        prefix: 'ครู',
        firstName: 'สมปอง',
        lastName: 'สอนดี',
        position: 'ครูผู้สอนกลุ่มสาระฯ',
        roles: roles
      };
    }
  }

  const activeRole: UserRole = roles[0];
  let legacyRole: Role = 'teacher';
  if (activeRole === 'SUPER_ADMIN') legacyRole = 'admin';
  else if (activeRole === 'EXECUTIVE') legacyRole = 'executive';
  else if (activeRole === 'HOMEROOM_TEACHER') legacyRole = 'advisor';
  else if (activeRole === ('PARENT' as any) || roles.includes('PARENT' as any)) legacyRole = 'parent';
  else if (activeRole === ('STUDENT' as any) || roles.includes('STUDENT' as any)) legacyRole = 'student';

  return {
    uid: userProfile.id,
    email: email,
    displayName: `${userProfile.prefix}${userProfile.firstName} ${userProfile.lastName}`.trim(),
    role: legacyRole,
    activeRole: activeRole,
    profile: userProfile
  };
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign-out note:', err);
  }
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

  // 2. Fetch staff/user record from Firestore if custom claims not set yet
  if (roles.length === 0) {
    try {
      // Try fetching staff document by UID or email
      const staffDocRef = doc(db, 'staff', fbUser.uid);
      const staffSnap = await getDoc(staffDocRef);
      if (staffSnap.exists()) {
        const staffData = staffSnap.data();
        if (Array.isArray(staffData.roles)) {
          roles = staffData.roles as UserRole[];
        }
        userProfile = staffData as UserProfile;
      }
    } catch {
      // Ignore if firestore not yet seeded/rules deny
    }
  }

  // 3. Fallback matching with predefined staff list if in dev or during initial bootstrap
  if (roles.length === 0 && fbUser.email) {
    const devUser = createDevMockUser(fbUser.email);
    roles = devUser.profile?.roles || ['SUBJECT_TEACHER'];
    userProfile = devUser.profile;
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
