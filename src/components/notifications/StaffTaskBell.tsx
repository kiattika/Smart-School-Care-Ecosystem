import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, ClipboardList } from 'lucide-react';
import { useStore } from '../../store';
import { subscribeLeaveRequests, subscribeLateAttendanceRequests } from '../../services/firestoreService';
import { useScreeningBellData, type ScreeningBellMode } from '../../hooks/useScreeningBellData';
import { buildStaffTasks, staffTaskSources, totalStaffTasks } from '../../lib/staffTasks';
import type { DetailedLeaveRequest, LateAttendanceRequestRecord } from '../../types';

/**
 * กระดิ่งงานค้างฝั่งบุคลากร — วางใน NavbarWithRoleSwitcher (ส่วนหัวที่ใช้ร่วมกันทุกพอร์ทัลของบุคลากร)
 * เปลี่ยนตามบทบาทที่ใช้งานอยู่ (activeRole) และ subscribe เฉพาะข้อมูลที่บทบาทนั้นมีสิทธิ์เห็นตาม firestore.rules:
 *  - HOMEROOM_TEACHER → ใบลานักเรียนห้องที่ตัวเองเป็นครูที่ปรึกษา (homeroomClass จาก user.profile.assignments)
 *  - DEPUTY_DIRECTOR_ACADEMIC / SUPER_ADMIN → คำขอเช็คชื่อย้อนหลังที่รออนุมัติ
 *  - GUIDANCE_COUNSELOR / HOMEROOM_TEACHER → คัดกรอง 2Q บวก (รอ 9Q) และ 9Q ธงแดง (รอแจ้งผู้ปกครอง/พบนักเรียน) — แสดงเฉพาะจำนวน
 * คำนวณสดจากข้อมูลจริง (src/lib/staffTasks.ts) — จัดการงานแล้วจะหายจากกระดิ่งเอง ไม่มีรายการ "ยังไม่อ่าน" ค้าง
 * panel render ผ่าน React Portal เหมือน NotificationBell (กันถูก stacking context ของ motion.div ทับ)
 */
export function StaffTaskBell({ activeRole }: { activeRole: string }) {
  const user = useStore(s => s.user);
  const myRoom = user?.profile?.assignments?.homeroomClass;
  const sources = staffTaskSources(activeRole);

  const [roomLeaves, setRoomLeaves] = useState<DetailedLeaveRequest[]>([]);
  const [lateRequests, setLateRequests] = useState<LateAttendanceRequestRecord[]>([]);
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

  useEffect(() => {
    if (!sources.lateRequests || !user?.uid) { setLateRequests([]); return; }
    return subscribeLateAttendanceRequests(setLateRequests);
  }, [sources.lateRequests, user?.uid]);

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

  // บทบาทนี้ไม่มีงานค้างประเภทใดให้ติดตามเลย → ไม่แสดงกระดิ่ง (ไม่โชว์กระดิ่งว่างที่ไม่เคยมีวันแจ้งอะไร)
  if (!sources.leaves && !sources.lateRequests && !sources.screening) return null;

  const tasks = buildStaffTasks({ activeRole, roomLeaves, lateRequests, screening });
  const total = totalStaffTasks(tasks);

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
        {tasks.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-500">ไม่มีงานค้าง</div>
        ) : tasks.map(t => (
          <div key={t.kind} className="px-4 py-3 border-b border-slate-800/60 last:border-b-0 flex items-start gap-3">
            <ClipboardList className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-100">{t.label} <span className="text-indigo-300">{t.count}</span></div>
              <div className="text-[11px] text-slate-400 mt-0.5">จัดการที่: {t.where}</div>
            </div>
          </div>
        ))}
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
