// สร้าง src/theme-light.css — ธีมสว่างโดย "สลับสเกลสี" ของ Tailwind (ไม่ต้องแก้ class ในคอมโพเนนต์ร้อยไฟล์)
// ทำไมใช้ได้: Tailwind v4 คอมไพล์ bg-slate-900 เป็น var(--color-slate-900) → เปลี่ยนค่าตัวแปรใต้ [data-theme="light"] ก็พอ
// รัน: node scripts/gen-theme-light.mjs  (ผลลัพธ์ถูก commit; ไม่ได้รันตอน build)
import { readFileSync, writeFileSync } from 'node:fs';
const theme = readFileSync('node_modules/tailwindcss/theme.css', 'utf8');
const v = (name) => { const m = theme.match(new RegExp(`--color-${name}:\\s*([^;]+);`)); if (!m) throw new Error('missing ' + name); return m[1].trim(); };
const out = [];
// พื้นผิว/เส้น/ข้อความเทา: กลับสเกล 50↔950
const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
steps.forEach((s, i) => out.push(`  --color-slate-${s}: ${v('slate-' + steps[steps.length - 1 - i])};`));
// ปรับพื้นผิวให้ "ไม่ขาวโพลน" (ผู้ใช้แจ้งว่าสเกลกลับด้านตรง ๆ ได้พื้นขาวเกือบทั้งหน้า): พื้นหน้า/กล่อง/เส้นขอบเข้มขึ้นเป็นเทาอมฟ้านวล
// ช่องกรอก/บ่อ (slate-950) สว่างกว่าพื้นหน้าเล็กน้อย; ข้อความรอง (slate-500) เข้มขึ้นให้ผ่าน 4.5:1 บนพื้นใหม่
const override = { '950': '#f4f6f9', '900': '#e8ecf2', '800': '#d9dfe8', '700': '#c5cdd9', '500': 'oklch(50% 0.046 257.417)' };
for (const [s, c] of Object.entries(override)) {
  const i = out.findIndex(l => l.startsWith(`  --color-slate-${s}:`));
  out[i] = `  --color-slate-${s}: ${c};`;
}
// สีเน้น: ข้อความโทนอ่อน (200-400) ถูกออกแบบสำหรับพื้นมืด → ใช้โทนเข้มแทนบนพื้นสว่าง
const hues = ['cyan', 'emerald', 'amber', 'rose', 'sky', 'blue', 'indigo', 'violet', 'purple', 'pink', 'orange', 'teal', 'green', 'red', 'yellow', 'lime', 'fuchsia'];
for (const h of hues) {
  out.push(`  --color-${h}-200: ${v(h + '-800')};`);
  out.push(`  --color-${h}-300: ${v(h + '-700')};`);
  out.push(`  --color-${h}-400: ${v(h + '-600')};`);
}
// พื้นที่ "กระดาษขาว" (bg-white: เอกสารพิมพ์ ปพ.5/ปพ.6/หนังสือราชการ, ปุ่มขาว) ออกแบบมาให้ตัวหนังสือ slate เข้มบนพื้นขาว
// → ภายในกล่องนี้คืนค่าสเกลสีเดิม (ตัวแปร CSS สืบทอดลงลูกหลาน) ไม่งั้นตัวหนังสือจะกลายเป็นสีอ่อนบนพื้นขาว
const restore = [];
steps.forEach((s) => restore.push(`  --color-slate-${s}: ${v('slate-' + s)};`));
for (const h of hues) for (const n of ['200', '300', '400']) restore.push(`  --color-${h}-${n}: ${v(h + '-' + n)};`);

