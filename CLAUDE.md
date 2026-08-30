# CLAUDE.md — กฎและบริบทของโปรเจกต์ Smart School Care Ecosystem

อ่านไฟล์นี้ก่อนเริ่มงานทุกครั้ง กฎเหล่านี้มาจากปัญหาจริงที่เคยเกิดขึ้นในโปรเจกต์นี้ — อย่าทำซ้ำ

## ภาพรวมโปรเจกต์

ระบบบริหารจัดการสถานศึกษา (Uttaradit School) — React 19 + TypeScript + Vite + Zustand + Firebase (Auth + Firestore) รองรับ Teacher/Advisor/Executive/Admin/Parent/Student portal หลายบทบาท

- Firebase Project ID: `kiattisak-project-001` (ดูจาก `firebase-applet-config.json` field `projectId` — **ห้ามสับสนกับ `firestoreDatabaseId`** ซึ่งเป็นคนละ field คนละวัตถุประสงค์ เคยทำให้ seed script กับ client เชื่อมกันคนละ namespace มาแล้ว)
- Firestore ใช้ named database (ไม่ใช่ default) — ต้องระบุ `firestoreDatabaseId` ตอนเรียก `getFirestore()`
- Node.js local คือ v24 แต่ Cloud Functions Gen 1 ต้องการ ≤ Node 20 — ระวังเวลา deploy Functions

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
- ห้ามสร้างฟีเจอร์ import/data-entry ซ้ำซ้อนหลายชุดสำหรับงานเดียวกัน — ถ้ามี component จริงอยู่แล้ว (เช่น `BulkDataImportModal.tsx`) ให้ reuse ไม่สร้างใหม่

---

## 🔴 ข้อมูลอ้างอิงบุคคล ต้องผูกด้วย identity ที่แน่นอน ไม่ใช่ string สมมติ

- **ผูกด้วย Firebase Auth UID หรืออีเมลจริงเท่านั้น** ห้ามสร้าง placeholder เช่น `parent_38501`, `teacher-01` แล้วหวังว่าจะ resolve ทีหลัง
- Field ชื่อ `parentUid` (ไม่ใช่ `parentId`) ใช้ให้สอดคล้องกันทุก collection
- Staff/teacher document ID **ต้องเป็น Firebase Auth UID จริง** (`staff/{uid}`) ไม่ใช่ ID จากไฟล์ CSV/Excel ที่ import มา (เช่น `teacher-01`) — เพราะระบบ auth (`buildAppUser`) ค้นหา role จาก `staff/{fbUser.uid}` โดยตรง
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

---

## เมื่อไม่แน่ใจ

ถามก่อนเดา โดยเฉพาะเรื่อง: role mapping ที่ยังไม่มีใน `UserRole` enum, ความสัมพันธ์ระหว่างฟีเจอร์ที่อาจซ้ำซ้อนกัน, และ business logic ที่ไม่ได้ระบุไว้ในเอกสารนี้
