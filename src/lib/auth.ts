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
 * Sign in using email and password against Firebase Auth / Emulator
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const fbUser = result.user;
  const appUser = await buildAppUser(fbUser);
  return appUser;
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
