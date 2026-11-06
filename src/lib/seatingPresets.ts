/**
 * แม่แบบผังที่นั่งมาตรฐาน — ข้อมูลแสดงผลในหน้าเลือกแม่แบบ (TemplatePickerModal)
 * โครงกลุ่ม/ที่นั่งจริงที่สร้างลงผังอยู่ใน `handleApplyTemplate` ของ ClassroomSeatingManager (id ต้องตรงกัน)
 * `preview` = ภาพย่อสี่เหลี่ยม: แต่ละกลุ่มมีจำนวนที่นั่ง (count) และจำนวนคอลัมน์ (cols) ที่ใช้วาดเรียงเป็นตาราง
 * ผลรวม count ของ preview ต้องเท่ากับ totalCapacity (มีเทสต์ตรวจ)
 */
export interface SeatingPresetPreviewGroup {
  count: number;
  cols: number;
}

export interface SeatingPreset {
  id: string;
  name: string;
  category: string;
  totalCapacity: number;
  description: string;
  groupsCount: number;
  preview: SeatingPresetPreviewGroup[];
}

export const SEATING_PRESETS: SeatingPreset[] = [
  {
    id: 'preset_standard_40',
    name: 'แถวคู่มาตรฐาน (4 แถวคู่ 40 ที่นั่ง)',
    category: 'CLASSROOM',
    totalCapacity: 40,
    description: 'จัดโต๊ะ 4 คู่แถวยาว (แถวละ 10 คน) เหมาะสำหรับห้องเรียนทั่วไป ม.4 - ม.6',
    groupsCount: 4,
    preview: Array.from({ length: 4 }, () => ({ count: 10, cols: 2 })),
  },
  {
    id: 'preset_double_5_40',
    name: 'แถวคู่ 5 แถว (5 แถวคู่ 40 ที่นั่ง)',
    category: 'CLASSROOM',
    totalCapacity: 40,
    description: 'จัดโต๊ะ 5 คู่แถว (แถวละ 8 คน) ห้องกว้างขึ้น แถวสั้นลง เหมาะกับห้องที่มีนักเรียนราว 40 คน',
    groupsCount: 5,
    preview: Array.from({ length: 5 }, () => ({ count: 8, cols: 2 })),
  },
  {
    id: 'preset_lab_pods_36',
    name: 'โต๊ะแล็บทดลอง (6 กลุ่ม x 6 ที่นั่ง = 36 คน)',
    category: 'LAB',
    totalCapacity: 36,
    description: 'แบ่ง 6 กลุ่ม โต๊ะสี่เหลี่ยมหันหน้าเข้าหากัน สำหรับคาบแล็บวิทย์ ฟิสิกส์ เคมี ชีวะ',
    groupsCount: 6,
    preview: Array.from({ length: 6 }, () => ({ count: 6, cols: 3 })),
  },
  {
    id: 'preset_large_groups_40',
    name: 'กลุ่มแล็บใหญ่ (8 กลุ่ม x 5 ที่นั่ง = 40 คน)',
    category: 'ACTIVE_LEARNING',
    totalCapacity: 40,
    description: 'แบ่ง 8 กลุ่มย่อย สำหรับกิจกรรม Active Learning และการทำงานโครงงาน',
    groupsCount: 8,
    preview: Array.from({ length: 8 }, () => ({ count: 5, cols: 3 })),
  },
  {
    id: 'preset_u_shape_32',
    name: 'จัดโต๊ะรูปตัว U / เกือกม้า (32 ที่นั่ง)',
    category: 'SEMINAR',
    totalCapacity: 32,
    description: 'จัดโต๊ะล้อมรอบเวทีกลาง สำหรับการนำเสนอ สัมมนา และอภิปราย',
    groupsCount: 3,
    preview: [{ count: 10, cols: 1 }, { count: 12, cols: 6 }, { count: 10, cols: 1 }],
  },
  {
    id: 'preset_exam_grid_40',
    name: 'โต๊ะสอบแถวเดี่ยวแยกอิสระ (5 แถว x 8 ที่นั่ง = 40 คน)',
    category: 'EXAM',
    totalCapacity: 40,
    description: 'แถวเดี่ยวระยะห่างมาตรฐาน สำหรับการสอบกลางภาค / ปลายภาค ป้องกันการทุจริต',
    groupsCount: 5,
    preview: Array.from({ length: 5 }, () => ({ count: 8, cols: 1 })),
  },
];
