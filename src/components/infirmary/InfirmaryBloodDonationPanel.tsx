import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { Droplets, Loader2, Plus } from 'lucide-react';
import { db } from '../../lib/firebase';
import { StudentPicker } from '../shared/StudentPicker';
import { DatePicker } from '../shared/DatePicker';
import { isStaffActive } from '../../lib/staffStatus';
import { addBloodDonation, subscribeBloodDonations } from '../../services/firestoreService';
import { sortByDateDesc, type BloodDonation } from '../../lib/healthRecords';
import type { Student } from '../../types';

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500';
const fmtDate = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return `${d}/${m}/${y + 543}`; };

/** บันทึก/ดูประวัติการบริจาคโลหิตของนักเรียนและบุคลากร (พยาบาล/แอดมินบันทึก; นักเรียนเห็นของตัวเองในหน้าสุขภาพ) */
export function InfirmaryBloodDonationPanel({ students, actor }: { students: Student[]; actor: { uid: string; name: string } }) {
  const [donations, setDonations] = useState<BloodDonation[] | undefined>(undefined);
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [subject, setSubject] = useState<'STUDENT' | 'STAFF'>('STUDENT');
  const [studentId, setStudentId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [donatedAt, setDonatedAt] = useState('');
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'STUDENT' | 'STAFF'>('ALL');

  useEffect(() => subscribeBloodDonations(setDonations, {}, () => setDonations([])), []);
  useEffect(() => onSnapshot(collection(db, 'staff'), (snap) => {
    const list = snap.docs.filter(d => isStaffActive(d.data())).map(d => {
      const x = d.data() as any;
      return { id: d.id, name: `${x.prefix || ''}${x.firstName || ''} ${x.lastName || ''}`.trim() || x.email || d.id };
    }).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    setStaff(list);
  }, (e) => console.warn('[InfirmaryBloodDonationPanel] staff listener:', e.message)), []);

  const staffOptions = useMemo(() => {
    const q = staffSearch.trim().toLowerCase();
    return (q ? staff.filter(s => s.name.toLowerCase().includes(q)) : staff).slice(0, 60);
  }, [staff, staffSearch]);

  const shown = sortByDateDesc<BloodDonation>((donations || []).filter(d => filter === 'ALL' || d.subjectType === filter), d => d.donatedAt);
  const donorCount = new Set((donations || []).map(d => d.subjectType === 'STUDENT' ? `S:${d.studentId}` : `T:${d.staffId}`)).size;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const st = students.find(s => s.studentId === studentId);
      const sf = staff.find(s => s.id === staffId);
      await addBloodDonation({
        subjectType: subject,
        studentId: subject === 'STUDENT' ? studentId : undefined,
        staffId: subject === 'STAFF' ? staffId : undefined,
        donorName: subject === 'STUDENT' ? (st?.fullName || '') : (sf?.name || ''),
        donatedAt, place, note,
        recordedByUid: actor.uid, recordedByName: actor.name,
      });
      setDonatedAt(''); setPlace(''); setNote('');
      setMsg({ ok: true, text: 'บันทึกประวัติการบริจาคโลหิตแล้ว' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ' });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="infirmary-blood-donation">
      <form onSubmit={submit} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2"><Droplets className="w-4 h-4 text-rose-400" /> บันทึกการบริจาคโลหิต</h3>
        <div className="flex gap-2">
          {(['STUDENT', 'STAFF'] as const).map(t => (
            <button type="button" key={t} onClick={() => setSubject(t)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border ${subject === t ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
              {t === 'STUDENT' ? 'นักเรียน' : 'บุคลากร'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">{subject === 'STUDENT' ? 'นักเรียน' : 'บุคลากร (พิมพ์ค้นหาแล้วเลือก)'}</label>
            {subject === 'STUDENT' ? (
              <StudentPicker mode="single" students={students} value={studentId} onSelect={setStudentId} />
            ) : (
              <>
                <input className={inputCls} placeholder="ค้นหาชื่อบุคลากร" value={staffSearch} onChange={e => setStaffSearch(e.target.value)} />
                <select className={`${inputCls} mt-2`} size={4} value={staffId} onChange={e => setStaffId(e.target.value)}>
                  {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-400">วันที่บริจาค</label>
              <DatePicker value={donatedAt} onChange={setDonatedAt} max={format(new Date(), 'yyyy-MM-dd')} ariaLabel="วันที่บริจาคโลหิต" />
            </div>
            <div><label className="text-[11px] text-slate-400">สถานที่ (เช่น หน่วยรับบริจาคโลหิต/โรงพยาบาล)</label><input className={inputCls} maxLength={80} value={place} onChange={e => setPlace(e.target.value)} /></div>
            <div><label className="text-[11px] text-slate-400">หมายเหตุ (ถ้ามี)</label><input className={inputCls} maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></div>
          </div>
        </div>
        {msg && <p className={`text-[11px] ${msg.ok ? 'text-emerald-400' : 'text-rose-300'}`}>{msg.text}</p>}
        <button disabled={busy} className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-xl flex items-center gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} บันทึกการบริจาค
        </button>
      </form>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
          <p className="text-xs text-slate-300">
            ทั้งหมด <span className="font-bold text-white">{donations?.length ?? 0}</span> ครั้ง · ผู้บริจาค <span className="font-bold text-white">{donorCount}</span> คน
          </p>
          <div className="flex gap-1.5">
            {(['ALL', 'STUDENT', 'STAFF'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 text-[11px] rounded-lg border ${filter === f ? 'bg-slate-700 border-slate-500 text-white' : 'border-slate-700 text-slate-400'}`}>
                {f === 'ALL' ? 'ทั้งหมด' : f === 'STUDENT' ? 'นักเรียน' : 'บุคลากร'}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-800/60 text-slate-300 text-[11px]"><tr><th className="p-3">วันที่</th><th className="p-3">ผู้บริจาค</th><th className="p-3">ประเภท</th><th className="p-3">สถานที่</th><th className="p-3">บันทึกโดย</th></tr></thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {donations === undefined ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">กำลังโหลด…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-slate-500">ยังไม่มีประวัติการบริจาคโลหิต</td></tr>
            ) : shown.map(d => (
              <tr key={d.id}>
                <td className="p-3 whitespace-nowrap">{fmtDate(d.donatedAt)}</td>
                <td className="p-3 text-white font-medium">{d.donorName}</td>
                <td className="p-3">{d.subjectType === 'STUDENT' ? `นักเรียน (${d.studentId})` : 'บุคลากร'}</td>
                <td className="p-3">{d.place || '-'}</td>
                <td className="p-3 text-slate-400">{d.recordedByName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
