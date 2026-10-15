import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, Loader2, Lock, RotateCcw, Save, Undo2 } from 'lucide-react';
import { useStore } from '../../store';
import {
  DEFAULT_TOKENS, THEME_DOC_NAME, THEME_IDS, THEME_MODE, TOKEN_DEFS, TOKEN_GROUP_LABEL,
  contrastRatio, installThemeTokens, isColorValue, normalizeOverrides, parseColor, resolveTokens, sameColor,
  type ThemeId, type ThemeOverrides, type TokenDef, type TokenGroup,
} from '../../lib/themeTokens';
import { applyPreferences, loadLocalPreferences } from '../../lib/userPreferences';
import { saveThemeTokens, subscribeThemeTokens } from '../../services/themeTokensService';
import { ROLE_VISUALS } from '../NavbarWithRoleSwitcher';

const GROUPS: TokenGroup[] = ['surface', 'border', 'text', 'status', 'role', 'brand', 'shell'];
/** โทเคนข้อความที่ควรตรวจ contrast กับพื้นการ์ดของธีม */
const CONTRAST_GROUPS = new Set<TokenGroup>(['text', 'status', 'role']);
const SAMPLE_ROLES = ['SUPER_ADMIN', 'EXECUTIVE', 'HOMEROOM_TEACHER', 'SUBJECT_TEACHER', 'GUIDANCE_COUNSELOR', 'STUDENT'];

const toHex6 = (v: string): string => {
  const c = parseColor(v);
  if (!c) return '#000000';
  return '#' + [c.r, c.g, c.b].map(n => n.toString(16).padStart(2, '0')).join('');
};
/** เลือกสีจาก color picker แล้วคงความโปร่งเดิม (rgba / #rrggbbaa) */
const withPickedColor = (prev: string, hex: string): string => {
  const c = parseColor(prev);
  if (!c || c.a >= 1) return hex.toUpperCase();
  const p = parseColor(hex)!;
  return `rgba(${p.r},${p.g},${p.b},${Math.round(c.a * 100) / 100})`;
};

/**
 * แอดมิน: ปรับโทเคนสีของธีมทั้ง 5 (ตามเอกสารตารางปรับเทียบสีธีม) — แก้ทีละค่า พรีวิวทั้งหน้าระหว่างแก้
 * บันทึก = ใช้กับผู้ใช้ทุกคน; รีเซ็ต = กลับค่าตามเอกสาร (ต้องกดบันทึกจึงมีผลกับทุกคน)
 */
