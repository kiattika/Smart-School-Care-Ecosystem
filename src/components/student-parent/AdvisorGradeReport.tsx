import React, { useState } from 'react';
import { StudentPicker } from '../shared/StudentPicker';
import { StudentGradeReport } from './StudentGradeReport';
import type { Student } from '../../types';

/** ปพ.6 รายคนสำหรับครูที่ปรึกษา — เลือกนักเรียนในห้องตนเอง แล้วดู/พิมพ์รายงานผลการเรียนพร้อมส่วนหัวทะเบียน (ตรวจร่วมกับงานทะเบียน) */
export function AdvisorGradeReport({ room, students }: { room: string; students: Student[] }) {
  const [sid, setSid] = useState('');
  const picked = students.find(s => s.studentId === sid);
  if (!room) return <p className="text-sm text-slate-400">ยังไม่มีห้องที่ปรึกษา</p>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">ผลการเรียนรายคน (ปพ.6) ห้อง {room} — คะแนนที่ครูผู้สอนบันทึก เป็นข้อมูลไม่เป็นทางการ ใช้ตรวจสอบก่อนส่งงานทะเบียน</p>
      <StudentPicker mode="single" students={students} value={sid} onSelect={setSid} placeholder="ค้นหาด้วยเลขประจำตัวหรือชื่อ" />
      {picked ? (
        <div key={picked.studentId}><StudentGradeReport studentId={picked.studentId} studentName={picked.name} room={picked.room} /></div>
      ) : <p className="text-sm text-slate-400 border border-dashed border-slate-700 rounded-xl p-6 text-center">เลือกนักเรียนเพื่อดูรายงานผลการเรียน</p>}
    </div>
  );
}
