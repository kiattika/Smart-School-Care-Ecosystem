import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ThaiAddress } from '../../types/homeVisit';
import {
  emptyThaiAddress, loadThaiAddressData, withProvince, withAmphoe, withTambon, withVillage, villageLabel,
  type ProvinceRef, type VillageMap,
} from '../../lib/thaiAddress';
import { inputCls, Label } from './formParts';

/**
 * ช่องกรอกที่อยู่แบบแยกช่อง: บ้านเลขที่ หมู่ที่ ชื่อหมู่บ้าน ซอย ถนน + ดรอปดาวน์ จังหวัด → อำเภอ → ตำบล + รหัสไปรษณีย์
 * หมู่บ้านเลือกจากรายการได้เฉพาะจังหวัดที่มีข้อมูล DOPA (ที่เหลือพิมพ์เอง) — เลือกแล้วเติมหมู่ที่ให้
 */
export function AddressFields({ value, onChange }: { value: ThaiAddress | null | undefined; onChange: (a: ThaiAddress) => void }) {
  const a = value ?? emptyThaiAddress();
  const [data, setData] = useState<{ areas: ProvinceRef[]; villages: VillageMap } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [typedVillage, setTypedVillage] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadThaiAddressData().then(d => { if (!cancelled) setData(d); }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, []);

  const province = useMemo(() => data?.areas.find(p => p[0] === a.provinceCode) ?? null, [data, a.provinceCode]);
  const amphoe = useMemo(() => province?.[2].find(x => x[0] === a.amphoeCode) ?? null, [province, a.amphoeCode]);
  const tambon = useMemo(() => amphoe?.[2].find(x => x[0] === a.tambonCode) ?? null, [amphoe, a.tambonCode]);
  const villages = (data && a.tambonCode && data.villages[a.tambonCode]) || [];
  const hasVillageList = villages.length > 0;
  const set = (patch: Partial<ThaiAddress>) => onChange({ ...a, ...patch });

  if (loadError) return <div role="alert" className="text-xs text-rose-300">โหลดรายการจังหวัด/อำเภอ/ตำบลไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองใหม่</div>;
  if (!data) return <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดรายการที่อยู่…</div>;

  return (
    <div className="space-y-3" data-testid="address-fields">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><Label required>บ้านเลขที่</Label><input className={inputCls} value={a.houseNo} onChange={e => set({ houseNo: e.target.value })} placeholder="เช่น 123/4" /></div>
        <div><Label>ซอย</Label><input className={inputCls} value={a.soi} onChange={e => set({ soi: e.target.value })} /></div>
        <div className="col-span-2"><Label>ถนน</Label><input className={inputCls} value={a.road} onChange={e => set({ road: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label required>จังหวัด</Label>
          <select className={inputCls} value={a.provinceCode} onChange={e => onChange(withProvince(a, data.areas.find(p => p[0] === e.target.value) ?? null))}>
            <option value="">— เลือกจังหวัด —</option>
            {data.areas.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
          </select>
        </div>
        <div>
          <Label required>อำเภอ/เขต</Label>
          <select className={inputCls} value={a.amphoeCode} disabled={!province} onChange={e => onChange(withAmphoe(a, province?.[2].find(x => x[0] === e.target.value) ?? null))}>
            <option value="">— เลือกอำเภอ/เขต —</option>
            {province?.[2].map(x => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
          </select>
        </div>
        <div>
          <Label required>ตำบล/แขวง</Label>
          <select className={inputCls} value={a.tambonCode} disabled={!amphoe} onChange={e => { setTypedVillage(false); onChange(withTambon(a, amphoe?.[2].find(x => x[0] === e.target.value) ?? null)); }}>
            <option value="">— เลือกตำบล/แขวง —</option>
            {amphoe?.[2].map(x => <option key={x[0]} value={x[0]}>{x[1]}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Label>หมู่บ้าน/ชุมชน</Label>
          {hasVillageList && !typedVillage ? (
            <select className={inputCls} value={a.villageCode} onChange={e => {
              if (e.target.value === '__other') { setTypedVillage(true); onChange(withVillage(a, null)); return; }
              onChange(withVillage(a, villages.find(v => v[2] === e.target.value) ?? null));
            }}>
              <option value="">— เลือกหมู่บ้าน (ไม่มีให้เว้นว่าง) —</option>
              {villages.map(v => <option key={v[2]} value={v[2]}>{villageLabel(v)}</option>)}
              <option value="__other">ไม่มีในรายการ — พิมพ์เอง</option>
            </select>
          ) : (
            <input className={inputCls} value={a.village} onChange={e => set({ village: e.target.value, villageCode: '' })} placeholder="ชื่อหมู่บ้าน/ชุมชน/อาคาร (ถ้ามี)" />
          )}
        </div>
        <div><Label>หมู่ที่</Label><input className={inputCls} inputMode="numeric" maxLength={2} value={a.moo} onChange={e => set({ moo: e.target.value.replace(/\D/g, '') })} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label required>รหัสไปรษณีย์</Label>
          {tambon && tambon[2].length > 1 ? (
            <select className={inputCls} value={a.postalCode} onChange={e => set({ postalCode: e.target.value })}>
              <option value="">— เลือกรหัสไปรษณีย์ —</option>
              {tambon[2].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          ) : (
            <input className={inputCls} inputMode="numeric" maxLength={5} value={a.postalCode} onChange={e => set({ postalCode: e.target.value.replace(/\D/g, '') })} placeholder="5 หลัก" />
          )}
        </div>
      </div>
      {tambon && tambon[2].length === 0 && <p className="text-[11px] text-amber-300">ไม่มีรหัสไปรษณีย์ของตำบลนี้ในข้อมูลอ้างอิง กรุณาพิมพ์เอง</p>}
    </div>
  );
}
