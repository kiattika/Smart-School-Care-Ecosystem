import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  ChevronDown, 
  User as UserIcon, 
  Check, 
  LogOut, 
  BookOpen, 
  Users, 
  GraduationCap, 
  Award,
  Lock,
  Building,
  Activity,
  Satellite,
  Radio,
  Menu,
  X
} from 'lucide-react';
import { UserRole, Permission, UserProfile, ROLE_PERMISSIONS } from '../types/auth';
import { useStore } from '../store';
import { HeaderRealTimeClock } from './HeaderRealTimeClock';
import { GPSGeofenceCheckinModal } from './GPSGeofenceCheckinModal';

// สีของ Badge และธีมประจำแต่ละบทบาท
export interface RoleVisualConfig {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconBg: string;
  iconColor: string;
  description: string;
}

export const DEFAULT_ROLE_VISUAL: RoleVisualConfig = {
  label: 'ผู้ใช้งาน',
  badgeBg: 'bg-indigo-500/10',
  badgeText: 'text-indigo-400',
  badgeBorder: 'border-indigo-500/20',
  iconBg: 'bg-indigo-500/20',
  iconColor: 'text-indigo-400',
  description: 'เข้าถึงระบบสารสนเทศตามสิทธิ์การใช้งาน'
};

export const ROLE_VISUALS: Record<string, RoleVisualConfig> = {
  SUPER_ADMIN: {
    label: 'ผู้ดูแลระบบ',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/20',
    iconBg: 'bg-rose-500/20',
    iconColor: 'text-rose-400',
    description: 'ดูแลระบบความปลอดภัยและการจัดการสิทธิ์ทั้งหมด'
  },
  EXECUTIVE: {
    label: 'ผู้บริหารสถานศึกษา',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-400',
    badgeBorder: 'border-blue-500/20',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    description: 'เข้าถึงข้อมูลภาพรวม อนุมัติผลการเรียน และนิเทศ'
  },
  HEAD_OF_DEPARTMENT: {
    label: 'หัวหน้ากลุ่มสาระฯ',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/20',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    description: 'จัดการคะแนน อนุมัติผลการเรียนในกลุ่มสาระฯ'
  },
  HOMEROOM_TEACHER: {
    label: 'ครูประจำชั้น',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    description: 'บันทึกการเข้าเรียน พฤติกรรม และดูแลนักเรียนในที่ปรึกษา'
  },
  SUBJECT_TEACHER: {
    label: 'ครูประจำวิชา',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-400',
    badgeBorder: 'border-indigo-500/20',
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    description: 'บันทึกคะแนนเก็บ จัดเก็บสถิติการเรียนรายห้อง'
  },
  SUPERVISORY_TEACHER: {
    label: 'ครูนิเทศ',
    badgeBg: 'bg-teal-500/10',
    badgeText: 'text-teal-400',
    badgeBorder: 'border-teal-500/20',
    iconBg: 'bg-teal-500/20',
    iconColor: 'text-teal-400',
    description: 'ประเมินแผนการสอน นิเทศสังเกตการณ์ชั้นเรียน'
  },
  INFIRMARY_STAFF: {
    label: 'พยาบาลโรงเรียน',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/20',
    iconBg: 'bg-rose-500/20',
    iconColor: 'text-rose-400',
    description: 'บันทึกห้องพยาบาล จ่ายยา และตรวจสุขภาพนักเรียน'
  },
  GUIDANCE_COUNSELOR: {
    label: 'ครูแนะแนว',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/20',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    description: 'ให้คำปรึกษา เคส SDQ/EQ และระบบ TCAS พอร์ตโฟลิโอ'
  },
  FINANCE_STAFF: {
    label: 'เจ้าหน้าที่การเงิน',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    description: 'จัดเก็บค่าธรรมเนียม ใบเสร็จดิจิทัล และอนุมัติเบิกงบครู'
  },
  INSTRUCTIONAL_SUPERVISOR: {
    label: 'ครูผู้นิเทศ/วิชาการ',
    badgeBg: 'bg-cyan-500/10',
    badgeText: 'text-cyan-400',
    badgeBorder: 'border-cyan-500/20',
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    description: 'ตรวจแผนการสอน นิเทศชั้นเรียน และประเมินสมรรถนะ'
  },
  PARENT: {
    label: 'ผู้ปกครอง',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/20',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    description: 'ติดตามผลการเรียน การเข้าแถว และความประพฤตินักเรียน'
  },
  STUDENT: {
    label: 'นักเรียน',
    badgeBg: 'bg-sky-500/10',
    badgeText: 'text-sky-400',
    badgeBorder: 'border-sky-500/20',
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-400',
    description: 'ตรวจสอบตารางเรียน ผลการเรียน และภารกิจการเข้าแถว'
  },
  admin: {
    label: 'ผู้ดูแลระบบ',
    badgeBg: 'bg-rose-500/10',
    badgeText: 'text-rose-400',
    badgeBorder: 'border-rose-500/20',
    iconBg: 'bg-rose-500/20',
    iconColor: 'text-rose-400',
    description: 'ดูแลระบบความปลอดภัยและการจัดการสิทธิ์ทั้งหมด'
  },
  executive: {
    label: 'ผู้บริหารสถานศึกษา',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-400',
    badgeBorder: 'border-blue-500/20',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
    description: 'เข้าถึงข้อมูลภาพรวม อนุมัติผลการเรียน และนิเทศ'
  },
  advisor: {
    label: 'ครูประจำชั้น',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    description: 'บันทึกการเข้าเรียน พฤติกรรม และดูแลนักเรียนในที่ปรึกษา'
  },
  teacher: {
    label: 'ครูประจำวิชา',
    badgeBg: 'bg-indigo-500/10',
    badgeText: 'text-indigo-400',
    badgeBorder: 'border-indigo-500/20',
    iconBg: 'bg-indigo-500/20',
    iconColor: 'text-indigo-400',
    description: 'บันทึกคะแนนเก็บ จัดเก็บสถิติการเรียนรายห้อง'
  },
  parent: {
    label: 'ผู้ปกครอง',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/20',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    description: 'ติดตามผลการเรียน การเข้าแถว และความประพฤตินักเรียน'
  },
  student: {
    label: 'นักเรียน',
    badgeBg: 'bg-sky-500/10',
    badgeText: 'text-sky-400',
    badgeBorder: 'border-sky-500/20',
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-400',
    description: 'ตรวจสอบตารางเรียน ผลการเรียน และภารกิจการเข้าแถว'
  }
};

