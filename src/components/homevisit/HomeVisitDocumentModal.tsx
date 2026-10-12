import React, { useMemo } from 'react';
import { formatThaiAddress } from '../../lib/thaiAddress';
import { X, Printer } from 'lucide-react';
import type { Student, StudentHomeLocation, HomeVisitRecord, StudentHomeVisitInfo, FamilyHomeVisitInfo, ParentInfo } from '../../types';
import { formatDistance } from '../../utils/geoUtils';
import {
  ageFromBirthDate, bodyShapeFromBmi, DISADVANTAGE_OPTIONS, DISABILITY_OPTIONS, PARENTS_STATUS, HOUSING_STATUS, DEPENDENTS, SAFETY_RISKS,
  ELECTRICITY, DRINKING_WATER, DISASTER_RISKS, HOUSE_TYPES, DISTANCE_BRACKETS, LIVES_WITH, COMMUTE_MODES, COMMUTE_DURATIONS,
  CLOSEST_FAMILY, CONSULT_OPTIONS, SIGNING_PURPOSE_TEXT,
} from '../../lib/homeVisitData';

/**
 * เอกสารสรุปการเยี่ยมบ้านรายบุคคล (รูปแบบตามแบบเก็บข้อมูลเยี่ยมบ้าน สพฐ.)
 * รวมข้อมูลจากระบบ + นักเรียน + ผู้ปกครอง + ครู — พิมพ์/บันทึกเป็น PDF ผ่านหน้าต่างพิมพ์ของเบราว์เซอร์
 * ช่องที่ยังไม่มีข้อมูลแสดงเป็นเส้นว่าง (ไม่เติมค่าเอง)
 */
interface Props {
  student: Student; location?: StudentHomeLocation; distanceFromSchoolM: number | null;
  record: HomeVisitRecord; studentInfo: StudentHomeVisitInfo | null; familyInfo: FamilyHomeVisitInfo | null;
  todayYmd: string; schoolName?: string; onClose: () => void;
}

