# ตารางปรับเทียบสีธีม (Theme Color Tokens) — ฉบับ GPT

> วัตถุประสงค์: ใช้เป็นเอกสารอ้างอิงสำหรับพัฒนาโปรแกรมต่อ โดยคงรายการ บทบาท และคำอธิบายจาก `theme_color_tokens.md` ครบถ้วน พร้อมเพิ่มค่าสีสำหรับธีม 1, 3, 4 และ 5
>
> **ธีม 2 (Dark Obsidian / Deep Slate)** คือค่าสีต้นฉบับจากไฟล์ที่แนบ และคงค่าเดิมไว้ ส่วนธีม 1, 3, 4, 5 เป็น **ค่าที่เสนอเพิ่ม** ให้แต่ละธีมมีลำดับความสว่าง พื้นผิว ตัวอักษร เส้นขอบ และสีเน้นที่สัมพันธ์กัน
>
> - **1. Light** — พื้นหลังสว่าง พื้นผิวขาว ข้อความเข้ม
> - **2. Dark Obsidian / Deep Slate** — ธีมต้นฉบับจากไฟล์
> - **3. Blue** — พื้นหลังโทนน้ำเงินเข้ม พื้นผิวฟ้าอมขาว ตัวอักษรน้ำเงินเข้ม
> - **4. Pink** — พื้นหลังชมพูอ่อน พื้นผิวขาวอมชมพู ตัวอักษรไวน์เข้ม
> - **5. Purple** — พื้นหลังลาเวนเดอร์อ่อน พื้นผิวขาวอมม่วง ตัวอักษรม่วงเข้ม
>
> **หมายเหตุการใช้งาน:** สีในธีม 1, 3, 4, 5 เป็นข้อเสนอการออกแบบ ไม่ใช่ค่าที่มีอยู่ในไฟล์ต้นฉบับ ควรทดสอบ contrast/accessibility ใน UI จริงก่อนใช้งานจริง

## สรุปชุดสีหลัก

| บทบาทสี | 1. Light | 2. Dark Obsidian / Deep Slate (ต้นฉบับ) | 3. Blue | 4. Pink | 5. Purple |
|---|---|---|---|---|---|
| พื้นหลังหลัก | `#F4F6F9` | `#0B0D14` | `#071426` | `#FFF5F7` | `#F7F5FF` |
| พื้นหลังหน้ารอง | `#E9EEF5` | `#0F172A` | `#0B1D36` | `#FCE8EF` | `#EEE9FF` |
| พื้นผิวการ์ด | `#FFFFFF` | `#151921` | `#10243D` | `#FFFFFF` | `#FFFFFF` |
| พื้นผิวซ้อน/Inset | `#F8FAFC` | `#0B0F19` | `#0B1A2E` | `#FFF9FB` | `#FBFAFF` |
| สีเน้นหลัก | `#2563EB` | `#3B82F6` | `#3B82F6` | `#C43D70` | `#7655E8` |
| ข้อความหลัก | `#1E293B` | `#FFFFFF` | `#EAF2FF` | `#542238` | `#30245A` |
| ข้อความรอง | `#64748B` | `#94A3B8` | `#9DB6D5` | `#A66B80` | `#8176A8` |
| เส้นขอบหลัก | `#E2E8F0` | `rgba(255,255,255,0.10)` | `#294766` | `#F0C9D8` | `#DCD3F5` |

---

## 1. พื้นหลังและพื้นผิว (Background & Surface Tokens)

