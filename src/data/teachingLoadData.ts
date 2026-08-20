export interface TeachingSubject {
  order: number;
  subjectCode: string;
  subjectName: string;
  periodsPerWeek: number;
  room: string;
  schedule: string;
  level: string;
  totalPeriods: number;
}

export interface TeacherTeachingLoad {
  id: number;
  department: string;
  teacherName: string;
  teacherEmail?: string;
  homeroom: string;
  subjects: TeachingSubject[];
  totalMainPeriods: number;
  totalActivityPeriods: number;
  totalPeriods: number;
}

export const TEACHING_LOAD_DATA: TeacherTeachingLoad[] = [
  {
    id: 1,
    department: "สุขศึกษาและพลศึกษา",
    teacherName: "Dr. Smith",
    teacherEmail: "smith@utd.ac.th",
    homeroom: "M.2/10",
    subjects: [],
    totalMainPeriods: 0,
    totalActivityPeriods: 0,
    totalPeriods: 0
  },
  {
    id: 2,
    department: "ภาษาต่างประเทศ",
    teacherName: "Ms. Jones",
    teacherEmail: "jones@utd.ac.th",
    homeroom: "M.1/3",
    subjects: [
      {
        order: 1,
        subjectCode: "MTH101",
        subjectName: "Mathematics",
        periodsPerWeek: 1,
        room: "[946] ศูนย์คณิตศาสตร์",
        schedule: "จ2",
        level: "M.1/1",
        totalPeriods: 1
      }
    ],
    totalMainPeriods: 1,
    totalActivityPeriods: 0,
    totalPeriods: 1
  },
  {
    id: 3,
    department: "วิทยาศาสตร์และเทคโนโลยี",
    teacherName: "Mr. Ball",
    teacherEmail: "ball@utd.ac.th",
    homeroom: "M.5/7",
    subjects: [
      {
        order: 1,
        subjectCode: "CZ",
        subjectName: "Cleaning Zone (กิจกรรม)",
        periodsPerWeek: 2,
        room: "[946] ศูนย์คณิตศาสตร์",
        schedule: "จ8-9",
        level: "M.5",
        totalPeriods: 2
      }
    ],
    totalMainPeriods: 0,
    totalActivityPeriods: 2,
    totalPeriods: 2
  },
  {
    id: 4,
    department: "คณิตศาสตร์",
    teacherName: "Mr. Kiattisak",
    teacherEmail: "kiattisak@utd.ac.th",
    homeroom: "M.5/8",
    subjects: [
      {
        order: 1,
        subjectCode: "ค32201",
        subjectName: "คณิตศาสตร์เพิ่มเติม",
        periodsPerWeek: 4,
        room: "[943] HR 5/8",
        schedule: "อ2, พ4, ฤ1, ศ3",
        level: "M.5/8",
        totalPeriods: 4
      },
      {
        order: 2,
        subjectCode: "ค32101",
        subjectName: "คณิตศาสตร์พื้นฐาน",
        periodsPerWeek: 2,
        room: "[935] HR 5/9",
        schedule: "อ3-4",
        level: "M.5/9",
        totalPeriods: 2
      },
      {
        order: 3,
        subjectCode: "ค32201",
        subjectName: "คณิตศาสตร์เพิ่มเติม",
        periodsPerWeek: 4,
        room: "[935] HR 5/9",
        schedule: "จ1, พ8, ฤ2, ศ2",
        level: "M.5/9",
        totalPeriods: 4
      },
      {
        order: 4,
        subjectCode: "ค32101",
        subjectName: "คณิตศาสตร์พื้นฐาน",
        periodsPerWeek: 2,
        room: "[334] HR 5/11",
        schedule: "อ6, ศ1",
        level: "M.5/11",
        totalPeriods: 2
      },
      {
        order: 5,
        subjectCode: "ค32101",
        subjectName: "คณิตศาสตร์พื้นฐาน",
        periodsPerWeek: 2,
        room: "[943] HR 5/8",
        schedule: "จ6-7",
        level: "M.5/8",
        totalPeriods: 2
      },
      {
        order: 6,
        subjectCode: "HR",
        subjectName: "HomeRoom (กิจกรรม)",
        periodsPerWeek: 5,
        room: "[943] HR 5/8",
        schedule: "จ0, อ0, พ0, ฤ0, ศ0",
        level: "M.5/8",
        totalPeriods: 5
      },
      {
        order: 7,
        subjectCode: "CZ",
        subjectName: "Cleaning Zone (กิจกรรม)",
        periodsPerWeek: 2,
        room: "[946] ศูนย์คณิตศาสตร์",
        schedule: "จ8-9",
        level: "M.5",
        totalPeriods: 2
      }
    ],
    totalMainPeriods: 14,
    totalActivityPeriods: 7,
    totalPeriods: 21
  },
  {
    id: 5,
    department: "คณิตศาสตร์",
    teacherName: "Mrs. Koy K.",
    teacherEmail: "koy@utd.ac.th",
    homeroom: "M.5/8",
    subjects: [
      {
        order: 1,
        subjectCode: "HR",
        subjectName: "HomeRoom (กิจกรรม)",
        periodsPerWeek: 5,
        room: "[943] HR 5/8",
        schedule: "จ0, อ0, พ0, ฤ0, ศ0",
        level: "M.5/8",
        totalPeriods: 5
      },
      {
        order: 2,
        subjectCode: "CZ",
        subjectName: "Cleaning Zone (กิจกรรม)",
        periodsPerWeek: 2,
        room: "[946] ศูนย์คณิตศาสตร์",
        schedule: "จ8-9",
        level: "M.5",
        totalPeriods: 2
      }
    ],
    totalMainPeriods: 0,
    totalActivityPeriods: 7,
    totalPeriods: 7
  },
  {
    id: 6,
    department: "วิทยาศาสตร์และเทคโนโลยี",
    teacherName: "Mrs. Noi N.",
    teacherEmail: "noi@utd.ac.th",
    homeroom: "M.4/4",
    subjects: [],
    totalMainPeriods: 0,
    totalActivityPeriods: 0,
    totalPeriods: 0
  }
];

// Helper to convert Teaching Load data into GlobalCourse list for app schedule integration
export function convertTeachingLoadToGlobalCourses(): import('../types').GlobalCourse[] {
  const globalCourses: import('../types').GlobalCourse[] = [];
  
  TEACHING_LOAD_DATA.forEach(teacher => {
    const email = teacher.teacherEmail || `${teacher.teacherName.toLowerCase().replace(/[^a-z0-9]/g, '')}@utd.ac.th`;
    teacher.subjects.forEach((subj, idx) => {
      globalCourses.push({
        courseId: `GC-${teacher.id}-${subj.order}-${subj.subjectCode}`,
        code: subj.subjectCode,
        courseName: subj.subjectName,
        teacherName: teacher.teacherName,
        teacherEmail: email,
        roomName: subj.level || teacher.homeroom,
        scheduleString: subj.schedule,
        level: subj.level
      });
    });
  });

  return globalCourses;
}
