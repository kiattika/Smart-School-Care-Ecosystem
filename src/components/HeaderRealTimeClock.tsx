import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, Zap, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderRealTimeClockProps {
  showPeriodBadge?: boolean;
  className?: string;
  onPeriodChange?: (periodName: string) => void;
}

interface PeriodDefinition {
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  isLunch?: boolean;
  isHomeroom?: boolean;
}

// School timetable periods definition (08:00 - 16:00)
const SCHOOL_PERIODS: PeriodDefinition[] = [
  { name: 'กิจกรรมหน้าเสาธง & โฮมรูม', startHour: 8, startMinute: 0, endHour: 8, endMinute: 30, isHomeroom: true },
  { name: 'คาบ 1', startHour: 8, startMinute: 30, endHour: 9, endMinute: 20 },
  { name: 'คาบ 2', startHour: 9, startMinute: 20, endHour: 10, endMinute: 10 },
  { name: 'คาบ 3', startHour: 10, startMinute: 10, endHour: 11, endMinute: 0 },
  { name: 'คาบ 4', startHour: 11, startMinute: 0, endHour: 11, endMinute: 50 },
  { name: 'พักกลางวัน', startHour: 11, startMinute: 50, endHour: 12, endMinute: 40, isLunch: true },
  { name: 'คาบ 5', startHour: 12, startMinute: 40, endHour: 13, endMinute: 30 },
  { name: 'คาบ 6', startHour: 13, startMinute: 30, endHour: 14, endMinute: 20 },
  { name: 'คาบ 7', startHour: 14, startMinute: 20, endHour: 15, endMinute: 10 },
  { name: 'คาบ 8 (กิจกรรม/แนะแนว)', startHour: 15, startMinute: 10, endHour: 16, endMinute: 0 },
];

export const HeaderRealTimeClock: React.FC<HeaderRealTimeClockProps> = ({
  showPeriodBadge = true,
  className,
  onPeriodChange
}) => {
  // Live real-time state with 1-second interval
  const [time, setTime] = useState<Date>(() => new Date());

  useEffect(() => {
    // Tick every 1000ms
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Clean up on component unmount
    return () => clearInterval(timer);
  }, []);

  // Format 24-hour time (HH:mm:ss)
  const timeString = useMemo(() => {
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = String(time.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }, [time]);

  // Format Thai Buddhist Date
  const dateString = useMemo(() => {
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const day = time.getDate();
    const month = months[time.getMonth()];
    const year = time.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  }, [time]);

  // Determine current active period
  const activePeriod = useMemo(() => {
    const nowMinutes = time.getHours() * 60 + time.getMinutes();

    for (const p of SCHOOL_PERIODS) {
      const startMinutes = p.startHour * 60 + p.startMinute;
      const endMinutes = p.endHour * 60 + p.endMinute;
      if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
        return {
          ...p,
          isActive: true,
          timeRange: `${String(p.startHour).padStart(2, '0')}:${String(p.startMinute).padStart(2, '0')} - ${String(p.endHour).padStart(2, '0')}:${String(p.endMinute).padStart(2, '0')}`
        };
      }
    }

    if (nowMinutes < 8 * 60) {
      return {
        name: 'ก่อนเวลาเข้าแถว',
        isActive: false,
        timeRange: 'ก่อน 08:00 น.'
      };
    }

    return {
      name: 'หลังเวลาเรียน (เลิกเรียน)',
      isActive: false,
      timeRange: 'หลัง 16:00 น.'
    };
  }, [time]);

  // Trigger optional callback when active period changes
  useEffect(() => {
    if (onPeriodChange && activePeriod.name) {
      onPeriodChange(activePeriod.name);
    }
  }, [activePeriod.name, onPeriodChange]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Active Period Highlight Pill */}
      {showPeriodBadge && (
        <div className={cn(
          "hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shadow-sm",
          activePeriod.isActive 
            ? (activePeriod.isLunch 
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30" 
                : activePeriod.isHomeroom
                ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30")
            : "bg-slate-800/80 text-slate-400 border-slate-700/60"
        )}>
          <span className="relative flex h-2 w-2">
            {activePeriod.isActive && (
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                activePeriod.isLunch ? "bg-amber-400" : activePeriod.isHomeroom ? "bg-blue-400" : "bg-emerald-400"
              )} />
            )}
            <span className={cn(
              "relative inline-flex rounded-full h-2 w-2",
              activePeriod.isActive 
                ? (activePeriod.isLunch ? "bg-amber-400" : activePeriod.isHomeroom ? "bg-blue-400" : "bg-emerald-400")
                : "bg-slate-500"
            )} />
          </span>
          <span className="font-medium">{activePeriod.name}</span>
          <span className="text-[10px] opacity-70 font-mono">({activePeriod.timeRange})</span>
        </div>
      )}

      {/* Real-Time Live Clock Badge */}
      <div className="flex items-center gap-2 bg-[#0f172a]/90 hover:bg-[#1e293b] border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-md backdrop-blur-md transition-colors group">
        <Clock className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
        
        {/* HH:mm:ss Live Clock */}
        <span className="font-mono text-sm font-bold text-white tracking-wider tabular-nums">
          {timeString}
        </span>
        <span className="text-[10px] font-bold text-amber-400/90 font-mono">น.</span>

        {/* Date Divider & Date Display */}
        <div className="h-3 w-px bg-slate-700 mx-0.5 hidden sm:block" />
        <span className="text-xs text-slate-300 font-medium hidden sm:flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400" />
          {dateString}
        </span>
      </div>
    </div>
  );
};
