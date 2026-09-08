import { describe, it, expect } from 'vitest';
import { detectClubSlotsForTeacher, mergeClubSlotCandidates, ScheduleDocLite } from '../lib/electiveClubDetection';

describe('electiveClubDetection — ตรวจจับวัน/คาบชุมนุมจากตารางสอนจริง (ไม่ใช่แอดมินกำหนดเอง)', () => {
  describe('detectClubSlotsForTeacher', () => {
    it('ครูทั่วไป: พบคาบชุมนุมวันพฤหัสฯ คาบ 7-8 (ติดกัน) รวมเป็นช่วงเดียว', () => {
      const schedules: ScheduleDocLite[] = [
        { teacherId: 't1', dayOfWeek: 'thursday', periodNumber: 7, subjectName: 'กิจกรรมชุมนุม', room: '521' },
        { teacherId: 't1', dayOfWeek: 'thursday', periodNumber: 8, subjectName: 'กิจกรรมชุมนุม', room: '521' },
        // วิชาการปกติ ไม่ใช่ชุมนุม — ต้องไม่ปนมาด้วย
        { teacherId: 't1', dayOfWeek: 'monday', periodNumber: 3, subjectName: 'คณิตศาสตร์พื้นฐาน', room: '943' },
      ];
      const slots = detectClubSlotsForTeacher(schedules, 't1');
      expect(slots).toEqual([{ dayOfWeek: 'thursday', periodStart: 7, periodEnd: 8, room: '521' }]);
    });

    it('ครูสอน นศท: คาบยาวกว่าคนอื่น 7-9 (3 คาบติดกัน) ต้องตรวจจับครบไม่ตัดคาบ 9 หาย', () => {
      const schedules: ScheduleDocLite[] = [
        { teacherId: 't2', dayOfWeek: 'thursday', periodNumber: 7, subjectName: 'ชุมนุมนักศึกษาวิชาทหาร', room: '521' },
        { teacherId: 't2', dayOfWeek: 'thursday', periodNumber: 8, subjectName: 'ชุมนุมนักศึกษาวิชาทหาร', room: '521' },
        { teacherId: 't2', dayOfWeek: 'thursday', periodNumber: 9, subjectName: 'ชุมนุมนักศึกษาวิชาทหาร', room: '521' },
      ];
      const slots = detectClubSlotsForTeacher(schedules, 't2');
      expect(slots).toEqual([{ dayOfWeek: 'thursday', periodStart: 7, periodEnd: 9, room: '521' }]);
    });

    it('ครูที่ไม่มีคาบชุมนุมในตารางสอนเลย — คืน array ว่าง (ไม่ throw, ไม่ fabricate)', () => {
      const schedules: ScheduleDocLite[] = [
        { teacherId: 't3', dayOfWeek: 'monday', periodNumber: 1, subjectName: 'ภาษาอังกฤษ', room: '101' },
      ];
      expect(detectClubSlotsForTeacher(schedules, 't3')).toEqual([]);
      expect(detectClubSlotsForTeacher(schedules, 'not-a-real-teacher')).toEqual([]);
    });

    it('จับคู่ผ่าน teacherIds array ได้ด้วย (ครูร่วมสอน — TASK 3)', () => {
      const schedules: ScheduleDocLite[] = [
        { teacherIds: ['t4', 't5'], dayOfWeek: 'thursday', periodNumber: 7, subjectName: 'กิจกรรมชุมนุม', room: '521' },
        { teacherIds: ['t4', 't5'], dayOfWeek: 'thursday', periodNumber: 8, subjectName: 'กิจกรรมชุมนุม', room: '521' },
      ];
      expect(detectClubSlotsForTeacher(schedules, 't4')).toEqual([{ dayOfWeek: 'thursday', periodStart: 7, periodEnd: 8, room: '521' }]);
      expect(detectClubSlotsForTeacher(schedules, 't5')).toEqual([{ dayOfWeek: 'thursday', periodStart: 7, periodEnd: 8, room: '521' }]);
    });

    it('คาบไม่ติดกัน (ช่องว่างตรงกลาง) ต้องแยกเป็นคนละช่วง ไม่รวมข้ามช่องว่าง', () => {
      const schedules: ScheduleDocLite[] = [
        { teacherId: 't6', dayOfWeek: 'thursday', periodNumber: 7, subjectName: 'กิจกรรมชุมนุม', room: '521' },
        // คาบ 8 ไม่มี (สมมติมีคาบอื่นคั่น) — คาบ 9 ไม่ควรรวมกับ 7
        { teacherId: 't6', dayOfWeek: 'thursday', periodNumber: 9, subjectName: 'กิจกรรมชุมนุม', room: '521' },
      ];
      const slots = detectClubSlotsForTeacher(schedules, 't6');
      expect(slots).toEqual([
        { dayOfWeek: 'thursday', periodStart: 7, periodEnd: 7, room: '521' },
        { dayOfWeek: 'thursday', periodStart: 9, periodEnd: 9, room: '521' },
      ]);
    });

    it('ไม่จับ ACTIVITY ประเภทอื่นที่ไม่ใช่ชุมนุม (PLC/โฮมรูม/แนะแนว)', () => {
      const schedules: ScheduleDocLite[] = [
        { teacherId: 't7', dayOfWeek: 'wednesday', periodNumber: 8, subjectName: 'PLC', room: '' },
        { teacherId: 't7', dayOfWeek: 'monday', periodNumber: 0, subjectName: 'HomeRoom (กิจกรรม)', room: '943' },
      ];
      expect(detectClubSlotsForTeacher(schedules, 't7')).toEqual([]);
    });
  });

  describe('mergeClubSlotCandidates', () => {
    it('ครูรับผิดชอบหลายคนมีคาบชุมนุมตรงกันเป๊ะ — รวมเป็น candidate เดียว มีชื่อครูครบทุกคน', () => {
      const merged = mergeClubSlotCandidates([
        { uid: 't1', slots: [{ dayOfWeek: 'thursday', periodStart: 7, periodEnd: 8, room: '521' }] },
        { uid: 't2', slots: [{ dayOfWeek: 'thursday', periodStart: 7, periodEnd: 8, room: '521' }] },
      ]);
      expect(merged).toEqual([
        { dayOfWeek: 'thursday', periodStart: 7, periodEnd: 8, room: '521', teacherUids: ['t1', 't2'] },
      ]);
    });

    it('ครูรับผิดชอบคนละเวลากัน — ต้องได้ candidate แยกกัน ให้แอดมินเลือก', () => {
      const merged = mergeClubSlotCandidates([
        { uid: 't1', slots: [{ dayOfWeek: 'thursday', periodStart: 7, periodEnd: 8, room: '521' }] },
        { uid: 't2', slots: [{ dayOfWeek: 'thursday', periodStart: 7, periodEnd: 9, room: '521' }] }, // นศท
      ]);
      expect(merged).toHaveLength(2);
      expect(merged.find(c => c.periodEnd === 8)?.teacherUids).toEqual(['t1']);
      expect(merged.find(c => c.periodEnd === 9)?.teacherUids).toEqual(['t2']);
    });

    it('ไม่มีครูคนไหนมีคาบชุมนุมเลย — คืน array ว่าง', () => {
      expect(mergeClubSlotCandidates([{ uid: 't1', slots: [] }, { uid: 't2', slots: [] }])).toEqual([]);
    });
  });
});