| ชื่อโทเคน (Token Name) | คลาส Tailwind / CSS | 1. Light | 2. Dark Obsidian / Deep Slate | 3. Blue | 4. Pink | 5. Purple | คำอธิบายและการนำไปใช้งาน |
|---|---|---|---|---|---|---|---|
| **Base Body Background** | `--color-dark-bg` / `bg-[#…]` | `#F4F6F9` | `#0B0D14` | `#071426` | `#FFF5F7` | `#F7F5FF` | สีพื้นหลังหลักของเว็บไซต์และแอปพลิเคชันทั้งหมด |
| **Secondary Page Background** | `bg-slate-900` หรือ theme alias | `#E9EEF5` | `#0F172A` | `#0B1D36` | `#FCE8EF` | `#EEE9FF` | พื้นหลังหน้า App, Login Page, และหน้าโหลดระบบ |
| **Primary Card / Modal Surface** | `bg-[#…]` | `#FFFFFF` | `#151921` | `#10243D` | `#FFFFFF` | `#FFFFFF` | พื้นผิวกล่องการ์ดเนื้อหาหลัก, กล่อง Login, หน้าต่าง Modal |
| **Nested Card / Panel Inset** | `bg-[#…]` | `#F8FAFC` | `#0B0F19` | `#0B1A2E` | `#FFF9FB` | `#FBFAFF` | บล็อกย่อยภายในการ์ด, กล่องประวัติคาบเรียน, รายการสอนแทน |
| **Sub-Bar / Filter Bar** | `bg-[#…]` | `#F1F5F9` | `#141926` | `#132A45` | `#FBEAF0` | `#F0ECFF` | แถบ Action Bar และแถบสถิติในหน้าต่างบันทึกเวลาเรียน |
| **Control / Button Dark Surface** | `bg-[#…]` | `#E2E8F0` | `#1C1F2B` | `#1A3452` | `#F5DCE6` | `#E4DCFF` | ชิปปุ่มกด, กล่องเลือกหัวข้อย่อย, ตัวเลือกพฤติกรรม |
| **Dark Elevated Card** | `bg-slate-800` / `bg-slate-800/80` หรือ theme alias | `#FFFFFF` | `#1E293B` / `rgba(30,41,59,0.8)` | `#193552` / `rgba(25,53,82,0.8)` | `#FFFFFF` / `rgba(255,255,255,0.8)` | `#FFFFFF` / `rgba(255,255,255,0.8)` | กล่องสถิติ, เมนู Dropdown, แถบสถานะ |

## 2. เส้นขอบ (Border Tokens)

| ชื่อโทเคน | คลาส Tailwind | 1. Light | 2. Dark Obsidian / Deep Slate | 3. Blue | 4. Pink | 5. Purple | คำอธิบายและการนำไปใช้งาน |
|---|---|---|---|---|---|---|---|
| **Subtle White Border** | `border-white/10` หรือ theme alias | `rgba(15,23,42,0.08)` | `rgba(255,255,255,0.10)` | `rgba(219,234,254,0.12)` | `rgba(131,24,67,0.10)` | `rgba(76,29,149,0.10)` | เส้นขอบการ์ดหลัก, โมดอล, ปุ่มกดโปร่งแสง |
| **Subtle Slate Border** | `border-slate-800/80` หรือ theme alias | `#E2E8F0` | `rgba(30,41,59,0.80)` | `rgba(41,71,102,0.80)` | `rgba(240,201,216,0.85)` | `rgba(220,211,245,0.85)` | เส้นแบ่งส่วนเนื้อหา, เส้นคั่นตาราง |
| **Interactive Border** | `border-slate-700` หรือ theme alias | `#CBD5E1` | `#334155` | `#355A80` | `#D99AB5` | `#B6A7E8` | เส้นขอบเมื่อ Hover หรือสถานะ Active ปกติ |

## 3. ตัวอักษรและเนื้อหา (Typography Tokens)

| ระดับความสำคัญ | คลาส Tailwind | 1. Light | 2. Dark Obsidian / Deep Slate | 3. Blue | 4. Pink | 5. Purple | การนำไปใช้งาน |
|---|---|---|---|---|---|---|---|
| **Primary Text** | `text-white` หรือ theme alias | `#1E293B` | `#FFFFFF` | `#F1F7FF` | `#542238` | `#30245A` | หัวข้อหลัก, ชื่อนักเรียน, ข้อความเด่น |
| **High Contrast Text** | `text-slate-100` / `text-slate-200` หรือ theme alias | `#334155` | `#F1F5F9` / `#E2E8F0` | `#D8E8FA` / `#C4D9F0` | `#71324D` / `#843B5B` | `#493777` / `#5A478B` | ข้อความเนื้อหาทั่วไป |
| **Muted / Subtitle** | `text-slate-400` หรือ theme alias | `#64748B` | `#94A3B8` | `#9DB6D5` | `#A66B80` | `#8176A8` | คำอธิบายกำกับ, วันที่, คาบเรียน |
| **Dimmed / Disabled** | `text-slate-500` หรือ theme alias | `#94A3B8` | `#64748B` | `#6F8EAF` | `#C08CA0` | `#A69BC8` | ข้อความแนะนำเพิ่มเติม, ตัวเลือกที่ยังไม่ถูกเลือก |

