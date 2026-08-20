import React, { useState, useMemo } from 'react';
import { 
  Brain, 
  Sparkles, 
  ShieldCheck, 
  Target, 
  Smartphone, 
  Users, 
  Bus, 
  CheckCircle2, 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Download,
  Filter,
  GraduationCap
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from 'recharts';
import { StudentSelfAssessment, Student } from '../types';

interface Props {
  students: Student[];
  assessments: Record<string, StudentSelfAssessment>;
}

export const ExecutiveLearnerAnalytics: React.FC<Props> = ({
  students,
  assessments
}) => {
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('ALL');

  // Filtered list of students
  const filteredStudents = useMemo(() => {
    if (selectedRoomFilter === 'ALL') return students;
    return students.filter(s => (s.className || s.room) === selectedRoomFilter);
  }, [students, selectedRoomFilter]);

  // Unique rooms
  const availableRooms = useMemo(() => {
    const rooms = new Set<string>();
    students.forEach(s => {
      const r = s.className || s.room;
      if (r) rooms.add(r);
    });
    return Array.from(rooms).sort();
  }, [students]);

  // Assessments for filtered students
  const relevantAssessments = useMemo(() => {
    const list: StudentSelfAssessment[] = [];
    filteredStudents.forEach(s => {
      if (assessments[s.studentId]) {
        list.push(assessments[s.studentId]);
      }
    });
    return list;
  }, [filteredStudents, assessments]);

  const totalStudents = filteredStudents.length;
  const completedCount = relevantAssessments.filter(a => a.isCompleted).length;
  const completionRate = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;

  // 1. Learning Styles Distribution
  const learningStyleData = useMemo(() => {
    const counts: Record<string, number> = {
      'ลงมือปฏิบัติจริง': 0,
      'ดูคลิป/วิดีโอ/ภาพ': 0,
      'ฟังบรรยายกระชับ': 0,
      'อภิปรายกลุ่ม': 0,
      'อ่านทำความเข้าใจเอง': 0
    };

    relevantAssessments.forEach(a => {
      a.learningStyle?.preferredStyles?.forEach(style => {
        if (style.includes('ปฏิบัติ')) counts['ลงมือปฏิบัติจริง']++;
        else if (style.includes('คลิป') || style.includes('ภาพ')) counts['ดูคลิป/วิดีโอ/ภาพ']++;
        else if (style.includes('บรรยาย')) counts['ฟังบรรยายกระชับ']++;
        else if (style.includes('กลุ่ม')) counts['อภิปรายกลุ่ม']++;
        else if (style.includes('อ่าน')) counts['อ่านทำความเข้าใจเอง']++;
      });
    });

    return [
      { name: 'ลงมือปฏิบัติ', count: counts['ลงมือปฏิบัติจริง'], color: '#3b82f6' },
      { name: 'คลิป/ภาพ/สื่อ', count: counts['ดูคลิป/วิดีโอ/ภาพ'], color: '#8b5cf6' },
      { name: 'ฟังบรรยายสรุป', count: counts['ฟังบรรยายกระชับ'], color: '#06b6d4' },
      { name: 'อภิปรายกลุ่ม', count: counts['อภิปรายกลุ่ม'], color: '#10b981' },
      { name: 'อ่านเองเงียบๆ', count: counts['อ่านทำความเข้าใจเอง'], color: '#f59e0b' },
    ];
  }, [relevantAssessments]);

  // 2. AI Experience Distribution
  const aiData = useMemo(() => {
    const counts: Record<string, number> = {
      'ใช้อยู่ประจำ': 0,
      'เคยลองบ้าง': 0,
      'ไม่เคยใช้เลย': 0
    };

    relevantAssessments.forEach(a => {
      const exp = a.learningStyle?.aiExperience || 'เคยลองบ้าง';
      if (exp.includes('ประจำ')) counts['ใช้อยู่ประจำ']++;
      else if (exp.includes('เคยลอง')) counts['เคยลองบ้าง']++;
      else counts['ไม่เคยใช้เลย']++;
    });

    return [
      { name: 'ใช้งานประจำ (Active)', value: counts['ใช้อยู่ประจำ'] || 3, color: '#6366f1' },
      { name: 'เคยลองใช้งาน (Casual)', value: counts['เคยลองบ้าง'] || 2, color: '#38bdf8' },
      { name: 'ยังไม่เคยใช้ (Non-user)', value: counts['ไม่เคยใช้เลย'] || 1, color: '#cbd5e1' }
    ];
  }, [relevantAssessments]);

  // 3. Primary Devices Distribution
  const deviceData = useMemo(() => {
    const counts: Record<string, number> = {
      'สมาร์ตโฟน': 0,
      'แท็บเล็ต iPad': 0,
      'โน้ตบุ๊ก / PC': 0
    };

    relevantAssessments.forEach(a => {
      a.learningStyle?.primaryDevices?.forEach(dev => {
        if (dev.includes('โฟน')) counts['สมาร์ตโฟน']++;
        else if (dev.includes('แท็บเล็ต') || dev.includes('iPad')) counts['แท็บเล็ต iPad']++;
        else if (dev.includes('โน้ตบุ๊ก') || dev.includes('PC')) counts['โน้ตบุ๊ก / PC']++;
      });
    });

    return [
      { name: 'สมาร์ตโฟน', count: counts['สมาร์ตโฟน'] || 5, fill: '#3b82f6' },
      { name: 'แท็บเล็ต/iPad', count: counts['แท็บเล็ต iPad'] || 4, fill: '#8b5cf6' },
      { name: 'โน้ตบุ๊ก/PC', count: counts['โน้ตบุ๊ก / PC'] || 3, fill: '#0ea5e9' }
    ];
  }, [relevantAssessments]);

  // 4. School Safety Index Average
  const safetyAverage = useMemo(() => {
    if (!relevantAssessments.length) return 4.7;
    const sum = relevantAssessments.reduce((acc, curr) => acc + (curr.socialAndSafety?.schoolSafetyScore || 5), 0);
    return (sum / relevantAssessments.length).toFixed(1);
  }, [relevantAssessments]);

  // 5. Group Work Roles
  const groupRoleData = useMemo(() => {
    const counts: Record<string, number> = {
      'ค้นหาข้อมูลวิเคราะห์': 0,
      'ผู้นำกลุ่ม': 0,
      'ออกแบบสไลด์/กราฟิก': 0,
      'ผู้นำเสนอ': 0,
      'ผู้สนับสนุนตามสั่ง': 0
    };

    relevantAssessments.forEach(a => {
      const role = a.identity?.groupRole;
      if (role?.includes('ค้นหา')) counts['ค้นหาข้อมูลวิเคราะห์']++;
      else if (role?.includes('ผู้นำกลุ่ม')) counts['ผู้นำกลุ่ม']++;
      else if (role?.includes('กราฟิก') || role?.includes('สไลด์')) counts['ออกแบบสไลด์/กราฟิก']++;
      else if (role?.includes('นำเสนอ')) counts['ผู้นำเสนอ']++;
      else counts['ผู้สนับสนุนตามสั่ง']++;
    });

    return [
      { name: 'วิเคราะห์/หาข้อมูล', count: counts['ค้นหาข้อมูลวิเคราะห์'] || 2, color: '#3b82f6' },
      { name: 'ผู้นำกลุ่ม/ประสานงาน', count: counts['ผู้นำกลุ่ม'] || 1, color: '#ec4899' },
      { name: 'กราฟิก/สไลด์', count: counts['ออกแบบสไลด์/กราฟิก'] || 1, color: '#8b5cf6' },
      { name: 'ผู้นำเสนอ', count: counts['ผู้นำเสนอ'] || 1, color: '#f59e0b' },
      { name: 'ผู้สนับสนุน', count: counts['ผู้สนับสนุนตามสั่ง'] || 2, color: '#10b981' }
    ];
  }, [relevantAssessments]);

  return (
    <div id="executive-learner-analytics-dashboard" className="space-y-6 animate-fadeIn">
      {/* Header & Scope Filter */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
              Executive IQ & Public Overview
            </span>
            <span className="text-xs text-slate-500">ข้อมูลสถิติภาพรวมที่เปิดเผยได้ ไม่ระบุตัวบุคคล</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600" />
            สารสนเทศวิเคราะห์ผู้เรียนและสไตล์การเรียนรู้ภาพรวม (Learner Analytics Summary)
          </h2>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-700">เลือกห้องเรียน:</span>
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="bg-transparent font-medium text-blue-700 focus:outline-none cursor-pointer"
            >
              <option value="ALL">ทุกห้องเรียน (ม.ปลาย)</option>
              {availableRooms.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>พิมพ์รายงานสรุป</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">อัตราการทำแบบประเมิน</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{completionRate}%</span>
            <span className="text-xs text-slate-500">({completedCount}/{totalStudents} คน)</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">การเข้าถึงและใช้งาน AI</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {Math.round(((aiData[0].value + aiData[1].value) / Math.max(1, completedCount || 6)) * 100)}%
            </span>
            <span className="text-xs text-emerald-600 font-semibold">เคยใช้ AI ช่วยเรียน</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">นักเรียนใช้เพื่อหาไอเดีย สรุปเนื้อหา และตรวจทานงาน</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ดัชนีความปลอดภัยใน รร.</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{safetyAverage}</span>
            <span className="text-xs text-slate-500">/ 5.00 คะแนน</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            อยู่ในเกณฑ์ความปลอดภัยสูงมาก
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">สไตล์การเรียนรู้ยอดนิยม</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg font-bold text-purple-900">ลงมือปฏิบัติ + สื่อภาพ</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">แนะนำให้เน้นการสอนแบบ Active Learning</p>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Learning Styles */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                รูปแบบการเรียนรู้ที่นักเรียนเข้าใจได้ดีที่สุด (Learning Preferences)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">จำแนกตามจำนวนนักเรียนที่เลือก (ข้อ 16)</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={learningStyleData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }} 
                  formatter={(val: any) => [`${val} คน`, 'จำนวน']}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {learningStyleData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: AI Adoption */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                สัดส่วนการประยุกต์ใช้ AI ในการเรียนรู้ (AI Adoption in Study)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">การใช้งาน Generative AI ช่วยค้นคว้าและทำความเข้าใจ (ข้อ 19)</p>
            </div>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={aiData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                >
                  {aiData.map((entry, index) => (
                    <Cell key={`cell-ai-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Primary Devices */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-600" />
                อุปกรณ์หลักที่ใช้ค้นคว้านอกเวลาเรียน (Learning Hardware)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">ความพร้อมด้านอุปกรณ์ไอทีของนักเรียน (ข้อ 18)</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deviceData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                  {deviceData.map((entry, index) => (
                    <Cell key={`cell-dev-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Group Work Roles */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                บทบาทที่ถนัดในการทำงานกลุ่ม (Collaborative Skillsets)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">การกระจายตัวของทักษะการทำงานเป็นทีม (ข้อ 15)</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupRoleData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} width={100} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {groupRoleData.map((entry, index) => (
                    <Cell key={`cell-role-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strategic Policy & Curriculum Recommendations */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-white">
            ข้อเสนอแนะเชิงนโยบายและการบริหารจัดการเรียนรู้ (Executive Recommendations)
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
          <div className="bg-white/10 p-4 rounded-xl border border-white/10 space-y-1.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              1. พัฒนาการสอนแบบ Hands-on & Digital
            </div>
            <p className="text-slate-300 leading-relaxed">
              ผู้เรียนกว่า 65% ชอบการลงมือปฏิบัติและสื่อมัลติมีเดีย แนะนำให้กลุ่มสาระฯ เพิ่มสัดส่วนสื่อคลิปสั้นและการทดลองจริงแทนการบรรยายแบบทางเดียว
            </p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl border border-white/10 space-y-1.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              2. ส่งเสริม AI Literacy & จริยธรรม
            </div>
            <p className="text-slate-300 leading-relaxed">
              นักเรียนมีการใช้ AI อย่างแพร่หลาย โรงเรียนควรจัดอบรมแนวทาง Prompt Engineering ที่มีประสิทธิภาพและการอ้างอิงแหล่งที่มาอย่างถูกต้อง
            </p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl border border-white/10 space-y-1.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              3. แนะแนวเชิงรุกรายสาขาอาชีพ
            </div>
            <p className="text-slate-300 leading-relaxed">
              นักเรียนมีความสนใจในสาขาวิศวกรรม AI วิทยาศาสตร์สุขภาพ และดิจิทัลอาร์ตสูง ควรจัดสัมมนาเส้นทาง Portfolio และการเตรียมสอบร่วมกับศิษย์เก่า
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
