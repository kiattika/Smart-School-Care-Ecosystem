import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, ShieldAlert, X } from 'lucide-react';
import { useStore } from '../../store';
import { Student } from '../../types';
import {
  EIGHT_Q_ITEMS,
  EIGHT_Q_RISK_LABEL,
  EightQAnswers,
  NINE_Q_ITEMS,
  NINE_Q_OPTIONS,
  NINE_Q_RISK_LABEL,
  NINE_Q_TOTAL_MAX,
  PARENT_NOTICE_METHOD_LABEL,
  ParentNoticeMethod,
  ParentNoticeScope,
  eightQUnlocked,
  parentNoticeReasons,
  pickNineQBasis,
  scoreEightQ,
  screeningCapabilities,
} from '../../lib/depressionScreening';
import { StudentScreeningRecord } from '../../hooks/useDepressionScreening';
import {
  NineQGrantDoc,
  ParentNoticeDoc,
  loadNineQGrants,
  loadParentNotices,
  openNineQGrant,
  recordParentNotice,
  revokeNineQGrant,
  saveEightQ,
} from '../../services/screeningService';
import { EightQuestionForm, EMPTY_EIGHT_Q } from './EightQuestionForm';
import { StudentPicker } from './StudentPicker';
import { DatePicker } from './DatePicker';
import { TimePicker } from './TimePicker';

type Viewer = 'GUIDANCE_COUNSELOR' | 'HOMEROOM_TEACHER';

const LEVEL_CHIP: Record<string, string> = {
  NONE: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  MILD: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  LOW: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  MODERATE: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  SEVERE: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
};

const severityRank = (r: StudentScreeningRecord): number => {
  if (r.eightQ?.urgentReferral) return 100;
  if (r.nineSummary?.redFlagItem9) return 90;
  if (r.eightQ && r.eightQ.totalScore > 0) return 80 + Math.min(r.eightQ.totalScore, 9);
  if (r.eightQFlag?.hasCase) return 70;
  const nine = { NONE: 0, MILD: 1, MODERATE: 2, SEVERE: 3 }[r.nineSummary?.riskLevel ?? 'NONE'];
  return nine * 10 + (r.twoQ?.isPositive ? 5 : 0);
};

/**
 * คัดกรองซึมเศร้า/ฆ่าตัวตาย 2Q → 9Q → 8Q สำหรับครู — ใช้ร่วมกันใน GuidancePortal (ครูแนะแนว: เห็นเต็ม) และ AdvisorPortal
 * (ครูที่ปรึกษา: เห็นเท่าที่ firestore.rules อนุญาต — ตาราง screeningCapabilities() ตัวเดียวกับที่ rules ถูกทดสอบเทียบ)
 * ปุ่ม "เปิด 9Q ให้นักเรียนคนนี้" / "บันทึก 8Q" แสดงตามเงื่อนไขลำดับ; ไม่ส่งแจ้งเตือนผู้ปกครองอัตโนมัติ — มีแค่คำเตือน + บันทึกว่าแจ้งแล้ว
 * ⚠ ข้อมูลอ่อนไหวเกี่ยวกับความปลอดภัยของเด็ก: รายงานจุดตัดสินใจเอง/TODO อยู่ที่ docs/depression-screening.md
 */