## 4. สถานะและการเข้าเรียน (Attendance & Status Tokens)

> คงความหมายของสีสถานะให้สอดคล้องกันทุกธีม: เขียว = มาเรียน/สำเร็จ, อำพัน = มาสาย/รอดำเนินการ, แดง = ขาดเรียน/ผิดพลาด, น้ำเงิน = ลา, ชมพูแดง = ความเสี่ยงวิกฤต

| สถานะ | คลาส Tailwind | 1. Light | 2. Dark Obsidian / Deep Slate | 3. Blue | 4. Pink | 5. Purple | บริบทการใช้งาน |
|---|---|---|---|---|---|---|---|
| **มาเรียน (PRESENT) - ข้อความ** | `text-emerald-400` / `text-emerald-500` หรือ semantic alias | `#047857` / `#059669` | `#34D399` / `#10B981` | `#6EE7B7` / `#34D399` | `#047857` / `#059669` | `#047857` / `#059669` | สถานะมาเรียน, ข้อความยืนยันสำเร็จ, ส่งตรงเวลา |
| **มาเรียน (PRESENT) - พื้นหลัง** | `bg-emerald-950/60` หรือ semantic alias | `rgba(16,185,129,0.12)` | `#022C22` (alpha 0.6) | `rgba(16,185,129,0.18)` | `rgba(16,185,129,0.12)` | `rgba(16,185,129,0.12)` | ปุ่มและแท็กสถานะมาเรียน |
| **มาสาย (LATE) - ข้อความ** | `text-amber-400` / `text-amber-500` หรือ semantic alias | `#B45309` / `#D97706` | `#FBBF24` / `#F59E0B` | `#FCD34D` / `#FBBF24` | `#B45309` / `#D97706` | `#B45309` / `#D97706` | สถานะมาสาย, คำขอรอดำเนินการ, ส่งงานช้ากว่ากำหนด |
| **มาสาย (LATE) - พื้นหลัง** | `bg-amber-950/60` หรือ semantic alias | `rgba(245,158,11,0.12)` | `#451A03` (alpha 0.6) | `rgba(245,158,11,0.18)` | `rgba(245,158,11,0.12)` | `rgba(245,158,11,0.12)` | ปุ่มและแท็กสถานะมาสาย |
| **ขาดเรียน (ABSENT) - ข้อความ** | `text-red-400` / `text-red-500` หรือ semantic alias | `#DC2626` / `#EF4444` | `#F87171` / `#EF4444` | `#FDA4AF` / `#FB7185` | `#DC2626` / `#EF4444` | `#DC2626` / `#EF4444` | สถานะขาดเรียน, ความเสี่ยงสูง, การแจ้งเตือนผิดพลาด |
| **ขาดเรียน (ABSENT) - พื้นหลัง** | `bg-red-950/60` หรือ semantic alias | `rgba(239,68,68,0.10)` | `#450A0A` (alpha 0.6) | `rgba(239,68,68,0.18)` | `rgba(239,68,68,0.10)` | `rgba(239,68,68,0.10)` | ปุ่มและแท็กสถานะขาดเรียน |
| **ลากิจ/ลาป่วย (LEAVE) - ข้อความ** | `text-blue-400` / `text-blue-500` หรือ semantic alias | `#2563EB` / `#3B82F6` | `#60A5FA` / `#3B82F6` | `#93C5FD` / `#60A5FA` | `#2563EB` / `#3B82F6` | `#6D5AE6` / `#7655E8` | สถานะลากิจ/ลาป่วย, บันทึกการลา |
| **ลากิจ/ลาป่วย (LEAVE) - พื้นหลัง** | `bg-blue-950/60` หรือ semantic alias | `rgba(59,130,246,0.10)` | `#172554` (alpha 0.6) | `rgba(59,130,246,0.20)` | `rgba(59,130,246,0.10)` | `rgba(118,85,232,0.12)` | ปุ่มและแท็กสถานะลากิจ/ลาป่วย |
| **ความเสี่ยงวิกฤต (Critical Alert)** | `text-rose-400` / `text-rose-500` หรือ semantic alias | `#E11D48` / `#F43F5E` | `#FB7185` / `#F43F5E` | `#FDA4AF` / `#FB7185` | `#BE185D` / `#E11D48` | `#C026D3` / `#D946EF` | แจ้งเตือนเวลาเรียนต่ำกว่า 60%, ความเสี่ยงเวลาเรียนไม่พอ |

