// ⚠️ ข้อมูลจำลองที่เหลืออยู่ — MOCK_VISIT_DATA ยังถูกใช้ใน AdvisorPortal (งานเยี่ยมบ้าน) รอแทนด้วย
// ข้อมูลจริงจาก Firestore ในรอบ B ของการเก็บกวาดข้อมูลปลอม (ดู CLAUDE.md กฎ no-fake-data)
// ห้ามเพิ่ม export ข้อมูลจำลองใหม่ในไฟล์นี้
export const MOCK_VISIT_DATA = [
  {
    studentId: '6950801',
    address: '12/3 หมู่ 1 ต.ท่าเสา อ.เมือง จ.อุตรดิตถ์',
    distance: '3.2 กม.',
    visitStatus: 'PENDING',
    urgent: false
  },
  {
    studentId: '6950802',
    address: '45/1 หมู่ 3 ต.ในเมือง อ.เมือง จ.อุตรดิตถ์',
    distance: '1.5 กม.',
    visitStatus: 'COMPLETED',
    urgent: false
  },
  {
    studentId: '6950803',
    address: '88/9 หมู่ 5 ต.บ้านเกาะ อ.เมือง จ.อุตรดิตถ์',
    distance: '5.8 กม.',
    visitStatus: 'PENDING',
    urgent: true
  }
];
