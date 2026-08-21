import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  MapPin, 
  Satellite, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  Shield, 
  Zap, 
  X, 
  Sparkles,
  Award,
  Bell
} from 'lucide-react';
import { useStore } from '../store';
import { GPSGeofenceCheckinModal } from './GPSGeofenceCheckinModal';
import { isWithinSchoolGeofence } from '../utils/geoUtils';

export function QuickActionHub() {
  const { user, schoolGeofenceConfig } = useStore();
  const [isGPSModalOpen, setIsGPSModalOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Approximate default in-school status
  const defaultCoord = {
    latitude: schoolGeofenceConfig.centerCoordinates.latitude + 0.0001,
    longitude: schoolGeofenceConfig.centerCoordinates.longitude + 0.0001,
  };
  const geofence = isWithinSchoolGeofence(defaultCoord, schoolGeofenceConfig);

  return (
    <>
      {/* Floating Quick Action Button (Desktop & Tablet bottom right, or Mobile quick trigger) */}
      <div className="fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-2.5">
        
        {/* Expanded Quick Menu */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 15 }}
              className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-xl mb-2 flex flex-col gap-2 min-w-[220px]"
            >
              <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  เมนูลัดด่วน (Quick Access)
                </span>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1. GPS Geofence Check-in */}
              <button
                onClick={() => {
                  setIsGPSModalOpen(true);
                  setIsExpanded(false);
                }}
                className="w-full text-left p-2 rounded-xl bg-gradient-to-r from-indigo-900/40 to-emerald-950/40 hover:from-indigo-900/70 hover:to-emerald-950/70 border border-indigo-500/30 flex items-center gap-2.5 transition-all text-xs font-semibold text-white group cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600/80 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
                  <Satellite className="w-4 h-4 text-emerald-300 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span>เช็คอินพิกัด GPS</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-[10px] text-slate-400">ลงชื่อเข้า-ออก รร. ด้วยดาวเทียม</p>
                </div>
              </button>

              {/* 2. Switch to Parent View */}
              <button
                onClick={() => {
                  const { setUser, user: currentUser } = useStore.getState();
                  if (currentUser) setUser({ ...currentUser, role: 'parent' });
                  setIsExpanded(false);
                }}
                className="w-full text-left p-2 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800 flex items-center gap-2.5 transition-all text-xs text-emerald-400 font-medium cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold">โหมดผู้ปกครอง</span>
                  <p className="text-[10px] text-slate-400">ดูผลการเรียนและเช็คชื่อบุตรหลาน</p>
                </div>
              </button>

              {/* 3. Switch to Student View */}
              <button
                onClick={() => {
                  const { setUser, user: currentUser } = useStore.getState();
                  if (currentUser) setUser({ ...currentUser, role: 'student' });
                  setIsExpanded(false);
                }}
                className="w-full text-left p-2 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800 flex items-center gap-2.5 transition-all text-xs text-indigo-400 font-medium cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold">โหมดนักเรียน</span>
                  <p className="text-[10px] text-slate-400">ตารางสอน พอร์ตโฟลิโอ คะแนน</p>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Master Button */}
        <div className="flex items-center gap-2">
          {/* Quick GPS Direct Button */}
          <button
            onClick={() => setIsGPSModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold text-xs shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all border border-white/10 cursor-pointer active:scale-95"
            title="เช็คอินด้วยพิกัดดาวเทียมโรงเรียน (GPS Geofence)"
          >
            <div className="relative">
              <Satellite className="w-4 h-4 text-white" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <span className="hidden sm:inline">เช็คอินพิกัด GPS</span>
            <span className="sm:hidden font-mono text-[11px]">GPS</span>
          </button>

          {/* Quick Hub Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-xl cursor-pointer ${
              isExpanded 
                ? 'bg-slate-800 text-white rotate-45 border border-slate-700' 
                : 'bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
            title="เปิดเมนูด่วน"
          >
            <Zap className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* GPS Geofence Check-in Modal */}
      <GPSGeofenceCheckinModal
        isOpen={isGPSModalOpen}
        onClose={() => setIsGPSModalOpen(false)}
      />
    </>
  );
}
