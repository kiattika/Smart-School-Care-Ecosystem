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
- **เพิ่ม/ปิดการใช้งานบุคลากรรายบุคคล** ผ่าน callable v1 (region เริ่มต้น เหมือน `assignUserRole`) เท่านั้น — `functions/src/staffAdmin.ts`
  - `createStaffMember` (SUPER_ADMIN): ตรวจด้วย `validateNewStaff()` (`functions/src/staffValidation.ts`) — staffId รูปแบบถูกและยังไม่มี, อีเมล normalize + @utd.ac.th + ไม่ซ้ำ staff คนอื่น (รวมคนที่ถูกปิด) + ไม่ใช่อีเมลนักเรียน/รูปแบบ `it{studentId}`, roles ≥ 1 และห้าม STUDENT/PARENT; เขียน staff + mirror teachers, `status: 'ACTIVE'`
  - `setStaffActive({ staffId, active, statusReason, reason })` (SUPER_ADMIN): **ห้ามลบ staff doc ถาวร** (บันทึกย้อนหลังยังอ้างถึง) — ปิด = `status: 'INACTIVE'` + `statusReason` (บังคับ: RETIRED/RESIGNED/TRANSFERRED/ORDERED_TO_LEAVE/DISCIPLINARY_DISMISSAL/DECEASED ตามมาตรา 107 — INACTIVE ต้องมี statusReason ที่ไม่ใช่ ACTIVE เสมอ) + `deactivatedAt/By` + `deactivationReason` (หมายเหตุอิสระ เสริม; บังคับเฉพาะ ORDERED_TO_LEAVE), ล้าง custom claims, revokeRefreshTokens; เปิด = `status: 'ACTIVE'` + `statusReason: 'ACTIVE'` (claims มาตอน login ถัดไป). ตรรกะตรวจอยู่ `functions/src/staffStatusReasons.ts` (สำเนากับ `src/lib/staffStatusReasons.ts` — แก้ต้องแก้ทั้งคู่ มี test เทียบ). บุคลากรที่ปิดไว้ก่อนมีระบบนี้ไม่มี statusReason → UI แสดง "ปิดการใช้งาน". `setActiveError()` ใน `roleGuards.ts`: ห้ามปิดตัวเอง และห้ามปิด SUPER_ADMIN ที่ active คนสุดท้าย
  - `resolveAccess`: staff `status === 'INACTIVE'` → ปฏิเสธ login (`STAFF_INACTIVE`); ไม่มี field status = ACTIVE (ข้อมูลเดิม). `assignUserRole` ปฏิเสธเป้าหมายที่ INACTIVE
  - ฝั่ง client ใช้ `isStaffActive()` (`src/lib/staffStatus.ts`) กรอง**รายการให้เลือก**บุคลากร (ครูรับผิดชอบชุมนุม, ผู้อนุมัติสำรอง, ครูสอนแทน) — ห้ามใช้กรองการแสดงชื่อในประวัติ/บันทึกย้อนหลัง
  - `normalizeEmail` ฝั่ง functions (`functions/src/email.ts`) เป็นสำเนาของ `src/lib/normalizeEmail.ts` — แก้ต้องแก้ทั้งคู่ (มี test เทียบ)
- อีเมลที่เขียนลง `staff` / `teachers` / `students` (รวม `parentEmail`) ต้องผ่าน `normalizeEmail()` (`src/lib/normalizeEmail.ts`: ตัดอักขระล่องหน + trim + lowercase) เสมอ — blocking function ค้นด้วย email แบบตรงตัว
- สคริปต์ maintenance (`npx tsx scripts/<name>.ts`): `normalizeEmails.ts` (แก้อีเมลใน doc เดิม + รายงานอีเมลซ้ำ), `resetAuthClaims.ts` (ล้าง claims + revoke ทุกบัญชี, `--keep <email>` ได้หลายครั้ง) — ทั้งคู่มี `--dry-run` และ**ปฏิเสธการรันถ้าไม่มี emulator env** เว้นแต่ส่ง `--confirm-production <projectId>` (Claude ห้ามรันกับ production เอง)
- **Runtime ของ Cloud Functions = Node 22** (`functions/package.json` → `engines.node: "22"`) — Node 20 ถูกปิด 30 ต.ค. 2026; **ห้ามใช้ 24** เพราะ Node 24 รองรับเฉพาะรุ่นที่ 2 แต่ `assignUserRole` เป็นรุ่นแรกและต้องอยู่ us-central1 (เปิด Cloud Run ใน us-central1 ไม่ได้ — ดูเรื่องโควตาด้านล่าง). Node local เป็น v24 ได้ (emulator แค่เตือน)
- **firebase-functions ต้อง ≥ 7.2.2** (ปัจจุบัน ^7.4.0) — รุ่นเก่ากว่าปฏิเสธ blocking token ที่ `aud` เป็น URL `cloudfunctions.net` ซึ่ง Firebase CLI ใช้ผูก trigger ตอนสร้าง function ครั้งแรก → ทุกคน login ไม่ได้ (`auth/error-code:-47`) เคยเกิดจริงบน production. ตั้งแต่ v6 `import 'firebase-functions'` คือ v2 — `assignUserRole` ต้อง import จาก `'firebase-functions/v1'` และเป็น v1 callable ที่ region เริ่มต้นเสมอ
- **Deploy functions ระบุชื่อเสมอ:** `firebase deploy --only functions:assignUserRole,functions:createStaffMember,functions:setStaffActive,functions:beforeCreate,functions:beforeSignIn` (= `npm --prefix functions run deploy`) — **ห้าม `--only functions` เปล่าๆ** เพราะโปรเจกต์มี function ของ Timetable Scheduler อีก 10 ตัวที่ไม่อยู่ใน repo นี้ CLI จะถามลบ
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
  - การนำเข้าข้อมูลขนาดใหญ่มี**ที่เดียว**: เมนู `'import'` ("ระบบนำเข้าข้อมูลขนาดใหญ่") ใน `AdminPortal` ที่ render `BulkDataImportModal` แบบ inline — หน้าอื่น (จัดการบุคลากร/นักเรียน/ตารางภาระงานสอน) ห้ามเปิด modal นำเข้าเอง ให้รับ prop `onGoToImport` แล้วให้ AdminPortal `goToImport(type)` พาไปเมนูนั้นพร้อมเลือกชนิด (TEACHER/STUDENT/COURSE) ไว้ให้

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

### ช่องวันที่/เวลาใช้ component กลาง (ห้าม `<input type="date">` / `type="time"`)

