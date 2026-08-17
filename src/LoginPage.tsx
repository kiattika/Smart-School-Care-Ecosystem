import React from 'react';
import { useStore } from './store';
import { LogIn, User, Shield, Users, Award } from 'lucide-react';
import { User as UserType, Role, UserProfile, MOCK_MULTI_ROLE_USERS, UserRole } from './types';

export function LoginPage() {
  const { setUser } = useStore();

  const handleLogin = (role: Role) => {
    let email = 'user@example.com';
    let displayName = 'User';

    if (role === 'teacher') {
      email = 'kiattisak@utd.ac.th';
      displayName = 'Mr.Kiattisak';
    } else if (role === 'advisor') {
      email = 'kiattisak@utd.ac.th'; // Same email so they have a homeroom assignment
      displayName = 'Mr.Kiattisak (Advisor)';
    } else if (role === 'parent') {
      email = 'parent@example.com';
      displayName = 'ผู้ปกครอง สมชาย';
    } else if (role === 'executive') {
      email = 'exec@utd.ac.th';
      displayName = 'ผู้อำนวยการ';
    } else if (role === 'student') {
      email = 'student@utd.ac.th';
      displayName = 'ด.ช. นักเรียน';
    } else if (role === 'admin') {
      email = 'admin@utd.ac.th';
      displayName = 'Admin';
    }

    const mockUser: UserType = {
      uid: Math.random().toString(36).substring(7),
      role: role,
      email: email,
      displayName: displayName,
    };
    setUser(mockUser);
  };

  const handleMultiRoleLogin = (profile: UserProfile) => {
    // กำหนด Active Role เริ่มต้นเป็นอันแรกในรายการสิทธิ์
    const activeRole = profile.roles[0];
    let legacyRole: Role = 'teacher';
    if (activeRole === 'SUPER_ADMIN') legacyRole = 'admin';
    else if (activeRole === 'EXECUTIVE') legacyRole = 'executive';
    else if (activeRole === 'HOMEROOM_TEACHER') legacyRole = 'advisor';
    else legacyRole = 'teacher';

    const mockUser: UserType = {
      uid: profile.id,
      email: profile.email,
      displayName: `${profile.prefix}${profile.firstName} ${profile.lastName}`,
      role: legacyRole,
      profile: profile,
      activeRole: activeRole
    };
    setUser(mockUser);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="bg-[#151921] border border-white/10 rounded-2xl p-8 max-w-lg w-full shadow-2xl flex flex-col items-center text-center space-y-6">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg">
          <LogIn className="w-8 h-8 text-white" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">Smart School Care</h1>
          <p className="text-slate-400 text-sm">เข้าสู่ระบบเพื่อเข้าใช้งานระบบบริหารจัดการและช่วยเหลือนักเรียน</p>
        </div>

        {/* ระบบเข้าใช้งานหลัก */}
        <div className="w-full space-y-3 pt-2">
          <button 
            onClick={() => handleLogin('teacher')}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-medium py-3 px-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            เข้าสู่ระบบบุคลากรและนักเรียน (@utd.ac.th)
          </button>
          
          <button 
            onClick={() => handleLogin('parent')}
            className="w-full flex items-center justify-center gap-3 bg-[#00B900] hover:bg-[#00A000] text-white font-medium py-3 px-4 rounded-xl transition-all shadow-md active:scale-[0.98]"
          >
            <div className="w-5 h-5 bg-white text-[#00B900] rounded-full flex items-center justify-center font-bold text-xs">
              L
            </div>
            เข้าสู่ระบบสำหรับผู้ปกครอง (LINE)
          </button>
        </div>

        {/* บัญชีทดสอบระบบใหม่ (Multi-role Switcher Accounts) */}
        <div className="w-full pt-5 border-t border-white/10 space-y-3">
          <div className="text-left">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block mb-1">
              Multi-role Switcher Accounts
            </span>
            <p className="text-[11px] text-slate-400">
              ทดสอบบัญชีของบุคลากรที่รับผิดชอบหลายหน้าที่ (สลับสิทธิ์ผ่าน Navbar ได้ทันที)
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 text-left">
            {MOCK_MULTI_ROLE_USERS.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleMultiRoleLogin(profile)}
                className="w-full p-3 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg flex items-center justify-center font-bold text-xs group-hover:bg-indigo-500/20">
                    {profile.firstName[0]}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-white">
                      {profile.prefix}{profile.firstName} {profile.lastName}
                    </h4>
                    <p className="text-[10px] text-slate-400">{profile.position}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1 justify-end max-w-[160px]">
                  {profile.roles.map((role) => (
                    <span 
                      key={role} 
                      className="text-[9px] px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded border border-slate-700/50"
                    >
                      {role === 'SUPER_ADMIN' ? 'Admin' :
                       role === 'EXECUTIVE' ? 'ผู้บริหาร' :
                       role === 'HEAD_OF_DEPARTMENT' ? 'หัวหน้าสาระฯ' :
                       role === 'HOMEROOM_TEACHER' ? 'ประจำชั้น' :
                       role === 'SUBJECT_TEACHER' ? 'ครูผู้สอน' : 'ครูนิเทศ'}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Developer Bypass / Quick Login */}
        <div className="w-full pt-4 border-t border-white/5 space-y-2">
          <p className="text-xs text-slate-500">Developer Bypass / Quick Login</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            <button onClick={() => handleLogin('teacher')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg transition-colors border border-white/5">Subject Teacher</button>
            <button onClick={() => handleLogin('advisor')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg transition-colors border border-white/5">Homeroom Advisor</button>
            <button onClick={() => handleLogin('executive')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg transition-colors border border-white/5">Executive</button>
            <button onClick={() => handleLogin('student')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg transition-colors border border-white/5">Student</button>
            <button onClick={() => handleLogin('admin')} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded-lg transition-colors border border-white/5">Admin</button>
          </div>
        </div>
      </div>
    </div>
  );
}
