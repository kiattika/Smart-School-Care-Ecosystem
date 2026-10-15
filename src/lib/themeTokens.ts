/**
 * โทเคนสีของธีมทั้ง 5 แบบ (ตามเอกสาร "ตารางปรับเทียบสีธีม (Theme Color Tokens) — ฉบับ GPT")
 * - ค่าเริ่มต้น (DEFAULT_TOKENS) = ค่าในเอกสาร; แอดมินแก้ค่าได้ที่หน้า "ธีมสี" (เก็บเฉพาะค่าที่ต่างจากค่าเริ่มต้น
 *   ใน school_settings/theme_tokens.overrides) และรีเซ็ตกลับได้เสมอ
 * - CSS สร้างตอนรัน (buildThemeCss) แล้วใส่ใน <style id="ssc-theme-tokens"> — ทับตัวแปรสีของ Tailwind
 *   (Tailwind v4 คอมไพล์ bg-slate-900 → var(--color-slate-900)) จึงไม่ต้องแก้ class ทีละคอมโพเนนต์
 * - ค่าสีทุกค่าผ่าน isColorValue ก่อนเข้า CSS (กันการฉีด CSS จากค่าที่บันทึก)
 * - ธีม "มืด" (ต้นฉบับ) ใช้ค่าเดิมของ Tailwind/โค้ด: ปล่อยเฉพาะโทเคนที่แอดมินแก้ — หน้าตาเดิมไม่เปลี่ยนถ้าไม่ได้แก้
 */

export const THEME_IDS = ['light', 'dark', 'navy', 'pink', 'lavender'] as const;
export type ThemeId = typeof THEME_IDS[number];
/** ชื่อธีมตามเอกสาร (ลำดับ 1–5) */
export const THEME_DOC_NAME: Record<ThemeId, string> = {
  light: '1. Light', dark: '2. Dark Obsidian / Deep Slate', navy: '3. Blue', pink: '4. Pink', lavender: '5. Purple',
};
/** โหมดพื้นฐาน: ธีมสว่างใช้การสลับสเกลสีของ theme-light.css เป็นฐาน */
export const THEME_MODE: Record<ThemeId, 'light' | 'dark'> = { light: 'light', dark: 'dark', navy: 'dark', pink: 'light', lavender: 'light' };
export const isThemeId = (v: unknown): v is ThemeId => THEME_IDS.includes(v as ThemeId);

export type TokenGroup = 'surface' | 'border' | 'text' | 'status' | 'role' | 'brand' | 'shell';
export const TOKEN_GROUP_LABEL: Record<TokenGroup, string> = {
  surface: '1. พื้นหลังและพื้นผิว (Background & Surface)',
  border: '2. เส้นขอบ (Border)',
  text: '3. ตัวอักษรและเนื้อหา (Typography)',
  status: '4. สถานะและการเข้าเรียน (Attendance & Status)',
  role: '5. บทบาทผู้ใช้งาน (User Roles Badges)',
  brand: '6. แบรนด์และบริการภายนอก (Brand & External Services)',
  shell: 'เพิ่มเติม (ไม่อยู่ในเอกสาร): แถบบนและแถบเมนูข้าง',
};

export interface TokenDef {
  key: string;
  group: TokenGroup;
  name: string;
  /** คลาส Tailwind / CSS ที่โทเคนนี้ควบคุม (ตามเอกสาร) */
  cls: string;
  desc: string;
  /** สีแบรนด์ภายนอก — แสดงอย่างเดียว แก้ไม่ได้ (เอกสารข้อ 6: ไม่ควรปรับตามธีม) */
  locked?: boolean;
}

const role = (key: string, name: string, cls: string): TokenDef => ({ key, group: 'role', name, cls, desc: 'สีป้ายบทบาท (ข้อความ; พื้น 10% และขอบ 20% ของสีเดียวกัน)' });

