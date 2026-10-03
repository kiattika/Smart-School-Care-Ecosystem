import { cn } from "./lib/utils";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TeacherPortal } from './TeacherPortal';
import { ParentPortal } from './ParentPortal';
import { AdvisorPortal } from './AdvisorPortal';
import { ExecutivePortal } from './ExecutivePortal';
import { StudentPortal } from './StudentPortal';
import { AdminPortal } from './AdminPortal';
import { InfirmaryPortal } from './components/infirmary/InfirmaryPortal';
import { GuidancePortal } from './components/guidance/GuidancePortal';
import { FinancePortal } from './components/finance/FinancePortal';
import { SupervisionPortal } from './components/supervision/SupervisionPortal';
import { ApprovalsPortal } from './ApprovalsPortal';
import { LoginPage } from './LoginPage';
import { LogOut, Loader2 } from 'lucide-react';
import { useStore } from './store';
import { NavbarWithRoleSwitcher } from './components/NavbarWithRoleSwitcher';
import { QuickActionHub } from './components/QuickActionHub';
import { UserRole, Role } from './types';
import { setupAuthListener, signOutUser } from './lib/auth';
import { describeAuthError } from './lib/authErrors';
import { useSubstituteSync } from './hooks/useSubstituteSync';
import { useAppClock } from './hooks/useAppClock';

export default function App() {
  const { user, setUser } = useStore();
  const [authInitializing, setAuthInitializing] = useState(true);
  // เหตุผลที่ session ค้างใช้ต่อไม่ได้ (เช่น ถูกถอนบทบาท → AUTH_NO_ROLE) — แสดงบนหน้า Login
  const [sessionError, setSessionError] = useState<string | null>(null);

  // เชื่อม Firestore real-time (staff / substitute_assignments / post_teaching_records) เข้ากับ store
  useSubstituteSync(!!user);

  // นาฬิกาของแอป (store.currentDate) เดินตามเวลาจริง — ทุก 30 วินาที + ทันทีเมื่อกลับมาที่แท็บ
  useAppClock();

  useEffect(() => {
    const unsubscribe = setupAuthListener((firebaseAppUser) => {
      // Firebase Auth คือแหล่งความจริงของ session — sign-out (null) ต้องล้าง store ด้วย
      // (เดิมข้าม null ไป → หลัง signOutUser() ตอนแก้สิทธิ์ตัวเอง, token ถูก revoke, หรือ
      // buildAppUser ล้ม UI ยังค้างอยู่ใน portal เดิมทั้งที่ Firebase ออกจากระบบแล้ว และทุก write ถูก deny)
      setUser(firebaseAppUser);
      if (firebaseAppUser) setSessionError(null);
      setAuthInitializing(false);
    }, (err) => setSessionError(describeAuthError(err)));

    return () => unsubscribe();
  }, [setUser]);

  if (authInitializing && !user) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center text-slate-300">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm font-medium">กำลังตรวจสอบข้อมูลการเข้าสู่ระบบ...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage initialError={sessionError} />;
  }

  const handleLogout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('Sign-out error:', err);
    } finally {
      setUser(null);
    }
  };

  const handleRoleChange = (role: UserRole) => {
    // Only allow switching to a role that actually exists in the user's verified profile roles
    if (user && user.profile) {
      const allowedRoles = user.profile.roles || [];
      if (!allowedRoles.includes(role) && !import.meta.env.DEV) {
        console.warn(`Unauthorized role switch attempt: ${role} not in [${allowedRoles.join(', ')}]`);
        return;
      }

      let legacyRole: Role = 'teacher';
      if (role === 'SUPER_ADMIN') {
        legacyRole = 'admin';
      } else if (role === 'EXECUTIVE') {
        legacyRole = 'executive';
      } else if (role === 'HOMEROOM_TEACHER') {
        legacyRole = 'advisor';
      } else {
        legacyRole = 'teacher';
      }

      setUser({
        ...user,
        activeRole: role,
        role: legacyRole,
      });
    }
  };

  const showNavbar = user.profile && user.activeRole;

  return (
    <div className="relative min-h-screen bg-slate-900 font-sans flex flex-col">
      {showNavbar ? (
        <NavbarWithRoleSwitcher
          user={user.profile!}
          activeRole={user.activeRole!}
          onRoleChange={handleRoleChange}
          onLogout={handleLogout}
        />
      ) : (
        <div className="fixed top-4 right-4 z-[100]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-full text-xs font-medium transition-colors backdrop-blur-md shadow-lg cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out (ออกจากระบบ)
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={user.activeRole || user.role}
            initial={{ opacity: 0, y: 15, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.99 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex-1 flex flex-col"
          >
            {user.activeRole === 'FINANCE_STAFF' ? (
              <FinancePortal />
            ) : user.activeRole === 'INSTRUCTIONAL_SUPERVISOR' ? (
              <SupervisionPortal />
            ) : user.activeRole === 'INFIRMARY_STAFF' ? (
              <InfirmaryPortal />
            ) : user.activeRole === 'GUIDANCE_COUNSELOR' ? (
              <GuidancePortal />
            ) : (['HEAD_OF_DEPARTMENT', 'ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC', 'DIRECTOR'] as const).includes(user.activeRole as any) ? (
              // role ระดับบริหารที่ทำหน้าที่อนุมัติ (สอนแทน 4 ขั้น + เช็คชื่อย้อนหลัง) — เดิมตกไป TeacherPortal
              <ApprovalsPortal />
            ) : user.role === 'teacher' ? (
              <TeacherPortal />
            ) : user.role === 'advisor' ? (
              <AdvisorPortal />
            ) : user.role === 'executive' ? (
              <ExecutivePortal />
            ) : user.role === 'student' ? (
              <div className="min-h-[100dvh] w-full bg-slate-950 sm:bg-slate-900 flex items-center justify-center p-0 sm:p-4">
                <StudentPortal />
              </div>
            ) : user.role === 'admin' ? (
              <AdminPortal />
            ) : user.role === 'parent' && (user.profile?.roles || []).includes('PARENT') ? (
              <div className="min-h-[100dvh] w-full bg-slate-950 sm:bg-slate-900 flex items-center justify-center p-0 sm:p-4">
                <ParentPortal />
              </div>
            ) : (
              // เดิมทุกกรณีที่ไม่เข้าเงื่อนไขข้างบนตกไป ParentPortal — ตอนนี้ต้องมีบทบาท PARENT จริงเท่านั้น
              <NoAccessScreen onLogout={handleLogout} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Quick Action Navigation & GPS Hub */}
      <QuickActionHub />
    </div>
  );
}

/** บทบาทใน claims ไม่ตรงกับ portal ใดเลย — ไม่เดา portal ให้ (เดิมตกไป ParentPortal) */
function NoAccessScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-[100dvh] w-full bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-[#151921] border border-white/10 rounded-2xl p-6 w-full max-w-md text-center space-y-4">
        <h1 className="text-lg font-bold text-white">ไม่มีสิทธิ์เข้าใช้งาน</h1>
        <p className="text-sm text-slate-400">
          บทบาทของบัญชีนี้ยังไม่มีหน้าใช้งานในระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบสิทธิ์
        </p>
        <button
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-full text-xs font-medium cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