const Box = ({ on }: { on: boolean }) => <span className="inline-block w-3 h-3 border border-black mr-1 align-middle text-[9px] leading-[10px] text-center">{on ? '✓' : ''}</span>;
const Checks = ({ options, picked, other }: { options: string[]; picked: string[]; other?: string }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
    {options.map(o => <span key={o}><Box on={picked.includes(o)} />{o}{o === 'อื่น ๆ' && picked.includes(o) && other ? `: ${other}` : ''}</span>)}
  </div>
);
const F = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <span className="mr-4">{label} <span className="inline-block min-w-[60px] border-b border-dotted border-black px-1 font-semibold">{value === undefined || value === null || value === '' ? ' ' : value}</span></span>
);
const H = ({ children }: { children: React.ReactNode }) => <div className="font-bold bg-gray-200 px-2 py-0.5 mt-3 mb-1.5 text-[13px]">{children}</div>;
const Q = ({ n, t, children }: { n?: string; t: string; children: React.ReactNode }) => (
  <div className="mb-2 break-inside-avoid"><div className="font-semibold">{n ? `${n}. ` : ''}{t}</div><div className="pl-3">{children}</div></div>
);
const person = (p: ParentInfo) => p.presence === 'PRESENT' ? `${p.title}${p.firstName} ${p.lastName}` : p.presence === 'DECEASED' ? 'เสียชีวิต' : p.presence === 'ABSENT' ? 'ไม่ปรากฏ/ไม่ทราบ' : '';
const thDate = (ymd: string) => (ymd ? new Date(ymd + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export function HomeVisitDocumentModal({ student, location, distanceFromSchoolM, record, studentInfo, familyInfo, todayYmd, schoolName = 'โรงเรียนอุตรดิตถ์', onClose }: Props) {
  const si = studentInfo, fi = familyInfo;
  const age = si?.birthDate ? ageFromBirthDate(si.birthDate, record.visitedDate || todayYmd) : null;
  const shape = si ? bodyShapeFromBmi(si.weightKg, si.heightCm) : null;
  // ทะเบียนส่วนกลางก่อน; ไม่มี → ที่อยู่ที่นักเรียนกรอกแบบแยกช่อง
  const address = student.homeLocation?.address || (student as any).address || formatThaiAddress(si?.currentAddress);
  const g = fi?.guardian;
  const photos = useMemo(() => [record.exteriorPhotoUrl, record.interiorPhotoUrl, ...record.extraPhotoUrls].filter(Boolean), [record]);

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] overflow-y-auto p-2 sm:p-6" id="hv-doc-overlay">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #hv-doc-sheet, #hv-doc-sheet * { visibility: visible !important; }
          #hv-doc-overlay { position: static !important; background: none !important; overflow: visible !important; padding: 0 !important; }
          #hv-doc-sheet { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; margin: 0 !important; }
          .hv-no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
      <div className="max-w-[820px] mx-auto">
        <div className="hv-no-print flex justify-between items-center mb-3 gap-3">
          <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm"><Printer className="w-4 h-4" /> พิมพ์ / บันทึกเป็น PDF</button>
          <span className="text-[11px] text-slate-300 flex-1">ในหน้าต่างพิมพ์เลือกปลายทาง “บันทึกเป็น PDF” เพื่อดาวน์โหลดไฟล์</span>
          <button onClick={onClose} aria-label="ปิด" className="text-white bg-white/10 hover:bg-white/20 rounded-full p-2"><X className="w-4 h-4" /></button>
        </div>

        <div id="hv-doc-sheet" className="bg-white text-black p-8 text-[12px] leading-[1.6] shadow-2xl" style={{ fontFamily: "'Sarabun','TH Sarabun New','Noto Sans Thai',sans-serif" }}>
          <div className="text-center font-bold text-[15px]">แบบเก็บข้อมูลเยี่ยมบ้านนักเรียนรายบุคคล</div>
          <div className="text-center">{schoolName} · ปีการศึกษา {record.visitYear}</div>
          <div className="text-center text-[11px] text-gray-600">เยี่ยมบ้านเมื่อ {thDate(record.visitedDate)}</div>

          <H>ตอนที่ 1 ข้อมูลพื้นฐาน</H>
          <Q n="1" t="ข้อมูลนักเรียน">
            <F label="ชื่อ-สกุล" value={student.name} /><F label="ชื่อเล่น" value={student.nickname} /><F label="เลขประจำตัว" value={student.studentId} />
            <F label="ห้อง" value={student.room} /><F label="เลขที่" value={student.studentNo} /><br />
            <F label="เพศ" value={si ? (si.gender === 'M' ? 'ชาย' : si.gender === 'F' ? 'หญิง' : '') : ''} /><F label="วันเกิด" value={si?.birthDate ? thDate(si.birthDate) : ''} />
            <F label="อายุ" value={age ? `${age.years} ปี ${age.months} เดือน` : ''} /><br />
            <F label="สัญชาติ" value={si?.nationality} /><F label="เชื้อชาติ" value={si?.ethnicity} /><F label="ศาสนา" value={si?.religion} />
          </Q>
          <Q n="2" t="ประวัติการศึกษา">
            <F label="จบระดับ" value={si?.prevEducationLevel} /><F label="ผลการเรียนเฉลี่ย" value={si?.prevGpa} /><br />
            <F label="จากโรงเรียน" value={si?.prevSchool} /><F label="สังกัด" value={si?.prevAffiliation} /><F label="จังหวัด" value={si?.prevProvince} />
          </Q>
          <Q n="3" t="ข้อมูลสุขภาพ">
            <F label="น้ำหนัก (กก.)" value={si?.weightKg} /><F label="ส่วนสูง (ซม.)" value={si?.heightCm} /><F label="รูปร่าง" value={shape ? `${shape.label} (BMI ${shape.bmi})` : ''} />
            <F label="หมู่โลหิต" value={si?.bloodType} /><F label="โรคประจำตัว" value={si ? (si.chronicDisease.trim() || 'ไม่มี') : ''} />
          </Q>
          <Q n="4" t="ที่อยู่ของนักเรียน">
            <div>ที่อยู่ปัจจุบัน: <b>{address}</b></div>
            <div>ตามทะเบียนบ้าน: <b>{si ? (si.registeredSameAsCurrent ? 'เหมือนที่อยู่ปัจจุบัน' : si.registeredAddress) : ''}</b></div>
            {location && <div className="text-[11px] text-gray-600">พิกัดบ้าน {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</div>}
          </Q>
          <Q n="5" t="ประเภทความด้อยโอกาส"><Checks options={DISADVANTAGE_OPTIONS} picked={record.disadvantage} /></Q>
          <Q n="6" t="ประเภทความพิการ"><Checks options={DISABILITY_OPTIONS} picked={record.disability} /></Q>

          <H>ตอนที่ 2 ข้อมูลครอบครัว</H>
          <Q n="7" t="บิดา"><F label="ชื่อ-สกุล" value={fi ? person(fi.father) : ''} /><F label="อายุ" value={fi?.father.age} /><F label="อาชีพ" value={fi?.father.occupation} /><F label="สุขภาพ" value={fi?.father.health} /><F label="รายได้/เดือน" value={fi?.father.incomeBracket} /><F label="โทร" value={fi?.father.phone} /></Q>
          <Q n="8" t="มารดา"><F label="ชื่อ-สกุล" value={fi ? person(fi.mother) : ''} /><F label="อายุ" value={fi?.mother.age} /><F label="อาชีพ" value={fi?.mother.occupation} /><F label="สุขภาพ" value={fi?.mother.health} /><F label="รายได้/เดือน" value={fi?.mother.incomeBracket} /><F label="โทร" value={fi?.mother.phone} /></Q>
          <Q n="9" t="พี่น้องที่อาศัยในครัวเรือนเดียวกัน">
            {si ? (si.siblings.onlyChild ? 'เป็นบุตรคนเดียว' : <><F label="เป็นบุตรคนที่" value={si.siblings.birthOrder} /><F label="จาก" value={si.siblings.totalSiblings} /><F label="พี่น้องชาย" value={si.siblings.brothers} /><F label="พี่น้องหญิง" value={si.siblings.sisters} /><F label="กำลังศึกษา" value={si.siblings.studying} /></>) : <F label="" value="" />}
          </Q>
          <Q n="10" t="ในครอบครัวสนิทสนมกับใครมากที่สุด"><Checks options={CLOSEST_FAMILY} picked={si?.closestInFamily || []} other={si?.closestOther} /></Q>
          <Q n="11" t="เมื่อทุกข์ใจ/มีปัญหา ส่วนใหญ่ปรึกษา"><Checks options={CONSULT_OPTIONS} picked={si?.consultWho || []} other={si?.consultOther} /></Q>
          <Q n="12" t="สถานภาพของบิดา-มารดา"><Checks options={PARENTS_STATUS} picked={fi ? [fi.parentsStatus] : []} other={fi?.parentsStatusOther} /></Q>
          <Q n="13" t="ผู้ปกครอง"><F label="เกี่ยวข้องเป็น" value={g?.relation} /><F label="ชื่อ-สกุล" value={g ? `${g.title}${g.firstName} ${g.lastName}`.trim() : ''} /><F label="อายุ" value={g?.age} /><F label="อาชีพ" value={g?.occupation} /><F label="รายได้/เดือน" value={g?.incomeBracket} /><F label="โทร" value={g?.phone} /></Q>

          <H>ตอนที่ 3 ข้อมูลสถานะครัวเรือน</H>
          <Q n="15" t="สถานะที่อยู่อาศัย"><Checks options={HOUSING_STATUS} picked={fi ? [fi.housingStatus] : []} other={fi?.housingOther} />{fi?.rentPerMonth ? <div>ค่าเช่า {fi.rentPerMonth} บาท/เดือน</div> : null}</Q>
          <Q n="16" t="ภาระพึ่งพิงของครัวเรือน"><Checks options={DEPENDENTS} picked={fi?.dependents || []} /></Q>
          <Q n="17" t="นักเรียนพักอาศัยอยู่กับ"><Checks options={LIVES_WITH} picked={si ? [si.livesWith] : []} other={si?.livesWithOther} /></Q>
          <Q n="18" t="การเดินทางมาโรงเรียน"><Checks options={COMMUTE_MODES} picked={si ? [si.commuteMode] : []} other={si?.commuteOther} /><Checks options={COMMUTE_DURATIONS} picked={si ? [si.commuteDuration] : []} /></Q>
          <Q n="19" t="ระยะทางจากบ้านถึงโรงเรียน"><Checks options={DISTANCE_BRACKETS} picked={[record.distanceBracket]} />{distanceFromSchoolM !== null && <div className="text-[11px] text-gray-600">ระบบคำนวณจากพิกัดบ้าน ได้ {formatDistance(distanceFromSchoolM)} (เส้นตรง)</div>}</Q>
          <Q n="21" t="สภาพแวดล้อมระหว่างการเดินทาง"><Box on={record.travelEnvironment === 'SAFE'} />ปลอดภัย <Box on={record.travelEnvironment === 'RISK'} />มีความเสี่ยง {record.travelRiskNote && `: ${record.travelRiskNote}`}</Q>
          <Q n="22" t="ความปลอดภัยของที่อยู่อาศัย"><Box on={fi?.safetyLevel === 'GOOD'} />ปลอดภัย <Box on={fi?.safetyLevel === 'RISK'} />มีความเสี่ยง<Checks options={SAFETY_RISKS} picked={fi?.safetyRisks || []} other={fi?.safetyOther} /></Q>
          <Q n="23" t="สภาพแวดล้อมของครัวเรือน"><div>ไฟฟ้า:</div><Checks options={ELECTRICITY} picked={fi?.electricity || []} /><div>น้ำดื่ม:</div><Checks options={DRINKING_WATER} picked={fi?.drinkingWater || []} /><div>ภัยพิบัติ:</div><Checks options={DISASTER_RISKS} picked={fi?.disasterRisks || []} /></Q>
          <Q n="24" t="เพื่อนสนิท">
            <F label="ในโรงเรียน" value={si ? [si.friendsInSchool.title + si.friendsInSchool.firstName, si.friendsInSchool.lastName, si.friendsInSchool.classRoom].filter(Boolean).join(' ') : ''} />
            <F label="นอกโรงเรียน" value={si ? [si.friendsOutside.title + si.friendsOutside.firstName, si.friendsOutside.lastName].filter(Boolean).join(' ') : ''} />
          </Q>

          <H>ตอนที่ 4 ข้อมูลเชิงลึก (ภาพถ่ายและลักษณะที่อยู่อาศัย)</H>
          <Q t="ลักษณะกายภาพของบ้าน"><Checks options={HOUSE_TYPES} picked={[record.houseType]} other={record.houseTypeOther} /></Q>
          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 mb-1 break-inside-avoid">
              {photos.map((u, i) => <div key={u}><img src={u} alt={`รูปที่ ${i + 1}`} className="w-full h-32 object-cover border border-gray-400" /><div className="text-center text-[10px]">{i === 0 ? 'รูปที่ 1 ภายนอก' : i === 1 && record.interiorPhotoUrl ? 'รูปที่ 2 ภายใน' : `รูปเพิ่มเติม`}</div></div>)}
            </div>
          ) : null}
          {record.photoNote && <div>หมายเหตุรูป: {record.photoNote}</div>}

          <H>ตอนที่ 5 ความคิดเห็นของครูที่ปรึกษา</H>
          <Q n="26" t="สภาพที่น่าเป็นห่วงและความต้องการจำเป็น"><div className="whitespace-pre-wrap">{record.concerns}</div></Q>
          <Q t="ข้อสรุปจากการเยี่ยมบ้าน"><div className="whitespace-pre-wrap">{record.summary}</div></Q>
          <div>ระดับความเสี่ยง: <b>{record.riskLevel === 'HIGH' ? 'เสี่ยงสูง' : record.riskLevel === 'MEDIUM' ? 'เฝ้าระวัง' : 'ปกติ'}</b>{record.urgentReferral ? ' · ส่งต่อผู้บริหาร/ต้องการความช่วยเหลือเร่งด่วน' : ''}</div>
          {record.correctionNotes && <div className="mt-1">ข้อมูลที่ครูแก้ไขจากการสอบถาม: {record.correctionNotes}</div>}

          <div className="mt-4 break-inside-avoid">
            <div><Box on={record.purposeExplained} />{SIGNING_PURPOSE_TEXT}</div>
            <div className="grid grid-cols-2 gap-6 mt-8 text-center">
              <div>ลงชื่อ ............................................. ผู้ให้ข้อมูล<br />( {g && g.firstName ? `${g.title}${g.firstName} ${g.lastName}` : '.............................................'} )<br />ผู้ปกครอง</div>
              <div>ลงชื่อ ............................................. ครูที่ปรึกษา<br />( {record.advisorName} )<br />{record.advisorPosition}{record.advisorPhone ? ` โทร ${record.advisorPhone}` : ''}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
