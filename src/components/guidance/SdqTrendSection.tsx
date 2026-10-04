import React, { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SDQ_EVALUATOR_LABEL, SDQ_SUBSCALES, SDQ_SUBSCALE_MAX, SdqEvaluatorType, SdqSubscaleKey } from '../../lib/sdq';
import { SdqTrendRecord, buildSdqTrend } from '../../lib/sdqTrend';
import { IMPACT_TOTAL_MAX } from '../../lib/sdqImpact';

const LINE_COLOR: Record<SdqSubscaleKey, string> = {
  emotional: '#a855f7',
  conduct: '#6366f1',
  hyperactivity: '#3b82f6',
  peerProblems: '#14b8a6',
  prosocial: '#34d399',
};

/**
 * กราฟแนวโน้มรายด้านของ SDQ เทียบ 2-3 ปีการศึกษาล่าสุด (ค่าเฉลี่ยคะแนนรายด้านของผลประเมินในปีนั้น)
 * ปีแรกที่เริ่มใช้ระบบมีข้อมูลปีเดียว = ไม่วาดกราฟ แสดงสรุปปีนั้น + ข้อความว่างให้ ไม่ error
 * การคำนวณทั้งหมดอยู่ใน src/lib/sdqTrend.ts (buildSdqTrend) — ที่นี่แค่แสดงผล
 */
