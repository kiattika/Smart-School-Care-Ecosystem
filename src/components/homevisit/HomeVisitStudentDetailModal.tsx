import React from 'react';
import { X, MapPin, Phone, Mail, Navigation, ClipboardList, Home, Camera, StickyNote } from 'lucide-react';
import type { Student, StudentHomeLocation, HomeVisitRecord } from '../../types';
import { formatDistance } from '../../utils/geoUtils';

/**
 * รายละเอียดสำหรับเยี่ยมบ้าน (ครูที่ปรึกษา) — ข้อมูลจริงจาก students + student_home_locations + home_visit_records
 * ไม่มีค่าแต่งเติม: ช่องที่ไม่มีข้อมูลแสดง "ยังไม่มีข้อมูล"
 */
interface Props {
  student: Student;
  location?: StudentHomeLocation;
  distanceFromSchoolM: number | null;
  record?: HomeVisitRecord;
  onClose: () => void;
  onOpenForm: () => void;
}

const Row = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
  <div className="flex gap-3 py-2.5 border-b border-white/5 last:border-0">
    <div className="mt-0.5 text-indigo-400 shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm text-slate-100 break-words">{children}</div>
    </div>
  </div>
);
const None = () => <span className="text-slate-500">ยังไม่มีข้อมูล</span>;

export function HomeVisitStudentDetailModal({ student, location, distanceFromSchoolM, record, onClose, onOpenForm }: Props) {
  const address = student.homeLocation?.address || (student as any).address || '';
  const riskLabel = record ? (record.riskLevel === 'HIGH' ? 'เสี่ยงสูง' : record.riskLevel === 'MEDIUM' ? 'เฝ้าระวัง' : 'ปกติ') : '';
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6">
      <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#1c1f2b]/95 backdrop-blur z-10">
          <h2 className="font-bold text-white flex items-center gap-2 text-sm sm:text-base"><Home className="w-5 h-5 text-emerald-400" /> ข้อมูลเยี่ยมบ้าน: {student.name}</h2>
          <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <img src={student.photoUrl || student.avatar} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10 bg-slate-800" />
            <div className="min-w-0">
              <div className="font-bold text-white truncate">{student.name}{student.nickname ? ` (${student.nickname})` : ''}</div>
              <div className="text-xs text-slate-400">เลขประจำตัว {student.studentId} | {student.room || '-'} | เลขที่ {student.studentNo || '-'}</div>
            </div>
          </div>

          <div className="bg-black/20 border border-white/5 rounded-xl px-4">
            <Row icon={<MapPin className="w-4 h-4" />} label="ที่อยู่ (จากทะเบียนนักเรียน)">{address || <None />}</Row>
            <Row icon={<Phone className="w-4 h-4" />} label="เบอร์โทรผู้ปกครอง">
              {student.parentMobile ? <a href={`tel:${student.parentMobile}`} className="text-emerald-300 font-mono hover:underline">{student.parentMobile}</a> : <None />}
            </Row>
            <Row icon={<Mail className="w-4 h-4" />} label="อีเมลผู้ปกครอง">{student.parentEmail || <None />}</Row>
            <Row icon={<Navigation className="w-4 h-4" />} label="พิกัดบ้านที่นักเรียนบันทึก">
              {location ? (
                <div className="space-y-1">
                  <div className="font-mono text-xs text-indigo-300">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}{location.accuracy != null ? ` (±${Math.round(location.accuracy)} ม.)` : ''}</div>
                  <div className="text-[11px] text-slate-400">บันทึกเมื่อ {new Date(location.capturedAt).toLocaleDateString('th-TH')}{distanceFromSchoolM !== null ? ` · ห่างโรงเรียน ${formatDistance(distanceFromSchoolM)} (เส้นตรง)` : ''}</div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-300 hover:underline"><Navigation className="w-3 h-3" /> นำทางด้วย Google Maps</a>
                </div>
              ) : <span className="text-slate-500">นักเรียนยังไม่ได้บันทึกพิกัดบ้าน</span>}
            </Row>
            <Row icon={<StickyNote className="w-4 h-4" />} label="จุดสังเกตที่นักเรียนบันทึก">{location?.landmarkNotes || <None />}</Row>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5"><Camera className="w-4 h-4 text-indigo-400" /> รูปถ่ายที่นักเรียนแนบ</div>
            {location && location.photoUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {location.photoUrls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`รูปบ้าน ${i + 1}`} className="w-24 h-24 object-cover rounded-lg border border-white/10 hover:border-indigo-400" /></a>
                ))}
              </div>
            ) : <div className="text-xs text-slate-500">ยังไม่มีรูป</div>}
          </div>

          <div className="bg-black/20 border border-white/5 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-300 mb-1.5">การเยี่ยมบ้านปีการศึกษานี้</div>
            {record ? (
              <div className="text-sm text-slate-200 space-y-1">
                <div>เยี่ยมเมื่อ {new Date(record.visitedDate + 'T00:00:00').toLocaleDateString('th-TH')} โดย {record.advisorName || '-'}</div>
                <div className="text-xs text-slate-400">ระดับความเสี่ยง: <span className="text-slate-200 font-semibold">{riskLabel}</span>{record.urgentReferral ? ' · ส่งต่อผู้บริหาร' : ''}</div>
                {record.teacherOpinion && <div className="text-xs text-slate-300 whitespace-pre-wrap">“{record.teacherOpinion}”</div>}
              </div>
            ) : <div className="text-xs text-slate-500">ยังไม่ได้บันทึกการเยี่ยมบ้านในปีการศึกษานี้</div>}
          </div>

          <button onClick={onOpenForm} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
            <ClipboardList className="w-4 h-4" /> {record ? 'ดู/แก้ไขแบบบันทึกการเยี่ยมบ้าน' : 'บันทึกการเยี่ยมบ้าน'}
          </button>
        </div>
      </div>
    </div>
  );
}