// ───────── ธีมโทนสี (navy / pink / lavender) = โหมดสว่าง + data-palette ─────────
// หลักการ: สเกล slate ของโหมดสว่างถูกย้อมโทนสี, สีเน้น indigo/violet เปลี่ยนเป็นสีเน้นของธีม,
// แถบบน/แถบเมนูข้าง (data-shell) เป็นพื้นเข้มของธีมและคืนสเกลสีเดิมภายใน (ตัวหนังสือขาวอ่านได้เหมือนธีมมืด)
// สีสถานะ (แดง/เหลือง/เขียว/ฟ้า — red, rose, amber, orange, yellow, emerald, green, cyan, sky) ไม่ถูกแตะ จึงความหมายเดิมทุกธีม
const palettes = {
  navy: {
    body: '#f0f4f8', fg: '#102a43',
    slate: { 950: '#ffffff', 900: '#e6ecf3', 800: '#d9e2ec', 700: '#c3cfdc', 500: '#4c6480', 400: '#3e5470', 300: '#2c4159', 200: '#1d3249', 100: '#102a43', 50: '#0b1e33' },
    accent: { 700: '#1e40af', 600: '#1d4ed8', 500: '#2563eb', 400: '#1d4ed8', 300: '#1e40af', 200: '#1e3a8a' },
    sidebar: '#1b2a4a', topbar: '#0f1a34',
  },
  pink: {
    body: '#fff5f5', fg: '#4a242b',
    slate: { 950: '#ffffff', 900: '#fbe9e9', 800: '#f7d6d6', 700: '#ebbfc2', 500: '#7a5c63', 400: '#6a4a52', 300: '#5a3a42', 200: '#4a242b', 100: '#4a242b', 50: '#35181e' },
    accent: { 700: '#7e3249', 600: '#9c425d', 500: '#b0506c', 400: '#9c425d', 300: '#8c3a55', 200: '#7e3249' },
    sidebar: '#9c425d', topbar: '#70243b',
  },
  lavender: {
    body: '#f8f7fc', fg: '#2d2544',
    slate: { 950: '#ffffff', 900: '#eeebf7', 800: '#e6e4f2', 700: '#d2cee6', 500: '#6b6280', 400: '#5a5170', 300: '#473e5e', 200: '#3a3150', 100: '#2d2544', 50: '#1f1830' },
    accent: { 700: '#3a2cd0', 600: '#4a3aff', 500: '#6154ff', 400: '#4a3aff', 300: '#3a2cd0', 200: '#2f23a8' },
    sidebar: '#4a3aff', topbar: '#2a1b60',
  },
};
// แถบบน/เมนูข้างของโหมดสว่างปกติ: แถบบนสีน้ำเงินเข้ม (ตาม UI Style Guide) เมนูข้างคงโทนเทาอ่อนเดิม
const shells = [{ sel: ':root[data-theme="light"]:not([data-palette]) [data-shell="topbar"]', bg: '#1e3a8a' }];
let pcss = '';
for (const [name, p] of Object.entries(palettes)) {
  const R = `:root[data-theme="light"][data-palette="${name}"]`;
  const lines = Object.entries(p.slate).map(([k, c]) => `  --color-slate-${k}: ${c};`);
  for (const h of ['indigo', 'violet', 'purple']) for (const [k, c] of Object.entries(p.accent)) lines.push(`  --color-${h}-${k}: ${c};`);
  pcss += `\n${R} {\n${lines.join('\n')}\n  --app-body-bg: ${p.body};\n  --app-body-fg: ${p.fg};\n}\n`;
  // กล่อง bg-white (กระดาษพิมพ์) ต้องคืนสเกลเดิมเหมือนโหมดสว่างปกติ — ความจำเพาะของ .bg-white ต้องชนะสเกลโทนสี
  pcss += `${R} .bg-white {\n  color: #0f172a;\n${restore.join('\n')}\n}\n`;
  shells.push({ sel: `${R} [data-shell="topbar"]`, bg: p.topbar }, { sel: `${R} [data-shell="sidebar"]`, bg: p.sidebar });
}
// ภายในแถบเข้ม: คืนสเกลเดิม + ตัวหนังสือขาว + ชั้นโปร่งขาว (เหมือนธีมมืด)
// ข้อความรอง (slate-400/500) บนแถบสีสด (เช่น ลาเวนเดอร์ #4a3aff) ต้องสว่างขึ้นให้ผ่าน 4.5:1
const shellRestore = restore.filter(l => !/-(indigo|violet|purple)-/.test(l) && !/--color-slate-(400|500):/.test(l)).concat(['  --color-slate-400: #e2e8f0;', '  --color-slate-500: #e2e8f0;']);
for (const sh of shells) {
  const accentWhite = ['indigo', 'violet'].flatMap(h => [`  --color-${h}-200: #ffffff;`, `  --color-${h}-300: #e0e7ff;`, `  --color-${h}-400: #ffffff;`, `  --color-${h}-500: #ffffff;`]);
  pcss += `\n${sh.sel} {\n  background-color: ${sh.bg};\n  color: #f8fafc;\n  border-color: rgb(255 255 255 / 0.14);\n${shellRestore.join('\n')}\n${accentWhite.join('\n')}\n}\n`;
  pcss += `${sh.sel} .text-white { color: #ffffff; }\n`;
  pcss += `${sh.sel} [class*="bg-white/"] { background-color: rgb(255 255 255 / 0.08); }\n`;
  pcss += `${sh.sel} [class*="border-white/"], ${sh.sel} [class*="border-slate-"] { border-color: rgb(255 255 255 / 0.16); }\n`;
}

