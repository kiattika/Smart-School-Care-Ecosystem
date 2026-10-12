import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('guard: แผนที่เยี่ยมบ้าน/เส้นทาง/สถิติวิชาการ ใช้ข้อมูลจริง', () => {
  const adv = readSource('src/AdvisorPortal.tsx');
  it('ไม่มี MOCK_VISIT_DATA / แผนที่จำลอง / ระยะทางและพาหนะปลอม / เรดาร์หนีเรียนปลอม', () => {
    expect(adv).not.toMatch(/MOCK_VISIT_DATA|Map Clustering View|Generate Best Route|~ 3\.2|รถรับส่งนักเรียน \/ มอเตอร์ไซค์|skippedStudents|รอเยี่ยม 3 คน/);
  });
  it('โมดัลเส้นทางคำนวณจากพิกัดโรงเรียนใน Firestore + พิกัดบ้านจริง', () => {
    expect(adv).toMatch(/useSchoolGeofence\(\)/);
    expect(adv).toMatch(/useStudentHomeLocations\(/);
    expect(adv).toMatch(/calculateHaversineDistance\(geofenceConfig\.centerCoordinates/);
  });
  it('ไม่ใช้ tile Carto (ต้องใช้ API key)', () => {
    expect(readSource('src/components/homevisit/AdvisorHomeLocationMap.tsx')).not.toMatch(/cartocdn/);
    expect(readSource('src/ExecutivePortal.tsx')).not.toMatch(/cartocdn/);
  });
  it('สถิติวิชาการไม่สร้างเกรด/เทรนด์/อัตราเข้าเรียนปลอม', () => {
    const src = readSource('src/components/StudentAnalyticsDashboard.tsx');
    expect(src).not.toMatch(/subjectAttendanceRate: 90|16807|เพิ่มขึ้น 0\.12|'สัปดาห์ 1', 'มาเรียนปกติ': 95/);
    expect(src).toMatch(/useRoomAttendanceRecordsFull/);
  });
});

describe('guard: GPS modal', () => {
  const src = readSource('src/components/GPSGeofenceCheckinModal.tsx');
  it('ไม่อ้าง Anti-Spoofing และไม่ตั้งพิกัดเริ่มต้นปลอมในโรงเรียน', () => {
    expect(src).not.toMatch(/Anti-Spoofing/);
    expect(src).toMatch(/useState<Coordinates \| null>\(null\)/);
  });
  it('แท็บตั้งค่าเฉพาะ SUPER_ADMIN และบันทึกแล้วแจ้ง error จริง', () => {
    expect(src).toMatch(/canConfigure/);
    expect(src).toMatch(/activeTab === 'SETTINGS' && canConfigure/);
    expect(readSource('src/services/firestoreService.ts')).toMatch(/saveSchoolGeofenceConfigFirestore[\s\S]{0,400}throw error/);
  });
});
