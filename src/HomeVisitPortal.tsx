import { cn } from "./lib/utils";
import React, { useState } from 'react';
import { useStore } from './store';
import { useRealStudents } from './hooks/useRealStudents';
import { GoogleMapsHomeVisit } from './components/GoogleMapsHomeVisit';
import { 
  MapPin, 
  Camera, 
  Search, 
  UserCheck, 
  ChevronLeft,
  Navigation,
  CheckCircle2,
  Image as ImageIcon,
  WifiOff,
  Home,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';


// Mock Students for Home Visit

export function HomeVisitPortal() {
  const { homeVisits, submitHomeVisit, user } = useStore();
  // รายชื่อนักเรียนจาก Firestore สด — ไม่มี mock fallback (ผิดกฎ CLAUDE.md)
  const { students, loading: studentsLoading } = useRealStudents();
  const [activeTab, setActiveTab] = useState<'pending' | 'visited'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Form States
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [housingQuality, setHousingQuality] = useState('');
  const [risks, setRisks] = useState<string[]>([]);
  const [needScholarship, setNeedScholarship] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);

  // รายชื่อนักเรียนจริง + สถานะเยี่ยมบ้านจาก homeVisits (ไม่มี mock fallback)
  const baseStudents = (students || []).map(s => {
    const isVisited = homeVisits.some(v => v.studentId === s.studentId);
    return {
      id: s.id,
      studentId: s.studentId,
      name: s.name,
      class: s.room || '',
      address: s.homeLocation?.address || '',
      phone: (s as any).parentMobile || '',
      status: isVisited ? 'visited' as const : 'pending' as const,
      avatar: s.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(s.studentId)}`,
      riskLevel: 'low'
    };
  });

  const filteredStudents = baseStudents.filter(s => {
    const matchesTab = s.status === activeTab;
    const matchesQuery = s.name.includes(searchQuery) || s.studentId.includes(searchQuery);
    return matchesTab && matchesQuery;
  });

  const handleCheckIn = () => {
    setIsLocating(true);
    setTimeout(() => {
      setLocation({ lat: 13.7563, lng: 100.5018 });
      setIsLocating(false);
    }, 1500);
  };

  const toggleRisk = (risk: string) => {
    setRisks(prev => 
      prev.includes(risk) ? prev.filter(r => r !== risk) : [...prev, risk]
    );
  };

  const handleTakePhoto = () => {
    if (photos.length < 2) {
      setPhotos([...photos, `photo_${photos.length + 1}`]);
    }
  };

  const handleSubmit = () => {
    if (selectedStudent) {
      submitHomeVisit({
        studentId: selectedStudent.studentId,
        advisorEmail: user?.email || 'advisor@utd.ac.th',
        visitedAt: new Date().toISOString(),
        geoVerified: !!location,
        riskLevel: risks.length > 2 ? 'HIGH' : risks.length > 0 ? 'MEDIUM' : 'LOW',
        photoUploaded: photos.length > 0
      });
    }

    // Reset and go back
    setLocation(null);
    setHousingQuality('');
    setRisks([]);
    setNeedScholarship(false);
    setPhotos([]);
    setSelectedStudent(null);
    setActiveTab('visited');
  };

  if (selectedStudent) {
    return (
      <div className="flex flex-col h-screen sm:h-[844px] w-full sm:max-w-[390px] sm:rounded-[2.5rem] bg-[#0b0d14] text-slate-200 overflow-hidden font-sans relative shadow-2xl border-[8px] border-slate-900 mx-auto">
        {/* Header */}
        <header className="h-14 border-b border-white/10 bg-[#0f111a] flex items-center px-4 shrink-0 sticky top-0 z-20">
          <button 
            onClick={() => setSelectedStudent(null)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors -ml-2 mr-2"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-slate-100 text-sm">บันทึกการเยี่ยมบ้าน</h1>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> บันทึกข้อมูลแบบ Offline ชั่วคราวได้
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 hide-scrollbar">
          {/* Student Info */}
          <div className="p-4 bg-indigo-950/20 border-b border-indigo-500/20 flex items-center gap-4">
            <img src={selectedStudent.avatar} className="w-12 h-12 rounded-full border border-indigo-500/50 bg-slate-800" alt="" />
            <div>
              <h2 className="font-bold text-indigo-100">{selectedStudent.name}</h2>
              <div className="text-xs text-indigo-300">รหัส: {selectedStudent.studentId} | ชั้น ม.1/1</div>
            </div>
          </div>

          <div className="p-4 space-y-6">
            {/* Check-In Section */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" /> พิกัดสถานที่ (Google Maps Platform)
              </h3>
              
              {!location ? (
                <button 
                  onClick={handleCheckIn}
                  disabled={isLocating}
                  className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  {isLocating ? (
                    <span className="flex items-center gap-2 animate-pulse">
                      <Navigation className="w-4 h-4 animate-spin" /> กำลังค้นหาพิกัด GPS...
                    </span>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4" /> เช็คอินพิกัดบ้านนักเรียน
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-emerald-400">เช็คอินสำเร็จ</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Lat: {location.lat}, Lng: {location.lng}</div>
                    </div>
                    <button 
                      onClick={() => setLocation(null)}
                      className="text-xs text-slate-400 hover:text-slate-200 underline"
                    >
                      เปลี่ยน
                    </button>
                  </div>
                  
                  {/* Google Maps View */}
                  <GoogleMapsHomeVisit
                    location={location}
                    studentName={selectedStudent.name}
                    onLocationSelect={(coords) => setLocation(coords)}
                  />
                </div>
              )}
            </section>

            {/* Screening Form Section */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-5">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                <Home className="w-4 h-4 text-indigo-400" /> สภาพความเป็นอยู่
              </h3>
              
              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block">1. ลักษณะที่พักอาศัย</label>
                <div className="space-y-2">
                  {['มั่นคงแข็งแรง', 'ทรุดโทรม', 'วิกฤต (ต้องช่วยเหลือด่วน)'].map(option => (
                    <label key={option} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                      housingQuality === option ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-200" : "bg-white/5 border-transparent text-slate-300"
                    )}>
                      <input 
                        type="radio" 
                        name="housing" 
                        value={option} 
                        checked={housingQuality === option}
                        onChange={(e) => setHousingQuality(e.target.value)}
                        className="w-4 h-4 accent-indigo-500" 
                      />
                      <span className="text-sm">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-orange-400" /> 2. ความเสี่ยงที่พบ (เลือกได้มากกว่า 1)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    'รายได้ครอบครัวไม่เพียงพอ', 
                    'ปัญหาด้านสุขภาพ/โรคประจำตัว', 
                    'ขาดแคลนอุปกรณ์เทคโนโลยี (มือถือ/เน็ต)',
                    'ระยะทางมาโรงเรียนไกล/เดินทางลำบาก'
                  ].map(risk => (
                    <label key={risk} className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                      risks.includes(risk) ? "bg-orange-500/10 border-orange-500/30 text-orange-200" : "bg-white/5 border-transparent text-slate-300"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={risks.includes(risk)}
                        onChange={() => toggleRisk(risk)}
                        className="w-4 h-4 mt-0.5 accent-orange-500 rounded bg-slate-800 border-slate-600" 
                      />
                      <span className="text-xs">{risk}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <label className="flex items-center justify-between p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center">
                      <GraduationCap className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-emerald-400">ขอรับทุนปัจจัยพื้นฐาน (คสศ.)</div>
                      <div className="text-[10px] text-emerald-500/70">เสนอชื่อนักเรียนเข้ารับการคัดกรองทุน</div>
                    </div>
                  </div>
                  <div className={cn(
                    "w-10 h-6 rounded-full transition-colors flex items-center px-1",
                    needScholarship ? "bg-emerald-500" : "bg-slate-700"
                  )}>
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                      needScholarship ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                  <input type="checkbox" className="hidden" checked={needScholarship} onChange={() => setNeedScholarship(!needScholarship)} />
                </label>
              </div>
            </section>

            {/* Photos Section */}
            <section className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-pink-400" /> ภาพถ่ายประกอบ
                </h3>
                <span className="text-[10px] text-slate-400">{photos.length}/2 ภาพ</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo, idx) => (
                  <div key={idx} className="aspect-square bg-slate-800 rounded-lg border border-white/10 overflow-hidden relative group">
                    <img src={`https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&q=80`} alt="House" className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-center py-1 font-medium">
                      {idx === 0 ? 'หน้าบ้าน' : 'ภายในบ้าน'}
                    </div>
                  </div>
                ))}
                
                {photos.length < 2 && (
                  <button 
                    onClick={handleTakePhoto}
                    className="aspect-square bg-white/5 border-2 border-dashed border-white/20 hover:border-indigo-400 hover:bg-indigo-500/10 rounded-lg flex flex-col items-center justify-center gap-2 transition-colors text-slate-400 hover:text-indigo-400"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-[10px] font-medium">
                      {photos.length === 0 ? 'ถ่ายภาพหน้าบ้าน' : 'ถ่ายภาพภายในบ้าน'}
                    </span>
                  </button>
                )}
              </div>
            </section>
          </div>
        </main>

        <div className="absolute bottom-0 w-full p-4 bg-[#0b0d14]/90 backdrop-blur-md border-t border-white/10 z-20">
          <button 
            onClick={handleSubmit}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold text-sm shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> บันทึกการเยี่ยมบ้าน
          </button>
        </div>
      </div>
    );
  }

  // Dashboard View
  return (
    <div className="flex flex-col h-screen sm:h-[844px] w-full sm:max-w-[390px] sm:rounded-[2.5rem] bg-[#0b0d14] text-slate-200 overflow-hidden font-sans relative shadow-2xl border-[8px] border-slate-900 mx-auto">
      <header className="px-5 pt-12 pb-4 bg-gradient-to-b from-indigo-950/50 to-transparent relative z-10">
        <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Navigation className="w-5 h-5 text-indigo-400" />
          ระบบเยี่ยมบ้านดิจิทัล
        </h1>
        <div className="text-xs text-slate-400 mt-1">ม.1/1 - ภาคเรียนที่ 1/2569</div>
        
        <div className="mt-5 flex bg-white/5 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('pending')}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'pending' ? "bg-indigo-500 text-white shadow-md" : "text-slate-400"
            )}
          >
            รอดำเนินการ
          </button>
          <button 
            onClick={() => setActiveTab('visited')}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'visited' ? "bg-emerald-500 text-white shadow-md" : "text-slate-400"
            )}
          >
            เยี่ยมแล้ว
          </button>
        </div>
      </header>

      <div className="px-5 pb-4 relative z-10">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อ หรือ รหัสนักเรียน..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1c1f2b] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-indigo-500 text-white placeholder:text-slate-500 transition-colors"
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-5 pb-24 hide-scrollbar relative z-10">
        <div className="space-y-3">
          {filteredStudents.map(student => (
            <div 
              key={student.id}
              onClick={() => student.status === 'pending' && setSelectedStudent(student)}
              className={cn(
                "bg-[#1c1f2b] border border-white/5 rounded-xl p-4 flex items-center gap-4 transition-all",
                student.status === 'pending' ? "cursor-pointer hover:border-indigo-500/50 hover:bg-white/10" : "opacity-75"
              )}
            >
              <img src={student.avatar} className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800" alt="" />
              <div className="flex-1">
                <h3 className="font-bold text-sm text-slate-200">{student.name}</h3>
                <div className="text-[10px] text-slate-400">{student.studentId}</div>
              </div>
              <div>
                {student.status === 'pending' ? (
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <ChevronLeft className="w-4 h-4 rotate-180" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-[9px] text-emerald-500 font-bold">สำเร็จ</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">
              {studentsLoading
                ? 'กำลังโหลดรายชื่อนักเรียนจากฐานข้อมูล...'
                : activeTab === 'pending'
                  ? 'ไม่มีนักเรียนที่รอเยี่ยมบ้าน'
                  : 'ยังไม่มีบันทึกการเยี่ยมบ้าน'}
            </div>
          )}
        </div>
      </main>
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
    </div>
  );
}
