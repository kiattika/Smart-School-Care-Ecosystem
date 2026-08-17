import { cn } from "./lib/utils";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TeacherPortal } from './TeacherPortal';
import { ParentPortal } from './ParentPortal';
import { AdvisorPortal } from './AdvisorPortal';
import { ExecutivePortal } from './ExecutivePortal';
import { StudentPortal } from './StudentPortal';
import { AdminPortal } from './AdminPortal';
import { LoginPage } from './LoginPage';
import { LogOut } from 'lucide-react';
import { useStore } from './store';
import { NavbarWithRoleSwitcher } from './components/NavbarWithRoleSwitcher';
import { UserRole, Role } from './types';

export default function App() {
  const { user, setUser } = useStore();

  if (!user) {
    return <LoginPage />;
  }

  const handleLogout = () => {
    setUser(null);
  };

  const handleRoleChange = (role: UserRole) => {
    if (user && user.profile) {
      // จับคู่ UserRole ของระบบใหม่ เข้ากับ Legacy Portal Role ของตัวจำลองที่มีอยู่
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
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-full text-xs font-medium transition-colors backdrop-blur-md shadow-lg"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out (ออกจากระบบ)
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={user.role}
            initial={{ opacity: 0, y: 15, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.99 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex-1 flex flex-col"
          >
            {user.role === 'teacher' ? (
              <TeacherPortal />
            ) : user.role === 'advisor' ? (
              <AdvisorPortal />
            ) : user.role === 'executive' ? (
              <ExecutivePortal />
            ) : user.role === 'student' ? (
              <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <StudentPortal />
              </div>
            ) : user.role === 'admin' ? (
              <AdminPortal />
            ) : (
              <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <ParentPortal />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
