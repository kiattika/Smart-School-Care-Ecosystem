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
import { LoginPage } from './LoginPage';
import { LogOut, Loader2 } from 'lucide-react';
import { useStore } from './store';
import { NavbarWithRoleSwitcher } from './components/NavbarWithRoleSwitcher';
import { QuickActionHub } from './components/QuickActionHub';
import { UserRole, Role } from './types';
import { setupAuthListener, signOutUser } from './lib/auth';
import { useSubstituteSync } from './hooks/useSubstituteSync';

export default function App() {
  const { user, setUser } = useStore();
  const [authInitializing, setAuthInitializing] = useState(true);

  // เชื่อม Firestore real-time (staff / substitute_assignments / post_teaching_records) เข้ากับ store
  useSubstituteSync(!!user);

  useEffect(() => {
    const unsubscribe = setupAuthListener((firebaseAppUser) => {
      // Only overwrite store if user logged in via Firebase
      if (firebaseAppUser) {
        setUser(firebaseAppUser);
      }
      setAuthInitializing(false);
    });

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
    return <LoginPage />;
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
            ) : (
              <div className="min-h-[100dvh] w-full bg-slate-950 sm:bg-slate-900 flex items-center justify-center p-0 sm:p-4">
                <ParentPortal />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Quick Action Navigation & GPS Hub */}
      <QuickActionHub />
    </div>
  );
}