export const TOKEN_DEFS: readonly TokenDef[] = [
  { key: 'bg', group: 'surface', name: 'Base Body Background', cls: '--color-dark-bg / bg-[#0b0d14]', desc: 'สีพื้นหลังหลักของเว็บไซต์และแอปพลิเคชันทั้งหมด' },
  { key: 'bgSecondary', group: 'surface', name: 'Secondary Page Background', cls: 'bg-slate-900', desc: 'พื้นหลังหน้า App, Login Page และหน้าโหลดระบบ' },
  { key: 'surface', group: 'surface', name: 'Primary Card / Modal Surface', cls: 'bg-[#151921] และการ์ดสีเข้มอื่น ๆ', desc: 'พื้นผิวกล่องการ์ดเนื้อหาหลัก, กล่อง Login, หน้าต่าง Modal' },
  { key: 'inset', group: 'surface', name: 'Nested Card / Panel Inset', cls: 'bg-[#0b0f19], bg-slate-950', desc: 'บล็อกย่อยภายในการ์ด, กล่องประวัติคาบเรียน, รายการสอนแทน, ช่องกรอก' },
  { key: 'subbar', group: 'surface', name: 'Sub-Bar / Filter Bar', cls: 'bg-[#141926]', desc: 'แถบ Action Bar และแถบสถิติในหน้าต่างบันทึกเวลาเรียน' },
  { key: 'control', group: 'surface', name: 'Control / Button Dark Surface', cls: 'bg-[#1c1f2b]', desc: 'ชิปปุ่มกด, กล่องเลือกหัวข้อย่อย, ตัวเลือกพฤติกรรม' },
  { key: 'elevated', group: 'surface', name: 'Dark Elevated Card', cls: 'bg-slate-800 / bg-slate-800/80', desc: 'กล่องสถิติ, เมนู Dropdown, แถบสถานะ' },
  { key: 'borderSubtle', group: 'border', name: 'Subtle White Border', cls: 'border-white/10', desc: 'เส้นขอบการ์ดหลัก, โมดอล, ปุ่มกดโปร่งแสง' },
  { key: 'borderSlate', group: 'border', name: 'Subtle Slate Border', cls: 'border-slate-800/80', desc: 'เส้นแบ่งส่วนเนื้อหา, เส้นคั่นตาราง' },
  { key: 'borderInteractive', group: 'border', name: 'Interactive Border', cls: 'border-slate-700', desc: 'เส้นขอบเมื่อ Hover หรือสถานะ Active ปกติ' },
  { key: 'text', group: 'text', name: 'Primary Text', cls: 'text-white', desc: 'หัวข้อหลัก, ชื่อนักเรียน, ข้อความเด่น' },
  { key: 'textHigh1', group: 'text', name: 'High Contrast Text (100)', cls: 'text-slate-100', desc: 'ข้อความเนื้อหาทั่วไป' },
  { key: 'textHigh2', group: 'text', name: 'High Contrast Text (200)', cls: 'text-slate-200', desc: 'ข้อความเนื้อหาทั่วไป' },
  { key: 'textMuted', group: 'text', name: 'Muted / Subtitle', cls: 'text-slate-400', desc: 'คำอธิบายกำกับ, วันที่, คาบเรียน' },
  { key: 'textDisabled', group: 'text', name: 'Dimmed / Disabled', cls: 'text-slate-500', desc: 'ข้อความแนะนำเพิ่มเติม, ตัวเลือกที่ยังไม่ถูกเลือก' },
  { key: 'accent', group: 'text', name: 'สีเน้นหลัก (Accent)', cls: 'bg-indigo-600 / text-indigo-400', desc: 'ปุ่มหลัก ลิงก์ และไอคอนที่เลือกอยู่ (จากตารางสรุปชุดสีหลัก)' },
  { key: 'present400', group: 'status', name: 'มาเรียน (PRESENT) - ข้อความ 400', cls: 'text-emerald-400', desc: 'สถานะมาเรียน, ข้อความยืนยันสำเร็จ, ส่งตรงเวลา' },
  { key: 'present500', group: 'status', name: 'มาเรียน (PRESENT) - ข้อความ 500', cls: 'text-emerald-500', desc: 'สถานะมาเรียน (เฉดเข้ม/ปุ่ม)' },
  { key: 'presentBg', group: 'status', name: 'มาเรียน (PRESENT) - พื้นหลัง', cls: 'bg-emerald-950/60', desc: 'ปุ่มและแท็กสถานะมาเรียน' },
  { key: 'late400', group: 'status', name: 'มาสาย (LATE) - ข้อความ 400', cls: 'text-amber-400', desc: 'สถานะมาสาย, คำขอรอดำเนินการ, ส่งงานช้ากว่ากำหนด' },
  { key: 'late500', group: 'status', name: 'มาสาย (LATE) - ข้อความ 500', cls: 'text-amber-500', desc: 'สถานะมาสาย (เฉดเข้ม/ปุ่ม)' },
  { key: 'lateBg', group: 'status', name: 'มาสาย (LATE) - พื้นหลัง', cls: 'bg-amber-950/60', desc: 'ปุ่มและแท็กสถานะมาสาย' },
  { key: 'absent400', group: 'status', name: 'ขาดเรียน (ABSENT) - ข้อความ 400', cls: 'text-red-400', desc: 'สถานะขาดเรียน, ความเสี่ยงสูง, การแจ้งเตือนผิดพลาด' },
  { key: 'absent500', group: 'status', name: 'ขาดเรียน (ABSENT) - ข้อความ 500', cls: 'text-red-500', desc: 'สถานะขาดเรียน (เฉดเข้ม/ปุ่ม)' },
  { key: 'absentBg', group: 'status', name: 'ขาดเรียน (ABSENT) - พื้นหลัง', cls: 'bg-red-950/60', desc: 'ปุ่มและแท็กสถานะขาดเรียน' },
  { key: 'leave400', group: 'status', name: 'ลากิจ/ลาป่วย (LEAVE) - ข้อความ 400', cls: 'text-blue-400', desc: 'สถานะลากิจ/ลาป่วย, บันทึกการลา' },
  { key: 'leave500', group: 'status', name: 'ลากิจ/ลาป่วย (LEAVE) - ข้อความ 500', cls: 'text-blue-500', desc: 'สถานะลา (เฉดเข้ม/ปุ่ม)' },
  { key: 'leaveBg', group: 'status', name: 'ลากิจ/ลาป่วย (LEAVE) - พื้นหลัง', cls: 'bg-blue-950/60', desc: 'ปุ่มและแท็กสถานะลากิจ/ลาป่วย' },
  { key: 'critical400', group: 'status', name: 'ความเสี่ยงวิกฤต (Critical) 400', cls: 'text-rose-400', desc: 'แจ้งเตือนเวลาเรียนต่ำกว่า 60%, ความเสี่ยงเวลาเรียนไม่พอ' },
  { key: 'critical500', group: 'status', name: 'ความเสี่ยงวิกฤต (Critical) 500', cls: 'text-rose-500', desc: 'ความเสี่ยงวิกฤต (เฉดเข้ม/ปุ่ม)' },
  role('roleSuperAdmin', 'SUPER_ADMIN (ผู้ดูแลระบบ)', 'Rose'),
  role('roleExecutive', 'EXECUTIVE (ผู้บริหารสถานศึกษา)', 'Blue'),
  role('roleHeadOfDepartment', 'HEAD_OF_DEPARTMENT (หัวหน้ากลุ่มสาระฯ)', 'Amber'),
  role('roleAcademicHead', 'ACADEMIC_HEAD (หัวหน้าฝ่ายวิชาการฯ)', 'Orange'),
  role('roleDeputyDirectorAcademic', 'DEPUTY_DIRECTOR_ACADEMIC (รอง ผอ. วิชาการ)', 'Violet'),
  role('roleDirector', 'DIRECTOR (ผู้อำนวยการสถานศึกษา)', 'Red'),
  role('roleHomeroomTeacher', 'HOMEROOM_TEACHER (ครูประจำชั้น)', 'Emerald'),
  role('roleSubjectTeacher', 'SUBJECT_TEACHER (ครูประจำวิชา)', 'Indigo'),
  role('roleSupervisoryTeacher', 'SUPERVISORY_TEACHER (ครูนิเทศ)', 'Teal'),
  role('roleInfirmaryStaff', 'INFIRMARY_STAFF (พยาบาลโรงเรียน)', 'Rose'),
  role('roleGuidanceCounselor', 'GUIDANCE_COUNSELOR (ครูแนะแนว)', 'Purple'),
  role('roleFinanceStaff', 'FINANCE_STAFF (เจ้าหน้าที่การเงิน)', 'Emerald'),
  role('roleParent', 'PARENT (ผู้ปกครอง)', 'Amber'),
  role('roleStudent', 'STUDENT (นักเรียน)', 'Sky'),
  { key: 'brandStart', group: 'brand', name: 'System Brand Accent (Gradient Start)', cls: 'indigo-500', desc: 'สีเริ่มของไล่สีแบรนด์ระบบ (และพื้นโปร่ง bg-indigo-500/…)' },
  { key: 'brandEnd', group: 'brand', name: 'System Brand Accent (Gradient End)', cls: 'blue-600', desc: 'สีปลายของไล่สีแบรนด์ระบบ (และปุ่ม bg-blue-600)' },
  { key: 'lineBg', group: 'brand', name: 'LINE Official Account', cls: 'bg-[#00B900]', desc: 'สีแบรนด์ LINE — คงตามข้อกำหนดแบรนด์', locked: true },
  { key: 'lineHover', group: 'brand', name: 'LINE Official Account (hover)', cls: 'hover:bg-[#00A000]', desc: 'สีแบรนด์ LINE — คงตามข้อกำหนดแบรนด์', locked: true },
  { key: 'googleBg', group: 'brand', name: 'Google Workspace (พื้น)', cls: 'bg-white', desc: 'ปุ่ม Google — คงตามข้อกำหนดแบรนด์', locked: true },
  { key: 'googleText', group: 'brand', name: 'Google Workspace (ข้อความ)', cls: 'text-slate-900', desc: 'ปุ่ม Google — คงตามข้อกำหนดแบรนด์', locked: true },
  { key: 'topbar', group: 'shell', name: 'แถบบน (Top Bar)', cls: 'data-shell="topbar"', desc: 'แถบเมนูด้านบนของทุกพอร์ทัล — ถ้าเป็นสีเข้ม ตัวหนังสือในแถบจะเป็นสีขาว' },
  { key: 'sidebar', group: 'shell', name: 'แถบเมนูข้าง (Sidebar)', cls: 'data-shell="sidebar"', desc: 'แถบเมนูซ้ายและลิ้นชักเมนูบนมือถือ — ถ้าเป็นสีเข้ม ตัวหนังสือในแถบจะเป็นสีขาว' },
];
export type TokenKey = string;
const DEF_BY_KEY = new Map(TOKEN_DEFS.map(d => [d.key, d]));

