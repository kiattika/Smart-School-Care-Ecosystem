import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, ClipboardCheck, Download, Home, LogOut, MapPin, MessageCircle, Monitor, RefreshCw, Satellite } from 'lucide-react';
import { useStore } from '../store';
import { useRealStudents } from '../hooks/useRealStudents';
import { useTeacherFirestoreSchedule } from '../hooks/useTeacherFirestoreSchedule';
import { GPSGeofenceCheckinModal } from '../components/GPSGeofenceCheckinModal';
import { StudentDaySchedule } from '../components/student-parent/StudentDaySchedule';
import { StudentHomeLocationForm } from '../components/homevisit/StudentHomeLocationForm';
import { ClassChatMemberView, ClassChatTeacherView, useMemberThreads, useRoomChatUnread } from '../components/chat/ClassChatPanel';
import { isThreadUnread } from '../lib/classChat';
import { buildTeacherDaySchedule } from '../lib/teacherDaySchedule';
import { MobileHomeroomAttendance } from './MobileHomeroomAttendance';
import { subscribeUpdateReady } from './updateBus';
import { mobileMenuFor, type MobileMenuId } from './mobileMenu';

interface Props { onLogout: () => void }

const ICONS: Record<MobileMenuId, React.ComponentType<{ className?: string }>> = {
  checkin: Satellite,
  schedule: CalendarClock,
  homeroom: ClipboardCheck,
  homeLocation: MapPin,
  chat: MessageCircle,
};
const TONES: Record<MobileMenuId, string> = {
  checkin: 'from-emerald-500/25 to-teal-500/10 text-emerald-300 border-emerald-500/30',
  schedule: 'from-sky-500/25 to-blue-500/10 text-sky-300 border-sky-500/30',
  homeroom: 'from-indigo-500/25 to-violet-500/10 text-indigo-300 border-indigo-500/30',
  homeLocation: 'from-amber-500/25 to-orange-500/10 text-amber-300 border-amber-500/30',
  chat: 'from-pink-500/25 to-rose-500/10 text-pink-300 border-pink-500/30',
};

