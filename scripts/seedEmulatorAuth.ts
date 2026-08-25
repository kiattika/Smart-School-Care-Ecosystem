import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, UserRecord } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Force point to local Firebase Emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase Admin with the matching project ID
const projectId = process.env.GCLOUD_PROJECT || firebaseConfig.projectId || 'kiattisak-project-001';

if (!getApps().length) {
  initializeApp({
    projectId: projectId,
  });
}

const auth = getAuth();
const db = getFirestore();

console.log(`✅ Connected to Firebase Emulator (Auth: 127.0.0.1:9099, Firestore: 127.0.0.1:8080)`);

export interface TestUserDef {
  uid: string;
  email: string;
  password: string;
  displayName: string;
  roles: string[];
  position: string;
  prefix: string;
  firstName: string;
  lastName: string;
  assignments?: {
    homeroomClass?: string;
    departmentId?: string;
  };
  studentInfo?: {
    studentId: string;
    studentNumber: number;
    className: string;
    parentId: string;
  };
}

export const SEEDED_TEST_USERS: TestUserDef[] = [
  {
    uid: 'test_admin_kiattika_001',
    email: 'kiattika@utd.ac.th',
    password: 'test1234',
    displayName: 'นายเกียรติศักดิ์ แก้วหล้า',
    prefix: 'นาย',
    firstName: 'เกียรติศักดิ์',
    lastName: 'แก้วหล้า',
    position: 'ผู้ดูแลระบบสารสนเทศ (SUPER_ADMIN)',
    roles: ['SUPER_ADMIN', 'EXECUTIVE', 'HOMEROOM_TEACHER', 'SUBJECT_TEACHER'],
    assignments: { departmentId: 'admin-dept', homeroomClass: 'ม.5/8' }
  },
  {
    uid: 'test_teacher_001',
    email: 'teacher.test@utd.ac.th',
    password: 'test1234',
    displayName: 'ครูสมปอง สอนดี',
    prefix: 'นาย',
    firstName: 'สมปอง',
    lastName: 'สอนดี',
    position: 'ครู คศ.2 (กลุ่มสาระฯ คณิตศาสตร์)',
    roles: ['SUBJECT_TEACHER'],
    assignments: { departmentId: 'math-dept' }
  },
  {
    uid: 'test_advisor_001',
    email: 'advisor.test@utd.ac.th',
    password: 'test1234',
    displayName: 'ครูเกียรติศักดิ์ ประจำชั้น ม.5/8',
    prefix: 'นาย',
    firstName: 'เกียรติศักดิ์',
    lastName: 'สถิตการุณย์',
    position: 'ครูที่ปรึกษาประจำชั้น ม.5/8',
    roles: ['HOMEROOM_TEACHER', 'SUBJECT_TEACHER'],
    assignments: { homeroomClass: 'ม.5/8', departmentId: 'math-dept' }
  },
  {
    uid: 'test_exec_001',
    email: 'exec.test@utd.ac.th',
    password: 'test1234',
    displayName: 'ดร.สมเกียรติ บริหารวิชาการ',
    prefix: 'ดร.',
    firstName: 'สมเกียรติ',
    lastName: 'บริหารวิชาการ',
    position: 'รองผู้อำนวยการฝ่ายบริหารงานวิชาการ',
    roles: ['EXECUTIVE']
  },
  {
    uid: 'test_admin_001',
    email: 'admin.test@utd.ac.th',
    password: 'test1234',
    displayName: 'แอดมินศูนย์ไอที สพม.',
    prefix: 'นาย',
    firstName: 'แอดมิน',
    lastName: 'ระบบเทคโนโลยี',
    position: 'ผู้ดูแลระบบสารสนเทศ (SUPER_ADMIN)',
    roles: ['SUPER_ADMIN', 'EXECUTIVE', 'HOMEROOM_TEACHER', 'SUBJECT_TEACHER']
  },
  {
    uid: 'test_guidance_001',
    email: 'guidance.test@utd.ac.th',
    password: 'test1234',
    displayName: 'ดร.สุดา จิตวิทยาแนะแนว',
    prefix: 'ดร.',
    firstName: 'สุดา',
    lastName: 'จิตวิทยาแนะแนว',
    position: 'ครูแนะแนวและผู้ให้คำปรึกษาทางจิตวิทยา (PHQ-9/SDQ)',
    roles: ['GUIDANCE_COUNSELOR']
  },
  {
    uid: 'test_finance_001',
    email: 'finance.test@utd.ac.th',
    password: 'test1234',
    displayName: 'นางศิริพร การเงินพัสดุ',
    prefix: 'นาง',
    firstName: 'ศิริพร',
    lastName: 'การเงินพัสดุ',
    position: 'เจ้าหน้าที่การเงินและบัญชีโรงเรียน',
    roles: ['FINANCE_STAFF']
  },
  {
    uid: 'test_infirmary_001',
    email: 'infirmary.test@utd.ac.th',
    password: 'test1234',
    displayName: 'น.ส.กนกวรรณ พยาบาลวิชาชีพ',
    prefix: 'นางสาว',
    firstName: 'กนกวรรณ',
    lastName: 'พยาบาลวิชาชีพ',
    position: 'เจ้าหน้าที่พยาบาลและสุขอนามัย',
    roles: ['INFIRMARY_STAFF']
  },
  {
    uid: 'test_supervisor_001',
    email: 'supervisor.test@utd.ac.th',
    password: 'test1234',
    displayName: 'ดร.วิชัย นิเทศการศึกษา',
    prefix: 'ดร.',
    firstName: 'วิชัย',
    lastName: 'นิเทศการศึกษา',
    position: 'ศึกษานิเทศก์ชำนาญการพิเศษ',
    roles: ['INSTRUCTIONAL_SUPERVISOR']
  },
  {
    uid: 'test_parent_001',
    email: 'parent.test@gmail.com',
    password: 'test1234',
    displayName: 'คุณพ่อมนตรี (ผู้ปกครองนายกิตติคุณ)',
    prefix: 'นาย',
    firstName: 'มนตรี',
    lastName: 'มงคลศิลป์',
    position: 'ผู้ปกครองนักเรียน (นายกิตติคุณ มงคลศิลป์ ม.5/8)',
    roles: [],
    studentInfo: {
      studentId: '38501',
      studentNumber: 1,
      className: 'ม.5/8',
      parentId: 'test_parent_001'
    }
  },
  {
    uid: 'test_student_001',
    email: 'student.test@utd.ac.th',
    password: 'test1234',
    displayName: 'นายกิตติคุณ มงคลศิลป์ (ม.5/8)',
    prefix: 'นาย',
    firstName: 'กิตติคุณ',
    lastName: 'มงคลศิลป์',
    position: 'นักเรียนชั้น ม.5/8 เลขที่ 1',
    roles: ['STUDENT'],
    studentInfo: {
      studentId: '38501',
      studentNumber: 1,
      className: 'ม.5/8',
      parentId: 'test_parent_001'
    }
  }
];