/** ลำดับคีย์ในตาราง V ด้านล่าง (ห้ามสลับ — ค่าในแต่ละธีมเรียงตามนี้) */
const ORDER = TOKEN_DEFS.map(d => d.key);
const V = (vals: string[]): Record<TokenKey, string> => {
  if (vals.length !== ORDER.length) throw new Error(`theme token count ${vals.length} != ${ORDER.length}`);
  return Object.fromEntries(ORDER.map((k, i) => [k, vals[i]]));
};
const BRAND_FIXED = ['#00B900', '#00A000', '#FFFFFF', '#0F172A'];

/** ค่าเริ่มต้นตามเอกสาร (ธีม 2 = ค่าต้นฉบับของระบบ) — "รีเซ็ต" คือกลับมาที่ค่านี้ */
export const DEFAULT_TOKENS: Record<ThemeId, Record<TokenKey, string>> = {
  light: V([
    '#F4F6F9', '#E9EEF5', '#FFFFFF', '#F8FAFC', '#F1F5F9', '#E2E8F0', '#FFFFFF',
    'rgba(15,23,42,0.08)', '#E2E8F0', '#CBD5E1',
    '#1E293B', '#334155', '#334155', '#64748B', '#94A3B8', '#2563EB',
    '#047857', '#059669', 'rgba(16,185,129,0.12)', '#B45309', '#D97706', 'rgba(245,158,11,0.12)',
    '#DC2626', '#EF4444', 'rgba(239,68,68,0.10)', '#2563EB', '#3B82F6', 'rgba(59,130,246,0.10)', '#E11D48', '#F43F5E',
    '#E11D48', '#2563EB', '#B45309', '#C2410C', '#7C3AED', '#DC2626', '#047857', '#4F46E5', '#0F766E', '#E11D48', '#9333EA', '#047857', '#B45309', '#0284C7',
    '#6366F1', '#2563EB', ...BRAND_FIXED,
    '#1E3A8A', '#FFFFFF',
  ]),
  dark: V([
    '#0B0D14', '#0F172A', '#151921', '#0B0F19', '#141926', '#1C1F2B', '#1E293B',
    'rgba(255,255,255,0.10)', 'rgba(30,41,59,0.80)', '#334155',
    '#FFFFFF', '#F1F5F9', '#E2E8F0', '#94A3B8', '#64748B', '#3B82F6',
    '#34D399', '#10B981', 'rgba(2,44,34,0.6)', '#FBBF24', '#F59E0B', 'rgba(69,26,3,0.6)',
    '#F87171', '#EF4444', 'rgba(69,10,10,0.6)', '#60A5FA', '#3B82F6', 'rgba(23,37,84,0.6)', '#FB7185', '#F43F5E',
    '#FB7185', '#60A5FA', '#FBBF24', '#FB923C', '#A78BFA', '#F87171', '#34D399', '#818CF8', '#2DD4BF', '#FB7185', '#C084FC', '#34D399', '#FBBF24', '#38BDF8',
    '#6366F1', '#2563EB', ...BRAND_FIXED,
    '#0F172A', '#0A0F16',
  ]),
  navy: V([
    '#071426', '#0B1D36', '#10243D', '#0B1A2E', '#132A45', '#1A3452', '#193552',
    'rgba(219,234,254,0.12)', 'rgba(41,71,102,0.80)', '#355A80',
    '#F1F7FF', '#D8E8FA', '#C4D9F0', '#9DB6D5', '#6F8EAF', '#3B82F6',
    '#6EE7B7', '#34D399', 'rgba(16,185,129,0.18)', '#FCD34D', '#FBBF24', 'rgba(245,158,11,0.18)',
    '#FDA4AF', '#FB7185', 'rgba(239,68,68,0.18)', '#93C5FD', '#60A5FA', 'rgba(59,130,246,0.20)', '#FDA4AF', '#FB7185',
    '#FDA4AF', '#93C5FD', '#FCD34D', '#FDBA74', '#C4B5FD', '#FDA4AF', '#6EE7B7', '#A5B4FC', '#5EEAD4', '#FDA4AF', '#D8B4FE', '#6EE7B7', '#FCD34D', '#7DD3FC',
    '#60A5FA', '#1D4ED8', ...BRAND_FIXED,
    '#0F1A34', '#1B2A4A',
  ]),
  pink: V([
    '#FFF5F7', '#FCE8EF', '#FFFFFF', '#FFF9FB', '#FBEAF0', '#F5DCE6', '#FFFFFF',
    'rgba(131,24,67,0.10)', 'rgba(240,201,216,0.85)', '#D99AB5',
    '#542238', '#71324D', '#843B5B', '#A66B80', '#C08CA0', '#C43D70',
    '#047857', '#059669', 'rgba(16,185,129,0.12)', '#B45309', '#D97706', 'rgba(245,158,11,0.12)',
    '#DC2626', '#EF4444', 'rgba(239,68,68,0.10)', '#2563EB', '#3B82F6', 'rgba(59,130,246,0.10)', '#BE185D', '#E11D48',
    '#BE185D', '#2563EB', '#B45309', '#C2410C', '#7C3AED', '#DC2626', '#047857', '#4F46E5', '#0F766E', '#BE185D', '#9333EA', '#047857', '#B45309', '#0284C7',
    '#C43D70', '#9D174D', ...BRAND_FIXED,
    '#70243B', '#9C425D',
  ]),
  lavender: V([
    '#F7F5FF', '#EEE9FF', '#FFFFFF', '#FBFAFF', '#F0ECFF', '#E4DCFF', '#FFFFFF',
    'rgba(76,29,149,0.10)', 'rgba(220,211,245,0.85)', '#B6A7E8',
    '#30245A', '#493777', '#5A478B', '#8176A8', '#A69BC8', '#7655E8',
    '#047857', '#059669', 'rgba(16,185,129,0.12)', '#B45309', '#D97706', 'rgba(245,158,11,0.12)',
    '#DC2626', '#EF4444', 'rgba(239,68,68,0.10)', '#6D5AE6', '#7655E8', 'rgba(118,85,232,0.12)', '#C026D3', '#D946EF',
    '#FDA4AF', '#6D5AE6', '#B45309', '#C2410C', '#8B5CF6', '#DC2626', '#047857', '#6D5AE6', '#0F766E', '#FDA4AF', '#A855F7', '#047857', '#B45309', '#0284C7',
    '#8B5CF6', '#6D28D9', ...BRAND_FIXED,
    '#2A1B60', '#4A3AFF',
  ]),
};

