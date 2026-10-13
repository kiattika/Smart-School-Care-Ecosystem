import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useCurrentSemester } from '../../hooks/useCurrentSemester';
import { fetchInfirmaryDashboardData, subscribeBloodDonations, type InfirmaryMedicine } from '../../services/firestoreService';
import {
  bloodTypeDistribution, bmiDistribution, checkupCoverage, countByMonth, dispenseTotals, donationSummary,
  topCounts, vaccineCounts, visitSummary, visitsByRoom,
} from '../../lib/infirmaryStats';
import { isLowStock } from '../../lib/infirmaryStock';
import { BMI_CATEGORY_LABEL } from '../../lib/utils';
import type { BloodDonation } from '../../lib/healthRecords';
import type { InfirmaryVisit, Student } from '../../types';

type Dash = Awaited<ReturnType<typeof fetchInfirmaryDashboardData>>;

const Tile = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
    <p className="text-[11px] text-slate-400">{label}</p>
    <p className="text-2xl font-bold text-white mt-1">{value}</p>
    {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

const Card = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5">
    <h3 className="text-sm font-bold text-white">{title}</h3>
    {note && <p className="text-[11px] text-slate-400 mt-0.5">{note}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

const Empty = ({ text }: { text: string }) => <p className="text-[11px] text-slate-500">{text}</p>;

/** แท่งแนวนอนบาง (≤ 14px) ค่าอยู่ปลายแท่ง — สีเดียวเพราะเป็นอันดับของหมวดที่ไม่มีลำดับ */
function HBarList({ rows, color = '#fb7185', unit }: { rows: Array<{ label: string; count: number; unit?: string }>; color?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  if (rows.length === 0) return <Empty text="ยังไม่มีข้อมูล" />;
  return (
    <ul className="space-y-2">
      {rows.map(r => (
        <li key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs">
          <span className="truncate text-slate-300" title={r.label}>{r.label}</span>
          <span className="h-2.5 rounded-r bg-slate-800/70 overflow-hidden">
            <span className="block h-full rounded-r" style={{ width: `${Math.max(2, (r.count / max) * 100)}%`, background: color }} />
          </span>
          <span className="font-bold text-white tabular-nums">{r.count}{(r.unit || unit) ? <span className="text-[10px] text-slate-400 font-normal"> {r.unit || unit}</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}

/** คอลัมน์รายเดือน — ค่าอยู่บนหัวคอลัมน์ */
function MonthColumns({ rows, color = '#fb7185' }: { rows: Array<{ ym: string; label: string; count: number }>; color?: string }) {
  const max = Math.max(1, ...rows.map(r => r.count));
  if (rows.every(r => r.count === 0)) return <Empty text="ยังไม่มีข้อมูลในช่วงนี้" />;
  return (
    <div className="flex items-end gap-2 h-36">
      {rows.map(r => (
        <div key={r.ym} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full" title={`${r.label}: ${r.count}`}>
          <span className="text-[10px] font-bold text-white tabular-nums mb-1">{r.count}</span>
          <span className="w-full max-w-[24px] rounded-t" style={{ height: `${Math.max(2, (r.count / max) * 100)}%`, background: color }} />
          <span className="text-[10px] text-slate-400 mt-1 whitespace-nowrap">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

const BMI_COLORS: Record<string, string> = { UNDERWEIGHT: '#38bdf8', NORMAL: '#34d399', OVERWEIGHT: '#fbbf24', OBESE: '#fb7185' };

/** หน้าหลักงานพยาบาล: สถิติทั้งโรงเรียนจากข้อมูลจริง */
export function InfirmaryOverview({ visits, medicines, students }: { visits: InfirmaryVisit[]; medicines: InfirmaryMedicine[]; students: Student[] }) {
  const sem = useCurrentSemester();
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [donations, setDonations] = useState<BloodDonation[]>([]);
  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetchInfirmaryDashboardData(sem.academicYear)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [sem.academicYear]);
  useEffect(() => { if (!sem.loading) load(); }, [load, sem.loading]);
  useEffect(() => subscribeBloodDonations(setDonations, {}, () => setDonations([])), []);

  const active = students.filter(s => s.status !== 'INACTIVE');
  const total = active.length;
  const vs = visitSummary(visits, now);
  const monthly = countByMonth(visits.map(v => v.visitDate), now, 6);
  const symptoms = topCounts(visits.map(v => v.symptoms), 8);
  const rooms = visitsByRoom(visits, students, 8);
  const meds = data ? dispenseTotals(data.dispenseMovements, 8) : [];
  const bmi = data ? bmiDistribution(data.semesterHealth, total) : null;
  const blood = data ? bloodTypeDistribution(data.bloodTypes, total) : null;
  const check = data ? checkupCoverage(data.checkups, total) : null;
  const vacc = data ? vaccineCounts(data.vaccinations, 8) : [];
  const don = donationSummary(donations, now);
  const low = medicines.filter(isLowStock).length;

  return (
    <div className="space-y-4" data-testid="infirmary-overview">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-slate-400">สถิติจากข้อมูลจริงในระบบ · ปีการศึกษา {sem.academicYear} · นักเรียนในระบบ {total.toLocaleString('th-TH')} คน</p>
        <button onClick={load} disabled={loading} className="px-3 py-1.5 text-[11px] font-bold text-slate-200 border border-slate-700 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 disabled:opacity-50">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} รีเฟรช
        </button>
      </div>
      {error && <p className="text-xs text-rose-300">โหลดสถิติบางส่วนไม่ได้: {error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="การมาใช้บริการทั้งหมด" value={vs.total} sub={`นักเรียน ${vs.uniqueStudents} คน`} />
        <Tile label="30 วันที่ผ่านมา" value={vs.last30} sub={vs.avgRestMinutes !== null ? `พักเฉลี่ย ${vs.avgRestMinutes} นาที` : undefined} />
        <Tile label="เคสเร่งด่วน" value={vs.urgent} />
        <Tile label="ยา/เวชภัณฑ์ใกล้หมด" value={low} sub={`จาก ${medicines.length} รายการ`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="การมาใช้บริการห้องพยาบาลรายเดือน" note="6 เดือนล่าสุด (จำนวนเคส)">
          <MonthColumns rows={monthly} />
        </Card>
        <Card title="อาการที่พบบ่อย" note="จัดกลุ่มจากข้อความอาการที่บันทึก">
          <HBarList rows={symptoms} unit="ครั้ง" />
        </Card>
        <Card title="ห้องเรียนที่มาใช้บริการมาก" note="จำนวนเคสสะสมแยกตามห้อง">
          <HBarList rows={rooms} unit="ครั้ง" color="#a78bfa" />
        </Card>
        <Card title="ยาที่จ่ายมากที่สุด" note="รวมจากรายการจ่ายยาที่ตัดสต็อกจริง">
          {loading && !data ? <Empty text="กำลังโหลด…" /> : <HBarList rows={meds} color="#38bdf8" />}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="สุขภาวะทั้งโรงเรียน (BMI)" note={bmi ? `ใช้ผลล่าสุดของแต่ละคน · มีข้อมูล ${bmi.recorded.toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')} คน` : undefined}>
          {!bmi ? <Empty text="กำลังโหลด…" /> : bmi.recorded === 0 ? <Empty text="ยังไม่มีนักเรียนบันทึกน้ำหนัก/ส่วนสูง" /> : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full gap-0.5" role="img" aria-label="สัดส่วน BMI">
                {(['UNDERWEIGHT', 'NORMAL', 'OVERWEIGHT', 'OBESE'] as const).map(k => bmi.counts[k] > 0 && (
                  <span key={k} style={{ width: `${(bmi.counts[k] / bmi.recorded) * 100}%`, background: BMI_COLORS[k] }} title={`${BMI_CATEGORY_LABEL[k]} ${bmi.counts[k]}`} />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {(['UNDERWEIGHT', 'NORMAL', 'OVERWEIGHT', 'OBESE'] as const).map(k => (
                  <li key={k} className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-300"><span className="w-2.5 h-2.5 rounded-full" style={{ background: BMI_COLORS[k] }} />{BMI_CATEGORY_LABEL[k]}</span>
                    <span className="font-bold text-white tabular-nums">{bmi.counts[k]} <span className="text-[10px] text-slate-400 font-normal">({Math.round((bmi.counts[k] / bmi.recorded) * 100)}%)</span></span>
                  </li>
                ))}
              </ul>
              {bmi.missing > 0 && <p className="text-[10px] text-slate-500 mt-2">ยังไม่มีข้อมูลอีก {bmi.missing.toLocaleString('th-TH')} คน — ตัวเลขนี้เป็นสัดส่วนของผู้ที่บันทึกแล้วเท่านั้น</p>}
            </>
          )}
        </Card>

        <Card title="การบริจาคโลหิต" note="นักเรียนและบุคลากร (ข้อมูลที่พยาบาลบันทึก)">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Tile label="ครั้งทั้งหมด" value={don.total} />
            <Tile label="ผู้บริจาค (คน)" value={don.donors} />
            <Tile label="นักเรียน/บุคลากร" value={`${don.students}/${don.staff}`} sub="ครั้ง" />
          </div>
          <MonthColumns rows={don.byMonth.slice(-6)} color="#fb7185" />
        </Card>

        <Card title="หมู่เลือดนักเรียน" note={blood ? `มีข้อมูล ${blood.recorded.toLocaleString('th-TH')} จาก ${total.toLocaleString('th-TH')} คน (ใช้วางแผนรับบริจาค/เหตุฉุกเฉิน)` : undefined}>
          {!blood ? <Empty text="กำลังโหลด…" /> : blood.recorded === 0 ? <Empty text="ยังไม่มีนักเรียนระบุหมู่เลือด" /> : (
            <HBarList rows={(['A', 'B', 'AB', 'O'] as const).map(k => ({ label: `หมู่ ${k}`, count: blood.counts[k] }))} color="#fb7185" unit="คน" />
          )}
        </Card>

        <Card title={`ตรวจสายตา/การได้ยิน ปีการศึกษา ${sem.academicYear}`}>
          {!check ? <Empty text="กำลังโหลด…" /> : (
            <div className="grid grid-cols-2 gap-2">
              <Tile label="ตรวจแล้ว (คน)" value={check.examined} sub={`ยังไม่ตรวจ ${check.notExamined.toLocaleString('th-TH')} คน`} />
              <Tile label="สายตาผิดปกติ" value={check.visionAbnormal} />
              <Tile label="การได้ยินผิดปกติ" value={check.hearingAbnormal} />
            </div>
          )}
        </Card>

        <Card title="ประวัติวัคซีนที่บันทึกไว้" note="จำนวนรายการแยกตามชนิดวัคซีน">
          {!data ? <Empty text="กำลังโหลด…" /> : <HBarList rows={vacc} color="#34d399" unit="ครั้ง" />}
        </Card>
      </div>
    </div>
  );
}
