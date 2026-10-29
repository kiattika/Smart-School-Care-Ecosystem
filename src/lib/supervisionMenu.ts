/**
 * เมนู "ผลการนิเทศ" ของครู (TeacherPortal) — รวมผลการนิเทศ + โครงการสอน + แผนการสอน + PLC/สะท้อนคิด ไว้เมนูเดียว
 * id แท็บเดิมคงไว้ทั้งหมด (กระดิ่งงานค้าง/`bellNavigation` ยังพาไป 'my-lesson-plans' ได้) — แถบเมนูข้างแสดงแค่ 'my-supervision'
 * และเมื่ออยู่แท็บใดแท็บหนึ่งในกลุ่มนี้ แถบเมนูข้างยังไฮไลต์ "ผลการนิเทศ"
 */
export const SUPERVISION_GROUP_TABS = [
  { id: 'my-supervision', label: 'ผลการนิเทศ' },
  { id: 'my-teaching-projects', label: 'โครงการสอน' },
  { id: 'my-lesson-plans', label: 'แผนการสอน (ส่งลิงก์)' },
  { id: 'my-plc', label: 'PLC และสะท้อนคิด' },
] as const;

export type SupervisionGroupTabId = typeof SUPERVISION_GROUP_TABS[number]['id'];
export const SUPERVISION_MENU_ID: SupervisionGroupTabId = 'my-supervision';

export const isSupervisionGroupTab = (id: string): id is SupervisionGroupTabId => SUPERVISION_GROUP_TABS.some(t => t.id === id);

/** id ของเมนูข้างที่ต้องไฮไลต์สำหรับแท็บปัจจุบัน */
export const sidebarIdForTab = (tab: string): string => (isSupervisionGroupTab(tab) ? SUPERVISION_MENU_ID : tab);
