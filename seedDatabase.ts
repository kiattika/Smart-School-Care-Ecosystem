import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Load config file safely from root directory
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error("❌ Error: firebase-applet-config.json not found in root directory.");
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase Admin SDK
initializeApp({
  projectId: firebaseConfig.projectId,
});

// Configure Firestore with specific databaseId
const db = getFirestore(firebaseConfig.firestoreDatabaseId);

const periods = [
  { id: "period_0", periodNumber: 0, periodName: "คาบ 0 โฮมรูม (Homeroom)", startTime: "08:00", endTime: "08:30" },
  { id: "period_1", periodNumber: 1, periodName: "คาบเรียนที่ 1", startTime: "08:30", endTime: "09:20" },
  { id: "period_2", periodNumber: 2, periodName: "คาบเรียนที่ 2", startTime: "09:20", endTime: "10:10" },
  { id: "period_3", periodNumber: 3, periodName: "คาบเรียนที่ 3", startTime: "10:10", endTime: "11:00" },
  { id: "period_4", periodNumber: 4, periodName: "คาบเรียนที่ 4", startTime: "11:00", endTime: "11:50" },
  { id: "period_5", periodNumber: 5, periodName: "คาบ 5 พักกลางวัน (Lunch Break)", startTime: "11:50", endTime: "12:50" },
  { id: "period_6", periodNumber: 6, periodName: "คาบเรียนที่ 6", startTime: "12:50", endTime: "13:40" },
  { id: "period_7", periodNumber: 7, periodName: "คาบเรียนที่ 7", startTime: "13:40", endTime: "14:30" },
  { id: "period_8", periodNumber: 8, periodName: "คาบเรียนที่ 8", startTime: "14:30", endTime: "15:20" }
];

const teachers = [
  {
    teacherId: "teacher_kiattisak",
    fullName: "Mr. Kiattisak",
    email: "kiattika@utd.ac.th",
    role: "HOMEROOM",
    roomResponsibility: "ม.5/8"
  },
  {
    teacherId: "teacher_koykoy",
    fullName: "Mrs. Koy Koy",
    email: "koykoy@utd.ac.th",
    role: "TEACHER",
    roomResponsibility: ""
  }
];

const students = [
  {
    studentId: "38502",
    fullName: "สมชาย ใจดี",
    nickname: "ชาย",
    room: "ม.5/8",
    behaviorScore: 100,
    riskLevel: "NORMAL",
    parentId: "parent_38502"
  },
  {
    studentId: "38503",
    fullName: "สมหญิง มุ่งมั่น",
    nickname: "หญิง",
    room: "ม.5/8",
    behaviorScore: 100,
    riskLevel: "NORMAL",
    parentId: "parent_38503"
  },
  {
    studentId: "38504",
    fullName: "วิชัย ชัยชนะ",
    nickname: "ชัย",
    room: "ม.5/8",
    behaviorScore: 100,
    riskLevel: "NORMAL",
    parentId: "parent_38504"
  }
];

const schedules = [
  // Homeroom schedule (จ0-ศ0)
  { id: "sch_hr_monday", dayOfWeek: "monday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
  { id: "sch_hr_tuesday", dayOfWeek: "tuesday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
  { id: "sch_hr_wednesday", dayOfWeek: "wednesday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
  { id: "sch_hr_thursday", dayOfWeek: "thursday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
  { id: "sch_hr_friday", dayOfWeek: "friday", periodNumber: 0, subjectCode: "HOMEROOM", subjectType: "ACTIVITY", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },

  // วิชา ค32101 (จ8, อ8)
  { id: "sch_math_monday", dayOfWeek: "monday", periodNumber: 8, subjectCode: "ค32101", subjectType: "MAIN", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" },
  { id: "sch_math_tuesday", dayOfWeek: "tuesday", periodNumber: 8, subjectCode: "ค32101", subjectType: "MAIN", teacherIds: ["teacher_kiattisak"], room: "ม.5/8" }
];

async function seed() {
  console.log("🌱 Starting Firebase Admin SDK Firestore Seeding...");

  // 1. Seed Periods Config
  console.log("⏳ Seeding admin_periods_config...");
  for (const period of periods) {
    const ref = db.collection('admin_periods_config').doc(period.id);
    await ref.set(period);
  }

  // 2. Seed Teachers
  console.log("⏳ Seeding teachers...");
  for (const teacher of teachers) {
    const ref = db.collection('teachers').doc(teacher.teacherId);
    await ref.set(teacher);
  }

  // 3. Seed Students
  console.log("⏳ Seeding students...");
  for (const student of students) {
    const ref = db.collection('students').doc(student.studentId);
    await ref.set(student);
  }

  // 4. Seed Schedules
  console.log("⏳ Seeding schedules...");
  for (const schedule of schedules) {
    const ref = db.collection('schedules').doc(schedule.id);
    await ref.set(schedule);
  }

  console.log("✅ Seeding completed successfully using Firebase Admin SDK!");
}

seed().catch((err) => {
  console.error("❌ Seeding failed with error: ", err);
});