export function SdqTrendSection({ records, loading }: { records: readonly SdqTrendRecord[]; loading: boolean }) {
  const [evaluator, setEvaluator] = useState<SdqEvaluatorType | 'ALL'>('ALL');
  const trend = useMemo(() => buildSdqTrend(records, { evaluatorType: evaluator, maxYears: 3 }), [records, evaluator]);

  const chartData = trend.years.map((y) => ({ year: `ปี ${y.year}`, ...y.averages }));

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4" data-testid="sdq-trend">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white">แนวโน้มรายด้าน เทียบข้ามปีการศึกษา</h3>
          <p className="text-xs text-slate-400">ค่าเฉลี่ยคะแนนรายด้าน (0-{SDQ_SUBSCALE_MAX}) ของผลประเมินในแต่ละปี — แสดง 3 ปีล่าสุดที่มีข้อมูล</p>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          ผู้ประเมิน
          <select
            value={evaluator}
            onChange={(e) => setEvaluator(e.target.value as SdqEvaluatorType | 'ALL')}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-purple-500"
          >
            <option value="ALL">ทุกมุมมอง</option>
            {(Object.keys(SDQ_EVALUATOR_LABEL) as SdqEvaluatorType[]).map((t) => <option key={t} value={t}>{SDQ_EVALUATOR_LABEL[t]}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">กำลังโหลดข้อมูลสด...</p>
      ) : trend.years.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center" data-testid="sdq-trend-empty">
          ยังไม่มีผลประเมินที่ระบุปีการศึกษา — กราฟจะแสดงเมื่อมีข้อมูลตั้งแต่ปีแรกที่เริ่มใช้ระบบ
          {trend.legacyCount > 0 && ` (มีข้อมูลเก่าที่ไม่ระบุปี ${trend.legacyCount} รายการ ซึ่งไม่นำมาเทียบข้ามปี)`}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {trend.years.map((y) => (
              <div key={y.year} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1" data-testid={`sdq-year-card-${y.year}`}>
                <div className="font-bold text-white">ปีการศึกษา {y.year}</div>
                <div className="text-slate-400">ผลประเมิน {y.responses} ชุด · นักเรียน {y.students} คน</div>
                <div className="text-slate-300">ปัญหารวมเฉลี่ย <b className="font-mono text-white">{y.totalAverage}</b>/40</div>
                <div className="text-[10px] text-slate-500">ปกติ {y.triage.NORMAL} · เสี่ยง {y.triage.AT_RISK} · มีปัญหา {y.triage.VULNERABLE}</div>
                {/* ผลกระทบ (หน้าหลัง) — คนละมิติกับ 5 ด้านด้านบน: ความรุนแรงของปัญหา ไม่ใช่ชนิดของปัญหา */}
                <div className="pt-1 mt-1 border-t border-slate-800 text-[10px]" data-testid={`sdq-year-impact-${y.year}`}>
                  <div className="font-bold text-sky-300/80">ผลกระทบ (ความรุนแรงของปัญหา)</div>
                  {y.impact ? (
                    <>
                      <div className="text-slate-300">เฉลี่ย <b className="font-mono text-white">{y.impact.averageTotal}</b>/{IMPACT_TOTAL_MAX} ({y.impact.responses} ชุด)</div>
                      <div className="text-slate-500">ปกติ {y.impact.triage.NORMAL} · เสี่ยง {y.impact.triage.AT_RISK} · มีปัญหา {y.impact.triage.VULNERABLE}</div>
                    </>
                  ) : (
                    <div className="text-slate-500">ไม่มีข้อมูลผลกระทบในปีนี้</div>
                  )}
                </div>
                {y.legacyCriteria > 0 && (
                  <div className="text-[10px] text-amber-400/90" data-testid={`sdq-year-legacy-${y.year}`}>* {y.legacyCriteria} ชุดคำนวณสถานะด้วยเกณฑ์เดิม (ค่าคะแนนและค่าเฉลี่ยไม่ได้รับผลกระทบ)</div>
                )}
              </div>
            ))}
          </div>

          {!trend.hasTrend ? (
            <p className="text-xs text-slate-500 text-center py-2" data-testid="sdq-trend-single-year">
              มีข้อมูลปีเดียว ({trend.years[0].year}) — กราฟแนวโน้มจะแสดงเมื่อมีข้อมูลตั้งแต่ 2 ปีการศึกษาขึ้นไป
            </p>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                    <YAxis domain={[0, SDQ_SUBSCALE_MAX]} stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {SDQ_SUBSCALES.map(({ key, label }) => (
                      <Line key={key} type="monotone" dataKey={key} name={label} stroke={LINE_COLOR[key]} strokeWidth={2} dot />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {trend.delta && trend.delta.impactAverageTotal !== null && (
                <p className="text-[11px] text-slate-400" data-testid="sdq-trend-impact-delta">
                  <span className="text-sky-300/80 font-bold">ผลกระทบ (ความรุนแรง)</span> คะแนนเฉลี่ยเทียบปีก่อน {trend.delta.impactAverageTotal > 0 ? '+' : ''}{trend.delta.impactAverageTotal} (ค่าสูง = ผลกระทบมากขึ้น) — แยกจากกราฟรายด้านด้านบนซึ่งแสดงชนิดของปัญหา
                </p>
              )}
              {trend.delta && (
                <div className="flex flex-wrap gap-2 text-[11px]" data-testid="sdq-trend-delta">
                  {SDQ_SUBSCALES.map(({ key, label, difficulty }) => {
                    const d = trend.delta!.averages[key];
                    // ด้านปัญหา: ลดลง = ดีขึ้น; ด้านจุดแข็ง (prosocial): เพิ่มขึ้น = ดีขึ้น
                    const better = difficulty ? d < 0 : d > 0;
                    const Icon = d === 0 ? Minus : d > 0 ? TrendingUp : TrendingDown;
                    return (
                      <span key={key} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${d === 0 ? 'border-slate-700 text-slate-400' : better ? 'border-emerald-500/30 text-emerald-300' : 'border-amber-500/30 text-amber-300'}`}>
                        <Icon className="w-3 h-3" /> {label} {d > 0 ? '+' : ''}{d}
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {trend.legacyCount > 0 && (
            <p className="text-[10px] text-slate-500">ไม่นับข้อมูลเก่าที่ไม่ระบุปีการศึกษา {trend.legacyCount} รายการในกราฟนี้ (ดูได้ที่ตัวเลือก "ไม่ระบุปี" ด้านบน)</p>
          )}
        </>
      )}
    </div>
  );
}
