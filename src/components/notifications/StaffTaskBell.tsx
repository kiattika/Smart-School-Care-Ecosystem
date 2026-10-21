import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, ClipboardList, MailOpen } from 'lucide-react';
import { useStore } from '../../store';
import { subscribeLeaveRequests, subscribeLateAttendanceRequests, subscribeClassChatThreads, type ClassChatThread, subscribeAppointments, subscribeStaffNotifications, markStaffNotificationRead, type StaffNotificationRecord } from '../../services/firestoreService';
import { useScreeningBellData, type ScreeningBellMode } from '../../hooks/useScreeningBellData';
import { buildStaffTasks, staffTaskSources, totalStaffTasks } from '../../lib/staffTasks';
import { useBellNav, taskTarget, messageTarget, type BellNavTarget } from '../../lib/bellNavigation';
import { ROLE_NAMES_TH } from '../StaffRoleManagementPage';
import type { UserRole } from '../../types';
import type { StaffNotificationKind } from '../../lib/staffNotifications';
import type { DetailedLeaveRequest, LateAttendanceRequestRecord, ParentAppointment } from '../../types';

/**
 * กระดิ่งงานค้างฝั่งบุคลากร — วางใน NavbarWithRoleSwitcher (ส่วนหัวที่ใช้ร่วมกันทุกพอร์ทัลของบุคลากร)
 * เปลี่ยนตามบทบาทที่ใช้งานอยู่ (activeRole) และ subscribe เฉพาะข้อมูลที่บทบาทนั้นมีสิทธิ์เห็นตาม firestore.rules:
 *  - HOMEROOM_TEACHER → ใบลานักเรียนห้องที่ตัวเองเป็นครูที่ปรึกษา (homeroomClass จาก user.profile.assignments)
 *  - DEPUTY_DIRECTOR_ACADEMIC / SUPER_ADMIN → คำขอเช็คชื่อย้อนหลังที่รออนุมัติ
 *  - GUIDANCE_COUNSELOR / HOMEROOM_TEACHER → คำขอนัดพบจากผู้ปกครอง + คัดกรอง 2Q บวก (รอ 9Q) และ 9Q ธงแดง (รอแจ้งผู้ปกครอง/พบนักเรียน) — แสดงเฉพาะจำนวน
 * คำนวณสดจากข้อมูลจริง (src/lib/staffTasks.ts) — จัดการงานแล้วจะหายจากกระดิ่งเอง ไม่มีรายการ "ยังไม่อ่าน" ค้าง
 * panel render ผ่าน React Portal เหมือน NotificationBell (กันถูก stacking context ของ motion.div ทับ)
 */
