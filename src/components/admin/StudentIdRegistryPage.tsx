import React, { useEffect, useMemo, useState } from 'react';
import { History, Search, Loader2, UserCheck, Hash, ArrowRight } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { currentHolder, type RegistryEntry } from '../../lib/studentIdRegistry';
import { STUDENT_STATUS_LABELS_TH } from '../../lib/studentStatus';

interface RegistryRow {
  studentId: string;
  entries: RegistryEntry[];
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** 'YYYY-MM-DD' (ค.ศ.) → '5 ต.ค. 2569' ; null = ไม่ทราบ */
export function formatRegistryDate(iso: string | null): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return 'ไม่ทราบ';
  return `${Number(m[3])} ${THAI_MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
}

/** ทะเบียนเลขประจำตัวนักเรียน: ดูว่าเลขหนึ่งๆ เคยถูกใครถือบ้าง (student_id_registry) — อ่านอย่างเดียว */
export function StudentIdRegistryPage({ initialStudentId }: { initialStudentId?: string }) {
  const [rows, setRows] = useState<RegistryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialStudentId ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(initialStudentId ?? null);
  const [onlyReused, setOnlyReused] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'student_id_registry'),
      (snap) => {
        setRows(snap.docs.map((d) => ({
          studentId: d.id,
          entries: Array.isArray(d.data().entries) ? (d.data().entries as RegistryEntry[]) : [],
        })).sort((a, b) => a.studentId.localeCompare(b.studentId, 'th', { numeric: true })));
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => rows.filter((r) => {
    if (onlyReused && r.entries.length < 2) return false;
    if (!q) return true;
    return r.studentId.toLowerCase().includes(q) || r.entries.some((e) => e.heldBy.toLowerCase().includes(q));
  }), [rows, q, onlyReused]);

  const selected = rows.find((r) => r.studentId === selectedId) ?? null;
  const searchedExactId = query.trim();
  const notInRegistry = !loading && searchedExactId !== '' && selectedId === searchedExactId && !selected;

  return (
    <div className="bg-[#0a0f16] border border-white/5 rounded-2xl p-6 min-h-[500px] space-y-6 text-slate-100" data-testid="student-id-registry-page">
      <div>
        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
          Student ID Registry
        </span>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mt-2">
          <History className="w-6 h-6 text-indigo-400" />
          <span>ทะเบียนเลขประจำตัวนักเรียน</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          ประวัติผู้ถือเลขประจำตัวแต่ละเลข — เมื่อนักเรียนเปลี่ยนสถานะเป็นไม่ได้ศึกษาต่อแล้ว เลขจะถูกปล่อยและบันทึกไว้ที่นี่
          ก่อนออกเลขเดิมให้ผู้อื่นควรตรวจประวัติ (อ่านอย่างเดียว)
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedId(e.target.value.trim() || null); }}
            placeholder="ค้นหาเลขประจำตัว หรือชื่อผู้เคยถือเลข..."
            data-testid="registry-search"
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
          <input type="checkbox" checked={onlyReused} onChange={(e) => setOnlyReused(e.target.checked)} className="rounded border-white/20 bg-slate-950" />
          เฉพาะเลขที่เคยมีผู้ถือมากกว่า 1 คน
        </label>
      </div>

      {error && <p className="text-xs text-rose-400">โหลดทะเบียนไม่สำเร็จ: {error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* รายการเลขประจำตัว */}
        <div className="lg:col-span-2 border border-white/5 rounded-2xl overflow-hidden bg-slate-950/30">
          <div className="px-4 py-3 bg-slate-900/50 border-b border-white/5 text-[11px] font-semibold text-slate-400">
            เลขประจำตัวในทะเบียน ({visible.length})
          </div>
          <div className="max-h-[480px] overflow-y-auto divide-y divide-white/5">
            {loading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
            ) : visible.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 text-center">
                {rows.length === 0 ? 'ทะเบียนยังว่าง — จะมีรายการเมื่อมีการเปลี่ยนสถานะนักเรียนหรือเพิ่มนักเรียนใหม่' : 'ไม่พบเลขที่ตรงกับการค้นหา'}
              </p>
            ) : visible.map((r) => {
              const holder = currentHolder(r.entries);
              return (
                <button
                  key={r.studentId}
                  onClick={() => { setSelectedId(r.studentId); }}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${selectedId === r.studentId ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]'}`}
                >
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-sm text-indigo-300 flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />{r.studentId}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {holder ? `ถือโดย ${holder.heldBy}` : 'ว่าง (ไม่มีผู้ถือในขณะนี้)'}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.entries.length > 1 ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-white/10'}`}>
                    {r.entries.length} คน
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ประวัติของเลขที่เลือก */}
        <div className="lg:col-span-3 border border-white/5 rounded-2xl bg-slate-950/30 p-5" data-testid="registry-detail">
          {selected ? (
            <>
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                <Hash className="w-4 h-4 text-indigo-400" /> เลขประจำตัว <span className="font-mono text-indigo-300">{selected.studentId}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mb-4">เคยมีผู้ถือเลขนี้ {selected.entries.length} คน (เรียงจากเก่าไปใหม่)</p>
              <ol className="space-y-3">
                {selected.entries.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center border ${e.to === null ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-white/10'}`}>
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 bg-slate-900/40 border border-white/5 rounded-xl px-4 py-2.5">
                      <div className="text-sm font-bold text-slate-100">{e.heldBy}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span>{formatRegistryDate(e.from)}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span>{e.to === null ? 'ปัจจุบัน' : formatRegistryDate(e.to)}</span>
                        {e.to === null ? (
                          <span className="font-bold text-emerald-400">· ยังถือเลขนี้อยู่</span>
                        ) : (
                          <span className="font-bold text-amber-300">· ปล่อยเลขเพราะ {e.reason ? STUDENT_STATUS_LABELS_TH[e.reason] : 'ไม่ระบุเหตุผล'}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : notInRegistry ? (
            <p className="text-xs text-slate-400 leading-relaxed" data-testid="registry-not-found">
              ไม่พบเลขประจำตัว <span className="font-mono text-slate-200">{searchedExactId}</span> ในทะเบียน — เลขนี้ยังไม่เคยถูกบันทึกประวัติ
              (นักเรียนที่ยังศึกษาอยู่และไม่เคยเปลี่ยนสถานะจะยังไม่มีรายการ)
            </p>
          ) : (
            <p className="text-xs text-slate-500">เลือกเลขประจำตัวจากรายการด้านซ้าย หรือพิมพ์ค้นหาเพื่อดูประวัติผู้ถือครอง</p>
          )}
        </div>
      </div>
    </div>
  );
}
