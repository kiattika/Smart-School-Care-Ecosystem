# CLAUDE.md — กฎและบริบทของโปรเจกต์ Smart School Care Ecosystem

อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง กฎเหล่านี้มาจากปัญหาจริงที่เคยเกิดขึ้นในโปรเจกต์นี้ — อย่าทำซ้ำ

## ภาพรวมโปรเจกต์

ระบบบริหารจัดการสถานศึกษา (Uttaradit School) — React 19 + TypeScript + Vite + Zustand + Firebase (Auth + Firestore) รองรับ Teacher/Advisor/Executive/Admin/Parent/Student portal หลายบทบาท

- Firebase Project ID: `kiattisak-project-001` (ดูจาก `firebase-applet-config.json` field `projectId` — **ห้ามสับสนกับ `firestoreDatabaseId`** ซึ่งเป็นคนละ field คนละวัตถุประสงค์ เคยทำให้ seed script กับ client เชื่อมกันคนละ namespace มาแล้ว)
- Firestore ใช้ named database (ไม่ใช่ default) — ต้องระบุ `firestoreDatabaseId` ตอนเรียก `getFirestore()`
  - **Cloud Functions ด้วย:** ห้ามใช้ `admin.firestore()` / `getFirestore()` แบบไม่ระบุ ID (ได้ `(default)` ที่ว่างเปล่า — เคยทำให้ `onUserCreated` หา staff ไม่เจอทุกครั้ง และ `assignUserRole` เขียน `staff.roles` ผิดฐานข้อมูล) ให้ใช้ `getFirestore(admin.app(), FIRESTORE_DATABASE_ID)` จาก `functions/src/config.ts` (มี test `functionsDatabaseId.test.ts` กันค่าเพี้ยนจาก client)
  - `firebase.json` → `firestore.database` ต้องเป็น ID เดียวกัน ไม่งั้น `firebase deploy --only firestore` ส่ง rules/indexes ไปที่ `(default)` (test เดียวกันตรวจทั้งสองจุด)
  - ใน Functions ให้ import `FieldValue` จาก `firebase-admin/firestore` — `admin.firestore.FieldValue` เป็น `undefined` ใน Functions emulator
- การเปลี่ยนบทบาท (roles) ของผู้ใช้ต้องผ่าน callable `assignUserRole` เท่านั้น (เขียน custom claims + `staff.roles` ในที่เดียว) — client ห้ามเขียน `staff.roles` เองตอนแก้สิทธิ์
  - SUPER_ADMIN ถอน SUPER_ADMIN ของตัวเองไม่ได้ (รวมตั้ง roles ว่าง) — `failed-precondition` จาก `functions/src/roleGuards.ts` กันล็อกตัวเองออก; ให้ SUPER_ADMIN คนอื่นทำแทน
