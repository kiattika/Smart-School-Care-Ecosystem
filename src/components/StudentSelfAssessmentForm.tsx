import React, { useState } from 'react';
import { 
  User, 
  BookOpen, 
  Compass, 
  Sparkles, 
  ShieldCheck, 
  Target, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Save, 
  AlertCircle,
  HelpCircle,
  Brain,
  Smartphone,
  Bus,
  Users
} from 'lucide-react';
import { StudentSelfAssessment, Student } from '../types';

interface Props {
  student: Student;
  existingAssessment?: StudentSelfAssessment;
  onSave: (assessment: StudentSelfAssessment) => Promise<void>;
  onClose?: () => void;
}

export const StudentSelfAssessmentForm: React.FC<Props> = ({
  student,
  existingAssessment,
  onSave,
  onClose
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  // Form State initialized with existing assessment or sensible defaults for current student
  const [formData, setFormData] = useState<StudentSelfAssessment>(() => {
    if (existingAssessment) {
      return existingAssessment;
    }
    return {
      studentId: student.studentId || '38502',
      studentName: student.name || 'นักเรียน',
      isCompleted: false,
      basicInfo: {
        titleFullName: student.name || '',
        nickname: student.nickname || '',
        gradeRoom: student.className || student.room || 'ม.5/8',
        studentNo: String(student.studentNo || '1'),
        contactChannels: ['LINE ID / Instagram / Facebook'],
        contactDetail: ''
      },
      familyBackground: {
        livingWith: 'บิดาและมารดา',
        transportation: 'รถจักรยานยนต์',
        travelTime: '15-30 นาที',
        responsibilities: ['งานบ้าน'],
        consultPerson: 'ผู้ปกครอง'
      },
      identity: {
        threeWords: '',
        hobbies: ['ฟังเพลง'],
        specialSkills: '',
        groupRole: 'ค้นหาข้อมูลวิเคราะห์'
      },
      learningStyle: {
        preferredStyles: ['ลงมือปฏิบัติจริง'],
        learningObstacles: [],
        primaryDevices: ['สมาร์ตโฟน'],
        aiExperience: 'ใช้อยู่ประจำ',
        teacherStyle: ''
      },
      socialAndSafety: {
        topSocialMedia: ['TikTok', 'Instagram'],
        schoolBullyingExperience: 'ไม่เคย',
        cyberbullyingExperience: 'ไม่เคย',
        schoolSafetyScore: 5,
        socialComparisonStress: 'ไม่เคยเลย',
        messageToTeacherSafety: ''
      },
      futureGoals: {
        careerGoals: '',
        selfImprovement: '',
        supportNeeded: '',
        privateMessageToTeacher: ''
      }
    };
  });

  const steps = [
    { id: 1, title: 'ข้อมูลพื้นฐาน', subtitle: 'ข้อ 1 - 6', icon: User },
    { id: 2, title: 'ภูมิหลัง & ครอบครัว', subtitle: 'ข้อ 7 - 11', icon: Bus },
    { id: 3, title: 'ตัวตน & ความสนใจ', subtitle: 'ข้อ 12 - 15', icon: Compass },
    { id: 4, title: 'สไตล์การเรียน & AI', subtitle: 'ข้อ 16 - 20', icon: Brain },
    { id: 5, title: 'ความปลอดภัย & โซเชียล', subtitle: 'ข้อ 21 - 26', icon: ShieldCheck },
    { id: 6, title: 'เป้าหมาย & ฝากถึงครู', subtitle: 'ข้อ 27 - 30', icon: Target },
  ];

  const handleCheckboxToggle = (
    section: 'basicInfo' | 'familyBackground' | 'identity' | 'learningStyle' | 'socialAndSafety',
    field: string,
    value: string,
    maxLimit?: number
  ) => {
    setFormData(prev => {
      const currentList: string[] = (prev[section] as any)[field] || [];
      let nextList: string[];
      if (currentList.includes(value)) {
        nextList = currentList.filter(item => item !== value);
      } else {
        if (maxLimit && currentList.length >= maxLimit) {
          nextList = [...currentList.slice(1), value];
        } else {
          nextList = [...currentList, value];
        }
      }
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: nextList
        }
      };
    });
  };

  const handleSingleFieldChange = (
    section: keyof StudentSelfAssessment,
    field: string,
    value: any
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [field]: value
      }
    }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    try {
      const assessmentToSave: StudentSelfAssessment = {
        ...formData,
        studentId: student.studentId,
        studentName: student.name,
        isCompleted: true,
        submittedAt: formData.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await onSave(assessmentToSave);
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper options
  const contactOptions = ['เบอร์โทรศัพท์ส่วนตัว', 'LINE ID / Instagram / Facebook', 'อีเมล', 'Discord'];
  const livingWithOptions = ['บิดาและมารดา', 'บิดา หรือ มารดา (ฝ่ายใดฝ่ายหนึ่ง)', 'ปู่ ย่า ตา ยาย หรือญาติผู้ใหญ่', 'หอพัก / อยู่คนเดียว', 'อื่นๆ'];
  const transportationOptions = ['ผู้ปกครองรับ-ส่ง', 'รถประจำทาง / รถสองแถว', 'รถจักรยานยนต์', 'รถสาธารณะ / รถโรงเรียน', 'เดิน/ขี่จักรยาน', 'ขับรถยนต์มาเอง'];
  const travelTimeOptions = ['น้อยกว่า 15 นาที', '15-30 นาที', '31-60 นาที', 'มากกว่า 1 ชั่วโมง'];
  const responsibilitiesOptions = ['งานบ้าน', 'ดูแลน้อง/ผู้สูงอายุ', 'ช่วยธุรกิจครอบครัว', 'ทำงานพิเศษหารายได้เสริม', 'ไม่มีภาระพิเศษ'];
  const consultOptions = ['ผู้ปกครอง', 'เพื่อนสนิทใน-นอกโรงเรียน', 'คุณครู', 'เก็บไว้คนเดียว/จัดการเอง', 'อื่นๆ'];
  const groupRoles = [
    { title: 'ผู้นำกลุ่ม', desc: 'วางแผน แจกแจงงาน และควบคุมเวลา' },
    { title: 'ค้นหาข้อมูลวิเคราะห์', desc: 'รวบรวมเนื้อหา ตรวจสอบความถูกต้อง' },
    { title: 'ออกแบบสไลด์/กราฟิก', desc: 'จัดทำรูปเล่ม ชิ้นงาน สื่อนำเสนอ' },
    { title: 'ผู้นำเสนอ', desc: 'พูดสรุปประเด็น สื่อสารหน้าชั้นเรียน' },
    { title: 'ผู้สนับสนุนคอยทำตามที่ได้รับมอบหมาย', desc: 'ช่วยเหลืองานรอบด้านให้เสร็จสมบูรณ์' }
  ];
  const learningStyleOptions = [
    { label: 'ฟังบรรยายกระชับ', desc: 'เข้าใจดีเมื่อครูสรุปใจความสำคัญ' },
    { label: 'ดูคลิป วิดีโอ ภาพ', desc: 'จำได้ดีด้วยภาพ แผนภูมิ หรือมัลติมีเดีย' },
    { label: 'ลงมือปฏิบัติจริง', desc: 'ทดลอง ทำแบบฝึกหัด หรือเวิร์กช็อป' },
    { label: 'อ่านเอง', desc: 'ชอบอ่านทำความเข้าใจในที่เงียบๆ ด้วยตนเอง' },
    { label: 'อภิปรายกลุ่ม', desc: 'แลกเปลี่ยนความคิดเห็นกับเพื่อนและครู' }
  ];
  const obstacleOptions = ['สมาธิสั้น', 'การบ้านเยอะ', 'ตามเนื้อหาไม่ทัน', 'ไม่กล้าถาม', 'เสียงดังรบกวน', 'อุปกรณ์ไม่พร้อมบางช่วง'];
  const deviceOptions = ['สมาร์ตโฟน', 'แท็บเล็ต iPad', 'โน้ตบุ๊ก / PC', 'ไม่มีอุปกรณ์ส่วนตัว ต้องยืม/ใช้ที่โรงเรียน'];
  const aiOptions = [
    { label: 'ใช้อยู่ประจำ', desc: 'ใช้สรุปบทเรียน หาไอเดีย เขียนโค้ด หรือช่วยตรวจทานงาน' },
    { label: 'เคยลองบ้าง', desc: 'ลองใช้งานทั่วไปเป็นบางครั้ง' },
    { label: 'ไม่เคยใช้เลย', desc: 'ยังไม่เคยใช้ หรือไม่แน่ใจวิธีใช้' },
    { label: 'โรงเรียน/ครูไม่ควรให้ใช้', desc: 'มองว่าควรเน้นทำด้วยตนเองทั้งหมด' }
  ];
  const socialMediaOptions = ['TikTok', 'Instagram', 'Facebook', 'X (Twitter)', 'YouTube', 'Discord', 'Threads'];
  const bullyingOptions = ['ไม่เคย', 'เคยเห็นเพื่อนโดน', 'เคยโดนด้วยตนเอง', 'ไม่อยากตอบ'];
  const stressOptions = ['ไม่เคยเลย', 'เป็นบางครั้ง', 'บ่อยครั้ง', 'รู้สึกกดดันมาก'];

  return (
    <div id="student-self-assessment-form-container" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 text-white p-6 relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold text-sky-100 tracking-wide">
                Smart Care Ecosystem
              </span>
              <span className="text-xs text-sky-200">ระบบวิเคราะห์และรู้จักผู้เรียนรายบุคคล</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
              ภารกิจประเมินและวิเคราะห์ตนเองของนักเรียน
            </h2>
            <p className="text-sm text-sky-100 mt-1 max-w-2xl">
              แบบสำรวจ 6 ด้าน (30 ข้อ) เพื่อให้คุณครูประจำวิชา ครูที่ปรึกษา และผู้ปกครองเข้าใจสไตล์การเรียนรู้ จุดแข็ง และความต้องการของนักเรียนได้อย่างตรงจุด
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20">
            <div className="w-10 h-10 rounded-full bg-white text-blue-800 font-bold flex items-center justify-center text-base shadow-sm">
              {student.name?.slice(0, 1) || 'น'}
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">{student.name}</div>
              <div className="text-xs text-sky-200">รหัสนักเรียน: {student.studentId} | {student.className || student.room || 'ม.5/8'}</div>
            </div>
          </div>
        </div>

        {/* Step Tabs */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = currentStep === s.id;
            const isDone = currentStep > s.id || (formData.isCompleted && currentStep !== s.id);
            return (
              <button
                key={s.id}
                type="button"
                id={`assessment-step-tab-${s.id}`}
                onClick={() => setCurrentStep(s.id)}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-left transition-all text-xs font-medium ${
                  isActive
                    ? 'bg-white text-blue-900 shadow-md font-semibold ring-2 ring-white/50'
                    : isDone
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-white/10 text-sky-200 hover:bg-white/15'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-blue-600 text-white' : isDone ? 'bg-emerald-400 text-slate-900' : 'bg-white/20 text-white'
                }`}>
                  {isDone && !isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <div className="truncate">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="text-[10px] opacity-80">{s.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Content Area */}
      <div className="p-6 md:p-8">
        {/* Toast Notification */}
        {showSuccessToast && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-sm font-medium animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>บันทึกข้อมูลแบบประเมินตนเองเรียบร้อยแล้ว ครูประจำวิชาและครูที่ปรึกษาได้รับข้อมูลแล้วครับ!</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* SECTION 1: Basic Info */}
          {currentStep === 1 && (
            <div id="section-1-basic-info" className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-lg">
                  <User className="w-5 h-5" />
                  <span>ส่วนที่ 1: ข้อมูลพื้นฐานและการติดต่อ (ข้อ 1 - 6)</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">ข้อมูลทั่วไปเพื่อให้ครูและระบบสื่อสารกับนักเรียนได้อย่างถูกต้องและรวดเร็ว</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ข้อ 1: คำนำหน้านาม ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="input-title-full-name"
                    value={formData.basicInfo.titleFullName}
                    onChange={(e) => handleSingleFieldChange('basicInfo', 'titleFullName', e.target.value)}
                    placeholder="เช่น นายสมชาย ใจดี"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ข้อ 2: ชื่อเล่นที่อยากให้คุณครูและเพื่อนๆ เรียก <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="input-nickname"
                    value={formData.basicInfo.nickname}
                    onChange={(e) => handleSingleFieldChange('basicInfo', 'nickname', e.target.value)}
                    placeholder="เช่น ชาย, กิต, นิว"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ข้อ 3: ระดับชั้น / ห้องเรียน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="input-grade-room"
                    value={formData.basicInfo.gradeRoom}
                    onChange={(e) => handleSingleFieldChange('basicInfo', 'gradeRoom', e.target.value)}
                    placeholder="เช่น ม.5/8"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ข้อ 4: เลขที่ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="input-student-no"
                    value={formData.basicInfo.studentNo}
                    onChange={(e) => handleSingleFieldChange('basicInfo', 'studentNo', e.target.value)}
                    placeholder="เช่น 1"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 5: ช่องทางการติดต่อที่สะดวกที่สุด (เลือกได้มากกว่า 1 ข้อ)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {contactOptions.map(opt => {
                    const isChecked = formData.basicInfo.contactChannels.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        id={`btn-contact-${opt}`}
                        onClick={() => handleCheckboxToggle('basicInfo', 'contactChannels', opt)}
                        className={`p-3 rounded-xl border text-xs text-left transition-all flex items-center justify-between ${
                          isChecked
                            ? 'border-blue-600 bg-blue-50/80 text-blue-900 font-semibold'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span>{opt}</span>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                          isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {isChecked && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ข้อ 6: ระบุเบอร์โทร / LINE ID / Instagram หรือช่องทางข้างต้นที่ครูสามารถติดต่อได้ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="input-contact-detail"
                  value={formData.basicInfo.contactDetail}
                  onChange={(e) => handleSingleFieldChange('basicInfo', 'contactDetail', e.target.value)}
                  placeholder="เช่น LINE: somchai_id, โทร: 089-xxx-xxxx"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* SECTION 2: Background & Context */}
          {currentStep === 2 && (
            <div id="section-2-family-background" className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-indigo-700 font-bold text-lg">
                  <Bus className="w-5 h-5" />
                  <span>ส่วนที่ 2: ภูมิหลัง บริบทครอบครัว และการเดินทาง (ข้อ 7 - 11)</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">เพื่อให้คุณครูเข้าใจบริบทการใช้ชีวิต การเดินทาง และการจัดสรรเวลาของนักเรียน</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 7: ปัจจุบันนักเรียนพักอาศัยอยู่กับใคร
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {livingWithOptions.map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => handleSingleFieldChange('familyBackground', 'livingWith', opt)}
                      className={`p-3 rounded-xl border text-xs text-left transition-all ${
                        formData.familyBackground.livingWith === opt
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold ring-1 ring-indigo-500'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    ข้อ 8: การเดินทางมาโรงเรียนส่วนใหญ่ใช้พาหนะใด
                  </label>
                  <select
                    value={formData.familyBackground.transportation}
                    onChange={(e) => handleSingleFieldChange('familyBackground', 'transportation', e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {transportationOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    ข้อ 9: ระยะเวลาที่ใช้ในการเดินทางมาโรงเรียน (เฉลี่ย)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {travelTimeOptions.map(opt => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => handleSingleFieldChange('familyBackground', 'travelTime', opt)}
                        className={`p-2.5 rounded-xl border text-xs text-center transition-all ${
                          formData.familyBackground.travelTime === opt
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 10: ภาระงานนอกเหนือจากการเรียนที่ต้องรับผิดชอบประจำ (เลือกได้มากกว่า 1 ข้อ)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {responsibilitiesOptions.map(opt => {
                    const isChecked = formData.familyBackground.responsibilities.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => handleCheckboxToggle('familyBackground', 'responsibilities', opt)}
                        className={`p-3 rounded-xl border text-xs text-left transition-all flex items-center justify-between ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span>{opt}</span>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                          isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                        }`}>
                          {isChecked && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 11: เมื่อมีเรื่องสบายใจ หรือไม่สบายใจ นักเรียนปรึกษาใครบ่อยที่สุด
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {consultOptions.map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => handleSingleFieldChange('familyBackground', 'consultPerson', opt)}
                      className={`p-3 rounded-xl border text-xs text-left transition-all ${
                        formData.familyBackground.consultPerson === opt
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold ring-1 ring-indigo-500'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: Identity & Interests */}
          {currentStep === 3 && (
            <div id="section-3-identity" className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-sky-700 font-bold text-lg">
                  <Compass className="w-5 h-5" />
                  <span>ส่วนที่ 3: ตัวตน นิสัย และความสนใจ (ข้อ 12 - 15)</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">สะท้อนจุดเด่น เอกลักษณ์เฉพาะตัว และบทบาทที่ถนัดเมื่อต้องทำงานร่วมกับผู้อื่น</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ข้อ 12: เลือก 3 คำที่อธิบายความเป็นตัวตนของนักเรียนได้ดีที่สุด
                </label>
                <input
                  type="text"
                  value={formData.identity.threeWords}
                  onChange={(e) => handleSingleFieldChange('identity', 'threeWords', e.target.value)}
                  placeholder="เช่น ร่าเริง, ช่างคิด, ชอบทดลอง หรือ ลุยๆ, จริงใจ, มีวินัย"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 13: งานอดิเรก หรือกิจกรรมที่ชอบทำมากที่สุดยามว่าง (เลือกได้มากกว่า 1 ข้อ)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {['เล่นเกม', 'ฟังเพลง', 'ดูหนัง ซีรีส์', 'เล่นกีฬา', 'อ่านหนังสือ', 'งานศิลปะ', 'ทำอาหาร', 'เขียนโค้ดคอมพิวเตอร์', 'ถ่ายรูป/ตัดต่อวิดีโอ'].map(opt => {
                    const isChecked = formData.identity.hobbies.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => handleCheckboxToggle('identity', 'hobbies', opt)}
                        className={`p-2.5 rounded-xl border text-xs text-left transition-all flex items-center justify-between ${
                          isChecked
                            ? 'border-sky-600 bg-sky-50 text-sky-900 font-semibold'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span>{opt}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ข้อ 14: ทักษะ ความสามารถพิเศษ หรือจุดแข็งที่นักเรียนภาคภูมิใจ
                </label>
                <textarea
                  rows={2}
                  value={formData.identity.specialSkills}
                  onChange={(e) => handleSingleFieldChange('identity', 'specialSkills', e.target.value)}
                  placeholder="เช่น วาดรูปดิจิทัล, ตัดต่อคลิป, เล่นดนตรีไทย, กีฬาบาสเกตบอล, การคำนวณเร็ว"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 15: เมื่อต้องทำงานกลุ่ม นักเรียนถนัดทำหน้าที่ใดมากที่สุด
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {groupRoles.map(role => {
                    const isSelected = formData.identity.groupRole === role.title;
                    return (
                      <button
                        type="button"
                        key={role.title}
                        onClick={() => handleSingleFieldChange('identity', 'groupRole', role.title)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-sky-600 bg-sky-50/80 text-sky-900 ring-2 ring-sky-500'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                          <span>{role.title}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-sky-600" />}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">{role.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: Learning Style & AI */}
          {currentStep === 4 && (
            <div id="section-4-learning-style" className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-purple-700 font-bold text-lg">
                  <Brain className="w-5 h-5" />
                  <span>ส่วนที่ 4: สไตล์การเรียนรู้และทักษะยุคใหม่ (ข้อ 16 - 20)</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">ช่วยให้ครูประจำวิชาออกแบบกิจกรรมการสอน และการบ้านให้ตรงกับจริตของผู้เรียน</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 16: รูปแบบการเรียนรู้ที่ทำให้นักเรียนเข้าใจเนื้อหาได้ดีที่สุด (เลือกได้สูงสุด 2 ข้อ)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {learningStyleOptions.map(opt => {
                    const isChecked = formData.learningStyle.preferredStyles.includes(opt.label);
                    return (
                      <button
                        type="button"
                        key={opt.label}
                        onClick={() => handleCheckboxToggle('learningStyle', 'preferredStyles', opt.label, 2)}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          isChecked
                            ? 'border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-500'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                          <span>{opt.label}</span>
                          {isChecked && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 17: สิ่งที่เป็นอุปสรรคหรือข้อจำกัดต่อการเรียนรู้ของนักเรียน
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {obstacleOptions.map(opt => {
                    const isChecked = formData.learningStyle.learningObstacles.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => handleCheckboxToggle('learningStyle', 'learningObstacles', opt)}
                        className={`p-2.5 rounded-xl border text-xs text-left transition-all flex items-center justify-between ${
                          isChecked
                            ? 'border-purple-600 bg-purple-50 text-purple-900 font-semibold'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span>{opt}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    ข้อ 18: อุปกรณ์หลักที่ใช้นอกเวลาเรียนเพื่อค้นคว้า/ทำรายงาน
                  </label>
                  <div className="space-y-2">
                    {deviceOptions.map(opt => {
                      const isChecked = formData.learningStyle.primaryDevices.includes(opt);
                      return (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => handleCheckboxToggle('learningStyle', 'primaryDevices', opt)}
                          className={`w-full p-2.5 rounded-xl border text-xs text-left transition-all flex items-center justify-between ${
                            isChecked
                              ? 'border-purple-600 bg-purple-50 text-purple-900 font-semibold'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <span>{opt}</span>
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    ข้อ 19: ประสบการณ์การใช้เครื่องมือ AI (เช่น ChatGPT, Gemini) ช่วยเรียน
                  </label>
                  <div className="space-y-2">
                    {aiOptions.map(opt => {
                      const isSelected = formData.learningStyle.aiExperience === opt.label;
                      return (
                        <button
                          type="button"
                          key={opt.label}
                          onClick={() => handleSingleFieldChange('learningStyle', 'aiExperience', opt.label)}
                          className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-500'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                          <div className="text-[11px] text-slate-500">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ข้อ 20: สไตล์หรือบุคลิกของครูผู้สอนที่ทำให้นักเรียนเรียนได้อย่างมีความสุข
                </label>
                <textarea
                  rows={2}
                  value={formData.learningStyle.teacherStyle}
                  onChange={(e) => handleSingleFieldChange('learningStyle', 'teacherStyle', e.target.value)}
                  placeholder="เช่น ครูที่ใจดี เปิดโอกาสให้ถาม ไม่ดุ มีกิจกรรมให้เล่น และเข้าใจภาระการบ้าน"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* SECTION 5: Safety & Social Media */}
          {currentStep === 5 && (
            <div id="section-5-safety" className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-lg">
                    <ShieldCheck className="w-5 h-5" />
                    <span>ส่วนที่ 5: ความสัมพันธ์ โซเชียลมีเดีย และความปลอดภัย (ข้อ 21 - 26)</span>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[11px] font-semibold rounded-lg border border-amber-200 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    ข้อมูลได้รับการคุ้มครองความเป็นส่วนตัว
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">ข้อมูลส่วนนี้จะถูกใช้เพื่อดูแลความปลอดภัย ป้องกันการบูลลี่ และดูแลสุขภาวะทางใจของนักเรียน</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 21: โซเชียลมีเดียที่นักเรียนใช้บ่อยที่สุด 2 อันดับแรก
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {socialMediaOptions.map(opt => {
                    const isChecked = formData.socialAndSafety.topSocialMedia.includes(opt);
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => handleCheckboxToggle('socialAndSafety', 'topSocialMedia', opt, 2)}
                        className={`p-2.5 rounded-xl border text-xs text-left transition-all flex items-center justify-between ${
                          isChecked
                            ? 'border-rose-600 bg-rose-50 text-rose-900 font-semibold'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span>{opt}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    ข้อ 22: ประสบการณ์พบเห็นหรือโดนบูลลี่/ล้อเลียนในโรงเรียน
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {bullyingOptions.map(opt => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => handleSingleFieldChange('socialAndSafety', 'schoolBullyingExperience', opt)}
                        className={`p-2.5 rounded-xl border text-xs text-center transition-all ${
                          formData.socialAndSafety.schoolBullyingExperience === opt
                            ? 'border-rose-600 bg-rose-50 text-rose-900 font-semibold'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    ข้อ 23: ประสบการณ์ Cyberbullying บนโลกออนไลน์
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {bullyingOptions.map(opt => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => handleSingleFieldChange('socialAndSafety', 'cyberbullyingExperience', opt)}
                        className={`p-2.5 rounded-xl border text-xs text-center transition-all ${
                          formData.socialAndSafety.cyberbullyingExperience === opt
                            ? 'border-rose-600 bg-rose-50 text-rose-900 font-semibold'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">
                    ข้อ 24: ระดับความรู้สึกปลอดภัยและสบายใจเมื่ออยู่ที่โรงเรียน (1-5)
                  </label>
                  <span className="text-sm font-bold text-rose-600 px-3 py-1 bg-rose-50 rounded-lg">
                    {formData.socialAndSafety.schoolSafetyScore} / 5 คะแนน
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">1 (ไม่ปลอดภัย)</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={formData.socialAndSafety.schoolSafetyScore}
                    onChange={(e) => handleSingleFieldChange('socialAndSafety', 'schoolSafetyScore', Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                  />
                  <span className="text-xs text-slate-500">5 (ปลอดภัยมากที่สุด)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  ข้อ 25: เคยรู้สึกเครียดหรือไม่มั่นใจจากการเปรียบเทียบตัวเองกับคนอื่นบนโซเชียลไหม
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {stressOptions.map(opt => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => handleSingleFieldChange('socialAndSafety', 'socialComparisonStress', opt)}
                      className={`p-2.5 rounded-xl border text-xs text-center transition-all ${
                        formData.socialAndSafety.socialComparisonStress === opt
                          ? 'border-rose-600 bg-rose-50 text-rose-900 font-semibold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ข้อ 26: พื้นที่ฝากบอกครู: มีเรื่องการแกล้งกัน ปัญหาความปลอดภัย หรือในโลกออนไลน์ที่อยากให้ครูช่วยสอดส่องไหม
                </label>
                <textarea
                  rows={2}
                  value={formData.socialAndSafety.messageToTeacherSafety}
                  onChange={(e) => handleSingleFieldChange('socialAndSafety', 'messageToTeacherSafety', e.target.value)}
                  placeholder="เขียนบอกคุณครูได้เลยครับ ข้อมูลนี้เป็นความลับเฉพาะครูที่ปรึกษา"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          )}

          {/* SECTION 6: Future Goals & Expectations */}
          {currentStep === 6 && (
            <div id="section-6-goals" className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-lg">
                  <Target className="w-5 h-5" />
                  <span>ส่วนที่ 6: เป้าหมาย อนาคต และข้อความถึงครู (ข้อ 27 - 30)</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">ความฝันและเป้าหมายในอนาคต เพื่อให้โรงเรียนช่วยเตรียมความพร้อมและแนะแนวการศึกษาได้อย่างตรงทาง</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ข้อ 27: เป้าหมายการศึกษาต่อ (คณะ/มหาวิทยาลัย) หรือสายอาชีพในอนาคตที่สนใจ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.futureGoals.careerGoals}
                  onChange={(e) => handleSingleFieldChange('futureGoals', 'careerGoals', e.target.value)}
                  placeholder="เช่น คณะวิศวกรรมคอมพิวเตอร์, คณะแพทย์, บริหารธุรกิจ, นิเทศศาสตร์, ศิลปินดิจิทัล ฯลฯ"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ข้อ 28: สิ่งสำคัญที่สุดที่นักเรียนอยากพัฒนาตัวเองให้ดีขึ้นในระดับ ม.ปลาย
                </label>
                <textarea
                  rows={2}
                  value={formData.futureGoals.selfImprovement}
                  onChange={(e) => handleSingleFieldChange('futureGoals', 'selfImprovement', e.target.value)}
                  placeholder="เช่น การจัดสรรเวลาอ่านหนังสือ, ภาษาอังกฤษ, ความกล้าแสดงออก, การจัดการความเครียด"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ข้อ 29: สิ่งที่อยากให้คุณครูหรือทางโรงเรียนช่วยเหลือ/สนับสนุนมากที่สุด
                </label>
                <textarea
                  rows={2}
                  value={formData.futureGoals.supportNeeded}
                  onChange={(e) => handleSingleFieldChange('futureGoals', 'supportNeeded', e.target.value)}
                  placeholder="เช่น การจัดกิจกรรมติวสอบเข้า, การแนะแนว Portfolio, คำปรึกษาเรื่องทุนการศึกษา"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
                <label className="block text-xs font-semibold text-amber-900 mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  ข้อ 30: สิ่งที่อยากบอกคุณครูเพิ่มเติม (ข้อมูลลับส่วนตัว / ข้อกังวลใจ)
                </label>
                <textarea
                  rows={3}
                  value={formData.futureGoals.privateMessageToTeacher}
                  onChange={(e) => handleSingleFieldChange('futureGoals', 'privateMessageToTeacher', e.target.value)}
                  placeholder="พื้นที่สำหรับบอกเล่าเรื่องราวส่วนตัว ปัญหาทางบ้าน หรือสิ่งที่อยากให้ครูรับทราบเฉพาะบุคคล..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>
            </div>
          )}

          {/* Navigation and Actions */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {currentStep > 1 && (
                <button
                  type="button"
                  id="btn-prev-step"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>ย้อนกลับ</span>
                </button>
              )}
              {currentStep < 6 && (
                <button
                  type="button"
                  id="btn-next-step"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm w-full sm:w-auto"
                >
                  <span>ขั้นตอนถัดไป</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                id="btn-save-draft"
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto"
              >
                <Save className="w-4 h-4 text-slate-500" />
                <span>บันทึกแบบร่าง</span>
              </button>

              <button
                type="submit"
                id="btn-submit-self-assessment"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg w-full sm:w-auto disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>ส่งแบบประเมินตนเอง (30 ข้อ)</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
