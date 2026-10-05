import React from 'react';
import { CalendarDays, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export interface TermIndicatorBadgeProps {
  /** พ.ศ. เช่น "2569" */
  academicYear: string;
  term: '1' | '2';
  /** true = มาจาก school_settings/academic_year จริง */
  isConfigured: boolean;
  /** ยังโหลดไม่เสร็จ — ไม่แสดงอะไร (กันป้ายเตือนวาบขึ้นก่อนอ่านค่าจริงได้) */
  loading?: boolean;
  className?: string;
}

/**
 * ป้ายภาคเรียนปัจจุบันบนแถบบนสุด (ส่วนแสดงผลล้วน — ไม่แตะ Firestore; ดู TermIndicator.tsx)
 * - ตั้งค่าแล้ว: "ภาคเรียนที่ 2/2569"
 * - ยังไม่ตั้งค่า: ป้ายเตือน "ยังไม่ได้ตั้งค่าภาคเรียน" — ไม่แสดงปี/ภาคที่เดาจากวันที่ เพราะอาจทำให้เข้าใจผิดว่าตั้งไว้แล้ว
 */
export const TermIndicatorBadge: React.FC<TermIndicatorBadgeProps> = ({
  academicYear, term, isConfigured, loading = false, className,
}) => {
  if (loading) return null;

  if (!isConfigured) {
    return (
      <div
        role="status"
        data-testid="term-indicator-warning"
        title="ยังไม่ได้ตั้งค่าปีการศึกษา/ภาคเรียน — ผู้ดูแลระบบตั้งค่าได้ที่หน้า ปีการศึกษา & ล็อกระบบ"
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border shadow-sm',
          'bg-amber-500/15 text-amber-300 border-amber-500/40',
          className,
        )}
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="whitespace-nowrap">ยังไม่ได้ตั้งค่าภาคเรียน</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      data-testid="term-indicator"
      title={`ปีการศึกษา ${academicYear} ภาคเรียนที่ ${term}`}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border shadow-sm',
        'bg-indigo-500/10 text-indigo-200 border-indigo-500/30',
        className,
      )}
    >
      <CalendarDays className="w-3.5 h-3.5 shrink-0 text-indigo-300" aria-hidden="true" />
      <span className="whitespace-nowrap">ภาคเรียนที่ {term}/{academicYear}</span>
    </div>
  );
};
