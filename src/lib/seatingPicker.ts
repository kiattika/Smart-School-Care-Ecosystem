import type { Student } from '../types';
import type { SeatingGroup, SeatingAssignment } from '../types/seating';
import type { ClassroomDeskGroup } from '../components/RandomStudentPickerModal';

/**
 * แปลงกลุ่มที่นั่ง (SeatingGroup) เป็นหน่วย "โต๊ะ" ที่สุ่มได้ทีละหน่วยในโหมด "สุ่มรายโต๊ะ/กลุ่ม"
 *
 * ทำไม: กลุ่มแบบ ROW/GRID ("แถวโต๊ะคู่") หนึ่งกลุ่ม = หลายโต๊ะคู่เรียงกัน (render เป็น grid 2 คอลัมน์)
 * ถ้าไม่หั่น "สุ่มโต๊ะ" จะได้ทั้งแถว (~10 คน) แทนที่จะได้โต๊ะเดียว (2 คน) — บั๊กที่ยืนยันจากผู้ใช้จริง
 *
 * - ROW / GRID  → หั่นเป็นโต๊ะละ DESK_SIZE ที่นั่ง (เรียงตาม seatNumber)
 * - POD / CIRCLE / undefined → 1 หน่วยทำงานกลุ่ม คงทั้งกลุ่มไว้
 * - โต๊ะที่ไม่มีนักเรียนนั่ง (students ว่าง) ถูกคัดออกภายหลังโดย picker เอง (filter students.length > 0)
 */
export const DESK_SIZE = 2; // ตรงกับ grid-cols-2 ที่ใช้ render ที่นั่งในกลุ่ม

export function buildDeskGroupsForPicker(
  groups: SeatingGroup[],
  assignments: Record<string, SeatingAssignment>,
  courseStudents: Student[]
): ClassroomDeskGroup[] {
  const seatedStudent = (seatId: string): Student | null => {
    const assign = assignments[seatId];
    if (!assign || assign.effectiveTo) return null;
    return courseStudents.find(st => st.studentId === assign.studentId) || null;
  };

  const result: ClassroomDeskGroup[] = [];

  groups.forEach((g, gIdx) => {
    const isRow = g.shape === 'ROW' || g.shape === 'GRID';
    const orderedSeats = [...(g.seats || [])].sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

    if (!isRow) {
      const students = orderedSeats.map(s => seatedStudent(s.id)).filter((s): s is Student => !!s);
      result.push({
        id: g.id,
        name: g.name,
        tableNumber: g.order || gIdx + 1,
        seatIndices: orderedSeats.map(s => s.seatNumber || 0),
        icon: '🧪',
        students,
      });
      return;
    }

    for (let start = 0, deskNo = 1; start < orderedSeats.length; start += DESK_SIZE, deskNo++) {
      const deskSeats = orderedSeats.slice(start, start + DESK_SIZE);
      const students = deskSeats.map(s => seatedStudent(s.id)).filter((s): s is Student => !!s);
      result.push({
        id: `${g.id}__desk${deskNo}`,
        name: `${g.name} · โต๊ะ ${deskNo}`,
        tableNumber: (g.order || gIdx + 1) * 100 + deskNo,
        seatIndices: deskSeats.map(s => s.seatNumber || 0),
        icon: '🪑',
        students,
      });
    }
  });

  return result;
}
