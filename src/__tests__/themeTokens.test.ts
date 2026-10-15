import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_TOKENS, HEX_CLASS_TOKEN, ROLE_TOKEN, THEME_IDS, TOKEN_DEFS,
  buildThemeCss, contrastRatio, isColorValue, normalizeOverrides, sameColor,
} from '../lib/themeTokens';
import { ROLE_VISUALS } from '../components/NavbarWithRoleSwitcher';
import { readSource } from './helpers/readSource';

// ───────── ค่าเริ่มต้นต้องตรงกับเอกสาร docs/theme-color-tokens.md ทุกค่า ─────────
const DOC = readSource('docs/theme-color-tokens.md');
/** แถวของตาราง markdown ที่คอลัมน์แรกขึ้นต้นด้วย `label` → รายการค่าในวงเล็บ ` ของแต่ละคอลัมน์ */
function row(label: string, firstThemeCol: number, from = 0): string[][] {
  const line = DOC.slice(from).split('\n').find(l => l.startsWith('| ') && l.split('|')[1].replace(/\*\*/g, '').trim().startsWith(label));
  if (!line) throw new Error('ไม่พบแถว ' + label);
  const cells = line.split('|').slice(1, -1);
  return cells.slice(firstThemeCol, firstThemeCol + 5).map(c => [...c.matchAll(/`([^`]+)`/g)].map(m => m[1].trim()));
}
const sec = (h: string) => DOC.indexOf(h);
/** สีในเอกสารแบบ "#022C22 (alpha 0.6)" = rgba */
const docBg = (cell: string[], raw: string) => {
  const m = /alpha\s*([\d.]+)/.exec(raw);
  if (!m) return cell[0];
  const h = cell[0].slice(1);
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${m[1]})`;
};
function expectRow(label: string, keys: string[], firstCol: number, from: number) {
  const cols = row(label, firstCol, from);
  THEME_IDS.forEach((t, i) => keys.forEach((k, j) => {
    const want = cols[i][Math.min(j, cols[i].length - 1)];
    expect(sameColor(DEFAULT_TOKENS[t][k], want), `${t}.${k}: ${DEFAULT_TOKENS[t][k]} ≠ เอกสาร ${want}`).toBe(true);
  }));
}

describe('ค่าเริ่มต้นตรงกับเอกสารตารางปรับเทียบสีธีม', () => {
  it('1. พื้นหลังและพื้นผิว', () => {
    const s = sec('## 1.');
    expectRow('Base Body Background', ['bg'], 2, s);
    expectRow('Secondary Page Background', ['bgSecondary'], 2, s);
    expectRow('Primary Card / Modal Surface', ['surface'], 2, s);
    expectRow('Nested Card / Panel Inset', ['inset'], 2, s);
    expectRow('Sub-Bar / Filter Bar', ['subbar'], 2, s);
    expectRow('Control / Button Dark Surface', ['control'], 2, s);
    expectRow('Dark Elevated Card', ['elevated'], 2, s);
  });
  it('2. เส้นขอบ / 3. ตัวอักษร / สีเน้นหลัก', () => {
    const s2 = sec('## 2.');
    expectRow('Subtle White Border', ['borderSubtle'], 2, s2);
    expectRow('Subtle Slate Border', ['borderSlate'], 2, s2);
    expectRow('Interactive Border', ['borderInteractive'], 2, s2);
    const s3 = sec('## 3.');
    expectRow('Primary Text', ['text'], 2, s3);
    expectRow('High Contrast Text', ['textHigh1', 'textHigh2'], 2, s3);
    expectRow('Muted / Subtitle', ['textMuted'], 2, s3);
    expectRow('Dimmed / Disabled', ['textDisabled'], 2, s3);
    expectRow('สีเน้นหลัก', ['accent'], 1, sec('## สรุปชุดสีหลัก'));
  });
  it('4. สถานะการเข้าเรียน (ข้อความ 400/500 + พื้นหลัง)', () => {
    const s = sec('## 4.');
    for (const [label, k] of [['มาเรียน (PRESENT)', 'present'], ['มาสาย (LATE)', 'late'], ['ขาดเรียน (ABSENT)', 'absent'], ['ลากิจ/ลาป่วย (LEAVE)', 'leave']] as const) {
      expectRow(`${label} - ข้อความ`, [`${k}400`, `${k}500`], 2, s);
      const line = DOC.slice(s).split('\n').find(l => l.includes(`**${label} - พื้นหลัง**`))!;
      const cells = line.split('|').slice(1, -1).slice(2, 7);
      THEME_IDS.forEach((t, i) => {
        const want = docBg([...cells[i].matchAll(/`([^`]+)`/g)].map(m => m[1]), cells[i]);
        expect(sameColor(DEFAULT_TOKENS[t][`${k}Bg`], want), `${t}.${k}Bg: ${DEFAULT_TOKENS[t][`${k}Bg`]} ≠ ${want}`).toBe(true);
      });
    }
    expectRow('ความเสี่ยงวิกฤต', ['critical400', 'critical500'], 2, s);
  });
  it('5. บทบาทผู้ใช้งาน 14 บทบาท', () => {
    const s = sec('## 5.');
    for (const [role, { key }] of Object.entries(ROLE_TOKEN)) expectRow(role, [key], 3, s);
  });
  it('6. แบรนด์และบริการภายนอก', () => {
    const s = sec('## 6.');
    expectRow('System Brand Accent (Gradient Start)', ['brandStart'], 2, s);
    expectRow('System Brand Accent (Gradient End)', ['brandEnd'], 2, s);
    expectRow('LINE Official Account', ['lineBg', 'lineHover'], 2, s);
    expectRow('Google Workspace', ['googleBg', 'googleText'], 2, s);
  });
  it('ทุกธีมมีครบทุกโทเคน และทุกค่าเป็นสีที่ถูกต้อง', () => {
    for (const t of THEME_IDS) for (const d of TOKEN_DEFS) expect(isColorValue(DEFAULT_TOKENS[t][d.key]), `${t}.${d.key}`).toBe(true);
  });
});

describe('ความปลอดภัยของค่าที่บันทึก (ค่าถูกใส่ใน <style>)', () => {
  it('รับเฉพาะ #hex และ rgb/rgba ตัวเลข', () => {
    for (const ok of ['#fff', '#FFFFFF', '#00000080', 'rgba(15,23,42,0.08)', 'rgb(1, 2, 3)', 'rgba(255,255,255,1)']) expect(isColorValue(ok), ok).toBe(true);
    for (const bad of ['red', '#ggg', 'rgba(300,0,0,1)', 'red;} body{display:none', '#fff;}*{color:red', 'url(x)', 'var(--x)', 'expression(alert(1))', '', 5, null]) {
      expect(isColorValue(bad), String(bad)).toBe(false);
    }
  });
  it('normalizeOverrides ทิ้งธีม/คีย์ที่ไม่รู้จัก, คีย์ที่ล็อก (สีแบรนด์), ค่าผิดรูปแบบ และค่าที่เท่าค่าเริ่มต้น', () => {
    const n = normalizeOverrides({
      pink: { accent: '#AA3366', lineBg: '#000000', bogus: '#111111', text: 'red;}', bg: '#fff5f7' },
      hacker: { bg: '#000000' },
    });
    expect(n).toEqual({ pink: { accent: '#AA3366' } });
    expect(buildThemeCss({ pink: { text: '#000;} body{display:none' } as Record<string, string> })).not.toContain('display:none');
  });
});

describe('CSS ที่สร้าง', () => {
  it('ธีมมืด (ต้นฉบับ) ไม่ถูกแตะถ้าแอดมินไม่ได้แก้ — แก้แล้วมีผลเฉพาะค่านั้น', () => {
    expect(buildThemeCss({})).not.toContain('[data-palette="dark"]');
    const css = buildThemeCss({ dark: { surface: '#123456' } });
    expect(css).toContain(':root[data-palette="dark"][data-theme] [class~="bg-[#151921]"] { background-color: #123456; }');
    expect(css).toContain('[class~="bg-[#161f30]/60"] { background-color: color-mix(in srgb, #123456 60%, transparent); }');
    expect(css).not.toMatch(/\[data-palette="dark"\][^{]*\{[^}]*--color-slate-900/);
  });
  it('ทุกธีมอื่นมีชุดตัวแปรครบ (พื้น/ข้อความ/สถานะ/บทบาท) และแถบบน/เมนูข้าง', () => {
    const css = buildThemeCss({});
    for (const t of ['light', 'navy', 'pink', 'lavender']) {
      expect(css).toContain(`:root[data-palette="${t}"][data-theme] {`);
      expect(css).toContain(`[data-palette="${t}"][data-theme] [data-shell="topbar"]`);
      expect(css).toContain(`[data-palette="${t}"][data-theme] [data-shell="sidebar"]`);
    }
    expect(css).toContain(`--color-slate-900: ${DEFAULT_TOKENS.navy.bgSecondary}`);
    expect(css).toContain(`--color-red-400: ${DEFAULT_TOKENS.pink.absent400}`);
    expect(css).toContain(`--role-super-admin: ${DEFAULT_TOKENS.lavender.roleSuperAdmin}`);
    expect(css).toContain(`[class*="bg-emerald-950"] { background-color: ${DEFAULT_TOKENS.light.presentBg}; }`);
  });
  it('แถบสีเข้มบนธีมสว่างคืนสเกลสีเดิม (ตัวหนังสือขาว); แถบสีอ่อนไม่คืน', () => {
    const css = buildThemeCss({});
    expect(css).toMatch(/\[data-palette="pink"\]\[data-theme\] \[data-shell="topbar"\] \{\n  color: #f8fafc;/);
    expect(css).not.toMatch(/\[data-palette="light"\]\[data-theme\] \[data-shell="sidebar"\] \{\n  color: #f8fafc;/); // เมนูข้างธีมสว่าง = ขาว
  });
  it('contrastRatio ตามสูตร WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
  });
});

describe('ผูกกับโค้ดจริง', () => {
  it('class พื้นหลังสีเข้มแบบฮาร์ดโค้ด bg-[#hex] ทุกตัวใน src/ ถูกจัดกลุ่มเข้าโทเคนแล้ว', () => {
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); } else if (/\.(tsx?|css)$/.test(f)) files.push(p); } };
    walk('src');
    // สีที่มีโทนชัด (ไม่ใช่พื้นเทาเข้ม) ไม่ต้องตามธีม
    const TINTED = new Set(['#1b2a4a', '#23365d', '#3b2211', '#4a2b16']);
    const missing = new Set<string>();
    for (const f of files) {
      for (const m of readSource(f).matchAll(/bg-\[(#[0-9a-fA-F]{6})\]/g)) {
        const h = m[1].toLowerCase();
        const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
        const isDarkNeutral = Math.max(r, g, b) < 64 && Math.max(r, g, b) - Math.min(r, g, b) < 40;
        if (isDarkNeutral && !TINTED.has(h) && !HEX_CLASS_TOKEN[h]) missing.add(`${h} (${f})`);
      }
    }
    expect([...missing], 'เพิ่มสีเหล่านี้ใน HEX_CLASS_TOKEN (src/lib/themeTokens.ts)').toEqual([]);
  });
  it('ป้ายบทบาท 14 บทบาทในเอกสารใช้ตัวแปร --role-… และ index.css มีค่าเริ่มต้น = สีเดิม', () => {
    const idx = readSource('src/index.css');
    for (const [role, { cssVar }] of Object.entries(ROLE_TOKEN)) {
      expect(ROLE_VISUALS[role].badgeText).toBe(`text-(${cssVar})`);
      expect(ROLE_VISUALS[role].badgeBg).toBe(`bg-(${cssVar})/10`);
      expect(idx).toMatch(new RegExp(`${cssVar}: var\\(--color-[a-z]+-400\\);`));
    }
  });
  it('หน้าแอดมิน "ธีมสี" อยู่ในเมนูจัดการระบบ บันทึกจริงผ่าน Firestore และติดตั้งโทเคนก่อนวาดหน้า', () => {
    const admin = readSource('src/AdminPortal.tsx');
    expect(admin).toContain("id: 'theme-tokens'");
    expect(admin).toContain("activeTab === 'theme-tokens' && <ThemeTokensPage />");
    const page = readSource('src/components/admin/ThemeTokensPage.tsx');
    expect(page).toContain('await saveThemeTokens(draft, uid)');
    expect(page).not.toMatch(/setTimeout|window\.confirm/);
    expect(readSource('src/main.tsx')).toContain('installThemeTokens(loadCachedOverrides())');
    expect(readSource('src/App.tsx')).toContain('useThemeTokens(!!user)');
  });
  it('ข้อความ/ไอคอนขาวบนปุ่มไล่สีทึบคงเป็นขาวในธีมสว่าง แม้คลาสมี "/" อื่น (เช่น border-white/10) แต่ไม่แตะไล่สีโปร่งใส', () => {
    const css = buildThemeCss({});
    expect(css).toContain('-600 to-"]');
    expect(css).not.toMatch(/bg-gradient-to-"\]:not\(\[class\*="\/"\]\)/);
  });
  it('ธีมสว่างมีกฎ text-<สี>-100 → เฉด -200 (กล่องหมายเหตุสีเหลืองต้องอ่านออก) โดยไม่แตะ bg-/border-*-100', () => {
    const css = readSource('src/theme-light.css');
    expect(css).toContain(':root[data-theme="light"] .text-amber-100 { color: var(--color-amber-200); }');
    expect(css).not.toMatch(/--color-amber-100:/);
  });
});
