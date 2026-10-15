/**
 * ตั้งค่าส่วนตัวของผู้ใช้ (ธีม, ขนาดตัวอักษร, รูปโปรไฟล์บุคลากร) — ตรรกะล้วน (ต้องตรง firestore.rules: user_preferences)
 * เก็บ 2 ที่: localStorage (ใช้ทันทีก่อนล็อกอิน/กันจอกะพริบ) + Firestore user_preferences/{uid} (ตามผู้ใช้ข้ามอุปกรณ์)
 * ค่าใหม่ในอนาคต: เพิ่มคีย์ที่นี่ + ใน rules (hasOnly) + UserSettingsModal
 */
export type ThemeChoice = 'system' | 'light' | 'dark' | 'navy' | 'pink' | 'lavender';
import { THEME_MODE, themeMetaColor, type ThemeId } from './themeTokens';
export type TextScale = 'normal' | 'large' | 'xlarge';
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark', 'navy', 'pink', 'lavender'];
export const TEXT_SCALES: readonly TextScale[] = ['normal', 'large', 'xlarge'];
export const THEME_LABEL: Record<ThemeChoice, string> = { system: 'ตามอุปกรณ์', light: 'สว่าง', dark: 'มืด', navy: 'น้ำเงิน', pink: 'ชมพู', lavender: 'ม่วง' };
export const TEXT_SCALE_LABEL: Record<TextScale, string> = { normal: 'ปกติ', large: 'ใหญ่', xlarge: 'ใหญ่มาก' };

export interface UserPreferences {
  theme: ThemeChoice;
  textScale: TextScale;
  /** รูปโปรไฟล์ (บุคลากร) — นักเรียนใช้ students/{id}.photoUrl เดิม */
  photoUrl: string;
}
export const DEFAULT_PREFERENCES: UserPreferences = { theme: 'system', textScale: 'normal', photoUrl: '' };
export const PHOTO_URL_MAX = 1000;
export const PREFS_STORAGE_KEY = 'ssc.prefs.v1';

export const isThemeChoice = (v: unknown): v is ThemeChoice => THEME_CHOICES.includes(v as ThemeChoice);
export const isTextScale = (v: unknown): v is TextScale => TEXT_SCALES.includes(v as TextScale);

/** อ่านค่าจากข้อมูลดิบ (Firestore/localStorage) — ค่าที่ไม่รู้จักตกเป็นค่าเริ่มต้น ไม่พัง */
export function normalizePreferences(raw: unknown): UserPreferences {
  const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    theme: isThemeChoice(x.theme) ? x.theme : DEFAULT_PREFERENCES.theme,
    textScale: isTextScale(x.textScale) ? x.textScale : DEFAULT_PREFERENCES.textScale,
    photoUrl: typeof x.photoUrl === 'string' && x.photoUrl.length <= PHOTO_URL_MAX && x.photoUrl.startsWith('https://') ? x.photoUrl : '',
  };
}

/** ธีมที่ใช้จริง 1 ใน 5 (แปลง 'system' ตามอุปกรณ์) — ตรงกับชื่อธีมใน themeTokens */
export const resolveThemeId = (choice: ThemeChoice, systemPrefersDark: boolean): ThemeId =>
  choice === 'system' ? (systemPrefersDark ? 'dark' : 'light') : choice;

/** โหมดพื้นฐาน (data-theme): น้ำเงิน (navy) เป็นธีมพื้นเข้มตามเอกสาร, ชมพู/ม่วงเป็นธีมสว่าง */
export const resolveTheme = (choice: ThemeChoice, systemPrefersDark: boolean): 'light' | 'dark' =>
  THEME_MODE[resolveThemeId(choice, systemPrefersDark)];

/**
 * ใช้ค่ากับเอกสาร: data-theme (โหมด) + data-palette (ธีม 1 ใน 5 — CSS โทเคนสีผูกกับค่านี้) + data-text-scale + meta theme-color
 * หน้า /info ไม่เรียกฟังก์ชันนี้และลบ data-palette ทิ้ง (main.tsx) จึงไม่ถูกย้อมสีตามธีม
 */
export function applyPreferences(p: Pick<UserPreferences, 'theme' | 'textScale'>, doc: Document = document, systemPrefersDark?: boolean): void {
  const dark = systemPrefersDark ?? (typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const id = resolveThemeId(p.theme, dark);
  const root = doc.documentElement;
  root.setAttribute('data-theme', THEME_MODE[id]);
  root.setAttribute('data-palette', id);
  root.setAttribute('data-text-scale', p.textScale);
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeMetaColor[id]);
}

export function loadLocalPreferences(): UserPreferences {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) || '{}')); }
  catch { return { ...DEFAULT_PREFERENCES }; }
}
export function saveLocalPreferences(p: UserPreferences): void {
  try { localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(p)); } catch { /* โหมดส่วนตัว/บล็อกที่เก็บ — ใช้ได้แค่ session นี้ */ }
}

/** ผลต่างที่ต้องเขียน Firestore (เฉพาะคีย์ที่เปลี่ยน — ไม่ส่ง photoUrl เมื่อไม่ได้เปลี่ยนรูป) */
export function prefsPatch(prev: UserPreferences, next: UserPreferences): Partial<UserPreferences> {
  const out: Partial<UserPreferences> = {};
  if (prev.theme !== next.theme) out.theme = next.theme;
  if (prev.textScale !== next.textScale) out.textScale = next.textScale;
  if (prev.photoUrl !== next.photoUrl) out.photoUrl = next.photoUrl;
  return out;
}
