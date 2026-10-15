import React, { useEffect, useMemo, useState } from 'react';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { subscribeAllSDQAssessments } from '../../services/firestoreService';
import { Printer, ClipboardList } from 'lucide-react';
import { SDQAssessment } from '../../types';
import { SDQ_TRIAGE_LABEL } from '../../lib/sdq';
import {
  PROFILE_ROWS, PROFILE_SOURCE_LABEL, ProfileSource, SdqRound, SUBSCALE_SHORT,
  buildClassProfile, concernList, pct, profileSummaryText, screensFor,
} from '../../lib/sdqScreening';

export interface ReportStudent { studentId: string; name: string; studentNo?: number | string | null }

const cell = (n: number, of: number) => (of ? `${n} คน (${pct(n, of)}%)` : '—');

/**
 * แบบสรุปการรายงานผลการคัดกรองนักเรียนในชั้นเรียน (ครูที่ปรึกษา — เมนูสถิติวิชาการ)
 * ส่วนที่ 1 ตาราง 5 ด้าน (จำนวน/ร้อยละ), ส่วนที่ 2 รายชื่อกลุ่มเสี่ยง/มีปัญหา, ส่วนที่ 3 สรุปและข้อเสนอแนะ + ลงนาม
 * ตัวเลขทั้งหมดคำนวณจากผลประเมินจริง; ช่องแนวทางช่วยเหลือ/ข้อเสนอแนะเป็นช่องกรอกเพื่อพิมพ์ (ไม่บันทึกลงระบบ)
 */