- วันที่: `src/components/shared/DatePicker` — ค่าเป็น `YYYY-MM-DD` เหมือนเดิม (ห้ามเปลี่ยนรูปแบบข้อมูลใน Firestore); รองรับ `min`/`max`, `required` (validation ของฟอร์มเหมือน input เดิม), `clearable` (ตัวกรองที่ค่าว่าง = ไม่กรอง)
- เวลา: `src/components/shared/TimePicker` — 24 ชั่วโมง (ชั่วโมง 00-23 + นาที) ค่าเป็น `'HH:mm'` เหมือนเดิม (`<input type="time">` บางเบราว์เซอร์/locale แสดงเป็น AM/PM)
- `DatePicker` วางปฏิทินผ่าน **portal ที่ body (position: fixed, พื้นทึบ, z 1000)** และเปิดขึ้นบนเมื่อด้านล่างไม่พอ (`popupPosition.ts`) — ห้ามกลับไปใช้ `absolute` ในกล่องแม่ (เคยถูก overflow ตัดขอบล่างและมีการ์ดอื่นทับจนอ่านไม่ออก)
- ข้อยกเว้นเดียว: ช่องเวลาใน Time Simulation ของ TeacherPortal (DEV-only) — guard test `dateTimeInputsGuard.test.ts` สแกน `src/`

### เมนูย่อยของหน้าบุคลากรใช้ `PortalSidebarLayout` กลาง (ห้ามทำแท็บแนวนอน/แถบเมนูเอง)

- `src/components/shared/PortalSidebarLayout.tsx` — แถบด้านซ้ายแบบเดียวกันทุก portal: จอ lg+ แถบไอคอนแคบ (w-16) ขยายเป็น w-64 เมื่อ hover (หน่วงเวลา) / focus แล้วลอยทับเนื้อหา, ปักหมุดเปิดค้าง (localStorage `ssc.portalSidebar.pinned` แบบ try/catch) แล้วดันเนื้อหา; จอเล็กกว่า lg เป็นลิ้นชักจากซ้าย; `aria-current` + `title` ตอนแถบแคบ
- ใช้แล้วใน StudentPortal, ParentPortal, AdminPortal, TeacherPortal (เฉพาะ view `dashboard` — view `class` / `active_learning` ไม่มีแถบนี้), AdvisorPortal, ExecutivePortal, ApprovalsPortal, InfirmaryPortal, GuidancePortal, SupervisionPortal — คง state/id ของแท็บเดิม
- เมนูที่ซ่อนตามบทบาทกรองด้วย `visibleSidebarItems()` (`hideForRoles`) และแท็บที่ถูกซ่อนกลับไปเมนูแรกด้วย `resolveActiveSidebarId()` (`src/components/shared/portalSidebarLogic.ts`) — guard test `portalSidebar.test.ts`
- StudentPortal / ParentPortal ใช้ `PortalSidebarLayout` เช่นกัน (คง id แท็บเดิม; มือถือเป็นลิ้นชักจากซ้าย)
- FinancePortal ไม่มีเมนูย่อย (หน้าเดียว)

### React: ห้ามใส่ `key` ให้ component ที่ประกาศ props เอง

โปรเจกต์ไม่มี `@types/react` → `<MyCard key={...} />` ล้ม tsc ("Property 'key' does not exist") ให้ห่อด้วย element ที่รับ key ได้ เช่น `<div key={id}><MyCard ... /></div>` — ห้ามติดตั้ง `@types/react` เพื่อแก้เฉพาะหน้า และห้ามใช้ `any` / `@ts-ignore` กลบ

### แสดงรายวิชา+ระดับชั้น+ห้อง ใช้ `formatCourseTitle()` เสมอ

จุดที่โชว์ชื่อวิชาคู่กับห้อง ต้องมีระดับชั้น (ม.5/8) ด้วย — ใช้ `formatCourseTitle(name, level, room)`
จาก `src/lib/utils.ts` (คืน `"คณิตศาสตร์พื้นฐาน - ม.5/8 (943)"`). `Course.level` แยกจาก
`Course.room` (ห้องกายภาพ เช่น "943"); schedule doc ที่ import เก็บชั้นไว้ที่ field `level`

---

## 🔴 ข้อมูลอ้างอิงบุคคล ต้องผูกด้วย identity ที่แน่นอน ไม่ใช่ string สมมติ

- **ผูกด้วย Firebase Auth UID หรืออีเมลจริงเท่านั้น** ห้ามสร้าง placeholder เช่น `parent_38501`, `teacher-01` แล้วหวังว่าจะ resolve ทีหลัง
- Field ชื่อ `parentUid` (ไม่ใช่ `parentId`) ใช้ให้สอดคล้องกันทุก collection
- Staff document ID = `teacherId` จากไฟล์ import (ไม่ใช่ Auth UID) — ผู้ใช้ผูกกับ staff doc ผ่าน custom claim `staffId` ที่ blocking functions (`functions/src/authBlocking.ts`) ออกให้ตอน login; client อ่าน `staff/{claims.staffId}`, rules ใช้ `request.auth.token.staffId` (ห้ามใช้ `staff/{request.auth.uid}`)
- **รูปแบบอีเมลนักเรียนตั้งค่าได้** `{prefix}{studentId}@{domain}` (ค่าเริ่มต้น `it` / `utd.ac.th`) เก็บที่ Firestore `school_settings/studentEmailFormat` (เอกสารเดียว: `prefix`, `domain`) — **ห้ามฝัง `it${id}@utd.ac.th` ในโค้ดอีก**: client ใช้ `useStudentEmailFormat()` + `formatStudentEmail()` (`src/lib/studentEmailFormat.ts`), function อ่านผ่าน `lookups.getStudentEmailFormat` ใน `resolveAccess` (`functions/src/studentEmailFormat.ts` เป็นสำเนา — แก้ต้องแก้ทั้งคู่ มี test เทียบ + test เทียบ regex กับ `firestore.rules`)
  - **path ของ login ห้ามพัง:** ไม่มี doc / อ่านพัง / ค้างเกิน 2 วินาที / ค่าผิดรูปแบบ = ใช้ค่าเริ่มต้นเดิม (ทีละ field) ไม่ throw
  - ด่านโดเมนของ `resolveAccess` ยอมรับ `@utd.ac.th` เสมอ + โดเมนที่ตั้งไว้ใน config **เฉพาะทางนักเรียน** (บุคลากรยังต้อง @utd.ac.th)
  - แก้ได้ที่หน้า "ปีการศึกษา & ล็อกระบบ" (`StudentEmailFormatSection`) เฉพาะ SUPER_ADMIN; มีผลกับนักเรียนที่เพิ่มใหม่ ไม่แก้อีเมลของนักเรียนเดิมย้อนหลัง; rules ตรวจรูปแบบข้อมูล (doc นี้ถูกกันออกจาก wildcard `school_settings/{settingId}` — ห้ามลบเงื่อนไข `settingId != 'studentEmailFormat'`)
  - **ลำดับ deploy:** functions (ระบุชื่อ) → rules → hosting → แล้วค่อยเปลี่ยนค่าในหน้า admin (ถ้าเปลี่ยนโดเมนก่อน function ใหม่ขึ้น นักเรียนโดเมนใหม่จะถูกปฏิเสธที่ด่านโดเมนของ function เก่า) และ Google sign-in ส่ง hint `hd: 'utd.ac.th'` ใน `src/lib/auth.ts` — ถ้าใช้โดเมนนักเรียนอื่นต้องทดสอบหน้าเลือกบัญชีของ Google ด้วย
