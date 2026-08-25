import { describe, it, expect } from 'vitest';
import { 
  parseScheduleSlots, 
  parsePeriodAndRoom, 
  detectSubjectType, 
  matchTeacherByName,
  matchTeacherByEmail,
  parseTeacherLoadReport,
  generateScheduleDocuments,
  isTeacherLoadReportFormat
} from '../utils/teacherLoadReportParser';

describe('Teacher Load Report Parser (รายงานภาระงานสอน)', () => {
  // Test fixture data matching actual school report rows
  const mockStaffList = [
    {
      id: 'teacher-kiattisak-uid',
      fullName: 'นาย เกียรติศักดิ์ สถิตการุณย์',
      displayName: 'Mr.Kiattisak',
      email: 'kiattisak@utd.ac.th'
    },
    {
      id: 'teacher-somchai-uid',
      fullName: 'นาย สมชาย ใจดี',
      displayName: 'ครูสมชาย',
      email: 'somchai@utd.ac.th'
    }
  ];

  describe('TASK 4: parseScheduleSlots', () => {
    it('parses multi-day comma-separated slots: "อ2, พ4, ฤ1, ศ3" into 4 distinct slots including single-character Thursday (ฤ)', () => {
      const { slots, errors } = parseScheduleSlots('อ2, พ4, ฤ1, ศ3');
      expect(errors).toHaveLength(0);
      expect(slots).toEqual([
        { dayOfWeek: 'tuesday', periodNumber: 2 },
        { dayOfWeek: 'wednesday', periodNumber: 4 },
        { dayOfWeek: 'thursday', periodNumber: 1 },
        { dayOfWeek: 'friday', periodNumber: 3 },
      ]);
    });

    it('expands hyphenated period ranges: "อ3-4" into 2 consecutive period slots', () => {
      const { slots, errors } = parseScheduleSlots('อ3-4');
      expect(errors).toHaveLength(0);
      expect(slots).toEqual([
        { dayOfWeek: 'tuesday', periodNumber: 3 },
        { dayOfWeek: 'tuesday', periodNumber: 4 },
      ]);
    });

    it('accurately preserves period 0 (Homeroom/morning slot): "จ0" without dropping or treating as falsy', () => {
      const { slots, errors } = parseScheduleSlots('จ0');
      expect(errors).toHaveLength(0);
      expect(slots).toEqual([
        { dayOfWeek: 'monday', periodNumber: 0 }
      ]);
    });

    it('handles Homeroom week: "จ0, อ0, พ0, ฤ0, ศ0" with 5 slots of period 0', () => {
      const { slots, errors } = parseScheduleSlots('จ0, อ0, พ0, ฤ0, ศ0');
      expect(errors).toHaveLength(0);
      expect(slots).toHaveLength(5);
      expect(slots).toEqual([
        { dayOfWeek: 'monday', periodNumber: 0 },
        { dayOfWeek: 'tuesday', periodNumber: 0 },
        { dayOfWeek: 'wednesday', periodNumber: 0 },
        { dayOfWeek: 'thursday', periodNumber: 0 },
        { dayOfWeek: 'friday', periodNumber: 0 },
      ]);
    });

    it('handles high period numbers such as period 10: "จ10, อ10, พ10, ศ10"', () => {
      const { slots, errors } = parseScheduleSlots('จ10, อ10, พ10, ศ10');
      expect(errors).toHaveLength(0);
      expect(slots).toEqual([
        { dayOfWeek: 'monday', periodNumber: 10 },
        { dayOfWeek: 'tuesday', periodNumber: 10 },
        { dayOfWeek: 'wednesday', periodNumber: 10 },
        { dayOfWeek: 'friday', periodNumber: 10 },
      ]);
    });

    it('returns empty slots and error message on malformed input', () => {
      const { slots, errors } = parseScheduleSlots('UNKNOWN_DAY_99');
      expect(slots).toHaveLength(0);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('TASK 5: parsePeriodAndRoom', () => {
    it('extracts expected period count and bracketed room code: "4 / [943] HR 5/8"', () => {
      const parsed = parsePeriodAndRoom('4 / [943] HR 5/8');
      expect(parsed.expectedPeriodCount).toBe(4);
      expect(parsed.extractedRoomCode).toBe('943');
      expect(parsed.extractedRoomLabel).toBe('HR 5/8');
      expect(parsed.room).toBe('943');
    });

    it('handles non-room activity entries: "4 / -"', () => {
      const parsed = parsePeriodAndRoom('4 / -');
      expect(parsed.expectedPeriodCount).toBe(4);
      expect(parsed.extractedRoomCode).toBe('');
      expect(parsed.extractedRoomLabel).toBe('');
      expect(parsed.room).toBe('');
    });
  });

  describe('TASK 6: detectSubjectType', () => {
    it('identifies "(กิจกรรม)" suffix as ACTIVITY', () => {
      expect(detectSubjectType('PLC (กิจกรรม)', 'PLC')).toBe('ACTIVITY');
      expect(detectSubjectType('HomeRoom (กิจกรรม)', 'HR')).toBe('ACTIVITY');
      expect(detectSubjectType('กิจกรรมพัฒนาผู้เรียน (ลูกเสือ)', 'ACT01')).toBe('ACTIVITY');
    });

    it('identifies regular academic courses as MAIN', () => {
      expect(detectSubjectType('คณิตศาสตร์เพิ่มเติม', 'ค32201')).toBe('MAIN');
      expect(detectSubjectType('คณิตศาสตร์พื้นฐาน', 'ค32101')).toBe('MAIN');
    });
  });

  describe('TASK 8 & ISSUE 1: Teacher Linkage & Email Matching', () => {
    it('matches teacher by exact email or alias', () => {
      const match1 = matchTeacherByEmail('kiattisak@utd.ac.th', mockStaffList);
      expect(match1?.id).toBe('teacher-kiattisak-uid');

      const match2 = matchTeacherByEmail('kiattika@utd.ac.th', mockStaffList);
      expect(match2?.id).toBe('teacher-kiattisak-uid');
    });

    it('matches teacher by normalized display name and returns real UID and email', () => {
      const matched = matchTeacherByName('Mr.Kiattisak', mockStaffList);
      expect(matched?.id).toBe('teacher-kiattisak-uid');
      expect(matched?.email).toBe('kiattisak@utd.ac.th');
    });

    it('returns undefined when teacher is not found in the system (no fabricated IDs)', () => {
      const matched = matchTeacherByName('Mr. NonExistentTeacher', mockStaffList);
      expect(matched).toBeUndefined();
    });
  });

  describe('Ground Truth Teacher Load Report Integration', () => {
    const rawReportRows = [
      // Row 1: Header Teacher row with explicit 'อีเมล์' column
      {
        'กลุ่มสาระ': 'คณิตศาสตร์',
        'ที่': '1',
        'ชื่อ-สกุล': 'Mr.Kiattisak',
        'อีเมล์': 'kiattika@utd.ac.th',
        'ประจำชั้น': 'M.5/8',
        'ลำดับวิชา': '1',
        'รหัสวิชา': 'ค32201',
        'ชื่อรายวิชา': 'คณิตศาสตร์เพิ่มเติม',
        'คาบ/ห้อง': '4 / [943] HR 5/8',
        'วัน-คาบที่สอน': 'อ2, พ4, ฤ1, ศ3',
        'ระดับ': 'M.5/8',
        'สรุปคาบ': '4'
      },
      // Row 2: Merged subsequent row (blank teacher info -> forward-fill)
      {
        'กลุ่มสาระ': '',
        'ที่': '',
        'ชื่อ-สกุล': '',
        'อีเมล์': '',
        'ประจำชั้น': '',
        'ลำดับวิชา': '2',
        'รหัสวิชา': 'ค32101',
        'ชื่อรายวิชา': 'คณิตศาสตร์พื้นฐาน',
        'คาบ/ห้อง': '2 / [935] HR 5/9',
        'วัน-คาบที่สอน': 'อ3-4',
        'ระดับ': 'M.5/9',
        'สรุปคาบ': '2'
      },
      // Row 3: Activity course (PLC)
      {
        'กลุ่มสาระ': '',
        'ที่': '',
        'ชื่อ-สกุล': '',
        'อีเมล์': '',
        'ประจำชั้น': '',
        'ลำดับวิชา': '6',
        'รหัสวิชา': 'PLC',
        'ชื่อรายวิชา': 'PLC (กิจกรรม)',
        'คาบ/ห้อง': '4 / -',
        'วัน-คาบที่สอน': 'จ10, อ10, พ10, ศ10',
        'ระดับ': 'Non-Student',
        'สรุปคาบ': '4'
      },
      // Row 4: Homeroom activity with period 0
      {
        'กลุ่มสาระ': '',
        'ที่': '',
        'ชื่อ-สกุล': '',
        'อีเมล์': '',
        'ประจำชั้น': '',
        'ลำดับวิชา': '9',
        'รหัสวิชา': 'HR',
        'ชื่อรายวิชา': 'HomeRoom (กิจกรรม)',
        'คาบ/ห้อง': '5 / [943] HR 5/8',
        'วัน-คาบที่สอน': 'จ0, อ0, พ0, ฤ0, ศ0',
        'ระดับ': 'M.5/8',
        'สรุปคาบ': '5'
      },
      // Row 5: Subtotal row (must be skipped)
      {
        'กลุ่มสาระ': '',
        'ที่': '',
        'ชื่อ-สกุล': '',
        'อีเมล์': '',
        'ประจำชั้น': '',
        'ลำดับวิชา': 'รวม',
        'รหัสวิชา': 'รวมคาบสอน',
        'ชื่อรายวิชา': 'รวมคาบสอนทั้งสิ้น',
        'คาบ/ห้อง': '15',
        'วัน-คาบที่สอน': '-',
        'ระดับ': '-',
        'สรุปคาบ': '15'
      },
      // Row 6: Empty teaching load teacher (must be skipped from course documents)
      {
        'กลุ่มสาระ': 'วิทยาศาสตร์และเทคโนโลยี',
        'ที่': '4',
        'ชื่อ-สกุล': 'Mr. Ball',
        'อีเมล์': 'ball@utd.ac.th',
        'ประจำชั้น': 'M.5/6',
        'ลำดับวิชา': '1',
        'รหัสวิชา': '-',
        'ชื่อรายวิชา': '- ไม่มีภาระงานสอน -',
        'คาบ/ห้อง': '-',
        'วัน-คาบที่สอน': '-',
        'ระดับ': '-',
        'สรุปคาบ': '0'
      },
      // Row 7: Unmatched teacher with email and mismatch period count
      {
        'กลุ่มสาระ': 'ภาษาต่างประเทศ',
        'ที่': '5',
        'ชื่อ-สกุล': 'Mr. Unknown Foreigner',
        'อีเมล์': 'foreigner@utd.ac.th',
        'ประจำชั้น': 'M.5/7',
        'ลำดับวิชา': '1',
        'รหัสวิชา': 'EN32101',
        'ชื่อรายวิชา': 'ภาษาอังกฤษ 3',
        'คาบ/ห้อง': '3 / [501] Room 501',
        'วัน-คาบที่สอน': 'อ2, พ4', // Expected 3, but only 2 slots provided!
        'ระดับ': 'M.5/7',
        'สรุปคาบ': '3'
      }
    ];

    it('TASK 1: detects teacher load report format from column headers', () => {
      expect(isTeacherLoadReportFormat(rawReportRows)).toBe(true);
      expect(isTeacherLoadReportFormat([{ 'Course Code': 'TH101', 'Course Name': 'Thai' }])).toBe(false);
    });

    it('TASK 2 & TASK 3 & ISSUE 1: forward-fills teacher identity, uses email for matching, and skips subtotal/empty-load rows', () => {
      const { courseRows } = parseTeacherLoadReport(rawReportRows, mockStaffList);
      
      // Should have 5 valid course rows (Row 1, Row 2, Row 3, Row 4, Row 7). Subtotal (Row 5) and Empty load (Row 6) are skipped.
      expect(courseRows).toHaveLength(5);

      // Row 1
      expect(courseRows[0].teacherName).toBe('Mr.Kiattisak');
      expect(courseRows[0].teacherEmail).toBe('kiattika@utd.ac.th');
      expect(courseRows[0].matchedTeacherId).toBe('teacher-kiattisak-uid');
      expect(courseRows[0].department).toBe('คณิตศาสตร์');
      expect(courseRows[0].homeroom).toBe('M.5/8');
      expect(courseRows[0].subjectCode).toBe('ค32201');

      // Row 2 (Forward-filled teacher info and email)
      expect(courseRows[1].teacherName).toBe('Mr.Kiattisak');
      expect(courseRows[1].teacherEmail).toBe('kiattika@utd.ac.th');
      expect(courseRows[1].matchedTeacherId).toBe('teacher-kiattisak-uid');
      expect(courseRows[1].department).toBe('คณิตศาสตร์');
      expect(courseRows[1].homeroom).toBe('M.5/8');
      expect(courseRows[1].subjectCode).toBe('ค32101');
      expect(courseRows[1].slots).toHaveLength(2);

      // Row 3 (Activity)
      expect(courseRows[2].teacherName).toBe('Mr.Kiattisak');
      expect(courseRows[2].subjectType).toBe('ACTIVITY');
      expect(courseRows[2].room).toBe(''); // No room for PLC

      // Row 4 (Homeroom period 0)
      expect(courseRows[3].subjectType).toBe('ACTIVITY');
      expect(courseRows[3].slots[0]).toEqual({ dayOfWeek: 'monday', periodNumber: 0 });

      // Row 7 (Unmatched teacher with email and mismatch warning)
      expect(courseRows[4].teacherName).toBe('Mr. Unknown Foreigner');
      expect(courseRows[4].teacherEmail).toBe('foreigner@utd.ac.th');
      expect(courseRows[4].matchedTeacherId).toBeUndefined();
      expect(courseRows[4].unlinkedTeacherName).toBe('Mr. Unknown Foreigner');
      expect(courseRows[4].unlinkedTeacherEmail).toBe('foreigner@utd.ac.th');
      expect(courseRows[4].warnings.some(w => w.includes('ไม่ตรงกับวัน-คาบที่สอน'))).toBe(true);
      expect(courseRows[4].warnings.some(w => w.includes('foreigner@utd.ac.th'))).toBe(true);
    });

    it('TASK 7: generates multi-slot Firestore schedule documents for Mr.Kiattisak ค32201 (4 slots expanded)', () => {
      const { courseRows } = parseTeacherLoadReport(rawReportRows, mockStaffList);
      const generatedDocs = generateScheduleDocuments(courseRows);

      // Find documents generated from the first course (ค32201)
      const math201Docs = generatedDocs.filter(d => d.subjectCode === 'ค32201');
      expect(math201Docs).toHaveLength(4);

      expect(math201Docs[0]).toEqual({
        id: 'sch_ค32201_943_tuesday_p2',
        subjectCode: 'ค32201',
        subjectName: 'คณิตศาสตร์เพิ่มเติม',
        room: '943',
        level: 'M.5/8',
        credits: 1.5,
        teacherIds: ['teacher-kiattisak-uid'],
        teacherId: 'teacher-kiattisak-uid',
        teacherEmail: 'kiattisak@utd.ac.th',
        unlinkedTeacherName: null,
        unlinkedTeacherEmail: null,
        subjectType: 'MAIN',
        dayOfWeek: 'tuesday',
        periodNumber: 2,
        sourceTeacherName: 'Mr.Kiattisak',
        department: 'คณิตศาสตร์'
      });

      expect(math201Docs[1].id).toBe('sch_ค32201_943_wednesday_p4');
      expect(math201Docs[2].id).toBe('sch_ค32201_943_thursday_p1');
      expect(math201Docs[3].id).toBe('sch_ค32201_943_friday_p3');
    });

    it('TASK 8: ensures unmatched teacher generates documents with teacherIds: [] and unlinkedTeacherName & unlinkedTeacherEmail populated (NO fabricated IDs)', () => {
      const { courseRows } = parseTeacherLoadReport(rawReportRows, mockStaffList);
      const generatedDocs = generateScheduleDocuments(courseRows);

      const foreignDocs = generatedDocs.filter(d => d.subjectCode === 'EN32101');
      expect(foreignDocs.length).toBeGreaterThan(0);
      for (const doc of foreignDocs) {
        expect(doc.teacherIds).toEqual([]);
        expect(doc.teacherId).toBeNull();
        expect(doc.unlinkedTeacherName).toBe('Mr. Unknown Foreigner');
        expect(doc.unlinkedTeacherEmail).toBe('foreigner@utd.ac.th');
      }
    });
  });
});
