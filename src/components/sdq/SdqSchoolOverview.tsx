import React, { useMemo, useState } from 'react';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { SDQAssessment } from '../../types';
import { SDQ_TRIAGE_LABEL } from '../../lib/sdq';
import {
  PROFILE_ROWS, PROFILE_SOURCE_LABEL, ProfileSource, SUBSCALE_SHORT,
  buildClassProfile, buildRoomRows, concernList, pct, resultsOf, screensFor, triangulate,
} from '../../lib/sdqScreening';
import { SDQ_TRIAGE_CHIP } from '../shared/SdqStatusView';
import { SdqStudentDetail } from './SdqStudentDetail';

export interface OverviewStudent { studentId: string; name: string; room?: string; studentNo?: number | string | null; studentUid?: string }

const c = (n: number, of: number) => (of ? `${n} (${pct(n, of)}%)` : '—');

/**
 * ภาพรวมผลคัดกรอง SDQ ทั้งโรงเรียน — ผู้บริหาร (showNames=false: ตัวเลขรวม/รายห้องเท่านั้น)
 * และงานแนะแนว (showNames=true: + บัญชีรายชื่อกลุ่มเสี่ยง/มีปัญหา กดดูผล 3 มุมมองและประเมินซ้ำรอบที่ 2)
 */