export function StaffTaskBell({ activeRole, onSwitchRole }: { activeRole: string; onSwitchRole?: (role: UserRole) => void }) {
  const user = useStore(s => s.user);
  const myRoom = user?.profile?.assignments?.homeroomClass;
  const sources = staffTaskSources(activeRole);
  const goNav = useBellNav((s) => s.go);
  const myRoles: string[] = user?.profile?.roles || [];

  // เป้าหมายใช้ได้เฉพาะบทบาทที่ฉันมีจริง (หรือบทบาทปัจจุบัน) — ไม่งั้นไม่พาไป (กันเป้าหมายค้างรอ)
  const reachable = (t: BellNavTarget | null): BellNavTarget | null => (t && (t.role === activeRole || myRoles.includes(t.role)) ? t : null);
  const goTo = (t: BellNavTarget) => {
    goNav(t);                                   // ตั้งเป้าหมายก่อน — พอร์ทัลปลายทางรับตอน mount/เปลี่ยนค่า
    if (t.role !== activeRole) onSwitchRole?.(t.role as UserRole);
    setIsOpen(false);
  };

  const [roomLeaves, setRoomLeaves] = useState<DetailedLeaveRequest[]>([]);
  const [lateRequests, setLateRequests] = useState<LateAttendanceRequestRecord[]>([]);
  const [appointments, setAppointments] = useState<ParentAppointment[]>([]);
  const substitutes = useStore(s => s.substituteAssignments);
  const [messages, setMessages] = useState<StaffNotificationRecord[]>([]);
  const [chatThreads, setChatThreads] = useState<ClassChatThread[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const screeningMode: ScreeningBellMode = !sources.screening ? null : activeRole === 'GUIDANCE_COUNSELOR' ? 'GUIDANCE' : 'HOMEROOM';
  const screening = useScreeningBellData(user?.uid ? screeningMode : null, myRoom, openCount);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const buttonWrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sources.leaves || !myRoom || !user?.uid) { setRoomLeaves([]); return; }
    return subscribeLeaveRequests(setRoomLeaves, { homeroomClass: myRoom });
  }, [sources.leaves, myRoom, user?.uid]);

  // แชทห้องเรียน: ครูที่ปรึกษาฟังห้องสนทนาของห้องตัวเอง (rules: query ด้วย room)
  useEffect(() => {
    if (!sources.chat || !myRoom || !user?.uid) { setChatThreads([]); return; }
    return subscribeClassChatThreads(setChatThreads, { room: myRoom });
  }, [sources.chat, myRoom, user?.uid]);

  useEffect(() => {
    if (!sources.appointments || !user?.uid) { setAppointments([]); return; }
    if (activeRole === 'GUIDANCE_COUNSELOR') return subscribeAppointments(setAppointments, { guidance: true });
    if (!myRoom) { setAppointments([]); return; }
    return subscribeAppointments(setAppointments, { homeroomClass: myRoom });
  }, [sources.appointments, activeRole, myRoom, user?.uid]);

  useEffect(() => {
    if (!sources.lateRequests || !user?.uid) { setLateRequests([]); return; }
    return subscribeLateAttendanceRequests(setLateRequests);
  }, [sources.lateRequests, user?.uid]);

  // ข้อความแจ้งผลถึงฉัน (ตามอีเมล) — ทุกบทบาทของบุคลากร
  useEffect(() => {
    if (!user?.uid || !user.email) { setMessages([]); return; }
    return subscribeStaffNotifications(user.email, setMessages);
  }, [user?.uid, user?.email]);

  useEffect(() => {
    if (!isOpen || !buttonWrapRef.current) return;
    setOpenCount((c) => c + 1);
    const rect = buttonWrapRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (buttonWrapRef.current && !buttonWrapRef.current.contains(t) && panelRef.current && !panelRef.current.contains(t)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  const tasks = buildStaffTasks({ activeRole, roomLeaves, lateRequests, screening, appointments, substitutes, myEmail: user?.email || '', myStaffId: user?.staffId, myRoles: user?.profile?.roles || [], chatThreads });
  const unread = messages.filter(m => !m.readAt);
  const total = totalStaffTasks(tasks) + unread.length;

  const panel = isOpen && panelPos && createPortal(
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: panelPos.top, right: panelPos.right, zIndex: 9999 }}
      className="w-80 max-h-[24rem] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      data-testid="staff-task-panel"
    >
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white">งานของฉัน {total > 0 && `(${total} รายการ)`}</h3>
      </div>
      <div className="overflow-y-auto">
        {unread.length > 0 && (
          <div data-testid="staff-message-section">
            <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-slate-400">ข้อความ ({unread.length})</div>
            {unread.slice(0, 20).map(m => {
              const target = reachable(messageTarget(m.kind as StaffNotificationKind, myRoles));
              const markRead = () => { void markStaffNotificationRead(m.id).catch(err => console.warn('[markStaffNotificationRead]', err)); };
              return (
                <div key={m.id} className="px-4 py-3 border-b border-slate-800/60 flex items-start gap-3">
                  <MailOpen className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    {target && <RoleTag role={target.role} />}
                    <div className="text-xs font-semibold text-slate-100">{m.title}</div>
                    <div className="text-[11px] text-slate-300 mt-0.5 break-words">{m.message}</div>
                    {target && (
                      <button
                        onClick={() => { markRead(); goTo(target); }}
                        className="mt-1 text-[11px] text-emerald-300 hover:text-emerald-200 cursor-pointer"
                        data-testid="staff-message-go"
                      >ไปที่งานนี้ →</button>
                    )}
                  </div>
                  <button onClick={markRead} className="text-[11px] text-indigo-300 hover:text-indigo-200 shrink-0 cursor-pointer">อ่านแล้ว</button>
                </div>
              );
            })}
          </div>
        )}
        {tasks.length === 0 && unread.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-500">ไม่มีงานค้าง</div>
        ) : tasks.map(t => {
          const target = reachable(taskTarget(t.kind, activeRole, myRoles));
          const body = (
            <>
              <ClipboardList className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <div className="min-w-0 text-left">
                {target && <RoleTag role={target.role} />}
                <div className="text-xs font-semibold text-slate-100">{t.label} <span className="text-indigo-300">{t.count}</span></div>
                <div className="text-[11px] text-slate-400 mt-0.5">จัดการที่: {t.where}{target ? ' · กดเพื่อไป' : ''}</div>
              </div>
            </>
          );
          return target ? (
            <button key={t.kind} onClick={() => goTo(target)} data-testid={`staff-task-${t.kind}`} className="w-full px-4 py-3 border-b border-slate-800/60 last:border-b-0 flex items-start gap-3 hover:bg-slate-800/60 cursor-pointer">{body}</button>
          ) : (
            <div key={t.kind} className="px-4 py-3 border-b border-slate-800/60 last:border-b-0 flex items-start gap-3">{body}</div>
          );
        })}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      <div className="relative" ref={buttonWrapRef}>
        <button
          onClick={() => setIsOpen(o => !o)}
          aria-label={total > 0 ? `งานค้าง ${total} รายการ` : 'งานค้าง'}
          title="งานค้างของฉัน"
          className="relative p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </button>
      </div>
      {panel}
    </>
  );
}

/** ป้ายบอกว่ารายการนี้เป็นงานของบทบาทไหน (ผู้ใช้หลายบทบาทจะได้ไม่งงว่าต้องสลับไปบทบาทอะไร) */
function RoleTag({ role }: { role: string }) {
  return (
    <span className="inline-block mb-0.5 px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300" data-testid="role-tag">
      {(ROLE_NAMES_TH as Record<string, string>)[role] || role}
    </span>
  );
}