## 5. บทบาทผู้ใช้งาน (User Roles Badges)

> สีบทบาทคงเอกลักษณ์ของแต่ละบทบาทไว้ข้ามธีม โดยปรับเฉดข้อความให้เหมาะกับพื้นหลัง และใช้พื้นหลังสีเดียวกันแบบโปร่งแสงประมาณ 10% (`/10`) ตามรูปแบบเดิม

| บทบาท (Role) | โทนสี | คลาส Tailwind | 1. Light | 2. Dark Obsidian / Deep Slate | 3. Blue | 4. Pink | 5. Purple |
|---|---|---|---|---|---|---|---|
| **SUPER_ADMIN** (ผู้ดูแลระบบ) | Rose | `text-rose-400 / bg-rose-500/10` | `#E11D48` | `#FB7185` | `#FDA4AF` | `#BE185D` | `#FDA4AF` |
| **EXECUTIVE** (ผู้บริหารสถานศึกษา) | Blue | `text-blue-400 / bg-blue-500/10` | `#2563EB` | `#60A5FA` | `#93C5FD` | `#2563EB` | `#6D5AE6` |
| **HEAD_OF_DEPARTMENT** (หัวหน้ากลุ่มสาระฯ) | Amber | `text-amber-400 / bg-amber-500/10` | `#B45309` | `#FBBF24` | `#FCD34D` | `#B45309` | `#B45309` |
| **ACADEMIC_HEAD** (หัวหน้ากลุ่มงานวิชาการฯ) | Orange | `text-orange-400 / bg-orange-500/10` | `#C2410C` | `#FB923C` | `#FDBA74` | `#C2410C` | `#C2410C` |
| **DEPUTY_DIRECTOR_ACADEMIC** (รอง ผอ. วิชาการ) | Violet | `text-violet-400 / bg-violet-500/10` | `#7C3AED` | `#A78BFA` | `#C4B5FD` | `#7C3AED` | `#8B5CF6` |
| **DIRECTOR** (ผู้อำนวยการสถานศึกษา) | Red | `text-red-400 / bg-red-500/10` | `#DC2626` | `#F87171` | `#FDA4AF` | `#DC2626` | `#DC2626` |
| **HOMEROOM_TEACHER** (ครูประจำชั้น) | Emerald | `text-emerald-400 / bg-emerald-500/10` | `#047857` | `#34D399` | `#6EE7B7` | `#047857` | `#047857` |
| **SUBJECT_TEACHER** (ครูประจำวิชา) | Indigo | `text-indigo-400 / bg-indigo-500/10` | `#4F46E5` | `#818CF8` | `#A5B4FC` | `#4F46E5` | `#6D5AE6` |
| **SUPERVISORY_TEACHER** (ครูนิเทศ) | Teal | `text-teal-400 / bg-teal-500/10` | `#0F766E` | `#2DD4BF` | `#5EEAD4` | `#0F766E` | `#0F766E` |
| **INFIRMARY_STAFF** (พยาบาลโรงเรียน) | Rose | `text-rose-400 / bg-rose-500/10` | `#E11D48` | `#FB7185` | `#FDA4AF` | `#BE185D` | `#FDA4AF` |
| **GUIDANCE_COUNSELOR** (ครูแนะแนว) | Purple | `text-purple-400 / bg-purple-500/10` | `#9333EA` | `#C084FC` | `#D8B4FE` | `#9333EA` | `#A855F7` |
| **FINANCE_STAFF** (เจ้าหน้าที่การเงิน) | Emerald | `text-emerald-400 / bg-emerald-500/10` | `#047857` | `#34D399` | `#6EE7B7` | `#047857` | `#047857` |
| **PARENT** (ผู้ปกครอง) | Amber | `text-amber-400 / bg-amber-500/10` | `#B45309` | `#FBBF24` | `#FCD34D` | `#B45309` | `#B45309` |
| **STUDENT** (นักเรียน) | Sky | `text-sky-400 / bg-sky-500/10` | `#0284C7` | `#38BDF8` | `#7DD3FC` | `#0284C7` | `#0284C7` |

