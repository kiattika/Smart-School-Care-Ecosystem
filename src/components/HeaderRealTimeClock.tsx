import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar, Zap, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAdminPeriods } from '../hooks/useAdminPeriods';
import { findCurrentPeriod } from '../lib/currentPeriod';

interface HeaderRealTimeClockProps {
  showPeriodBadge?: boolean;
  className?: string;
  onPeriodChange?: (periodName: string) => void;
}

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

  // คาบปัจจุบันจากตารางเวลาจริง (admin_periods_config) — ไม่มีการตั้งเวลา = ไม่แสดงแถบคาบ
  const { periods } = useAdminPeriods();
  const activePeriod = useMemo(() => findCurrentPeriod(periods, time), [periods, time]);

  // Trigger optional callback when active period changes
  useEffect(() => {
    if (onPeriodChange && activePeriod?.name) {
      onPeriodChange(activePeriod.name);
    }
  }, [activePeriod?.name, onPeriodChange]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Active Period Highlight Pill */}
      {showPeriodBadge && activePeriod && (
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
          {activePeriod.timeRange && <span className="text-[10px] opacity-70 font-mono">({activePeriod.timeRange})</span>}
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