export function SdqClassReport({ room, students, records, academicYear, loading }: {
  room: string; students: ReportStudent[]; records: SDQAssessment[]; academicYear: string; loading?: boolean;
}) {
  const [source, setSource] = useState<ProfileSource>('TEACHER');
  const [round, setRound] = useState<SdqRound>(1);
  const ids = useMemo(() => students.map(s => s.studentId), [students]);
  const screens = useMemo(() => screensFor(records, ids, academicYear, round === 2 ? 'TEACHER' : source, round), [records, ids, academicYear, source, round]);
  const profile = useMemo(() => buildClassProfile(screens, students.length), [screens, students.length]);
  const concerns = useMemo(() => concernList(screens), [screens]);
  const byId = useMemo(() => new Map(students.map(s => [s.studentId, s])), [students]);
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [activityPlan, setActivityPlan] = useState('');
  const summary = profileSummaryText(profile);

  return (
    <div className="space-y-3" data-testid="sdq-class-report">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #sdq-class-sheet, #sdq-class-sheet * { visibility: visible !important; }
          #sdq-class-sheet { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important; box-shadow: none !important; }
          .sdq-no-print { display: none !important; }
          #sdq-class-sheet textarea { border: none !important; resize: none; }
        }
      `}</style>
      <div className="sdq-no-print bg-[#121624] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2"><ClipboardList className="w-4 h-4 text-purple-400" /> แบบสรุปการรายงานผลการคัดกรองนักเรียนในชั้นเรียน (SDQ)</h3>
          <p className="text-[11px] text-slate-400">ห้อง {room} · ปีการศึกษา {academicYear} · คำนวณจากผลประเมินจริง (ชื่ออยู่ในรายงานนี้ — ใช้ภายในระบบดูแลช่วยเหลือเท่านั้น)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select aria-label="รอบการประเมิน" value={round} onChange={e => setRound(Number(e.target.value) as SdqRound)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200">
            <option value={1}>รอบที่ 1 (ต้นปี)</option>
            <option value={2}>รอบที่ 2 (ติดตามผล ภาค 2)</option>
          </select>
          {round === 1 && (
            <select aria-label="ผลที่ใช้สรุป" value={source} onChange={e => setSource(e.target.value as ProfileSource)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200">
              {(Object.keys(PROFILE_SOURCE_LABEL) as ProfileSource[]).map(k => <option key={k} value={k}>{PROFILE_SOURCE_LABEL[k]}</option>)}
            </select>
          )}
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold"><Printer className="w-3.5 h-3.5" /> พิมพ์ / PDF</button>
        </div>
      </div>

      <div id="sdq-class-sheet" className="bg-white text-slate-900 rounded-xl p-4 sm:p-6 shadow-xl overflow-x-auto space-y-5" style={{ fontFamily: "'Sarabun','TH Sarabun New','Noto Sans Thai',sans-serif" }}>
        <div className="text-center space-y-0.5">
          <h2 className="text-base font-bold">แบบสรุปการรายงานผลการคัดกรองนักเรียนในชั้นเรียน</h2>
          <p className="text-xs">ชั้น {room} ปีการศึกษา {academicYear} · {round === 2 ? 'รอบที่ 2 (ติดตามผล มุมมองครู)' : `รอบที่ 1 · ${PROFILE_SOURCE_LABEL[source]}`}</p>
          <p className="text-xs">ประเมินแล้ว {profile.assessed} จาก {profile.total} คน</p>
        </div>
        {loading ? <p className="text-xs text-slate-500">กำลังโหลด…</p> : (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-bold">ส่วนที่ 1: ตารางสรุปภาพรวมพฤติกรรม 5 ด้านของนักเรียนในชั้นเรียน</h3>
              <table className="w-full text-xs border-collapse min-w-[560px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-1.5 text-left">พฤติกรรมที่ประเมิน (SDQ 5 ด้าน)</th>
                    <th className="border border-slate-300 p-1.5">กลุ่มปกติ</th>
                    <th className="border border-slate-300 p-1.5">กลุ่มเสี่ยง</th>
                    <th className="border border-slate-300 p-1.5">กลุ่มมีปัญหา</th>
                    <th className="border border-slate-300 p-1.5">รวม</th>
                  </tr>
                </thead>
                <tbody>
                  {PROFILE_ROWS.map(r => {
                    const c = profile.rows[r.key];
                    const strength = r.key === 'prosocial';
                    return (
                      <tr key={r.key} className={r.key === 'total' ? 'font-bold bg-slate-50' : ''}>
                        <td className="border border-slate-300 p-1.5">{r.label}</td>
                        <td className="border border-slate-300 p-1.5 text-center">{strength && c.n ? `มีจุดแข็ง ${cell(c.normal, c.n)}` : cell(c.normal, c.n)}</td>
                        <td className="border border-slate-300 p-1.5 text-center">{strength ? '—' : cell(c.risk, c.n)}</td>
                        <td className="border border-slate-300 p-1.5 text-center">{strength && c.n ? `ไม่มีจุดแข็ง ${cell(c.problem, c.n)}` : cell(c.problem, c.n)}</td>
                        <td className="border border-slate-300 p-1.5 text-center">{c.n ? `${c.n} คน (100%)` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[10px] text-slate-500">ด้านสัมพันธภาพทางสังคมเป็นด้านจุดแข็ง เกณฑ์แบ่งเป็น มี/ไม่มีจุดแข็ง · ผลประเมินรุ่นเก่าที่ไม่มีสถานะรายด้านนับเฉพาะแถวคะแนนรวม</p>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold">ส่วนที่ 2: ตารางสรุปรายชื่อนักเรียนกลุ่มเสี่ยงและกลุ่มมีปัญหา (เพื่อเฝ้าระวัง)</h3>
              {concerns.length === 0 ? <p className="text-xs text-slate-600">ไม่พบนักเรียนกลุ่มเสี่ยง/มีปัญหา</p> : (
                <table className="w-full text-xs border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 p-1.5">เลขที่</th>
                      <th className="border border-slate-300 p-1.5 text-left">ชื่อ - นามสกุล</th>
                      <th className="border border-slate-300 p-1.5">ผลการคัดกรองพฤติกรรมรวม</th>
                      <th className="border border-slate-300 p-1.5 text-left">ด้านที่มีปัญหาเด่นชัด</th>
                      <th className="border border-slate-300 p-1.5 text-left">สรุปแนวทางการช่วยเหลือเบื้องต้นของครู</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concerns.map(c => {
                      const s = byId.get(c.studentId);
                      return (
                        <tr key={c.studentId}>
                          <td className="border border-slate-300 p-1.5 text-center">{s?.studentNo ?? '-'}</td>
                          <td className="border border-slate-300 p-1.5">{s?.name ?? c.studentId}</td>
                          <td className="border border-slate-300 p-1.5 text-center">กลุ่ม{SDQ_TRIAGE_LABEL[c.overall]}</td>
                          <td className="border border-slate-300 p-1.5">{c.prominent.length ? c.prominent.map(k => SUBSCALE_SHORT[k]).join(', ') : '—'}</td>
                          <td className="border border-slate-300 p-1">
                            <textarea aria-label={`แนวทางช่วยเหลือ ${s?.name ?? c.studentId}`} rows={2} value={plans[c.studentId] ?? ''} onChange={e => setPlans(p => ({ ...p, [c.studentId]: e.target.value }))}
                              className="w-full text-xs bg-transparent border border-dashed border-slate-300 rounded p-1" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-bold">ส่วนที่ 3: สรุปและข้อเสนอแนะท้ายรายงาน</h3>
              <p className="text-xs"><b>1. ภาพรวมปัญหาส่วนใหญ่ของห้องเรียน:</b> {summary}</p>
              <div className="text-xs space-y-1">
                <b>2. แนวทางการจัดกิจกรรมโฮมรูมหรือพัฒนาห้องเรียนหลังจากนี้:</b>
                <textarea aria-label="แนวทางการจัดกิจกรรมโฮมรูม" rows={3} value={activityPlan} onChange={e => setActivityPlan(e.target.value)}
                  className="w-full text-xs bg-transparent border border-dashed border-slate-300 rounded p-1" />
              </div>
              <div className="pt-6 text-xs text-right space-y-1">
                <p>ลงชื่อ ..................................................... ครูที่ปรึกษา</p>
                <p>(.....................................................)</p>
              </div>
            </section>
          </>
        )}
      </div>
      <p className="sdq-no-print text-[10px] text-slate-500">ช่อง "แนวทางการช่วยเหลือ" และ "แนวทางการจัดกิจกรรม" ใช้กรอกเพื่อพิมพ์รายงาน ยังไม่บันทึกลงระบบ — ปิดหน้านี้แล้วข้อความจะหาย</p>
    </div>
  );
}

/** ตัวห่อสำหรับหน้าครูที่ปรึกษา: อ่านผล SDQ สด + ปีการศึกษาปัจจุบัน */
export function SdqClassReportLive({ room, students }: { room: string; students: ReportStudent[] }) {
  const { academicYear, isConfigured, loading: yearLoading } = useCurrentSemester();
  const [records, setRecords] = useState<SDQAssessment[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => subscribeAllSDQAssessments(list => { setRecords(list); setLoaded(true); }), []);
  if (!yearLoading && !isConfigured) return <p className="text-xs text-amber-300">ยังไม่ได้ตั้งปีการศึกษาปัจจุบัน — รายงานคัดกรองต้องใช้ปีการศึกษา</p>;
  return <SdqClassReport room={room} students={students} records={records} academicYear={academicYear} loading={!loaded || yearLoading} />;
}