export function getRoleVisual(role?: string): RoleVisualConfig {
  if (!role) return DEFAULT_ROLE_VISUAL;
  return ROLE_VISUALS[role] || DEFAULT_ROLE_VISUAL;
}

// แปลชื่อสิทธิ์ (Permission) เป็นภาษาไทยเพื่อการจัดแสดง
export const PERMISSION_LABELS: Record<Permission, string> = {
  MANAGE_SYSTEM: 'จัดการระบบและผู้ใช้งาน',
  APPROVE_GRADES: 'อนุมัติผลการเรียน',
  EDIT_GRADES: 'บันทึก/แก้ไขคะแนนรายวิชา',
  VIEW_ALL_REPORTS: 'ดูรายงานภาพรวมโรงเรียน',
  VIEW_DEPT_REPORTS: 'ดูรายงานสถิติสาระการเรียนรู้',
  MANAGE_HOMEROOM: 'บันทึกเช็กชื่อ/พฤติกรรมประจำชั้น',
  EVALUATE_TEACHERS: 'ประเมินแผนและการจัดการสอน',
  MANAGE_INFIRMARY: 'จัดการห้องพยาบาลและสถิติสุขภาพ',
  MANAGE_COUNSELING: 'จัดการระบบแนะแนวและให้คำปรึกษา',
  MANAGE_FINANCE: 'จัดการงานการเงินและบัญชีโรงเรียน',
  MANAGE_SUPERVISION: 'จัดการงานนิเทศการสอนและตรวจแผน'
};

export interface NavbarWithRoleSwitcherProps {
  user: UserProfile;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onLogout?: () => void;
}

