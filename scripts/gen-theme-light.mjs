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
`;
writeFileSync('src/theme-light.css', css);
console.log('wrote src/theme-light.css', css.length, 'bytes');
