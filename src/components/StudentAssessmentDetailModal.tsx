import React, { useState } from 'react';
import { 
  X, 
  User, 
  Sparkles, 
  Brain, 
  Compass, 
  ShieldCheck, 
  Target, 
  Bus, 
  CheckCircle2, 
  Printer, 
  FileText, 
  Clock, 
  Phone, 
  MessageSquare,
  AlertTriangle,
  Lock,
  Layers,
  Award,
  Lightbulb,
  Users
} from 'lucide-react';
import { StudentSelfAssessment, Student } from '../types';

interface Props {
  student: Student;
  assessment?: StudentSelfAssessment;
  viewerRole: 'TEACHER' | 'HOMEROOM' | 'PARENT' | 'EXECUTIVE' | 'STUDENT';
  onClose: () => void;
}

export const StudentAssessmentDetailModal: React.FC<Props> = ({
  student,
  assessment,
  viewerRole,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>('summary');

  if (!assessment) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full text-center shadow-xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">ยังไม่พบข้อมูลการประเมินตนเอง</h3>
          <p className="text-xs text-slate-500 mt-2">
            นักเรียน ({student.name}) ยังไม่ได้ทำแบบวิเคราะห์ตนเอง 30 ข้อ หรืออยู่ระหว่างการบันทึกข้อมูล
          </p>
          <div className="mt-5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAdvisorOrAdmin = viewerRole === 'HOMEROOM' || viewerRole === 'TEACHER' || viewerRole === 'STUDENT';

  return (
    <div id="student-assessment-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-50 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/50 border border-blue-400/40 flex items-center justify-center text-white font-bold text-lg shadow-inner">
              <Brain className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  แบบประเมินตนเอง 30 ข้อ
                </span>
                <span className="text-xs text-slate-300">รหัสนักเรียน: {student.studentId} ({student.className || student.room || 'ม.5/8'})</span>
              </div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {student.name} {assessment.basicInfo?.nickname && <span className="text-sky-300">({assessment.basicInfo.nickname})</span>}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs flex items-center gap-1 transition-all"
              title="พิมพ์ / บันทึก PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">พิมพ์</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'summary'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              📊 สรุปภาพรวม & Learner DNA
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'details'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              📑 รายละเอียดทั้ง 6 ส่วน (30 ข้อ)
            </button>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>ประเมินเมื่อ: {new Date(assessment.submittedAt || Date.now()).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'summary' ? (
            <div className="space-y-6">
              {/* Top Highlights Bento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>สไตล์การเรียนรู้ที่ชอบ</span>
                    <Brain className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {assessment.learningStyle?.preferredStyles?.join(', ') || 'ลงมือปฏิบัติจริง'}
                  </div>
                  <div className="text-[11px] text-purple-700 mt-1 font-medium">
                    {assessment.learningStyle?.learningObstacles?.length ? `อุปสรรค: ${assessment.learningStyle.learningObstacles.join(', ')}` : 'ไม่มีอุปสรรคเด่นชัด'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>บทบาทในงานกลุ่ม</span>
                    <Users className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {assessment.identity?.groupRole || 'ค้นหาข้อมูลวิเคราะห์'}
                  </div>
                  <div className="text-[11px] text-sky-700 mt-1 font-medium">
                    3 คำนิยาม: {assessment.identity?.threeWords || 'ร่าเริง, มุ่งมั่น'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>การใช้ AI & อุปกรณ์</span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    AI: {assessment.learningStyle?.aiExperience || 'ใช้อยู่ประจำ'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">
                    อุปกรณ์: {assessment.learningStyle?.primaryDevices?.join(', ') || 'สมาร์ตโฟน'}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                    <span>ดัชนีความปลอดภัย</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-extrabold text-slate-900">
                      {assessment.socialAndSafety?.schoolSafetyScore || 5}/5
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      (assessment.socialAndSafety?.schoolSafetyScore || 5) >= 4 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {(assessment.socialAndSafety?.schoolSafetyScore || 5) >= 4 ? 'ปลอดภัยสูง' : 'ควรเฝ้าระวัง'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    บูลลี่: {assessment.socialAndSafety?.schoolBullyingExperience || 'ไม่เคย'}
                  </div>
                </div>
              </div>

              {/* Actionable Insights for Teachers & Advisors */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-200/80">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                  <span>ข้อเสนอแนะสำหรับการจัดกิจกรรมการเรียนรู้ (Teacher & Advisor Insights)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-white/80 p-3.5 rounded-xl border border-blue-100 space-y-1.5">
                    <div className="font-semibold text-slate-800">🎯 สไตล์ครูที่ผู้เรียนตอบรับได้ดีที่สุด:</div>
                    <div className="text-slate-600 italic">
                      "{assessment.learningStyle?.teacherStyle || 'ชอบครูที่เปิดโอกาสให้ถาม มีสื่อภาพและเทคโนโลยีประกอบ'}"
                    </div>
                  </div>
                  <div className="bg-white/80 p-3.5 rounded-xl border border-blue-100 space-y-1.5">
                    <div className="font-semibold text-slate-800">🚀 เป้าหมายอนาคต & สิ่งที่ต้องการสนับสนุน:</div>
                    <div className="text-slate-600">
                      <span className="font-medium text-emerald-700">เป้าหมาย:</span> {assessment.futureGoals?.careerGoals || 'ยังไม่ระบุ'}
                    </div>
                    <div className="text-slate-600">
                      <span className="font-medium text-blue-700">สิ่งที่ขอหนุนเสริม:</span> {assessment.futureGoals?.supportNeeded || 'การแนะแนวทางศึกษาต่อ'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Confidential Note if Homeroom/Advisor */}
              {isAdvisorOrAdmin && assessment.futureGoals?.privateMessageToTeacher && (
                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-300">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-2">
                    <Lock className="w-4 h-4 text-amber-700" />
                    <span>ข้อความส่วนตัวส่งถึงคุณครู (ข้อ 30)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-200/60 text-amber-800">เฉพาะครูที่ปรึกษา</span>
                  </div>
                  <p className="text-xs text-amber-900 bg-white p-3.5 rounded-xl border border-amber-200 italic">
                    "{assessment.futureGoals.privateMessageToTeacher}"
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Detailed 6 Sections */
            <div className="space-y-6">
              {/* Section 1 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <User className="w-4 h-4" />
                  <span>ส่วนที่ 1: ข้อมูลพื้นฐานและการติดต่อ (ข้อ 1 - 6)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">ชื่อ-นามสกุล (ข้อ 1):</span>
                    <span className="font-semibold text-slate-800">{assessment.basicInfo?.titleFullName || student.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ชื่อเล่น (ข้อ 2):</span>
                    <span className="font-semibold text-slate-800">{assessment.basicInfo?.nickname || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ชั้น/ห้อง & เลขที่ (ข้อ 3-4):</span>
                    <span className="font-semibold text-slate-800">{assessment.basicInfo?.gradeRoom || 'ม.5/8'} เลขที่ {assessment.basicInfo?.studentNo || '1'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ช่องทางติดต่อสะดวก (ข้อ 5):</span>
                    <span className="font-semibold text-slate-800">{assessment.basicInfo?.contactChannels?.join(', ') || '-'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block">ข้อมูลติดต่อ/ID (ข้อ 6):</span>
                    <span className="font-semibold text-slate-800">{assessment.basicInfo?.contactDetail || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 2 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Bus className="w-4 h-4" />
                  <span>ส่วนที่ 2: ภูมิหลัง บริบทครอบครัว และการเดินทาง (ข้อ 7 - 11)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">พักอาศัยอยู่กับ (ข้อ 7):</span>
                    <span className="font-semibold text-slate-800">{assessment.familyBackground?.livingWith || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">พาหนะเดินทาง (ข้อ 8):</span>
                    <span className="font-semibold text-slate-800">{assessment.familyBackground?.transportation || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">เวลาเดินทาง (ข้อ 9):</span>
                    <span className="font-semibold text-slate-800">{assessment.familyBackground?.travelTime || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ภาระงานนอกเหนือการเรียน (ข้อ 10):</span>
                    <span className="font-semibold text-slate-800">{assessment.familyBackground?.responsibilities?.join(', ') || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ผู้ที่ปรึกษาบ่อยที่สุด (ข้อ 11):</span>
                    <span className="font-semibold text-slate-800">{assessment.familyBackground?.consultPerson || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 3 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Compass className="w-4 h-4" />
                  <span>ส่วนที่ 3: ตัวตน นิสัย และความสนใจ (ข้อ 12 - 15)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">3 คำอธิบายตัวตน (ข้อ 12):</span>
                    <span className="font-semibold text-slate-800">{assessment.identity?.threeWords || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">บทบาทงานกลุ่ม (ข้อ 15):</span>
                    <span className="font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">{assessment.identity?.groupRole || '-'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block">งานอดิเรก/กิจกรรมยามว่าง (ข้อ 13):</span>
                    <span className="font-semibold text-slate-800">{assessment.identity?.hobbies?.join(', ') || '-'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block">ทักษะ/ความสามารถพิเศษ/จุดแข็ง (ข้อ 14):</span>
                    <span className="font-semibold text-slate-800">{assessment.identity?.specialSkills || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 4 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Brain className="w-4 h-4" />
                  <span>ส่วนที่ 4: สไตล์การเรียนรู้และทักษะยุคใหม่ (ข้อ 16 - 20)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">สไตล์การเรียนรู้ที่เข้าใจดีที่สุด (ข้อ 16):</span>
                    <span className="font-semibold text-purple-800">{assessment.learningStyle?.preferredStyles?.join(', ') || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ประสบการณ์การใช้ AI (ข้อ 19):</span>
                    <span className="font-semibold text-slate-800">{assessment.learningStyle?.aiExperience || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">อุปสรรคต่อการเรียน (ข้อ 17):</span>
                    <span className="font-semibold text-rose-700">{assessment.learningStyle?.learningObstacles?.join(', ') || 'ไม่มี'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">อุปกรณ์ที่ใช้ค้นคว้า (ข้อ 18):</span>
                    <span className="font-semibold text-slate-800">{assessment.learningStyle?.primaryDevices?.join(', ') || '-'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block">สไตล์ครูผู้สอนที่ทำให้มีความสุข (ข้อ 20):</span>
                    <span className="font-semibold text-slate-800 italic">{assessment.learningStyle?.teacherStyle || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Section 5 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>ส่วนที่ 5: ความสัมพันธ์ โซเชียลมีเดีย และความปลอดภัย (ข้อ 21 - 26)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">โซเชียลมีเดียหลัก (ข้อ 21):</span>
                    <span className="font-semibold text-slate-800">{assessment.socialAndSafety?.topSocialMedia?.join(', ') || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ความปลอดภัยใน รร. (ข้อ 24):</span>
                    <span className="font-bold text-emerald-700">{assessment.socialAndSafety?.schoolSafetyScore || 5} / 5 คะแนน</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ความเครียดจากการเปรียบเทียบ (ข้อ 25):</span>
                    <span className="font-semibold text-slate-800">{assessment.socialAndSafety?.socialComparisonStress || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">บูลลี่ในโรงเรียน (ข้อ 22):</span>
                    <span className="font-semibold text-slate-800">{assessment.socialAndSafety?.schoolBullyingExperience || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Cyberbullying ออนไลน์ (ข้อ 23):</span>
                    <span className="font-semibold text-slate-800">{assessment.socialAndSafety?.cyberbullyingExperience || '-'}</span>
                  </div>
                  <div className="sm:col-span-3">
                    <span className="text-slate-400 block">ข้อฝากถึงครูเรื่องความปลอดภัย/ออนไลน์ (ข้อ 26):</span>
                    <span className="font-semibold text-slate-800">{assessment.socialAndSafety?.messageToTeacherSafety || 'ไม่มีข้อฝากพิเศษ'}</span>
                  </div>
                </div>
              </div>

              {/* Section 6 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Target className="w-4 h-4" />
                  <span>ส่วนที่ 6: เป้าหมาย อนาคต และข้อความถึงครู (ข้อ 27 - 30)</span>
                </h4>
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">เป้าหมายการศึกษาต่อ / สายอาชีพ (ข้อ 27):</span>
                    <span className="font-bold text-slate-900 text-sm">{assessment.futureGoals?.careerGoals || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">สิ่งที่อยากพัฒนาตัวเองในระดับ ม.ปลาย (ข้อ 28):</span>
                    <span className="font-semibold text-slate-800">{assessment.futureGoals?.selfImprovement || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">สิ่งที่อยากให้ครู/โรงเรียนช่วยเหลือ (ข้อ 29):</span>
                    <span className="font-semibold text-slate-800">{assessment.futureGoals?.supportNeeded || '-'}</span>
                  </div>
                  {isAdvisorOrAdmin && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-amber-700 font-semibold block">สิ่งที่อยากบอกครูเพิ่มเติม (ข้อ 30 - ข้อมูลลับ):</span>
                      <span className="text-slate-800 italic">{assessment.futureGoals?.privateMessageToTeacher || 'ไม่มี'}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white p-4 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-all shadow-sm"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