export function NavbarWithRoleSwitcher({
  user,
  activeRole,
  onRoleChange,
  onLogout
}: NavbarWithRoleSwitcherProps) {
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isGPSModalOpen, setIsGPSModalOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // ปิด Dropdown เมื่อคลิกนอกองค์ประกอบ
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeVisual = getRoleVisual(activeRole);

  // ค้นหารายละเอียดบทบาทเพื่อจัดแสดงข้อมูลบริบทเพิ่มเติม
  const getRoleContextDetails = (role: UserRole): string => {
    const assignments = user?.assignments || (user as any)?.profile?.assignments;
    if (!assignments) return '';
    switch (role) {
      case 'HOMEROOM_TEACHER':
        return assignments.homeroomClass ? `ห้อง ${assignments.homeroomClass}` : '';
      case 'HEAD_OF_DEPARTMENT':
        return assignments.departmentId === 'sci-dept' ? 'กลุ่มสาระฯ วิทยาศาสตร์' : 'หัวหน้าส่วนงาน';
      case 'SUBJECT_TEACHER':
        const count = assignments.teachingSubjects?.length || 0;
        return count > 0 ? `สอน ${count} รายวิชา` : '';
      case 'SUPERVISORY_TEACHER':
        const menteesCount = assignments.supervisoryMentees?.length || 0;
        return menteesCount > 0 ? `นิเทศครู ${menteesCount} ท่าน` : '';
      case 'INFIRMARY_STAFF':
        return 'งานพยาบาลและอนามัย';
      case 'GUIDANCE_COUNSELOR':
        return 'งานแนะแนวและจิตวิทยา';
      default:
        return '';
    }
  };

  return (
    <>
      <nav className="w-full bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-800 text-slate-100 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-lg">
      
      {/* ฝั่งซ้าย: โลโก้และชื่อระบบ */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="relative group cursor-pointer shrink-0">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-300"></div>
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600 to-slate-900 border border-slate-700 rounded-xl flex items-center justify-center shadow-lg">
            <Building className="w-4 h-4 sm:w-5.5 sm:h-5.5 text-indigo-400 group-hover:scale-110 transition duration-300" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-sm sm:text-base md:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent truncate">
              ระบบบริหารจัดการสถานศึกษา
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase font-mono px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md font-semibold shrink-0">
              SMS Pro
            </span>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-400 font-light hidden sm:block truncate">School Management & Student Care System</p>
        </div>
      </div>

      {/* ฝั่งขวา: โปรไฟล์ผู้ใช้, นาฬิกา Real-time และ Role Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        
        {/* Real-time live digital clock and active class period */}
        <div className="hidden xl:flex">
          <HeaderRealTimeClock />
        </div>

        {/* GPS Geofence Check-in Button */}
        <button
          onClick={() => setIsGPSModalOpen(true)}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-indigo-900/60 to-emerald-950/60 hover:from-indigo-800/80 hover:to-emerald-900/80 border border-emerald-500/30 hover:border-emerald-500/50 text-slate-100 text-xs font-semibold shadow-md transition-all cursor-pointer group"
          title="เช็คอินลงชื่อด้วยพิกัดดาวเทียมโรงเรียน (GPS Geofence)"
        >
          <div className="relative">
            <Satellite className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="hidden sm:inline text-slate-200 group-hover:text-white">เช็คอิน GPS</span>
          <span className="sm:hidden text-[10.5px] text-emerald-300">GPS</span>
        </button>
        
        {/* Role Switcher Selector */}
        <div className="relative" ref={roleDropdownRef}>
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className="flex items-center gap-1.5 sm:gap-2.5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl px-2 sm:px-3.5 py-1.5 sm:py-2 text-xs font-medium transition-all shadow-md cursor-pointer hover:border-slate-700 group"
          >
            <div className={`w-2 h-2 rounded-full ${activeVisual.badgeBg.replace('/10', '/100')} animate-pulse shrink-0`} />
            <div className="text-left">
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-normal hidden sm:block">บทบาทปัจจุบัน</p>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-xs text-slate-200">
                  {activeVisual.label}
                </span>
                {getRoleContextDetails(activeRole) && (
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-light bg-slate-800/80 px-1 py-0.2 rounded border border-slate-700/50 hidden md:inline">
                    {getRoleContextDetails(activeRole)}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-slate-300 transition-transform duration-200 ml-0.5" />
          </button>

          {/* เมนูดรอปดาวน์สำหรับเปลี่ยนบทบาท (Role Switcher Dropdown) */}
          {isRoleDropdownOpen && (
            <div className="absolute right-0 mt-2.5 w-80 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl p-2.5 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="px-3 py-2 border-b border-slate-800/60 mb-2">
                <p className="text-xs font-semibold text-slate-300">สลับบทบาทการเข้าถึง</p>
                <p className="text-[11px] text-slate-500">บัญชีของคุณมีสิทธิ์เข้าใช้งานตามสิทธิภารกิจดังนี้</p>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {(user.roles || []).map((role) => {
                  const visual = getRoleVisual(role);
                  const isSelected = role === activeRole;
                  const context = getRoleContextDetails(role);

                  return (
                    <button
                      key={role}
                      onClick={() => {
                        onRoleChange(role);
                        setIsRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${
                        isSelected 
                          ? 'bg-slate-800/60 border border-indigo-500/30' 
                          : 'hover:bg-slate-800/40 border border-transparent hover:border-slate-800'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${visual.badgeBg} ${visual.badgeText}`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">
                            {visual.label}
                          </span>
                          {context && (
                            <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {context}
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-400 mt-0.5 line-clamp-2">
                          {visual.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="self-center bg-indigo-500/20 text-indigo-400 p-1 rounded-full border border-indigo-500/30">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Portal Views (Parent & Student) */}
              <div className="border-t border-slate-800/80 pt-2 mt-2 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  มุมมองระบบอื่นๆ (Portal Views)
                </div>
                <button
                  onClick={() => {
                    const { setUser, user: currentUser } = useStore.getState();
                    if (currentUser) {
                      setUser({ ...currentUser, role: 'parent' });
                    }
                    setIsRoleDropdownOpen(false);
                  }}
                  className="w-full text-left p-2 rounded-xl hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-all flex items-center gap-2.5 cursor-pointer text-emerald-400 text-xs font-semibold"
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>มุมมองผู้ปกครอง (Parent Module)</span>
                </button>
                <button
                  onClick={() => {
                    const { setUser, user: currentUser } = useStore.getState();
                    if (currentUser) {
                      setUser({ ...currentUser, role: 'student' });
                    }
                    setIsRoleDropdownOpen(false);
                  }}
                  className="w-full text-left p-2 rounded-xl hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all flex items-center gap-2.5 cursor-pointer text-indigo-400 text-xs font-semibold"
                >
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                  <span>มุมมองนักเรียน (Student Portal)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Info & Profile Action Menu */}
        <div className="relative" ref={profileDropdownRef}>
          <button
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="flex items-center gap-3 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-850 hover:border-slate-800 rounded-2xl pl-3 pr-2.5 py-1.5 transition-all cursor-pointer group"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">
                {user.prefix || ''}{user.firstName || ''} {user.lastName || ''}
              </p>
              <p className="text-[10px] text-slate-400">{user.position || 'บุคลากรทางการศึกษา'}</p>
            </div>
            
            {/* วงกลมรูปโปรไฟล์ */}
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 p-0.5 flex items-center justify-center shadow-md">
                <div className="w-full h-full rounded-[10px] bg-slate-950 overflow-hidden flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-slate-300" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border border-slate-950 rounded-full" />
            </div>
          </button>

          {/* Profile Dropdown Action Menu */}
          {isProfileDropdownOpen && (
            <div className="absolute right-0 mt-2.5 w-72 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl p-3 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              
              {/* ข้อมูลโปรไฟล์แบบละเอียด */}
              <div className="flex items-center gap-3 p-2 bg-slate-800/25 rounded-xl border border-slate-800/40 mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-sm text-white">
                  {user.firstName?.[0] || 'U'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">
                    {user.prefix || ''}{user.firstName || ''} {user.lastName || ''}
                  </h4>
                  <p className="text-[10px] text-slate-400">{user.email || ''}</p>
                  <p className="text-[9.5px] mt-0.5 text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 inline-block font-mono">
                    ID: {user.id || 'N/A'}
                  </p>
                </div>
              </div>

              {/* รายการสิทธิ์ภายใต้บทบาทปัจจุบัน (Active Permissions Preview) */}
              <div className="mb-3 px-2">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1.5">
                  <Lock className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    สิทธิ์ปัจจุบัน ({activeVisual.label})
                  </span>
                </div>
                <div className="space-y-1 bg-slate-950/40 p-2 rounded-xl border border-slate-800/50 max-h-36 overflow-y-auto">
                  {(ROLE_PERMISSIONS[activeRole] || []).map((perm) => (
                    <div key={perm} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                      <div className="w-1 h-1 rounded-full bg-indigo-400" />
                      <span className="truncate">{PERMISSION_LABELS[perm]}</span>
                    </div>
                  ))}
                  {(ROLE_PERMISSIONS[activeRole] || []).length === 0 && (
                    <span className="text-[10px] text-slate-500 italic block">ไม่มีสิทธิ์ใช้งานพิเศษ</span>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-800/60 pt-2 space-y-1">
                {onLogout && (
                  <button
                    onClick={() => {
                      onLogout();
                      setIsProfileDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    ออกจากระบบ
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </nav>

    {/* GPS Geofence Check-in Modal */}
    <GPSGeofenceCheckinModal
      isOpen={isGPSModalOpen}
      onClose={() => setIsGPSModalOpen(false)}
    />
  </>
  );
}