export async function seedEmulatorAuth() {
  console.log(`\n======================================================`);
  console.log(`⚡ Seeding Firebase Auth & Firestore to Emulator Suite`);
  console.log(`Auth Host: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`Firestore Host: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`Project ID: ${projectId}`);
  console.log(`======================================================\n`);

  for (const userDef of SEEDED_TEST_USERS) {
    try {
      // 1. Create or Update Auth Record
      let userRecord: UserRecord;
      try {
        userRecord = await auth.getUserByEmail(userDef.email);
        await auth.updateUser(userRecord.uid, {
          password: userDef.password,
          displayName: userDef.displayName,
          emailVerified: true
        });
        console.log(`🔄 Updated existing Auth user: ${userDef.email} (${userRecord.uid})`);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            uid: userDef.uid,
            email: userDef.email,
            password: userDef.password,
            displayName: userDef.displayName,
            emailVerified: true
          });
          console.log(`✨ Created new Auth user: ${userDef.email} (${userRecord.uid})`);
        } else {
          throw err;
        }
      }

      // 2. Assign Custom User Claims (matching firestore.rules request.auth.token.roles)
      await auth.setCustomUserClaims(userRecord.uid, {
        roles: userDef.roles,
        primaryRole: userDef.roles[0] || (userDef.roles.length === 0 ? 'PARENT' : 'USER'),
        email: userDef.email,
        emailVerified: true
      });
      console.log(`   🏷️ Set custom claims: roles=[${userDef.roles.join(', ')}]`);

      // 3. Write Staff/User Profile in Firestore
      const staffDocRef = db.collection('staff').doc(userRecord.uid);
      await staffDocRef.set({
        id: userRecord.uid,
        email: userDef.email,
        displayName: userDef.displayName,
        prefix: userDef.prefix,
        firstName: userDef.firstName,
        lastName: userDef.lastName,
        position: userDef.position,
        roles: userDef.roles,
        assignments: userDef.assignments || {},
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      // Also create an alias by email for robust lookups
      await db.collection('staff').doc(userDef.email).set({
        id: userRecord.uid,
        email: userDef.email,
        displayName: userDef.displayName,
        prefix: userDef.prefix,
        firstName: userDef.firstName,
        lastName: userDef.lastName,
        position: userDef.position,
        roles: userDef.roles,
        assignments: userDef.assignments || {},
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      // 4. If student/parent info is attached, write matching student record
      if (userDef.studentInfo) {
        const studentDocRef = db.collection('students').doc(userDef.studentInfo.studentId);
        await studentDocRef.set({
          studentId: userDef.studentInfo.studentId,
          studentNumber: userDef.studentInfo.studentNumber,
          studentNo: userDef.studentInfo.studentNumber,
          fullName: 'นายกิตติคุณ มงคลศิลป์',
          nickname: 'กิต',
          className: userDef.studentInfo.className,
          room: userDef.studentInfo.className,
          behaviorScore: 100,
          riskLevel: 'NORMAL',
          parentId: userDef.studentInfo.parentId,
          parentUid: userDef.studentInfo.parentId,
          studentUid: userDef.uid,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        // Add a sample parent notification for testing relational parent rules
        const notifDocRef = db.collection('parent_notifications').doc(`notif_parent_test_01`);
        await notifDocRef.set({
          id: `notif_parent_test_01`,
          parentUid: userDef.studentInfo.parentId,
          parentId: userDef.studentInfo.parentId,
          studentId: userDef.studentInfo.studentId,
          studentName: 'นายกิตติคุณ มงคลศิลป์',
          title: 'ยินดีต้อนรับสู่ระบบ Smart School Care',
          message: 'บัญชีผู้ปกครองได้รับการเชื่อมโยงกับนักเรียนเรียบร้อยแล้วค่ะ',
          status: 'unread',
          createdAt: FieldValue.serverTimestamp()
        }, { merge: true });

        // Add a sample parent conference for testing parent conference rules
        const confDocRef = db.collection('parent_conferences').doc(`conf_test_01`);
        await confDocRef.set({
          id: `conf_test_01`,
          parentUid: userDef.studentInfo.parentId,
          parentId: userDef.studentInfo.parentId,
          studentId: userDef.studentInfo.studentId,
          studentName: 'นายกิตติคุณ มงคลศิลป์',
          title: 'การนัดพบเพื่อวางแผนการเรียนภาคเรียนที่ 1/2569',
          message: 'ขอเรียนเชิญผู้ปกครองเข้าร่วมการปรึกษาแนวทางการศึกษาต่อระดับอุดมศึกษา',
          status: 'SCHEDULED',
          scheduledDate: '2026-08-28',
          scheduledTime: '13:00 - 14:00 น.',
          remainingScore: 100,
          createdAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

    } catch (err: any) {
      console.error(`❌ Error seeding user ${userDef.email}:`, err.message);
    }
  }

  // 5. Seed a sample self-assessment document for testing GUIDANCE_COUNSELOR rules
  try {
    const assessmentRef = db.collection('student_self_assessments').doc('38501');
    await assessmentRef.set({
      studentId: '38501',
      studentName: 'นายกิตติคุณ มงคลศิลป์',
      phq9Score: 6,
      sdqTotal: 12,
      evaluationDate: new Date().toISOString(),
      counselingNotes: 'ทดสอบบันทึกข้อมูลสุขภาพจิต (จำกัดเฉพาะครูแนะแนวและแอดมินเท่านั้น)'
    }, { merge: true });
    console.log(`\n📋 Seeded sample PHQ-9/SDQ record in 'student_self_assessments/38501'`);
  } catch (err: any) {
    console.warn('Notice seeding student_self_assessments:', err.message);
  }

  // 6. Seed admin_periods_config and school_settings/periods_config
  try {
    const defaultAdminPeriods = [
      { id: 'p0', periodNumber: 0, periodName: 'HR กิจกรรมโฮมรูม', startTime: '08:00', endTime: '08:30', periodType: 'ACTIVITY' },
      { id: 'p1', periodNumber: 1, periodName: 'คาบเรียนวิชาการที่ 1', startTime: '08:30', endTime: '09:20', periodType: 'MAIN' },
      { id: 'p2', periodNumber: 2, periodName: 'คาบเรียนวิชาการที่ 2', startTime: '09:20', endTime: '10:10', periodType: 'MAIN' },
      { id: 'p3', periodNumber: 3, periodName: 'คาบเรียนวิชาการที่ 3', startTime: '10:10', endTime: '11:00', periodType: 'MAIN' },
      { id: 'p4', periodNumber: 4, periodName: 'คาบเรียนวิชาการที่ 4', startTime: '11:00', endTime: '11:50', periodType: 'MAIN' },
      { id: 'p5', periodNumber: 5, periodName: 'พักกลางวัน', startTime: '11:50', endTime: '12:40', periodType: 'BREAK' },
      { id: 'p6', periodNumber: 6, periodName: 'คาบเรียนวิชาการที่ 5', startTime: '12:40', endTime: '13:30', periodType: 'MAIN' },
      { id: 'p7', periodNumber: 7, periodName: 'คาบเรียนวิชาการที่ 6', startTime: '13:30', endTime: '14:20', periodType: 'MAIN' },
      { id: 'p8', periodNumber: 8, periodName: 'คาบเรียนวิชาการที่ 7', startTime: '14:20', endTime: '15:10', periodType: 'MAIN' }
    ];

    const batch = db.batch();
    for (const p of defaultAdminPeriods) {
      batch.set(db.collection('admin_periods_config').doc(p.id), p, { merge: true });
    }

    batch.set(db.collection('school_settings').doc('periods_config'), {
      periods: defaultAdminPeriods,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();
    console.log(`\n🕒 Seeded admin_periods_config and school_settings/periods_config`);
  } catch (err: any) {
    console.warn('Notice seeding periods config:', err.message);
  }

  // 7. Seed sample today's attendance record and seating layout for M.5/8
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const attendanceDocId = `att_m58_${todayStr}_p1`;
    await db.collection('attendance_records').doc(attendanceDocId).set({
      id: attendanceDocId,
      date: todayStr,
      room: 'ม.5/8',
      periodNumber: 1,
      checkedByTeacherId: 'test_advisor_001',
      checkedByName: 'ครูเกียรติศักดิ์ สถิตการุณย์',
      checkedAt: FieldValue.serverTimestamp(),
      isLocked: false,
      students: {
        '38501': 'PRESENT',
        '38502': 'PRESENT',
        '38503': 'LATE',
        '38504': 'ABSENT'
      }
    }, { merge: true });

    // Seed Seating Layout for Physics M.5/8
    const layoutId = 'layout_ว32204_m58';
    await db.collection('seating_layouts').doc(layoutId).set({
      id: layoutId,
      name: 'ผังห้องเรียนฟิสิกส์ 4 (ม.5/8)',
      subjectCode: 'ว32204',
      room: 'ม.5/8',
      teacherId: 'test_advisor_001',
      teacherEmail: 'advisor.test@utd.ac.th',
      category: 'CLASSROOM',
      isTemplate: true,
      isLocked: false,
      totalCapacity: 40,
      zoomScale: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`\n🪑 Seeded sample attendance record and seating layout '${layoutId}'`);
  } catch (err: any) {
    console.warn('Notice seeding attendance & seating layout:', err.message);
  }

  console.log(`\n🎉 Seeded all ${SEEDED_TEST_USERS.length} test accounts successfully!`);
}

// Run directly if invoked via CLI
if (process.argv[1]?.includes('seedEmulatorAuth')) {
  seedEmulatorAuth().then(() => {
    console.log('Done!');
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal error during emulator seeding:', err);
    process.exit(1);
  });
}
