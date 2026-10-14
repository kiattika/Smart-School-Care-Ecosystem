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
import { StudentGradeReport } from './StudentGradeReport';

export function AcademicHomeworkModule({ studentId, room, studentName }: { studentId: string; room?: string; studentName?: string }) {
  const { 
    examSchedules,
  } = useStore();

  const exams = examSchedules;

  const [activeTab, setActiveTab] = useState<'reportcard' | 'exams'>('reportcard');

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

      {activeTab === 'reportcard' && (
        <StudentGradeReport studentId={studentId} studentName={studentName} room={room} />
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

