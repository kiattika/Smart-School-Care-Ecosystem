/** โทนสีสำหรับจัดกลุ่มรายการ (เช่น กลุ่มสาระฯ) — class เขียนเต็มเพื่อให้ Tailwind สแกนเจอ */
export const GROUP_TONES = [
  { row: 'border-l-4 border-l-sky-400 bg-sky-500/10', chip: 'bg-sky-500/20 text-sky-200 border-sky-400/40' },
  { row: 'border-l-4 border-l-emerald-400 bg-emerald-500/10', chip: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
  { row: 'border-l-4 border-l-violet-400 bg-violet-500/10', chip: 'bg-violet-500/20 text-violet-200 border-violet-400/40' },
  { row: 'border-l-4 border-l-amber-400 bg-amber-500/10', chip: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
  { row: 'border-l-4 border-l-rose-400 bg-rose-500/10', chip: 'bg-rose-500/20 text-rose-200 border-rose-400/40' },
  { row: 'border-l-4 border-l-teal-400 bg-teal-500/10', chip: 'bg-teal-500/20 text-teal-200 border-teal-400/40' },
  { row: 'border-l-4 border-l-fuchsia-400 bg-fuchsia-500/10', chip: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/40' },
  { row: 'border-l-4 border-l-lime-400 bg-lime-500/10', chip: 'bg-lime-500/20 text-lime-200 border-lime-400/40' },
];
export const NEUTRAL_TONE = { row: 'border-l-4 border-l-slate-600 bg-slate-900/40', chip: 'bg-slate-800 text-slate-300 border-slate-600' };

/** จัดกลุ่มตาม key (เรียงตามชื่อกลุ่ม ไทย) แล้วเรียงในกลุ่มด้วย sortWithin; สีตามลำดับกลุ่ม — กลุ่มเดียวกันสีเดียวกันและอยู่ติดกัน */
export function groupWithTones<T>(
  items: readonly T[], keyOf: (t: T) => string, labelOf: (key: string) => string, sortWithin: (a: T, b: T) => number,
): { key: string; label: string; tone: typeof NEUTRAL_TONE; items: T[] }[] {
  const keys = [...new Set(items.map(keyOf))].sort((a, b) => (a === '' ? 1 : 0) - (b === '' ? 1 : 0) || labelOf(a).localeCompare(labelOf(b), 'th'));
  return keys.map((key, i) => ({
    key, label: key ? labelOf(key) : 'ไม่ระบุกลุ่มสาระฯ',
    tone: key ? GROUP_TONES[i % GROUP_TONES.length] : NEUTRAL_TONE,
    items: items.filter(t => keyOf(t) === key).sort(sortWithin),
  }));
}
