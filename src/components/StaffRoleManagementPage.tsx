import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ShieldCheck, 
  UserCheck, 
  Edit2, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  Save, 
  Info, 
  Sparkles, 
  BookOpen, 
  GraduationCap, 
  Award, 
  HelpCircle,
  Users,
  ChevronDown,
  Eye,
  CheckSquare,
  Square,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { BulkDataImportModal, ImportType } from './BulkDataImportModal';

// พจนานุกรมชื่อภาษาไทยของบทบาท
export const ROLE_NAMES_TH: Record<UserRole, string> = {
  SUPER_ADMIN: 'ผู้ดูแลระบบ (Admin)',
  EXECUTIVE: 'ผู้บริหารโรงเรียน',
  HEAD_OF_DEPARTMENT: 'หัวหน้ากลุ่มสาระการเรียนรู้',
  ACADEMIC_HEAD: 'หัวหน้าฝ่ายวิชาการและหลักสูตร',
  DEPUTY_DIRECTOR_ACADEMIC: 'รองผู้อำนวยการฝ่ายวิชาการ',
  DIRECTOR: 'ผู้อำนวยการโรงเรียน',
  HOMEROOM_TEACHER: 'ครูประจำชั้น',
  SUBJECT_TEACHER: 'ครูผู้สอน / ครูประจำวิชา',
  SUPERVISORY_TEACHER: 'ครูนิเทศ (Supervisory)',
  INFIRMARY_STAFF: 'ครูพยาบาล / ห้องพยาบาล',
  GUIDANCE_COUNSELOR: 'ครูแนะแนว / ให้คำปรึกษา',
  FINANCE_STAFF: 'เจ้าหน้าที่การเงินและบัญชี',
  INSTRUCTIONAL_SUPERVISOR: 'ครูผู้นิเทศ / ฝ่ายวิชาการ',
  PARENT: 'ผู้ปกครองนักเรียน',
  STUDENT: 'นักเรียน',
};