- อีเมลที่เขียนลง `staff` / `teachers` / `students` (รวม `parentEmail`) ต้องผ่าน `normalizeEmail()` (`src/lib/normalizeEmail.ts`: ตัดอักขระล่องหน + trim + lowercase) เสมอ — blocking function ค้นด้วย email แบบตรงตัว
- สคริปต์ maintenance (`npx tsx scripts/<name>.ts`): `normalizeEmails.ts` (แก้อีเมลใน doc เดิม + รายงานอีเมลซ้ำ), `resetAuthClaims.ts` (ล้าง claims + revoke ทุกบัญชี, `--keep <email>` ได้หลายครั้ง) — ทั้งคู่มี `--dry-run` และ**ปฏิเสธการรันถ้าไม่มี emulator env** เว้นแต่ส่ง `--confirm-production <projectId>` (Claude ห้ามรันกับ production เอง)
- **Runtime ของ Cloud Functions = Node 22** (`functions/package.json` → `engines.node: "22"`) — Node 20 ถูกปิด 30 ต.ค. 2026; **ห้ามใช้ 24** เพราะ Node 24 รองรับเฉพาะรุ่นที่ 2 แต่ `assignUserRole` เป็นรุ่นแรกและต้องอยู่ us-central1 (เปิด Cloud Run ใน us-central1 ไม่ได้ — ดูเรื่องโควตาด้านล่าง). Node local เป็น v24 ได้ (emulator แค่เตือน)
- **firebase-functions ต้อง ≥ 7.2.2** (ปัจจุบัน ^7.4.0) — รุ่นเก่ากว่าปฏิเสธ blocking token ที่ `aud` เป็น URL `cloudfunctions.net` ซึ่ง Firebase CLI ใช้ผูก trigger ตอนสร้าง function ครั้งแรก → ทุกคน login ไม่ได้ (`auth/error-code:-47`) เคยเกิดจริงบน production. ตั้งแต่ v6 `import 'firebase-functions'` คือ v2 — `assignUserRole` ต้อง import จาก `'firebase-functions/v1'` และเป็น v1 callable ที่ region เริ่มต้นเสมอ
- **Deploy functions ระบุชื่อเสมอ:** `firebase deploy --only functions:assignUserRole,functions:beforeCreate,functions:beforeSignIn` (= `npm --prefix functions run deploy`) — **ห้าม `--only functions` เปล่าๆ** เพราะโปรเจกต์มี function ของ Timetable Scheduler อีก 10 ตัวที่ไม่อยู่ใน repo นี้ CLI จะถามลบ
- **หลัง deploy blocking functions ต้องทดสอบ login ทันที** — ถ้าทุกบัญชี error ให้ไปที่ Firebase Console > Authentication > Settings > Blocking functions เลือก function ใหม่ (`beforeCreate`/`beforeSignIn`) แล้วกด Save
- **Region ของ Functions / โควตา Cloud Run:** โควตา Cloud Run "Number of regions" ของโปรเจกต์เต็ม 3/3 — function รุ่นที่ 2 (รันบน Cloud Run) deploy ไป region ใหม่ไม่ได้ (us-central1 ล้มด้วย `ProjectInitFailedQuotaExceeded`) จึงให้ blocking functions (`beforeCreate`/`beforeSignIn`) อยู่ `asia-southeast1` ซึ่งใช้อยู่แล้ว; `assignUserRole` (รุ่นแรก ไม่ใช้ Cloud Run) และ client ที่เรียกมันอยู่ `us-central1` ตามเดิม. function รุ่นที่ 2 ตัวใหม่ต้องใช้ region ที่มี Cloud Run อยู่แล้วเท่านั้น (test `functionsRegion.test.ts`)

---

## 🔴 กฎความปลอดภัยที่ห้ามละเมิดเด็ดขาด

### 1. ห้ามใช้ `|| isSignedIn()` ต่อท้าย role-check ใน firestore.rules

**นี่คือช่องโหว่ที่เกิดซ้ำมากที่สุดในโปรเจกต์นี้ (พบและแก้ไปแล้วอย่างน้อย 3 รอบ)** รูปแบบนี้ทำให้ role check ทั้งหมดข้างหน้าไม่มีความหมาย เพราะ signed-in user คนไหนก็ผ่านเงื่อนไขได้:

```
// ❌ ห้ามเขียนแบบนี้
allow write: if hasRole('SUPER_ADMIN') || hasRole('HOMEROOM_TEACHER') || isSignedIn();

// ✅ ถูกต้อง — ถ้าต้องการให้เจ้าของข้อมูลเข้าถึงได้ ให้ scope ด้วย ownership check เจาะจง
allow write: if hasRole('SUPER_ADMIN') || hasRole('HOMEROOM_TEACHER') ||
                (isSignedIn() && resource.data.parentUid == request.auth.uid);
```

- Collection ที่ตั้งใจให้ "signed-in ใครก็อ่านได้" (ไม่อ่อนไหว เช่น `schedules`, `staff`, `teachers`, `admin_periods_config`, `school_settings`) — bare `isSignedIn()` **สำหรับ read เท่านั้น** ยอมรับได้ตามที่ตกลงกันไว้
- **Write ต้องไม่มี bare `isSignedIn()` เด็ดขาดในทุกกรณี**
- ข้อมูลอ่อนไหวเป็นพิเศษ (สุขภาพจิต: `student_assessments_sdq`, `student_screenings_phq9`, `student_screenings_2q`; การเงิน: `billing_invoices`; ข้อความส่วนตัว: `parent_teacher_messages`, `parent_appointments`) ต้อง scope ด้วย ownership field เท่านั้น
- ทุกครั้งที่เพิ่ม collection ใหม่ ให้ grep `isSignedIn()` ทั้งไฟล์แล้วเช็คว่าไม่มีตัวไหนติดกับ `write:` เลย

### 2. ทดสอบ Firestore rules ด้วย Firebase Emulator จริงเท่านั้น

ห้ามเขียน mock/JS re-implementation ของ rules มาทดสอบเอง (เคยทำผิดพลาดมาก่อน ทำให้ regression หลุดไปโดยไม่รู้ตัว) — ใช้ `@firebase/rules-unit-testing` ยิงเข้า Firestore Emulator จริงเสมอ ผ่าน `initializeTestEnvironment()` อ่านไฟล์ `firestore.rules` จริง

