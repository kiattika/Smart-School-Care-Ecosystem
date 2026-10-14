import React from 'react';
import { Printer, X } from 'lucide-react';
import { KIND_LABEL, STAGE_LABEL, averageScore, suitabilityLevel, type LessonPlan } from '../../lib/lessonPlans';
import { PLC_STEP_LABEL, groupPlcCycles, isCycleComplete, type PlcLog } from '../../lib/plc';
import { REFLECTION_FIELDS, type Reflection } from '../../lib/reflection';
import { pct, type PostTeachingSummary } from '../../lib/portfolio';
import { isProjectReady, totalHours, type TeachingProject } from '../../lib/teachingProject';
import type { SupervisionObservation } from '../../lib/supervision';
import { useEvaluationTemplates } from '../../hooks/useEvaluationTemplates';

export interface PortfolioData {
  schoolName: string;
  teacherName: string;
  departmentName: string;
  semesterLabel: string;
  range: { from: string; to: string };
  projects: TeachingProject[];
  plans: LessonPlan[];
  observation: SupervisionObservation | null;
  postTeaching: PostTeachingSummary;
  plc: PlcLog[];
  reflection: Reflection | null;
}
const thDate = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return y ? `${d}/${m}/${y + 543}` : ymd; };
const H = ({ n, t }: { n: number; t: string }) => <h2 className="font-bold text-[13px] mt-4 mb-1 border-b border-gray-400">{n}. {t}</h2>;

