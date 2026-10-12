import React from 'react';
import type { Student, StudentHomeVisitInfo, FamilyHomeVisitInfo, ParentInfo } from '../../types';
import { SourceTag } from './formParts';
import { ageFromBirthDate, bodyShapeFromBmi } from '../../lib/homeVisitData';

/** แผงอ่านอย่างเดียว: ข้อมูลที่นักเรียน/ผู้ปกครองกรอก ให้ครูตรวจก่อนลงบันทึกเยี่ยมบ้าน */
const Line = ({ k, v }: { k: string; v?: React.ReactNode }) => (
  <div className="text-xs"><span className="text-slate-500">{k}:</span> <span className="text-slate-200">{v === undefined || v === '' || v === null ? <span className="text-slate-600">-</span> : v}</span></div>
);
const Empty = ({ who }: { who: string }) => <div className="text-xs text-amber-300/90">{who}ยังไม่ได้กรอกข้อมูล — ขอให้กรอกในพอร์ทัลก่อน หรือสอบถามระหว่างเยี่ยมบ้านแล้วจดในช่องแก้ไขข้อมูล</div>;

const personLine = (p: ParentInfo) =>
  p.presence === 'PRESENT' ? `${p.title}${p.firstName} ${p.lastName} · ${p.age ?? '-'} ปี · ${p.occupation || '-'} · ${p.health || '-'} · ${p.phone || 'ไม่มีเบอร์'}${p.incomeBracket ? ` · รายได้ ${p.incomeBracket}` : ''}`
  : p.presence === 'DECEASED' ? 'เสียชีวิต' : p.presence === 'ABSENT' ? 'ไม่ปรากฏ/ไม่ทราบ' : '';

export function HomeVisitInfoPanel({ student, studentInfo, familyInfo, todayYmd }: {
  student: Student; studentInfo: StudentHomeVisitInfo | null; familyInfo: FamilyHomeVisitInfo | null; todayYmd: string;
}) {
  const age = studentInfo?.birthDate ? ageFromBirthDate(studentInfo.birthDate, todayYmd) : null;
  const shape = studentInfo ? bodyShapeFromBmi(studentInfo.weightKg, studentInfo.heightCm) : null;
  const g = familyInfo?.guardian;
  return (
    <div className="space-y-3">
      <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">ข้อมูลที่นักเรียนกรอก <SourceTag source="STUDENT" /></div>
        {!studentInfo ? <Empty who="นักเรียน" /> : (<>
          <Line k="เพศ/อายุ" v={`${studentInfo.gender === 'M' ? 'ชาย' : studentInfo.gender === 'F' ? 'หญิง' : '-'} · ${age ? `${age.years} ปี ${age.months} เดือน` : '-'}`} />
          <Line k="สัญชาติ/เชื้อชาติ/ศาสนา" v={[studentInfo.nationality, studentInfo.ethnicity, studentInfo.religion].filter(Boolean).join(' / ')} />
          <Line k="จบจาก" v={[studentInfo.prevEducationLevel, studentInfo.prevSchool].filter(Boolean).join(' · ')} />
          <Line k="สุขภาพ" v={`น้ำหนัก ${studentInfo.weightKg ?? '-'} กก. ส่วนสูง ${studentInfo.heightCm ?? '-'} ซม.${shape ? ` · ${shape.label}` : ''} · หมู่เลือด ${studentInfo.bloodType || '-'} · ${studentInfo.chronicDisease.trim() ? `โรคประจำตัว: ${studentInfo.chronicDisease}` : 'ไม่มีโรคประจำตัว'}`} />
          <Line k="พักอาศัยกับ" v={studentInfo.livesWith === 'อื่น ๆ' ? studentInfo.livesWithOther : studentInfo.livesWith} />
          <Line k="เดินทางมาโรงเรียน" v={[studentInfo.commuteMode === 'อื่น ๆ' ? studentInfo.commuteOther : studentInfo.commuteMode, studentInfo.commuteDuration].filter(Boolean).join(' · ')} />
          <Line k="สนิทกับ (ครอบครัว)" v={studentInfo.closestInFamily.join(', ')} />
          <Line k="ปรึกษาเมื่อมีปัญหา" v={studentInfo.consultWho.join(', ')} />
          <Line k="บุตรคนที่" v={studentInfo.siblings.onlyChild ? 'บุตรคนเดียว' : `${studentInfo.siblings.birthOrder ?? '-'} จาก ${studentInfo.siblings.totalSiblings ?? '-'} คน`} />
        </>)}
      </div>
      <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">ข้อมูลที่ผู้ปกครองกรอก <SourceTag source="PARENT" /></div>
        {!familyInfo || !g ? <Empty who="ผู้ปกครอง" /> : (<>
          <Line k="บิดา" v={personLine(familyInfo.father)} />
          <Line k="มารดา" v={personLine(familyInfo.mother)} />
          <Line k="สถานภาพบิดา-มารดา" v={familyInfo.parentsStatus === 'อื่น ๆ' ? familyInfo.parentsStatusOther : familyInfo.parentsStatus} />
          <Line k={`ผู้ปกครอง (${g.relation || '-'})`} v={`${g.title}${g.firstName} ${g.lastName} · ${g.age ?? '-'} ปี · ${g.occupation || '-'} · ${g.phone || 'ไม่มีเบอร์'}`} />
          <Line k="ที่อยู่อาศัย" v={`${familyInfo.housingStatus}${familyInfo.rentPerMonth ? ` (ค่าเช่า ${familyInfo.rentPerMonth} บาท/เดือน)` : ''}`} />
          <Line k="ภาระพึ่งพิง" v={familyInfo.dependents.join(', ')} />
          <Line k="ความปลอดภัยที่พัก" v={familyInfo.safetyLevel === 'GOOD' ? 'ปลอดภัย' : familyInfo.safetyLevel === 'RISK' ? `มีความเสี่ยง: ${familyInfo.safetyRisks.join(', ')}` : ''} />
          <Line k="ไฟฟ้า / น้ำดื่ม" v={`${familyInfo.electricity.join(', ')} / ${familyInfo.drinkingWater.join(', ')}`} />
          <Line k="ความเสี่ยงภัยพิบัติ" v={familyInfo.disasterRisks.join(', ')} />
        </>)}
      </div>
    </div>
  );
}
