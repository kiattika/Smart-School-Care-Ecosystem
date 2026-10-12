import React, { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import type { StudentHomeVisitInfo } from '../../types/homeVisit';
import { useSchoolDirectory } from '../../hooks/useReferenceData';
import { searchSchools, schoolToInfoPatch, type SchoolRecord } from '../../lib/referenceData';
import type { ProvinceRef } from '../../lib/thaiAddress';
import { inputCls, Label } from './formParts';

type Patch = ReturnType<typeof schoolToInfoPatch>;

/**
 * เลือกโรงเรียนเดิมจากรายชื่อ (เลือกจังหวัด → พิมพ์ค้นชื่อ → กดเลือก) แล้วเติมช่อง "จากโรงเรียน/สังกัด/ตำบล/อำเภอ/จังหวัด/โทรศัพท์"
 * ให้ — นักเรียนแก้ต่อเองได้ · รายชื่อชุดหลักเป็นโรงเรียนในสังกัด สพฐ. เท่านั้น (เอกชน/สังกัดอื่นพิมพ์เองในช่องด้านล่าง)
 */
export function SchoolPicker({ provinces, current, onPick }: { provinces: ProvinceRef[]; current: Pick<StudentHomeVisitInfo, 'prevSchool' | 'prevSchoolMoeCode'>; onPick: (patch: Patch) => void }) {
  const [provinceCode, setProvinceCode] = useState('');
  const [q, setQ] = useState('');
  const { schools, loading, error } = useSchoolDirectory(provinceCode);
  const results = useMemo(() => searchSchools(schools, q, 30), [schools, q]);
  const provinceName = provinces.find(p => p[0] === provinceCode)?.[1] ?? '';
  const pick = (s: SchoolRecord) => { onPick(schoolToInfoPatch(s, provinceName)); setQ(''); };

  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2" data-testid="school-picker">
      <Label>ค้นหาโรงเรียนจากรายชื่อ (ไม่บังคับ — ไม่พบให้กรอกเองด้านล่าง)</Label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select className={inputCls} value={provinceCode} onChange={e => { setProvinceCode(e.target.value); setQ(''); }} aria-label="จังหวัดของโรงเรียน">
          <option value="">— เลือกจังหวัดของโรงเรียน —</option>
          {provinces.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
        </select>
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input className={`${inputCls} pl-8`} disabled={!provinceCode} value={q} onChange={e => setQ(e.target.value)} placeholder={provinceCode ? 'พิมพ์ชื่อโรงเรียน เช่น บ้านท่าเสา' : 'เลือกจังหวัดก่อน'} aria-label="ค้นหาชื่อโรงเรียน" />
        </div>
      </div>
      {loading && <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดรายชื่อโรงเรียน…</div>}
      {error && <div role="alert" className="text-xs text-rose-300">{error}</div>}
      {provinceCode && !loading && !error && q.trim() && results.length === 0 && <div className="text-xs text-amber-300">ไม่พบโรงเรียนที่ค้นหา — กรอกชื่อโรงเรียนในช่องด้านล่างได้เลย</div>}
      {provinceCode && !loading && !error && q.trim() && results.length > 0 && (
        <ul className="max-h-56 overflow-y-auto divide-y divide-white/5 border border-white/10 rounded-lg">
          {results.map(s => (
            <li key={s.key}>
              <button type="button" onClick={() => pick(s)} className="w-full text-left px-3 py-2 hover:bg-white/5">
                <div className="text-sm text-white">{s.name}</div>
                <div className="text-[11px] text-slate-500">ต.{s.subdistrict} · {s.district}{s.affiliation ? ` · ${s.affiliation}` : ''}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {current.prevSchoolMoeCode && <p className="text-[11px] text-emerald-300">เลือกจากรายชื่อแล้ว: {current.prevSchool} (แก้ไขช่องด้านล่างได้)</p>}
    </div>
  );
}
