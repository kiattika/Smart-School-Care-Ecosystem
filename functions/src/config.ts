/**
 * Named Firestore database ที่ client ใช้จริง — ต้องตรงกับ `firestoreDatabaseId` ใน
 * firebase-applet-config.json (ที่ src/lib/firebase.ts ส่งให้ getFirestore)
 *
 * ห้ามใช้ admin.firestore() / getFirestore() แบบไม่ระบุ ID ใน Cloud Functions — จะได้ database
 * `(default)` ซึ่งว่างเปล่าและไม่มีใครอ่าน (เคยทำให้ onUserCreated หา staff ไม่เจอทุกครั้ง และ
 * assignUserRole เขียน staff.roles ไปผิดฐานข้อมูล). ค่านี้ถูกเทียบกับ config ของ client ใน
 * src/__tests__/functionsDatabaseId.test.ts กันค่าเพี้ยน
 */
export const FIRESTORE_DATABASE_ID = 'ai-studio-smartschoolcaree-3b0997bf-b447-4da7-ac95-d7b1332165e0';