---

## 🔴 ห้ามสร้างข้อมูลปลอม/ทางลัดที่ดูเหมือนทำงานได้จริง

นี่คือ pattern ที่เจอซ้ำมากที่สุดเป็นอันดับสองในโปรเจกต์นี้:

- **ห้าม fallback ไปใช้ mock/hardcoded array** เมื่อ Firestore ว่างหรือ query ไม่เจอ (เช่น `REAL_STUDENTS`, `MOCK_COURSES`, `MOCK_MULTI_ROLE_USERS`) — ต้องแสดง empty state จริงเสมอ
- **Zustand store initial state ต้องว่างเปล่า/null เสมอ** (`user: null`, `students: []` ฯลฯ) ห้าม seed ด้วยข้อมูลปลอมตอน initialize — เคยเป็นต้นเหตุของบั๊ก "ผี Mr. Kiattisak" ที่ตามหากันมานาน เพราะ initial state ปลอมโผล่มาก่อน real auth/Firestore listener จะ resolve
- **ห้ามใช้ `setTimeout` แทนการเขียน Firestore จริง** เพื่อจำลอง "บันทึกสำเร็จ" — ทุกปุ่ม "บันทึก/ยืนยัน/อนุมัติ" ต้องเรียก Firestore write จริง (`setDoc`/`writeBatch`/`updateDoc`) ก่อนแสดงข้อความสำเร็จ
- ปุ่ม dev/demo ที่ตั้งใจเป็นทางลัดจริงๆ (ไม่ผูก user จริง) ต้อง gate ด้วย `import.meta.env.DEV` และตั้งชื่อให้ตรงไปตรงมา (เช่น "Simulate") ไม่ใช่ทำให้ดูเหมือนงานจริง (เช่น "Mark Done")
  - ปุ่ม "จำลองสำเร็จ" ที่**เขียน Firestore จริง** (เช็คชื่อ/ครูร่วมเช็คชื่อ/สแกนประตู/หยอด seed) ห้ามมีเลยแม้ใน DEV — ถูกลบไปแล้วในรอบ A; เครื่องมือจำลองที่เหลือ (Time Simulation ใน TeacherPortal, Simulation Quick Testing ใน GPSGeofenceCheckinModal) แสดงเฉพาะ `import.meta.env.DEV`
- **ค่าสำรองปลอมห้ามมี:** ไม่มี user → ยกเลิกการเขียนและแจ้ง error ที่ผู้ใช้เห็น (ห้ามเติม `teacher_001`/อีเมล/ชื่อครูคนใดแทน); ไม่มีห้อง → empty state ไม่ query ไม่เขียน (ห้ามเติม `'ม.5/8'`); ไม่มีจำนวนนักเรียน/กลุ่มสาระ/ป้ายห้อง → ไม่แสดง (ห้ามฝังตัวเลข/ชื่อ); ห้ามข้อความอ้างฟีเจอร์ที่ยังไม่ได้ทำจริง (เช่น Anti-Mock Location, แจ้งเตือน LINE). ข้อยกเว้นเดียว: รายชื่อบัญชีทดสอบ emulator ใน `LoginPage.tsx` (แสดงเฉพาะ DEV). guard test `noFakeDataGuard.test.ts` สแกน `src/` กันกลับมา
  - รอบ B (ยังไม่ทำ): `MOCK_VISIT_DATA` (AdvisorPortal), ชุดข้อมูลปลอมใน state (Supervision/Infirmary/SystemSettings/Executive/StudentPortal ฯลฯ) และจุดที่แจ้งสำเร็จโดยไม่ได้บันทึก Firestore จริง
- ห้ามสร้างฟีเจอร์ import/data-entry ซ้ำซ้อนหลายชุดสำหรับงานเดียวกัน — ถ้ามี component จริงอยู่แล้ว (เช่น `BulkDataImportModal.tsx`) ให้ reuse ไม่สร้างใหม่

### หน้า portal ต้องอ่าน students/courses จาก Firestore listener สด ไม่ใช่ Zustand store

Zustand store (`students`, `globalCourses`, `courses`) จะมีข้อมูลก็ต่อเมื่อมีคน import
ในเซสชันเบราว์เซอร์เดียวกันเท่านั้น — เปิดหน้าใหม่/ล็อกอินใหม่/คนละเครื่อง store ว่าง
→ หน้าจอขึ้น "ไม่มีข้อมูล" ทั้งที่ Firestore ครบ ให้ใช้ hook `useRealStudents()`
(`onSnapshot('students')`) หรือ `useTeacherFirestoreSchedule()` (`onSnapshot('schedules')`) แทน

