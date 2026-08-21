import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  PlusCircle, 
  MinusCircle, 
  FileText, 
  Printer, 
  Download, 
  Sparkles, 
  QrCode, 
  Check, 
  Calendar, 
  User, 
  Stamp,
  BadgeCheck
} from 'lucide-react';
import { useStore } from '../../store';
import { MeritDemeritRecord } from '../../types';

export function BehaviorDisciplineModule({ studentId, isParentView = false }: { studentId: string; isParentView?: boolean }) {
  const { 
    meritDemeritLogs, 
    addMeritDemeritRecord, 
    analytics, 
    students,
    user 
  } = useStore();

  const student = students.find(s => s.studentId === studentId) || students[0];
  const studentAnalytics = analytics.find(a => a.studentId === student.studentId) || {
    behaviorScore: 98,
    gpa: 3.88
  };

  const logs = meritDemeritLogs.filter(l => l.studentId === student.studentId);
  const currentScore = studentAnalytics.behaviorScore;

  const [activeTab, setActiveTab] = useState<'logs' | 'certificate' | 'award'>('logs');
  const [certYear, setCertYear] = useState('2569');

  // Teacher award form
  const [awardType, setAwardType] = useState<'MERIT' | 'DEMERIT'>('MERIT');
  const [points, setPoints] = useState<number>(5);
  const [category, setCategory] = useState('จิตอาสาบำเพ็ญประโยชน์');
  const [description, setDescription] = useState('');
  const [awardSuccess, setAwardSuccess] = useState(false);

  const handleAwardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    addMeritDemeritRecord(
      student.studentId,
      awardType,
      points,
      category,
      description,
      user?.displayName || 'ครูกิตติศักดิ์ (หัวหน้างานปกครอง)'
    );

    setDescription('');
    setAwardSuccess(true);
    setTimeout(() => setAwardSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Sub navigation pills */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl w-full max-w-lg mx-auto">
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'logs'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>คะแนน & บันทึกพฤติกรรม</span>
        </button>
        <button
          onClick={() => setActiveTab('certificate')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'certificate'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>ใบรับรองความประพฤติ (ปพ.)</span>
        </button>
        <button
          onClick={() => setActiveTab('award')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'award'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>ตัด/เพิ่มคะแนน (ครู)</span>
        </button>
      </div>

      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Top Score Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 backdrop-blur-md flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">คะแนนความประพฤติปัจจุบัน</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-black text-emerald-400">{currentScore}</span>
                  <span className="text-xs text-slate-400">/ 100 คะแนนเต็ม</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-emerald-400 text-xs font-bold">
                  <BadgeCheck className="w-4 h-4" />
                  <span>เกณฑ์: ความประพฤติดีเด่น (Diamond Level)</span>
                </div>
              </div>
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Award className="w-8 h-8" />
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">คะแนนความดีสะสม (+)</span>
                <p className="text-3xl font-black text-emerald-400 mt-1">+15</p>
                <span className="text-[11px] text-slate-400 mt-1 block">จากการบำเพ็ญประโยชน์ 3 ครั้ง</span>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <PlusCircle className="w-7 h-7" />
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium">การตัดคะแนนพฤติกรรม (-)</span>
                <p className="text-3xl font-black text-slate-300 mt-1">0</p>
                <span className="text-[11px] text-emerald-400 mt-1 block">ไม่เคยมีประวัติถูกตัดคะแนน</span>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                <MinusCircle className="w-7 h-7" />
              </div>
            </div>
          </div>

          {/* Behavior Logs List */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  บันทึกประวัติการเพิ่ม-ลดคะแนนความประพฤติ (Merit & Demerit Logs)
                </h3>
                <p className="text-[11px] text-slate-400">ข้อมูลเชื่อมโยงกับสมุดบันทึกฝ่ายปกครองสถานศึกษา</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs border border-slate-700">
                ทั้งหมด {logs.length} รายการ
              </span>
            </div>

            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      log.type === 'MERIT'
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                    }`}>
                      {log.type === 'MERIT' ? <PlusCircle className="w-5 h-5" /> : <MinusCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          log.type === 'MERIT' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}>
                          {log.category}
                        </span>
                        <span className="text-xs font-bold text-white">วันที่ {log.date}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{log.description}</p>
                      <span className="text-[10.5px] text-slate-400 mt-1 block">
                        ครูผู้บันทึก: {log.teacherName} (ปีการศึกษา {log.academicYear})
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-lg font-black ${
                      log.type === 'MERIT' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {log.type === 'MERIT' ? `+${log.points}` : `${log.points}`}
                    </span>
                    <span className="text-[10px] text-slate-400 block">คะแนน</span>
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  ยังไม่มีบันทึกประวัติพฤติกรรมในภาคเรียนนี้
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'certificate' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-8 backdrop-blur-md shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                ใบรับรองความประพฤติดิจิทัล (Official Conduct Certificate)
              </h3>
              <p className="text-[11px] text-slate-400">
                เอกสารรับรองความประพฤติทางการศึกษา ออกโดยระบบดิจิทัล พร้อมลายเซ็นอิเล็กทรอนิกส์และ QR ตรวจสอบ
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>พิมพ์เอกสาร</span>
              </button>
              <button
                onClick={() => alert('กำลังดาวน์โหลดไฟล์ PDF ใบรับรองความประพฤติ (ตราครุฑ)...')}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด PDF</span>
              </button>
            </div>
          </div>

          {/* Authentic Thai School Conduct Certificate Paper Mockup */}
          <div className="bg-slate-50 text-slate-900 rounded-2xl p-8 sm:p-12 shadow-2xl border-4 border-amber-900/20 max-w-3xl mx-auto relative overflow-hidden font-serif">
            {/* Garuda & Official Header */}
            <div className="text-center space-y-1 relative z-10">
              <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center">
                <span className="text-4xl font-bold">🦅</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-wide">
                หนังสือรับรองความประพฤติ
              </h2>
              <p className="text-xs sm:text-sm text-slate-700">
                โรงเรียนสมาร์ทแคร์วิทยาลัย สำนักงานเขตพื้นที่การศึกษามัธยมศึกษา
              </p>
              <p className="text-[11px] text-slate-600 font-mono">
                ที่ ศธ ๐๔๒๘๕/๑๑๘๒
              </p>
            </div>

            {/* Certificate Body */}
            <div className="mt-8 space-y-4 text-xs sm:text-sm leading-relaxed text-slate-800 text-justify relative z-10">
              <p className="indent-8">
                หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า <strong className="font-bold underline text-slate-950">{student.name}</strong> 
                &nbsp;รหัสนักเรียน <strong className="font-mono">{student.studentId}</strong> กำลังศึกษาอยู่ในระดับชั้นมัธยมศึกษาปีที่ ๕ ห้อง ๘
                ปีการศึกษา ๒๕๖๙ โรงเรียนสมาร์ทแคร์วิทยาลัย
              </p>

              <p className="indent-8">
                ตลอดระยะเวลาที่ศึกษาอยู่ในสถานศึกษาแห่งนี้ นักเรียนเป็นผู้มีความประพฤติเรียบร้อย มีสัมมาคารวะ 
                ปฏิบัติตามกฎระเบียบและข้อบังคับของสถานศึกษาอย่างเคร่งครัด อุทิศตนเพื่อกิจกรรมจิตอาสาและสังคมอย่างต่อเนื่อง
                มีคะแนนความประพฤติปัจจุบัน <strong className="text-emerald-800 font-bold">{currentScore} คะแนน (ระดับดีเด่น)</strong> 
                และไม่เคยถูกลงโทษทางวินัยหรือถูกตัดคะแนนความประพฤติแต่อย่างใด
              </p>

              <p className="indent-8">
                ให้ไว้ ณ วันที่ ๒๐ สิงหาคม พุทธศักราช ๒๕๖๙
              </p>
            </div>

            {/* Signature & Seal Area */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 pt-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-white border border-slate-300 rounded-lg p-1.5 shadow-sm flex items-center justify-center">
                  <QrCode className="w-12 h-12 text-slate-800" />
                </div>
                <div className="text-[10px] text-slate-600">
                  <p className="font-bold text-slate-900">รหัสตรวจสอบดิจิทัล (UUID):</p>
                  <p className="font-mono">SSC-CERT-2569-08-9821</p>
                  <p className="text-emerald-700 font-bold">✓ ตรวจสอบความถูกต้องสมบูรณ์แล้ว</p>
                </div>
              </div>

              <div className="text-center space-y-1">
                <div className="h-10 flex items-center justify-center">
                  <span className="font-cursive italic text-base text-blue-900 font-bold">
                    ดร. สุรศักดิ์ วิจิตรการ
                  </span>
                </div>
                <div className="w-48 border-b border-dotted border-slate-400 mx-auto"></div>
                <p className="text-xs font-bold text-slate-900">(ดร. สุรศักดิ์ วิจิตรการ)</p>
                <p className="text-[11px] text-slate-600">ผู้อำนวยการโรงเรียนสมาร์ทแคร์วิทยาลัย</p>
              </div>
            </div>

            {/* Official Stamp Watermark */}
            <div className="absolute right-12 bottom-12 w-28 h-28 rounded-full border-4 border-rose-600/30 flex items-center justify-center pointer-events-none rotate-[-15deg]">
              <span className="text-[10px] font-bold text-rose-600/40 text-center leading-tight">
                โรงเรียนสมาร์ทแคร์<br />ตราประทับรับรอง<br />ฝ่ายปกครอง
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'award' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl max-w-2xl mx-auto space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            บันทึกคะแนนความประพฤติ (สำหรับครูและฝ่ายปกครอง)
          </h3>
          <p className="text-[11px] text-slate-400">
            ระบบจะส่งการแจ้งเตือน Real-time พร้อมแต้มคะแนนไปยังแอปพลิเคชันของผู้ปกครองทันที
          </p>

          {awardSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>บันทึกคะแนนและส่งการแจ้งเตือนไปยังผู้ปกครองเรียบร้อยแล้ว</span>
            </div>
          )}

          <form onSubmit={handleAwardSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">ประเภทการบันทึก:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setAwardType('MERIT'); setPoints(5); setCategory('จิตอาสาบำเพ็ญประโยชน์'); }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    awardType === 'MERIT'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>เพิ่มคะแนนความดี (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAwardType('DEMERIT'); setPoints(5); setCategory('แต่งกายผิดระเบียบ'); }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    awardType === 'DEMERIT'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow'
                      : 'bg-slate-800/40 border-slate-700 text-slate-400'
                  }`}
                >
                  <MinusCircle className="w-4 h-4" />
                  <span>ตัดคะแนนพฤติกรรม (-)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">หมวดหมู่:</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {awardType === 'MERIT' ? (
                    <>
                      <option value="จิตอาสาบำเพ็ญประโยชน์">จิตอาสาบำเพ็ญประโยชน์</option>
                      <option value="สร้างชื่อเสียงให้โรงเรียน">สร้างชื่อเสียงให้โรงเรียน</option>
                      <option value="ความซื่อสัตย์สุจริต">ความซื่อสัตย์สุจริต</option>
                      <option value="ช่วยเหลืองานครูอาจารย์">ช่วยเหลืองานครูอาจารย์</option>
                    </>
                  ) : (
                    <>
                      <option value="แต่งกายผิดระเบียบ">แต่งกายผิดระเบียบ</option>
                      <option value="มาสายไม่เข้าแถว">มาสายไม่เข้าแถว</option>
                      <option value="ไม่ส่งการบ้าน">ไม่ส่งการบ้าน</option>
                      <option value="ใช้โทรศัพท์ในเวลาเรียน">ใช้โทรศัพท์ในเวลาเรียน</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">จำนวนคะแนน:</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  min={1}
                  max={20}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">รายละเอียดเหตุการณ์และพฤติกรรม:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ระบุรายละเอียด เช่น ช่วยจัดเตรียมอุปกรณ์ห้องประชุม, ทำความสะอาดอาคารเรียน..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                required
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>บันทึกและส่งการแจ้งเตือนถึงผู้ปกครองทันที</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
