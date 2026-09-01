import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Repeat, Clock } from 'lucide-react';
import { useStore } from './store';
import { cn } from './lib/utils';
import { SubstituteTeachingModule } from './components/SubstituteTeachingModule';
import { LateAttendanceApprovalList } from './components/LateAttendanceApprovalList';
import { subscribeLateAttendanceRequests } from './services/firestoreService';
import { LateAttendanceRequestRecord } from './types';

/**
 * ApprovalsPortal — หน้าสำหรับ role ระดับบริหารที่ทำหน้าที่ "อนุมัติ" เท่านั้น
 * (HEAD_OF_DEPARTMENT / ACADEMIC_HEAD / DEPUTY_DIRECTOR_ACADEMIC / DIRECTOR)
 *
 * ทำไมต้องมีหน้านี้: App.tsx ไม่มี routing case ให้ role เหล่านี้ → ตกไป TeacherPortal
 * (หน้า "จัดการภาระงานสอน") ซึ่งสับสนมากเพราะไม่ใช่ครูผู้สอน. รวมงานอนุมัติ 2 ประเภท
 * ไว้ที่เดียว: (1) จัดครูสอนแทน 4 ขั้น  (2) เช็คชื่อย้อนหลัง
 *
 * เลือกสร้างหน้าใหม่บาง ๆ ที่ reuse component เดิม (SubstituteTeachingModule +
 * LateAttendanceApprovalList) แทนต่อยอด ExecutivePortal เพราะ ExecutivePortal
 * เป็นหน้าใหญ่ (1200+ บรรทัด) ที่ผูกกับ role EXECUTIVE โดยตรง — การ mount ให้ role อื่น
 * จะทำให้ tab/สิทธิ์ปนกันและ maintain ยากกว่า
 */

// role ที่เห็น tab "เช็คชื่อย้อนหลัง" — DIRECTOR เห็นแบบ read-only (กำกับดูแล)
const LATE_ATTENDANCE_VIEWER_ROLES = ['DEPUTY_DIRECTOR_ACADEMIC', 'SUPER_ADMIN', 'EXECUTIVE', 'DIRECTOR'];
// role ที่อนุมัติ/ปฏิเสธได้จริง — นอกเหนือจากนี้ (เช่น DIRECTOR) เห็นอย่างเดียว
const LATE_ATTENDANCE_APPROVER_ROLES = ['DEPUTY_DIRECTOR_ACADEMIC', 'SUPER_ADMIN'];

const ROLE_LABEL: Record<string, string> = {
  HEAD_OF_DEPARTMENT: 'หัวหน้ากลุ่มสาระการเรียนรู้',
  ACADEMIC_HEAD: 'หัวหน้าฝ่ายวิชาการและหลักสูตร',
  DEPUTY_DIRECTOR_ACADEMIC: 'รองผู้อำนวยการฝ่ายวิชาการ',
  DIRECTOR: 'ผู้อำนวยการสถานศึกษา',
};

export function ApprovalsPortal() {
  const user = useStore(s => s.user);
  const substituteAssignments = useStore(s => s.substituteAssignments);
  const activeRole = user?.activeRole || '';
  const canSeeLateAttendance = LATE_ATTENDANCE_VIEWER_ROLES.includes(activeRole);
  const lateAttendanceReadOnly = !LATE_ATTENDANCE_APPROVER_ROLES.includes(activeRole);

  const [tab, setTab] = useState<'substitute' | 'late-attendance'>('substitute');

  // นับคำขอเช็คชื่อย้อนหลังที่รออนุมัติ (สำหรับ badge)
  const [lateRequests, setLateRequests] = useState<LateAttendanceRequestRecord[]>([]);
  useEffect(() => {
    if (!canSeeLateAttendance) { setLateRequests([]); return; }
    return subscribeLateAttendanceRequests(setLateRequests);
  }, [canSeeLateAttendance]);
  const pendingLateCount = lateRequests.filter(r => r.status === 'PENDING').length;

  // นับงานสอนแทนที่ยังอยู่ในลำดับอนุมัติ (ทุก stage)
  const pendingSubCount = useMemo(
    () => substituteAssignments.filter(sa =>
      sa.status === 'PENDING_APPROVAL' &&
      sa.currentApprovalStage && sa.currentApprovalStage !== 'COMPLETED'
    ).length,
    [substituteAssignments]
  );

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border-b border-indigo-500/20 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl text-indigo-400 shadow-lg">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">ศูนย์อนุมัติงานวิชาการ</h1>
              <span className="px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold rounded-md">
                Academic Approvals Center
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {ROLE_LABEL[activeRole] || 'ผู้บริหารงานวิชาการ'} — พิจารณาอนุมัติงานจัดครูสอนแทนและคำขอเช็คชื่อย้อนหลัง
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl w-full mx-auto px-6 pt-5">
        <div className="flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setTab('substitute')}
            className={cn(
              'px-4 py-2.5 text-sm font-bold flex items-center gap-2 border-b-2 -mb-px transition-colors',
              tab === 'substitute'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <Repeat className="w-4 h-4" /> งานจัดครูสอนแทน
            {pendingSubCount > 0 && (
              <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full">{pendingSubCount}</span>
            )}
          </button>

          {canSeeLateAttendance && (
            <button
              onClick={() => setTab('late-attendance')}
              className={cn(
                'px-4 py-2.5 text-sm font-bold flex items-center gap-2 border-b-2 -mb-px transition-colors',
                tab === 'late-attendance'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              <Clock className="w-4 h-4" /> เช็คชื่อย้อนหลัง
              {pendingLateCount > 0 && (
                <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full">{pendingLateCount}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
        {tab === 'substitute' && (
          <div className="-mx-6 sm:-mx-0">
            <SubstituteTeachingModule />
          </div>
        )}
        {tab === 'late-attendance' && canSeeLateAttendance && (
          <div className="bg-[#161f30] border border-slate-800/80 rounded-xl p-6">
            <LateAttendanceApprovalList readOnly={lateAttendanceReadOnly} />
          </div>
        )}
      </div>
    </div>
  );
}
