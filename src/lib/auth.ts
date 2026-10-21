import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  getIdTokenResult
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, UserProfile, UserRole, Role } from '../types';
import { AUTH_NO_PROFILE, AUTH_NO_ROLE } from './authErrors';
import { isExecutiveRole } from './executiveRoles';
import { parentDisplayNameOf, parentRelationshipLabel } from './parentRelationship';

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

/** ผู้ปกครอง: sign in ด้วย custom token ที่ Cloud Function ออกให้หลังยืนยัน LINE + ทะเบียนแล้ว (claims มาจาก token) */
export async function signInWithParentToken(customToken: string): Promise<User> {
  const result = await signInWithCustomToken(auth, customToken);
  return buildAppUser(result.user);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

function legacyRoleFor(activeRole: UserRole, roles: UserRole[]): Role {
  if (activeRole === 'SUPER_ADMIN') return 'admin';
  if (isExecutiveRole(activeRole)) return 'executive';
  if (activeRole === 'HOMEROOM_TEACHER') return 'advisor';
  if (activeRole === 'PARENT' || roles.includes('PARENT')) return 'parent';
  if (activeRole === 'STUDENT' || roles.includes('STUDENT')) return 'student';
  return 'teacher';
}

/**
 * ป้ายใต้ชื่อของผู้ปกครอง = บิดา/มารดา/ผู้ปกครอง ตาม Relationship ที่นำเข้าจากไฟล์ผู้ปกครอง
 * (คัดลอกลง students.parentRelationship ตอนเชื่อมบัญชี — parent_verification_records อ่านไม่ได้จาก client)
 * query ด้วย parentUid ตรง rules; อ่านไม่ได้/ไม่มีค่า = "ผู้ปกครอง" (ไม่ทำให้ login ล้ม)
 */
async function parentRegistryInfo(uid: string): Promise<{ position: string; name: string }> {
  try {
    const snap = await getDocs(query(collection(db, 'students'), where('parentUid', '==', uid), limit(1)));
    const data = snap.docs[0]?.data();
    // name = ชื่อตามทะเบียน (students.parentDisplayName) — ไม่มี = '' แล้วใช้ชื่อบัญชี LINE ตามเดิม
    return { position: parentRelationshipLabel(data?.parentRelationship), name: parentDisplayNameOf(data?.parentDisplayName) };
  } catch (err) {
    console.warn('[auth] อ่านข้อมูลผู้ปกครองจากทะเบียนไม่ได้', err);
    return { position: parentRelationshipLabel(undefined), name: '' };
  }
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
    const parentInfo = !roles.includes('STUDENT') && roles.includes('PARENT') ? await parentRegistryInfo(fbUser.uid) : null;
    // ผู้ปกครอง: ชื่อตามทะเบียนก่อน (ถ้าโรงเรียนตั้งไว้) ไม่งั้นชื่อโปรไฟล์ LINE; ไม่มีทั้งสอง = อีเมล/ว่าง (ไม่แต่งชื่อ)
    const fullName = (parentInfo?.name || fbUser.displayName || '').trim();
    userProfile = {
      id: studentId || fbUser.uid,
      email: fbUser.email || '',
      prefix: '',
      firstName: fullName.split(' ')[0] || fbUser.email || '',
      lastName: fullName.split(' ').slice(1).join(' ') || '',
      position: roles.includes('STUDENT') ? 'นักเรียน' : parentInfo ? parentInfo.position : '',
      roles,
    };
  }

  const activeRole: UserRole = roles[0];
  return {
    uid: fbUser.uid,
    email: fbUser.email || '',
    displayName: staffId ? (fbUser.displayName || `${userProfile.prefix || ''}${userProfile.firstName} ${userProfile.lastName}`.trim())
      : `${userProfile.prefix || ''}${userProfile.firstName} ${userProfile.lastName}`.trim() || fbUser.displayName || '',
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