- **SDQ ผูกปีการศึกษา:** ทุกรายการใหม่ใน `student_assessments_sdq` ต้องมี `academicYear` (4 หลัก ประทับจาก `school_settings/academic_year` — ไม่เดาจากวันที่; ยังไม่ตั้งปี = บันทึกไม่ได้) และ doc id = `sdqDocId()` = `{studentId}_{evaluatorType}_{academicYear}` — rules บังคับทั้งปีปัจจุบันและรูปแบบ id จึงกรอกซ้ำ (นักเรียน, ผู้ประเมิน, ปี) เดียวกันไม่ได้ (ผู้กรอกแก้/ทับไม่ได้; SUPER_ADMIN/GUIDANCE_COUNSELOR ยังสร้าง/แก้ได้) ข้อมูลเก่าไม่มี `academicYear` = "ไม่ระบุปี" ไม่เดาให้. คะแนน/เกณฑ์อยู่ที่ `src/lib/sdq.ts` ที่เดียว (ฟอร์มกลาง `SdqScoreForm`, ครูที่ปรึกษา `AdvisorSdqPanel`, แนวโน้มข้ามปี `sdqTrend.ts`) — **ห้ามตั้งคะแนนเริ่มต้นแทนผู้กรอก** (เคยมีปุ่มบันทึกค่าคงที่ 2/1/2/1/9 ลง Firestore)
- **เกณฑ์แปลผล SDQ** (กรมสุขภาพจิต/สพฐ. คู่มือ "การบริหารจัดการระบบการดูแลช่วยเหลือนักเรียน" หน้า 139-141) อยู่ที่ `SDQ_CRITERIA` ใน `src/lib/sdq.ts` ที่เดียว — **แยกตามผู้ประเมิน** (นักเรียนประเมินตนเอง ≠ ครู/ผู้ปกครองซึ่งใช้ชุดเดียวกัน) และ**แยกรายด้าน** (รวม 4 ด้าน + 4 ด้านปัญหา = ปกติ/เสี่ยง/มีปัญหา, สัมพันธภาพสังคม = มี/ไม่มีจุดแข็ง); `computeSdq(scores, evaluatorType)` ต้องส่งผู้ประเมินเสมอ และเก็บ `triagingStatus` (รวม) + `subscaleStatus` + `criteriaVersion` ลงเอกสาร. ผลเก่าที่ไม่มี `criteriaVersion` = คำนวณด้วยเกณฑ์เดิม **ไม่คำนวณย้อนหลัง** แสดงด้วย `SdqStatusView` พร้อมหมายเหตุ (`isLegacySdqCriteria`) — ห้ามเขียนข้อความสถานะ SDQ ตายตัวในหน้าจอ
  - **SDQ ส่วนที่ 1 กรอกด้วยแบบสอบถาม 25 ข้อจริง** (`SdqQuestionnaireForm` + `src/lib/sdqQuestionnaire.ts`): ผู้ตอบเลือก ไม่จริง/ค่อนข้างจริง/จริง ระบบบวกคะแนน 5 ด้านเอง (ข้อกลับทาง 7, 11, 14, 21, 25; ต้องตอบครบ 25 ข้อ ไม่ครบ = error) แล้วส่งต่อ `computeSdq` — ห้ามกลับไปใช้ช่องพิมพ์ตัวเลขรายด้านเอง; ข้อมูลเก่าที่เก็บเป็นคะแนนรายด้านยังแสดงได้ (ไม่เก็บคำตอบรายข้อ). ข้อความคำถามตรวจกับคู่มือฉบับจริงแล้ว — ฉบับครูใช้ชุดเดียวกับฉบับผู้ปกครอง (คู่มือเขียนหัวข้อ "ครู/ผู้ปกครอง" รวมกัน) ไม่ใช่ค่าชั่วคราว
- **คัดกรองซึมเศร้า/ฆ่าตัวตาย 2Q → 9Q → 8Q** (กรมสุขภาพจิต/สพฐ. ฉบับไทย — **ไม่ใช้ PHQ-9 สากลแล้ว**): ตรรกะ/เกณฑ์/ข้อความอยู่ที่ `src/lib/depressionScreening.ts` ที่เดียว; รายงานการตัดสินใจและ TODO อยู่ที่ `docs/depression-screening.md` (**อ่านก่อนแตะส่วนนี้ — กระทบความปลอดภัยเด็ก**)
  - **9Q เขียนผ่าน callable `submitNineQ` เท่านั้น** (client เขียน 9Q summary/detail/progress ไม่ได้ — rules `allow write: if false`): client ส่งแค่คำตอบดิบ 9 ข้อ เซิร์ฟเวอร์คำนวณ riskLevel/ธงแดงเอง ตรวจผู้เรียก/ฐานเอง และคืนผลให้ครูเท่านั้น (นักเรียนได้ `{success}`); ตรรกะ `functions/src/nineQ.ts` เป็นสำเนาของ `src/lib/depressionScreening.ts` (มี test เทียบ) — **8Q บันทึกได้เสมอ** (ทางฉุกเฉิน ไม่ต้องรอ 9Q) rules คำนวณคะแนน/ระดับ/ส่งต่อด่วนซ้ำเอง
  - **9Q**: นักเรียนทำได้เมื่อมี "ฐานที่ยังไม่ใช้" เท่านั้น (2Q ล่าสุดบวก หรือใบอนุญาต `student_screening_progress/{sid}/grants` ที่ครูเปิดให้) ไม่มีปุ่มทำเองอิสระ; ธงแดง = ข้อ 9 > 0 (แยกจากคะแนนรวม). **8Q**: ครูกรอกแทนเท่านั้น ไม่มีหน้าจอ/สิทธิ์ให้นักเรียน เปิดได้เมื่อ 9Q ล่าสุดรวม ≥7 หรือมีธงแดง. **นักเรียนห้ามเห็นคะแนน/ระดับ/ธงแดงของ 9Q/8Q** (UI ฝั่งนักเรียนห้าม render ค่าเหล่านี้ — guard test `depressionScreening.test.ts`)
  - **สิทธิ์ต้องบังคับที่ rules (Firestore ไม่มีสิทธิ์ระดับ field → แยกเอกสารตามระดับการมองเห็น)**: 9Q สรุป (ระดับ+ธงแดง) / 9Q รายละเอียด (คำตอบ+คะแนน) / 8Q / 8Q-case-flag; ตาราง `screeningCapabilities()` ใน lib ต้องตรงกับ rules (ทดสอบเทียบใน `firestore.screening.rules.test.ts`). ครูที่ปรึกษาเห็นคำตอบ 9Q/เขียน-อ่าน 8Q ได้ก็ต่อเมื่อ**ไม่มี**ครูแนะแนวที่ใช้งานอยู่ — ตัดสินจาก `school_settings/guidance_status` (Cloud Functions คำนวณ: `recomputeGuidanceStatus` หลัง assignUserRole/createStaffMember/setStaffActive/นำเข้าบุคลากร + callable `refreshGuidanceStatus`; client เขียนไม่ได้; **doc ไม่มี = fail-closed ถือว่ามีครูแนะแนว**) — ห้ามลบ `settingId != 'guidance_status'` ใน wildcard ของ `school_settings`
  - ไม่ส่งแจ้งเตือนผู้ปกครองอัตโนมัติ: มีแค่คำเตือนใน UI + บันทึก "แจ้งผู้ปกครองแล้ว" (`student_screening_notices/{sid}/entries` append-only). ห้ามเขียน rules ทดสอบด้วย `emulators:exec` แบบขนาน 2 ไฟล์โดยไม่ใส่ `--no-file-parallelism` (ทั้งคู่ `clearFirestore` ใส่กัน)
  - **SDQ ส่วนที่ 2 (ผลกระทบ / หน้าหลัง)** อยู่ในเอกสารเดียวกัน (field `impact*` optional, ข้อมูลเก่าไม่มี) — `src/lib/sdqImpact.ts`: gate "ไม่" = ข้ามที่เหลือ บันทึก ปกติ (0); "ใช่" ต้องกรอกระยะเวลา (แสดงผลเฉยๆ) + ความไม่สบายใจ + 4 ด้านชีวิตประจำวัน; ไม่เลย/เล็กน้อย=0, ค่อนข้างมาก=1, มาก=2; รวมเต็ม 10: ปกติ 0, เสี่ยง 1-2, มีปัญหา 3-10; ใช้เกณฑ์เดียวกันทั้ง 3 ผู้ประเมิน. คนละมิติกับ 5 ด้าน (ความรุนแรง vs ชนิดของปัญหา) — หน้าจอต้องแสดงแยกกัน (`SdqStatusView`). กรอกผ่าน `SdqEntryForm` + `buildSdqSubmission` เท่านั้น
