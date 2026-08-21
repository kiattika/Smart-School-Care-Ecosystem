import React, { useState } from 'react';
import { 
  GraduationCap, 
  FileSpreadsheet, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Send, 
  Download, 
  Printer, 
  Award, 
  BookOpen, 
  MapPin, 
  UserCheck,
  TrendingUp,
  FileText
} from 'lucide-react';
import { useStore } from '../../store';
import { ReportCardTerm, HomeworkAssignment, ExamScheduleItem } from '../../types';

export function AcademicHomeworkModule({ studentId }: { studentId: string }) {
  const { 
    reportCards, 
    homeworkAssignments, 
    examSchedules, 
    submitHomework,
    students 
  } = useStore();

  const student = students.find(s => s.studentId === studentId) || students[0];
  const reports: ReportCardTerm[] = (reportCards && reportCards[student?.studentId]) || (reportCards && reportCards['6950801']) || [];
  const assignments = homeworkAssignments;
  const exams = examSchedules;

  const [activeTab, setActiveTab] = useState<'reportcard' | 'homework' | 'exams'>('reportcard');
  const [selectedSemester, setSelectedSemester] = useState<string>(reports[0]?.semester || reports[0]?.term || '1/2569');
  
  // Homework submit state
  const [selectedHwId, setSelectedHwId] = useState<string | null>(null);
  const [hwFileName, setHwFileName] = useState('รายงาน_ฟิสิกส์_การเคลื่อนที่แบบฮาร์มอนิกอย่างง่าย.pdf');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const currentReport = reports.find(r => (r.semester || r.term) === selectedSemester) || reports[0];

  const handleSubmitHomework = (hwId: string) => {
    submitHomework(hwId, hwFileName);
    setSubmitSuccess(true);
    setTimeout(() => {
      setSubmitSuccess(false);
      setSelectedHwId(null);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Sub navigation pills */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl w-full max-w-lg mx-auto">
        <button
          onClick={() => setActiveTab('reportcard')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'reportcard'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>สมุดรายงานผล ปพ.6</span>
        </button>
        <button
          onClick={() => setActiveTab('homework')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'homework'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>การบ้าน & ภาระงาน</span>
        </button>
        <button
          onClick={() => setActiveTab('exams')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'exams'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>ตารางสอบ & ผังที่นั่ง</span>
        </button>
      </div>

      {activeTab === 'reportcard' && currentReport && (
        <div className="space-y-6">
          {/* Header Summary & Semester Picker */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold font-mono">
                  ปพ.6 ดิจิทัล
                </span>
                <span className="text-xs text-slate-400">ระเบียนแสดงผลการเรียนประจำภาคเรียน</span>
              </div>
              <h3 className="text-base font-bold text-white">
                ผลการเรียนรายภาคเรียน: {currentReport.semester || currentReport.term}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                {reports.map((r, idx) => {
                  const sem = r.semester || r.term || `เทอม ${idx + 1}`;
                  return (
                    <button
                      key={sem}
                      onClick={() => setSelectedSemester(sem)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedSemester === sem
                          ? 'bg-indigo-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      เทอม {sem}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => window.print()}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all"
                title="พิมพ์ ปพ.6"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Academic Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block mb-1">เกรดเฉลี่ยประจำเทอม (GPA)</span>
              <p className="text-3xl font-black text-emerald-400">{currentReport.gpa.toFixed(2)}</p>
              <span className="text-[10px] text-emerald-400 mt-1 block">เกรดเฉลี่ยยอดเยี่ยม</span>
            </div>

            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block mb-1">เกรดเฉลี่ยสะสม (GPAX)</span>
              <p className="text-3xl font-black text-indigo-400">{currentReport.gpax.toFixed(2)}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">สะสมตามแผนการเรียน</span>
            </div>

            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block mb-1">หน่วยกิตที่ได้</span>
              <p className="text-3xl font-black text-white">{currentReport.totalCredits || currentReport.creditsEarned || 16.5}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">ครบตามโครงสร้างหลักสูตร</span>
            </div>

            <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-2xl">
              <span className="text-[11px] text-slate-400 block mb-1">อันดับในสายชั้น (Rank)</span>
              <p className="text-3xl font-black text-amber-400">#{currentReport.classRank || 1}</p>
              <span className="text-[10px] text-slate-400 mt-1 block">จากนักเรียนทั้งหมด 320 คน</span>
            </div>
          </div>

          {/* Subject Grade Table */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl">
            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-400" />
              รายละเอียดรายวิชาและคะแนนเก็บ (Subject Grades & Assessment)
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 pb-3">
                    <th className="pb-3 font-medium">รหัสวิชา</th>
                    <th className="pb-3 font-medium">ชื่อรายวิชา</th>
                    <th className="pb-3 font-medium text-center">หน่วยกิต</th>
                    <th className="pb-3 font-medium text-center">กลางภาค (20-30)</th>
                    <th className="pb-3 font-medium text-center">ปลายภาค (20-30)</th>
                    <th className="pb-3 font-medium text-center">รวม (100)</th>
                    <th className="pb-3 font-medium text-right">เกรดที่ได้</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {currentReport.subjects.map((subj, idx) => {
                    const cCode = subj.code || subj.courseCode || '';
                    const cName = subj.name || subj.courseName || '';
                    const creditVal = subj.credit ?? subj.credits ?? 1.5;
                    const midVal = subj.midterm ?? subj.midtermScore ?? '-';
                    const finVal = subj.final ?? subj.finalScore ?? '-';
                    const gradeStr = typeof subj.grade === 'number' ? subj.grade.toFixed(1) : String(subj.grade);
                    const gradeNum = typeof subj.grade === 'number' ? subj.grade : parseFloat(subj.grade) || 4.0;
                    return (
                      <tr key={cCode || idx} className="hover:bg-slate-800/30">
                        <td className="py-3 font-mono font-bold text-indigo-400">{cCode}</td>
                        <td className="py-3 font-medium text-slate-200">{cName}</td>
                        <td className="py-3 text-center text-slate-300">{creditVal}</td>
                        <td className="py-3 text-center text-slate-300">{midVal}</td>
                        <td className="py-3 text-center text-slate-300">{finVal}</td>
                        <td className="py-3 text-center font-bold text-white">{subj.totalScore}</td>
                        <td className="py-3 text-right">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            gradeNum >= 4.0 ? 'bg-emerald-500/20 text-emerald-300' :
                            gradeNum >= 3.5 ? 'bg-blue-500/20 text-blue-300' :
                            'bg-amber-500/20 text-amber-300'
                          }`}>
                            {gradeStr}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Homeroom Remarks */}
            <div className="mt-6 p-4 bg-slate-800/40 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">ความเห็นครูประจำชั้น:</span>
                <p className="text-slate-200 font-medium">{currentReport.homeroomRemarks || 'ผลการเรียนอยู่ในเกณฑ์ดีเยี่ยม มีความตั้งใจและมีระเบียบวินัยสม่ำเสมอ'}</p>
              </div>
              <span className="text-emerald-400 font-bold shrink-0">
                สถานะ: ผ่านการเลื่อนชั้น (PROMOTED)
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'homework' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                การบ้าน ภาระงาน และโครงงานที่ได้รับมอบหมาย (Homework Tracker)
              </h3>
              <p className="text-[11px] text-slate-400">ติดตามกำหนดส่งงานและส่งไฟล์งานออนไลน์</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700">
              รวม {assignments.length} ภาระงาน
            </span>
          </div>

          <div className="space-y-4">
            {assignments.map((hw) => (
              <div
                key={hw.id}
                className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 backdrop-blur-md shadow-xl transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                      {hw.courseCode}
                    </span>
                    <span className="text-xs text-slate-400">{hw.courseName}</span>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border self-start sm:self-auto ${
                    hw.status === 'GRADED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                    hw.status === 'SUBMITTED' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                    'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                  }`}>
                    {hw.status === 'GRADED' ? `✅ ตรวจแล้ว (${hw.scoreReceived ?? hw.score ?? hw.maxScore}/${hw.maxScore} คะแนน)` :
                     hw.status === 'SUBMITTED' ? '📩 ส่งแล้ว (รอตรวจ)' : '⏳ ยังไม่ส่ง'}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">{hw.title}</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{hw.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>กำหนดส่ง: <strong className="text-slate-200">{hw.dueDate}</strong></span>
                  </div>

                  {hw.status === 'ASSIGNED' || hw.status === 'OVERDUE' ? (
                    <div className="flex items-center gap-2">
                      {selectedHwId === hw.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={hwFileName}
                            onChange={(e) => setHwFileName(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                          />
                          <button
                            onClick={() => handleSubmitHomework(hw.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="w-3 h-3" /> ยืนยันส่ง
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedHwId(hw.id)}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>แนบไฟล์และส่งการบ้าน</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>ไฟล์ที่ส่ง: <span className="text-indigo-300 font-mono">{hw.submittedFile}</span></span>
                      {(hw.teacherFeedback || hw.feedback) && (
                        <span className="text-emerald-400 font-medium">💬 ครู: "{hw.teacherFeedback || hw.feedback}"</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'exams' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                ตารางสอบกลางภาค / ปลายภาค และผังที่นั่งสอบ (Exam Schedule & Seating)
              </h3>
              <p className="text-[11px] text-slate-400">
                ปีการศึกษา 2569 • ภาคเรียนที่ 1 • อาคารเรียน 4
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold">
              สอบกลางภาค/ปลายภาค: ภาคเรียนที่ 1/2569
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="p-4 bg-slate-800/40 border border-slate-800 hover:border-amber-500/40 rounded-2xl transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                    {exam.courseCode || exam.subjectCode}
                  </span>
                  <span className="text-xs font-bold text-white">{exam.date}</span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">{exam.courseName || exam.subjectName}</h4>
                  <p className="text-xs text-indigo-400 font-mono mt-0.5">⏱️ เวลาสอบ: {exam.timeSlot || exam.time}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>ห้องสอบ: <strong className="text-white">{exam.room}</strong></span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ที่นั่งสอบ: <strong className="text-emerald-400">{exam.seatNo || exam.seatNumber}</strong></span>
                  </div>
                </div>

                {(exam.toolsAllowed || exam.examType) && (
                  <p className="text-[10px] text-slate-400 pt-1">
                    📌 ประเภทการสอบ: {exam.examType === 'MIDTERM' ? 'สอบกลางภาค' : 'สอบปลายภาค'} {exam.toolsAllowed ? `• อุปกรณ์: ${exam.toolsAllowed}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

