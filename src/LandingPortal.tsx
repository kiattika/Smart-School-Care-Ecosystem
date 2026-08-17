import { cn } from "./lib/utils";
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Users, 
  GraduationCap, 
  Smartphone, 
  Activity,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';


interface LandingPortalProps {
  onNavigate: (portal: 'teacher' | 'parent' | 'advisor' | 'executive' | 'student' | 'homevisit') => void;
}

export function LandingPortal({ onNavigate }: LandingPortalProps) {
  const [loginModal, setLoginModal] = useState<{
    isOpen: boolean;
    roleId: any;
    roleName: string;
    status: 'loading' | 'success';
  } | null>(null);

  const roles = [
    {
      id: 'teacher',
      name: 'ครูประจำวิชา (Subject Teacher)',
      desc: 'เช็คชื่อ, บันทึกพฤติกรรม, ตรวจการบ้าน ผ่านผังที่นั่งลากวาง',
      icon: BookOpen,
      color: 'text-emerald-400',
      bgHover: 'group-hover:bg-emerald-500/10',
      borderHover: 'hover:border-emerald-500',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]',
      gradient: 'from-emerald-500/20 to-transparent'
    },
    {
      id: 'advisor',
      name: 'ครูที่ปรึกษา (Homeroom Advisor)',
      desc: 'ดูภาพรวมห้อง, อนุมัติใบลา, และเข้าสู่ระบบเยี่ยมบ้านดิจิทัล',
      icon: Users,
      color: 'text-indigo-400',
      bgHover: 'group-hover:bg-indigo-500/10',
      borderHover: 'hover:border-indigo-500',
      glow: 'shadow-[0_0_15px_rgba(99,102,241,0.15)] hover:shadow-[0_0_30px_rgba(99,102,241,0.3)]',
      gradient: 'from-indigo-500/20 to-transparent'
    },
    {
      id: 'student',
      name: 'นักเรียน (Student Portal)',
      desc: 'บัตรนักเรียนดิจิทัล, เช็คคะแนน EXP, ประเมินเพื่อน EQ แบบไม่ระบุตัวตน',
      icon: GraduationCap,
      color: 'text-blue-400',
      bgHover: 'group-hover:bg-blue-500/10',
      borderHover: 'hover:border-blue-500',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]',
      gradient: 'from-blue-500/20 to-transparent'
    },
    {
      id: 'parent',
      name: 'ผู้ปกครอง (Parent Portal)',
      desc: 'แจ้งลาผ่าน LINE, ติดตามพฤติกรรมเรียลไทม์, รับการแจ้งเตือน',
      icon: Smartphone,
      color: 'text-amber-400',
      bgHover: 'group-hover:bg-amber-500/10',
      borderHover: 'hover:border-amber-500',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]',
      gradient: 'from-amber-500/20 to-transparent'
    },
    {
      id: 'executive',
      name: 'ผู้บริหารและแอดมิน (Executive)',
      desc: 'ศูนย์บัญชาการข้อมูล, แผนที่สารสนเทศ GIS, พิมพ์รายงาน PDF',
      icon: Activity,
      color: 'text-purple-400',
      bgHover: 'group-hover:bg-purple-500/10',
      borderHover: 'hover:border-purple-500',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]',
      gradient: 'from-purple-500/20 to-transparent'
    }
  ];

  const handleLogin = (role: typeof roles[0]) => {
    setLoginModal({
      isOpen: true,
      roleId: role.id,
      roleName: role.name,
      status: 'loading'
    });

    setTimeout(() => {
      setLoginModal(prev => prev ? { ...prev, status: 'success' } : null);
      
      setTimeout(() => {
        onNavigate(role.id as any);
        setLoginModal(null);
      }, 1500);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100 font-sans selection:bg-emerald-500/30 overflow-x-hidden relative">
      
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-500/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10 flex flex-col min-h-screen">
        
        {/* Hero Section */}
        <header className="text-center mb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-slate-300 mb-8 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            5 Modules. 1 Unified Solution.
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-6">
            Smart School Care <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400">
              Ecosystem
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto font-light leading-relaxed">
            ระบบดูแลช่วยเหลือนักเรียนแบบ 360 องศา ที่เชื่อมโยงข้อมูลตั้งแต่ห้องเรียนถึงผู้ปกครอง 
            ยกระดับการบริหารจัดการสถานศึกษาด้วยปัญญาประดิษฐ์และข้อมูลแบบเรียลไทม์
          </p>
        </header>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full flex-1 content-center">
          {roles.map((role, idx) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                onClick={() => handleLogin(role)}
                className={cn(
                  "group relative text-left bg-[#0f1219] border border-white/10 rounded-2xl p-6 transition-all duration-500 overflow-hidden",
                  role.borderHover,
                  role.glow,
                  // Center the last card if odd number in grid
                  idx === 4 ? "md:col-span-2 lg:col-span-1 lg:col-start-2" : ""
                )}
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Gradient Header */}
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-32 bg-gradient-to-b opacity-50 transition-opacity group-hover:opacity-100",
                  role.gradient
                )}></div>
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-white/5 border border-white/10 transition-colors duration-300",
                    role.bgHover
                  )}>
                    <Icon className={cn("w-7 h-7", role.color)} />
                  </div>
                  
                  <h2 className="text-xl font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-400 transition-all">
                    {role.name}
                  </h2>
                  
                  <p className="text-slate-400 text-sm leading-relaxed mb-4 flex-1">
                    {role.desc}
                  </p>

                  <div className={cn(
                    "text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all duration-300",
                    role.color,
                    "opacity-70 group-hover:opacity-100 group-hover:translate-x-1"
                  )}>
                    เข้าสู่ระบบ <span className="text-lg leading-none">&rarr;</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Login Modal */}
      {loginModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070a]/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
            
            {loginModal.status === 'loading' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin absolute" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">จำลองการเข้าสู่ระบบ</h3>
                <p className="text-slate-400 text-sm">กำลังโหลดข้อมูลสำหรับ {loginModal.roleName}...</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-emerald-400 mb-2">ยินดีต้อนรับเข้าสู่ระบบ</h3>
                <p className="text-slate-300 text-sm">{loginModal.roleName}</p>
              </>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