/** บทบาท → ชื่อตัวแปร CSS ของป้ายบทบาท (ใช้ใน ROLE_VISUALS: text-(--role-…) ) */
export const ROLE_TOKEN: Record<string, { key: TokenKey; cssVar: string }> = Object.fromEntries(
  ([
    ['SUPER_ADMIN', 'roleSuperAdmin'], ['EXECUTIVE', 'roleExecutive'], ['HEAD_OF_DEPARTMENT', 'roleHeadOfDepartment'],
    ['ACADEMIC_HEAD', 'roleAcademicHead'], ['DEPUTY_DIRECTOR_ACADEMIC', 'roleDeputyDirectorAcademic'], ['DIRECTOR', 'roleDirector'],
    ['HOMEROOM_TEACHER', 'roleHomeroomTeacher'], ['SUBJECT_TEACHER', 'roleSubjectTeacher'], ['SUPERVISORY_TEACHER', 'roleSupervisoryTeacher'],
    ['INFIRMARY_STAFF', 'roleInfirmaryStaff'], ['GUIDANCE_COUNSELOR', 'roleGuidanceCounselor'], ['FINANCE_STAFF', 'roleFinanceStaff'],
    ['PARENT', 'roleParent'], ['STUDENT', 'roleStudent'],
  ] as const).map(([r, key]) => [r, { key, cssVar: '--role-' + r.toLowerCase().replace(/_/g, '-') }]),
);