export function DepressionScreeningPanel({
  viewer, hasActiveCounselor, statusKnown, students, records, loading, error, onChanged, allowPickAnyStudent,
}: {
  viewer: Viewer;
  hasActiveCounselor: boolean;
  statusKnown: boolean;
  students: Student[];
  records: Map<string, StudentScreeningRecord>;
  loading: boolean;
  error: string | null;
  /** ครูที่ปรึกษา: โหลดข้อมูลใหม่หลังทำรายการ (อ่านรายคน ไม่ live) */
  onChanged?: () => void;
  /** ครูแนะแนว: เลือกนักเรียนคนใดก็ได้เพื่อเปิด 9Q (แถวในตารางแสดงเฉพาะคนที่มีผลคัดกรอง) */
  allowPickAnyStudent: boolean;
}) {
  const user = useStore((s) => s.user);
  const caps = screeningCapabilities(viewer, hasActiveCounselor);
  const studentById = useMemo(() => new Map(students.map((s) => [s.studentId, s])), [students]);
  const nameOf = (sid: string) => { const s = studentById.get(sid); return s ? (s.fullName || s.name) : `รหัส ${sid}`; };

  const [selectedId, setSelectedId] = useState<string>('');
  const rowIds = useMemo(() => {
    const ids = allowPickAnyStudent ? [...records.keys()] : students.map((s) => s.studentId);
    if (selectedId && !ids.includes(selectedId)) ids.push(selectedId);
    return ids;
  }, [allowPickAnyStudent, records, students, selectedId]);
  const rows = useMemo(
    () => rowIds
      .map((sid) => records.get(sid) ?? { studentId: sid, twoQ: null, nineSummary: null, nineDetail: null, eightQ: null, eightQFlag: null, progress: null })
      .filter((r) => !allowPickAnyStudent || r.twoQ || r.nineSummary || r.eightQ || r.eightQFlag || r.studentId === selectedId)
      .sort((a, b) => severityRank(b) - severityRank(a)),
    [rowIds, records, allowPickAnyStudent, selectedId],
  );

  const redFlags = rows.filter((r) => r.nineSummary?.redFlagItem9 || r.eightQ?.urgentReferral);
  const eightQCases = rows.filter((r) => !r.eightQ?.urgentReferral && (r.eightQ ? r.eightQ.totalScore > 0 : r.eightQFlag?.hasCase));
  const selected = selectedId ? (rows.find((r) => r.studentId === selectedId) ?? null) : null;

  return (
    <div className="space-y-5" data-testid="depression-screening-panel">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-1">
        <h3 className="text-base font-bold text-white flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-rose-400" /> คัดกรองซึมเศร้า/ความเสี่ยงฆ่าตัวตาย — 2Q → 9Q → 8Q</h3>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          2Q นักเรียนทำเอง · 9Q เปิดให้นักเรียนทำเมื่อ 2Q ล่าสุดเป็นบวก หรือเมื่อครูเปิดให้ · 8Q ครูกรอกแทนนักเรียนระหว่างพูดคุย (เปิดได้เมื่อ 9Q ล่าสุดรวม ≥7 หรือมีธงแดงข้อ 9)
          · เกณฑ์ตามคู่มือกรมสุขภาพจิต/สพฐ. · นักเรียนไม่เห็นผล 9Q/8Q
        </p>
        {viewer === 'HOMEROOM_TEACHER' && (
          <p className="text-[11px] text-amber-300" data-testid="homeroom-visibility-note">
            {hasActiveCounselor
              ? `ท่านเห็นเฉพาะระดับความเสี่ยงของ 9Q และสถานะ "มีเคสอยู่ในการดูแล" ของ 8Q — คำตอบ/คะแนนดิบเป็นของครูแนะแนว${statusKnown ? '' : ' (ยังไม่ทราบสถานะครูแนะแนวของระบบ จึงจำกัดสิทธิ์ไว้ก่อน)'}`
              : 'ขณะนี้ไม่มีครูแนะแนวที่ใช้งานอยู่ในระบบ — ท่านอ่านคำตอบ 9Q และบันทึก/อ่าน 8Q แทนครูแนะแนวได้'}
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>โหลดข้อมูลบางส่วนไม่สำเร็จ: {error}</span>
        </div>
      )}

      {/* ── ธงแดง: ข้อ 9 ของ 9Q และ 8Q ≥17 — เด่นแยกจากรายการปกติ ── */}
      {(redFlags.length > 0 || eightQCases.length > 0) && (
        <div className="rounded-2xl border-2 border-rose-500/60 bg-rose-950/30 p-4 space-y-2" data-testid="red-flag-strip">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-sm"><AlertTriangle className="w-4 h-4" /> ธงแดง — ต้องติดตามทันที</div>
          <ul className="space-y-1.5">
            {redFlags.map((r) => (
              <li key={r.studentId} className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" onClick={() => setSelectedId(r.studentId)} className="font-bold text-white underline underline-offset-2 hover:text-rose-200">{nameOf(r.studentId)}</button>
                {r.eightQ?.urgentReferral && <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">8Q ≥17 — ส่งต่อโรงพยาบาลด่วน</span>}
                {r.nineSummary?.redFlagItem9 && <span className="px-2 py-0.5 rounded-full bg-rose-500/80 text-white text-[10px] font-bold">9Q ข้อ 9: คิดทำร้ายตนเอง</span>}
              </li>
            ))}
            {eightQCases.map((r) => (
              <li key={`c-${r.studentId}`} className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" onClick={() => setSelectedId(r.studentId)} className="font-bold text-white underline underline-offset-2 hover:text-rose-200">{nameOf(r.studentId)}</button>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                  {r.eightQ ? `8Q มีคะแนน (${r.eightQ.totalScore} — ${EIGHT_Q_RISK_LABEL[r.eightQ.riskLevel]})` : '8Q: มีเคสอยู่ในการดูแล'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {allowPickAnyStudent && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
          <label className="text-xs font-bold text-slate-300">เลือกนักเรียนเพื่อเปิด 9Q / ดูผล / บันทึก 8Q</label>
          <StudentPicker mode="single" students={students} value={selectedId} onSelect={setSelectedId} placeholder="ค้นหาด้วยเลขประจำตัวหรือชื่อ" />
        </div>
      )}

      {/* ── ตารางนักเรียน ── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังโหลดข้อมูล...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500" data-testid="screening-empty">ยังไม่มีผลคัดกรอง</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="px-4 py-2.5 font-medium">นักเรียน</th>
                  <th className="px-4 py-2.5 font-medium">2Q</th>
                  <th className="px-4 py-2.5 font-medium">9Q (ระดับ)</th>
                  <th className="px-4 py-2.5 font-medium">8Q</th>
                  <th className="px-4 py-2.5 font-medium text-right">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rows.map((r) => (
                  <tr key={r.studentId} className={selectedId === r.studentId ? 'bg-purple-500/5' : 'hover:bg-slate-800/30'} data-testid={`screening-row-${r.studentId}`}>
                    <td className="px-4 py-2.5"><div className="font-bold text-white">{nameOf(r.studentId)}</div><div className="text-[10px] text-slate-500 font-mono">{studentById.get(r.studentId)?.room || ''} · ID {r.studentId}</div></td>
                    <td className="px-4 py-2.5">
                      {r.twoQ ? (
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${r.twoQ.isPositive ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>{r.twoQ.isPositive ? 'บวก' : 'ลบ'}</span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.nineSummary ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${LEVEL_CHIP[r.nineSummary.riskLevel]}`}>{NINE_Q_RISK_LABEL[r.nineSummary.riskLevel]}</span>
                          {r.nineSummary.redFlagItem9 && <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold">ธงแดง ข้อ 9</span>}
                        </div>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {r.eightQ ? (
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${LEVEL_CHIP[r.eightQ.riskLevel]}`}>{r.eightQ.totalScore} · {EIGHT_Q_RISK_LABEL[r.eightQ.riskLevel]}</span>
                      ) : r.eightQFlag ? (
                        <span className="text-[10px] text-slate-300">มีเคสในการดูแล: <b className={r.eightQFlag.hasCase ? 'text-amber-300' : 'text-slate-400'}>{r.eightQFlag.hasCase ? 'ใช่' : 'ไม่'}</b></span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={() => setSelectedId(r.studentId)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-500">จัดการ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId && (
        <div key={selectedId}>
        <StudentScreeningDetail
          studentId={selectedId}
          name={nameOf(selectedId)}
          room={studentById.get(selectedId)?.room || ''}
          record={selected ?? { studentId: selectedId, twoQ: null, nineSummary: null, nineDetail: null, eightQ: null, eightQFlag: null, progress: null }}
          viewer={viewer}
          hasActiveCounselor={hasActiveCounselor}
          actor={user ? { uid: user.uid, name: user.displayName || (viewer === 'GUIDANCE_COUNSELOR' ? 'ครูแนะแนว' : 'ครูที่ปรึกษา') } : null}
          onClose={() => setSelectedId('')}
          onChanged={onChanged}
          capsOpenNineQ={caps.openNineQ}
          capsWriteEightQ={caps.write8Q}
          capsRead9QDetail={caps.read9QDetail}
          capsRead8QDetail={caps.read8QDetail}
        />
        </div>
      )}
    </div>
  );
}

// ═══════════════ รายละเอียดนักเรียน 1 คน ═══════════════

function StudentScreeningDetail({
  studentId, name, room, record, viewer, hasActiveCounselor, actor, onClose, onChanged,
  capsOpenNineQ, capsWriteEightQ, capsRead9QDetail, capsRead8QDetail,
}: {
  studentId: string; name: string; room: string; record: StudentScreeningRecord;
  viewer: Viewer; hasActiveCounselor: boolean;
  actor: { uid: string; name: string } | null;
  onClose: () => void; onChanged?: () => void;
  capsOpenNineQ: boolean; capsWriteEightQ: boolean; capsRead9QDetail: boolean; capsRead8QDetail: boolean;
}) {
  const [grants, setGrants] = useState<Array<NineQGrantDoc & { id: string }>>([]);
  const [notices, setNotices] = useState<ParentNoticeDoc[]>([]);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showEightQ, setShowEightQ] = useState(false);
  const [eightQ, setEightQ] = useState<EightQAnswers>(EMPTY_EIGHT_Q);
  const [showErrors, setShowErrors] = useState(false);
  const [grantNote, setGrantNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadNineQGrants(studentId).then((g) => { if (!cancelled) setGrants(g as Array<NineQGrantDoc & { id: string }>); }).catch((e) => console.warn('[screening] grants load notice:', e?.message || e));
    loadParentNotices(studentId).then((n) => { if (!cancelled) setNotices(n); }).catch((e) => console.warn('[screening] notices load notice:', e?.message || e));
    return () => { cancelled = true; };
  }, [studentId, tick]);

  const used = new Set(record.progress?.usedBasisIds ?? []);
  const pendingGrants = grants.filter((g) => !used.has(g.id));
  const openFrom2Q = !!record.twoQ && pickNineQBasis({ twoQ: record.twoQ, grantIds: [], usedBasisIds: [...used] })?.kind === '2Q';
  const unlocked = eightQUnlocked(record.nineSummary);

  const reasons = parentNoticeReasons({
    nineQRisk: record.nineSummary?.riskLevel,
    nineQRedFlag: record.nineSummary?.redFlagItem9,
    eightQTotal: record.eightQ ? record.eightQ.totalScore : record.eightQFlag?.hasCase ? 1 : 0,
  });

  const run = async (fn: () => Promise<void>, okText: string) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ kind: 'ok', text: okText }); setTick((t) => t + 1); onChanged?.(); }
    catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setMsg({ kind: 'error', text: /permission|insufficient/i.test(text) ? 'ทำรายการไม่สำเร็จ: ระบบไม่อนุญาต (ตรวจสิทธิ์/เงื่อนไขลำดับ 9Q → 8Q)' : `ทำรายการไม่สำเร็จ: ${text}` });
    } finally { setBusy(false); }
  };

  const handleOpenNineQ = () => {
    if (!actor) return;
    return run(async () => { await openNineQGrant(studentId, { uid: actor.uid, name: actor.name, role: viewer }, grantNote); setGrantNote(''); }, `เปิด 9Q ให้ ${name} แล้ว — นักเรียนจะเห็นแบบประเมินในหน้าสุขภาพของตัวเอง`);
  };

  const handleSaveEightQ = () => {
    setShowErrors(true);
    const scored = scoreEightQ(eightQ);
    if (!('totalScore' in scored) || !actor) return;
    return run(async () => {
      await saveEightQ({ studentId, result: scored, recorder: actor });
      setShowEightQ(false); setEightQ(EMPTY_EIGHT_Q); setShowErrors(false);
    }, 'บันทึกผล 8Q เรียบร้อย');
  };

  return (
    <div className="bg-[#121624] border border-purple-500/30 rounded-2xl p-5 space-y-5" data-testid="screening-detail">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-white">{name} <span className="text-slate-400 font-mono text-xs">· {room} · ID {studentId}</span></h4>
        </div>
        <button type="button" onClick={onClose} aria-label="ปิด" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
      </div>

      {msg && (
        <div role={msg.kind === 'error' ? 'alert' : 'status'} className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${msg.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
          {msg.kind === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}<span>{msg.text}</span>
        </div>
      )}

      {/* 2Q / 9Q / 8Q ผล */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 space-y-1">
          <div className="font-bold text-slate-200">2Q</div>
          {record.twoQ ? <div className="text-slate-300">{record.twoQ.isPositive ? 'บวก (มีความเสี่ยง)' : 'ลบ'} · {record.twoQ.conductedAt}</div> : <div className="text-slate-500">ยังไม่ได้ทำ</div>}
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 space-y-1" data-testid="detail-9q">
          <div className="font-bold text-slate-200">9Q</div>
          {record.nineSummary ? (
            <>
              <div className="text-slate-300">ระดับ <b>{NINE_Q_RISK_LABEL[record.nineSummary.riskLevel]}</b> · {record.nineSummary.conductedAt}{record.nineSummary.redFlagItem9 && <b className="ml-1 text-rose-400">ธงแดงข้อ 9</b>}</div>
              {capsRead9QDetail && record.nineDetail ? (
                <div className="text-slate-300">คะแนนรวม <b className="font-mono">{record.nineDetail.totalScore}/{NINE_Q_TOTAL_MAX}</b></div>
              ) : (
                <div className="text-[10px] text-slate-500" data-testid="9q-detail-hidden">คำตอบรายข้อ/คะแนนดิบ: เฉพาะครูแนะแนว</div>
              )}
            </>
          ) : <div className="text-slate-500">ยังไม่ได้ทำ</div>}
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 space-y-1" data-testid="detail-8q">
          <div className="font-bold text-slate-200">8Q</div>
          {capsRead8QDetail && record.eightQ ? (
            <div className="text-slate-300">คะแนน <b className="font-mono">{record.eightQ.totalScore}</b> · {EIGHT_Q_RISK_LABEL[record.eightQ.riskLevel]}{record.eightQ.urgentReferral && <b className="ml-1 text-rose-400">ส่งต่อโรงพยาบาลด่วน</b>} · {record.eightQ.conductedAt}</div>
          ) : (
            <div className="text-slate-300">มีเคสอยู่ในการดูแล: <b className={record.eightQFlag?.hasCase ? 'text-amber-300' : 'text-slate-400'}>{record.eightQFlag?.hasCase ? 'ใช่' : 'ไม่'}</b>{!capsRead8QDetail && <span className="block text-[10px] text-slate-500">คะแนนเป็นของครูแนะแนว</span>}</div>
          )}
        </div>
      </div>

      {capsRead9QDetail && record.nineDetail && (
        <details className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-200">คำตอบ 9Q รายข้อ</summary>
          <ol className="mt-2 space-y-1">
            {NINE_Q_ITEMS.map((t, i) => (
              <li key={i} className={i === 8 && record.nineDetail!.answers[8] > 0 ? 'text-rose-300 font-bold' : 'text-slate-300'}>
                {i + 1}. {t} — <b>{NINE_Q_OPTIONS.find((o) => o.value === record.nineDetail!.answers[i])?.label ?? '-'}</b>
              </li>
            ))}
          </ol>
        </details>
      )}
      {capsRead8QDetail && record.eightQ && (
        <details className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-200">คำตอบ 8Q รายข้อ (บันทึกโดย {record.eightQ.recordedByName})</summary>
          <ol className="mt-2 space-y-1">
            {EIGHT_Q_ITEMS.map((it, i) => (
              <li key={it.n} className="text-slate-300">
                {it.n}. {it.text} — <b>{record.eightQ!.answers[i] ? 'มี' : 'ไม่มี'}</b>
                {it.followUp && record.eightQ!.answers[i] && record.eightQ!.q3CanControl !== null && <> (ควบคุมความคิดได้: <b>{record.eightQ!.q3CanControl ? 'ได้' : 'ไม่ได้'}</b>)</>}
              </li>
            ))}
          </ol>
        </details>
      )}

      {/* เปิด 9Q */}
      {capsOpenNineQ && (
        <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 space-y-2 text-xs" data-testid="open-9q">
          <div className="font-bold text-slate-200">เปิด 9Q ให้นักเรียนคนนี้</div>
          {openFrom2Q && <p className="text-amber-300">2Q ล่าสุดเป็นบวก — นักเรียนทำ 9Q ได้อยู่แล้ว 1 ครั้ง (ยังไม่เคยทำจาก 2Q ฉบับนี้)</p>}
          {pendingGrants.length > 0 && (
            <ul className="space-y-1">
              {pendingGrants.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 text-slate-300">
                  <span>เปิดไว้แล้ว รอนักเรียนทำ — โดย {g.openedByName} ({g.openedAt}){g.note ? ` · ${g.note}` : ''}</span>
                  <button type="button" disabled={busy} onClick={() => run(async () => { await revokeNineQGrant(studentId, g.id); }, 'เพิกถอนใบอนุญาตแล้ว')} className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-200">เพิกถอน</button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <input value={grantNote} onChange={(e) => setGrantNote(e.target.value)} maxLength={300} placeholder="หมายเหตุ (ไม่บังคับ) เช่น นักเรียนมาปรึกษาเอง" aria-label="หมายเหตุการเปิด 9Q" className="flex-1 min-w-[12rem] bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500" />
            <button type="button" disabled={busy || !actor} onClick={handleOpenNineQ} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 inline-flex items-center gap-1.5">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} เปิด 9Q ให้นักเรียนคนนี้
            </button>
          </div>
        </div>
      )}

      {/* 8Q */}
      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 space-y-2 text-xs" data-testid="eightq-section">
        <div className="font-bold text-slate-200">บันทึก 8Q (ครูกรอกแทนนักเรียนระหว่างพูดคุย)</div>
        {!capsWriteEightQ ? (
          <p className="text-slate-400" data-testid="eightq-not-allowed">
            {viewer === 'HOMEROOM_TEACHER' && hasActiveCounselor ? 'ครูแนะแนวเป็นผู้บันทึก 8Q — ท่านเห็นเฉพาะสถานะ "มีเคสอยู่ในการดูแล"' : 'ไม่มีสิทธิ์บันทึก 8Q'}
          </p>
        ) : !unlocked ? (
          <p className="text-slate-400" data-testid="eightq-locked">8Q เปิดได้เมื่อ 9Q ล่าสุดรวม ≥7 (ระดับน้อยขึ้นไป) หรือมีธงแดงข้อ 9 — ยังไม่เข้าเงื่อนไข</p>
        ) : !showEightQ ? (
          <button type="button" onClick={() => setShowEightQ(true)} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 inline-flex items-center gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" /> {record.eightQ || record.eightQFlag ? 'บันทึก 8Q ครั้งใหม่' : 'บันทึก 8Q'}</button>
        ) : (
          <div className="space-y-3">
            <EightQuestionForm value={eightQ} onChange={setEightQ} disabled={busy} showErrors={showErrors} idPrefix={`eightq-${studentId}`} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setShowEightQ(false); setEightQ(EMPTY_EIGHT_Q); setShowErrors(false); }} disabled={busy} className="px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-white/5">ยกเลิก</button>
              <button type="button" onClick={handleSaveEightQ} disabled={busy || !actor} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 inline-flex items-center gap-1.5">{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} บันทึก 8Q</button>
            </div>
          </div>
        )}
      </div>

      {/* แจ้งผู้ปกครอง */}
      <ParentNoticeSection
        studentId={studentId} reasons={reasons} notices={notices} actor={actor} busy={busy} run={run}
        nineQId={record.nineSummary?.id} eightQId={record.eightQ?.id} canEightQ={capsRead8QDetail && !!record.eightQ}
      />
    </div>
  );
}

function ParentNoticeSection({
  studentId, reasons, notices, actor, busy, run, nineQId, eightQId, canEightQ,
}: {
  studentId: string; reasons: string[]; notices: ParentNoticeDoc[]; actor: { uid: string; name: string } | null; busy: boolean;
  run: (fn: () => Promise<void>, okText: string) => Promise<void> | undefined;
  nineQId?: string; eightQId?: string; canEightQ: boolean;
}) {
  const [scope, setScope] = useState<ParentNoticeScope>('NINE_Q');
  const [method, setMethod] = useState<ParentNoticeMethod | ''>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const screeningId = scope === 'NINE_Q' ? nineQId : eightQId;

  const submit = () => {
    setErr(null);
    if (!actor) return;
    if (!screeningId) { setErr(scope === 'NINE_Q' ? 'ยังไม่มีผล 9Q ให้ผูกบันทึกการแจ้ง' : 'ยังไม่มีผล 8Q ให้ผูกบันทึกการแจ้ง'); return; }
    if (!method) { setErr('กรุณาเลือกวิธีที่แจ้งผู้ปกครอง'); return; }
    if (!date || !time) { setErr('กรุณาระบุวันและเวลาที่แจ้ง'); return; }
    return run(async () => {
      await recordParentNotice(studentId, { scope, screeningId, by: actor, notifiedAt: `${date}T${time}`, method, note });
      setNote(''); setMethod('');
    }, 'บันทึกว่าแจ้งผู้ปกครองแล้ว');
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 space-y-2 text-xs" data-testid="parent-notice-section">
      <div className="font-bold text-slate-200">แจ้งผู้ปกครอง</div>
      <p className="text-[10px] text-slate-500">ระบบไม่ส่งแจ้งเตือนผู้ปกครองอัตโนมัติ — โทรหรือพบผู้ปกครองด้วยตนเอง แล้วบันทึกที่นี่</p>
      {reasons.length > 0 && (
        <div role="alert" className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-200" data-testid="parent-notice-warning">
          <b>ควรแจ้งผู้ปกครอง</b> (คำเตือน ไม่บังคับ): {reasons.join(' · ')}
        </div>
      )}
      {notices.length > 0 && (
        <ul className="space-y-1" data-testid="parent-notice-log">
          {notices.map((n) => (
            <li key={n.id} className="text-slate-300">✓ แจ้งแล้ว ({n.scope === 'NINE_Q' ? '9Q' : '8Q'}) โดย {n.notifiedByName} · {n.notifiedAt.replace('T', ' ')} · {PARENT_NOTICE_METHOD_LABEL[n.method]}{n.note ? ` · ${n.note}` : ''}</li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1"><span className="text-[10px] text-slate-400">เรื่องที่แจ้ง</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as ParentNoticeScope)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-slate-200">
            <option value="NINE_Q">ผล 9Q</option>
            {canEightQ && <option value="EIGHT_Q">ผล 8Q</option>}
          </select>
        </label>
        <label className="space-y-1"><span className="text-[10px] text-slate-400">วิธีที่แจ้ง</span>
          <select value={method} onChange={(e) => setMethod(e.target.value as ParentNoticeMethod | '')} className="w-full bg-slate-950 border border-white/10 rounded-lg px-2 py-2 text-xs text-slate-200">
            <option value="">— เลือก —</option>
            {(Object.keys(PARENT_NOTICE_METHOD_LABEL) as ParentNoticeMethod[]).map((m) => <option key={m} value={m}>{PARENT_NOTICE_METHOD_LABEL[m]}</option>)}
          </select>
        </label>
        <div className="space-y-1"><span className="text-[10px] text-slate-400">วันที่แจ้ง</span><DatePicker value={date} onChange={setDate} max={format(new Date(), 'yyyy-MM-dd')} ariaLabel="วันที่แจ้งผู้ปกครอง" /></div>
        <div className="space-y-1"><span className="text-[10px] text-slate-400">เวลา</span><TimePicker value={time} onChange={setTime} ariaLabel="เวลาที่แจ้งผู้ปกครอง" /></div>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="หมายเหตุ (ไม่บังคับ)" aria-label="หมายเหตุการแจ้งผู้ปกครอง" className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-purple-500" />
      {err && <p role="alert" className="text-rose-400">{err}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={submit} disabled={busy || !actor} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50">บันทึกว่าแจ้งผู้ปกครองแล้ว</button>
      </div>
    </div>
  );
}
