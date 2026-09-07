import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Check, CheckCheck, X, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useStore } from '../../store';
import { subscribeParentNotifications, markParentNotificationRead, markAllParentNotificationsRead } from '../../services/firestoreService';
import { ParentNotification } from '../../types';

/**
 * กระดิ่งแจ้งเตือนรวมศูนย์ — real-time จาก Firestore (parent_notifications) ของผู้ใช้ที่ล็อกอินอยู่เอง
 * เท่านั้น ใช้ร่วมกันได้ทั้งฝั่งผู้ปกครอง (query ผ่าน parentUid) และฝั่งนักเรียนเจ้าของเรื่องเอง (query
 * ผ่าน studentUid — เพิ่มเข้ามาทีหลัง เดิม schema ผูกกับ parentUid เท่านั้น) เลือก field ตาม
 * `user.role` ปัจจุบันอัตโนมัติ ไม่ต้องส่ง prop บอกโหมด
 * (ดู firestore.rules: อ่านได้เฉพาะ resource.data.parentUid == auth.uid หรือ studentUid == auth.uid)
 *
 * วางไว้ในส่วนหัวของ portal ใดก็ได้ที่ผู้ใช้มีบทบาทเป็นผู้ปกครองหรือนักเรียน — ไม่ต้องส่ง prop ใดๆ ดึง
 * uid/role ของผู้ใช้ปัจจุบันจาก store เอง (เดิมระบบนี้ไม่มี UI แสดงผลเลยสักที่ ทั้งที่ข้อมูลจริงบางส่วนมีอยู่แล้ว)
 *
 * BUG FIX (พบจริงจากการทดสอบ live browser): dropdown เดิม render แบบ absolute ในต้นไม้ DOM
 * ปกติ (z-50) แต่ถูกแถบเมนูโมดูล/แท็บของทั้ง StudentPortal และ ParentPortal ทับ อ่านเนื้อหาไม่ได้ —
 * ตรวจสอบจริงผ่าน getComputedStyle/elementFromPoint แล้วพบว่าไม่มี element อื่นที่ z-index สูงกว่า
 * แข่งอยู่เลย (ลอง z-[60]+isolate บน wrapper ก็ยังไม่พอ) แสดงว่าเป็น stacking context ที่ parent
 * (แถบโมดูล/แท็บ ซึ่งห่อด้วย motion.div ของ Framer Motion ที่สร้าง compositing layer ของตัวเอง)
 * จำกัดไว้แบบที่ z-index ธรรมดาสู้ไม่ได้ — แก้ด้วยการ render dropdown ผ่าน React Portal ตรงไปที่
 * document.body แทน หลีกเลี่ยง stacking context ของ parent ไปเลย (ไม่ใช่แค่เพิ่มตัวเลข z-index)
 */
export function NotificationBell() {
  const user = useStore(s => s.user);
  const [notifications, setNotifications] = useState<ParentNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const buttonWrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isStudent = user?.role === 'student';

  useEffect(() => {
    if (!user?.uid) { setNotifications([]); return; }
    const filter = isStudent ? { studentUid: user.uid } : { parentUid: user.uid };
    const unsubscribe = subscribeParentNotifications(setNotifications, filter);
    return () => unsubscribe();
  }, [user?.uid, isStudent]);

  // คำนวณตำแหน่ง panel จากตำแหน่งจริงของปุ่มกระดิ่งตอนเปิด (fixed positioning เพราะ portal ออกไป
  // นอกต้นไม้ DOM เดิมแล้ว absolute เดิมที่อิงกับ wrapper ใช้ไม่ได้อีกต่อไป)
  useEffect(() => {
    if (!isOpen || !buttonWrapRef.current) return;
    const rect = buttonWrapRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
  }, [isOpen]);

  // ปิด panel เมื่อคลิกนอกกรอบ — เช็คทั้งปุ่ม (ในต้นไม้เดิม) และ panel (portal ไป document.body แล้ว)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonWrapRef.current && !buttonWrapRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const handleMarkRead = (id: string) => {
    markParentNotificationRead(id).catch(err => console.error('[NotificationBell] markParentNotificationRead failed:', err));
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => n.status === 'unread').map(n => n.id);
    if (unreadIds.length === 0) return;
    setIsMarkingAll(true);
    try {
      await markAllParentNotificationsRead(unreadIds);
    } catch (err) {
      console.error('[NotificationBell] markAllParentNotificationsRead failed:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleToggleExpand = (notif: ParentNotification) => {
    setExpandedId(expandedId === notif.id ? null : notif.id);
    if (notif.status === 'unread') handleMarkRead(notif.id);
  };

  const formatTime = (createdAt: ParentNotification['createdAt']) => {
    const d: Date | null = (createdAt as any)?.toDate ? (createdAt as any).toDate() : null;
    if (!d) return 'เมื่อสักครู่';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'เมื่อสักครู่';
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const typeIcon = (type?: ParentNotification['type']) => {
    if (type === 'critical') return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
    if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
    return <Info className="w-4 h-4 text-indigo-400 shrink-0" />;
  };

  if (!user?.uid) return null;

  const panel = isOpen && panelPos && createPortal(
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: panelPos.top, right: panelPos.right, zIndex: 9999 }}
      className="w-80 sm:w-96 max-h-[28rem] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white">การแจ้งเตือน {unreadCount > 0 && `(${unreadCount} ใหม่)`}</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isMarkingAll}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" /> อ่านทั้งหมด
            </button>
          )}
          <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">ยังไม่มีการแจ้งเตือน</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleToggleExpand(notif)}
                className={`px-4 py-3 cursor-pointer transition-colors hover:bg-slate-800/60 ${
                  notif.status === 'unread' ? 'bg-slate-800/30' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {typeIcon(notif.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-bold truncate ${notif.status === 'unread' ? 'text-white' : 'text-slate-400'}`}>
                        {notif.title}
                      </p>
                      {notif.status === 'unread' && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 ${expandedId === notif.id ? '' : 'line-clamp-2'} ${notif.status === 'unread' ? 'text-slate-300' : 'text-slate-500'}`}>
                      {notif.message}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-slate-500 font-mono">{formatTime(notif.createdAt)}</span>
                      {notif.status === 'unread' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMarkRead(notif.id); }}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> อ่านแล้ว
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="relative" ref={buttonWrapRef}>
      <button
        onClick={() => setIsOpen(o => !o)}
        className="relative p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
        aria-label="การแจ้งเตือน"
      >
        <Bell className="w-5 h-5 text-slate-200" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {panel}
    </div>
  );
}