/**
 * class พื้นหลังสีเข้มแบบฮาร์ดโค้ด (bg-[#hex]) ในโค้ด → โทเคนที่ควบคุม
 * ระบุ 5 สีตามเอกสาร (#0b0d14 พื้นหลัง, #151921 การ์ด, #0b0f19 inset, #141926 sub-bar, #1c1f2b control)
 * ส่วนสีใกล้เคียงอื่นจัดกลุ่มตามการใช้งานจริง (ส่วนใหญ่เป็นการ์ด → surface)
 * มี class ใหม่ → เพิ่มที่นี่ (เทสต์ themeTokens จะเตือนเมื่อเจอ class สีเข้มที่ยังไม่ได้จัดกลุ่ม)
 */
export const HEX_CLASS_TOKEN: Record<string, TokenKey> = {
  ...Object.fromEntries(['#0b0d14', '#05070a', '#0a0c12', '#0a0d14', '#0b0e14', '#0c0e16', '#0a0f16'].map(h => [h, 'bg'])),
  ...Object.fromEntries(['#0b0f19', '#0a0f18', '#0c101c', '#0d0f17', '#0e111a', '#0e121c', '#0f111a'].map(h => [h, 'inset'])),
  ...Object.fromEntries(['#141926', '#141824'].map(h => [h, 'subbar'])),
  '#1c1f2b': 'control',
  '#1e293b': 'elevated',
  ...Object.fromEntries(['#0f172a', '#0f1524', '#121829', '#141b2d'].map(h => [h, 'bgSecondary'])),
  ...Object.fromEntries(['#151921', '#0f1219', '#0f121d', '#0f1422', '#10141e', '#11151d', '#111622', '#111827', '#121620', '#121624',
    '#161c2c', '#161f30', '#181c28', '#181e2e', '#1a2030', '#1b2030'].map(h => [h, 'surface'])),
};
/** ค่าความโปร่ง (/80 ฯลฯ) ที่ใช้กับ class ข้างบนในโค้ด */
export const HEX_CLASS_ALPHAS = ['', '30', '60', '80', '90', '95'];

// ───────── ตรวจค่าสี (กันการฉีด CSS) ─────────
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGBA_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(0|1|0?\.\d{1,3}|1\.0{1,3})\s*)?\)$/i;
export function isColorValue(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 40) return false;
  if (HEX_RE.test(v)) return true;
  const m = RGBA_RE.exec(v);
  return !!m && [m[1], m[2], m[3]].every(n => Number(n) <= 255);
}

