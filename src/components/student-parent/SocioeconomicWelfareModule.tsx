import React, { useState } from 'react';
import { 
  Users, 
  Home, 
  MapPin, 
  Phone, 
  Briefcase, 
  DollarSign, 
  FileCheck, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  Camera, 
  Navigation, 
  Sparkles,
  Award,
  Zap,
  Bus,
  UserCheck
} from 'lucide-react';
import { useStore } from '../../store';
import { GuardianBackground, HomeVisitLogRecord, EQFHardshipScreening } from '../../types';

export function SocioeconomicWelfareModule({ studentId }: { studentId: string }) {
  const { 
    guardianProfiles, 
    homeVisitLogs, 
    eqfHardshipScreenings, 
    students 
  } = useStore();

  const student = students.find(s => s.studentId === studentId) || students[0];
  const guardian = guardianProfiles[student.studentId] || {
    relation: 'บิดา',
    fullName: 'นายสมชาย เจริญสุข',
    phone: '081-987-6543',
    lineId: 'somchai.j',
    occupation: 'ข้าราชการครู',
    monthlyIncome: 38000,
    maritalStatus: 'MARRIED_TOGETHER',
    householdMembersCount: 4,
    dependentsCount: 2,
    emergencyContact: {
      name: 'นางสมศรี เจริญสุข (มารดา)',
      phone: '089-123-4567',
      relationship: 'มารดา (พยาบาลวิชาชีพ)'
    }
  };

  const visit = homeVisitLogs.find(v => v.studentId === student.studentId) || {
    id: 'hv-01',
    studentId: student.studentId,
    visitedDate: '2026-07-08',
    teacherName: 'ครูกิตติศักดิ์',
    counselorName: 'ครูแนะแนวพิมพ์ชนก',
    coordinates: student.homeLocation.coordinates,
    addressText: student.homeLocation.address,
    livingConditions: 'บ้านเดี่ยวปูนสองชั้น สภาพแวดล้อมสงบ มีโต๊ะหนังสือและห้องอ่านหนังสือเป็นสัดส่วนชัดเจน',
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        caption: 'บริเวณหน้าบ้านและบรรยากาศโดยรอบ'
      },
      {
        url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80',
        caption: 'โต๊ะทำงานและพื้นที่อ่านหนังสือของนักเรียน'
      }
    ],
    riskLevel: 'LOW' as const,
    counselorNotes: 'ครอบครัวอบอุ่น ผู้ปกครองส่งเสริมการศึกษาอย่างเต็มที่ นักเรียนมีความพร้อมทั้งด้านอุปกรณ์และการสนับสนุนจากที่บ้าน',
    studentEnvironmentRating: 5
  };

  const eqf = eqfHardshipScreenings[student.studentId] || {
    id: 'eqf-01',
    studentId: student.studentId,
    householdIncomePerCapita: 14500,
    electricityBillMonthly: 1200,
    housingConditionRating: 5,
    travelBarrierScore: 1,
    familyBurdenScore: 1,
    overallHardshipIndex: 12,
    isEligibleForGrant: false,
    grantType: 'กลุ่มทั่วไป (ไม่เข้าข่ายยากจนพิเศษ)',
    status: 'APPROVED' as const,
    assessedDate: '2026-06-25'
  };

  const [activeTab, setActiveTab] = useState<'family' | 'homevisit' | 'eqf'>('family');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Sub navigation pills */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl w-full max-w-lg mx-auto">
        <button
          onClick={() => setActiveTab('family')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'family'
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>ข้อมูลครอบครัว & ผู้ปกครอง</span>
        </button>
        <button
          onClick={() => setActiveTab('homevisit')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'homevisit'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>บันทึกการเยี่ยมบ้าน</span>
        </button>
        <button
          onClick={() => setActiveTab('eqf')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'eqf'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>คัดกรองทุนเสมอภาค (กสศ.)</span>
        </button>
      </div>

      {activeTab === 'family' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Primary Guardian Card */}
          <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">ข้อมูลผู้ปกครองหลัก (Primary Guardian)</h3>
                  <p className="text-[11px] text-slate-400">ความสัมพันธ์: {guardian.relation}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                ยืนยันตัวตนแล้ว
              </span>
            </div>

            <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">ชื่อ-นามสกุล:</span>
                <span className="text-xs font-bold text-white">{guardian.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">เบอร์โทรศัพท์ติดต่อ:</span>
                <a href={`tel:${guardian.phone}`} className="text-xs font-bold text-indigo-400 hover:underline flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {guardian.phone}
                </a>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">LINE ID:</span>
                <span className="text-xs font-mono font-bold text-emerald-400">@{guardian.lineId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">อาชีพ:</span>
                <span className="text-xs text-slate-200">{guardian.occupation}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">สถานภาพสมรสของบิดามารดา:</span>
                <span className="text-xs font-bold text-blue-300">อยู่ร่วมกัน (Married Together)</span>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
              <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-rose-400" />
                ผู้ติดต่อกรณีฉุกเฉินเร่งด่วน (Emergency Contact)
              </h4>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">{guardian.emergencyContact.name}</span>
                <a href={`tel:${guardian.emergencyContact.phone}`} className="font-bold text-rose-300 hover:underline">
                  {guardian.emergencyContact.phone}
                </a>
              </div>
              <p className="text-[10px] text-slate-400">ความสัมพันธ์: {guardian.emergencyContact.relationship}</p>
            </div>
          </div>

          {/* Household & Socioeconomic Overview */}
          <div className="lg:col-span-6 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              สภาพแวดล้อมทางเศรษฐกิจและครัวเรือน (Household Overview)
            </h3>
            <p className="text-[11px] text-slate-400">
              ข้อมูลสำหรับจัดสรรทุนการศึกษา สิทธิประโยชน์ และการสนับสนุนสวัสดิการ
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 block mb-1">รายได้ครัวเรือนต่อเดือน</span>
                <span className="text-lg font-black text-white">฿{(guardian?.monthlyIncome || 0).toLocaleString()}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">เฉลี่ยต่อคน: ฿{Math.round((guardian?.monthlyIncome || 0) / (guardian?.householdMembersCount || 1)).toLocaleString()}/เดือน</span>
              </div>

              <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 block mb-1">จำนวนสมาชิกในบ้าน</span>
                <span className="text-lg font-black text-white">{guardian.householdMembersCount} คน</span>
                <span className="text-[10px] text-indigo-300 block mt-0.5">ผู้อยู่ในความอุปการะ: {guardian.dependentsCount} คน</span>
              </div>
            </div>

            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2 text-xs">
              <span className="text-slate-400 block">ที่อยู่ตามทะเบียนบ้าน & ที่พักปัจจุบัน:</span>
              <p className="font-medium text-slate-200 leading-relaxed flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                {student.homeLocation.address}
              </p>
            </div>

            <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs text-blue-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>ข้อมูลได้รับการตรวจสอบความถูกต้องโดยงานกิจการนักเรียนและครูประจำชั้น</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'homevisit' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Home className="w-4 h-4 text-emerald-400" />
                รายงานผลการเยี่ยมบ้านดิจิทัล (Digital Home Visit Report)
              </h3>
              <p className="text-[11px] text-slate-400">
                ลงพื้นที่โดย {visit.teacherName} ร่วมกับ {visit.counselorName} • วันที่ {visit.visitedDate}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ระดับความเสี่ยง: ปกติ (Low Risk)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* GPS & House Environment Notes */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-indigo-400" />
                    พิกัด GPS ตำแหน่งบ้านนักเรียน:
                  </span>
                  <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {visit.coordinates[0]}, {visit.coordinates[1]}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{visit.addressText}</p>
              </div>

              <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-slate-200">สภาพแวดล้อมและความเป็นอยู่:</h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  {visit.livingConditions}
                </p>
              </div>

              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl space-y-2">
                <h4 className="text-xs font-bold text-indigo-300">ความเห็นและข้อเสนอแนะของครูแนะแนว:</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {visit.counselorNotes}
                </p>
              </div>
            </div>

            {/* Photos from Home Visit */}
            <div className="lg:col-span-6 space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                รูปถ่ายบันทึกการลงพื้นที่เยี่ยมบ้านจริง
              </h4>

              <div className="grid grid-cols-2 gap-3">
                {visit.photos.map((photo, i) => (
                  <div
                    key={i}
                    onClick={() => setSelectedPhoto(photo.url)}
                    className="group relative rounded-2xl overflow-hidden border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all aspect-video bg-slate-950"
                  >
                    <img 
                      src={photo.url} 
                      alt={photo.caption} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end p-2.5">
                      <span className="text-[10px] text-white font-medium truncate">{photo.caption}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-slate-400">การประเมินความพร้อมของสิ่งแวดล้อมการเรียนรู้:</span>
                <span className="text-emerald-400 font-bold">⭐⭐⭐⭐⭐ (5/5 ดีเยี่ยม)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'eqf' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                ผลการคัดกรองทุนเสมอภาค กสศ. (Equitable Education Fund - EQF)
              </h3>
              <p className="text-[11px] text-slate-400">
                ระบบประเมินความยากจนและจัดสรรเงินอุดหนุนแบบมีเงื่อนไขตามเกณฑ์มาตรฐาน สพฐ. & กสศ.
              </p>
            </div>

            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              eqf.isEligibleForGrant
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              {eqf.grantType}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block mb-1">รายได้เฉลี่ยต่อคนต่อเดือน</span>
              <span className="text-xl font-bold text-white">฿{(eqf?.householdIncomePerCapita || 0).toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 block mt-1">เกณฑ์ กสศ. ≤ ฿3,000/เดือน</span>
            </div>

            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                ค่าไฟฟ้าเฉลี่ยต่อเดือน
              </span>
              <span className="text-xl font-bold text-white">฿{(eqf?.electricityBillMonthly || 0).toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 block mt-1">เกณฑ์ใช้ไฟฟ้าเพื่อการดำรงชีพ</span>
            </div>

            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1">
                <Bus className="w-3.5 h-3.5 text-indigo-400" />
                อุปสรรคการเดินทาง
              </span>
              <span className="text-xl font-bold text-white">ระดับ {eqf.travelBarrierScore}/5</span>
              <span className="text-[10px] text-emerald-400 block mt-1">เดินทางสะดวก ปลอดภัย</span>
            </div>

            <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block mb-1">ดัชนีความยากจนรวม (Hardship)</span>
              <span className="text-xl font-black text-indigo-400">{eqf.overallHardshipIndex}/100</span>
              <span className="text-[10px] text-slate-400 block mt-1">อยู่ในเกณฑ์กลุ่มทั่วไป</span>
            </div>
          </div>

          <div className="p-4 bg-slate-800/30 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-300">
            <span>วันที่ประเมินคัดกรอง: {eqf.assessedDate}</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านการรับรองโดยคณะกรรมการสถานศึกษาขั้นพื้นฐาน
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