**แก้แล้ว:** `AdvisorPortal.tsx`, `TeacherPortal.tsx` (ทั้ง students และ courses), `HomeVisitPortal.tsx`

**เช็คลิสต์ที่ยังต้องแก้แบบเดียวกัน (backlog):**
- `src/ExecutivePortal.tsx` — `students` → ExecutiveEngagementDashboard / ExecutiveLearnerAnalytics
- `src/ParentPortal.tsx` — `students` (filter ด้วย parentUid)
- `src/StudentPortal.tsx` — `students`
- `src/components/ClassroomLeaderboard.tsx` — `students`
- `src/components/finance/FinancePortal.tsx` — `students` (จับคู่ invoice)
- `src/components/guidance/GuidancePortal.tsx` — `students` (dropdown SDQ)
- `src/components/infirmary/InfirmaryPortal.tsx` — `students` (dropdown ห้องพยาบาล)
- `src/components/supervision/SupervisionPortal.tsx` — `students`
- `src/components/SubstituteTeachingModule.tsx` — `students` (เช็คชื่อสอนแทน)
- `src/components/student-parent/*` — 7 ไฟล์: BehaviorDisciplineModule, SocioeconomicWelfareModule, AcademicHomeworkModule, PortfolioActivityVault, HealthMentalWellbeingModule, ParentEngagementServices, GateAttendanceTracker

### ใช้ `StudentPicker` กลางสำหรับจุดที่ต้องเลือกนักเรียน (ห้ามสร้าง select/checkbox เอง)

