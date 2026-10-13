import React, { useMemo, useRef, useState } from 'react';
import { buildGrowthPoints, paddedDomain, BMI_HEALTHY_MIN, BMI_HEALTHY_MAX, type GrowthPoint } from '../../lib/growthChart';

interface Props {
  logs: Array<{ id?: string; semester?: string; academicYear?: string; term?: string; height?: number; weight?: number; bmi?: number }>;
}

// 3 แผงเรียงต่อกัน แกน x (ภาคเรียน) ร่วมกัน — หน่วยต่างกันจึงไม่ใช้สองแกนในกราฟเดียว
const PANELS = [
  { id: 'height', title: 'ส่วนสูง', unit: 'ซม.', color: '#38bdf8' },
  { id: 'weight', title: 'น้ำหนัก', unit: 'กก.', color: '#fbbf24' },
  { id: 'bmi', title: 'BMI', unit: '', color: '#34d399' },
] as const;

const W = 640;
const PAD_L = 44;
const PAD_R = 52;
const PANEL_H = 84;
const GAP = 34;
const PAD_T = 18;
const AXIS_H = 26;
const H = PAD_T + PANELS.length * PANEL_H + (PANELS.length - 1) * GAP + AXIS_H;

export const GrowthTrendChart: React.FC<Props> = ({ logs }) => {
  const points = useMemo(() => buildGrowthPoints(logs), [logs]);
  const [active, setActive] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  if (points.length === 0) {
    return (
      <div className="border border-dashed border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-500">
        ยังไม่มีข้อมูลสำหรับแสดงกราฟ
      </div>
    );
  }

  const innerW = W - PAD_L - PAD_R;
  const xAt = (i: number) => (points.length === 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (points.length - 1));
  const last = points.length - 1;
  const cur = active ?? last;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(xAt(i) - x);
      if (d < bestD) { bestD = d; best = i; }
    });
    setActive(best);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(Math.max(0, cur - 1)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive(Math.min(last, cur + 1)); }
  };

  const fmt = (id: string, v: number) => (id === 'bmi' ? v.toFixed(1) : String(Math.round(v * 10) / 10));
  const delta = (id: keyof GrowthPoint) => {
    if (points.length < 2) return null;
    const d = (points[cur][id] as number) - (points[Math.max(0, cur - 1)][id] as number);
    return cur === 0 ? null : d;
  };

  return (
    <div className="relative">
      {/* legend (≥2 series): เส้นสั้นสีของซีรีส์ + ชื่อด้วยสีข้อความปกติ */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-[11px] text-slate-300">
        {PANELS.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: p.color }} />
            {p.title}{p.unit ? ` (${p.unit})` : ''}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 h-2 rounded-sm bg-emerald-400/15" />
          ช่วง BMI ปกติ {BMI_HEALTHY_MIN}–{BMI_HEALTHY_MAX}
        </span>
      </div>

      <div
        ref={wrapRef}
        className="relative touch-pan-y outline-none focus-visible:ring-1 focus-visible:ring-slate-500 rounded-lg"
        tabIndex={0}
        role="img"
        aria-label={`กราฟพัฒนาการ ${points.length} ภาคเรียน ภาคล่าสุด ${points[last].label}: ส่วนสูง ${points[last].height} ซม. น้ำหนัก ${points[last].weight} กก. BMI ${points[last].bmi}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((a) => a ?? last)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" aria-hidden="true">
          {PANELS.map((p, pi) => {
            const top = PAD_T + pi * (PANEL_H + GAP);
            const vals = points.map((pt) => pt[p.id] as number);
            const [lo, hi] = paddedDomain(vals, p.id === 'bmi' ? [BMI_HEALTHY_MIN, BMI_HEALTHY_MAX] : []);
            const yAt = (v: number) => top + PANEL_H - ((v - lo) / (hi - lo)) * PANEL_H;
            const path = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(pt[p.id] as number)}`).join(' ');
            const ticks = [lo, (lo + hi) / 2, hi];
            return (
              <g key={p.id}>
                {p.id === 'bmi' && (
                  <rect x={PAD_L} width={innerW} y={yAt(BMI_HEALTHY_MAX)} height={Math.max(0, yAt(BMI_HEALTHY_MIN) - yAt(BMI_HEALTHY_MAX))} fill="#34d399" opacity={0.12} />
                )}
                {ticks.map((t, ti) => (
                  <g key={ti}>
                    <line x1={PAD_L} x2={W - PAD_R} y1={yAt(t)} y2={yAt(t)} stroke="#1e293b" strokeWidth={1} />
                    <text x={PAD_L - 6} y={yAt(t) + 3} textAnchor="end" fontSize={10} fill="#94a3b8">{Math.round(t)}</text>
                  </g>
                ))}
                <text x={PAD_L} y={top - 6} fontSize={11} fontWeight={600} fill="#e2e8f0">{p.title}{p.unit ? ` (${p.unit})` : ''}</text>
                {points.length > 1 && <path d={path} fill="none" stroke={p.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                {points.map((pt, i) => (
                  <circle key={pt.key} cx={xAt(i)} cy={yAt(pt[p.id] as number)} r={i === cur ? 5 : 4} fill={p.color} stroke="#0f172a" strokeWidth={2} />
                ))}
                {/* label เฉพาะค่าล่าสุด */}
                <text x={xAt(last) + 9} y={yAt(points[last][p.id] as number) + 4} fontSize={11} fontWeight={700} fill="#f1f5f9">
                  {fmt(p.id, points[last][p.id] as number)}
                </text>
              </g>
            );
          })}
          {/* แกน x ร่วม */}
          {points.map((pt, i) => (
            <text key={pt.key} x={xAt(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="#94a3b8">{pt.label}</text>
          ))}
          {/* crosshair ร่วมทุกแผง */}
          {active !== null && (
            <line x1={xAt(cur)} x2={xAt(cur)} y1={PAD_T - 4} y2={H - AXIS_H} stroke="#64748b" strokeWidth={1} />
          )}
        </svg>

        {active !== null && (
          <div
            className="absolute z-10 pointer-events-none bg-slate-950/95 border border-slate-700 rounded-xl px-3 py-2 shadow-xl text-[11px] min-w-[150px]"
            style={{
              top: 0,
              left: `${(xAt(cur) / W) * 100}%`,
              transform: xAt(cur) > W * 0.6 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
            }}
          >
            <div className="text-slate-400 mb-1">ภาคเรียน {points[cur].label}</div>
            {PANELS.map((p) => {
              const d = delta(p.id as keyof GrowthPoint);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 py-0.5">
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <span className="inline-block w-3 h-0.5 rounded" style={{ background: p.color }} />
                    {p.title}
                  </span>
                  <span className="text-white font-bold">
                    {fmt(p.id, points[cur][p.id as 'height'] as number)}{p.unit ? ` ${p.unit}` : ''}
                    {d !== null && d !== 0 && (
                      <span className="ml-1.5 font-normal text-slate-400">{d > 0 ? '+' : ''}{fmt(p.id, d)}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-500 mt-1">แต่ละแผงใช้สเกลของตัวเอง แกนเวลาตรงกัน · ตารางด้านล่างคือข้อมูลชุดเดียวกัน</p>
    </div>
  );
};