- **ใบลานักเรียน (`detailed_leave_requests`)** — สายงาน/สถานะ/ข้อความอยู่ที่ `src/lib/leaveFlow.ts` ที่เดียว (ต้องตรง `firestore.rules`): นักเรียนยื่น → `PENDING_PARENT` → ผู้ปกครองกดรับทราบ → `PENDING_TEACHER` → ครูที่ปรึกษาของ `homeroomClass` นั้นตัดสิน (`APPROVED`/`REJECTED`); ผู้ปกครองยื่น หรือนักเรียนที่ยังไม่มีผู้ปกครองเชื่อมบัญชี (`noParentLinked`) → `PENDING_TEACHER` ทันที. เขียน/อ่านผ่าน `createLeaveRequest` / `acknowledgeLeaveRequest` / `decideLeaveRequest` / `subscribeLeaveRequests` (ทุกตัว throw เมื่อเขียนไม่สำเร็จ — ห้ามกลืน error แล้วแจ้งสำเร็จ); **ห้ามกลับไปเก็บสถานะใบลาใน Zustand store** และห้ามฝังชื่อผู้อนุมัติ (บันทึก `decidedBy`/`decidedByStaffId` ของผู้กดจริง). ผู้ยื่น (นักเรียน/ผู้ปกครอง) อนุมัติเองไม่ได้ ข้ามขั้นไม่ได้ ลบไม่ได้ — มีเทสต์ emulator ใน `firestore.rules.test.ts`
- **ใบลาอนุมัติ → ติ๊ก "ลา" ล่วงหน้าในรายการเช็คชื่อของครูประจำวิชา:** `decideLeaveRequest` เมื่ออนุมัติจะเขียน `student_leave_days/{leaveId}` (studentId, homeroomClass, startDate, endDate — **ไม่มีเหตุผล/ประเภทการลา** เพราะอาจเป็นข้อมูลสุขภาพและครูประจำวิชาอ่าน `detailed_leave_requests` ไม่ได้) ใน batch เดียวกับการอนุมัติ; rules (`getAfter`) อนุญาต create เฉพาะพร้อมการอนุมัติจริงและข้อมูลตรงใบลา, แก้/ลบไม่ได้. ฝั่ง UI ใช้ `useLeaveStudentIds(ymd)` + `withLeavePrefill()` (`src/lib/leaveAttendance.ts`) ติ๊ก LEAVE **เฉพาะคนที่ยังไม่มีสถานะ** (สถานะที่บันทึก/โฮมรูมมาก่อนเสมอ ครูแก้เองได้) และ **ห้ามใช้ค่านี้ใน `currentAttendance`** (gate "เช็คคาบนี้แล้ว"). ใบลาที่อนุมัติก่อนมีระบบนี้ไม่มี leave-day doc จึงไม่ถูกติ๊กล่วงหน้า
- **นัดพบครูของผู้ปกครอง (`parent_appointments`)** — สายงาน/ข้อความอยู่ที่ `src/lib/appointmentFlow.ts` ที่เดียว (ต้องตรง `firestore.rules`): ผู้ปกครองตัวจริง (เทียบ `students/{id}.parentUid`) ขอนัด → `REQUESTED` → ผู้รับตอบ `CONFIRMED` (ต้องระบุสถานที่/ลิงก์ https) หรือ `DECLINED` (ต้องมีเหตุผล) → `COMPLETED`; ผู้ปกครองยกเลิกได้ (`CANCELLED`) ลบไม่ได้. ผู้รับ = `recipient`: `HOMEROOM` (ครูที่ปรึกษาของ `homeroomClass`) หรือ `GUIDANCE` (ครูแนะแนว). เขียน/อ่านผ่าน `createAppointmentRequest` / `respondAppointment` / `completeAppointment` / `cancelAppointment` / `subscribeAppointments` (throw เมื่อเขียนไม่สำเร็จ); **ห้ามกลับไปเก็บนัดใน Zustand** และห้ามเปิดลิงก์ที่ไม่ผ่าน `safeMeetingLink()` (กัน `javascript:`). ฝั่งครูใช้ `AppointmentInbox` (AdvisorPortal + แท็บ "นัดพบผู้ปกครอง" ใน GuidancePortal). นัดรุ่นเก่า (ก่อนมีระบบนี้) ไม่มี `studentUid/recipient` จึงไม่แสดง
- **กระดิ่งงานค้างฝั่งบุคลากร** `StaffTaskBell` (ใน `NavbarWithRoleSwitcher`) + `src/lib/staffTasks.ts`: คำนวณสดจากข้อมูลจริงตาม `activeRole` (ไม่ใช่กล่องข้อความ งานจบแล้วหายเอง) ต่อแล้ว: ใบลารอครูที่ปรึกษา (HOMEROOM_TEACHER), คำขอเช็คชื่อย้อนหลังรอรองผอ.วิชาการ (DEPUTY_DIRECTOR_ACADEMIC/SUPER_ADMIN). คัดกรองสุขภาพจิตของ GUIDANCE_COUNSELOR/HOMEROOM_TEACHER (`src/lib/screeningTasks.ts` + `useScreeningBellData`; **แสดงเฉพาะจำนวน ห้ามใส่ชื่อ/ผลในกระดิ่ง**): 2Q บวก → หายเมื่อนักเรียนส่ง 9Q; 9Q ธงแดง → หายเมื่อบันทึก "แจ้งผู้ปกครองแล้ว" (scope 9Q) หรือ "พบนักเรียนแล้ว" (`student_screening_followups/{sid}/entries`, append-only) ผูกกับ id ของผล 9Q ฉบับนั้น; ครูที่ปรึกษา list ทั้ง collection ไม่ได้ จึงอ่านรายคนของห้องตัวเอง (ไม่ live: โหลดตอน mount/เปิดกระดิ่ง/หลังบันทึก/ทุก 5 นาที). คำขอนัดพบจากผู้ปกครอง (ครูที่ปรึกษา = recipient HOMEROOM ของห้องฉัน, ครูแนะแนว = recipient GUIDANCE) นับเฉพาะ `REQUESTED`. จัดครูสอนแทน: รออนุมัติในขั้นของ activeRole + รอฉันยืนยันเป็นครูสอนแทน (อ่านจาก `store.substituteAssignments` ที่ sync อยู่แล้ว). **ข้อความแจ้งผลการอนุมัติระหว่างบุคลากร** = `staff_notifications` (ผู้รับตามอีเมล lowercase ตรง `token.email`; อ่านได้เฉพาะผู้รับ, ผู้รับแก้ได้แค่ `readAt`, ลบไม่ได้; บุคลากรทุกบทบาทส่งได้โดย `senderUid == auth.uid`) สร้างจาก `src/lib/staffNotifications.ts` ผ่าน `sendStaffNotifications` (non-fatal, เขียนทีละรายการ) — ใช้กับผลคำขอเช็คชื่อย้อนหลังและผลจัดครูสอนแทน; แสดงเป็นส่วน "ข้อความ" ใน `StaffTaskBell` และนับรวมที่ป้าย. **แจ้งเตือนฝั่งนักเรียน/ผู้ปกครอง** (`parent_notifications` ผ่าน `createParentNotification` — ข้ามเฉพาะเมื่อไม่มีทั้ง parentUid และ studentUid; แนะแนว/การเงินเขียนได้): ผลใบลา, ผู้ปกครองรับทราบใบลา, ผลแฟ้มสะสมผลงาน, ออกบิล/ยืนยันชำระ/สลิปไม่ผ่าน (`src/lib/studentNotices.ts`). **ห้ามแจ้งนักเรียนเรื่องคัดกรองสุขภาพจิต/9Q**.
- **ตัวตนบุคลากรที่ login = `user.staffId` (claim `staffId`) เท่านั้น** — ฟิลด์ที่อ้างถึงบุคลากร (`schedules.teacherId`/`teacherIds`, `globalCourses.teacherIds`, `elective_activities_config.responsibleTeacherUids`, `department_config.backupApproverUid` — ชื่อมีคำว่า Uid แต่ไม่ใช่) เก็บ **staff doc id** ห้ามเทียบกับ `user.uid` ให้ใช้ `isSameStaff` / `isStaffIn` / `isStaffAssigned` จาก `src/lib/staffIdentity.ts` เท่านั้น (ไม่มี fallback ไป uid; ไม่มี staffId = ไม่ match). ฝั่ง rules ใช้ `myStaffId()` ห้าม `request.auth.uid in ...`. guard test `staffIdentity.test.ts` สแกน `src/` กันการกลับไปเทียบกับ uid
  - ยกเว้น (ถูกต้องแล้วที่ใช้ uid): ฟิลด์ที่ผู้ใช้เขียนเองด้วย uid และอ่านด้วย uid — `late_attendance_requests.teacherId`, `gradebook_hidden_courses.teacherUid`, `removedBy`, `createdBy`, `counselorUid`, `nurseUid`, `recordedByUid`, และฝั่งนักเรียน/ผู้ปกครองทั้งหมด
  - seed emulator ใช้ staff doc id แบบ teacherId ที่ไม่เท่ากับ uid (`seedStaffIdFor`: `test_advisor_001` → `tch-advisor-001`) เหมือน production — เดิมใช้ uid ทำให้บั๊กนี้ไม่เคยโผล่บน emulator. ตารางสอนที่ import ไว้ก่อนเปลี่ยน (teacherIds = uid เก่า) ต้อง import ใหม่
