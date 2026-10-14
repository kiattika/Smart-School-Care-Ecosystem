import React, { useState } from 'react';
import { StudentPicker } from '../shared/StudentPicker';
import { ConductEntryForm } from './ConductEntryForm';
import { MyConductEntriesPanel } from './MyConductEntriesPanel';
import { useRealStudents } from '../../hooks/useRealStudents';
import { conductBand } from '../../lib/conduct';

/** ครูทุกคน: ให้/หักคะแนนความประพฤตินักเรียนคนใดก็ได้ในโรงเรียน (ไม่จำกัดเฉพาะห้องที่สอน) */
export function TeacherConductPanel() {
  const { students } = useRealStudents();
  const [sid, setSid] = useState('');
  const student = students.find(s => s.studentId === sid);
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-slate-400">
        ครูทุกคนให้/หักคะแนนนักเรียนได้ทุกคน — ครั้งละไม่เกิน 5 คะแนนมีผลทันที เกินนั้นส่งให้งานกิจการนักเรียนพิจารณา
      </p>
      <StudentPicker mode="single" students={students} value={sid} onSelect={setSid} placeholder="ค้นหาด้วยเลขประจำตัวหรือชื่อนักเรียน" />
      {student && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
            <span className="font-bold">{student.name}</span> · {student.room} · คะแนนความประพฤติ{' '}
            <span className="font-black">{student.behaviorScore ?? 100}</span> ({conductBand(student.behaviorScore ?? 100)})
          </div>
          <ConductEntryForm studentId={student.studentId} />
          <MyConductEntriesPanel studentId={student.studentId} />
        </div>
      )}
    </div>
  );
}
