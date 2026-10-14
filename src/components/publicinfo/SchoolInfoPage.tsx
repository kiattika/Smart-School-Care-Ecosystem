import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { barRows, formatCell, monthLabel, type PublicCell } from '../../lib/publicInfo';

type Counts = Record<string, PublicCell>;
interface Summary {
  academicYear: string;
  term: '1' | '2';
  updatedAt?: { toDate?: () => Date };
  students: { total: number; byLevel: Counts };
  staff: { teachers: PublicCell };
  infirmary: { visits: PublicCell; urgent: PublicCell; byMonth: Counts };
  guidance: { cases: PublicCell; resolved: PublicCell; byCategory: Counts };
  supervision: { roundLabel: string; observed: PublicCell; averagePercent: number | null; bands: Counts } | null;
  teaching: Record<string, { periods: PublicCell; teachers: PublicCell }>;
}

const TEACHING_LABEL: Record<string, string> = {
  SICK_LEAVE: 'ลาป่วย', PERSONAL_LEAVE: 'ลากิจ', OFFICIAL_DUTY: 'ไปราชการ',
  OTHER_ABSENCE: 'ไม่อยู่สอน (ไม่ระบุสาเหตุ)', SWAP: 'แลก/เปลี่ยนคาบ', COVERED_FOR_OTHERS: 'สอนแทนผู้อื่น',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-800 mb-3">{title}</h2>
      {children}
    </section>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
function Bars({ counts, order, label }: { counts: Counts | undefined; order?: readonly string[]; label?: (k: string) => string }) {
  const rows = barRows(counts, order);
  if (rows.length === 0) return <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-2 text-sm">
          <span className="w-32 shrink-0 text-slate-600 truncate">{label ? label(r.key) : r.label}</span>
          <div className="flex-1 h-3 bg-slate-100 rounded"><div className="h-3 bg-indigo-500 rounded" style={{ width: `${r.pct}%` }} /></div>
          <span className="w-10 text-right font-semibold text-slate-800">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** หน้าสาธารณะ — อ่านเฉพาะ public_summary/current (ตัวเลขรวมที่ซ่อนช่อง <5 แล้ว) ไม่มีข้อมูลรายบุคคล ไม่ต้องล็อกอิน */
export function SchoolInfoPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');

  useEffect(() => {
    getDoc(doc(db, 'public_summary', 'current'))
      .then((snap) => {
        if (!snap.exists()) { setState('empty'); return; }
        setData(snap.data() as Summary); setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-indigo-700 text-white px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-black">สารสนเทศโรงเรียน</h1>
          <p className="text-sm text-indigo-100 mt-1">
            {data ? `ภาคเรียนที่ ${data.term}/${data.academicYear}` : 'ข้อมูลสรุประดับโรงเรียน'}
            {data?.updatedAt?.toDate && ` · ปรับปรุงล่าสุด ${data.updatedAt.toDate().toLocaleString('th-TH')}`}
          </p>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {state === 'loading' && <p className="text-sm text-slate-500">กำลังโหลด…</p>}
        {state === 'empty' && <p className="text-sm text-slate-600">ยังไม่มีข้อมูลสรุป — ระบบจะสร้างให้อัตโนมัติทุกวัน</p>}
        {state === 'error' && <p role="alert" className="text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่ภายหลัง</p>}
        {state === 'ready' && data && (
          <>
            <Card title="นักเรียนและบุคลากร">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Stat label="นักเรียนทั้งหมด" value={data.students.total.toLocaleString('th-TH')} />
                <Stat label="ครูผู้สอน" value={formatCell(data.staff.teachers)} />
              </div>
              <p className="text-xs text-slate-500 mb-1">นักเรียนแยกตามระดับชั้น</p>
              <Bars counts={data.students.byLevel} />
            </Card>
            <Card title="งานพยาบาล (ภาคเรียนนี้)">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Stat label="การเข้าใช้ห้องพยาบาล (ครั้ง)" value={formatCell(data.infirmary.visits)} />
                <Stat label="กรณีเร่งด่วน (ครั้ง)" value={formatCell(data.infirmary.urgent)} />
              </div>
              <Bars counts={data.infirmary.byMonth} label={monthLabel} />
            </Card>
            <Card title="งานแนะแนว (ภาคเรียนนี้)">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Stat label="เคสที่ให้คำปรึกษา" value={formatCell(data.guidance.cases)} />
                <Stat label="ปิดเคสแล้ว" value={formatCell(data.guidance.resolved)} />
              </div>
              <Bars counts={data.guidance.byCategory} />
            </Card>
            <Card title="งานนิเทศการสอน">
              {data.supervision ? (
                <>
                  <p className="text-xs text-slate-500 mb-2">{data.supervision.roundLabel}</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Stat label="ครูที่ได้รับการนิเทศ" value={formatCell(data.supervision.observed)} />
                    <Stat label="คะแนนเฉลี่ย" value={data.supervision.averagePercent === null ? '-' : `${data.supervision.averagePercent}%`} />
                  </div>
                  <Bars counts={data.supervision.bands} order={['ดีมาก', 'ดี', 'พอใช้', 'ควรปรับปรุง', 'ไม่ผ่าน']} />
                </>
              ) : <p className="text-sm text-slate-500">ยังไม่มีรอบนิเทศ</p>}
            </Card>
            <Card title="การปฏิบัติงานสอนของครู (จำนวนคาบ ภาคเรียนนี้)">
              <ul className="divide-y divide-slate-100">
                {(Object.entries(data.teaching) as [string, { periods: PublicCell }][]).map(([k, v]) => (
                  <li key={k} className="flex justify-between py-1.5 text-sm"><span className="text-slate-600">{TEACHING_LABEL[k] || k}</span><span className="font-semibold">{formatCell(v.periods)}</span></li>
                ))}
              </ul>
            </Card>
            <p className="text-xs text-slate-500">
              ตัวเลขรวมระดับโรงเรียนเท่านั้น ไม่แสดงข้อมูลรายบุคคล · ค่า "&lt;5" คือมีจำนวนน้อยกว่า 5 และถูกซ่อนเพื่อคุ้มครองข้อมูลส่วนบุคคล
            </p>
          </>
        )}
      </main>
    </div>
  );
}