- สิทธิ์เข้าระบบบังคับที่เซิร์ฟเวอร์: `resolveAccess()` (`functions/src/access.ts`) — ต้อง @utd.ac.th + emailVerified + อยู่ใน staff (roles ไม่ว่าง) หรือ students (field email / รูปแบบอีเมลนักเรียนตาม config ด้านล่าง) ไม่งั้นปฏิเสธ; client ห้ามเดา role/ห้าม default role. ทดสอบ blocking functions บน emulator จริงด้วย `npm run emulators:exec:auth` (`firebase.authtest.json` พอร์ตแยก 9399/8299/5299)
- ถ้าจับคู่ตัวตนจากไฟล์ import ไม่ได้ (เช่น หาอีเมล/ชื่อไม่เจอใน staff จริง) **ห้ามเดา/fabricate ID** — ให้บันทึกเป็น `unlinkedTeacherName`/`unlinkedTeacherEmail` พร้อม flag เตือนใน UI ให้ admin ไปเชื่อมเอง
- เปรียบเทียบชื่อห้อง/ชั้นเรียนด้วย `isSameRoom()` utility (ใน `src/lib/utils.ts`) เสมอ ห้ามใช้ `===` ตรงๆ เพราะข้อมูลเก่าปนกันระหว่างฟอร์แมต `ม.5/8` และ `M.5/8`

---

### รูปเซลฟี่เช็คอิน (PDPA) — แยกเอกสาร หมดอายุเอง 30 วัน

- รูปเก็บที่ `gps_checkin_selfies/{logId}` (ไม่ฝังใน `gps_check_in_logs`/`gate_attendance_logs` — เอกสารเช็คอินเล็ก อ่านเร็ว) มี `expireAt` ให้ **Firestore TTL** ลบเอง (`src/lib/selfieRetention.ts`, 30 วัน; rules บังคับ ≤ 31 วัน) — **ต้องเปิด TTL policy ที่ Firebase Console ครั้งเดียว:** collection group `gps_checkin_selfies`, field `expireAt` (ถ้าไม่เปิด รูปไม่ถูกลบ)
- log มี `hasSelfie: true`; ครูที่ปรึกษากด "ดูรูป" ในแผงพิกัด GPS (โหลดตอนกดเท่านั้น); อ่านได้เฉพาะเจ้าของ/SUPER_ADMIN/ครูที่ปรึกษาของ `homeroomClass` นั้น (ค่าว่าง = ไม่ผ่าน); สร้างได้แค่เจ้าของ ห้ามแก้ ลบได้เฉพาะ SUPER_ADMIN. log รุ่นเก่าที่ฝัง `selfieUrl` ยังแสดงได้
- แผงครูที่ปรึกษาดึง `gps_check_in_logs` **เฉพาะนักเรียนในห้อง ย้อนหลัง 7 วัน** (`subscribeGpsCheckInLogsForUsers`, ต้องมี composite index `userId+date` ใน `firestore.indexes.json`) — ห้าม query ทั้งโรงเรียน (3,000 คน × หลายวัน = หลายหมื่นเอกสารต่อการเปิดหนึ่งครั้ง)