const css = `/* สร้างโดย scripts/gen-theme-light.mjs — อย่าแก้มือ */
:root[data-theme="light"] {
  color-scheme: light;
${out.join('\n')}
  --app-body-bg: #e8ecf2;
  --app-body-fg: #0f172a;
}

/* กระดาษขาว: คืนสเกลสีเดิมภายในกล่อง */
:root[data-theme="light"] .bg-white {
  color: #0f172a;
${restore.join('\n')}
}

/* ข้อความ text-white บนพื้นหลักเดิม → สีเข้ม; บนปุ่ม/ป้ายสีสด คงเป็นขาว */
:root[data-theme="light"] .text-white { color: #0f172a; }
:root[data-theme="light"] :is([class*="bg-cyan-"],[class*="bg-emerald-"],[class*="bg-rose-"],[class*="bg-blue-"],[class*="bg-indigo-"],[class*="bg-violet-"],[class*="bg-purple-"],[class*="bg-pink-"],[class*="bg-orange-"],[class*="bg-teal-"],[class*="bg-sky-"],[class*="bg-red-"],[class*="bg-green-"],[class*="bg-amber-"],[class*="bg-fuchsia-"]):is([class*="-500"],[class*="-600"],[class*="-700"],[class*="-800"]):not([class*="/"]) :is(.text-white, svg),
:root[data-theme="light"] :is([class*="bg-cyan-"],[class*="bg-emerald-"],[class*="bg-rose-"],[class*="bg-blue-"],[class*="bg-indigo-"],[class*="bg-violet-"],[class*="bg-purple-"],[class*="bg-pink-"],[class*="bg-orange-"],[class*="bg-teal-"],[class*="bg-sky-"],[class*="bg-red-"],[class*="bg-green-"],[class*="bg-amber-"],[class*="bg-fuchsia-"]):is([class*="-500"],[class*="-600"],[class*="-700"],[class*="-800"]):not([class*="/"]).text-white { color: #ffffff; }

/* พื้นหลังฮาร์ดโค้ด hex สีเข้ม (bg-[#0b0f19] ฯลฯ) และชั้นโปร่งขาว/ดำ */
:root[data-theme="light"] [class*="bg-[#"] { background-color: var(--color-slate-900); }
:root[data-theme="light"] [class*="border-white/"] { border-color: rgb(15 23 42 / 0.14); }
:root[data-theme="light"] [class*="bg-white/"] { background-color: rgb(15 23 42 / 0.04); }
:root[data-theme="light"] [class*="divide-white/"] > :not(:last-child) { border-color: rgb(15 23 42 / 0.14); }
:root[data-theme="light"] ::placeholder { color: var(--color-slate-500); }
:root[data-theme="light"] .shadow-2xl, :root[data-theme="light"] .shadow-xl { --tw-shadow-color: rgb(15 23 42 / 0.15); }
`+pcss;
writeFileSync('src/theme-light.css', css);
console.log('wrote src/theme-light.css', css.length, 'bytes');
