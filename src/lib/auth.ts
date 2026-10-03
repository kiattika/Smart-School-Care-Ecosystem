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
import { User, UserProfile, UserRole, Role } from '../types';
import { AUTH_NO_PROFILE, AUTH_NO_ROLE } from './authErrors';

const googleProvider = new GoogleAuthProvider();
// hd = แค่ hint ให้หน้าเลือกบัญชีของ Google (UX) — การบังคับโดเมน/ทะเบียนจริงอยู่ที่
// blocking functions (functions/src/authBlocking.ts) ฝั่งเซิร์ฟเวอร์
googleProvider.setCustomParameters({
  hd: 'utd.ac.th',
  prompt: 'select_account'
});

/**
 * เข้าสู่ระบบด้วย Google — บัญชีที่ไม่ใช่ @utd.ac.th หรือไม่อยู่ใน staff/students ถูกปฏิเสธ
 * ตั้งแต่ฝั่งเซิร์ฟเวอร์ (signInWithPopup throw พร้อมข้อความจาก blocking function — ดู authErrors.ts)
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return buildAppUser(result.user);
}

/**
 * Email/password — ใช้กับบัญชีทดสอบใน Firebase Emulator (ปุ่มบน LoginPage gate ด้วย DEV)
 * ล้มเหลว = throw ตรงๆ ไม่มี fallback ปลอม session
 */
export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return buildAppUser(result.user);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

function legacyRoleFor(activeRole: UserRole, roles: UserRole[]): Role {
  if (activeRole === 'SUPER_ADMIN') return 'admin';
  if (activeRole === 'EXECUTIVE') return 'executive';
  if (activeRole === 'HOMEROOM_TEACHER') return 'advisor';
  if (activeRole === 'PARENT' || roles.includes('PARENT')) return 'parent';
  if (activeRole === 'STUDENT' || roles.includes('STUDENT')) return 'student';
  return 'teacher';
}

/**
 * สร้าง app user จาก custom claims เท่านั้น (ออกโดย blocking functions / assignUserRole)
 * - roles: claims.roles — ไม่มี = signOut แล้ว throw AUTH_NO_ROLE (ไม่มี default role, ไม่เดาจากอีเมล)
 * - บุคลากร: profile จาก staff/{claims.staffId} (doc id = teacherId จากไฟล์ import ไม่ใช่ Auth UID)
 *   ซึ่งเป็นแหล่งเดียวของ assignments.homeroomClass / departmentId
 * - นักเรียน: claims.studentId (portal อ่าน students สดผ่าน useRealStudents เอง)
 */
export async function buildAppUser(fbUser: FirebaseUser): Promise<User> {
  // force refresh — ให้ได้ claims ล่าสุดเสมอ; ถ้าดึง token ไม่ได้ให้ error ขึ้นไปตรงๆ
  const { claims } = await getIdTokenResult(fbUser, true);

  const roles: UserRole[] = Array.isArray(claims.roles)
    ? (claims.roles as unknown[]).filter((r): r is UserRole => typeof r === 'string' && r !== '')
    : [];
  if (roles.length === 0) {
    await signOut(auth);
    throw new Error(`${AUTH_NO_ROLE}: บัญชีนี้ไม่มีบทบาทในระบบ`);
  }

  const staffId = typeof claims.staffId === 'string' && claims.staffId ? claims.staffId : undefined;
  const studentId = typeof claims.studentId === 'string' && claims.studentId ? claims.studentId : undefined;

  let userProfile: UserProfile;
  if (staffId) {
    const staffSnap = await getDoc(doc(db, 'staff', staffId));
    if (!staffSnap.exists()) {
      await signOut(auth);
      throw new Error(`${AUTH_NO_PROFILE}: staff/${staffId} ไม่พบ`);
    }
    // roles ใน profile ต้องตาม claims (ตัวที่ rules ใช้จริง) ไม่ใช่ staff.roles ที่อาจยังไม่ sync
    userProfile = { ...(staffSnap.data() as UserProfile), id: staffId, roles };
  } else {
    // นักเรียน (และผู้ปกครองในอนาคต) ไม่มี staff doc — profile จากตัวตน Firebase Auth จริง
    userProfile = {
      id: studentId || fbUser.uid,
      email: fbUser.email || '',
      prefix: '',
      firstName: fbUser.displayName?.split(' ')[0] || fbUser.email || '',
      lastName: fbUser.displayName?.split(' ').slice(1).join(' ') || '',
      position: roles.includes('STUDENT') ? 'นักเรียน' : '',
      roles,
    };
  }

  const activeRole: UserRole = roles[0];
  return {
    uid: fbUser.uid,
    email: fbUser.email || '',
    displayName: fbUser.displayName || `${userProfile.prefix || ''}${userProfile.firstName} ${userProfile.lastName}`.trim(),
    avatar: fbUser.photoURL || undefined,
    role: legacyRoleFor(activeRole, roles),
    activeRole,
    profile: userProfile,
    staffId,
    studentId,
  };
}

/**
 * onError: ให้หน้า Login แสดงเหตุผลเมื่อ session ที่ค้างอยู่ใช้ต่อไม่ได้ (เช่น ถูกถอนบทบาท)
 */
export function setupAuthListener(onUserChanged: (user: User | null) => void, onError?: (err: unknown) => void) {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      try {
        const appUser = await buildAppUser(fbUser);
        onUserChanged(appUser);
      } catch (err) {
        console.error('Error building authenticated user:', err);
        onError?.(err);
        onUserChanged(null);
      }
    } else {
      onUserChanged(null);
    }
  });
}