### คะแนนกิจกรรมรายวิชา (Active Learning) ≠ คะแนนความประพฤติ

- คะแนนที่ครูให้จากกิจกรรมในคาบ (สุ่มตอบ/ทำงานกลุ่ม +1/+2/+5) เป็น **คะแนนต่อวิชา** เก็บที่ `active_learning_logs` (`courseId`, `courseName`, `teacherStaffId`, `academicYear`, `term`) — ครูผู้สอนวิชานั้นใช้ประกอบคะแนนจิตพิสัย/มอบเครื่องหมายเชิดชู. **ห้ามเรียก `adjustBehaviorScore`/`updateBehaviorScoreAndTriggerAlert` จากกิจกรรมนี้** (เคยทำให้คะแนนความประพฤติเปลี่ยนและส่งแจ้งเตือน "แจ้งผลคะแนนพฤติกรรม" ผิดความหมายถึงนักเรียน/ผู้ปกครอง) — guard test `courseRank.test.ts`
- แรงค์/เครื่องหมายเชิดชูคิดจากคะแนนสะสมของ**วิชานั้นตลอดภาคเรียน** (`src/lib/courseRank.ts`: ตารางเริ่มต้นเทียบเคียงลำดับขั้นเกมแข่งขัน ปรับศัพท์ระดับสูงเป็น ปราชญ์/ยอดเมธี/เมธีเอก/เมธีอมตะ); แอดมิน (SUPER_ADMIN) แก้ได้ที่หน้า "ปีการศึกษา & ล็อกระบบ" → `school_settings/course_rank_levels` (ไม่มี/ผิดรูปแบบ = ค่าเริ่มต้น). log รุ่นเก่าไม่มี `term` ใช้วันที่ให้คะแนนคำนวณภาคเรียน
- **สิทธิ์อ่าน** (rules): SUPER_ADMIN, EXECUTIVE, ครูผู้ให้ (`teacherStaffId == claim staffId`), นักเรียนเจ้าของ (`isSelfStudent(studentId)`), **ผู้ปกครองตัวจริง** (`students/{studentId}.parentUid` ตาม registry ไม่ใช่สำเนาใน log), **ครูที่ปรึกษาของห้อง** (`homeroomClass` ใน log + `isHomeroomTeacherOf`) — ไม่เปิด signed-in ทั่วไปอีก; query ต้อง `where('teacherStaffId','==',staffId)` (ครู) / `where('studentId','==',id)` (นักเรียน/ผู้ปกครอง) / `where('homeroomClass','==',ห้อง)` (ครูที่ปรึกษา) / ทั้งโรงเรียนเฉพาะ EXECUTIVE; **ทุกจุดที่ให้คะแนนต้องส่ง `homeroomClass: student.room`** (create ตรวจกับ `students.room` กัน denormalize มั่ว); log รุ่นเก่าไม่มี `teacherStaffId`/`homeroomClass` ครู/ครูที่ปรึกษาจึงไม่เห็น.
- **หน้าจอ**: `CourseOverviewCards` (นักเรียน+ผู้ปกครอง) = แถวต่อวิชา บนสถิติเข้าเรียน ล่างคะแนน+เครื่องหมายเชิดชู (`src/lib/courseOverview.ts` จับคู่ด้วยรหัสวิชาใน courseKey); `AdvisorActivityPointsChart` = กราฟแท่งคะแนนรวมรายบุคคลในเมนู "สถิติวิชาการ" ของครูที่ปรึกษา ครูแก้/ลบย้อนหลังไม่ได้ (เฉพาะ SUPER_ADMIN)
- **คะแนนแยกอิสระรายวิชา**: `courseId` (`course_<scheduleId>`) เป็นรายคาบ วิชาเดียวกันหลายคาบจึงมีหลาย id → จัดกลุ่มด้วย `courseKey = รหัสวิชา|ชั้น` (`courseActivityKey`, ชุมนุมใช้ id ชุมนุม) เก็บใน log; UI ครูอ่านผ่าน `useCourseActivityPoints` (ห้ามใช้ `store.activeLearningPoints` ซึ่งเป็นยอดรวมทุกวิชาในเซสชัน); log เก่าไม่มี `courseKey` ใช้ `courseId` ตรงเท่านั้น
- **คาบที่สิ้นสุดแล้ว** (PAST) แสดงเฉพาะสถานะเช็คชื่อ ไม่มีปุ่ม "เข้าสู่ชั้นเรียน" (guard test)

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
- **ห้ามเก็บเลขบัตรประชาชนแบบ plaintext ใน Firestore เด็ดขาด** — เก็บเป็น HMAC-SHA256 (`parentNationalIdHmac`) ที่คำนวณ "ฝั่งเซิร์ฟเวอร์" ด้วย secret `PARENT_ID_PEPPER` เท่านั้น (SHA-256 เปล่าๆ ฝั่ง client เดาย้อนได้ง่ายเพราะเลขบัตรมี 13 หลักตาม checksum) เป็นข้อมูลอ่อนไหวตาม PDPA
- `parent_verification_records` เขียนจาก client ไม่ได้ (rules `write: false`) — เขียนผ่าน callable เท่านั้น: `importParentVerification` (SUPER_ADMIN), `linkParentLine`, `unlinkParentLine`; ผู้ปกครองกลับมาเข้าใหม่ผ่าน `signInParentLine` (ตรวจ `students.parentUid == uid` ทุกครั้ง) — code ใน `functions/src/parentLine.ts`, logic ล้วนใน `parentLineLogic.ts`
- ⚠️ blocking functions (`beforeCreate`/`beforeSignIn`) **ไม่ถูกเรียกเมื่อ sign in ด้วย custom token** — claims `{roles:['PARENT']}` ของผู้ปกครองจึงออกจาก callable เอง (uid = `line_<LINE sub>`) ห้ามคาดหวังให้ `resolveAccess` ดูแลผู้ปกครอง
- คู่มือตั้งค่า LINE สำหรับแอดมิน: `docs/line-parent-login.md`
- ⚠️ `createCustomToken` ต้องมีสิทธิ์ลงนาม: บัญชีบริการ `<project>@appspot.gserviceaccount.com` ต้องมีบทบาท Service Account Token Creator (+ เปิด IAM Credentials API) ไม่งั้น callable ล้มด้วย `iam.serviceAccounts.signBlob denied`
- พอร์ทัลผู้ปกครอง: ไม่มีปุ่มเช็คอิน GPS (ทั้งแถบบนและปุ่มลอย `QuickActionHub` — ซ่อนด้วย `activeRole === 'PARENT'` ทั้งสองจุด); แท็บคัดกรองอารมณ์เป็น "ดูอย่างเดียว" (ระดับ 2Q + รายการที่ครูแจ้งผู้ปกครอง ไม่แสดงคำตอบรายข้อ/หมายเหตุภายใน, ไม่เห็น 9Q/8Q); เมนูประตูไม่มีแท็บสถิติการเข้าเรียน (ผู้ปกครอง+นักเรียน) — สถิติรายวิชาอยู่ที่ `CourseOverviewCards`; ข้อ 13 ในแบบเยี่ยมบ้านเลือก บิดา/มารดา/อื่น ๆ (บิดา/มารดาใช้ข้อมูลข้อ 7/8)
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