export type ThemeOverrides = Partial<Record<ThemeId, Record<TokenKey, string>>>;

/** อ่านค่าที่บันทึกไว้ (Firestore/localStorage) — ทิ้งธีม/คีย์ที่ไม่รู้จัก, คีย์ล็อก, ค่าที่ไม่ใช่สี และค่าที่เท่าค่าเริ่มต้น */
export function normalizeOverrides(raw: unknown): ThemeOverrides {
  const out: ThemeOverrides = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [t, vals] of Object.entries(raw as Record<string, unknown>)) {
    if (!isThemeId(t) || !vals || typeof vals !== 'object') continue;
    const clean: Record<TokenKey, string> = {};
    for (const [k, v] of Object.entries(vals as Record<string, unknown>)) {
      const def = DEF_BY_KEY.get(k);
      if (!def || def.locked || !isColorValue(v)) continue;
      if (sameColor(v, DEFAULT_TOKENS[t][k])) continue;
      clean[k] = v;
    }
    if (Object.keys(clean).length) out[t] = clean;
  }
  return out;
}

export const sameColor = (a: string, b: string) => a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase();

export function resolveTokens(overrides: ThemeOverrides, theme: ThemeId): Record<TokenKey, string> {
  return { ...DEFAULT_TOKENS[theme], ...(overrides[theme] ?? {}) };
}

// ───────── สี: แปลง/ความสว่าง/contrast (ใช้ในหน้าแอดมินและตัดสินสีแถบ) ─────────
export function parseColor(v: string): { r: number; g: number; b: number; a: number } | null {
  if (!isColorValue(v)) return null;
  if (v.startsWith('#')) {
    let h = v.slice(1);
    if (h.length <= 4) h = h.split('').map(c => c + c).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  const m = RGBA_RE.exec(v)!;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : Number(m[4]) };
}
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
/** ความสว่างสัมพัทธ์ (WCAG) — สีโปร่งถูกผสมบนพื้น `over` ก่อน */
export function luminance(v: string, over = '#FFFFFF'): number {
  const c = parseColor(v); const o = parseColor(over) ?? { r: 255, g: 255, b: 255, a: 1 };
  if (!c) return 1;
  const mix = (x: number, y: number) => x * c.a + y * (1 - c.a);
  return 0.2126 * lin(mix(c.r, o.r)) + 0.7152 * lin(mix(c.g, o.g)) + 0.0722 * lin(mix(c.b, o.b));
}
export function contrastRatio(fg: string, bg: string): number {
  const lb = luminance(bg); const lf = luminance(fg, bg);
  const [hi, lo] = lf > lb ? [lf, lb] : [lb, lf];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}
export const isDarkColor = (v: string) => luminance(v) < 0.18;

// ───────── สร้าง CSS ─────────
/** สเกลเดิมของ Tailwind (ใช้คืนค่าภายในแถบสีเข้มบนธีมสว่าง) — ตรงกับ node_modules/tailwindcss/theme.css */
const TW_SLATE: Record<string, string> = {
  50: 'oklch(98.4% 0.003 247.858)', 100: 'oklch(96.8% 0.007 247.896)', 200: 'oklch(92.9% 0.013 255.508)', 300: 'oklch(86.9% 0.022 252.894)',
  400: 'oklch(70.4% 0.04 256.788)', 500: 'oklch(55.4% 0.046 257.417)', 600: 'oklch(44.6% 0.043 257.281)', 700: 'oklch(37.2% 0.044 257.287)',
  800: 'oklch(27.9% 0.041 260.031)', 900: 'oklch(20.8% 0.042 265.755)', 950: 'oklch(12.9% 0.042 264.695)',
};

type Decl = { key: TokenKey | null; css: string };
const mix = (a: string, pct: number, b: string) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