/** แฟ้มสะสมงานครูรายภาคเรียน (A4) — พิมพ์/บันทึกเป็น PDF ผ่านหน้าต่างพิมพ์ของเบราว์เซอร์ (ฟอนต์ไทยจากระบบ) */
export function PortfolioSheet({ data, onClose }: { data: PortfolioData; onClose: () => void }) {
  const pt = data.postTeaching;
  const o = data.observation;
  const obsTpl = useEvaluationTemplates('SUPERVISION').byVersion(o?.templateVersion);
  const cycles = groupPlcCycles(data.plc);
  return (
    <div className="fixed inset-0 bg-black/70 z-[70] overflow-y-auto p-2 sm:p-6" id="pf-overlay">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #pf-sheet, #pf-sheet * { visibility: visible !important; }
          #pf-overlay { position: static !important; background: none !important; overflow: visible !important; padding: 0 !important; }
          #pf-sheet { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; margin: 0 !important; }
          .pf-no-print { display: none !important; }
          .pf-avoid { break-inside: avoid; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
      <div className="max-w-[820px] mx-auto">
        <div className="pf-no-print flex justify-between items-center mb-3 gap-3">
          <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm"><Printer className="w-4 h-4" /> พิมพ์ / บันทึกเป็น PDF</button>
          <span className="text-[11px] text-slate-300 flex-1">ในหน้าต่างพิมพ์เลือกปลายทาง “บันทึกเป็น PDF” เพื่อดาวน์โหลดไฟล์</span>
          <button onClick={onClose} aria-label="ปิด" className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"><X className="w-4 h-4" /></button>
        </div>
        <div id="pf-sheet" className="bg-white text-black p-8 text-[12px] leading-[1.6] shadow-2xl" style={{ fontFamily: "'Sarabun','TH Sarabun New','Noto Sans Thai',sans-serif" }}>
          <div className="text-center font-bold text-[16px]">แฟ้มสะสมงานครู</div>
          <div className="text-center">{data.schoolName} · ภาคเรียนที่ {data.semesterLabel}</div>
          <div className="text-center">{data.teacherName}{data.departmentName && ` · ${data.departmentName}`}</div>

          <H n={1} t="โครงการสอน" />
          {data.projects.length === 0 ? <p>ไม่มีข้อมูล</p> : (
            <table className="w-full border border-gray-400 text-[11px]"><thead><tr className="bg-gray-100"><th className="border border-gray-400 p-1 text-left">รายวิชา</th><th className="border border-gray-400 p-1">ระดับ</th><th className="border border-gray-400 p-1">หัวข้อ (แถว)</th><th className="border border-gray-400 p-1">ชั่วโมงรวม</th><th className="border border-gray-400 p-1">สถานะ</th></tr></thead>
              <tbody>{data.projects.map(p => (
                <tr key={p.id}><td className="border border-gray-400 p-1">{p.courseCode} {p.courseName}</td><td className="border border-gray-400 p-1 text-center">{p.levelLabel}</td><td className="border border-gray-400 p-1 text-center">{p.units.length}</td><td className="border border-gray-400 p-1 text-center">{totalHours(p.units)}</td><td className="border border-gray-400 p-1 text-center">{isProjectReady(p) ? 'ครบองค์ประกอบหลัก' : 'ร่าง'}</td></tr>
              ))}</tbody></table>
          )}

          <H n={2} t="แผนการจัดการเรียนรู้ (ส่งเป็นลิงก์) และผลการตรวจ" />
          {data.plans.length === 0 ? <p>ไม่มีข้อมูล</p> : (
            <table className="w-full border border-gray-400 text-[11px]"><thead><tr className="bg-gray-100"><th className="border border-gray-400 p-1 text-left">รายวิชา</th><th className="border border-gray-400 p-1">ประเภท</th><th className="border border-gray-400 p-1">สถานะ</th><th className="border border-gray-400 p-1">ค่าเฉลี่ยผู้ตรวจ (ระดับความเหมาะสม)</th></tr></thead>
              <tbody>{data.plans.map(p => {
                const avgs = [p.deptReview, p.finalReview].map(r => (r?.scores ? averageScore(r.scores) : null));
                const done = avgs.filter((a): a is number => a !== null);
                const avg = done.length ? Math.round((done.reduce((a, b) => a + b, 0) / done.length) * 100) / 100 : null;
                return <tr key={p.id}><td className="border border-gray-400 p-1">{p.courseCode} {p.courseName}</td><td className="border border-gray-400 p-1 text-center">{KIND_LABEL[p.kind]}</td><td className="border border-gray-400 p-1 text-center">{STAGE_LABEL[p.stage]}</td><td className="border border-gray-400 p-1 text-center">{avg === null ? '-' : `${avg.toFixed(2)} (${suitabilityLevel(avg)})`}</td></tr>;
              })}</tbody></table>
          )}

          <H n={3} t="ผลการนิเทศการสอน" />
          {!o ? <p>ยังไม่มีผลการนิเทศที่ส่งแล้วในภาคเรียนนี้</p> : (
            <div className="pf-avoid space-y-1">
              <p>วิชา {o.courseCode} {o.courseName} ({o.level}) · วันที่นิเทศ {thDate(o.observedDate)} · ผู้นิเทศ {o.supervisorName}</p>
              <p>คะแนน {o.total}/{(obsTpl?.criteria.length ?? 20) * 5} {o.percent !== null && `(${o.percent}%)`} · ระดับ <b>{o.band || '-'}</b> · {o.acknowledged ? 'ครูรับทราบแล้ว' : 'ครูยังไม่กดรับทราบ'}</p>
              {o.strengths && <p><b>จุดเด่น:</b> {o.strengths}</p>}
              {o.improvements && <p><b>ข้อเสนอแนะเพื่อพัฒนา:</b> {o.improvements}</p>}
            </div>
          )}

          <H n={4} t="บันทึกหลังสอน" />
          <p>ช่วงวันที่ {thDate(data.range.from)} – {thDate(data.range.to)} (ตามปฏิทินมาตรฐาน) · บันทึกทั้งหมด {pt.total} ครั้ง · ส่งตรงเวลา {pt.onTime} ({pct(pt.onTime, pt.total) ?? '-'}%) · ส่งล่าช้า {pt.late} · อ้างอิงหัวข้อโครงการสอน {pt.linkedToPlan} ({pct(pt.linkedToPlan, pt.total) ?? '-'}%) · ไม่ตรงตามแผน {pt.deviated}</p>

          <H n={5} t="การเรียนรู้ร่วมกันเป็นชุมชนวิชาชีพ (PLC)" />
          {cycles.length === 0 ? <p>ไม่มีข้อมูล</p> : cycles.map(c => (
            <div key={c.key} className="pf-avoid mb-2">
              <p><b>{c.groupName}</b> — {c.topic} ({isCycleComplete(c.steps) ? 'ครบวงจร PDCA' : `แล้ว ${c.steps.length}/4 ขั้น`})</p>
              <ul className="list-disc pl-5">{c.logs.map(l => <li key={l.id}>{thDate(l.meetingDate)} · {PLC_STEP_LABEL[l.step]}: {l.summary}{l.outcome && ` (ผล: ${l.outcome})`}</li>)}</ul>
            </div>
          ))}

          <H n={6} t="บันทึกสะท้อนคิด" />
          {!data.reflection ? <p>ไม่มีข้อมูล</p> : REFLECTION_FIELDS.map(f => (
            <div key={f.id} className="pf-avoid mb-1"><b>{f.label}:</b> <span className="whitespace-pre-wrap">{data.reflection![f.id] || '-'}</span></div>
          ))}

          <p className="mt-6 text-[10px] text-gray-500">จัดทำจากข้อมูลในระบบ Smart School Care ณ วันที่พิมพ์ — ผลการตรวจ/นิเทศเป็นข้อมูลจากผู้ตรวจจริงในระบบ</p>
        </div>
      </div>
    </div>
  );
}
