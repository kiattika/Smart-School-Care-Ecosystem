/** เมนูหน้ามือถือตามบทบาท — ตรรกะบริสุทธิ์ (test ได้) เมนูใช้บ่อยเท่านั้น งานอื่นเปิดเว็บเต็ม */
export type MobileMenuId = 'checkin' | 'schedule' | 'homeroom' | 'homeLocation' | 'chat';

export interface MobileMenuItem { id: MobileMenuId; label: string }

const STAFF_ROLES_WITH_SCHEDULE = [
  'SUBJECT_TEACHER', 'HOMEROOM_TEACHER', 'HEAD_OF_DEPARTMENT', 'ACADEMIC_HEAD', 'DEPUTY_DIRECTOR_ACADEMIC',
  'DIRECTOR', 'GUIDANCE_COUNSELOR', 'INSTRUCTIONAL_SUPERVISOR',
];

export function mobileMenuFor(input: { appRole: string; roles: string[] }): MobileMenuItem[] {
  const { appRole, roles } = input;
  if (appRole === 'student') {
    return [
      { id: 'checkin', label: 'เช็คอินเข้าโรงเรียน' },
      { id: 'schedule', label: 'ตารางเรียนวันนี้' },
      { id: 'homeLocation', label: 'พิกัดบ้านของฉัน' },
      { id: 'chat', label: 'สนทนากับครูประจำชั้น' },
    ];
  }
  if (appRole === 'parent' && roles.includes('PARENT')) {
    return [
      { id: 'schedule', label: 'ตารางเรียนวันนี้ของบุตรหลาน' },
      { id: 'chat', label: 'สนทนากับครูประจำชั้น' },
    ];
  }
  if (appRole === 'parent') return [];
  // บุคลากร
  const items: MobileMenuItem[] = [{ id: 'checkin', label: 'เช็คอินเข้าโรงเรียน' }];
  if (roles.some(r => STAFF_ROLES_WITH_SCHEDULE.includes(r))) items.push({ id: 'schedule', label: 'ตารางสอนวันนี้' });
  if (roles.includes('HOMEROOM_TEACHER')) {
    items.push({ id: 'homeroom', label: 'เช็คชื่อโฮมรูม' });
    items.push({ id: 'chat', label: 'ข้อความผู้ปกครอง/นักเรียน' });
  }
  return items;
}