/** หน้ามือถือ (PWA) /m — แสดงเฉพาะเมนูที่ใช้บ่อยตามบทบาท; งานอื่นเปิดเว็บเต็มได้ */
export function MobileApp({ onLogout }: Props) {
  const user = useStore(s => s.user)!;
  const profileRoles = user.profile?.roles || [];
  const menu = useMemo(() => mobileMenuFor({ appRole: user.role, roles: profileRoles as string[] }), [user.role, profileRoles.join('|')]);
  const [view, setView] = useState<MobileMenuId | null>(null);
  const [gpsOpen, setGpsOpen] = useState(false);
  const [activate, setActivate] = useState<(() => void) | null>(null);
  const [installEvt, setInstallEvt] = useState<any>(null);

  useEffect(() => subscribeUpdateReady((a) => setActivate(() => a)), []);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const isStudent = user.role === 'student';
  const isParent = user.role === 'parent';
  const myRoom = user.profile?.assignments?.homeroomClass || '';

  // นักเรียน/ผู้ปกครอง: ระเบียนนักเรียนจริงจาก Firestore (ตามสิทธิ์ใน rules)
  const own = useRealStudents(isParent ? { parentUid: user.uid } : { studentUid: isStudent ? user.uid : undefined });
  const child = own.students[0];

  // badge ข้อความ
  const memberThreads = useMemberThreads(isStudent || isParent ? user.uid : undefined);
  const memberUnread = memberThreads.filter(t => t.channel === (isParent ? 'PARENT' : 'STUDENT') && isThreadUnread(t, 'MEMBER')).length;
  const roomUnread = useRoomChatUnread(myRoom || undefined);
  const badge = (id: MobileMenuId) => (id === 'chat' ? (isStudent || isParent ? memberUnread : roomUnread) : 0);

  const open = (id: MobileMenuId) => {
    if (id === 'checkin') setGpsOpen(true);
    else setView(id);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        {view ? (
          <button onClick={() => setView(null)} aria-label="กลับเมนูหลัก" className="p-2 -ml-2 rounded-xl hover:bg-slate-800"><ArrowLeft className="w-5 h-5" /></button>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"><Home className="w-5 h-5 text-emerald-400" /></div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold truncate">{view ? menu.find(m => m.id === view)?.label : 'Smart School Care'}</div>
          <div className="text-[11px] text-slate-400 truncate">{user.displayName}</div>
        </div>
        <button onClick={onLogout} aria-label="ออกจากระบบ" className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10"><LogOut className="w-5 h-5" /></button>
      </header>

      {activate && (
        <button onClick={activate} className="mx-4 mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-bold">
          <RefreshCw className="w-4 h-4" /> มีเวอร์ชันใหม่ — แตะเพื่ออัปเดต
        </button>
      )}

      <main className="flex-1 p-4 space-y-4">
        {!view && (
          <>
            {menu.length === 0 ? (
              <p className="text-sm text-slate-400 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">บทบาทของบัญชีนี้ยังไม่มีเมนูบนมือถือ — เปิดเว็บเต็มเพื่อใช้งาน</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {menu.map(m => {
                  const Icon = ICONS[m.id];
                  const b = badge(m.id);
                  return (
                    <button key={m.id} onClick={() => open(m.id)} className={`relative text-left rounded-3xl border bg-gradient-to-br p-4 min-h-[112px] flex flex-col justify-between active:scale-[0.98] transition-transform ${TONES[m.id]}`}>
                      <Icon className="w-7 h-7" />
                      <span className="text-sm font-bold text-white leading-snug">{m.label}</span>
                      {b > 0 && <span className="absolute top-3 right-3 min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">{b}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {installEvt && (
              <button onClick={async () => { installEvt.prompt(); try { await installEvt.userChoice; } finally { setInstallEvt(null); } }} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-sm font-semibold">
                <Download className="w-4 h-4" /> ติดตั้งแอปลงหน้าจอหลัก
              </button>
            )}
            <a href="/" className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-slate-400 text-xs hover:text-white">
              <Monitor className="w-4 h-4" /> เปิดเว็บเต็ม (เมนูทั้งหมด)
            </a>
          </>
        )}

        {view === 'schedule' && (
          isStudent || isParent
            ? (child ? <StudentDaySchedule room={child.room} /> : <EmptyNotice loading={own.loading} text="ยังไม่ได้ผูกกับทะเบียนนักเรียน" />)
            : <TeacherToday />
        )}
        {view === 'homeroom' && <MobileHomeroomAttendance room={myRoom} />}
        {view === 'homeLocation' && (
          child ? <StudentHomeLocationForm student={child} studentUid={user.uid} /> : <EmptyNotice loading={own.loading} text="ยังไม่ได้ผูกกับทะเบียนนักเรียน" />
        )}
        {view === 'chat' && (
          isStudent || isParent
            ? (child ? <ClassChatMemberView channel={isParent ? 'PARENT' : 'STUDENT'} student={child} viewerUid={user.uid} viewerName={isParent ? `ผู้ปกครอง ${child.name}` : child.name} /> : <EmptyNotice loading={own.loading} text="ยังไม่ได้ผูกกับทะเบียนนักเรียน" />)
            : <TeacherChat room={myRoom} uid={user.uid} name={user.displayName || 'ครูประจำชั้น'} />
        )}
      </main>

      <GPSGeofenceCheckinModal isOpen={gpsOpen} onClose={() => setGpsOpen(false)} />
    </div>
  );
}

function EmptyNotice({ loading, text }: { loading: boolean; text: string }) {
  return <p className="text-sm text-slate-400 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">{loading ? 'กำลังโหลด…' : text}</p>;
}

function TeacherChat({ room, uid, name }: { room: string; uid: string; name: string }) {
  const { students } = useRealStudents();
  const roomStudents = useMemo(() => students.filter(s => s.room === room), [students, room]);
  return <ClassChatTeacherView room={room} students={roomStudents} viewerUid={uid} viewerName={name} />;
}

function TeacherToday() {
  const user = useStore(s => s.user)!;
  const now = useStore(s => s.currentDate);
  const { schedules, periods, loading } = useTeacherFirestoreSchedule();
  const { rows } = useMemo(
    () => buildTeacherDaySchedule({ schedules: schedules as any[], periods, user: { email: user.email, staffId: user.staffId }, now }),
    [schedules, periods, user.email, user.staffId, now],
  );
  return (
    <div className="space-y-2" data-testid="teacher-day-schedule">
      <h2 className="text-sm font-bold text-white px-1">ตารางสอนวันนี้</h2>
      {loading && <p className="text-xs text-slate-400">กำลังโหลดตาราง…</p>}
      {!loading && rows.length === 0 && <p className="text-xs text-slate-400 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">วันนี้ไม่มีคาบสอนของคุณในตาราง</p>}
      {rows.map(r => (
        <div key={r.key} className={`rounded-2xl border p-3 flex items-center gap-3 ${r.status === 'NOW' ? 'bg-emerald-500/10 border-emerald-500/40' : r.status === 'DONE' ? 'bg-slate-900/40 border-slate-800 opacity-60' : 'bg-slate-900/70 border-slate-800'}`}>
          <div className="w-14 shrink-0 text-center">
            <div className="text-xs font-black text-white">{r.periodLabel}</div>
            <div className="text-[10px] text-slate-400">{r.startTime}{r.endTime ? `–${r.endTime}` : ''}</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">{r.subject}</div>
            <div className="text-[11px] text-slate-400 truncate">{r.classLabel}{r.code ? ` · ${r.code}` : ''}</div>
          </div>
          {r.status === 'NOW' && <span className="text-[10px] font-bold text-emerald-300 shrink-0">กำลังสอน</span>}
        </div>
      ))}
    </div>
  );
}