// สีกำกับแต่ละบทบาทสำหรับ Badge
export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  EXECUTIVE: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  HEAD_OF_DEPARTMENT: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  ACADEMIC_HEAD: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  DEPUTY_DIRECTOR_ACADEMIC: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  DIRECTOR: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
  HOMEROOM_TEACHER: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  SUBJECT_TEACHER: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  SUPERVISORY_TEACHER: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  INFIRMARY_STAFF: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  GUIDANCE_COUNSELOR: { bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-400', border: 'border-fuchsia-500/20' },
  FINANCE_STAFF: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' },
  INSTRUCTIONAL_SUPERVISOR: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  PARENT: { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' },
  STUDENT: { bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20' },
};

// กลุ่มสาระการเรียนรู้
export const DEPARTMENTS = [
  { id: 'sci-dept', name: 'กลุ่มสาระฯ วิทยาศาสตร์และเทคโนโลยี' },
  { id: 'math-dept', name: 'กลุ่มสาระฯ คณิตศาสตร์' },
  { id: 'thai-dept', name: 'กลุ่มสาระฯ ภาษาไทย' },
  { id: 'art-dept', name: 'กลุ่มสาระฯ ศิลปะ' },
  { id: 'foreign-dept', name: 'กลุ่มสาระฯ ภาษาต่างประเทศ' },
  { id: 'soc-dept', name: 'กลุ่มสาระฯ สังคมศึกษา ศาสนา และวัฒนธรรม' },
  { id: 'health-dept', name: 'กลุ่มสาระฯ สุขศึกษาและพลศึกษา' },
  { id: 'career-dept', name: 'กลุ่มสาระฯ การงานอาชีพ' },
  { id: 'administration', name: 'ฝ่ายบริหารงานบุคคล' },
];

const ROOM_OPTIONS = [
  'ม.1/1', 'ม.1/2', 'ม.2/3', 'ม.4/1', 'ม.4/2', 'ม.5/1', 'ม.5/2', 'ม.5/8', 'ม.5/9', 'ม.5/11'
];

export function StaffRoleManagementPage() {
  // ดึงข้อมูลบุคลากรจริงจาก Firestore 'staff' collection แบบ Real-time
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, 'staff'),
      (snapshot) => {
        const docs: UserProfile[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          const roles = Array.isArray(data.roles) && data.roles.length > 0
            ? (data.roles as UserRole[])
            : ['SUBJECT_TEACHER' as UserRole];

          return {
            id: docSnap.id,
            email: data.email || '',
            prefix: data.prefix || '',
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            position: data.position || 'ครูผู้สอน',
            roles: roles,
            assignments: data.assignments || {
              departmentId: data.departmentId || '',
              homeroomClass: data.homeroomClass || '',
              teachingSubjects: data.teachingSubjects || [],
              supervisoryMentees: data.supervisoryMentees || []
            }
          } as UserProfile;
        });

        // เรียงลำดับตามชื่อหรืออีเมล
        docs.sort((a, b) => (a.firstName || a.email).localeCompare(b.firstName || b.email, 'th'));
        setStaffList(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error('Error fetching staff from Firestore:', err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // State การค้นหาและกรอง
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedRole, setSelectedRole] = useState('ALL');

  // State ของ Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);

  // Form States ภายใน Modal (สร้างแบบผูกมัด)
  const [formPrefix, setFormPrefix] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formPosition, setFormPosition] = useState('');
  const [formRoles, setFormRoles] = useState<UserRole[]>([]);
  const [formDept, setFormDept] = useState('');
  const [formHomeroom, setFormHomeroom] = useState('');
  const [formSubjects, setFormSubjects] = useState<{ subjectCode: string; className: string }[]>([]);
  const [formMentees, setFormMentees] = useState<string[]>([]);

  // Temp Inputs สำหรับการเพิ่มวิชาใน Modal
  const [tempCode, setTempCode] = useState('');
  const [tempClass, setTempClass] = useState('');

  // Toast / SweetAlert states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSweetAlert, setShowSweetAlert] = useState<{
    show: boolean;
    title: string;
    text: string;
    type: 'success' | 'warning';
  } | null>(null);

  // Bulk Import state
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // กรองตารางรายชื่อบุคลากรตามเงื่อนไขค้นหา
  const filteredStaff = useMemo(() => {
    return staffList.filter(staff => {
      const fullName = `${staff.prefix}${staff.firstName} ${staff.lastName}`.toLowerCase();
      const matchesSearch = 
        fullName.includes(searchQuery.toLowerCase()) || 
        staff.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.id.toLowerCase().includes(searchQuery.toLowerCase());

      const deptId = staff.assignments?.departmentId || '';
      const matchesDept = selectedDept === 'ALL' || deptId === selectedDept;

      const matchesRole = selectedRole === 'ALL' || staff.roles.includes(selectedRole as UserRole);

      return matchesSearch && matchesDept && matchesRole;
    });
  }, [staffList, searchQuery, selectedDept, selectedRole]);

  // ฟังก์ชันแสดงการแจ้งเตือน
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const triggerSweetAlert = (title: string, text: string, type: 'success' | 'warning') => {
    setShowSweetAlert({ show: true, title, text, type });
  };

  // เมื่อกดปุ่ม "แก้ไขสิทธิ์"
  const handleEditClick = (staff: UserProfile) => {
    setEditingStaff(staff);
    setFormPrefix(staff.prefix);
    setFormFirstName(staff.firstName);
    setFormLastName(staff.lastName);
    setFormPosition(staff.position);
    setFormRoles([...staff.roles]);
    setFormDept(staff.assignments?.departmentId || '');
    setFormHomeroom(staff.assignments?.homeroomClass || '');
    setFormSubjects(staff.assignments?.teachingSubjects ? [...staff.assignments.teachingSubjects] : []);
    setFormMentees(staff.assignments?.supervisoryMentees ? [...staff.assignments.supervisoryMentees] : []);
    
    // เคลียร์ Temp Inputs
    setTempCode('');
    setTempClass('');
    
    setIsModalOpen(true);
  };

  // เปลี่ยนการเลือกติ๊กบทบาท (Toggle Multi-role Select Checkbox)
  const handleRoleToggle = (role: UserRole) => {
    if (formRoles.includes(role)) {
      setFormRoles(prev => prev.filter(r => r !== role));
    } else {
      setFormRoles(prev => [...prev, role]);
    }
  };

  // เพิ่มวิชาสอนในตารางผู้สอน
  const handleAddSubject = () => {
    if (!tempCode.trim() || !tempClass) {
      triggerToast('⚠️ กรุณากรอกรหัสวิชาและเลือกห้องเรียนเพื่อกดเพิ่ม');
      return;
    }
    const cleanCode = tempCode.trim().toUpperCase();
    
    // เช็กว่ามีวิชาและห้องนี้แอดไปหรือยัง
    if (formSubjects.some(s => s.subjectCode === cleanCode && s.className === tempClass)) {
      triggerToast('⚠️ มีข้อมูลวิชานี้และห้องเรียนนี้อยู่ในรายการแล้ว');
      return;
    }

    setFormSubjects(prev => [...prev, { subjectCode: cleanCode, className: tempClass }]);
    setTempCode('');
    setTempClass('');
    triggerToast('➕ เพิ่มวิชาสอนลงตารางชั่วคราวแล้ว');
  };

  // ลบวิชาสอนในรายการ
  const handleRemoveSubject = (index: number) => {
    setFormSubjects(prev => prev.filter((_, i) => i !== index));
    triggerToast('🗑️ ลบวิชาสอนออกจากรายการแล้ว');
  };

  // จัดการการเลือกติ๊กคุณครูรับการนิเทศ (Mentees)
  const handleMenteeToggle = (teacherId: string) => {
    if (formMentees.includes(teacherId)) {
      setFormMentees(prev => prev.filter(id => id !== teacherId));
    } else {
      setFormMentees(prev => [...prev, teacherId]);
    }
  };

  // บันทึกการเปลี่ยนแปลงจาก Modal ไปยัง Firestore
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    if (formRoles.length === 0) {
      triggerToast('⚠️ กรุณาเลือกอย่างน้อย 1 บทบาทให้แก่บุคลากร');
      return;
    }

    // ตรวจสอบความสมบูรณ์แบบมีเงื่อนไข (Conditional validation)
    if (formRoles.includes('HEAD_OF_DEPARTMENT') && !formDept) {
      triggerToast('⚠️ บทบาท "หัวหน้ากลุ่มสาระฯ" จำเป็นต้องระบุกลุ่มสาระฯ สังกัด');
      return;
    }
    if (formRoles.includes('HOMEROOM_TEACHER') && !formHomeroom) {
      triggerToast('⚠️ บทบาท "ครูประจำชั้น" จำเป็นต้องระบุห้องประจำชั้น');
      return;
    }
    if (formRoles.includes('SUBJECT_TEACHER') && formSubjects.length === 0) {
      triggerToast('⚠️ บทบาท "ครูผู้สอน" ควรมีรายละเอียดวิชาสอนอย่างน้อย 1 รายการ');
      return;
    }
    if (formRoles.includes('SUPERVISORY_TEACHER') && formMentees.length === 0) {
      triggerToast('⚠️ บทบาท "ครูนิเทศ" จำเป็นต้องเลือกครูผู้รับการนิเทศอย่างน้อย 1 คน');
      return;
    }

    // ประกอบร่าง Assignments Object ตามสิทธิ์ที่ระบุ
    const updatedAssignments: UserProfile['assignments'] = {};
    
    // กลุ่มสาระฯ (ดึงค่ามาถ้ามีบทบาทหัวหน้ากลุ่มสาระฯ หรือครูผู้สอน)
    if (formRoles.includes('HEAD_OF_DEPARTMENT')) {
      updatedAssignments.departmentId = formDept;
    } else if (formDept) {
      // หรือเก็บไว้ให้กลุ่มงานอื่น
      updatedAssignments.departmentId = formDept;
    }

    // ประจำชั้น
    if (formRoles.includes('HOMEROOM_TEACHER')) {
      updatedAssignments.homeroomClass = formHomeroom;
    }

    // วิชาที่สอน
    if (formRoles.includes('SUBJECT_TEACHER')) {
      updatedAssignments.teachingSubjects = formSubjects;
    }

    // ครูนิเทศ
    if (formRoles.includes('SUPERVISORY_TEACHER')) {
      updatedAssignments.supervisoryMentees = formMentees;
    }

    setIsSaving(true);
    try {
      const staffRef = doc(db, 'staff', editingStaff.id);
      const teacherRef = doc(db, 'teachers', editingStaff.id);

      const staffPayload = {
        prefix: formPrefix,
        firstName: formFirstName,
        lastName: formLastName,
        fullName: `${formPrefix}${formFirstName} ${formLastName}`.trim(),
        position: formPosition,
        roles: formRoles,
        assignments: updatedAssignments,
        departmentId: updatedAssignments.departmentId || '',
        homeroomClass: updatedAssignments.homeroomClass || '',
        updatedAt: serverTimestamp()
      };

      await setDoc(staffRef, staffPayload, { merge: true });
      await setDoc(teacherRef, staffPayload, { merge: true }).catch(() => {});

      setIsModalOpen(false);

      // แจ้งเตือนความสำเร็จในรูปแบบ SweetAlert
      triggerSweetAlert(
        'บันทึกสิทธิ์สำเร็จ!',
        `ระบบได้อัปเดตบทบาทหน้าที่และสิทธิ์การเข้าใช้งานของ ${formPrefix}${formFirstName} ${formLastName} ลงฐานข้อมูล Firestore เรียบร้อยแล้ว`,
        'success'
      );
    } catch (error) {
      console.error('Error saving staff roles to Firestore:', error);
      triggerToast(`❌ บันทึกข้อมูลไม่สำเร็จ: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#0a0f16] border border-white/5 rounded-2xl p-6 min-h-[600px] flex flex-col space-y-6 relative overflow-hidden text-slate-100">
      
      {/* Background Decorative Gradient Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Toast Notification Element */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900/90 border border-indigo-500/30 text-indigo-300 px-4 py-3 rounded-xl shadow-[0_4px_25px_rgba(99,102,241,0.25)] flex items-center gap-2 text-xs font-semibold backdrop-blur-md">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            {toastMessage}
          </div>
        </div>
      )}

      {/* SweetAlert Custom Modal Overlay */}
      {showSweetAlert?.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#151921] border border-emerald-500/30 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col items-center text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center shadow-inner">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white tracking-wide">{showSweetAlert.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{showSweetAlert.text}</p>
            </div>

            <button
              onClick={() => setShowSweetAlert(null)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md active:scale-[0.98] text-sm"
            >
              ตกลง (OK)
            </button>
          </div>
        </div>
      )}

      {/* Header and Title block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>สิทธิ์การควบคุมแบบทวิภาค (Role Configuration Engine)</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            จัดการสิทธิ์และบทบาทหน้าที่บุคลากร
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            กำหนดบทบาทแบบพหุสิทธิ์ (Multi-role) ให้ครูผู้สอนสลับระบบการทำงาน (Role Switcher Navbar) ได้ทันทีอย่างคล่องตัว
          </p>
        </div>

        {/* Action button and Info stats pill */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Bulk Import Button */}
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-[0_4px_15px_rgba(99,102,241,0.25)] active:scale-[0.98] cursor-pointer border border-white/10"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>นำเข้าข้อมูลชุดใหญ่ (Bulk Import)</span>
          </button>

          {/* Info stats pill */}
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-2.5 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400">บุคลากรทั้งหมด</div>
              <div className="text-sm font-bold text-white font-mono">{staffList.length} รายชื่อ</div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Search & Filter Bar */}
      <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center">
        {/* Search Input */}
        <div className="w-full md:flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ-นามสกุล, อีเมลบุคลากร หรือ ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>

        {/* Filter Department */}
        <div className="w-full md:w-64 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <span className="text-[10px] font-bold uppercase mr-1">สาระฯ:</span>
          </div>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-20 pr-4 py-2.5 text-xs text-slate-200 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="ALL">ทั้งหมด (ทุกสังกัด)</option>
            {DEPARTMENTS.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Filter Role */}
        <div className="w-full md:w-64 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-slate-400">
            <Award className="w-3.5 h-3.5 mr-1" />
            <span className="text-[10px] font-bold uppercase mr-1">บทบาท:</span>
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-20 pr-4 py-2.5 text-xs text-slate-200 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="ALL">ทั้งหมด (ทุกบทบาท)</option>
            {Object.entries(ROLE_NAMES_TH).map(([roleKey, roleName]) => (
              <option key={roleKey} value={roleKey}>{roleName}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* 2. Staff Data Table */}
      <div className="border border-white/5 rounded-2xl overflow-hidden bg-slate-950/20 flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-white/5 text-slate-400 text-xs font-semibold">
                <th className="px-6 py-4 font-mono">ID / Email</th>
                <th className="px-6 py-4">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4">ตำแหน่ง</th>
                <th className="px-6 py-4">สังกัดกลุ่มสาระฯ</th>
                <th className="px-6 py-4">บทบาททั้งหมด (Active Badges)</th>
                <th className="px-6 py-4 text-center">สิทธิ์เฉพาะกิจ (Assignments)</th>
                <th className="px-6 py-4 text-right">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      <p className="text-xs font-semibold text-slate-300">กำลังโหลดรายชื่อบุคลากรจากฐานข้อมูล Firestore...</p>
                    </div>
                  </td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-200">ยังไม่มีข้อมูลบุคลากรในฐานข้อมูล Firestore</p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        ท่านสามารถนำเข้าข้อมูลบัญชีรายชื่อครูและบุคลากรผ่านระบบนำเข้าข้อมูลชุดใหญ่ (Bulk Data Import) เพื่อเริ่มกำหนดบทบาทหน้าที่
                      </p>
                      <button
                        onClick={() => setIsBulkImportOpen(true)}
                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>นำเข้ารายชื่อครู/บุคลากร (Bulk Import)</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <HelpCircle className="w-8 h-8 text-slate-600" />
                      <p className="text-xs">ไม่พบข้อมูลผู้ใช้งานสอดคล้องกับตัวกรอง</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map(staff => {
                  const currentDeptName = DEPARTMENTS.find(d => d.id === staff.assignments?.departmentId)?.name || 'ไม่ได้ระบุสังกัด';
                  
                  return (
                    <tr key={staff.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 font-mono text-xs">
                        <span className="text-slate-500 text-[10px] block">ID: {staff.id}</span>
                        <span className="text-indigo-400 block max-w-[150px] truncate" title={staff.email}>{staff.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-100 group-hover:text-white transition-colors">
                          {staff.prefix}{staff.firstName} {staff.lastName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-400">{staff.position || 'ครูผู้สอน'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-300 truncate max-w-[180px] block" title={currentDeptName}>
                          {currentDeptName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {staff.roles.map(role => {
                            const badge = ROLE_COLORS[role];
                            return (
                              <span
                                key={role}
                                className={`text-[9px] font-bold px-2 py-0.5 rounded border ${badge?.bg} ${badge?.text} ${badge?.border}`}
                              >
                                {ROLE_NAMES_TH[role]}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-center">
                        <div className="inline-flex flex-col gap-1 text-left bg-slate-900/30 px-3 py-2 rounded-xl border border-white/5 min-w-[140px]">
                          {staff.roles.includes('HOMEROOM_TEACHER') && staff.assignments?.homeroomClass && (
                            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              ห้องประจำชั้น: {staff.assignments.homeroomClass}
                            </div>
                          )}
                          {staff.roles.includes('SUBJECT_TEACHER') && staff.assignments?.teachingSubjects && (
                            <div className="text-[10px] text-blue-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              วิชาสอน: {staff.assignments.teachingSubjects.length} รายการ
                            </div>
                          )}
                          {staff.roles.includes('SUPERVISORY_TEACHER') && staff.assignments?.supervisoryMentees && (
                            <div className="text-[10px] text-pink-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                              รับผิดชอบนิเทศ: {staff.assignments.supervisoryMentees.length} คน
                            </div>
                          )}
                          {!staff.assignments?.homeroomClass && 
                           !staff.assignments?.teachingSubjects && 
                           !staff.assignments?.supervisoryMentees && (
                            <span className="text-[10px] text-slate-500 italic block text-center w-full">ไม่มีข้อมูลการเชื่อมสิทธิ์</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEditClick(staff)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-indigo-600/20 hover:text-indigo-400 border border-slate-700/60 hover:border-indigo-500/30 text-slate-300 text-xs font-semibold rounded-lg transition-all active:scale-[0.97]"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>แก้ไขสิทธิ์</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Edit Role & Assignment Modal (หน้าต่างป๊อปอัพแก้ไขสิทธิ์) */}
      {isModalOpen && editingStaff && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-40 overflow-y-auto animate-fade-in">
          <div className="bg-[#11151d] border border-white/10 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-8 duration-300 text-slate-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 bg-[#0a0f16] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">Edit Staff Authorization</span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-400" />
                  ปรับเปลี่ยนหน้าที่และขอบเขตงานสอน: {editingStaff.prefix}{editingStaff.firstName} {editingStaff.lastName}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* บล็อก 1: ข้อมูลบุคลากรทั่วไป */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/30 p-4 border border-white/5 rounded-xl">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">คำนำหน้าชื่อ</label>
                  <input
                    type="text"
                    value={formPrefix}
                    onChange={(e) => setFormPrefix(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
                    placeholder="นาย / นางสาว"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ตำแหน่งบุคลากร</label>
                  <input
                    type="text"
                    value={formPosition}
                    onChange={(e) => setFormPosition(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
                    placeholder="ครู คศ.1 / ครูผู้ช่วย / ผอ."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ชื่อจริง</label>
                  <input
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">นามสกุล</label>
                  <input
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* บล็อก 2: Checkbox บทบาททั้งหมด (Multi-role Select) */}
              <div className="space-y-3">
                <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  สิทธิ์การปฏิบัติหน้าที่ (เลือกได้มากกว่า 1 บทบาท)
                </span>
                <p className="text-[10px] text-slate-500">ติ๊กเลือกบทบาทที่บุคลากรคนนี้รับผิดชอบในโรงเรียน</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(ROLE_NAMES_TH).map(([roleKey, roleName]) => {
                    const isChecked = formRoles.includes(roleKey as UserRole);
                    return (
                      <button
                        type="button"
                        key={roleKey}
                        onClick={() => handleRoleToggle(roleKey as UserRole)}
                        className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          isChecked 
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-white shadow-inner' 
                            : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-slate-700 hover:bg-slate-950/70'
                        }`}
                      >
                        <div className="shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-semibold block">{roleName}</span>
                          <span className="text-[9px] text-slate-500 font-mono uppercase">{roleKey}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* บล็อก 3: Conditional Form Fields (ตามบทบาทที่เลือกติ๊ก) */}
              <div className="space-y-5 pt-3 border-t border-white/5">
                
                {/* 1. สังกัดกลุ่มสาระฯ (หัวหน้า หรือ ครูผู้สอน) */}
                <div className="bg-slate-950/30 p-4 border border-white/5 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-400" />
                    กลุ่มสาระสังกัดของบุคลากร (Department Assignment)
                  </h4>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5">ระบุกลุ่มสาระฯ</label>
                    <select
                      value={formDept}
                      onChange={(e) => setFormDept(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 outline-none"
                    >
                      <option value="">-- ไม่ระบุสังกัด --</option>
                      {DEPARTMENTS.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  {formRoles.includes('HEAD_OF_DEPARTMENT') && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-[10px] text-amber-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p>เนื่องจาก ติ๊กเลือก <strong>หัวหน้ากลุ่มสาระฯ</strong> บุคลากรจะได้รับสิทธิ์ตรวจสอบสิทธิ์ในการอนุมัติเกรดและรายงานทั้งหมดของกลุ่มสาระฯ "<strong>{DEPARTMENTS.find(d => d.id === formDept)?.name || 'กรุณาเลือกกลุ่มสาระฯ ด้านบน'}</strong>" นี้</p>
                    </div>
                  )}
                </div>

                {/* 2. ถ้าติ๊ก [x] ครูประจำชั้น -> ให้ขึ้น Dropdown เลือกห้องเรียน */}
                {formRoles.includes('HOMEROOM_TEACHER') && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      ห้องเรียนประจำชั้นที่ดูแล (Homeroom Assignment)
                    </h4>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1.5">เลือกห้องเรียน</label>
                      <select
                        value={formHomeroom}
                        onChange={(e) => setFormHomeroom(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:border-emerald-500 outline-none"
                        required={formRoles.includes('HOMEROOM_TEACHER')}
                      >
                        <option value="">-- กรุณาเลือกห้องเรียน --</option>
                        {ROOM_OPTIONS.map(room => (
                          <option key={room} value={room}>{room}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* 3. ถ้าติ๊ก [x] ครูผู้สอน -> ให้มีปุ่มเพิ่ม "รายวิชา + ห้องเรียน" */}
                {formRoles.includes('SUBJECT_TEACHER') && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      วิชาและระดับห้องเรียนที่ทำการสอน (Teaching Subjects Matrix)
                    </h4>

                    {/* ตารางแสดงรายการที่เพิ่มแล้ว */}
                    <div className="space-y-2">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">วิชาที่รับผิดชอบปัจจุบัน ({formSubjects.length})</span>
                      {formSubjects.length === 0 ? (
                        <div className="text-center py-4 bg-slate-950/40 border border-white/5 rounded-lg text-[10px] text-slate-500">
                          ยังไม่มีรายวิชาที่สอน ระบุในแบบฟอร์มเพิ่มวิชาด้านล่าง
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5 border border-white/5 rounded-lg overflow-hidden bg-slate-950/60 max-h-[140px] overflow-y-auto">
                          {formSubjects.map((sub, i) => (
                            <div key={i} className="px-3 py-2 flex items-center justify-between text-xs hover:bg-white/5">
                              <div>
                                <span className="font-mono font-bold text-blue-400 mr-2">{sub.subjectCode}</span>
                                <span className="text-slate-400">สอนห้อง:</span> <span className="font-bold text-slate-200">{sub.className}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSubject(i)}
                                className="p-1 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition-colors"
                                title="ลบวิชานี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ส่วนฟอร์มเพิ่มวิชา */}
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-white/5 flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-[9px] font-bold text-slate-400 mb-1">รหัสวิชา</label>
                        <input
                          type="text"
                          value={tempCode}
                          onChange={(e) => setTempCode(e.target.value)}
                          placeholder="เช่น ว30101"
                          className="w-full bg-slate-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 outline-none uppercase"
                        />
                      </div>
                      <div className="w-full sm:w-40">
                        <label className="block text-[9px] font-bold text-slate-400 mb-1">ห้องเรียนที่สอน</label>
                        <select
                          value={tempClass}
                          onChange={(e) => setTempClass(e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:border-blue-500 outline-none"
                        >
                          <option value="">-- เลือกห้อง --</option>
                          {ROOM_OPTIONS.map(room => (
                            <option key={room} value={room}>{room}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSubject}
                        className="w-full sm:w-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded flex items-center justify-center gap-1 shrink-0 h-[32px] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> เพิ่มรายวิชา
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. ถ้าติ๊ก [x] ครูนิเทศ -> ให้มี Multi-select เลือกครูที่จะรับนิเทศ */}
                {formRoles.includes('SUPERVISORY_TEACHER') && (
                  <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      มอบหมายหน้าที่ครูนิเทศ (Supervisory Mentor Assignment)
                    </h4>
                    <span className="block text-[10px] font-bold text-slate-400 mb-1">เลือกผู้รับนิเทศ (สตาฟฟ์ท่านอื่นในโรงเรียน)</span>
                    
                    <div className="bg-slate-950/60 border border-white/5 rounded-lg max-h-[160px] overflow-y-auto divide-y divide-white/5 p-1">
                      {staffList
                        .filter(s => s.id !== editingStaff.id) // ไม่สามารถนิเทศตนเองได้
                        .map(teacher => {
                          const isChosen = formMentees.includes(teacher.id);
                          return (
                            <button
                              type="button"
                              key={teacher.id}
                              onClick={() => handleMenteeToggle(teacher.id)}
                              className={`w-full p-2 text-left text-xs flex items-center justify-between rounded hover:bg-white/5 transition-colors ${
                                isChosen ? 'text-pink-300 bg-pink-500/5' : 'text-slate-400'
                              }`}
                            >
                              <div>
                                <span className="font-bold">{teacher.prefix}{teacher.firstName} {teacher.lastName}</span>
                                <span className="text-[10px] text-slate-500 font-mono block">{teacher.email}</span>
                              </div>
                              <div className="shrink-0">
                                {isChosen ? (
                                  <span className="text-[10px] px-2 py-0.5 bg-pink-500/10 border border-pink-500/20 rounded-full font-bold">รับการนิเทศ</span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded-full">เว้นไว้</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

              </div>

            </form>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 bg-[#0a0f16] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-white/5 transition-colors"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(99,102,241,0.25)] flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Bulk Data Import Modal component mounting */}
      <BulkDataImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImportSuccess={(type, count) => {
          let typeLabel = '';
          if (type === 'STUDENT') typeLabel = 'รายชื่อนักเรียน';
          else if (type === 'TEACHER') typeLabel = 'รายชื่อครูผู้สอน/สิทธิ์ประจำตัว';
          else if (type === 'PARENT') typeLabel = 'ข้อมูลยืนยันตัวตนผู้ปกครอง (สำหรับเชื่อมบัญชี LINE)';
          else typeLabel = 'รายวิชาและตารางเรียน';

          triggerSweetAlert(
            'นำเข้าข้อมูลชุดใหญ่สำเร็จ!',
            `ระบบได้ตรวจสอบและดึงข้อมูลประเภท "${typeLabel}" จำนวน ${count} รายการลงสู่สารบบของโรงเรียนเรียบร้อยแล้ว`,
            'success'
          );
        }}
      />

    </div>
  );
}
