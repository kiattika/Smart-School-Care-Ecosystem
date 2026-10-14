import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, MessageSquare, Send } from 'lucide-react';
import {
  markClassThreadRead,
  sendClassMessage,
  subscribeClassChatThreads,
  subscribeClassMessages,
  subscribeStaffList,
  type ClassChatMessage,
  type ClassChatThread,
} from '../../services/firestoreService';
import {
  CHANNEL_LABEL,
  CHAT_TEXT_MAX,
  chatThreadId,
  isThreadForTeacher,
  isThreadUnread,
  type ChatChannel,
  type ChatSide,
} from '../../lib/classChat';
import { advisorsOfRoom } from '../../lib/advisors';
import type { UserProfile } from '../../types/auth';

interface ChatTarget {
  studentId: string;
  studentName: string;
  room: string;
  channel: ChatChannel;
  /** uid ของสมาชิกช่องนั้น (ผู้ปกครอง/นักเรียน) — ว่าง = ยังไม่ได้เชื่อมบัญชี */
  memberUid: string;
  /** ครูที่ปรึกษาที่เลือกคุยด้วย ('' = ท่านใดก็ได้) */
  targetStaffId?: string;
  /** ชื่อครูที่เลือก (แสดงหัวห้องสนทนาฝั่งสมาชิก) */
  targetName?: string;
}