## แชทห้องเรียน (แยกช่องส่วนตัว) — class_messages / class_chat_threads
- ช่อง `PARENT` = ครูประจำชั้น ↔ ผู้ปกครอง, ช่อง `STUDENT` = ครูประจำชั้น ↔ นักเรียน; แต่ละช่องมองไม่เห็นกัน (rules ผูกด้วย `memberUid` = `students/{sid}.parentUid|studentUid`, และ `isHomeroomTeacherOf(room)`) — SUPER_ADMIN อ่านไม่ได้โดยตั้งใจ
- ข้อความแก้/ลบไม่ได้; thread id = `{studentId}_{channel}`; ยังไม่อ่านคำนวณจาก `lastAt/lastSenderRole` เทียบ `memberLastReadAt/teacherLastReadAt` (src/lib/classChat.ts)
- query ต้องกรอง `memberUid == uid` (ผู้ปกครอง/นักเรียน) หรือ `room == ห้อง` (ครู) + studentId + channel
- UI: `src/components/chat/ClassChatPanel.tsx`; เมนูแยกใน ParentPortal/StudentPortal (ชำระเงิน | สนทนากับครู | นัดพบครู) และ AdvisorPortal (`class-chat`); `ParentEngagementServices` รับ prop `section` ('billing'|'appointment')
- คอลเลกชันเดิม `parent_teacher_messages` เลิกใช้ (ไม่ลบข้อมูลเก่า)

## หน้ามือถือ (PWA) `/m`
- ติดตั้งลงหน้าจอหลักได้ (`public/manifest.webmanifest`, ไอคอน `public/icons/`, `start_url: /m`); `App.tsx` ส่ง `/m` ไป `MobileApp` **หลังล็อกอินเท่านั้น** (ยังไม่ล็อกอิน = หน้า Login ปกติ)
- เมนูตามบทบาทอยู่ที่ `src/mobile/mobileMenu.ts` (เช็คอินเข้าโรงเรียน=GPS modal เดิม, ตารางวันนี้, เช็คชื่อโฮมรูม [ใช้ `useHomeroomAttendance` ตัวเดียวกับหน้าครูที่ปรึกษา], พิกัดบ้านนักเรียน [`StudentHomeLocationForm` เดิม], ข้อความ [`ClassChatPanel`]) — งานอื่นเปิดเว็บเต็มด้วยลิงก์ `/`
- `public/sw.js`: แคชเฉพาะเปลือกแอปของโดเมนเรา; **ห้ามแตะคำขอข้ามโดเมน (Firestore/Auth/Functions/Storage) และ `/__/`**; เวอร์ชันใหม่รอผู้ใช้กด "อัปเดต" (SKIP_WAITING) ไม่ skipWaiting เอง; ลงทะเบียนเฉพาะ production บน https (`src/lib/pwa.ts`); `firebase.json` ตั้ง `/sw.js` เป็น no-cache — เปลี่ยนไฟล์แคชต้องขยับ `VERSION` ใน sw.js
- เมนูแบบประเมินบนมือถือ (`mobileMenuFor({due})`, `src/lib/mobileDue.ts`, `src/mobile/useMobileDue.ts`): สุขภาพรายภาคเรียน/SDQ รายปีการศึกษา **หายจากหน้าหลักเมื่อทำแล้ว**, 2Q โผล่เมื่อครบ 14 วันนับจากครั้งล่าสุด (ฝั่ง client เท่านั้น ไม่ได้บังคับที่ rules) — ยังไม่รู้สถานะ = ซ่อนไว้ก่อน; หน้าจอใช้ฟอร์มเดิมของเว็บผ่าน prop `onlyTab` (HealthMentalWellbeingModule / GateAttendanceTracker) ห้ามเขียนฟอร์มซ้ำ
- ผู้ปกครองที่เข้าทาง LINE: LIFF Endpoint URL ตั้งไว้ที่ `/` — การล็อกอิน LINE ทำที่หน้าแรกตามเดิม; `/m` สำหรับผู้ที่ล็อกอินแล้ว (ตรวจในเครื่องจริงก่อนแนะนำให้ผู้ปกครองติดตั้ง)

## ช่วงเวลารับสมัครชุมนุม + นับถอยหลัง
- `elective_activities_config.enrollmentOpensAt/ClosesAt` (Firestore Timestamp, ว่าง = ไม่จำกัดด้านนั้น): สถานะจริงต้องคำนวณด้วย `enrollmentState()` (`src/lib/enrollmentWindow.ts`) เท่านั้น — **ห้ามเทียบ `enrollmentStatus` อย่างเดียว**; rules บังคับด้วยเวลาเซิร์ฟเวอร์ (`activityEnrollmentOpen`: สมัคร/สมัครใหม่หลังถอน) ถอนตัวไม่ผูกช่วงเวลา
- ตั้งช่วงเวลาได้โดย SUPER_ADMIN/ACADEMIC_HEAD (หน้าชุมนุมของแอดมิน) และ **ครูรับผิดชอบชุมนุมนั้น** (`ResponsibleClubWindowCard` ใน TeacherPortal; rules ให้แตะได้แค่ enrollmentStatus/OpensAt/ClosesAt); ใช้ `DatePicker`+`TimePicker` เท่านั้น
- ตัวนับถอยหลังกลาง `DeadlineCountdown` (เหลือ ≤ 24 ชม. เหลือง, ≤ 1 ชม. แดง) ใช้กับชุมนุม + `GradeLockCountdownBanner` (อ่าน `school_settings/system_locks` ผ่าน `useGradeLocks`, ตรรกะ `src/lib/gradeLockWindow.ts`); เมนู "สมัครชุมนุม" บนมือถือโผล่เฉพาะตอนมีชุมนุมเปิดรับอยู่ (`due.clubOpen`)
- ชุมนุมที่ "ปิดแล้ว" (สั่งปิดหรือเลยเวลาปิด) เข้าตารางสอนครูรับผิดชอบ (`isEnrollmentClosed`)

## ข้อมูลสุขภาพประจำตัว (โรคประจำตัว / แพ้ยา-อาหาร / ดูแลพิเศษ) — `student_health_profiles/{studentId}`
- **ครอบครัว (นักเรียนเจ้าของ/ผู้ปกครองตัวจริง) เป็นผู้กรอก; พยาบาล (INFIRMARY_STAFF/SUPER_ADMIN) ยืนยันได้อย่างเดียว** (แตะได้เฉพาะ `verifiedAt/By/Name`); ครอบครัวแก้ทุกครั้งตรายืนยันถูกล้าง (rules บังคับ `verifiedAt == null`); อ่านได้: ครอบครัว/พยาบาล/แอดมิน/ครูที่ปรึกษาของห้อง; ลบไม่ได้
- UI: `HealthProfileSection` (นักเรียน+ผู้ปกครอง ผ่าน HealthMentalWellbeingModule), `InfirmaryHealthProfilePanel` (พยาบาล); ตรวจเนื้อหารายการที่ client (`src/lib/healthProfile.ts`) เพราะ rules วนตรวจฟิลด์ในรายการไม่ได้
- ❌ `store.chronicIllnesses/allergies/specialCareNeeds` ว่างเสมอ (ไม่มีใครเขียน) — ห้ามกลับไปอ่านจากตรงนั้น; แท็บ "ข้อมูลโรคประจำตัว" ของพยาบาลเคยโชว์ข้อมูลปลอมตายตัวกับนักเรียนทุกคน (guard test `healthProfile.test.ts`)

