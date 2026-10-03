# รายการสำรวจข้อมูลปลอม — รอบ B

สำรวจระหว่างงานรอบ A (branch `chore/remove-mock-leftovers`, 2026-10-03) ตามกฎ no-fake-data ใน `CLAUDE.md`:
ทุกจุดที่หน้าจอแสดงข้อมูลที่ไม่ได้มาจาก Firestore หรือแสดงว่าทำสำเร็จโดยไม่ได้บันทึกจริง

- เลขบรรทัดอ้างอิงโค้ด ณ ตอนสำรวจ — อาจเลื่อนเมื่อแก้ไฟล์ ให้ค้นด้วยชื่อตัวแปร/ข้อความประกอบ
- "ยังไม่มี data path" = ยังไม่มี collection/field ใน Firestore ที่เก็บข้อมูลนี้ ต้องออกแบบก่อนแก้
- รอบ A แก้ไปแล้ว (ไม่อยู่ในรายการนี้): ค่าสำรองตัวตนผู้ใช้/ห้อง `ม.5/8`/จำนวนนักเรียน/ป้ายห้อง,
  ปุ่มจำลองที่เขียน Firestore, seed ฝั่ง client, debug log — มี guard test `src/__tests__/noFakeDataGuard.test.ts`

| ไฟล์:บรรทัด | ผู้ใช้เห็นอะไร | ข้อมูลจริงที่ควรมาแทน |
|---|---|---|
| `src/AdvisorPortal.tsx:521` (`MOCK_VISIT_DATA` จาก `src/data/mockData.ts`) | รายการเยี่ยมบ้านปลอม 3 รายการ (ที่อยู่/ระยะทาง/สถานะ) | `homeVisits` / `student_home_locations` |
| `src/AdvisorPortal.tsx:125` (`skippedStudents`) | เรดาร์ "โดดเรียน" แสดงนักเรียน 54004 ตายตัว | ยังไม่มี data path (ต้องมีการเช็คชื่อรายคาบที่ระบุการขาดเฉพาะคาบ) |
| `src/AdvisorPortal.tsx:1404`, `src/HomeVisitPortal.tsx:86` (`submitHomeVisit`) | แจ้งบันทึกเยี่ยมบ้านแล้ว แต่เก็บแค่ local state (store) ไม่เขียน Firestore | เขียน Firestore จริง — ยังไม่มี data path |
| `src/HomeVisitPortal.tsx:80` | รูปถ่ายเยี่ยมบ้านเป็น string ปลอม (`photo_1`, `photo_2`, …) ไม่ได้อัปโหลดจริง | Firebase Storage — ยังไม่มี data path |
| `src/StudentPortal.tsx:112` (`schedule`) | ตารางเรียนวันนี้ตายตัว 4 คาบ (ห้อง/วิชา/สถานะเช็คชื่อ) | `schedules` ตามห้องของนักเรียน + `attendance_records` |
| `src/StudentPortal.tsx:354` | GPAX 3.88 ตายตัว | ยังไม่มี data path (ยังไม่มีข้อมูลเกรดสะสม) |
| `src/components/ExecutiveEngagementDashboard.tsx:160` (`engagementTierData`) | สัดส่วน/จำนวนนักเรียนตามระดับ engagement (703/814/259/74) | ยังไม่มี data path |
| `src/components/ExecutiveEngagementDashboard.tsx:168` (`radarData`) | คะแนนทักษะ ม.ต้น/ม.ปลาย ตายตัว | ยังไม่มี data path |
| `src/components/infirmary/InfirmaryPortal.tsx:75` (`medicines`) | คลังยา 6 รายการ พร้อมจำนวนคงเหลือ | ยังไม่มี collection (คลังยาห้องพยาบาล) |
| `src/components/supervision/SupervisionPortal.tsx:27` (`lessonPlans`) | แผนการสอนที่ส่งมา + สถานะ/feedback ปลอม | ยังไม่มี collection |
| `src/components/supervision/SupervisionPortal.tsx:66` (`visits`) | รายการนิเทศชั้นเรียนปลอม | ยังไม่มี collection |
| `src/components/supervision/SupervisionPortal.tsx:95`, `:378` | ชื่อครู "นายเกียรติศักดิ์ ใจมั่น" และ "กลุ่มสาระฯ คณิตศาสตร์" ตายตัว | `staff` (ครูที่ถูกนิเทศจริง) |
| `src/components/SystemSettingsAndLocksPage.tsx:89` (`requests`) | คำร้องขอแก้เกรดย้อนหลังปลอม (teacher-somchai ฯลฯ) | ยังไม่มี collection (`:55` lockConfigs เป็นแค่ค่าเริ่มต้นที่ Firestore ทับภายหลัง — ไม่ต้องแก้) |
| `src/components/student-parent/GateAttendanceTracker.tsx:107` (`subjectAttendanceList`) | สถิติการเข้าเรียนรายวิชา (มา/สาย/ลา/ขาด/%) ตายตัว | `attendance_records` รายวิชาของนักเรียน |
| `src/components/student-parent/GateAttendanceTracker.tsx:80`, `:94` | ฟอร์มลาตั้งค่าล่วงหน้า: ถึงวันที่ 2026-08-23, 2 วัน, ไฟล์แนบ "ใบรับรองแพทย์_เอกสารแนบ.pdf" | ฟอร์มต้องเริ่มว่าง / คำนวณจำนวนวันจากวันที่จริง / แนบไฟล์จริง |
| `src/components/student-parent/PortfolioActivityVault.tsx:59` (`addPortfolioItem`) | แจ้งเพิ่มผลงานแล้ว แต่เก็บแค่ local state | `student_portfolio_entries` (มีอยู่แล้ว) |
| `src/components/student-parent/PortfolioActivityVault.tsx:67` | ระดับรางวัลเริ่มต้น "รางวัลระดับเหรียญทอง" + skills ตายตัว | ค่าที่ผู้ใช้กรอกเอง (ไม่กรอก = ว่าง) |
| `src/store.ts:1158` (`addPortfolioItem`) | ผลงาน "ยืนยันโดยครูกิตติศักดิ์" อัตโนมัติ (`isVerifiedByTeacher: true`) | สถานะรออนุมัติ → ครูที่ปรึกษาอนุมัติจริง (`student_portfolio_entries`) |
| `src/components/student-parent/PortfolioActivityVault.tsx:520` | อีเมลนักเรียน `{studentId}@smartschool.ac.th` (โดเมนไม่มีจริง) | `students.email` / รูปแบบ `it{studentId}@utd.ac.th` |
| `src/components/student-parent/AcademicHomeworkModule.tsx:47` (`submitHomework`) | แจ้งส่งการบ้านสำเร็จ แต่เก็บแค่ local state | ยังไม่มี data path |
| `src/components/student-parent/AcademicHomeworkModule.tsx:42` | ชื่อไฟล์การบ้านตั้งไว้ล่วงหน้า (`รายงาน_ฟิสิกส์_…`) | ไฟล์ที่ผู้ใช้เลือกจริง |
| `src/components/student-parent/BehaviorDisciplineModule.tsx:49` (`handleAwardSubmit`) | แจ้งบันทึกคะแนนความประพฤติสำเร็จก่อน Firestore เขียนเสร็จ (fire-and-forget, error แค่ `console.warn`) | `await` การเขียนจริงแล้วค่อยแจ้งสำเร็จ / แสดง error |
| `src/components/student-parent/ParentEngagementServices.tsx:96` | ชื่อครูประจำชั้น "ครูกิตติศักดิ์" ตายตัวในฟอร์ม/รายการ | `staff` (ครูประจำชั้นของห้องนักเรียน) |
| `src/ParentPortal.tsx:129` | "ครูประจำชั้น: ครูกิตติศักดิ์ • เบอร์โทรฉุกเฉินโรงเรียน: 02-123-4567" ตายตัว | `staff` ครูประจำชั้น + `school_settings` (เบอร์โรงเรียน) |
| `src/ParentPortal.tsx:448` | ข้อความจาก "ครูกิตติศักดิ์ (ครูประจำชั้น ม.5/8)" เวลา "วันนี้ 08:15 น." ตายตัว | `parent_teacher_messages` |
| `src/store.ts:999` (`approveDetailedLeave`) | ใบลา "อนุมัติโดยครูกิตติศักดิ์" ทุกครั้งไม่ว่าใครกดอนุมัติ | ผู้ใช้ที่กดอนุมัติจริง (`user.displayName` / `staffId`) |
| `src/components/student-parent/SocioeconomicWelfareModule.tsx:54` | ถ้าไม่มีบันทึกเยี่ยมบ้าน แสดงเรคคอร์ดปลอม (2026-07-08, ครูกิตติศักดิ์, ครูแนะแนวพิมพ์ชนก) | empty state เมื่อยังไม่มี `homeVisits` จริง |
| `src/TeacherPortal.tsx:1828` | การ์ดจุดเช็คอินประตู 1–3 พร้อมพิกัดและ "เปิดบริการ 24 ชม." ตายตัว | `school_settings` (จุดเช็คอิน/geofence) — ยังไม่มี data path |
| `src/TeacherPortal.tsx:1188` | ชุมนุม: จำนวนนักเรียนใช้ความจุ (`capacity`) แทนเมื่อยังไม่มีคนลงทะเบียน | จำนวนลงทะเบียนจริง (แสดง 0) |
| `src/components/BulkDataImportModal.tsx:1027` | นำเข้าไฟล์รายวิชารูปแบบเก่า **เขียน** schedule เป็นวันจันทร์ คาบ 1 ทุกวิชา | อ่านวัน/คาบจริงจากไฟล์ หรือปฏิเสธการนำเข้าเมื่อไฟล์ไม่มีข้อมูลนี้ |
| `src/components/StaffRoleManagementPage.tsx:85` (`ROOM_OPTIONS`), `src/components/StudentManagementPage.tsx:82` (`COMMON_ROOMS`) | ตัวเลือกห้องเรียนเป็นรายการตายตัว | ห้องที่มีอยู่จริงจาก `students` (distinct room) |