### แนวทางพื้นหลัง Badge ของบทบาท

ไฟล์ต้นฉบับระบุรูปแบบ `bg-<role-color>-500/10` แต่ไม่ได้แจกแจงค่า HEX ที่ผ่านการ flatten สำหรับแต่ละพื้นหลัง เนื่องจากเป็นสีโปร่งแสงที่ผสมกับพื้นผิวด้านหลัง ให้สร้างด้วย CSS alpha แทนการกำหนด HEX ทึบ เช่น:

```css
.role-badge {
  color: var(--role-color);
  background: color-mix(in srgb, var(--role-color) 10%, transparent);
}
```

## 6. แบรนด์และบริการภายนอก (Brand & External Services)

> สีแบรนด์ภายนอกควรคงสีตามข้อกำหนดของแบรนด์ ไม่ควรปรับตามธีมโดยอัตโนมัติ เว้นแต่แนวทางแบรนด์อนุญาต

| บริการ / องค์ประกอบ | คลาส Tailwind / สไตล์ | 1. Light | 2. Dark Obsidian / Deep Slate | 3. Blue | 4. Pink | 5. Purple |
|---|---|---|---|---|---|---|
| **System Brand Accent (Gradient Start)** | `indigo-500` / theme alias | `#6366F1` | `#6366F1` | `#60A5FA` | `#C43D70` | `#8B5CF6` |
| **System Brand Accent (Gradient End)** | `blue-600` / theme alias | `#2563EB` | `#2563EB` | `#1D4ED8` | `#9D174D` | `#6D28D9` |
| **LINE Official Account** | `bg-[#00B900] / hover:bg-[#00A000]` | `#00B900` / `#00A000` | `#00B900` / `#00A000` | `#00B900` / `#00A000` | `#00B900` / `#00A000` | `#00B900` / `#00A000` |
| **Google Workspace** | `bg-white / text-slate-900` | `#FFFFFF` / `#0F172A` | `#FFFFFF` / `#0F172A` | `#FFFFFF` / `#0F172A` | `#FFFFFF` / `#0F172A` | `#FFFFFF` / `#0F172A` |

---

## 7. ข้อเสนอการตั้งชื่อ CSS Variables

เพื่อไม่ให้ชื่อเดิม `--color-dark-bg` สื่อว่าทุกธีมเป็นธีมมืด แนะนำให้ใช้ตัวแปร semantic ที่เปลี่ยนค่าตามธีม โดยคงชื่อสีเดิมไว้เป็น compatibility alias ชั่วคราว