`src/components/shared/StudentPicker.tsx` คือ component กลางสำหรับเลือกนักเรียน แทน `<select>` ธรรมดา
หรือ checkbox list ที่เขียนขึ้นเองกระจัดกระจายหลายจุด — โหมด `single` (ช่องค้นหา autocomplete ด้วยเลข
ประจำตัวหรือชื่อ) และโหมด `multi-room` (เลือกห้องแล้วติ๊ก checkbox หลายคน + "เลือกทั้งหมด") ดึงรายชื่อ
สดผ่าน `useRealStudents()` เอง หรือรับ prop `students` ก็ได้ถ้าไฟล์นั้นดึงไว้แล้ว **สำคัญ: ไม่ auto-select
นักเรียนคนแรกให้เป็นค่าเริ่มต้นเด็ดขาด** (ต่างจาก pattern เก่าที่เคย `useState(students[0]?.studentId || '')`
ซึ่งเป็นทั้งบั๊ก state ค้างว่างตอน `students` ยังโหลดไม่เสร็จ และความเสี่ยงด้านความปลอดภัยที่ผู้ใช้กด "บันทึก"
โดยลืมเปลี่ยนนักเรียนที่เลือกอยู่ — บังคับให้ผู้ใช้เลือกเองเสมอ

**แปลงไปใช้แล้ว:** `FinancePortal.tsx` (สร้างใบแจ้งหนี้), `InfirmaryPortal.tsx` (บันทึกการรักษา — จุดนี้เคย
มีบั๊ก dropdown เลือกไม่ติดมาก่อน), `GuidancePortal.tsx` (เปิดเคสให้คำปรึกษาใหม่)

**ตั้งใจไม่แปลง (ตรวจสอบแล้วไม่เข้ากับ pattern การค้นหา/เลือกของ StudentPicker):**
- `RandomStudentPickerModal.tsx` — เป็นฟีเจอร์สุ่มหมุน (roulette) ไม่มี UI ค้นหา/เลือกรายบุคคลอยู่แล้ว คนละวัตถุประสงค์
- `ClassroomSeatingManager.tsx` — รายชื่อนักเรียนผูกกับ drag-and-drop/click-to-arm ผังที่นั่งและสถานะการเข้าเรียนแน่นหนา ไม่ใช่ list เลือกทั่วไป

**เช็คลิสต์ไฟล์ที่ยังไม่แปลง (backlog, ~17 ไฟล์ จากการสแกน `<select>`/checkbox ที่อ้างอิง `studentId`):**
- `src/ParentPortal.tsx`, `src/StudentPortal.tsx`, `src/TeacherPortal.tsx`, `src/HomeVisitPortal.tsx`
- `src/components/StudentManagementPage.tsx`, `src/components/StudentSelfAssessmentForm.tsx`
- `src/components/SubstituteTeachingModule.tsx`, `src/components/BulkDataImportModal.tsx`
- `src/components/ClassroomLeaderboard.tsx`
- `src/components/admin/HouseManagerPage.tsx`
- `src/components/ExecutiveEngagementDashboard.tsx`, `src/components/ExecutiveLearnerAnalytics.tsx`
- `src/components/student-parent/BehaviorDisciplineModule.tsx`, `ParentEngagementServices.tsx`, `PortfolioActivityVault.tsx`

### แสดงรายวิชา+ระดับชั้น+ห้อง ใช้ `formatCourseTitle()` เสมอ

จุดที่โชว์ชื่อวิชาคู่กับห้อง ต้องมีระดับชั้น (ม.5/8) ด้วย — ใช้ `formatCourseTitle(name, level, room)`
จาก `src/lib/utils.ts` (คืน `"คณิตศาสตร์พื้นฐาน - ม.5/8 (943)"`). `Course.level` แยกจาก
`Course.room` (ห้องกายภาพ เช่น "943"); schedule doc ที่ import เก็บชั้นไว้ที่ field `level`

---

## 🔴 ข้อมูลอ้างอิงบุคคล ต้องผูกด้วย identity ที่แน่นอน ไม่ใช่ string สมมติ

- **ผูกด้วย Firebase Auth UID หรืออีเมลจริงเท่านั้น** ห้ามสร้าง placeholder เช่น `parent_38501`, `teacher-01` แล้วหวังว่าจะ resolve ทีหลัง
- Field ชื่อ `parentUid` (ไม่ใช่ `parentId`) ใช้ให้สอดคล้องกันทุก collection
- Staff document ID = `teacherId` จากไฟล์ import (ไม่ใช่ Auth UID) — ผู้ใช้ผูกกับ staff doc ผ่าน custom claim `staffId` ที่ blocking functions (`functions/src/authBlocking.ts`) ออกให้ตอน login; client อ่าน `staff/{claims.staffId}`, rules ใช้ `request.auth.token.staffId` (ห้ามใช้ `staff/{request.auth.uid}`)
- **ตัวตนบุคลากรที่ login = `user.staffId` (claim `staffId`) เท่านั้น** — ฟิลด์ที่อ้างถึงบุคลากร (`schedules.teacherId`/`teacherIds`, `globalCourses.teacherIds`, `elective_activities_config.responsibleTeacherUids`, `department_config.backupApproverUid` — ชื่อมีคำว่า Uid แต่ไม่ใช่) เก็บ **staff doc id** ห้ามเทียบกับ `user.uid` ให้ใช้ `isSameStaff` / `isStaffIn` / `isStaffAssigned` จาก `src/lib/staffIdentity.ts` เท่านั้น (ไม่มี fallback ไป uid; ไม่มี staffId = ไม่ match). ฝั่ง rules ใช้ `myStaffId()` ห้าม `request.auth.uid in ...`. guard test `staffIdentity.test.ts` สแกน `src/` กันการกลับไปเทียบกับ uid
  - ยกเว้น (ถูกต้องแล้วที่ใช้ uid): ฟิลด์ที่ผู้ใช้เขียนเองด้วย uid และอ่านด้วย uid — `late_attendance_requests.teacherId`, `gradebook_hidden_courses.teacherUid`, `removedBy`, `createdBy`, `counselorUid`, `nurseUid`, `recordedByUid`, และฝั่งนักเรียน/ผู้ปกครองทั้งหมด
  - seed emulator ใช้ staff doc id แบบ teacherId ที่ไม่เท่ากับ uid (`seedStaffIdFor`: `test_advisor_001` → `tch-advisor-001`) เหมือน production — เดิมใช้ uid ทำให้บั๊กนี้ไม่เคยโผล่บน emulator. ตารางสอนที่ import ไว้ก่อนเปลี่ยน (teacherIds = uid เก่า) ต้อง import ใหม่
- สิทธิ์เข้าระบบบังคับที่เซิร์ฟเวอร์: `resolveAccess()` (`functions/src/access.ts`) — ต้อง @utd.ac.th + emailVerified + อยู่ใน staff (roles ไม่ว่าง) หรือ students (field email / `it{studentId}@utd.ac.th`) ไม่งั้นปฏิเสธ; client ห้ามเดา role/ห้าม default role. ทดสอบ blocking functions บน emulator จริงด้วย `npm run emulators:exec:auth` (`firebase.authtest.json` พอร์ตแยก 9399/8299/5299)
- ถ้าจับคู่ตัวตนจากไฟล์ import ไม่ได้ (เช่น หาอีเมล/ชื่อไม่เจอใน staff จริง) **ห้ามเดา/fabricate ID** — ให้บันทึกเป็น `unlinkedTeacherName`/`unlinkedTeacherEmail` พร้อม flag เตือนใน UI ให้ admin ไปเชื่อมเอง
- เปรียบเทียบชื่อห้อง/ชั้นเรียนด้วย `isSameRoom()` utility (ใน `src/lib/utils.ts`) เสมอ ห้ามใช้ `===` ตรงๆ เพราะข้อมูลเก่าปนกันระหว่างฟอร์แมต `ม.5/8` และ `M.5/8`

---

## Environment & Tooling

### Firebase Emulator (local dev)

- ต้องมีไฟล์ `.firebaserc` ระบุ `{"projects":{"default":"kiattisak-project-001"}}` ไม่งั้น emulator จะสร้าง `demo-no-project` ปลอมขึ้นมาใช้แทน ทำให้ seed script กับ client เชื่อมกันคนละ namespace
- ก่อนรัน `npm run emulators` ทุกครั้ง ให้เคลียร์ port ค้างก่อน: `npx kill-port 9099 8080 4000`
- ปิด emulator ด้วย `Ctrl+C` เท่านั้น (trigger `--export-on-exit`) ห้าม force-kill (`Stop-Process -Force`) เพราะข้อมูล seed จะหายและต้อง seed ใหม่ทุกครั้ง
- `.env` ต้องมี `VITE_USE_FIREBASE_EMULATOR=true` และต้อง restart `npm run dev` ทุกครั้งที่แก้ `.env` (Vite อ่านค่าแค่ตอน start)

### PowerShell (Windows)

- Line ending: repo บังคับ LF ด้วย `.gitattributes` (`* text=auto eol=lf`) แต่ working tree บน Windows อาจยังเป็น CRLF — เทสต์ที่อ่านไฟล์ source มาเทียบข้อความต้องใช้ `readSource()` จาก `src/__tests__/helpers/readSource.ts` (แปลง `\r\n`→`\n`) ห้ามใช้ `fs.readFileSync` ตรงๆ; rules tests skip เองเมื่อไม่มี `FIRESTORE_EMULATOR_HOST`/`FIREBASE_STORAGE_EMULATOR_HOST` (รันจริงผ่าน `emulators:exec*`)

- ใช้ `[System.IO.File]::WriteAllText()` เขียนไฟล์ config เสมอ **ห้ามใช้ `Out-File`/`Set-Content -Encoding utf8`** เพราะ PowerShell 5.1 จะแอบใส่ UTF-8 BOM ทำให้ Firebase CLI parse JSON ไม่ผ่าน

---

## กระบวนการรายงานผล (สำคัญมาก)

- **ก่อนสรุปว่างานเสร็จ ให้รัน `git diff --stat` เองเสมอ และแปะ output จริงในคำตอบ** ห้ามบรรยายว่าแก้ไฟล์ใดโดยที่ไฟล์นั้นไม่ปรากฏใน diff จริง
- ถ้าแก้ `firestore.rules` ให้รัน `npm run emulators:exec` ยืนยันว่า regression test ผ่านจริงทุกครั้ง แนบ terminal output จริง ไม่ใช่แค่สรุปคำพูด
- ถ้า commit/push แล้ว ให้แปะ `git log -1` (commit hash) จริงมาด้วย

---

## Business Logic ที่ยืนยันแล้วจากทางโรงเรียน (ใช้เป็นอ้างอิง ไม่ต้องถามซ้ำ)

### ระบบสอนแทน (Substitute Teaching)
- **ลากิจ/ไปราชการ**: ครูที่ลายื่นคำร้องเอง (ผ่าน `detailed_leave_requests`) → cross-reference กับตารางสอนจริงของครูคนนั้น
- **ลาป่วย**: หัวหน้ากลุ่มสาระฯ หรือผู้ได้รับมอบหมายเป็นคนจัดครูในกลุ่มสาระเข้าสอนแทนโดยตรง (ไม่ผ่านคำร้องล่วงหน้า)
- **ลำดับอนุมัติ 4 ขั้น (sequential, ห้าม role เดียวข้ามได้หลายขั้น)**: หัวหน้ากลุ่มสาระ (`HEAD_OF_DEPARTMENT`) → หัวหน้าฝ่ายวิชาการและหลักสูตร → รองผู้อำนวยการฝ่ายวิชาการ → ผู้อำนวยการ
- พออนุมัติสุดท้ายแล้ว คาบสอนต้องไปแสดงที่หน้า TeacherPortal ของครูที่ได้รับมอบหมาย
- ต้องบันทึกหลังการสอน (post-teaching record) **ก่อน 24:00 น. ของวันเดียวกัน** ไม่งั้น flag เป็น overdue
- ข้อมูลนี้ต้องไหลเข้า KPI/PA evaluation ของครูแต่ละคน (`SubstituteTeachingAnalyticsModule.tsx`)

### ไฟล์ตารางภาระงานสอน (Teacher Load Report)
- คอลัมน์ `วัน-คาบที่สอน` ใช้ตัวย่อวันภาษาไทยแบบตัวเดียว: จ=จันทร์, อ=อังคาร, พ=พุธ, **ฤ=พฤหัสบดี (ไม่ใช่ พฤ ตามมาตรฐาน)**, ศ=ศุกร์
- 1 วิชาอาจมีหลายคาบต่อสัปดาห์ (เช่น `อ2, พ4, ฤ1, ศ3`) ต้อง expand เป็นหลาย schedule document แยกกัน
- คาบเลข `0` เป็นคาบจริง (โฮมรูม) **ห้ามใช้ falsy check** (`if (periodNumber)`) เพราะ `0` จะถูกตีความเป็น false แล้วข้อมูลหายไปเงียบๆ — ใช้ `!== undefined && !== null` เสมอ
- คาบเลขสูงกว่า 9 (เช่น 10) มีจริงสำหรับกิจกรรมนอกเวลา ห้าม cap ไว้ที่ 1-9
- ไฟล์ล่าสุดมีคอลัมน์ "อีเมล์" — ใช้จับคู่ครูด้วยอีเมลโดยตรง แม่นยำกว่าการจับคู่ชื่อแบบ fuzzy

### จำนวนนักเรียนต่อห้อง
- ยืดหยุ่นได้ถึง 45 คน (ปกติ 40 อาจมี 41-42 เมื่อมีนักเรียนกลับจากพัก/แลกเปลี่ยน) — ห้าม hardcode เพดาน 40
- ผังที่นั่งต้องเป็นกลุ่ม (group) ที่มี capacity อิสระต่อกลุ่ม ไม่ใช่ template แบบตายตัว (`'2-2-2-2'` เป็น string enum) — ต้องรองรับรูปแบบกลุ่มขนาดต่างกันได้อิสระ
- Seat assignment ต้องเก็บประวัติ (`effectiveFrom`/`effectiveTo`) ไม่ overwrite ทับตอนมีคนย้ายที่นั่ง/กลับมาเรียน

### ข้อมูลผู้ปกครอง (Parent Verification)
- ผู้ปกครอง login ผ่าน LINE ไม่ใช่ email/password — ข้อมูลที่ import ล่วงหน้าคือ "ข้อมูลยืนยันตัวตน" (`parent_verification_records`) ไม่ใช่บัญชี login โดยตรง
- ผูกกับนักเรียนด้วย Student ID (5 หลัก) + เลขบัตรประชาชนผู้ปกครอง (13 หลัก, ต้อง validate checksum จริง) เป็น 2 ปัจจัยยืนยัน
- **ห้ามเก็บเลขบัตรประชาชนแบบ plaintext ใน Firestore เด็ดขาด** ต้อง hash (SHA-256) ก่อนเก็บเสมอ — เป็นข้อมูลอ่อนไหวตาม PDPA
- `linkedParentUid` ต้องเป็น `null` จนกว่าผู้ปกครองจะเชื่อมบัญชี LINE จริงสำเร็จ ห้าม fabricate

### บทบาทเริ่มต้นของครู/บุคลากรที่ import
- ถ้าคอลัมน์ Roles ในไฟล์ import ว่างเปล่า ให้ default เป็น `['SUBJECT_TEACHER']` เสมอ (ตาม workflow จริง: import ตัวบุคคลก่อน ค่อยไปกำหนดบทบาทพิเศษทีหลังที่หน้า "จัดการสิทธิ์บุคลากร")
- ถ้าไฟล์ระบุ Roles มาแล้ว ห้าม override ทับด้วย default

---

## บทเรียนจากการ debug จริง (Environment & Process)

### Windows Firewall บล็อก Firestore Emulator (Java) แบบเงียบๆ
- Auth Emulator รันด้วย Node.js (มักผ่าน firewall เพราะมักมี rule "Node.js JavaScript Runtime" อยู่แล้ว) แต่ **Firestore Emulator รันด้วย Java** ซึ่งอาจไม่มี firewall rule อนุญาตไว้เลย
- อาการ: log ขึ้นว่า "Firestore Emulator was started" สำเร็จปกติ, `netstat` ไม่เจอ port listen, `Test-NetConnection` port 8080 fail แต่ port 9099 (Auth) ผ่าน, `firestore-debug.log` มี `SocketException: Connection reset`
- วิธีเช็ค: `Test-NetConnection -ComputerName 127.0.0.1 -Port 8080` แล้วดู `TcpTestSucceeded`
- วิธีแก้: เปิด PowerShell แบบ Administrator แล้ว `New-NetFirewallRule -DisplayName "Firestore Emulator Port 8080" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow`

### ห้ามสร้าง fallback ที่ปลอมตัวเป็น "login/connection สำเร็จ" เพื่อบัง error จริง
- เคยเจอโค้ด `buildDevUserFromEmail`/`createDevMockUser` ที่ปลอม session เมื่อ Firebase Auth เชื่อมต่อไม่ได้ (gate ด้วย `import.meta.env.DEV` ก็ยังห้าม) — ทำให้ debug ปัญหาจริง (เช่น emulator ไม่รัน, firewall บล็อก) สับสนมาก เพราะดูเหมือน login ผ่านทั้งที่ backend ไม่เชื่อมเลย
- ถ้า auth/connection ล้มเหลว ให้ throw error ตรงๆ แสดงข้อความชัดเจนเสมอ ห้าม fallback แบบเงียบๆ

### ห้าม hardcode รายชื่อ/อีเมลเฉพาะบุคคลเป็น special-case ในโค้ด matching
- เคยเจอ `matchTeacherByEmail()` มี hardcoded `kiattisakEmails` array (รวมอีเมลของคนคนเดียวหลายแบบ) เป็นทางลัดกรณีจับคู่ไม่เจอ — เป็น hack ที่ไม่แก้ปัญหาจริง (root cause มักเป็นเรื่อง stale data) แถมไม่ scale เมื่อมีครูคนอื่นที่ชื่อ/อีเมลไม่ตรงแบบเดียวกัน
- ถ้าจับคู่ไม่เจอ ให้หา root cause จริง (ข้อมูลใน Firestore ยังไม่มี, fetch ยังไม่เสร็จ/เป็นข้อมูลเก่า ฯลฯ) ไม่ใช่เพิ่ม exception list เฉพาะราย

### Fetch ข้อมูลอ้างอิง (เช่น staff list สำหรับจับคู่) ต้องเป็นข้อมูลสดเสมอ
- เคยเจอบั๊ก: `realStaffList` (ใช้จับคู่ครูตอน import ตารางสอน) ดึงด้วย `getDocs()` แค่ครั้งเดียวตอน modal เปิด (`useEffect` ผูกกับ `isOpen`) — ถ้า import ครูสำเร็จแล้วสลับมา import ตารางสอนต่อในหน้าเดียวกันโดยไม่ปิด-เปิด modal ใหม่ จะใช้ข้อมูลเก่าที่ไม่มีครูที่เพิ่ง import
- ข้อมูลอ้างอิงที่ใช้ cross-reference ระหว่างการ import ควรใช้ `onSnapshot` (live listener) แทน `getDocs` ครั้งเดียว หรืออย่างน้อย refetch ทุกครั้งที่เปลี่ยนประเภทข้อมูลที่กำลัง import

### ปิด Firebase Emulator ด้วย `Ctrl+C` เท่านั้น ห้าม force-kill ระหว่างมีข้อมูลสำคัญ
- `npx kill-port` ข้ามขั้นตอน `--export-on-exit` ทำให้ข้อมูล seed/import ที่ยังไม่ได้ export หายทั้งหมด — เคยเป็นสาเหตุที่ทำให้ seed accounts (เช่น `kiattika@utd.ac.th`) หายไปกลางคันระหว่าง debug ปัญหาอื่น
- ใช้ `npx kill-port` เฉพาะตอนหาหน้าต่างเดิมไม่เจอจริงๆ เท่านั้น

---

## เมื่อไม่แน่ใจ

ถามก่อนเดา โดยเฉพาะเรื่อง: role mapping ที่ยังไม่มีใน `UserRole` enum, ความสัมพันธ์ระหว่างฟีเจอร์ที่อาจซ้ำซ้อนกัน, และ business logic ที่ไม่ได้ระบุไว้ในเอกสารนี้