## หมู่เลือด — `student_blood_type/{studentId}` (เลือกครั้งเดียว)
- หมู่เลือดไม่เปลี่ยนตลอดชีวิต: นักเรียน/ผู้ปกครองตัวจริง **create ได้ครั้งเดียว** (A/B/AB/O) แล้วล็อก; แก้/เปลี่ยนได้เฉพาะ INFIRMARY_STAFF/SUPER_ADMIN (rules: update ไม่รวม self/parent; ลบไม่ได้) — UI `BloodTypeCard` (ฟอร์มน้ำหนัก/ส่วนสูงของนักเรียน, HealthProfileSection ฝั่งผู้ปกครอง, แผงพยาบาล `canChange`)
- ❌ ห้ามให้พิมพ์หมู่เลือดอิสระ/เก็บซ้ำในที่อื่น: ฟอร์มเยี่ยมบ้านข้อ 3 ดึงหมู่เลือด + น้ำหนัก/ส่วนสูงล่าสุดจากข้อมูลสุขภาพ (`pickHealthPrefill`); หมู่เลือดที่ล็อกแล้วแสดงอ่านอย่างเดียวในแบบเยี่ยมบ้าน

## ⚠️ studentUid/parentUid ในเอกสารที่ rules ตรวจกับทะเบียน
- `useRealStudents` ตั้ง `student.parentUid = data.parentUid || data.parentId` (alias) แต่ rules เทียบกับ `students/{id}.parentUid` จริง (ไม่มี = null) → ส่งค่า alias แล้ว **permission-denied** (อาการ: นักเรียนบันทึกน้ำหนัก/ส่วนสูงไม่ได้)
- **เอกสารค้างของบัญชีเก่า:** นักเรียนทดสอบที่ถูกผูกบัญชีใหม่ (uid เปลี่ยน) ทำให้ `student_semester_health/{id}_{ปี}_{เทอม}` เดิมมี `studentUid` เก่า → นักเรียนมองไม่เห็นและเขียนทับไม่ได้ (permission-denied; ฟอร์มยังแสดงช่องกรอก). rules มีกฎ update พิเศษให้นักเรียนตัวจริงเขียนทับได้ครั้งเดียว (เฉพาะ `resource.data.studentUid != auth.uid`, ภาคเรียน/รหัสเดิม, ข้อมูลตรงทะเบียน); เอกสารอื่นที่ผูก studentUid เดิมอาจมีอาการเดียวกัน — อาการจริงดูได้จาก Console `[Firestore Diagnostic Error]` (มี path + userId)
- ต้องใช้ `getStudentLinkIds(studentId)` (อ่านทะเบียนจริง) เมื่อสร้างเอกสารที่ rules บังคับ studentUid/parentUid ตรงทะเบียน (`saveSemesterHealthLog`, `saveStudentHealthProfile`, `setStudentBloodType`); ห้ามใช้ `student.parentId` เป็น parentUid

## ผู้ติดต่อฉุกเฉิน — `student_emergency_contacts/{studentId}`
- ดึงจากแบบเยี่ยมบ้านฝั่งผู้ปกครอง (บิดา/มารดา/ผู้ปกครอง ที่มีเบอร์ใช้ได้; ตัดผู้เสียชีวิตและเบอร์ซ้ำ) ผ่าน `deriveEmergencyContacts()` (`src/lib/emergencyContacts.ts`) — ห้ามใส่ชื่อ/เบอร์ตายตัว
- เป็น **สำเนาเฉพาะชื่อ-ความสัมพันธ์-เบอร์** เพราะ `home_visit_family_info` มีรายได้/ครัวเรือน → ❌ ห้ามเปิดสิทธิ์อ่านเอกสารเยี่ยมบ้านให้ INFIRMARY_STAFF
- `saveFamilyHomeVisitInfo` เขียนทั้งสองเอกสารใน batch เดียว; `FamilyHomeVisitInfoForm` ซิงก์ให้เองครั้งเดียวสำหรับผู้ปกครองที่เคยบันทึกก่อนมีฟีเจอร์ (ข้อมูลเก่าจะขึ้นเมื่อผู้ปกครองเปิดฟอร์ม); เขียน: ผู้ปกครองตัวจริงเท่านั้น; อ่าน: พยาบาล/แอดมิน/ครูที่ปรึกษา/ผู้ปกครอง; ลบไม่ได้
- UI พยาบาล: `InfirmaryEmergencyContactsPanel` (แท็บข้อมูลโรคประจำตัว); ไม่มีข้อมูล = แจ้งว่าผู้ปกครองยังไม่ได้กรอก

## คลังยาห้องพยาบาล — infirmary_medicines / infirmary_stock_movements
- ยอดคงเหลือ (`stock`) เปลี่ยนได้เฉพาะพร้อม "รายการเคลื่อนไหว" (append-only) ใน batch/transaction เดียวกัน: ยาชี้ movement ล่าสุดด้วย `lastMovementId`, rules ตรวจด้วย `getAfter` (`balanceAfter == stock`, `delta == stock - เดิม`, ชนิด/เครื่องหมาย delta ตรงกัน, `byUid == auth.uid`, ยอดไม่ติดลบ) — ชนิด INITIAL/RESTOCK/DISPENSE/DISCARD/ADJUST (`src/lib/infirmaryStock.ts`)
- การจ่ายยาในบันทึกเคสห้องพยาบาลตัดสต็อกใน transaction เดียวกับเคส+แจ้งเตือนผู้ปกครอง (`recordInfirmaryVisit({dispensed})`); รับเข้า/ทิ้ง/ปรับยอดผ่าน `changeMedicineStock`; ห้ามลบยา (ปิดด้วย `active=false`)
- อ่านได้เฉพาะ SUPER_ADMIN / INFIRMARY_STAFF / EXECUTIVE; ห้ามมีรายการยาตัวอย่างในโค้ด (guard test `infirmaryStock.test.ts`)

## เรดาร์โดดเรียน (ครูประจำชั้น)
- คำนวณสดจาก `attendance_records` รายคาบ ไม่มีที่เก็บข้อมูลใหม่ (`src/lib/skipRadar.ts`): โดด = วันเดียวกันมี PRESENT/LATE ในเอกสารอื่น แต่ ABSENT ในคาบ ≥ 1; ขาดทั้งวัน/ลาไม่นับ; เกณฑ์ เฝ้าระวัง ≥2 / ควรติดตาม ≥4 ครั้ง เป็นค่าเริ่มต้นที่ยังไม่ยืนยันจากโรงเรียน