function themeRules(theme: ThemeId, tk: Record<TokenKey, string>, overridden: Set<TokenKey>, darkTk: Record<TokenKey, string>): string {
  const P = `:root[data-palette="${theme}"][data-theme]`;
  // ธีมมืดต้นฉบับ: ปล่อยเฉพาะโทเคนที่ถูกแก้ (ค่าที่ได้จากการผสม key=null ไม่ปล่อย) — หน้าตาเดิมไม่เปลี่ยน
  const keep = (d: Decl) => theme !== 'dark' || (d.key !== null && overridden.has(d.key));
  const vars: Decl[] = [
    { key: 'bg', css: `--app-body-bg: ${tk.bg}` }, { key: 'bg', css: `--color-dark-bg: ${tk.bg}` },
    { key: 'text', css: `--app-body-fg: ${tk.text}` },
    { key: 'inset', css: `--color-slate-950: ${tk.inset}` },
    { key: 'bgSecondary', css: `--color-slate-900: ${tk.bgSecondary}` },
    { key: 'elevated', css: `--color-slate-800: ${tk.elevated}` },
    { key: 'borderInteractive', css: `--color-slate-700: ${tk.borderInteractive}` },
    { key: null, css: `--color-slate-600: ${mix(tk.borderInteractive, 50, tk.textDisabled)}` },
    { key: 'textDisabled', css: `--color-slate-500: ${tk.textDisabled}` },
    { key: 'textMuted', css: `--color-slate-400: ${tk.textMuted}` },
    { key: null, css: `--color-slate-300: ${mix(tk.textMuted, 50, tk.textHigh2)}` },
    { key: 'textHigh2', css: `--color-slate-200: ${tk.textHigh2}` },
    { key: 'textHigh1', css: `--color-slate-100: ${tk.textHigh1}` },
    { key: 'text', css: `--color-slate-50: ${tk.text}` },
    { key: 'accent', css: `--color-accent: ${tk.accent}` },
    { key: 'accent', css: `--color-indigo-600: ${tk.accent}` },
    { key: null, css: `--color-indigo-700: ${mix(tk.accent, 82, '#000')}` },
    { key: 'accent', css: `--color-indigo-400: ${mix(tk.accent, 78, tk.text)}` },
    { key: null, css: `--color-indigo-300: ${mix(tk.accent, 62, tk.text)}` },
    { key: null, css: `--color-indigo-200: ${mix(tk.accent, 48, tk.text)}` },
    { key: 'brandStart', css: `--color-indigo-500: ${tk.brandStart}` },
    { key: 'brandEnd', css: `--color-blue-600: ${tk.brandEnd}` },
    { key: 'present400', css: `--color-emerald-400: ${tk.present400}` }, { key: 'present500', css: `--color-emerald-500: ${tk.present500}` },
    { key: 'late400', css: `--color-amber-400: ${tk.late400}` }, { key: 'late500', css: `--color-amber-500: ${tk.late500}` },
    { key: 'absent400', css: `--color-red-400: ${tk.absent400}` }, { key: 'absent500', css: `--color-red-500: ${tk.absent500}` },
    { key: 'leave400', css: `--color-blue-400: ${tk.leave400}` }, { key: 'leave500', css: `--color-blue-500: ${tk.leave500}` },
    { key: 'critical400', css: `--color-rose-400: ${tk.critical400}` }, { key: 'critical500', css: `--color-rose-500: ${tk.critical500}` },
    ...Object.values(ROLE_TOKEN).map(r => ({ key: r.key, css: `${r.cssVar}: ${tk[r.key]}` })),
  ].filter(keep);
  let css = '';
  if (vars.length) css += `${P} {\n  color-scheme: ${THEME_MODE[theme]};\n${vars.map(d => `  ${d.css};`).join('\n')}\n}\n`;
  const rule = (key: TokenKey, sel: string, body: string) => { if (keep({ key, css: '' })) css += `${sel} { ${body} }\n`; };
  rule('text', `${P} .text-white`, `color: ${tk.text};`);
  rule('borderSubtle', `${P} [class*="border-white/"]`, `border-color: ${tk.borderSubtle};`);
  rule('borderSubtle', `${P} [class*="divide-white/"] > :not(:last-child)`, `border-color: ${tk.borderSubtle};`);
  rule('borderSlate', `${P} [class*="border-slate-800"]`, `border-color: ${tk.borderSlate};`);
  rule('borderSlate', `${P} [class*="divide-slate-800"] > :not(:last-child)`, `border-color: ${tk.borderSlate};`);
  rule('presentBg', `${P} [class*="bg-emerald-950"]`, `background-color: ${tk.presentBg};`);
  rule('lateBg', `${P} [class*="bg-amber-950"]`, `background-color: ${tk.lateBg};`);
  rule('absentBg', `${P} [class*="bg-red-950"]`, `background-color: ${tk.absentBg};`);
  rule('leaveBg', `${P} [class*="bg-blue-950"]`, `background-color: ${tk.leaveBg};`);
  if (theme !== 'dark') {
    // สีแบรนด์ภายนอกคงตามแบรนด์ (กันกฎ bg-[#…] ทั่วไปของโหมดสว่างทับ) + ตัวหนังสือบนปุ่มแบรนด์/ไล่สีคงเป็นขาว
    const line = `${P} [class~="bg-[#00B900]"]`;
    css += `${line} { background-color: ${tk.lineBg}; }\n`;
    css += `${P} [class~="hover:bg-[#00A000]"]:hover, ${P} [class~="bg-[#00A000]"] { background-color: ${tk.lineHover}; }\n`;
    for (const a of ['10', '20']) css += `${P} [class~="bg-[#00B900]/${a}"] { background-color: color-mix(in srgb, ${tk.lineBg} ${a}%, transparent); }\n`;
    // ไล่สีทึบ = จุดเริ่ม/กลางเป็นเฉด 500–800 ไม่มี /โปร่งใส (ดูจาก "-600 to-" / "-500 via-"); ไม่ใช้ :not([class*="/"]) เพราะคลาสอื่นอย่าง border-white/10 ก็มี "/" ทำให้ไอคอนบนปุ่มไล่สีเป็นสีเข้ม
    const solidGrad = `[class*="bg-gradient-to-"]:is([class*="-500 to-"],[class*="-600 to-"],[class*="-700 to-"],[class*="-800 to-"],[class*="-500 via-"],[class*="-600 via-"],[class*="-700 via-"])`;
    css += `${line}.text-white, ${line} .text-white, ${P} ${solidGrad}.text-white, ${P} ${solidGrad} .text-white { color: #ffffff; }\n`;
  }
  // พื้นหลังฮาร์ดโค้ด bg-[#hex] (และ /80 ฯลฯ)
  for (const [hex, key] of Object.entries(HEX_CLASS_TOKEN)) {
    for (const a of HEX_CLASS_ALPHAS) {
      const cls = `bg-[${hex}]${a ? '/' + a : ''}`;
      rule(key, `${P} [class~="${cls}"]`, `background-color: ${a ? `color-mix(in srgb, ${tk[key]} ${a}%, transparent)` : tk[key]};`);
    }
  }
  // แถบบน/เมนูข้าง (ประกาศท้ายสุดให้ชนะ class พื้นหลังของตัวแถบเอง)
  for (const shell of ['topbar', 'sidebar'] as const) {
    if (!keep({ key: shell, css: '' })) continue;
    const S = `${P} [data-shell="${shell}"]`;
    const bg = tk[shell];
    css += `${S} { background-color: ${bg}; }\n`;
    if (THEME_MODE[theme] === 'light' && isDarkColor(bg)) {
      // แถบสีเข้มบนธีมสว่าง: คืนสเกลเดิม (ตัวหนังสือขาว อ่านได้เหมือนธีมมืด) ข้อความรองสว่างขึ้นให้อ่านได้บนแถบสีสด
      const restore = Object.entries(TW_SLATE).map(([s, c]) => `  --color-slate-${s}: ${s === '400' || s === '500' ? '#e2e8f0' : c};`);
      for (const h of ['indigo', 'violet']) restore.push(`  --color-${h}-200: #ffffff;`, `  --color-${h}-300: #e0e7ff;`, `  --color-${h}-400: #ffffff;`, `  --color-${h}-500: #ffffff;`);
      for (const r of Object.values(ROLE_TOKEN)) restore.push(`  ${r.cssVar}: ${darkTk[r.key]};`); // ป้ายบทบาทในแถบเข้มใช้สีของธีมมืด
      css += `${S} {\n  color: #f8fafc;\n${restore.join('\n')}\n}\n`;
      css += `${S} .text-white { color: #ffffff; }\n`;
      css += `${S} [class*="bg-white/"] { background-color: rgb(255 255 255 / 0.08); }\n`;
      css += `${S} [class*="border-white/"], ${S} [class*="border-slate-"] { border-color: rgb(255 255 255 / 0.16); }\n`;
    }
  }
  return css;
}

