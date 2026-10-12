import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Navigation, 
  MapPin, 
  Satellite, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Radio, 
  ShieldCheck, 
  Camera, 
  History, 
  Sliders, 
  Crosshair, 
  RefreshCw, 
  Sparkles, 
  X, 
  ChevronRight,
  School,
  Compass,
  Check
} from 'lucide-react';
import { useStore } from '../store';
import { useSchoolGeofence } from '../hooks/useSchoolGeofence';
import { saveSchoolGeofenceConfigFirestore } from '../services/firestoreService';
import { GateDraft, MAX_GATES, DEFAULT_GATE_RADIUS, CENTER_RADIUS_MIN, CENTER_RADIUS_MAX, GATE_RADIUS_MIN, GATE_RADIUS_MAX, gatesToDrafts, draftsToGates, newGateId, validateGeofenceSettings } from '../lib/geofenceConfig';
import { 
  Coordinates, 
  SchoolGeofenceConfig, 
  calculateHaversineDistance, 
  isWithinSchoolGeofence, 
  formatDistance, 
  calculateBearing, 
  getThaiDirection 
} from '../utils/geoUtils';

interface GPSGeofenceCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GPSGeofenceCheckinModal({ isOpen, onClose }: GPSGeofenceCheckinModalProps) {
  const { 
    user, 
    gpsCheckInLogs, 
    addGPSCheckInLog, 
    updateSchoolGeofenceConfig 
  } = useStore();
  // พิกัด/รัศมีโรงเรียนจริงจาก Firestore (school_settings/geofence_config) — ไม่เดาจากค่า default ในโค้ด
  const { config: schoolGeofenceConfig, configured: geofenceConfigured, loaded: geofenceLoaded } = useSchoolGeofence();
  // แท็บตั้งค่าพิกัดโรงเรียน: เฉพาะผู้ดูแลระบบ (ตรงกับ firestore.rules ที่ให้ SUPER_ADMIN เขียน school_settings เท่านั้น)
  const canConfigure = (user?.activeRole || user?.role || '').toString().toUpperCase() === 'SUPER_ADMIN';
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'CHECKIN' | 'HISTORY' | 'SETTINGS'>('CHECKIN');
  // เริ่มต้น null = ยังไม่ได้อ่านพิกัดจริงจากเครื่อง (เดิมตั้งเป็นจุดในโรงเรียนปลอมๆ ทำให้ดูเหมือนอยู่ในเขตทันที)
  const [currentCoords, setCurrentCoords] = useState<Coordinates | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isRealGPSActive, setIsRealGPSActive] = useState<boolean>(false);
  
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [checkinNote, setCheckinNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [lastCheckinSuccess, setLastCheckinSuccess] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  // Settings state
  const [tempRadius, setTempRadius] = useState<number>(schoolGeofenceConfig.radiusMeters);
  const [tempLat, setTempLat] = useState<number>(schoolGeofenceConfig.centerCoordinates.latitude);
  const [tempLng, setTempLng] = useState<number>(schoolGeofenceConfig.centerCoordinates.longitude);
  const [settingsSavedToast, setSettingsSavedToast] = useState<boolean>(false);
  const [tempGates, setTempGates] = useState<GateDraft[]>(() => gatesToDrafts(schoolGeofenceConfig.gates));
  const [locatingTarget, setLocatingTarget] = useState<string | null>(null);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);

  useEffect(() => {
    setTempRadius(schoolGeofenceConfig.radiusMeters);
    setTempLat(schoolGeofenceConfig.centerCoordinates.latitude);
    setTempLng(schoolGeofenceConfig.centerCoordinates.longitude);
  }, [schoolGeofenceConfig.radiusMeters, schoolGeofenceConfig.centerCoordinates.latitude, schoolGeofenceConfig.centerCoordinates.longitude]);

  useEffect(() => {
    setTempGates(gatesToDrafts(schoolGeofenceConfig.gates));
  }, [schoolGeofenceConfig.gates]);

  const updateGate = (id: string, patch: Partial<GateDraft>) =>
    setTempGates(prev => prev.map(g => (g.id === id ? { ...g, ...patch } : g)));
  const addGate = () =>
    setTempGates(prev => prev.length >= MAX_GATES ? prev : [...prev, {
      id: newGateId(prev), name: `ประตู ${prev.length + 1}`, latitude: tempLat, longitude: tempLng, radiusMeters: DEFAULT_GATE_RADIUS,
    }]);
  const removeGate = (id: string) => setTempGates(prev => prev.filter(g => g.id !== id));

  /** อ่านตำแหน่งจริงของอุปกรณ์แอดมิน (ยืนที่จุดนั้นแล้วกด) แล้วใส่ให้ศูนย์กลาง/ประตูที่เลือก */
  const useMyLocationFor = (target: 'center' | string) => {
    setLocateMsg(null);
    if (!navigator.geolocation) { setLocateMsg('อุปกรณ์นี้ไม่รองรับการอ่านตำแหน่ง'); return; }
    setLocatingTarget(target);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const lat = Number(latitude.toFixed(6));
        const lng = Number(longitude.toFixed(6));
        if (target === 'center') { setTempLat(lat); setTempLng(lng); }
        else updateGate(target, { latitude: lat, longitude: lng });
        setLocateMsg(`ใช้ตำแหน่งปัจจุบันแล้ว (ความแม่นยำ ±${Math.round(accuracy)} ม.) — กด "บันทึก" เพื่อยืนยัน`);
        setLocatingTarget(null);
      },
      () => { setLocateMsg('อ่านตำแหน่งไม่สำเร็จ — อนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์แล้วลองใหม่'); setLocatingTarget(null); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate geofence status
  const myId = user?.profile?.id || user?.uid;
  const myLogs = gpsCheckInLogs.filter(l => !myId || l.userId === myId);
  const hasFix = currentCoords !== null;
  const coords: Coordinates = currentCoords ?? schoolGeofenceConfig.centerCoordinates;
  const rawGeofence = isWithinSchoolGeofence(coords, schoolGeofenceConfig);
  // ยังไม่มีพิกัดจริง หรือ admin ยังไม่ตั้งพิกัดโรงเรียน = เช็คอินไม่ได้
  const geofenceResult = { ...rawGeofence, isInside: hasFix && geofenceConfigured && rawGeofence.isInside };
  const bearingDegrees = calculateBearing(coords, schoolGeofenceConfig.centerCoordinates);
  const directionThai = getThaiDirection(bearingDegrees);

  // Function to acquire real device geolocation
  const requestRealGPS = () => {
    if (!navigator.geolocation) {
      setLocationError('เบราว์เซอร์นี้ไม่รองรับระบบ Geolocation');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setAccuracy(Math.round(pos.coords.accuracy));
        setIsRealGPSActive(true);
        setIsLocating(false);
      },
      (err) => {
        console.warn('GPS location request warning:', err);
        setLocationError('ไม่สามารถดึงพิกัดจากดาวเทียมได้ (กรุณาอนุญาตการเข้าถึง Location หรือใช้โหมดทดสอบพิกัด)');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );
  };

  // Initial GPS fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      requestRealGPS();
    }
  }, [isOpen]);

  // Preset location simulations for testing
  const setPresetLocation = (type: 'GATE_1' | 'BUILDING_1' | 'SPORTS_FIELD' | 'OFF_CAMPUS') => {
    setIsRealGPSActive(false);
    setLocationError(null);
    switch (type) {
      case 'GATE_1':
        setCurrentCoords({
          latitude: schoolGeofenceConfig.gates[0]?.coordinates.latitude || 17.625620,
          longitude: schoolGeofenceConfig.gates[0]?.coordinates.longitude || 100.093200,
        });
        setAccuracy(4);
        break;
      case 'BUILDING_1':
        setCurrentCoords({
          latitude: schoolGeofenceConfig.centerCoordinates.latitude + 0.0002,
          longitude: schoolGeofenceConfig.centerCoordinates.longitude + 0.0001,
        });
        setAccuracy(6);
        break;
      case 'SPORTS_FIELD':
        setCurrentCoords({
          latitude: schoolGeofenceConfig.gates[2]?.coordinates.latitude || 17.625800,
          longitude: schoolGeofenceConfig.gates[2]?.coordinates.longitude || 100.094100,
        });
        setAccuracy(5);
        break;
      case 'OFF_CAMPUS':
        // ~850 meters away
        setCurrentCoords({
          latitude: schoolGeofenceConfig.centerCoordinates.latitude + 0.0065,
          longitude: schoolGeofenceConfig.centerCoordinates.longitude + 0.0055,
        });
        setAccuracy(15);
        break;
    }
  };

  // Handle Photo Capture
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfiePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Perform Check-in or Check-out
  const handlePerformCheckIn = async (type: 'ENTRY' | 'EXIT') => {
    if (!geofenceResult.isInside || !currentCoords) {
      alert('คุณอยู่นอกเขตรัศมีโรงเรียน หรือยังไม่ได้พิกัดจาก GPS ไม่สามารถบันทึกเวลาได้');
      return;
    }

    setIsSubmitting(true);
    setCheckinError(null);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    // .toISOString() แปลงเป็น UTC เสมอ — ช่วงเที่ยงคืน-ตี 6 กว่าๆ ตามเวลาไทย (UTC+7) จะลากวันถอยหลัง
    // ไป 1 วัน ใช้ format() จาก date-fns แทน (คำนวณจาก local time fields ตรงๆ)
    const dateStr = format(now, 'yyyy-MM-dd');

    // Determine status (entry after 08:00 is late)
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const isLate = type === 'ENTRY' && (currentHour > 8 || (currentHour === 8 && currentMin > 0));

    let status: 'ON_TIME' | 'LATE' | 'EARLY_DEPARTURE' | 'NORMAL_DEPARTURE' = 'ON_TIME';
    if (type === 'ENTRY') {
      status = isLate ? 'LATE' : 'ON_TIME';
    } else {
      status = currentHour < 15 ? 'EARLY_DEPARTURE' : 'NORMAL_DEPARTURE';
    }

    const userName = user?.profile 
      ? `${user.profile.prefix || ''}${user.profile.firstName} ${user.profile.lastName}`
      : user?.displayName || 'ผู้ใช้งาน';
    
    const userRole = user?.activeRole || user?.role?.toUpperCase() || 'USER';

    try {
      await addGPSCheckInLog({
        userId: user?.profile?.id || user?.uid || 'user-unknown',
        userName,
        userRole,
        type,
        timestamp: timeStr,
        date: dateStr,
        latitude: currentCoords.latitude,
        longitude: currentCoords.longitude,
        distanceMeters: geofenceResult.distanceMeters,
        isInsideGeofence: true,
        status,
        accuracyMeters: accuracy ?? 0,
        nearestGate: geofenceResult.nearestGateName,
        selfieUrl: selfiePreview || undefined,
        notes: checkinNote || (isRealGPSActive ? 'พิกัดดาวเทียมจริง (High Precision GPS)' : 'พิกัด Geofence')
      });
      setLastCheckinSuccess(`บันทึก${type === 'ENTRY' ? 'ลงชื่อเข้าโรงเรียน' : 'ลงชื่อกลับบ้าน'}สำเร็จ (${timeStr})`);
      setSelfiePreview(null);
      setCheckinNote('');
      setTimeout(() => {
        setLastCheckinSuccess(null);
      }, 4000);
    } catch (err) {
      console.error('[GPSGeofenceCheckinModal] check-in failed:', err);
      setCheckinError('บันทึกเวลาไม่สำเร็จ (ยังไม่มีการบันทึก) — ตรวจสอบสัญญาณอินเทอร์เน็ตแล้วลองอีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!canConfigure) return;
    setSettingsError(null);
    const errors = validateGeofenceSettings({ centerLat: tempLat, centerLng: tempLng, radiusMeters: tempRadius, gates: tempGates });
    if (errors.length > 0) { setSettingsError(errors.join(' • ')); return; }
    const gates = draftsToGates(tempGates);
    const next = {
      ...schoolGeofenceConfig,
      radiusMeters: tempRadius,
      centerCoordinates: { latitude: tempLat, longitude: tempLng },
      gates,
    };
    try {
      await saveSchoolGeofenceConfigFirestore(next);
      updateSchoolGeofenceConfig({ radiusMeters: tempRadius, centerCoordinates: { latitude: tempLat, longitude: tempLng }, gates });
      setSettingsSavedToast(true);
      setTimeout(() => setSettingsSavedToast(false), 3000);
    } catch {
      setSettingsError('บันทึกไม่สำเร็จ — ตรวจสอบสิทธิ์ผู้ดูแลระบบและการเชื่อมต่อ แล้วลองใหม่');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Satellite className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    ระบบเช็คอินพิกัดดาวเทียม (GPS Geofence)
                  </h3>
                  {isRealGPSActive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Live GPS
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                  {geofenceConfigured
                    ? `${schoolGeofenceConfig.schoolName} (รัศมี ${schoolGeofenceConfig.radiusMeters} ม.)`
                    : geofenceLoaded ? 'โรงเรียนยังไม่ได้ตั้งพิกัดเช็คอิน' : 'กำลังโหลดการตั้งค่าโรงเรียน…'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="px-5 pt-3 pb-1 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 gap-2 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <button
                onClick={() => setActiveTab('CHECKIN')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'CHECKIN'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                เช็คอินสด (Live Clock-in)
              </button>
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'HISTORY'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                ประวัติการลงชื่อ ({myLogs.length})
              </button>
              {canConfigure && (
              <button
                onClick={() => setActiveTab('SETTINGS')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'SETTINGS'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                ตั้งค่าพิกัด/รัศมี
              </button>
              )}
            </div>

            <button
              onClick={requestRealGPS}
              disabled={isLocating}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 border border-slate-700/60"
              title="รีเฟรชสัญญาณดาวเทียม"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-indigo-400' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช GPS</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            
            {checkinError && (
              <div role="alert" className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {checkinError}
              </div>
            )}

            {/* SUCCESS BANNER TOAST */}
            {lastCheckinSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-3 shadow-lg"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-xs font-semibold flex-1">
                  {lastCheckinSuccess}
                </div>
              </motion.div>
            )}

            {/* TAB: CHECKIN */}
            {activeTab === 'CHECKIN' && (
              <div className="space-y-4">
                
                {/* Visual Satellite Radar & Live Distance Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800 p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    
                    {/* Radar Graphic */}
                    <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-slate-900/90 border border-slate-700/80 flex items-center justify-center shrink-0 shadow-inner">
                      {/* Concentric Radar Rings */}
                      <div className="absolute inset-2 rounded-full border border-slate-800/80" />
                      <div className="absolute inset-6 rounded-full border border-slate-800" />
                      <div className="absolute inset-10 rounded-full border border-slate-700/40" />

                      {/* Radar sweep animation */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-indigo-500/10 to-indigo-500/30 animate-spin [animation-duration:4s]" />

                      {/* Pulse waves if inside */}
                      {geofenceResult.isInside && (
                        <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping [animation-duration:3s]" />
                      )}

                      {/* Center School Pin */}
                      <div className="relative z-10 w-8 h-8 rounded-full bg-indigo-600 border-2 border-white/80 flex items-center justify-center shadow-lg">
                        <School className="w-4 h-4 text-white" />
                      </div>

                      {/* Satellite Orbit Dot */}
                      <div className="absolute top-2 right-4 text-indigo-400 animate-bounce">
                        <Satellite className="w-3.5 h-3.5" />
                      </div>

                      {/* User Location Indicator */}
                      <div 
                        className={`absolute w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all duration-700 ${
                          geofenceResult.isInside ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{
                          top: geofenceResult.isInside ? '35%' : '12%',
                          left: geofenceResult.isInside ? '60%' : '80%',
                        }}
                      />
                    </div>

                    {/* Geofence Status & Live Telemetry */}
                    <div className="flex-1 w-full text-center sm:text-left space-y-2">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        {!hasFix || !geofenceConfigured ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-700/40 border border-slate-600/50 text-slate-300 text-xs font-bold shadow-sm">
                            {!geofenceConfigured ? (geofenceLoaded ? 'โรงเรียนยังไม่ได้ตั้งพิกัดเช็คอิน (แจ้งผู้ดูแลระบบ)' : 'กำลังโหลดการตั้งค่า…') : 'รอพิกัดจาก GPS ของอุปกรณ์'}
                          </div>
                        ) : geofenceResult.isInside ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            อยู่ในรัศมีโรงเรียน (In Geofence Zone)
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
                            อยู่นอกเขตรัศมีโรงเรียน (Out of Zone)
                          </div>
                        )}

                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-400 text-[11px] font-mono border border-slate-700/60">
                          {accuracy !== null ? `ความแม่นยำ ±${accuracy} ม.` : 'รอสัญญาณ GPS'}
                        </span>
                      </div>

                      <div className="space-y-1 pt-1">
                        <div className="flex items-baseline justify-center sm:justify-start gap-2">
                          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            {hasFix && geofenceConfigured ? formatDistance(geofenceResult.distanceMeters) : '—'}
                          </span>
                          <span className="text-xs text-slate-400">
                            จากจุดศูนย์กลางสถานศึกษา
                          </span>
                        </div>

                        <p className="text-xs text-slate-300">
                          {!hasFix || !geofenceConfigured ? (
                            <span className="text-slate-400 font-medium">ยังเช็คอินไม่ได้จนกว่าจะได้พิกัดจริงและโรงเรียนตั้งพิกัดไว้แล้ว</span>
                          ) : geofenceResult.isInside ? (
                            <span className="text-emerald-300 font-medium">
                              ✓ พิกัดพร้อมลงชื่อเข้า/ออก ใกล้จุด {geofenceResult.nearestGateName}
                            </span>
                          ) : (
                            <span className="text-amber-300 font-medium">
                              ⚠ คุณอยู่ห่างเกิน {schoolGeofenceConfig.radiusMeters} ม. กรุณาเข้าสู่พื้นที่สถานศึกษา
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Coordinates Telemetry */}
                      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400">
                        {hasFix ? (
                          <>
                            <span>Lat: {coords.latitude.toFixed(6)}</span>
                            <span>Lng: {coords.longitude.toFixed(6)}</span>
                            <span className="text-indigo-400">{directionThai}</span>
                          </>
                        ) : (
                          <span>ยังไม่ได้พิกัดจากอุปกรณ์ — กดอนุญาต Location หรือกด “รีเฟรช GPS”</span>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Location Error Warning if any */}
                {locationError && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{locationError}</span>
                  </div>
                )}

                {/* Simulation & Preset Location Buttons — DEV เท่านั้น (ปลอมพิกัดได้ ห้ามเห็นใน production) */}
                {import.meta.env.DEV && (
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-850 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                        จำลองจุดตรวจพิกัด (Simulation Quick Testing):
                      </span>
                      <span className="text-[10px] text-slate-500">คลิกเพื่อสลับจุดทดสอบ</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        onClick={() => setPresetLocation('GATE_1')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-300 text-[11px] font-medium transition-all text-center"
                      >
                        🚪 ประตู 1 (หน้า รร.)
                      </button>
                      <button
                        onClick={() => setPresetLocation('BUILDING_1')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-300 text-[11px] font-medium transition-all text-center"
                      >
                        🏫 อาคาร 1 (ใจกลาง รร.)
                      </button>
                      <button
                        onClick={() => setPresetLocation('SPORTS_FIELD')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-300 text-[11px] font-medium transition-all text-center"
                      >
                        ⚽ สนามกีฬา/ประตู 3
                      </button>
                      <button
                        onClick={() => setPresetLocation('OFF_CAMPUS')}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/40 text-rose-300 text-[11px] font-medium transition-all text-center"
                      >
                        🚗 นอกโรงเรียน (850 ม.)
                      </button>
                    </div>
                  </div>
                )}

                {/* Additional Note & Photo Selfie Option */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Photo Selfie Capture */}
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-850 flex items-center gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      capture="user"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    {selfiePreview ? (
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-indigo-500/40 shrink-0">
                        <img src={selfiePreview} alt="Selfie preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setSelfiePreview(null)}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-12 h-12 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-indigo-400 flex flex-col items-center justify-center gap-0.5 shrink-0 transition-colors cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span className="text-[9px]">ถ่ายรูป</span>
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200">รูปถ่ายยืนยันตัวตน</p>
                      <p className="text-[10.5px] text-slate-400">แนบรูปเซลฟี่ (ไม่บังคับ — ไม่ได้ใช้ยืนยันตัวตนอัตโนมัติ)</p>
                    </div>
                  </div>

                  {/* Note input */}
                  <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-850 flex items-center">
                    <input
                      type="text"
                      value={checkinNote}
                      onChange={(e) => setCheckinNote(e.target.value)}
                      placeholder="บันทึกหมายเหตุ (เช่น เข้าเวรประตู 1)..."
                      className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => handlePerformCheckIn('ENTRY')}
                    disabled={!geofenceResult.isInside || isSubmitting}
                    className={`py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer ${
                      geofenceResult.isInside && !isSubmitting
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 active:scale-[0.98]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>ลงชื่อเข้าโรงเรียน (Clock In)</span>
                  </button>

                  <button
                    onClick={() => handlePerformCheckIn('EXIT')}
                    disabled={!geofenceResult.isInside || isSubmitting}
                    className={`py-3.5 px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer ${
                      geofenceResult.isInside && !isSubmitting
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30 active:scale-[0.98]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                    }`}
                  >
                    <Clock className="w-5 h-5" />
                    <span>ลงชื่อกลับบ้าน (Clock Out)</span>
                  </button>
                </div>

              </div>
            )}

            {/* TAB: HISTORY */}
            {activeTab === 'HISTORY' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300">
                    ประวัติการเช็คอินพิกัดดาวเทียมวันนี้ ({myLogs.length} รายการ)
                  </h4>
                </div>

                {myLogs.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    ยังไม่มีประวัติการเช็คอินพิกัดดาวเทียมในวันนี้
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {myLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            log.type === 'ENTRY'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                          }`}>
                            {log.type === 'ENTRY' ? 'เข้า' : 'ออก'}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-200">{log.userName}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                                log.status === 'ON_TIME'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-amber-500/10 text-amber-400'
                              }`}>
                                {log.status === 'ON_TIME' ? 'มาตรงเวลา' : log.status === 'LATE' ? 'มาสาย' : 'ปกติ'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span>{log.timestamp}</span>
                              <span>•</span>
                              <span>ห่าง {log.distanceMeters} ม.</span>
                              {log.nearestGate && (
                                <>
                                  <span>•</span>
                                  <span className="text-indigo-300">{log.nearestGate}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SETTINGS */}
            {activeTab === 'SETTINGS' && canConfigure && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <Sliders className="w-4 h-4" />
                    <span>ปรับแต่งพิกัดศูนย์กลางและรัศมี Geofence ของโรงเรียน</span>
                  </div>

                  {settingsError && (
                    <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">{settingsError}</div>
                  )}
                  {settingsSavedToast && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>บันทึกการตั้งค่าพิกัด Geofence สำเร็จ</span>
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        รัศมีที่อนุญาตให้เช็คอิน: <strong className="text-white">{tempRadius} เมตร</strong>
                      </label>
                      <input
                        type="range"
                        min={CENTER_RADIUS_MIN}
                        max={CENTER_RADIUS_MAX}
                        step="25"
                        value={tempRadius}
                        onChange={(e) => setTempRadius(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                        <span>{CENTER_RADIUS_MIN} ม.</span>
                        <span>{CENTER_RADIUS_MAX.toLocaleString()} ม.</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">ละติจูด (Latitude)</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={tempLat}
                          onChange={(e) => setTempLat(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">ลองจิจูด (Longitude)</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={tempLng}
                          onChange={(e) => setTempLng(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => useMyLocationFor('center')}
                      disabled={locatingTarget !== null}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium cursor-pointer"
                    >
                      {locatingTarget === 'center' ? 'กำลังอ่านตำแหน่ง…' : '📍 ใช้ตำแหน่งปัจจุบันของฉันเป็นศูนย์กลางโรงเรียน'}
                    </button>

                    <div className="pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">ประตูโรงเรียน ({tempGates.length}/{MAX_GATES})</span>
                        <button
                          type="button"
                          onClick={addGate}
                          disabled={tempGates.length >= MAX_GATES}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer"
                        >
                          + เพิ่มประตู
                        </button>
                      </div>
                      {tempGates.length === 0 && (
                        <p className="text-[11px] text-slate-500">ยังไม่มีประตู — ระบบจะใช้รัศมีรอบศูนย์กลางโรงเรียนอย่างเดียว</p>
                      )}
                      {tempGates.map((g, i) => (
                        <div key={g.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={g.name}
                              maxLength={60}
                              onChange={(e) => updateGate(g.id, { name: e.target.value })}
                              aria-label={`ชื่อประตูที่ ${i + 1}`}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeGate(g.id)}
                              className="px-2 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 text-[11px] cursor-pointer"
                            >
                              ลบ
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input type="number" step="0.000001" value={g.latitude} aria-label="ละติจูดประตู"
                              onChange={(e) => updateGate(g.id, { latitude: Number(e.target.value) })}
                              className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-mono focus:border-indigo-500 focus:outline-none" />
                            <input type="number" step="0.000001" value={g.longitude} aria-label="ลองจิจูดประตู"
                              onChange={(e) => updateGate(g.id, { longitude: Number(e.target.value) })}
                              className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-mono focus:border-indigo-500 focus:outline-none" />
                            <input type="number" min={GATE_RADIUS_MIN} max={GATE_RADIUS_MAX} value={g.radiusMeters} aria-label="รัศมีประตู (เมตร)"
                              onChange={(e) => updateGate(g.id, { radiusMeters: Number(e.target.value) })}
                              className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-mono focus:border-indigo-500 focus:outline-none" />
                          </div>
                          <button
                            type="button"
                            onClick={() => useMyLocationFor(g.id)}
                            disabled={locatingTarget !== null}
                            className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-[11px] cursor-pointer"
                          >
                            {locatingTarget === g.id ? 'กำลังอ่านตำแหน่ง…' : '📍 ใช้ตำแหน่งปัจจุบันของฉันเป็นประตูนี้'}
                          </button>
                        </div>
                      ))}
                      {locateMsg && <p className="text-[11px] text-amber-300">{locateMsg}</p>}
                    </div>

                    <div className="pt-3">
                      <button
                        onClick={handleSaveSettings}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                      >
                        บันทึกการตั้งค่าพิกัดโรงเรียน
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px]">พิกัดอ่านจากอุปกรณ์ของคุณ ใช้เพื่อตรวจว่าอยู่ในรัศมีโรงเรียนเท่านั้น</span>
            </div>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              ปิดหน้าต่าง
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
