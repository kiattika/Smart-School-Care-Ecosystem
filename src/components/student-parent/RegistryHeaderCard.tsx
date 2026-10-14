import React, { useEffect, useState } from 'react';
import { getRegistryProfile } from '../../services/firestoreService';
import { SCHOOL_HEADER, REGISTRY_VERIFY_NOTICE, type RegistryProfile } from '../../lib/registryProfile';
import { formatNationalId } from '../../lib/nationalId';

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const thLongDate = (ymd: string): string => {
  const [y, m, d] = (ymd || '').split('-').map(Number);
  return y && m && d ? `${d} ${MONTHS[m - 1]} ${y + 543}` : '';
};
const GENDER: Record<string, string> = { M: 'ชาย', F: 'หญิง' };

/** อ่านข้อมูลส่วนหัว ปพ.6 (ผู้อ่านต้องมีสิทธิ์ตาม rules; อ่านไม่ได้/ยังไม่มี = null ไม่เดา) */
export function useRegistryProfile(studentId: string) {
  const [state, setState] = useState<{ loading: boolean; data: RegistryProfile | null; error: string }>({ loading: true, data: null, error: '' });
  useEffect(() => {
    let c = false;
    setState({ loading: true, data: null, error: '' });
    getRegistryProfile(studentId)
      .then(d => { if (!c) setState({ loading: false, data: d, error: '' }); })
      .catch(e => { if (!c) setState({ loading: false, data: null, error: e instanceof Error ? e.message : 'โหลดไม่สำเร็จ' }); });
    return () => { c = true; };
  }, [studentId]);
  return state;
}

/** ส่วนหัว ปพ.6: ข้อมูลโรงเรียน + ข้อมูลส่วนตัวนักเรียน เพื่อให้นักเรียน/ผู้ปกครอง/ครูที่ปรึกษา/งานทะเบียนตรวจความถูกต้อง */
export function RegistryHeaderCard({ studentId, studentName, room, profile, loading, error }: {
  studentId: string; studentName?: string; room?: string; profile: RegistryProfile | null; loading: boolean; error: string;
}) {
  const v = (s?: string) => (s && s.trim() ? s : '-');
  const rows: [string, string][] = [
    ['ชื่อ - ชื่อสกุล', v(studentName)],
    ['เลขประจำตัวนักเรียน', v(studentId)],
    ['ชั้น/ห้อง', v(room)],
    ['เลขประจำตัวประชาชน', profile?.nationalId ? formatNationalId(profile.nationalId) : '-'],
    ['เกิดวันที่', v(thLongDate(profile?.birthDate || ''))],
    ['เพศ', v(GENDER[profile?.gender || ''])],
    ['สัญชาติ', v(profile?.nationality)],
    ['ศาสนา', v(profile?.religion)],
    ['วันที่เข้าเรียน', v(thLongDate(profile?.enrolledAt || ''))],
    ['โรงเรียนเดิม', v([profile?.prevSchool, profile?.prevProvince && `จังหวัด${profile.prevProvince}`].filter(Boolean).join(' '))],
    ['ชื่อ-สกุลบิดา', v(profile?.fatherName)],
    ['ชื่อ-สกุลมารดา', v(profile?.motherName)],
  ];
  return (
    <div className="text-xs border border-gray-400 rounded p-3 mb-3 break-inside-avoid">
      <p className="font-bold text-sm">โรงเรียน{SCHOOL_HEADER.name}</p>
      <p className="text-gray-700">สังกัด {SCHOOL_HEADER.affiliation} · ตำบล/แขวง {SCHOOL_HEADER.subdistrict} · อำเภอ/เขต {SCHOOL_HEADER.district} · จังหวัด{SCHOOL_HEADER.province} · สำนักงานเขตพื้นที่การศึกษา {SCHOOL_HEADER.area}</p>
      <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
        {rows.map(([k, val]) => (
          <div key={k} className="flex gap-2"><dt className="text-gray-600 shrink-0">{k}:</dt><dd className="font-medium">{val}</dd></div>
        ))}
      </dl>
      {error && <p role="alert" className="mt-2 text-red-700">โหลดข้อมูลส่วนตัวไม่สำเร็จ: {error}</p>}
      {!loading && !error && !profile && <p className="mt-2 text-gray-600">ยังไม่มีข้อมูลส่วนตัวในทะเบียน — นักเรียนกรอกได้ที่เมนู “ข้อมูลเยี่ยมบ้าน” (ส่วนข้อมูลส่วนหัวเอกสารผลการเรียน)</p>}
      <p className="mt-2 text-red-700 font-semibold">{REGISTRY_VERIFY_NOTICE}</p>
    </div>
  );
}