```css
:root,
[data-theme="light"] {
  --color-bg: #F4F6F9;
  --color-bg-secondary: #E9EEF5;
  --color-surface: #FFFFFF;
  --color-surface-inset: #F8FAFC;
  --color-subbar: #F1F5F9;
  --color-control: #E2E8F0;
  --color-elevated: #FFFFFF;
  --color-text: #1E293B;
  --color-text-secondary: #334155;
  --color-text-muted: #64748B;
  --color-text-disabled: #94A3B8;
  --color-border: #E2E8F0;
  --color-border-interactive: #CBD5E1;
  --color-accent: #2563EB;
  --color-accent-gradient-start: #6366F1;
  --color-accent-gradient-end: #2563EB;
}

[data-theme="dark"] {
  --color-bg: #0B0D14;
  --color-bg-secondary: #0F172A;
  --color-surface: #151921;
  --color-surface-inset: #0B0F19;
  --color-subbar: #141926;
  --color-control: #1C1F2B;
  --color-elevated: #1E293B;
  --color-text: #FFFFFF;
  --color-text-secondary: #F1F5F9;
  --color-text-muted: #94A3B8;
  --color-text-disabled: #64748B;
  --color-border: rgba(255,255,255,0.10);
  --color-border-interactive: #334155;
  --color-accent: #3B82F6;
  --color-accent-gradient-start: #6366F1;
  --color-accent-gradient-end: #2563EB;
}

[data-theme="blue"] {
  --color-bg: #071426;
  --color-bg-secondary: #0B1D36;
  --color-surface: #10243D;
  --color-surface-inset: #0B1A2E;
  --color-subbar: #132A45;
  --color-control: #1A3452;
  --color-elevated: #193552;
  --color-text: #F1F7FF;
  --color-text-secondary: #D8E8FA;
  --color-text-muted: #9DB6D5;
  --color-text-disabled: #6F8EAF;
  --color-border: rgba(219,234,254,0.12);
  --color-border-interactive: #355A80;
  --color-accent: #3B82F6;
  --color-accent-gradient-start: #60A5FA;
  --color-accent-gradient-end: #1D4ED8;
}

[data-theme="pink"] {
  --color-bg: #FFF5F7;
  --color-bg-secondary: #FCE8EF;
  --color-surface: #FFFFFF;
  --color-surface-inset: #FFF9FB;
  --color-subbar: #FBEAF0;
  --color-control: #F5DCE6;
  --color-elevated: #FFFFFF;
  --color-text: #542238;
  --color-text-secondary: #71324D;
  --color-text-muted: #A66B80;
  --color-text-disabled: #C08CA0;
  --color-border: #F0C9D8;
  --color-border-interactive: #D99AB5;
  --color-accent: #C43D70;
  --color-accent-gradient-start: #C43D70;
  --color-accent-gradient-end: #9D174D;
}

[data-theme="purple"] {
  --color-bg: #F7F5FF;
  --color-bg-secondary: #EEE9FF;
  --color-surface: #FFFFFF;
  --color-surface-inset: #FBFAFF;
  --color-subbar: #F0ECFF;
  --color-control: #E4DCFF;
  --color-elevated: #FFFFFF;
  --color-text: #30245A;
  --color-text-secondary: #493777;
  --color-text-muted: #8176A8;
  --color-text-disabled: #A69BC8;
  --color-border: #DCD3F5;
  --color-border-interactive: #B6A7E8;
  --color-accent: #7655E8;
  --color-accent-gradient-start: #8B5CF6;
  --color-accent-gradient-end: #6D28D9;
}

/* Compatibility alias: remove after migrating existing usages. */
:root {
  --color-dark-bg: var(--color-bg);
}
```

## 8. ข้อควรระวังก่อนนำไปใช้

1. ค่าในคอลัมน์ **2. Dark Obsidian / Deep Slate** ถอดจากไฟล์ต้นฉบับตามรายการที่ระบุ ส่วนค่าธีม 1, 3, 4, 5 เป็นค่าที่เสนอเพิ่ม
2. คลาส Tailwind ที่มีชื่อคงที่ เช่น `bg-slate-900`, `text-white` จะไม่เปลี่ยนสีเองตามธีม หากต้องการสลับธีมจริง ให้เปลี่ยนเป็น CSS variables, semantic utility classes หรือใช้ค่าที่กำหนดผ่าน `@theme` อย่างเป็นระบบ
3. สีสถานะการเข้าเรียน สีบทบาท และสีแบรนด์ภายนอกเป็นคนละหน้าที่กับสีพื้นผิวหลัก จึงไม่ควรเปลี่ยนทุกสีให้เป็นสีประจำธีมเดียวกันจนความหมายของสถานะหายไป
4. สีพื้นหลังสถานะที่ระบุเป็น alpha ต้องใช้ RGBA/opacity จริง ไม่ควรนำ HEX ของสีต้นทางไปใช้เป็นสีทึบโดยตรง
5. ก่อน release ควรตรวจสอบ contrast ของข้อความขนาดปกติและข้อความสำคัญในทุกธีม รวมถึง hover, focus, disabled, selected และ error states
