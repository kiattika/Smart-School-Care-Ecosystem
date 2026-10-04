import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Pin, PinOff, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  SIDEBAR_CLOSE_DELAY_MS,
  SIDEBAR_OPEN_DELAY_MS,
  readSidebarPinned,
  sidebarMode,
  writeSidebarPinned,
} from './portalSidebarLogic';

export interface PortalNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** ตัวเลข/ข้อความแจ้งเตือนต่อท้ายเมนู — null/undefined/0 = ไม่แสดง */
  badge?: number | string | null;
}

interface PortalSidebarLayoutProps {
  /** เมนูที่มองเห็นแล้ว (กรองตามบทบาทด้วย visibleSidebarItems() ก่อนส่งเข้ามา) */
  items: PortalNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  children: React.ReactNode;
  /** หัวข้อของเมนู (aria-label ของ nav + หัวลิ้นชักบนมือถือ) */
  title?: string;
  className?: string;
}

/** localStorage อาจ throw แค่ตอนเข้าถึง (private mode / ถูกบล็อก) */
function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

const hasBadge = (b: PortalNavItem['badge']) => b !== null && b !== undefined && b !== 0 && b !== '';

/**
 * แถบเมนูด้านซ้ายแบบเดียวกันทุก portal ของบุคลากร
 * - จอ lg ขึ้นไป: แถบไอคอนแคบ (w-16) ขยายเป็น w-64 เมื่อ hover (มี delay) หรือ focus ด้วยคีย์บอร์ด
 *   ตอนขยายลอยทับเนื้อหา (ไม่ดัน layout); ปักหมุดให้เปิดค้าง (เก็บใน localStorage) → ดันเนื้อหา
 * - จอเล็กกว่า lg: ปุ่ม "เมนู" เปิดลิ้นชักจากซ้าย แตะนอกเมนู / เลือกเมนู / Esc แล้วปิด
 * - aria-current="page" ที่เมนูปัจจุบัน, title ตอนแถบแคบ
 */
export function PortalSidebarLayout({ items, activeId, onSelect, children, title = 'เมนู', className }: PortalSidebarLayoutProps) {
  const [pinned, setPinned] = useState<boolean>(() => readSidebarPinned(safeStorage()));
  const [expanded, setExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);

  const mode = sidebarMode(pinned, expanded);
  const wide = mode !== 'collapsed';
  const activeItem = items.find((i) => i.id === activeId);

  const clearTimers = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  useEffect(() => clearTimers, []);

  const scheduleExpand = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    if (expanded || openTimer.current) return;
    openTimer.current = setTimeout(() => { openTimer.current = null; setExpanded(true); }, SIDEBAR_OPEN_DELAY_MS);
  };
  const scheduleCollapse = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    if (closeTimer.current) return;
    closeTimer.current = setTimeout(() => { closeTimer.current = null; setExpanded(false); }, SIDEBAR_CLOSE_DELAY_MS);
  };

  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    writeSidebarPinned(safeStorage(), next);
    if (!next) setExpanded(false);
  };

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    drawerTriggerRef.current?.focus();
  }, []);

  // ลิ้นชักมือถือ: โฟกัสเมนูปัจจุบันตอนเปิด, Esc ปิด
  useEffect(() => {
    if (!drawerOpen) return;
    const current = drawerRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]')
      ?? drawerRef.current?.querySelector<HTMLButtonElement>('button[data-nav-item]');
    current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  const renderItems = (showLabels: boolean, afterSelect?: () => void) => (
    <ul className="space-y-1" role="list">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activeId;
        return (
          <li key={item.id}>
            <button
              type="button"
              data-nav-item=""
              onClick={() => { onSelect(item.id); afterSelect?.(); }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={showLabels ? undefined : item.label}
              title={showLabels ? undefined : item.label}
              className={cn(
                'relative w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-colors outline-none',
                'focus-visible:ring-2 focus-visible:ring-indigo-400',
                showLabels ? 'px-3 py-2.5' : 'justify-center px-0 py-2.5',
                isActive
                  ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-indigo-300' : '')} />
              {showLabels && <span className="flex-1 text-left truncate">{item.label}</span>}
              {showLabels && hasBadge(item.badge) && (
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">{item.badge}</span>
              )}
              {!showLabels && hasBadge(item.badge) && (
                <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#0a0f16]" aria-hidden="true" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={cn('flex gap-4 lg:gap-6 w-full', className)}>
      {/* ── จอ lg+: แถบด้านซ้าย — คอลัมน์ placeholder กว้างตามโหมด (pinned ดันเนื้อหา, overlay ไม่ดัน) ── */}
      <div className={cn('hidden lg:block shrink-0 transition-[width] duration-200', mode === 'pinned' ? 'w-64' : 'w-16')}>
        <nav
          ref={navRef}
          aria-label={title}
          onMouseEnter={() => { if (!pinned) scheduleExpand(); }}
          onMouseLeave={() => { if (!pinned) scheduleCollapse(); }}
          onFocus={() => { if (!pinned) { clearTimers(); setExpanded(true); } }}
          onBlur={(e) => {
            if (pinned) return;
            if (!navRef.current?.contains(e.relatedTarget as Node | null)) { clearTimers(); setExpanded(false); }
          }}
          onKeyDown={(e) => { if (e.key === 'Escape' && !pinned) { clearTimers(); setExpanded(false); } }}
          className={cn(
            'sticky top-4 z-30 rounded-2xl border border-white/10 bg-[#0a0f16] p-2 transition-[width,box-shadow] duration-200',
            wide ? 'w-64' : 'w-16',
            mode === 'overlay' && 'shadow-2xl shadow-black/60'
          )}
        >
          <div className={cn('flex items-center mb-2 h-8', wide ? 'justify-between px-1' : 'justify-center')}>
            {wide && <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{title}</span>}
            <button
              type="button"
              onClick={togglePinned}
              aria-pressed={pinned}
              title={pinned ? 'เลิกปักหมุดเมนู' : 'ปักหมุดให้เมนูเปิดค้าง'}
              aria-label={pinned ? 'เลิกปักหมุดเมนู' : 'ปักหมุดให้เมนูเปิดค้าง'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
          </div>
          {renderItems(wide)}
        </nav>
      </div>

      {/* ── เนื้อหา ── */}
      <div className="flex-1 min-w-0">
        {/* จอเล็กกว่า lg: ปุ่มเปิดลิ้นชัก */}
        <button
          ref={drawerTriggerRef}
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          className="lg:hidden mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-[#0a0f16] text-sm text-slate-200 hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Menu className="w-4 h-4" />
          <span>เมนู{activeItem ? `: ${activeItem.label}` : ''}</span>
        </button>
        {children}
      </div>

      {/* ── จอเล็กกว่า lg: ลิ้นชักจากซ้าย ── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDrawer} aria-hidden="true" />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#0a0f16] border-r border-white/10 shadow-2xl flex flex-col">
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
              <span className="text-sm font-bold text-white truncate">{title}</span>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="ปิดเมนู"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{renderItems(true, closeDrawer)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
