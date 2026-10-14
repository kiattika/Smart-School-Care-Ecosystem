import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREFERENCES, applyPreferences, normalizePreferences, prefsPatch, resolveTheme, THEME_COLOR,
} from '../lib/userPreferences';
import { readSource } from './helpers/readSource';

describe('normalizePreferences', () => {
  it('ค่าที่ไม่รู้จัก/ว่าง/ผิดชนิดตกเป็นค่าเริ่มต้น ไม่พัง', () => {
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(normalizePreferences({ theme: 'purple', textScale: 9, photoUrl: 5 })).toEqual(DEFAULT_PREFERENCES);
  });
  it('รับค่าที่ถูกต้อง และรูปต้องเป็น https เท่านั้น', () => {
    expect(normalizePreferences({ theme: 'light', textScale: 'large', photoUrl: 'https://x.y/z.jpg' })).toEqual({ theme: 'light', textScale: 'large', photoUrl: 'https://x.y/z.jpg' });
    expect(normalizePreferences({ photoUrl: 'javascript:alert(1)' }).photoUrl).toBe('');
    expect(normalizePreferences({ photoUrl: 'http://x.y/z.jpg' }).photoUrl).toBe('');
  });
});

describe('resolveTheme / applyPreferences', () => {
  it('system ตามอุปกรณ์; light/dark ตามที่เลือก', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('ตั้ง data-theme, data-text-scale และสี theme-color ของเบราว์เซอร์', () => {
    const attrs: Record<string, string> = {};
    const meta = { content: '#000', setAttribute(k: string, v: string) { if (k === 'content') this.content = v; } };
    const fakeDoc = {
      documentElement: { setAttribute: (k: string, v: string) => { attrs[k] = v; } },
      querySelector: (sel: string) => (sel === 'meta[name="theme-color"]' ? meta : null),
    } as unknown as Document;
    applyPreferences({ theme: 'light', textScale: 'xlarge' }, fakeDoc, true);
    expect(attrs['data-theme']).toBe('light');
    expect(attrs['data-text-scale']).toBe('xlarge');
    expect(meta.content).toBe(THEME_COLOR.light);
    applyPreferences({ theme: 'system', textScale: 'normal' }, fakeDoc, true);
    expect(attrs['data-theme']).toBe('dark');
    expect(meta.content).toBe(THEME_COLOR.dark);
  });
});

describe('prefsPatch', () => {
  it('ส่งเฉพาะคีย์ที่เปลี่ยน (ไม่เขียนรูปเดิมซ้ำ)', () => {
    const a = { ...DEFAULT_PREFERENCES, photoUrl: 'https://x/y.jpg' };
    expect(prefsPatch(a, { ...a, theme: 'dark' })).toEqual({ theme: 'dark' });
    expect(prefsPatch(a, a)).toEqual({});
    expect(prefsPatch(a, { ...a, photoUrl: '' })).toEqual({ photoUrl: '' });
  });
});

describe('ธีมสว่าง + wiring', () => {
  const css = readSource('src/theme-light.css');
  it('สลับสเกล slate (900 ในธีมสว่าง = ค่าของ 100 เดิม) และตั้ง color-scheme', () => {
    const theme = readSource('node_modules/tailwindcss/theme.css');
    const v = (n: string) => theme.match(new RegExp(`--color-${n}:\\s*([^;]+);`))![1].trim();
    // พื้นผิว 700–950 ถูกปรับเป็นเทาอมฟ้านวลโดยตั้งใจ (กันขาวโพลน) — ที่เหลือกลับด้านตรง ๆ
    expect(css).toContain('--color-slate-900: #e8ecf2;');
    expect(css).toContain('--color-slate-950: #f4f6f9;');
    expect(css).toContain(`--color-slate-100: ${v('slate-900')};`);
    expect(css).toContain(`--color-slate-50: ${v('slate-950')};`);
    expect(css).toContain('color-scheme: light');
  });
  it('กล่อง bg-white (กระดาษพิมพ์) คืนสเกลสีเดิม และหน้า /info ไม่ตามธีมส่วนตัว', () => {
    const theme = readSource('node_modules/tailwindcss/theme.css');
    const orig900 = theme.match(/--color-slate-900:\s*([^;]+);/)![1].trim();
    const start = css.indexOf('.bg-white {');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start));
    expect(block).toContain(`--color-slate-900: ${orig900};`);
    expect(readSource('src/main.tsx')).toMatch(/isPublicInfoPath/);
    expect(readSource('src/main.tsx')).toMatch(/data-theme', 'dark'/);
  });
  it('index.css นำเข้าธีมสว่าง + ขนาดตัวอักษร และ body ใช้ตัวแปร', () => {
    const idx = readSource('src/index.css');
    expect(idx).toMatch(/@import "\.\/theme-light\.css"/);
    expect(idx).toMatch(/data-text-scale="large"/);
    expect(idx).toMatch(/var\(--app-body-bg/);
  });
  it('App ใช้ useMyPreferences ระดับบนสุด; Navbar มีปุ่มตั้งค่า; index.html กันจอกะพริบ', () => {
    expect(readSource('src/App.tsx')).toMatch(/useMyPreferences\(user\?\.uid\)/);
    expect(readSource('src/components/NavbarWithRoleSwitcher.tsx')).toMatch(/<UserSettingsModal/);
    expect(readSource('index.html')).toMatch(/ssc\.prefs\.v1/);
  });
  it('rules และ storage.rules มี user_preferences / profile_photos', () => {
    expect(readSource('firestore.rules')).toMatch(/match \/user_preferences\/\{uid\}/);
    expect(readSource('storage.rules')).toMatch(/match \/profile_photos\/\{ownerUid\}\/\{fileName\}/);
  });
  it('ไฟล์ธีมสว่างตรงกับที่สคริปต์สร้าง (ห้ามแก้มือ)', () => {
    expect(readSource('src/theme-light.css').startsWith('/* สร้างโดย scripts/gen-theme-light.mjs')).toBe(true);
  });
});