export function ThemeTokensPage() {
  const uid = useStore(s => s.user?.uid);
  const [saved, setSaved] = useState<ThemeOverrides>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<ThemeOverrides>({});
  const [dirty, setDirty] = useState(false);
  const [theme, setTheme] = useState<ThemeId>('light');
  const [preview, setPreview] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const savedRef = useRef<ThemeOverrides>({});
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  useEffect(() => subscribeThemeTokens(o => {
    savedRef.current = o;
    setSaved(o);
    setLoaded(true);
    setLoadError('');
    setDraft(d => (dirtyRef.current ? d : o));
  }, e => { setLoaded(true); setLoadError(e.message); }), []);

  // พรีวิว: ใช้ค่าร่างกับทั้งหน้า และสลับไปธีมที่กำลังแก้; ปิดพรีวิว/ออกจากหน้า = กลับค่าที่บันทึกไว้ + ธีมส่วนตัวของผู้ใช้
  useEffect(() => {
    const root = document.documentElement;
    if (preview) {
      installThemeTokens(draft);
      root.setAttribute('data-theme', THEME_MODE[theme]);
      root.setAttribute('data-palette', theme);
    } else {
      installThemeTokens(savedRef.current);
      applyPreferences(loadLocalPreferences());
    }
  }, [preview, draft, theme, saved]);
  useEffect(() => () => { installThemeTokens(savedRef.current); applyPreferences(loadLocalPreferences()); }, []);

  const raw = draft[theme] ?? {};
  const tokens = useMemo(() => resolveTokens(normalizeOverrides(draft), theme), [draft, theme]);
  const invalid = useMemo(() => THEME_IDS.flatMap(t => Object.entries(draft[t] ?? {}).filter(([, v]) => !isColorValue(v)).map(([k]) => `${THEME_DOC_NAME[t]}: ${k}`)), [draft]);
  const changedCount = (t: ThemeId) => Object.keys(normalizeOverrides(draft)[t] ?? {}).length;

  const setToken = (key: string, value: string) => {
    setDone(''); setError(''); setDirty(true);
    setDraft(d => {
      const cur = { ...(d[theme] ?? {}) };
      if (sameColor(value, DEFAULT_TOKENS[theme][key])) delete cur[key]; else cur[key] = value;
      const next = { ...d, [theme]: cur };
      if (!Object.keys(cur).length) delete next[theme];
      return next;
    });
  };
  const resetTheme = () => { setDirty(true); setDone(''); setDraft(d => { const n = { ...d }; delete n[theme]; return n; }); };
  const resetAll = () => { setDirty(true); setDone(''); setDraft({}); setConfirmAll(false); };
  const discard = () => { setDraft(saved); setDirty(false); setError(''); setDone(''); };

  const save = async () => {
    if (!uid) { setError('ไม่พบผู้ใช้ที่ล็อกอิน — บันทึกไม่ได้'); return; }
    if (invalid.length) { setError('มีค่าสีที่รูปแบบไม่ถูกต้อง: ' + invalid.join(', ')); return; }
    setBusy(true); setError(''); setDone('');
    try {
      await saveThemeTokens(draft, uid);
      setDirty(false);
      setDone('บันทึกแล้ว — ผู้ใช้ทุกคนจะเห็นสีใหม่ทันที (หน้า Login ใช้ค่าใหม่หลังผู้ใช้ล็อกอินบนเครื่องนั้นครั้งถัดไป)');
    } catch (e) {
      setError('บันทึกไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  };

  const surface = tokens.surface;
  const ratioBadge = (def: TokenDef, value: string) => {
    if (!CONTRAST_GROUPS.has(def.group) || def.key === 'accent' || !isColorValue(value) || (parseColor(value)?.a ?? 1) < 1) return null;
    const r = contrastRatio(value, surface);
    const cls = r >= 4.5 ? 'text-emerald-400 border-emerald-500/30' : r >= 3 ? 'text-amber-400 border-amber-500/30' : 'text-red-400 border-red-500/30';
    return <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}`} title="อัตราส่วน contrast กับพื้นการ์ดของธีมนี้ (ข้อความทั่วไปควร ≥ 4.5:1)">{r.toFixed(1)}:1</span>;
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#151921] border border-white/10 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">ธีมสี (Theme Color Tokens)</h2>
            <p className="text-sm text-slate-400 mt-1">ค่าเริ่มต้นตามเอกสาร "ตารางปรับเทียบสีธีม" — ธีม 2 คือค่าต้นฉบับของระบบ ธีม 1, 3, 4, 5 เป็นค่าที่เสนอเพิ่ม แก้แล้วกด "บันทึก" เพื่อใช้กับผู้ใช้ทุกคน; รีเซ็ตกลับเป็นค่าตามเอกสารได้ทุกเมื่อ</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer shrink-0">
            <input type="checkbox" checked={preview} onChange={e => setPreview(e.target.checked)} className="w-4 h-4 accent-indigo-600" />
            <Eye className="w-4 h-4" /> พรีวิวทั้งหน้าระหว่างแก้
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="ธีม">
          {THEME_IDS.map(t => {
            const d = resolveTokens(normalizeOverrides(draft), t);
            const n = changedCount(t);
            return (
              <button key={t} type="button" role="tab" aria-selected={theme === t} onClick={() => setTheme(t)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border cursor-pointer ${theme === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500'}`}>
                <span className="inline-flex rounded-full overflow-hidden border border-black/20 shrink-0" aria-hidden="true">
                  <span className="w-3 h-4" style={{ backgroundColor: d.bg }} /><span className="w-3 h-4" style={{ backgroundColor: d.surface }} /><span className="w-3 h-4" style={{ backgroundColor: d.accent }} />
                </span>
                {THEME_DOC_NAME[t]}
                {n > 0 && <span className="text-[10px] font-bold px-1.5 rounded-full bg-amber-500 text-white">แก้ {n}</span>}
              </button>
            );
          })}
        </div>
        {!loaded && <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดค่าที่บันทึกไว้…</div>}
        {loadError && <div className="text-sm text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> โหลดค่าที่บันทึกไว้ไม่สำเร็จ: {loadError}</div>}
      </div>

      {/* ตัวอย่างองค์ประกอบจริง (ใช้ class เดียวกับหน้าระบบ) */}
      <div className="bg-[#0b0d14] border border-white/10 rounded-2xl p-4 space-y-3" aria-label="ตัวอย่าง">
        <div className="text-xs font-semibold text-slate-400">ตัวอย่าง (เปิดพรีวิวเพื่อเห็นธีมที่กำลังแก้)</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-[#151921] border border-white/10 rounded-xl p-4 space-y-2">
            <div className="text-white font-bold">การ์ดเนื้อหาหลัก</div>
            <div className="text-slate-200 text-sm">ข้อความเนื้อหาทั่วไป</div>
            <div className="text-slate-400 text-xs">คำอธิบายกำกับ · คาบ 3 · 15 ต.ค. 2569</div>
            <div className="text-slate-500 text-xs">ข้อความแนะนำ/ตัวเลือกที่ยังไม่ถูกเลือก</div>
            <div className="bg-[#0b0f19] border border-slate-800/80 rounded-lg p-2 text-xs text-slate-300">บล็อกย่อยภายในการ์ด (inset)</div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="px-3 py-1.5 rounded-lg text-xs bg-indigo-600 text-white">ปุ่มหลัก</button>
              <button type="button" className="px-3 py-1.5 rounded-lg text-xs bg-[#1c1f2b] border border-slate-700 text-slate-200">ชิปปุ่มกด</button>
              <span className="px-3 py-1.5 rounded-lg text-xs text-white bg-gradient-to-r from-indigo-500 to-blue-600">แบรนด์</span>
            </div>
          </div>
          <div className="bg-[#141926] border border-white/10 rounded-xl p-4 space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2 py-1 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-500/20">มาเรียน</span>
              <span className="px-2 py-1 rounded-md bg-amber-950/60 text-amber-400 border border-amber-500/20">มาสาย</span>
              <span className="px-2 py-1 rounded-md bg-red-950/60 text-red-400 border border-red-500/20">ขาดเรียน</span>
              <span className="px-2 py-1 rounded-md bg-blue-950/60 text-blue-400 border border-blue-500/20">ลา</span>
              <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">เวลาเรียน &lt; 60%</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {SAMPLE_ROLES.map(r => {
                const v = ROLE_VISUALS[r];
                return <span key={r} className={`px-2 py-1 rounded-md border ${v.badgeBg} ${v.badgeText} ${v.badgeBorder}`}>{v.label}</span>;
              })}
            </div>
            <div className="bg-slate-800 rounded-lg p-2 text-xs text-slate-300 border border-slate-700">กล่องสถิติ / เมนู Dropdown (elevated)</div>
          </div>
        </div>
      </div>

      {GROUPS.map(g => (
        <section key={g} className="bg-[#151921] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">{TOKEN_GROUP_LABEL[g]}</h3>
          {g === 'brand' && <p className="text-xs text-slate-400">สีแบรนด์ภายนอก (LINE, Google) คงตามข้อกำหนดแบรนด์ — แสดงอย่างเดียว ไม่ปรับตามธีม</p>}
          {g === 'shell' && <p className="text-xs text-slate-400">ส่วนนี้ไม่มีในเอกสาร — เพิ่มไว้เพราะระบบมีแถบบน/แถบเมนูข้างที่ต้องกำหนดสี</p>}
          <ul className="divide-y divide-slate-800" role="list">
            {TOKEN_DEFS.filter(d => d.group === g).map(def => {
              const value = def.locked ? DEFAULT_TOKENS[theme][def.key] : (raw[def.key] ?? DEFAULT_TOKENS[theme][def.key]);
              const def0 = DEFAULT_TOKENS[theme][def.key];
              const ok = isColorValue(value);
              const changed = !def.locked && ok && !sameColor(value, def0);
              return (
                <li key={def.key} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-100 font-medium flex flex-wrap items-center gap-2">
                      {def.name}
                      {changed && <span className="text-[10px] font-bold px-1.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">แก้แล้ว</span>}
                      {def.locked && <Lock className="w-3.5 h-3.5 text-slate-500" aria-label="ล็อก" />}
                    </div>
                    <div className="text-xs text-slate-400">{def.desc}</div>
                    <div className="text-[11px] text-slate-500 font-mono break-all">{def.cls}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <input type="color" aria-label={`เลือกสี ${def.name}`} disabled={def.locked} value={toHex6(ok ? value : def0)}
                      onChange={e => setToken(def.key, withPickedColor(value, e.target.value))}
                      className="w-10 h-9 rounded-md border border-slate-700 bg-transparent cursor-pointer disabled:cursor-not-allowed shrink-0" />
                    <input type="text" aria-label={`ค่าสี ${def.name}`} disabled={def.locked} value={value} spellCheck={false}
                      onChange={e => setToken(def.key, e.target.value.trim())}
                      className={`w-44 px-2 py-1.5 rounded-md text-xs font-mono bg-slate-950 text-slate-100 border ${ok ? 'border-slate-700' : 'border-red-500'} disabled:opacity-60`} />
                    {ratioBadge(def, value)}
                    {!def.locked && (
                      <button type="button" disabled={!changed && ok} onClick={() => setToken(def.key, def0)} title={`กลับค่าตามเอกสาร (${def0})`}
                        className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" aria-label={`กลับค่าตามเอกสาร ${def.name}`}>
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {!ok && <div className="text-xs text-red-400 sm:basis-full">รูปแบบไม่ถูกต้อง — ใช้ #RRGGBB หรือ rgba(r,g,b,a)</div>}
                  {changed && <div className="text-[11px] text-slate-500 sm:hidden">ค่าตามเอกสาร: {def0}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="sticky bottom-0 z-10 bg-[#141926]/95 backdrop-blur border border-white/10 rounded-2xl p-3 sm:p-4 flex flex-col gap-2">
        {error && <div className="text-sm text-red-400 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</div>}
        {done && <div className="text-sm text-emerald-400 flex items-start gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {done}</div>}
        {dirty && !done && <div className="text-xs text-amber-400">มีการแก้ไขที่ยังไม่บันทึก (รวมการรีเซ็ต) — ผู้ใช้คนอื่นยังเห็นค่าเดิมจนกว่าจะกดบันทึก</div>}
        <div className="flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={resetTheme} disabled={changedCount(theme) === 0 && !draft[theme]}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-slate-700 text-slate-200 hover:bg-white/5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
            <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ตธีมนี้เป็นค่าตามเอกสาร
          </button>
          {confirmAll ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-xs text-amber-400">รีเซ็ตทั้ง 5 ธีม?</span>
              <button type="button" onClick={resetAll} className="px-3 py-2 rounded-lg text-xs bg-red-600 text-white cursor-pointer">ยืนยันรีเซ็ตทั้งหมด</button>
              <button type="button" onClick={() => setConfirmAll(false)} className="px-3 py-2 rounded-lg text-xs border border-slate-700 text-slate-200 cursor-pointer">ไม่</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmAll(true)} disabled={!Object.keys(draft).length}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-slate-700 text-slate-200 hover:bg-white/5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ตทุกธีม
            </button>
          )}
          <button type="button" onClick={discard} disabled={!dirty}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-slate-700 text-slate-200 hover:bg-white/5 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
            <Undo2 className="w-3.5 h-3.5" /> ยกเลิกการแก้ไข
          </button>
          <button type="button" onClick={() => void save()} disabled={busy || !dirty || invalid.length > 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-indigo-600 text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} บันทึกและใช้กับทุกคน
          </button>
        </div>
      </div>
    </div>
  );
}
