import { REAL_STUDENTS } from './realStudents';
import { Course, LeaveRequest, AttendanceStatus, Student } from '../types';

const mapToStudent = (s: any, index: number, defaultRoom: string): Student => {
  let studentNo = index + 1;
  const matchNo = s.name.match(/เลขที่\s*(\d+)/);
  if (matchNo) {
    studentNo = parseInt(matchNo[1], 10);
  }

  let nickname = "";
  let fullName = "";
  const cleanedName = s.name.replace(/\(.*\)/g, "").trim();
  const parts = cleanedName.split(/\s+/);
  
  if (parts.length >= 3) {
    nickname = parts[2];
    fullName = `${parts[0]} ${parts[1]}`;
  } else if (parts.length === 2) {
    if (parts[0].includes(".") && parts[1]) {
      fullName = `${parts[0]} ${parts[1]}`;
      nickname = parts[1].substring(0, 3);
    } else {
      fullName = s.name;
      nickname = parts[1] || "นักเรียน";
    }
  } else {
    fullName = s.name;
    nickname = "นักเรียน";
  }

  if (s.studentId === '55001') { nickname = "นิว"; fullName = "นาย ณัฐภัทร ใจมั่น"; }
  else if (s.studentId === '55002') { nickname = "ปิม"; fullName = "นางสาว ปิยะธิดา ปิมปา"; }
  else if (s.studentId === '55003') { nickname = "เบส"; fullName = "นาย ปรเมษฐ์ มีสุข"; }
  else if (s.studentId === '55004') { nickname = "บุ้ง"; fullName = "นางสาว ณิชารีย์ บุญเกิด"; }
  else if (s.studentId === '55005') { nickname = "รุต"; fullName = "นาย ศิรวิทย์ แก้วงาม"; }
  else if (s.studentId === '55006') { nickname = "ไกด์"; fullName = "นาย ธีรภัทร อุดมฤทธิ์"; }
  else if (s.studentId === '55007') { nickname = "อัลต้า"; fullName = "นาย อัครพล รุ่งเรือง"; }
  else if (s.studentId === '55008') { nickname = "เดียร์"; fullName = "นางสาว พิชชาภา นวลตา"; }
  else if (s.studentId === '55009') { nickname = "เพียง"; fullName = "นางสาว เพียงฟ้า แสงทอง"; }
  else if (s.studentId === '55010') { nickname = "แก้ม"; fullName = "นางสาว กานต์พิชชา วงศ์ใหญ่"; }
  else if (s.studentId === '55011') { nickname = "ก้อง"; fullName = "นาย วรวุฒิ ยอดรัก"; }
  else if (s.studentId === '55012') { nickname = "แพรว"; fullName = "นางสาว ศรัญญา ปัญญาดี"; }
  else if (s.studentId === '55013') { nickname = "นนท์"; fullName = "นาย อิทธิพัทธ์ ประเสริฐ"; }
  else if (s.studentId === '55014') { nickname = "ออย"; fullName = "นางสาว ชลลดา ใจงาม"; }
  else if (s.studentId === '55015') { nickname = "โต้ง"; fullName = "นาย วีรพงศ์ อภิบาล"; }
  else if (s.studentId === '55016') { nickname = "มายด์"; fullName = "นางสาว มนัสชนก ยอดแก้ว"; }
  else if (s.studentId === '55017') { nickname = "พีท"; fullName = "นาย ชัชวาล มั่นคง"; }
  else if (s.studentId === '55018') { nickname = "เจน"; fullName = "นางสาว จิรภา มีโชค"; }
  else if (s.studentId === '55019') { nickname = "มาร์ค"; fullName = "นาย ณภัทร ทวีโชค"; }
  else if (s.studentId === '55020') { nickname = "เนย"; fullName = "นางสาว นภัสสร รักสงบ"; }
  else if (s.studentId === '55021') { nickname = "ดิว"; fullName = "นาย พลรักษ์ ศรีสรรค์"; }
  else if (s.studentId === '55022') { nickname = "แอน"; fullName = "นางสาว อนิสา ชูใจ"; }
  else if (s.studentId === '55023') { nickname = "แบงก์"; fullName = "นาย ฐิติพงศ์ ว่องไว"; }
  else if (s.studentId === '55024') { nickname = "ฝน"; fullName = "นางสาว สุนิสา พรทวี"; }
  else if (s.studentId === '55025') { nickname = "นัท"; fullName = "นาย ณัฐวุฒิ ลาดใหญ่"; }
  else if (s.studentId === '55026') { nickname = "พลอย"; fullName = "นางสาว รินรดา ยิ้มแย้ม"; }
  else if (s.studentId === '55027') { nickname = "โอม"; fullName = "นาย ชินดนัย มีเกียรติ"; }
  else if (s.studentId === '55028') { nickname = "บิว"; fullName = "นางสาว เบญจวรรณ เจริญผล"; }
  else if (s.studentId === '55029') { nickname = "อาร์ม"; fullName = "นาย เจษฎา แสงเพชร"; }
  else if (s.studentId === '55030') { nickname = "นุ่น"; fullName = "นางสาว นารีรัตน์ แก้วสว่าง"; }
  else if (s.studentId === '55031') { nickname = "ท็อป"; fullName = "นาย กฤษฎา สุวรรณ"; }
  else if (s.studentId === '55032') { nickname = "กิ๊ฟ"; fullName = "นางสาว วรัญญา รุ่งโรจน์"; }
  else if (s.studentId === '55033') { nickname = "มิกซ์"; fullName = "นาย นพพล คมวิทย์"; }
  else if (s.studentId === '55034') { nickname = "แนน"; fullName = "นางสาว ธนพร สุขเกษม"; }
  else if (s.studentId === '55035') { nickname = "เต้"; fullName = "นาย ศรัณย์ แสนสง่า"; }
  else if (s.studentId === '55036') { nickname = "เมย์"; fullName = "นางสาว เมธาวี ลีลา"; }
  else if (s.studentId === '55037') { nickname = "ปอนด์"; fullName = "นาย ปองพล ใจสัตย์"; }
  else if (s.studentId === '55038') { nickname = "โบว์"; fullName = "นางสาว อารียา แก่นแก้ว"; }
  else if (s.studentId === '55039') { nickname = "นิวเยียร์"; fullName = "นาย จิรทีปต์ อรุณแสง"; }
  else if (s.studentId === '55040') { nickname = "ชมพู่"; fullName = "นางสาว ชญานิษฐ์ พุ่มประดับ"; }

  if (s.studentId === '54001') { nickname = "สมชาย"; fullName = "ด.ช. สมชาย ใจดี"; }
  else if (s.studentId === '54002') { nickname = "สมหญิง"; fullName = "ด.ญ. สมหญิง รักเรียน"; }
  else if (s.studentId === '54003') { nickname = "มานะ"; fullName = "ด.ช. มานะ อดทน"; }
  else if (s.studentId === '54004') { nickname = "ปิติ"; fullName = "ด.ญ. ปิติ ยินดี"; }
  else if (s.studentId === '54005') { nickname = "ชูใจ"; fullName = "ด.ช. ชูใจ ไพศาล"; }

  const latOffset = (index % 7 - 3) * 0.007;
  const lngOffset = (index % 5 - 2) * 0.007;
  const coordinates: [number, number] = [
    17.62514 + latOffset,
    100.09315 + lngOffset
  ];

  const districts = ["ในเมือง", "ท่าเสา", "ป่าเซ่า", "ทุ่งยั้ง", "งิ้วงาม"];
  const district = districts[index % districts.length];

  const routeImages = [
    "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80"
  ];
  const routeImage = routeImages[index % routeImages.length];

  const states: Array<'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE'> = ['PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'LEAVE', 'PRESENT', 'PRESENT', 'ABSENT', 'PRESENT', 'PRESENT'];
  const morningStatus = states[index % states.length];

  const methods: Array<'SCAN' | 'GEOFENCE' | 'MANUAL' | null> = ['SCAN', 'GEOFENCE', 'SCAN', 'SCAN', null, 'SCAN', 'GEOFENCE', null, 'SCAN', 'GEOFENCE'];
  const checkInMethod = morningStatus === 'ABSENT' || morningStatus === 'LEAVE' ? null : methods[index % methods.length];

  const checkInTime = morningStatus === 'ABSENT' || morningStatus === 'LEAVE'
    ? null
    : morningStatus === 'LATE'
      ? `07:${45 + (index % 10)} น.`
      : `07:${30 + (index % 14)} น.`;

  return {
    id: s.id,
    studentId: s.studentId,
    name: fullName,
    avatar: s.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${nickname}`,
    seatIndex: s.seatIndex,
    room: s.room || defaultRoom,
    studentNo,
    fullName,
    nickname,
    photoUrl: s.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${nickname}`,
    homeLocation: {
      address: `${Math.floor((index * 13) % 150) + 1}/${Math.floor((index * 7) % 15) + 1} หมู่ ${Math.floor((index * 3) % 10) + 1} ต.${district} อ.เมือง จ.อุตรดิตถ์`,
      coordinates,
      routeImage
    },
    attendance: {
      morningStatus,
      checkInMethod,
      checkInTime
    }
  };
};

export const teacherKiattisakData = {
  id: "teacher_kiattisak",
  name: "Mr.Kiattisak",
  department: "คณิตศาสตร์",
  homeroomClass: "M.5/8",
  totalPeriods: 27,
  courses: [
    {
      courseCode: "ค32201",
      courseName: "คณิตศาสตร์เพิ่มเติม",
      targetClass: "M.5/8",
      periodsPerWeek: 4,
      schedule: ["อ2", "พ4", "ฤ1", "ศ3"],
      room: "943",
      type: "ACADEMIC"
    },
    {
      courseCode: "ค32101",
      courseName: "คณิตศาสตร์พื้นฐาน",
      targetClass: "M.5/9",
      periodsPerWeek: 2,
      schedule: ["อ3", "อ4"],
      room: "935",
      type: "ACADEMIC"
    },
    {
      courseCode: "ค32201",
      courseName: "คณิตศาสตร์เพิ่มเติม",
      targetClass: "M.5/9",
      periodsPerWeek: 4,
      schedule: ["จ1", "พ8", "ฤ2", "ศ2"],
      room: "935",
      type: "ACADEMIC"
    },
    {
      courseCode: "ค32101",
      courseName: "คณิตศาสตร์พื้นฐาน",
      targetClass: "M.5/11",
      periodsPerWeek: 2,
      schedule: ["อ6", "ศ1"],
      room: "334",
      type: "ACADEMIC"
    },
    {
      courseCode: "ค32101",
      courseName: "คณิตศาสตร์พื้นฐาน",
      targetClass: "M.5/8",
      periodsPerWeek: 2,
      schedule: ["จ6", "จ7"],
      room: "943",
      type: "ACADEMIC"
    },
    {
      courseCode: "ส30223",
      courseName: "การป้องกันการทุจริต",
      targetClass: "M.5/8",
      periodsPerWeek: 1,
      schedule: ["ฤ6"],
      room: "943",
      type: "ACADEMIC"
    }
  ],
  activities: [
    { code: "HR", name: "HomeRoom (กิจกรรม)", targetClass: "M.5/8", periods: 5, schedule: ["จ0", "อ0", "พ0", "ฤ0", "ศ0"] },
    { code: "PLC", name: "PLC (กิจกรรม)", targetClass: "-", periods: 4, schedule: ["จ10", "อ10", "พ10", "ศ10"] },
    { code: "CZ", name: "Cleaning Zone (กิจกรรม)", targetClass: "M.5/8", periods: 2, schedule: ["จ9", "อ9"] },
    { code: "กก-สธ", name: "กิจกรรมสาธารณะประโยชน์ (กิจกรรม)", targetClass: "M.5/8", periods: 1, schedule: ["ฤ9"] },
    { code: "ส30223", name: "ป้องกันการทุจริต (กิจกรรม)", targetClass: "M.5/8", periods: 1, schedule: ["ฤ6"] }
  ]
};

const kiattisakCourses: Course[] = teacherKiattisakData.courses.map((c, i) => ({
  id: `kiattisak-${i}`,
  code: c.courseCode,
  name: c.courseName,
  room: c.targetClass,
  term: '1/2569',
  studentsCount: 40,
  schedule: c.schedule.join(','),
  attendanceTaken: false,
  teacherName: teacherKiattisakData.name,
  teacherEmail: 'kiattisak@utd.ac.th'
}));

export const GLOBAL_COURSES = kiattisakCourses.map(c => ({
  courseId: c.id,
  code: c.code,
  courseName: c.name,
  teacherName: c.teacherName!,
  teacherEmail: c.teacherEmail!,
  roomName: c.room,
  scheduleString: c.schedule!,
  level: c.room
}));

export const MOCK_COURSES: Course[] = [
  ...kiattisakCourses,
  { id: '1', code: 'ว30101', name: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/1', term: '1/2569', studentsCount: 40, schedule: 'จ2', attendanceTaken: false, teacherName: 'คุณครู สมใจ รักสอน', teacherEmail: 'somjai@utd.ac.th' },
  { id: '2', code: 'ว30101', name: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/2', term: '1/2569', studentsCount: 42, schedule: 'อ4', attendanceTaken: false, teacherName: 'คุณครู สมใจ รักสอน', teacherEmail: 'somjai@utd.ac.th' },
  { id: '3', code: 'ค31101', name: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/1', term: '1/2569', studentsCount: 40, schedule: 'พุ1', attendanceTaken: false, teacherName: 'คุณครู มานะ บากบั่น', teacherEmail: 'mana@utd.ac.th' },
  { id: '4', code: 'ค31101', name: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/2', term: '1/2569', studentsCount: 38, schedule: 'พฤ3-4', attendanceTaken: false, teacherName: 'คุณครู มานะ บากบั่น', teacherEmail: 'mana@utd.ac.th' },
  { id: '5', code: 'ศ32101', name: 'ศิลปะ 2', room: 'ม.2/3', term: '1/2569', studentsCount: 35, schedule: 'ศ5', attendanceTaken: false, teacherName: 'คุณครู วีณา รื่นรมย์', teacherEmail: 'weena@utd.ac.th' },
  { id: '6', code: 'ท32101', name: 'ภาษาไทย 3', room: 'ม.5/8', term: '1/2569', studentsCount: 40, schedule: 'จ1-2', attendanceTaken: false, teacherName: 'นาย ก', teacherEmail: 'teacher@utd.ac.th' }
];

const RAW_M58_STUDENTS = [
  { id: 'm58-1', studentId: '55001', name: 'นาย ณัฐภัทร นิว (เลขที่ 1)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=New', seatIndex: 0, room: 'ม.5/8' },
  { id: 'm58-2', studentId: '55002', name: 'นางสาว ปิยะธิดา ปิม (เลขที่ 2)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Pim', seatIndex: 1, room: 'ม.5/8' },
  { id: 'm58-3', studentId: '55003', name: 'นาย ปรเมษฐ์ เบส (เลขที่ 3)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Best', seatIndex: 2, room: 'ม.5/8' },
  { id: 'm58-4', studentId: '55004', name: 'นางสาว ณิชารีย์ บุ้ง (เลขที่ 4)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Bung', seatIndex: 3, room: 'ม.5/8' },
  { id: 'm58-5', studentId: '55005', name: 'นาย ศิรวิทย์ รุต (เลขที่ 5)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Rut', seatIndex: 4, room: 'ม.5/8' },
  { id: 'm58-6', studentId: '55006', name: 'นาย ธีรภัทร ไกด์ (เลขที่ 6)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Guide', seatIndex: 5, room: 'ม.5/8' },
  { id: 'm58-7', studentId: '55007', name: 'นาย อัครพล อัลต้า (เลขที่ 7)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Alta', seatIndex: 6, room: 'ม.5/8' },
  { id: 'm58-8', studentId: '55008', name: 'นางสาว พิชชาภา เดียร์ (เลขที่ 8)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Dear', seatIndex: 7, room: 'ม.5/8' },
  { id: 'm58-9', studentId: '55009', name: 'นางสาว เพียงฟ้า เพียง (เลขที่ 9)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Phiang', seatIndex: 8, room: 'ม.5/8' },
  { id: 'm58-10', studentId: '55010', name: 'นางสาว กานต์พิชชา แก้ม (เลขที่ 10)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Gam', seatIndex: 9, room: 'ม.5/8' },
  { id: 'm58-11', studentId: '55011', name: 'นาย วรวุฒิ ก้อง (เลขที่ 11)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Kong', seatIndex: 10, room: 'ม.5/8' },
  { id: 'm58-12', studentId: '55012', name: 'นางสาว ศรัญญา แพรว (เลขที่ 12)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Praew', seatIndex: 11, room: 'ม.5/8' },
  { id: 'm58-13', studentId: '55013', name: 'นาย อิทธิพัทธ์ นนท์ (เลขที่ 13)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Non', seatIndex: 12, room: 'ม.5/8' },
  { id: 'm58-14', studentId: '55014', name: 'นางสาว ชลลดา ออย (เลขที่ 14)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Oil', seatIndex: 13, room: 'ม.5/8' },
  { id: 'm58-15', studentId: '55015', name: 'นาย วีรพงศ์ โต้ง (เลขที่ 15)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Tong', seatIndex: 14, room: 'ม.5/8' },
  { id: 'm58-16', studentId: '55016', name: 'นางสาว มนัสชนก มายด์ (เลขที่ 16)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Mild', seatIndex: 15, room: 'ม.5/8' },
  { id: 'm58-17', studentId: '55017', name: 'นาย ชัชวาล พีท (เลขที่ 17)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Pete', seatIndex: 16, room: 'ม.5/8' },
  { id: 'm58-18', studentId: '55018', name: 'นางสาว จิรภา เจน (เลขที่ 18)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Jane', seatIndex: 17, room: 'ม.5/8' },
  { id: 'm58-19', studentId: '55019', name: 'นาย ณภัทร มาร์ค (เลขที่ 19)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Mark', seatIndex: 18, room: 'ม.5/8' },
  { id: 'm58-20', studentId: '55020', name: 'นางสาว นภัสสร เนย (เลขที่ 20)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Noey', seatIndex: 19, room: 'ม.5/8' },
  { id: 'm58-21', studentId: '55021', name: 'นาย พลรักษ์ ดิว (เลขที่ 21)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Dew', seatIndex: 20, room: 'ม.5/8' },
  { id: 'm58-22', studentId: '55022', name: 'นางสาว อนิสา แอน (เลขที่ 22)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Ann', seatIndex: 21, room: 'ม.5/8' },
  { id: 'm58-23', studentId: '55023', name: 'นาย ฐิติพงศ์ แบงก์ (เลขที่ 23)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Bank', seatIndex: 22, room: 'ม.5/8' },
  { id: 'm58-24', studentId: '55024', name: 'นางสาว สุนิสา ฝน (เลขที่ 24)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Fon', seatIndex: 23, room: 'ม.5/8' },
  { id: 'm58-25', studentId: '55025', name: 'นาย ณัฐวุฒิ นัท (เลขที่ 25)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Nut', seatIndex: 24, room: 'ม.5/8' },
  { id: 'm58-26', studentId: '55026', name: 'นางสาว รินรดา พลอย (เลขที่ 26)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Ploy', seatIndex: 25, room: 'ม.5/8' },
  { id: 'm58-27', studentId: '55027', name: 'นาย ชินดนัย โอม (เลขที่ 27)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Ohm', seatIndex: 26, room: 'ม.5/8' },
  { id: 'm58-28', studentId: '55028', name: 'นางสาว เบญจวรรณ บิว (เลขที่ 28)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Biw', seatIndex: 27, room: 'ม.5/8' },
  { id: 'm58-29', studentId: '55029', name: 'นาย เจษฎา อาร์ม (เลขที่ 29)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Arm', seatIndex: 28, room: 'ม.5/8' },
  { id: 'm58-30', studentId: '55030', name: 'นางสาว นารีรัตน์ นุ่น (เลขที่ 30)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Noon', seatIndex: 29, room: 'ม.5/8' },
  { id: 'm58-31', studentId: '55031', name: 'นาย กฤษฎา ท็อป (เลขที่ 31)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Top', seatIndex: 30, room: 'ม.5/8' },
  { id: 'm58-32', studentId: '55032', name: 'นางสาว วรัญญา กิ๊ฟ (เลขที่ 32)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Gift', seatIndex: 31, room: 'ม.5/8' },
  { id: 'm58-33', studentId: '55033', name: 'นาย นพพล มิกซ์ (เลขที่ 33)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Mix', seatIndex: 32, room: 'ม.5/8' },
  { id: 'm58-34', studentId: '55034', name: 'นางสาว ธนพร แนน (เลขที่ 34)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Nan', seatIndex: 33, room: 'ม.5/8' },
  { id: 'm58-35', studentId: '55035', name: 'นาย ศรัณย์ เต้ (เลขที่ 35)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Tae', seatIndex: 34, room: 'ม.5/8' },
  { id: 'm58-36', studentId: '55036', name: 'นางสาว เมธาวี เมย์ (เลขที่ 36)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=May', seatIndex: 35, room: 'ม.5/8' },
  { id: 'm58-37', studentId: '55037', name: 'นาย ปองพล ปอนด์ (เลขที่ 37)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Pond', seatIndex: 36, room: 'ม.5/8' },
  { id: 'm58-38', studentId: '55038', name: 'นางสาว อารียา โบว์ (เลขที่ 38)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Bow', seatIndex: 37, room: 'ม.5/8' },
  { id: 'm58-39', studentId: '55039', name: 'นาย จิรทีปต์ นิวเยียร์ (เลขที่ 39)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Newyear', seatIndex: 38, room: 'ม.5/8' },
  { id: 'm58-40', studentId: '55040', name: 'นางสาว ชญานิษฐ์ ชมพู่ (เลขที่ 40)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Chompoo', seatIndex: 39, room: 'ม.5/8' }
];

export const MOCK_M58_STUDENTS: Student[] = RAW_M58_STUDENTS.map((s, i) => mapToStudent(s, i, 'ม.5/8'));

const RAW_M11_STUDENTS = [
  { id: '1', studentId: '54001', name: 'ด.ช. สมชาย ใจดี (เลขที่ 1)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Somchai', seatIndex: 0, room: 'ม.1/1' },
  { id: '2', studentId: '54002', name: 'ด.ญ. สมหญิง รักเรียน (เลขที่ 2)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Somying', seatIndex: 2, room: 'ม.1/1' },
  { id: '3', studentId: '54003', name: 'ด.ช. มานะ อดทน (เลขที่ 3)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Mana', seatIndex: 12, room: 'ม.1/1' },
  { id: '4', studentId: '54004', name: 'ด.ญ. ปิติ ยินดี (เลขที่ 4)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Piti', seatIndex: 14, room: 'ม.1/1' },
  { id: '5', studentId: '54005', name: 'ด.ช. ชูใจ ไพศาล (เลขที่ 5)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Chujai', seatIndex: null, room: 'ม.1/1' },
];

export const MOCK_STUDENTS: Student[] = [
  ...RAW_M11_STUDENTS.map((s, i) => mapToStudent(s, i, 'ม.1/1')),
  ...REAL_STUDENTS
];

export const MOCK_ANALYTICS = [
  { studentId: '38502', subjectAttendanceRate: 98, behaviorScore: 100 },
  { studentId: '54001', subjectAttendanceRate: 95, behaviorScore: 100 },
  { studentId: '54002', subjectAttendanceRate: 85, behaviorScore: 90 },
  { studentId: '54003', subjectAttendanceRate: 75, behaviorScore: 60 },
  { studentId: '54004', subjectAttendanceRate: 55, behaviorScore: 40 },
  { studentId: '54005', subjectAttendanceRate: 100, behaviorScore: 100 },
  { studentId: '55001', subjectAttendanceRate: 98, behaviorScore: 100 },
  { studentId: '55002', subjectAttendanceRate: 95, behaviorScore: 105 },
  { studentId: '55003', subjectAttendanceRate: 88, behaviorScore: 95 },
  { studentId: '55004', subjectAttendanceRate: 92, behaviorScore: 100 },
  { studentId: '55005', subjectAttendanceRate: 96, behaviorScore: 110 },
  { studentId: '55006', subjectAttendanceRate: 85, behaviorScore: 90 },
  { studentId: '55007', subjectAttendanceRate: 100, behaviorScore: 120 },
  { studentId: '55008', subjectAttendanceRate: 94, behaviorScore: 100 },
  { studentId: '55009', subjectAttendanceRate: 91, behaviorScore: 95 },
  { studentId: '55010', subjectAttendanceRate: 97, behaviorScore: 105 },
  { studentId: '55011', subjectAttendanceRate: 89, behaviorScore: 90 },
  { studentId: '55012', subjectAttendanceRate: 93, behaviorScore: 100 },
  { studentId: '55013', subjectAttendanceRate: 95, behaviorScore: 100 },
  { studentId: '55014', subjectAttendanceRate: 96, behaviorScore: 100 },
  { studentId: '55015', subjectAttendanceRate: 87, behaviorScore: 85 },
  { studentId: '55016', subjectAttendanceRate: 94, behaviorScore: 100 },
  { studentId: '55017', subjectAttendanceRate: 92, behaviorScore: 100 },
  { studentId: '55018', subjectAttendanceRate: 99, behaviorScore: 115 },
  { studentId: '55019', subjectAttendanceRate: 84, behaviorScore: 80 },
  { studentId: '55020', subjectAttendanceRate: 91, behaviorScore: 95 },
  { studentId: '55021', subjectAttendanceRate: 90, behaviorScore: 95 },
  { studentId: '55022', subjectAttendanceRate: 95, behaviorScore: 100 },
  { studentId: '55023', subjectAttendanceRate: 96, behaviorScore: 105 },
  { studentId: '55024', subjectAttendanceRate: 88, behaviorScore: 90 },
  { studentId: '55025', subjectAttendanceRate: 97, behaviorScore: 110 },
  { studentId: '55026', subjectAttendanceRate: 93, behaviorScore: 100 },
  { studentId: '55027', subjectAttendanceRate: 92, behaviorScore: 100 },
  { studentId: '55028', subjectAttendanceRate: 94, behaviorScore: 100 },
  { studentId: '55029', subjectAttendanceRate: 86, behaviorScore: 85 },
  { studentId: '55030', subjectAttendanceRate: 95, behaviorScore: 100 },
  { studentId: '55031', subjectAttendanceRate: 90, behaviorScore: 95 },
  { studentId: '55032', subjectAttendanceRate: 98, behaviorScore: 115 },
  { studentId: '55033', subjectAttendanceRate: 83, behaviorScore: 75 },
  { studentId: '55034', subjectAttendanceRate: 92, behaviorScore: 95 },
  { studentId: '55035', subjectAttendanceRate: 94, behaviorScore: 100 },
  { studentId: '55036', subjectAttendanceRate: 96, behaviorScore: 105 },
  { studentId: '55037', subjectAttendanceRate: 91, behaviorScore: 95 },
  { studentId: '55038', subjectAttendanceRate: 97, behaviorScore: 105 },
  { studentId: '55039', subjectAttendanceRate: 89, behaviorScore: 90 },
  { studentId: '55040', subjectAttendanceRate: 95, behaviorScore: 100 }
];

export const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: '1001', studentId: '54002', date: new Date(), reason: 'ป่วยเป็นไข้หวัด ขอลาพักผ่อน 1 วันค่ะ', status: 'PENDING' }
];

export const STATUS_CYCLE: AttendanceStatus[] = ['UNMARKED', 'PRESENT', 'LATE', 'LEAVE', 'ABSENT'];

export const mockImportedData = [
  { id: '1', teacherName: 'คุณครู สมใจ รักสอน', subjectCode: 'ว30101', subjectName: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/1', schedule: 'จ2' },
  { id: '2', teacherName: 'คุณครู สมใจ รักสอน', subjectCode: 'ว30101', subjectName: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/2', schedule: 'อ4' },
  { id: '3', teacherName: 'คุณครู มานะ บากบั่น', subjectCode: 'ค31101', subjectName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/1', schedule: 'พุ1' },
  { id: '4', teacherName: 'คุณครู มานะ บากบั่น', subjectCode: 'ค31101', subjectName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/2', schedule: 'พฤ3-4' },
  { id: '5', teacherName: 'คุณครู วีณา รื่นรมย์', subjectCode: 'ศ32101', subjectName: 'ศิลปะ 2', room: 'ม.2/3', schedule: 'ศ5' },
];

export const mockExecutiveData = {
  globalKPIs: {
    totalStudents: 1250,
    totalTeachers: 85,
    avgAttendance: 92.4,
    avgBehavior: 8.4,
    avgPeerEQ: 4.2,
    criticalAlerts: 12
  },
  attendanceTrends: [
    { month: "พ.ค.", attendance: 96, late: 2, absent: 2 },
    { month: "มิ.ย.", attendance: 94, late: 3, absent: 3 },
    { month: "ก.ค.", attendance: 89, late: 5, absent: 6 },
    { month: "ส.ค.", attendance: 91, late: 4, absent: 5 },
    { month: "ก.ย.", attendance: 92, late: 3, absent: 5 }
  ],
  riskProfile: [
    { name: "กลุ่มปลอดภัย", value: 937, color: "#10b981" },
    { name: "กลุ่มเฝ้าระวัง", value: 188, color: "#fbbf24" },
    { name: "กลุ่มวิกฤต (มส.)", value: 125, color: "#ef4444" }
  ],
  gisStudents: [
    { id: "54001", name: "ด.ช. สมชาย รักเรียน", grade: "ม.1/1", lat: 17.6251, lng: 100.0932, riskStatus: "safe", isScholarship: true, commuteDistance: "2.5 km" },
    { id: "54002", name: "ด.ญ. สมหญิง ใจดี", grade: "ม.2/3", lat: 17.6310, lng: 100.1050, riskStatus: "warning", isScholarship: false, commuteDistance: "5.0 km" },
    { id: "54003", name: "นาย มานะ อดทน", grade: "ม.4/2", lat: 17.5980, lng: 100.0815, riskStatus: "critical", isScholarship: true, commuteDistance: "12.4 km" },
    { id: "54004", name: "น.ส. ปิติ ยินดี", grade: "ม.5/1", lat: 17.6422, lng: 100.0760, riskStatus: "safe", isScholarship: false, commuteDistance: "1.2 km" }
  ],
  gradeLevelComparison: [
    { grade: "ม.1", score: 8.8 },
    { grade: "ม.2", score: 7.5 },
    { grade: "ม.3", score: 8.2 },
    { grade: "ม.4", score: 8.9 },
    { grade: "ม.5", score: 8.6 },
    { grade: "ม.6", score: 9.1 }
  ],
  correlationData: [
    { distance: 1.2, attendance: 98, late: 2 },
    { distance: 2.5, attendance: 95, late: 5 },
    { distance: 4.0, attendance: 92, late: 8 },
    { distance: 5.0, attendance: 90, late: 12 },
    { distance: 8.5, attendance: 85, late: 18 },
    { distance: 10.0, attendance: 82, late: 22 },
    { distance: 12.4, attendance: 75, late: 30 },
    { distance: 15.0, attendance: 70, late: 35 },
    { distance: 18.0, attendance: 65, late: 40 },
    { distance: 20.0, attendance: 60, late: 45 },
  ],
  healthRisks: { malnutrition: 12.5, visionIssues: 8.2, dentalIssues: 15.0, mentalStress: 5.4 },
  bmiDistribution: [
    { category: "น้ำหนักน้อย", count: 156 },
    { category: "สมส่วน", count: 845 },
    { category: "น้ำหนักเกิน", count: 180 },
    { category: "โรคอ้วน", count: 69 },
  ],
  policyProposals: [
    { id: "POL-001", title: "ขยายเส้นทางรถรับส่งนักเรียน (Route Expansion)", description: "นักเรียน 45 คนในโซนตะวันออกมีระยะทางการเดินทางเฉลี่ย > 10 กม. และมีสถิติการมาสายสูงกว่าค่าเฉลี่ย 30% ควรพิจารณาขยายเส้นทางเพื่อลดภาระค่าใช้จ่ายผู้ปกครองและลดอัตราการมาสาย", affectedStudents: 45, estimatedBudget: "15,000 THB/Month", status: "pending" },
    { id: "POL-002", title: "จัดสรรทุนช่วยเหลือฉุกเฉิน (CCT Priority Allocation)", description: "ครูที่ปรึกษาได้ลงพื้นที่เยี่ยมบ้านและระบุนักเรียนกลุ่มวิกฤต (สภาพแวดล้อมเสี่ยง) จำนวน 125 คน ที่ต้องการความช่วยเหลือด้านทุนการศึกษาและปัจจัยพื้นฐานอย่างเร่งด่วน", affectedStudents: 125, estimatedBudget: "375,000 THB", status: "pending" }
  ]
};

export const MOCK_VISIT_STUDENTS = [
  { id: 'm58-1', studentId: '55001', name: 'นาย ณัฐภัทร นิว (เลขที่ 1)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=New', status: 'pending' },
  { id: 'm58-2', studentId: '55002', name: 'นางสาว ปิยะธิดา ปิม (เลขที่ 2)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Pim', status: 'pending' },
  { id: 'm58-3', studentId: '55003', name: 'นาย ปรเมษฐ์ เบส (เลขที่ 3)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Best', status: 'visited' },
  { id: 'm58-4', studentId: '55004', name: 'นางสาว ณิชารีย์ บุ้ง (เลขที่ 4)', avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=Bung', status: 'pending' },
];

export const MOCK_VISIT_DATA = [
  { studentId: '55001', address: '99/1 ถ.อุตรดิตถ์-พิษณุโลก ซอย 2', area: 'ในเมือง', distance: '1.5 km', lat: 17.6251, lng: 100.0932, visitStatus: 'PENDING' },
  { studentId: '55002', address: '42 หมู่ 4 ต.ท่าเสา', area: 'นอกเมือง', distance: '3.2 km', lat: 17.6310, lng: 100.1050, visitStatus: 'PENDING' },
  { studentId: '55003', address: '18/5 หมู่บ้านดวงดี ต.ป่าเซ่า', area: 'ป่าเซ่า', distance: '5.4 km', lat: 17.5980, lng: 100.0815, visitStatus: 'COMPLETED' },
  { studentId: '55004', address: '105 ซอยเกษตรสิน ต.งิ้วงาม', area: 'งิ้วงาม', distance: '8.1 km', lat: 17.6422, lng: 100.0760, visitStatus: 'PENDING' },
];