/** CSS ของทุกธีม (ใส่ใน <style id="ssc-theme-tokens">) */
export function buildThemeCss(overrides: ThemeOverrides): string {
  const clean = normalizeOverrides(overrides);
  return '/* สร้างโดย src/lib/themeTokens.ts จากค่าตั้งต้นในเอกสาร + ค่าที่แอดมินแก้ */\n' + THEME_IDS.map(t =>
    themeRules(t, resolveTokens(clean, t), new Set(Object.keys(clean[t] ?? {})), resolveTokens(clean, 'dark')),
  ).join('');
}

export const THEME_STYLE_ID = 'ssc-theme-tokens';
export const THEME_TOKENS_STORAGE_KEY = 'ssc.themeTokens.v1';

/** สีแถบสถานะเบราว์เซอร์มือถือ (meta theme-color) ของแต่ละธีม — อัปเดตทุกครั้งที่ติดตั้ง CSS */
export const themeMetaColor: Record<ThemeId, string> = Object.fromEntries(THEME_IDS.map(t => [t, DEFAULT_TOKENS[t].topbar])) as Record<ThemeId, string>;

export function installThemeTokens(overrides: ThemeOverrides, doc: Document = document): void {
  const clean = normalizeOverrides(overrides);
  for (const t of THEME_IDS) themeMetaColor[t] = resolveTokens(clean, t).topbar;
  let el = doc.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!el) { el = doc.createElement('style'); el.id = THEME_STYLE_ID; doc.head.appendChild(el); }
  el.textContent = buildThemeCss(clean);
  const id = doc.documentElement.getAttribute('data-palette');
  if (isThemeId(id)) doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeMetaColor[id]);
}

export function loadCachedOverrides(): ThemeOverrides {
  try { return normalizeOverrides(JSON.parse(localStorage.getItem(THEME_TOKENS_STORAGE_KEY) || '{}')); }
  catch { return {}; }
}
export function saveCachedOverrides(o: ThemeOverrides): void {
  try { localStorage.setItem(THEME_TOKENS_STORAGE_KEY, JSON.stringify(normalizeOverrides(o))); } catch { /* ที่เก็บถูกบล็อก — ใช้ค่าจากเซิร์ฟเวอร์ใน session นี้ */ }
}
