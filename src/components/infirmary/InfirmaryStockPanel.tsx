import React, { useEffect, useState } from 'react';
import {
  changeMedicineStock,
  createInfirmaryMedicine,
  subscribeStockMovements,
  updateInfirmaryMedicineMeta,
  type InfirmaryMedicine,
  type InfirmaryStockMovement,
} from '../../services/firestoreService';
import { isLowStock, MOVEMENT_LABEL, type StockMovementType } from '../../lib/infirmaryStock';

type Actor = { uid: string; name: string };
type ChangeKind = Exclude<StockMovementType, 'INITIAL' | 'DISPENSE'>;
const KIND_LABEL: Record<ChangeKind, string> = { RESTOCK: 'รับเข้า', DISCARD: 'ทิ้ง/หมดอายุ', ADJUST: 'ปรับยอดตามนับจริง' };

function errText(e: unknown): string {
  const m = (e as Error)?.message || '';
  if (m.includes('INSUFFICIENT_STOCK')) return 'จำนวนคงเหลือไม่พอ';
  if (m.includes('INVALID')) return 'ข้อมูลไม่ถูกต้อง';
  return 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
}

/** แท็บ "คลังเวชภัณฑ์และยา" — ข้อมูลจริงจาก Firestore ทุกการเปลี่ยนยอดมีรายการเคลื่อนไหวคู่กัน */
export function InfirmaryStockPanel({ medicines, actor }: { medicines: InfirmaryMedicine[]; actor: Actor }) {
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [change, setChange] = useState<{ med: InfirmaryMedicine; kind: ChangeKind } | null>(null);
  const [historyFor, setHistoryFor] = useState<InfirmaryMedicine | null>(null);
  const [error, setError] = useState('');

  const visible = medicines.filter(m => showAll || m.active);
  const lowCount = medicines.filter(isLowStock).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-white">คลังเวชภัณฑ์และยาห้องพยาบาลโรงเรียน</h3>
          <p className="text-xs text-slate-400">
            ตัดสต็อกอัตโนมัติเมื่อจ่ายยาในบันทึกเคส · แจ้งเตือนเมื่อคงเหลือ ≤ จุดเตือน{lowCount > 0 ? ` · ใกล้หมด ${lowCount} รายการ` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-400 flex items-center gap-1">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> แสดงรายการที่ปิดใช้งาน
          </label>
          <button onClick={() => setAdding(true)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 cursor-pointer">
            + เพิ่มเวชภัณฑ์ใหม่
          </button>
        </div>
      </div>

      {error && <div role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">{error}</div>}

      {visible.length === 0 && (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-900/60 border border-slate-800 rounded-2xl">
          ยังไม่มีรายการเวชภัณฑ์ — กด "+ เพิ่มเวชภัณฑ์ใหม่" เพื่อเริ่มสร้างคลัง
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((med) => {
          const low = isLowStock(med);
          return (
            <div key={med.id} className={`p-4 rounded-2xl border bg-slate-900/80 shadow-lg relative overflow-hidden flex flex-col justify-between ${low ? 'border-rose-500/50 bg-rose-950/10' : 'border-slate-800'} ${med.active ? '' : 'opacity-60'}`}>
              {low && <div className="absolute top-0 right-0 bg-rose-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-bl-xl">⚠️ สต็อกใกล้หมด</div>}
              {!med.active && <div className="absolute top-0 right-0 bg-slate-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded-bl-xl">ปิดใช้งาน</div>}
              <div>
                {med.category && <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{med.category}</span>}
                <h4 className="text-sm font-bold text-white mt-2">{med.name}</h4>
                <p className="text-[10px] text-slate-500">จุดเตือน ≤ {med.minAlert} {med.unit}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800">
                <span className="text-[10px] text-slate-400 block">คงเหลือปัจจุบัน</span>
                <p className={`text-2xl font-black font-mono ${low ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {med.stock} <span className="text-xs font-normal text-slate-400">{med.unit}</span>
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <button onClick={() => setChange({ med, kind: 'RESTOCK' })} className="px-2.5 py-1 bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg cursor-pointer">รับเข้า</button>
                  <button onClick={() => setChange({ med, kind: 'DISCARD' })} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg border border-slate-700 cursor-pointer">ทิ้ง/หมดอายุ</button>
                  <button onClick={() => setChange({ med, kind: 'ADJUST' })} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg border border-slate-700 cursor-pointer">ปรับยอด</button>
                  <button onClick={() => setHistoryFor(med)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold rounded-lg border border-slate-700 cursor-pointer">ประวัติ</button>
                  <button
                    onClick={async () => {
                      setError('');
                      try { await updateInfirmaryMedicineMeta(med.id, { active: !med.active }); } catch (e) { setError(errText(e)); }
                    }}
                    className="px-2.5 py-1 text-slate-400 hover:text-white text-[11px] cursor-pointer"
                  >
                    {med.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {adding && <AddMedicineModal actor={actor} onClose={() => setAdding(false)} />}
      {change && <ChangeStockModal med={change.med} kind={change.kind} actor={actor} onClose={() => setChange(null)} />}
      {historyFor && <HistoryModal med={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 bg-slate-800 rounded-lg">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white';

function AddMedicineModal({ actor, onClose }: { actor: Actor; onClose: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [minAlert, setMinAlert] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await createInfirmaryMedicine({ name, category, unit, initialStock: Number(initialStock), minAlert: Number(minAlert) }, actor);
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalShell title="เพิ่มเวชภัณฑ์ใหม่" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อยา/เวชภัณฑ์ เช่น พาราเซตามอล 500 มก." aria-label="ชื่อ" />
        <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="หมวด (ไม่บังคับ) เช่น ยาสามัญประจำบ้าน" aria-label="หมวด" />
        <div className="grid grid-cols-3 gap-2">
          <input className={inputCls} required value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="หน่วย (เม็ด/ขวด)" aria-label="หน่วย" />
          <input className={inputCls} type="number" min={0} value={initialStock} onChange={(e) => setInitialStock(e.target.value)} aria-label="ยอดตั้งต้น" title="ยอดตั้งต้น" />
          <input className={inputCls} type="number" min={0} value={minAlert} onChange={(e) => setMinAlert(e.target.value)} aria-label="จุดเตือน" title="จุดเตือนสต็อกใกล้หมด" />
        </div>
        <p className="text-[10px] text-slate-500">ช่องที่ 2 = ยอดตั้งต้น, ช่องที่ 3 = จุดเตือน (เตือนเมื่อคงเหลือ ≤ ค่านี้)</p>
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        <button disabled={busy} className="w-full py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer">บันทึก</button>
      </form>
    </ModalShell>
  );
}

function ChangeStockModal({ med, kind, actor, onClose }: { med: InfirmaryMedicine; kind: ChangeKind; actor: Actor; onClose: () => void }) {
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(qty);
    if (!Number.isInteger(n) || n === 0 || (kind !== 'ADJUST' && n < 0)) { setError('กรอกจำนวนเต็มที่ถูกต้อง'); return; }
    // ADJUST: กรอก "ยอดที่นับได้จริง" → delta = นับจริง - ยอดในระบบ ; RESTOCK +n ; DISCARD -n
    const delta = kind === 'ADJUST' ? n - med.stock : kind === 'RESTOCK' ? n : -n;
    if (delta === 0) { setError('ยอดที่นับได้เท่ากับยอดในระบบ ไม่ต้องปรับ'); return; }
    setError('');
    setBusy(true);
    try {
      await changeMedicineStock(med.id, kind, delta, note, actor);
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalShell title={`${KIND_LABEL[kind]} — ${med.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-slate-400">คงเหลือในระบบ {med.stock} {med.unit}</p>
        <input
          className={inputCls} type="number" required autoFocus value={qty} onChange={(e) => setQty(e.target.value)}
          placeholder={kind === 'ADJUST' ? `ยอดที่นับได้จริง (${med.unit})` : `จำนวน (${med.unit})`}
          aria-label="จำนวน"
        />
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ เช่น ล็อตที่/เหตุผล (ไม่บังคับ)" aria-label="หมายเหตุ" />
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
        <button disabled={busy} className="w-full py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer">ยืนยัน</button>
      </form>
    </ModalShell>
  );
}

function HistoryModal({ med, onClose }: { med: InfirmaryMedicine; onClose: () => void }) {
  const [rows, setRows] = useState<InfirmaryStockMovement[]>([]);
  useEffect(() => subscribeStockMovements(med.id, setRows), [med.id]);
  return (
    <ModalShell title={`ประวัติเบิกจ่าย — ${med.name}`} onClose={onClose}>
      <ul className="max-h-80 overflow-y-auto space-y-2">
        {rows.map(r => (
          <li key={r.id} className="text-xs flex items-start justify-between gap-3 border-b border-slate-800 pb-2">
            <div>
              <span className="font-bold text-white">{MOVEMENT_LABEL[r.type]}</span>
              <span className="text-slate-500"> · {new Date(r.at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.byName}</span>
              {r.note && <div className="text-slate-400">{r.note}</div>}
            </div>
            <div className="text-right font-mono shrink-0">
              <div className={r.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>{r.delta > 0 ? '+' : ''}{r.delta}</div>
              <div className="text-slate-500">เหลือ {r.balanceAfter}</div>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="text-xs text-slate-500">ยังไม่มีประวัติ</li>}
      </ul>
    </ModalShell>
  );
}