export function SdqSchoolOverview({
  records, students, academicYear, term, yearReady, showNames, loading,
}: {
  records: SDQAssessment[]; students: OverviewStudent[]; academicYear: string; term: '1' | '2'; yearReady: boolean; showNames: boolean; loading?: boolean;
}) {
  const [source, setSource] = useState<ProfileSource>('TEACHER');
  const [openId, setOpenId] = useState<string | null>(null);
  const ids = useMemo(() => students.map(s => s.studentId), [students]);
  const byId = useMemo(() => new Map(students.map(s => [s.studentId, s])), [students]);
  const screens = useMemo(() => screensFor(records, ids, academicYear, source, 1), [records, ids, academicYear, source]);
  const profile = useMemo(() => buildClassProfile(screens, students.length), [screens, students.length]);
  const roomTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of students) if (s.room) m.set(s.room, (m.get(s.room) ?? 0) + 1);
    return m;
  }, [students]);
  const rooms = useMemo(() => buildRoomRows(screens, id => byId.get(id)?.room, roomTotals), [screens, byId, roomTotals]);
  const concerns = useMemo(() => (showNames ? concernList(screens) : []), [screens, showNames]);
  const round2Done = useMemo(() => records.filter(r => r.round === 2 && r.academicYear === academicYear).length, [records, academicYear]);
  const t = profile.rows.total;

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl space-y-5" data-testid="sdq-school-overview">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-400" /> สรุปผลการคัดกรอง SDQ ทั้งโรงเรียน · ปีการศึกษา {academicYear}</h3>
          <p className="text-xs text-slate-400">ประเมินแล้ว {t.n} จาก {students.length} คน (รอบที่ 1) · ประเมินซ้ำรอบที่ 2 แล้ว {round2Done} คน{showNames ? '' : ' · แสดงเป็นตัวเลขรวม ไม่แสดงรายบุคคล'}</p>
        </div>
        <select aria-label="ผลที่ใช้สรุป" value={source} onChange={e => setSource(e.target.value as ProfileSource)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200">
          {(Object.keys(PROFILE_SOURCE_LABEL) as ProfileSource[]).map(k => <option key={k} value={k}>{PROFILE_SOURCE_LABEL[k]}</option>)}
        </select>
      </div>
      {loading ? <p className="text-xs text-slate-500">กำลังโหลดข้อมูลสด…</p> : (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            {(['normal', 'risk', 'problem'] as const).map((k, i) => (
              <div key={k} className="bg-slate-950 rounded-xl border border-slate-800 p-3">
                <div className="text-[11px] text-slate-400">{['กลุ่มปกติ', 'กลุ่มเสี่ยง', 'กลุ่มมีปัญหา'][i]}</div>
                <div className={`text-xl font-black font-mono ${['text-emerald-400', 'text-amber-400', 'text-rose-400'][i]}`}>{t.n ? `${pct(t[k], t.n)}%` : '—'}</div>
                <div className="text-[10px] text-slate-500">{t[k]} คน</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead><tr className="text-slate-400 border-b border-white/10">
                <th className="text-left py-2 pr-2 font-medium">พฤติกรรม (SDQ 5 ด้าน)</th>
                <th className="py-2 px-2 font-medium">ปกติ</th><th className="py-2 px-2 font-medium">เสี่ยง</th><th className="py-2 px-2 font-medium">มีปัญหา</th><th className="py-2 px-2 font-medium">รวม</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {PROFILE_ROWS.map(r => {
                  const x = profile.rows[r.key]; const strength = r.key === 'prosocial';
                  return (
                    <tr key={r.key} className={r.key === 'total' ? 'font-bold text-slate-100' : 'text-slate-300'}>
                      <td className="py-1.5 pr-2">{r.label}</td>
                      <td className="py-1.5 px-2 text-center">{c(x.normal, x.n)}</td>
                      <td className="py-1.5 px-2 text-center">{strength ? '—' : c(x.risk, x.n)}</td>
                      <td className="py-1.5 px-2 text-center">{c(x.problem, x.n)}</td>
                      <td className="py-1.5 px-2 text-center">{x.n || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-500 mt-1">ด้านจุดแข็ง: ช่องปกติ = มีจุดแข็ง, ช่องมีปัญหา = ไม่มีจุดแข็ง</p>
          </div>

          <div className="overflow-x-auto">
            <h4 className="text-xs font-bold text-slate-200 mb-2">แยกรายห้อง (ผลรวม)</h4>
            <table className="w-full text-xs min-w-[520px]" data-testid="sdq-room-table">
              <thead><tr className="text-slate-400 border-b border-white/10">
                <th className="text-left py-2 pr-2 font-medium">ห้อง</th><th className="py-2 px-2 font-medium">ประเมินแล้ว</th>
                <th className="py-2 px-2 font-medium">ปกติ</th><th className="py-2 px-2 font-medium">เสี่ยง</th><th className="py-2 px-2 font-medium">มีปัญหา</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {rooms.map(r => (
                  <tr key={r.room} className="text-slate-300">
                    <td className="py-1.5 pr-2">{r.room}</td>
                    <td className="py-1.5 px-2 text-center">{r.assessed}/{r.total}</td>
                    <td className="py-1.5 px-2 text-center">{c(r.normal, r.assessed)}</td>
                    <td className="py-1.5 px-2 text-center">{c(r.risk, r.assessed)}</td>
                    <td className="py-1.5 px-2 text-center">{c(r.problem, r.assessed)}</td>
                  </tr>
                ))}
                {rooms.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-slate-500">ยังไม่มีข้อมูล</td></tr>}
              </tbody>
            </table>
          </div>

          {showNames && (
            <div className="space-y-2" data-testid="sdq-concern-list">
              <h4 className="text-xs font-bold text-slate-200">บัญชีรายชื่อนักเรียนกลุ่มเสี่ยง/มีปัญหา ({concerns.length} คน) — กดเพื่อดูผล 3 มุมมองและประเมินซ้ำ</h4>
              {concerns.length === 0 && <p className="text-xs text-slate-500">ไม่พบนักเรียนกลุ่มเสี่ยง/มีปัญหาตามผลที่เลือก</p>}
              <ul className="divide-y divide-white/5 border border-white/10 rounded-xl" role="list">
                {concerns.map(row => {
                  const s = byId.get(row.studentId);
                  const tri = triangulate(resultsOf(records, row.studentId, academicYear, 1));
                  const open = openId === row.studentId;
                  return (
                    <li key={row.studentId} className="p-3 space-y-3">
                      <button type="button" onClick={() => setOpenId(open ? null : row.studentId)} aria-expanded={open}
                        className="w-full flex flex-wrap items-center gap-2 text-left text-xs">
                        <span className="font-semibold text-slate-100">{s?.name ?? row.studentId}</span>
                        <span className="text-slate-500">{s?.room ?? ''}{s?.studentNo != null ? ` · เลขที่ ${s.studentNo}` : ''}</span>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${SDQ_TRIAGE_CHIP[row.overall]}`}>{SDQ_TRIAGE_LABEL[row.overall]}</span>
                        {row.prominent.length > 0 && <span className="text-[11px] text-slate-400">{row.prominent.map(k => SUBSCALE_SHORT[k]).join(', ')}</span>}
                        <span className="text-[11px] text-purple-300">{tri.title}</span>
                        <span className="ml-auto text-slate-400">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                      </button>
                      {open && s && (
                        <SdqStudentDetail student={{ studentId: s.studentId, name: s.name, studentUid: s.studentUid }} records={records}
                          academicYear={academicYear} term={term} yearReady={yearReady} canRound2 />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** ตัวห่อ: ผูกปี/ภาคเรียนปัจจุบัน + แปลงรายชื่อนักเรียนจาก useRealStudents */
export function SdqSchoolOverviewLive({ records, students, showNames, loading }: {
  records: SDQAssessment[];
  students: { studentId: string; name: string; fullName?: string; room?: string; studentNo?: number | string | null; studentUid?: string }[];
  showNames: boolean; loading?: boolean;
}) {
  const sem = useCurrentSemester();
  const list = useMemo(() => students.map(s => ({ studentId: s.studentId, name: s.fullName || s.name, room: s.room, studentNo: s.studentNo ?? null, studentUid: s.studentUid })), [students]);
  if (!sem.loading && !sem.isConfigured) return <p className="text-xs text-amber-300">ยังไม่ได้ตั้งปีการศึกษาปัจจุบัน — สรุปผลคัดกรองต้องใช้ปีการศึกษา</p>;
  return <SdqSchoolOverview records={records} students={list} academicYear={sem.academicYear} term={sem.term} yearReady={sem.isConfigured} showNames={showNames} loading={loading || sem.loading} />;
}
