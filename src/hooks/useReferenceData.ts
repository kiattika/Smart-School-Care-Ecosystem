import { useEffect, useMemo, useState } from 'react';
import { subscribeReferenceOverrides } from '../services/firestoreService';
import { mergeSchools, mergeVillages, type SchoolBase, type VillageBase, type SchoolRecord, type VillageRecord } from '../lib/referenceData';
import type { SchoolOverrideDoc, VillageOverrideDoc } from '../types/reference';

// ไฟล์โรงเรียนแยกตามจังหวัด (src/data/schools/<รหัสจังหวัด>.json) — โหลดเฉพาะจังหวัดที่เลือก
const schoolFiles = import.meta.glob('../data/schools/*.json', { import: 'default' }) as Record<string, () => Promise<SchoolBase[]>>;
const villageFile = () => import('../data/thaiAddress/villages.json').then(m => m.default as unknown as Record<string, VillageBase[]>);

export function useSchoolDirectory(provinceCode: string, opts: { includeDisabled?: boolean } = {}) {
  const [base, setBase] = useState<SchoolBase[]>([]);
  const [overrides, setOverrides] = useState<SchoolOverrideDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBase([]); setError(null);
    if (!provinceCode) { setLoading(false); return; }
    const loader = schoolFiles[`../data/schools/${provinceCode}.json`];
    if (!loader) { setError('ไม่พบข้อมูลโรงเรียนของจังหวัดนี้'); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    loader().then(d => { if (!cancelled) { setBase(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError('โหลดรายชื่อโรงเรียนไม่สำเร็จ'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [provinceCode]);

  useEffect(() => subscribeReferenceOverrides<SchoolOverrideDoc>('reference_schools', 'provinceCode', provinceCode, setOverrides), [provinceCode]);

  const includeDisabled = !!opts.includeDisabled;
  const schools: SchoolRecord[] = useMemo(() => mergeSchools(base, overrides, { includeDisabled }), [base, overrides, includeDisabled]);
  return { schools, loading, error };
}

export function useVillageDirectory(tambonCode: string, opts: { includeDisabled?: boolean } = {}) {
  const [base, setBase] = useState<VillageBase[]>([]);
  const [overrides, setOverrides] = useState<VillageOverrideDoc[]>([]);

  useEffect(() => {
    setBase([]);
    if (!tambonCode) return;
    let cancelled = false;
    villageFile().then(m => { if (!cancelled) setBase(m[tambonCode] ?? []); }).catch(() => { if (!cancelled) setBase([]); });
    return () => { cancelled = true; };
  }, [tambonCode]);

  useEffect(() => subscribeReferenceOverrides<VillageOverrideDoc>('reference_villages', 'tambonCode', tambonCode, setOverrides), [tambonCode]);

  const includeDisabled = !!opts.includeDisabled;
  const villages: VillageRecord[] = useMemo(() => mergeVillages(base, overrides, { includeDisabled }), [base, overrides, includeDisabled]);
  return { villages };
}

/** โหลดชุดหลักโรงเรียนของจังหวัด (ใช้ตอนส่งออก/นำเข้า) — ไม่มีไฟล์ = [] */
export async function loadSchoolBase(provinceCode: string): Promise<SchoolBase[]> {
  const loader = schoolFiles[`../data/schools/${provinceCode}.json`];
  return loader ? loader() : [];
}
/** ชุดหลักหมู่บ้านทั้งหมด (key = รหัสตำบล 6 หลัก) */
export const loadVillageBase = villageFile;
