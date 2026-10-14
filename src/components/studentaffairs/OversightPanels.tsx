import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { HomeVisitSummaryPanel } from '../homevisit/HomeVisitSummaryPanel';
import { useSchoolHomeVisitData } from '../../hooks/useHomeVisitData';
import { summarizeHomeVisit } from '../../lib/homeVisitAnalytics';
import { gateMorningByStudent } from '../../lib/gateMorningStatus';
import { subscribeGateAttendanceLogs, subscribeStaffList } from '../../services/firestoreService';
import { isSameRoom } from '../../lib/utils';
import type { GateAttendanceRecord, Student } from '../../types';
import type { UserProfile } from '../../types/auth';

const sortRooms = (rooms: string[]) => [...rooms].sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
const roomsOf = (students: Student[]) => sortRooms([...new Set<string>(students.map(s => s.room || '').filter(Boolean))]);
const teacherOf = (staff: UserProfile[], room: string) => {
  const t = staff.find(s => isSameRoom(s.assignments?.homeroomClass, room) && (s.roles || []).includes('HOMEROOM_TEACHER'));
  return t ? `${t.prefix || ''}${t.firstName} ${t.lastName}`.trim() : '-';
};

/** งานกิจการ: กำกับเยี่ยมบ้านทั้งโรงเรียน (อ่านอย่างเดียว) — ภาพรวม + ความคืบหน้ารายห้อง */
export function HomeVisitOversightPanel({ students }: { students: Student[] }) {
  const data = useSchoolHomeVisitData();
  const [staff, setStaff] = useState<UserProfile[]>([]);
  useEffect(() => subscribeStaffList(setStaff), []);
  const today = format(new Date(), 'yyyy-MM-dd');
  const school = useMemo(() => summarizeHomeVisit({ totalStudents: students.length, records: data.records, studentInfo: data.studentInfo, familyInfo: data.familyInfo, todayYmd: today }), [students.length, data, today]);
  const rows = useMemo(() => roomsOf(students).map(room => {
    const inRoom = students.filter(s => s.room === room);
    const s = summarizeHomeVisit({
      totalStudents: inRoom.length, todayYmd: today,
      records: data.records.filter(r => isSameRoom(r.homeroomClass, room)),
      studentInfo: data.studentInfo.filter(r => isSameRoom(r.homeroomClass, room)),
      familyInfo: data.familyInfo.filter(r => isSameRoom(r.homeroomClass, room)),
    });
    return { room, total: inRoom.length, visited: s.visited, teacher: teacherOf(staff, room) };
  }), [students, data, staff, today]);
  return (
    <div className="space-y-4">
      <HomeVisitSummaryPanel title="สารสนเทศเยี่ยมบ้านทั้งโรงเรียน (ปีการศึกษาปัจจุบัน)" s={school} />
      <div className="rounded-xl border border-slate-700 p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-slate-100 mb-2">ความคืบหน้ารายห้อง</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-400"><th className="py-1">ห้อง</th><th>ครูที่ปรึกษา</th><th className="text-right">เยี่ยมแล้ว</th><th className="text-right">ทั้งหมด</th><th className="text-right">ร้อยละ</th></tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.room} className="border-t border-slate-800"><td className="py-1.5">{r.room}</td><td>{r.teacher}</td><td className="text-right">{r.visited}</td><td className="text-right">{r.total}</td><td className="text-right">{r.total ? Math.round((r.visited / r.total) * 100) : 0}%</td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

/** งานกิจการ: นักเรียนที่ยังไม่มีบันทึกเข้าประตูโรงเรียนวันนี้ แยกตามห้อง (อ่านอย่างเดียว — ติดตามร่วมกับครูที่ปรึกษา) */
export function AbsentTodayPanel({ students }: { students: Student[] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [logs, setLogs] = useState<GateAttendanceRecord[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  useEffect(() => subscribeGateAttendanceLogs(setLogs, { date: today }), [today]);
  useEffect(() => subscribeStaffList(setStaff), []);
  const arrived = useMemo(() => gateMorningByStudent(logs, today), [logs, today]);
  const missing = useMemo(() => students.filter(s => !arrived.has(s.studentId)), [students, arrived]);
  const groups = useMemo(() => roomsOf(missing).map(room => ({ room, list: missing.filter(s => s.room === room).sort((a, b) => a.studentNo - b.studentNo) })), [missing]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">นักเรียนที่ยังไม่มีบันทึกเช็คอินเข้าโรงเรียนวันนี้ ({today}) — ข้อมูลสด อ่านอย่างเดียว ใช้ติดตามร่วมกับครูที่ปรึกษา (ยังไม่หักนักเรียนที่ลา เพราะข้อมูลใบลาแยกสิทธิ์)</p>
      <p className="text-sm text-slate-200">ยังไม่เข้าโรงเรียน <b className="text-amber-300">{missing.length}</b> จาก {students.length} คน</p>
      {groups.map(g => (
        <div key={g.room} className="rounded-xl border border-slate-700 p-3">
          <p className="text-sm font-semibold text-slate-100 mb-1">{g.room} ({g.list.length} คน) <span className="text-xs font-normal text-slate-400">ครูที่ปรึกษา: {teacherOf(staff, g.room)}</span></p>
          <p className="text-sm text-slate-300">{g.list.map(s => `${s.studentNo ? `${s.studentNo}. ` : ''}${s.name}`).join(' · ')}</p>
        </div>
      ))}
    </div>
  );
}
