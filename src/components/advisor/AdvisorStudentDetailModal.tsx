import React from 'react';
import { X, UserCheck } from 'lucide-react';
import { Student } from '../../types';
import { RawScheduleDoc } from '../../lib/studentDaySchedule';
import { AttendanceRecordFull } from '../../lib/attendanceHistory';
import { StudentAttendanceDetail } from '../attendance/StudentAttendanceDetail';

/**
 * รายละเอียดนักเรียนรายคนสำหรับครูที่ปรึกษา — ข้อมูลจริงเท่านั้น:
 * คะแนนความประพฤติ (students.behaviorScore) + สถิติการเข้าเรียนรายวิชา/รายวัน/รายคาบจาก attendance_records
 * (ไม่แสดงหมู่เลือด/ครอบครัว/รายได้/BMI/รูปบ้านตัวอย่าง — ระบบยังไม่มีแหล่งข้อมูลจริงของสิ่งเหล่านี้)
 */
export function AdvisorStudentDetailModal({ student, onClose, records, schedules, range, onRangeChange, loading }: {
  student: Student;
  onClose: () => void;
  records: AttendanceRecordFull[];
  schedules: RawScheduleDoc[];
  range: { start: string; end: string };
  onRangeChange: (r: { start: string; end: string }) => void;
  loading?: boolean;
}) {
  const score = student.behaviorScore;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in" data-testid="advisor-student-detail">
      <div className="bg-[#1c1f2b] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-[#1c1f2b]/90 backdrop-blur z-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-400" /> ข้อมูลนักเรียน: {student.name}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors" aria-label="ปิด">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-4 items-center">
            <img src={student.photoUrl || student.avatar} className="w-20 h-20 rounded-xl bg-slate-800 object-cover" alt="" />
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-white truncate">{student.name}</h3>
              <p className="text-slate-400 text-sm">เลขประจำตัว {student.studentId}{student.room ? ` | ${student.room}` : ''}</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500">คะแนนความประพฤติ</div>
              <div className="text-2xl font-black text-emerald-400">{score ?? '—'}</div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3">สถิติการเข้าเรียน</h4>
            <StudentAttendanceDetail
              studentId={student.studentId}
              records={records}
              schedules={schedules}
              range={range}
              onRangeChange={onRangeChange}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
