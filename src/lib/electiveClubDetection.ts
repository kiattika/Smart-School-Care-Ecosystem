/**
 * ตรวจจับวัน/คาบของ "คาบกิจกรรมชุมนุม" จากตารางสอนจริงที่ import มา (schedules) — ตรรกะบริสุทธิ์
 * (แยกออกมาให้ test ได้) ใช้โดย ElectiveActivityManagerPage.tsx
 *
 * ยืนยันจากโรงเรียนแล้ว: วัน/คาบชุมนุมไม่ใช่สิ่งที่แอดมินกำหนดเอง — ครูทุกคนที่สอน ม.4-6 มีคาบ
 * "กิจกรรมชุมนุม" วันพฤหัสฯ คาบ 7-8 เหมือนกันหมด (import มาจริงจากไฟล์ภาระงานสอน) ยกเว้นครูที่สอน
 * นศท (ชุมนุมนักศึกษาวิชาทหาร) จะมีคาบยาวกว่า 7-9 — ต้องดึงจาก schedules ของครูรับผิดชอบที่แอดมิน
 * เลือกไว้ ไม่ใช่ให้พิมพ์เอง
 *
 * ใช้ keyword เดียวกับที่ detectSubjectType (teacherLoadReportParser.ts) ใช้จำแนกแถว "ชุมนุม" เป็น
 * ACTIVITY (cleanName.includes('ชุมนุม')) — ตรวจสอบ subjectName ตรงๆ แทนที่จะพึ่ง subjectType เพราะ
 * ACTIVITY มีหลายประเภท (PLC/โฮมรูม/ลูกเสือ/แนะแนว ฯลฯ) ไม่ใช่แค่ชุมนุม
 */

export interface ScheduleDocLite {
  teacherId?: string | null;
  teacherIds?: string[] | null;
  dayOfWeek?: string | null;
  periodNumber?: number | null;
  subjectName?: string | null;
  room?: string | null;
}

export interface ClubScheduleSlot {
  dayOfWeek: string;
  periodStart: number;
  periodEnd: number; // เท่ากับ periodStart ถ้าเป็นคาบเดียว
  room: string;
}

export interface ClubScheduleCandidate extends ClubScheduleSlot {
  teacherUids: string[]; // ครูรับผิดชอบที่มีคาบนี้ตรงกัน (อาจมากกว่า 1 คนถ้าคาบตรงกันพอดี)
}

const isClubSubject = (subjectName?: string | null): boolean =>
  typeof subjectName === 'string' && subjectName.includes('ชุมนุม');

const teachesSchedule = (s: ScheduleDocLite, teacherUid: string): boolean =>
  s.teacherId === teacherUid || (Array.isArray(s.teacherIds) && s.teacherIds.includes(teacherUid));

/**
 * ตรวจจับคาบชุมนุมของครูคนหนึ่งจากตารางสอนจริง — จัดกลุ่มคาบที่ติดกันในวันเดียวกัน (เช่น 7,8,9)
 * เป็นช่วงเดียว periodStart..periodEnd แทนที่จะแยกเป็นคาบเดี่ยวๆ หลายรายการ
 */
export function detectClubSlotsForTeacher(schedules: ScheduleDocLite[], teacherUid: string): ClubScheduleSlot[] {
  const matched = schedules.filter(s =>
    teachesSchedule(s, teacherUid) &&
    isClubSubject(s.subjectName) &&
    typeof s.periodNumber === 'number' &&
    !!s.dayOfWeek
  );

  const byDay = new Map<string, { periodNumber: number; room: string }[]>();
  matched.forEach(s => {
    const day = s.dayOfWeek as string;
    const list = byDay.get(day) || [];
    list.push({ periodNumber: s.periodNumber as number, room: s.room || '' });
    byDay.set(day, list);
  });

  const slots: ClubScheduleSlot[] = [];
  byDay.forEach((items, dayOfWeek) => {
    const sorted = [...items].sort((a, b) => a.periodNumber - b.periodNumber);
    let run: typeof sorted = [];
    const flush = () => {
      if (run.length === 0) return;
      slots.push({
        dayOfWeek,
        periodStart: run[0].periodNumber,
        periodEnd: run[run.length - 1].periodNumber,
        room: run[0].room,
      });
      run = [];
    };
    sorted.forEach(item => {
      if (run.length > 0 && item.periodNumber !== run[run.length - 1].periodNumber + 1) {
        flush();
      }
      run.push(item);
    });
    flush();
  });

  return slots.sort((a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.periodStart - b.periodStart);
}

/**
 * รวมผลตรวจจับของครูรับผิดชอบหลายคนเข้าด้วยกัน — คืนช่วงคาบที่ไม่ซ้ำกัน (unique day+period range+room)
 * พร้อมรายชื่อ uid ครูที่มีคาบนี้ตรงกันแนบไว้ ใช้แสดงให้แอดมินเลือกเมื่อครูแต่ละคนมีคาบชุมนุมคนละเวลากัน
 */
export function mergeClubSlotCandidates(
  perTeacherSlots: Array<{ uid: string; slots: ClubScheduleSlot[] }>
): ClubScheduleCandidate[] {
  const map = new Map<string, ClubScheduleCandidate>();
  perTeacherSlots.forEach(({ uid, slots }) => {
    slots.forEach(slot => {
      const key = `${slot.dayOfWeek}_${slot.periodStart}_${slot.periodEnd}_${slot.room}`;
      const existing = map.get(key);
      if (existing) {
        if (!existing.teacherUids.includes(uid)) existing.teacherUids.push(uid);
      } else {
        map.set(key, { ...slot, teacherUids: [uid] });
      }
    });
  });
  return Array.from(map.values()).sort(
    (a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.periodStart - b.periodStart
  );
}
