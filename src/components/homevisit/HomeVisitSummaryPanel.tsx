import React from 'react';
import { BarChart3 } from 'lucide-react';
import type { HomeVisitSummary, Dist } from '../../lib/homeVisitAnalytics';

/** แผงสารสนเทศเยี่ยมบ้าน (ห้อง/โรงเรียน) — แสดงจำนวนและสัดส่วน ไม่มีชื่อนักเรียน */
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '-');

function Stat({ label, n, of, tone }: { label: string; n: number; of: number; tone?: string }) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`text-2xl font-bold ${tone || 'text-white'}`}>{n}<span className="text-xs text-slate-500 font-normal"> / {of} ({pct(n, of)})</span></div>
    </div>
  );
}
function Bars({ title, rows, base }: { title: string; rows: Dist[]; base: number }) {
  const shown = rows.filter(r => r.count > 0);
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-3">
      <div className="text-xs font-bold text-slate-200 mb-2">{title}</div>
      {shown.length === 0 ? <div className="text-[11px] text-slate-500">ยังไม่มีข้อมูล</div> : (
        <div className="space-y-1.5">
          {shown.map(r => (
            <div key={r.label}>
              <div className="flex justify-between text-[11px] text-slate-300"><span className="truncate pr-2">{r.label}</span><span className="shrink-0">{r.count} ({pct(r.count, base)})</span></div>
              <div className="h-1.5 bg-white/5 rounded"><div className="h-1.5 bg-indigo-500 rounded" style={{ width: `${base > 0 ? Math.min(100, (r.count / base) * 100) : 0}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HomeVisitSummaryPanel({ title, s }: { title: string; s: HomeVisitSummary }) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-400" /> {title}</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="เยี่ยมบ้านแล้ว (ปีการศึกษานี้)" n={s.visited} of={s.totalStudents} tone="text-emerald-400" />
        <Stat label="นักเรียนกรอกข้อมูลแล้ว" n={s.studentFormDone} of={s.totalStudents} />
        <Stat label="ผู้ปกครองกรอกข้อมูลแล้ว" n={s.familyFormDone} of={s.totalStudents} />
        <Stat label="ส่งต่อ/ช่วยเหลือเร่งด่วน" n={s.urgentReferral} of={s.visited} tone="text-rose-400" />
        <Stat label="เสี่ยงสูง" n={s.riskHigh} of={s.visited} tone="text-rose-400" />
        <Stat label="เฝ้าระวัง" n={s.riskMedium} of={s.visited} tone="text-amber-400" />
        <Stat label="ด้อยโอกาส" n={s.disadvantaged} of={s.visited} />
        <Stat label="มีความพิการ" n={s.disabled} of={s.visited} />
        <Stat label="ที่อยู่อาศัยเสี่ยง" n={s.unsafeHousing} of={s.familyFormDone} />
        <Stat label="เส้นทางเดินทางเสี่ยง" n={s.unsafeTravel} of={s.visited} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Bars title="ประเภทความด้อยโอกาส" rows={s.disadvantageTypes} base={s.visited} />
        <Bars title="ประเภทความพิการ" rows={s.disabilityTypes} base={s.visited} />
        <Bars title="ระยะทางบ้าน–โรงเรียน" rows={s.distance} base={s.visited} />
        <Bars title="ระยะเวลาเดินทาง" rows={s.commuteDuration} base={s.studentFormDone} />
        <Bars title="การเดินทางมาโรงเรียน" rows={s.commuteMode} base={s.studentFormDone} />
        <Bars title="นักเรียนพักอาศัยกับ" rows={s.livesWith} base={s.studentFormDone} />
        <Bars title="สถานะที่อยู่อาศัย" rows={s.housing} base={s.familyFormDone} />
        <Bars title="ภาระพึ่งพิงของครัวเรือน" rows={s.dependents} base={s.familyFormDone} />
        <Bars title="รายได้ผู้ปกครองต่อเดือน (ช่วง)" rows={s.guardianIncome} base={s.familyFormDone} />
        <Bars title="แหล่งไฟฟ้า" rows={s.electricity} base={s.familyFormDone} />
        <Bars title="แหล่งน้ำดื่ม" rows={s.drinkingWater} base={s.familyFormDone} />
        <Bars title="ความเสี่ยงภัยพิบัติ" rows={s.disasterRisks} base={s.familyFormDone} />
        <Bars title="รูปร่างตามเกณฑ์ BMI ผู้ใหญ่ (ประมาณการ)" rows={s.bodyShape} base={s.studentFormDone} />
      </div>
    </div>
  );
}
