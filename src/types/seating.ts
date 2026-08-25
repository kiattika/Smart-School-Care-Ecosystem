import { Student, AttendanceStatus } from '../types';

export type SeatingCategory = 'CLASSROOM' | 'LABORATORY' | 'OUTDOOR' | 'EXAM' | 'CUSTOM';

export interface SeatingSeat {
  id: string;          // e.g. "seat_1_1"
  groupId?: string;    // parent group id
  seatNumber: number;  // 1-based index within group or global
  relativeRow?: number;
  relativeCol?: number;
  label?: string;      // e.g. "A1", "โต๊ะ 1-1"
  status?: 'ACTIVE' | 'DISABLED';
}

export interface SeatingGroup {
  id: string;          // e.g. "group_1"
  layoutId?: string;   // parent layout id
  name: string;        // e.g. "กลุ่ม 1 (หน้าต่าง)", "โต๊ะแล็บ 1"
  groupIndex?: number; // 0, 1, 2...
  order?: number;      // display order
  capacity: number;    // number of seats in this group
  positionX?: number;  // Canvas X position in px
  positionY?: number;  // Canvas Y position in px
  color?: string;      // Accent theme color
  shape?: 'GRID' | 'ROW' | 'CIRCLE' | 'POD';
  description?: string;
  seats: SeatingSeat[];
}

export interface SeatingLayout {
  id: string;          // e.g. "layout_ว32204_m58"
  name: string;        // e.g. "ผังห้องฟิสิกส์ ม.5/8"
  subjectCode: string;
  room: string;
  teacherId?: string;
  teacherEmail?: string;
  teacherName?: string;
  category: SeatingCategory;
  isTemplate?: boolean;
  isLocked?: boolean;
  totalCapacity: number; // Derived from sum of group capacities
  zoomScale?: number;
  createdAt: string;
  updatedAt: string;
  groups: SeatingGroup[];
}

export interface SeatingAssignment {
  id: string;          // e.g. "assign_std38501_2026-08-25"
  layoutId: string;
  groupId: string;
  seatId: string;
  seatNumber?: number;
  seatLabel?: string;
  groupName?: string;
  studentId: string;
  studentName?: string;
  studentNo?: number;
  parentUid?: string;
  effectiveFrom: string; // ISO string
  effectiveTo: string | null; // ISO string or null if currently active
  assignedBy?: string;
  room?: string;
  subjectCode?: string;
  reason?: string;
  createdAt?: string;
}

export interface ClassroomDeskGroupForPicker {
  id: string;
  name: string;
  tableNumber: number;
  icon?: string;
  seatIndices?: number[];
  seats?: SeatingSeat[];
  students: Student[];
}
