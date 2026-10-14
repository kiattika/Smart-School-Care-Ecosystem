import React, { useEffect, useState } from 'react';
import { StudentPicker } from '../shared/StudentPicker';
import { StudentGradeReport } from './StudentGradeReport';
import { getGradebookScoresByRoom } from '../../services/firestoreService';
import type { ScoreDoc } from '../../lib/gradeReport';
import type { Student } from '../../types';

/** ปพ.6 รายคนสำหรับครูที่ปรึกษา — เลือกนักเรียนในห้องตนเอง แล้วดู/พิมพ์รายงานผลการเรียน (ข้อมูลเดียวกับที่นักเรียน/ผู้ปกครองเห็น + ลำดับที่ในห้อง) */
export function AdvisorGradeReport({ room, students }: { room: string; students: Student[] }) {
  const [sid, setSid] = useState('');
  const [roomScores, setRoomScores] = useState<ScoreDoc[] | null>(null);
  const [rankErr, setRankErr] = useState('');
  const picked = students.find(s => s.studentId === sid);
  // คะแนนทั้งห้อง (ใช้คำนวณลำดับที่) — โหลดครั้งเดียวต่อห้อง; ล้มเหลว = ไม่แสดงลำดับที่ (ไม่กระทบรายงาน)
  useEffect(() => {
    if (!room) return;
    let alive = true;
    setRoomScores(null); setRankErr('');
    getGradebookScoresByRoom(room).then(l => { if (alive) setRoomScores(l as unknown as ScoreDoc[]); }).catch((e: Error) => { if (alive) setRankErr(e.message); });
    return () => { alive = false; };
  }, [room]);
  if (!room) return <p className="text-sm text-slate-400">ยังไม่มีห้องที่ปรึกษา</p>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">ผลการเรียนรายคน (ปพ.6) ห้อง {room} — คะแนนที่ครูผู้สอนบันทึก เป็นข้อมูลเดียวกับที่นักเรียน/ผู้ปกครองเห็น (ไม่เป็นทางการ) พร้อมลำดับที่ตามเกรดเฉลี่ยในห้อง</p>
      {rankErr && <p role="alert" className="text-xs text-amber-300">คำนวณลำดับที่ไม่ได้: {rankErr}</p>}
      <StudentPicker mode="single" students={students} value={sid} onSelect={setSid} placeholder="ค้นหาด้วยเลขประจำตัวหรือชื่อ" />
      {picked ? (
        <div key={picked.studentId}><StudentGradeReport studentId={picked.studentId} studentName={picked.name} room={picked.room} courseStats={picked.courseAttendanceStats}
          rankContext={roomScores ? { scores: roomScores, students: students.map(s => ({ studentId: s.studentId, courseAttendanceStats: s.courseAttendanceStats })) } : undefined} /></div>
      ) : <p className="text-sm text-slate-400 border border-dashed border-slate-700 rounded-xl p-6 text-center">เลือกนักเรียนเพื่อดูรายงานผลการเรียน</p>}
    </div>
  );
}
