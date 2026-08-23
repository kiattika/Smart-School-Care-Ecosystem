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

const staffUsers = [
  {
    id: "teacher_kiattisak",
    email: "kiattika@utd.ac.th",
    prefix: "นาย",
    firstName: "เกียรติศักดิ์",
    lastName: "สถิตการุณย์",
    position: "ครู คศ.2 (กลุ่มสาระฯ คณิตศาสตร์)",
    roles: ["SUPER_ADMIN", "HOMEROOM_TEACHER", "SUBJECT_TEACHER"],
    assignments: {
      homeroomClass: "ม.5/8",
      departmentId: "math-dept"
    }
  },
  {
    id: "nurse_kanokwan",
    email: "kanokwan.n@utd.ac.th",
    prefix: "นางสาว",
    firstName: "กนกวรรณ",
    lastName: "พยาบาลวิชาชีพ",
    position: "พยาบาลโรงเรียน",
    roles: ["INFIRMARY_STAFF"],
    assignments: {
      departmentId: "health-dept"
    }
  },
  {
    id: "counselor_suda",
    email: "suda.c@utd.ac.th",
    prefix: "ดร.",
    firstName: "สุดา",
    lastName: "จิตวิทยา",
    position: "ครูแนะแนวและจิตวิทยา",
    roles: ["GUIDANCE_COUNSELOR"],
    assignments: {
      departmentId: "guidance-dept"
    }
  }
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
    studentId: "38501",
    studentNumber: 1,
    studentNo: 1,
    fullName: "นายกิตติคุณ มงคลศิลป์",
    nickname: "กิต",
    className: "ม.5/8",
    room: "ม.5/8",
    behaviorScore: 100,
    riskLevel: "NORMAL",
    parentId: "parent_38501"
  },
  {
    studentId: "38502",
    studentNumber: 2,
    studentNo: 2,
    fullName: "สมชาย ใจดี",
    nickname: "ชาย",
    className: "ม.5/8",
    room: "ม.5/8",
    behaviorScore: 100,
    riskLevel: "NORMAL",
    parentId: "parent_38502"
  },
  {
    studentId: "38503",
    studentNumber: 3,
    studentNo: 3,
    fullName: "สมหญิง มุ่งมั่น",
    nickname: "หญิง",
    className: "ม.5/8",
    room: "ม.5/8",
    behaviorScore: 100,
    riskLevel: "NORMAL",
    parentId: "parent_38503"
  },
  {
    studentId: "38504",
    studentNumber: 4,
    studentNo: 4,
    fullName: "วิชัย ชัยชนะ",
    nickname: "ชัย",
    className: "ม.5/8",
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

interface BatchItem {
  collection: string;
  docId: string;
  data: Record<string, any>;
}

async function seed() {
  console.log("🌱 Starting Batched Firebase Admin SDK Firestore Seeding...");

  const allItems: BatchItem[] = [
    ...periods.map(p => ({ collection: 'admin_periods_config', docId: p.id, data: p })),
    ...staffUsers.map(s => ({ collection: 'staff', docId: s.id, data: s })),
    ...teachers.map(t => ({ collection: 'teachers', docId: t.teacherId, data: t })),
    ...students.map(s => ({ collection: 'students', docId: s.studentId, data: s })),
    ...schedules.map(sch => ({ collection: 'schedules', docId: sch.id, data: sch }))
  ];

  const BATCH_SIZE = 450; // Keep safely under Firestore 500 limit
  let batch = db.batch();
  let countInBatch = 0;
  let totalBatches = 0;

  for (const item of allItems) {
    const docRef = db.collection(item.collection).doc(item.docId);
    batch.set(docRef, item.data, { merge: true });
    countInBatch++;

    if (countInBatch >= BATCH_SIZE) {
      await batch.commit();
      totalBatches++;
      console.log(`📦 Committed batch #${totalBatches} (${countInBatch} writes)`);
      batch = db.batch();
      countInBatch = 0;
    }
  }

  if (countInBatch > 0) {
    await batch.commit();
    totalBatches++;
    console.log(`📦 Committed final batch #${totalBatches} (${countInBatch} writes)`);
  }

  console.log(`✅ Batched Seeding completed successfully! Total records: ${allItems.length} across ${totalBatches} batch(es).`);
}

seed().catch((err) => {
  console.error("❌ Seeding failed with error: ", err);
});