interface ThreadViewProps {
  target: ChatTarget;
  side: ChatSide;
  viewerUid: string;
  viewerName: string;
  /** ตัวกรอง query ให้ตรง rules: สมาชิก = memberUid ของตัวเอง, ครู = ห้อง */
  scope: { memberUid?: string; room?: string };
  heightClass?: string;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/** หน้าต่างสนทนาหนึ่งช่อง (นักเรียนหนึ่งคน × ช่องหนึ่ง) — ใช้ร่วมกันทั้งครู/ผู้ปกครอง/นักเรียน */
export function ChatThreadView({ target, side, viewerUid, viewerName, scope, heightClass = 'h-[520px]' }: ThreadViewProps) {
  const [messages, setMessages] = useState<ClassChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([]);
    return subscribeClassMessages(setMessages, { studentId: target.studentId, channel: target.channel, targetStaffId: target.targetStaffId || '', ...scope });
  }, [target.studentId, target.channel, target.targetStaffId, scope.memberUid, scope.room]);

  // เปิดดู/มีข้อความใหม่เข้ามาระหว่างเปิดอยู่ = อ่านแล้ว
  const lastId = messages.length ? messages[messages.length - 1].id : '';
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
    if (lastId) void markClassThreadRead(target.studentId, target.channel, side, target.targetStaffId || '');
  }, [lastId, target.studentId, target.channel, target.targetStaffId, side]);

  const mySenderRole = side === 'TEACHER' ? 'TEACHER' : target.channel;
  const canSend = !!target.memberUid;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setError('');
    setBusy(true);
    try {
      await sendClassMessage({
        studentId: target.studentId,
        studentName: target.studentName,
        channel: target.channel,
        room: target.room,
        memberUid: target.memberUid,
        side,
        targetStaffId: target.targetStaffId || '',
        senderUid: viewerUid,
        senderName: viewerName,
        text,
      });
      setText('');
    } catch (err) {
      console.error('[classChat] send failed:', err);
      setError('ส่งข้อความไม่สำเร็จ (ยังไม่ได้ส่ง) กรุณาลองอีกครั้ง');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`bg-slate-900/70 border border-slate-800 rounded-3xl p-5 backdrop-blur-md shadow-xl flex flex-col ${heightClass}`}>
      <div className="pb-3 border-b border-slate-800 flex items-start gap-2">
        <Lock className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-white">
            {side === 'TEACHER'
              ? `${target.studentName} — ช่อง${CHANNEL_LABEL[target.channel]}${target.targetStaffId ? ' (ถึงครูท่านนี้โดยเฉพาะ)' : ' (ถึงครูที่ปรึกษาท่านใดก็ได้)'}`
              : `สนทนากับ${target.targetStaffId ? (target.targetName || 'ครูที่ปรึกษาที่เลือก') : `ครูที่ปรึกษา (${target.room || '-'}) ท่านใดก็ได้`}`}
          </h3>
          <p className="text-[11px] text-slate-400">
            ช่องส่วนตัว: เห็นเฉพาะครูที่ปรึกษาของห้องและ{CHANNEL_LABEL[target.channel]}ของ {target.studentName} เท่านั้น{target.targetStaffId ? ' (เลือกครูเฉพาะท่าน — ครูท่านอื่นไม่ถูกแจ้งเตือน)' : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
        {messages.length === 0 && (
          <p className="text-xs text-slate-500 text-center pt-8">ยังไม่มีข้อความ — เริ่มสนทนาได้เลย</p>
        )}
        {messages.map((m) => {
          const mine = m.senderUid === viewerUid || m.senderRole === mySenderRole;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-slate-500 mb-1 px-1">{m.senderName} • {fmtTime(m.sentAt)}</span>
              <div
                className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                  mine
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/60'
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {canSend ? (
        <form onSubmit={handleSend} className="pt-3 border-t border-slate-800 flex gap-2">
          <input
            type="text"
            value={text}
            maxLength={CHAT_TEXT_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="พิมพ์ข้อความ..."
            aria-label="ข้อความ"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>ส่ง</span>
          </button>
        </form>
      ) : (
        <p className="pt-3 border-t border-slate-800 text-xs text-amber-400">
          ยังส่งข้อความไม่ได้ — {CHANNEL_LABEL[target.channel]}ยังไม่ได้เชื่อมบัญชีเข้าระบบ
        </p>
      )}
      {error && <p role="alert" className="text-xs text-rose-400 pt-1">{error}</p>}
    </div>
  );
}

interface MemberProps {
  channel: ChatChannel;
  student: { studentId: string; name: string; room?: string };
  viewerUid: string;
  viewerName: string;
}

/** ฝั่งผู้ปกครอง (channel=PARENT) / นักเรียน (channel=STUDENT): ช่องเดียวกับครูประจำชั้น */
export function ClassChatMemberView({ channel, student, viewerUid, viewerName }: MemberProps) {
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  useEffect(() => subscribeStaffList(setStaffList), []);
  const advisors = useMemo(() => advisorsOfRoom(staffList, student.room), [staffList, student.room]);
  const [targetStaffId, setTargetStaffId] = useState('');
  useEffect(() => { setTargetStaffId(''); }, [student.studentId]);
  const target = useMemo<ChatTarget>(() => ({
    studentId: student.studentId,
    studentName: student.name,
    room: student.room || '',
    channel,
    memberUid: viewerUid,
    targetStaffId,
    targetName: advisors.find(a => a.staffId === targetStaffId)?.name,
  }), [student.studentId, student.name, student.room, channel, viewerUid, targetStaffId, advisors]);
  const scope = useMemo(() => ({ memberUid: viewerUid }), [viewerUid]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label htmlFor="chat-target" className="text-slate-300">สนทนากับ:</label>
        <select
          id="chat-target"
          value={targetStaffId}
          onChange={(e) => setTargetStaffId(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
        >
          <option value="">ครูที่ปรึกษาท่านใดก็ได้</option>
          {advisors.map(a => <option key={a.staffId} value={a.staffId}>{a.name}</option>)}
        </select>
      </div>
      <ChatThreadView target={target} side="MEMBER" viewerUid={viewerUid} viewerName={viewerName} scope={scope} />
    </div>
  );
}

interface TeacherProps {
  room: string;
  students: { studentId: string; name: string; parentUid?: string; studentUid?: string }[];
  viewerUid: string;
  viewerName: string;
  /** staffId ของครูที่ล็อกอิน — ใช้แยกห้องสนทนาที่ผู้ปกครอง/นักเรียนเลือกครูท่านอื่น */
  myStaffId?: string;
}

/** ฝั่งครูประจำชั้น: เลือกช่อง (ผู้ปกครอง/นักเรียน) → เลือกนักเรียน → สนทนา, จุดแดง = ยังไม่ได้อ่าน */
export function ClassChatTeacherView({ room, students, viewerUid, viewerName, myStaffId }: TeacherProps) {
  const [channel, setChannel] = useState<ChatChannel>('PARENT');
  const [selectedKey, setSelectedKey] = useState(''); // `${studentId}|${targetStaffId}`
  const [allThreads, setThreads] = useState<ClassChatThread[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!room) { setThreads([]); return; }
    return subscribeClassChatThreads(setThreads, { room });
  }, [room]);

  // เห็นเฉพาะห้องสนทนาที่ส่งถึงเรา (เลือกเราโดยเฉพาะ หรือ "ท่านใดก็ได้")
  const threads = useMemo(() => allThreads.filter(t => isThreadForTeacher(t, myStaffId)), [allThreads, myStaffId]);
  const threadMap = useMemo(() => new Map(threads.map(t => [t.id, t])), [threads]);
  const channelUnread = (c: ChatChannel) => threads.filter(t => t.channel === c && isThreadUnread(t, 'TEACHER')).length;

  // แถวต่อ (นักเรียน, ห้องสนทนา): มีห้องสนทนาที่ส่งถึงเรา → แสดงตามจริง, ไม่มีเลย → แถวเริ่มคุยแบบ "ท่านใดก็ได้"
  const list = useMemo(() => {
    const q = search.trim();
    return students
      .filter(s => !q || s.name.includes(q) || s.studentId.includes(q))
      .flatMap(s => {
        const mine = threads.filter(t => t.studentId === s.studentId && t.channel === channel);
        const rows = mine.length ? mine : [undefined];
        return rows.map(t => ({ s, t, targetStaffId: t?.targetStaffId || '' }));
      })
      .sort((a, b) => (b.t?.lastAt || '').localeCompare(a.t?.lastAt || '') || a.s.studentId.localeCompare(b.s.studentId));
  }, [students, search, threads, channel]);

  const [selStudentId, selTarget] = selectedKey.split('|');
  const selected = students.find(s => s.studentId === selStudentId);
  const target: ChatTarget | null = selected
    ? {
        studentId: selected.studentId,
        studentName: selected.name,
        room,
        channel,
        memberUid: (channel === 'PARENT' ? selected.parentUid : selected.studentUid) || '',
        targetStaffId: selTarget || '',
      }
    : null;
  const scope = useMemo(() => ({ room }), [room]);

  if (!room) return <p className="text-xs text-slate-400">บัญชีนี้ยังไม่ได้กำหนดห้องประจำชั้น</p>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800 rounded-3xl p-4 space-y-3">
        <div className="flex gap-1.5 p-1 bg-slate-800/60 rounded-xl">
          {(['PARENT', 'STUDENT'] as ChatChannel[]).map(c => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 ${
                channel === c ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {CHANNEL_LABEL[c]}
              {channelUnread(c) > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] leading-4">{channelUnread(c)}</span>
              )}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ/รหัสนักเรียน"
          aria-label="ค้นหานักเรียน"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
        />
        <ul className="max-h-[420px] overflow-y-auto space-y-1">
          {list.map(({ s, t, targetStaffId }) => {
            const unread = isThreadUnread(t, 'TEACHER');
            const linked = !!(channel === 'PARENT' ? s.parentUid : s.studentUid);
            const rowKey = `${s.studentId}|${targetStaffId}`;
            return (
              <li key={rowKey}>
                <button
                  onClick={() => setSelectedKey(rowKey)}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs cursor-pointer ${
                    selectedKey === rowKey ? 'bg-indigo-500/15 border-indigo-500/40' : 'border-transparent hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold truncate ${unread ? 'text-white' : 'text-slate-300'}`}>{s.name}{targetStaffId ? ' · ถึงคุณโดยเฉพาะ' : ''}</span>
                    {unread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" aria-label="ยังไม่ได้อ่าน" />}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {t?.lastText ? t.lastText : linked ? 'ยังไม่มีข้อความ' : `${CHANNEL_LABEL[channel]}ยังไม่ได้เชื่อมบัญชี`}
                  </div>
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="text-xs text-slate-500 px-2 py-4">ไม่พบนักเรียน</li>}
        </ul>
      </div>
      <div className="lg:col-span-8">
        {target ? (
          <div key={`${target.studentId}_${channel}_${target.targetStaffId || ''}`}>
            <ChatThreadView target={target} side="TEACHER" viewerUid={viewerUid} viewerName={viewerName} scope={scope} />
          </div>
        ) : (
          <div className="h-[520px] bg-slate-900/40 border border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-500 gap-2">
            <MessageSquare className="w-8 h-8" />
            <p className="text-xs">เลือกนักเรียนทางซ้ายเพื่อเริ่มสนทนา</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** ห้องสนทนาทั้งหมดของสมาชิก (ผู้ปกครอง/นักเรียน) แบบสด — ใช้ทำ badge เมนู + ข้อความล่าสุดบนภาพรวม */
export function useMemberThreads(memberUid: string | undefined): ClassChatThread[] {
  const [threads, setThreads] = useState<ClassChatThread[]>([]);
  useEffect(() => {
    if (!memberUid) { setThreads([]); return; }
    return subscribeClassChatThreads(setThreads, { memberUid });
  }, [memberUid]);
  return threads;
}

/** จำนวนห้องสนทนาที่ครูประจำชั้นยังไม่ได้อ่าน (ทั้งสองช่อง) — ทำ badge เมนู "ข้อความ" */
export function useRoomChatUnread(room: string | undefined, myStaffId?: string): number {
  const [threads, setThreads] = useState<ClassChatThread[]>([]);
  useEffect(() => {
    if (!room) { setThreads([]); return; }
    return subscribeClassChatThreads(setThreads, { room });
  }, [room]);
  return threads.filter(t => isThreadForTeacher(t, myStaffId) && isThreadUnread(t, 'TEACHER')).length;
}
