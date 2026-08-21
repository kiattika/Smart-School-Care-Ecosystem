import React, { useState } from 'react';
import { 
  FolderGit2, 
  Award, 
  HeartHandshake, 
  BookOpen, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  ExternalLink, 
  Eye, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Tag, 
  Calendar, 
  FileText, 
  GraduationCap, 
  Share2,
  Printer
} from 'lucide-react';
import { useStore } from '../../store';
import { PortfolioItem, DigitalCertificate, VolunteerHourRecord } from '../../types';

export function PortfolioActivityVault({ studentId }: { studentId: string }) {
  const { 
    portfolioItems, 
    digitalCertificates, 
    volunteerRecords, 
    addPortfolioItem,
    submitVolunteerHours,
    students 
  } = useStore();

  const student = students.find(s => s.studentId === studentId) || students[0];
  const items = portfolioItems.filter(p => p.studentId === student.studentId);
  const certs = digitalCertificates.filter(c => c.studentId === student.studentId);
  const volunteers = volunteerRecords.filter(v => v.studentId === student.studentId);

  const totalVolunteerHours = volunteers.reduce((acc, curr) => acc + curr.hours, 0);
  const requiredVolunteerHours = 60;

  const [activeTab, setActiveTab] = useState<'projects' | 'certificates' | 'volunteer' | 'tcas10'>('projects');
  const [tcasCurrentPage, setTcasCurrentPage] = useState<number>(1);
  const [targetFaculty, setTargetFaculty] = useState('คณะวิศวกรรมศาสตร์ สาขาวิศวกรรมคอมพิวเตอร์และปัญญาประดิษฐ์');

  // Add project modal/form
  const [showAddProject, setShowAddProject] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<PortfolioItem['category']>('ACADEMIC');
  const [newDesc, setNewDesc] = useState('');
  const [newAward, setNewAward] = useState('');

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addPortfolioItem({
      studentId: student.studentId,
      title: newTitle,
      category: newCategory,
      date: new Date().toISOString().split('T')[0],
      description: newDesc,
      awardLevel: newAward || 'รางวัลระดับเหรียญทอง',
      skills: ['Problem Solving', 'Teamwork', 'AI & Data'],
      photos: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80']
    });

    setNewTitle('');
    setNewDesc('');
    setNewAward('');
    setShowAddProject(false);
  };

  return (
    <div className="space-y-6">
      {/* Sub navigation pills */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl w-full max-w-2xl mx-auto">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'projects'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>ผลงาน & โครงงาน</span>
        </button>
        <button
          onClick={() => setActiveTab('certificates')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'certificates'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>คลังเกียรติบัตร ({certs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('volunteer')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'volunteer'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <HeartHandshake className="w-3.5 h-3.5" />
          <span>จิตอาสา ({totalVolunteerHours} ชม.)</span>
        </button>
        <button
          onClick={() => setActiveTab('tcas10')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'tcas10'
              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md animate-pulse'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>TCAS 10 หน้า Portfolio</span>
        </button>
      </div>

      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-400" />
                โครงงานวิชาการและการแข่งขัน (Academic Projects & Innovations)
              </h3>
              <p className="text-[11px] text-slate-400">ผลงานที่ผ่านการตรวจรับรองโดยครูที่ปรึกษาโครงงาน</p>
            </div>

            <button
              onClick={() => setShowAddProject(!showAddProject)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มผลงานใหม่</span>
            </button>
          </div>

          {showAddProject && (
            <div className="p-5 bg-slate-900 border border-indigo-500/40 rounded-3xl space-y-4 animate-fadeIn">
              <h4 className="text-xs font-bold text-white">เพิ่มรายการผลงานสะสม</h4>
              <form onSubmit={handleCreateProject} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">ชื่อผลงาน / โครงงาน:</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="เช่น โครงงานระบบ IoT ตรวจวัดคุณภาพน้ำ..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-300 block mb-1">หมวดหมู่:</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="ACADEMIC">วิชาการ & นวัตกรรม</option>
                      <option value="LEADERSHIP">ผู้นำ & สภานักเรียน</option>
                      <option value="ARTS_CULTURE">ศิลปวัฒนธรรม</option>
                      <option value="SPORTS">กีฬา & นันทนาการ</option>
                      <option value="VOLUNTEER">จิตอาสา</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">รางวัลที่ได้รับ (ถ้ามี):</label>
                  <input
                    type="text"
                    value={newAward}
                    onChange={(e) => setNewAward(e.target.value)}
                    placeholder="เช่น รางวัลชนะเลิศระดับเหรียญทอง สพฐ."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-300 block mb-1">รายละเอียดและบทบาทหน้าที่:</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="อธิบายเนื้อหาโครงงาน สิ่งที่ได้เรียนรู้ และทักษะที่นำมาประยุกต์ใช้..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white resize-none"
                    required
                  ></textarea>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddProject(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-400 rounded-xl text-xs"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs"
                  >
                    บันทึกผลงาน
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Project Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 rounded-3xl overflow-hidden backdrop-blur-md shadow-xl transition-all flex flex-col justify-between"
              >
                <div>
                  {item.photos?.[0] && (
                    <div className="h-48 w-full overflow-hidden relative">
                      <img 
                        src={item.photos[0]} 
                        alt={item.title} 
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700 text-[10px] font-bold text-amber-300 flex items-center gap-1">
                          <Award className="w-3 h-3 text-amber-400" />
                          {item.awardLevel}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 backdrop-blur-md border border-emerald-500/30 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          รับรองแล้ว
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-5 space-y-3">
                    <div>
                      <span className="text-[10px] font-mono text-indigo-400 block mb-1">
                        วันที่จัดแสดง: {item.date}
                      </span>
                      <h4 className="text-sm font-bold text-white leading-snug">{item.title}</h4>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-medium">
                          #{skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-800/40 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>ครูผู้รับรอง: {item.teacherVerifier}</span>
                  <button className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1">
                    <span>ดูรายละเอียด</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'certificates' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                คลังเกียรติบัตรและรางวัลแห่งความภาคภูมิใจ (Digital Credentials)
              </h3>
              <p className="text-[11px] text-slate-400">
                เกียรติบัตรดิจิทัลมีระบบเข้ารหัสตรวจสอบความถูกต้องผ่านรหัส Credential ID
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
              รวม {certs.length} ฉบับ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {certs.map((cert) => (
              <div
                key={cert.id}
                className="bg-slate-800/40 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 transition-all space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="h-32 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden flex items-center justify-center group cursor-pointer">
                    <img 
                      src={cert.certificateUrl} 
                      alt={cert.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-all opacity-80 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="px-3 py-1 rounded-xl bg-slate-900/90 text-white text-xs font-bold flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-amber-400" /> ขยายภาพ
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <span className="text-[10px] text-amber-400 font-bold block">{cert.issuer}</span>
                    <h4 className="text-xs font-bold text-white line-clamp-2">{cert.title}</h4>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-mono">{cert.credentialId}</span>
                  <button 
                    onClick={() => alert(`ดาวน์โหลดเกียรติบัตร: ${cert.title}`)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-white transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'volunteer' && (
        <div className="space-y-6">
          {/* Volunteer Progress Header */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> ผ่านเกณฑ์ชั่วโมงกิจกรรมพัฒนาผู้เรียนแล้ว
              </span>
              <h3 className="text-lg font-bold text-white">
                ชั่วโมงจิตอาสาและกิจกรรมบำเพ็ญประโยชน์เพื่อสังคม
              </h3>
              <p className="text-xs text-slate-300 max-w-xl">
                เกณฑ์ขั้นต่ำหลักสูตรแกนกลาง: 60 ชั่วโมงตลอดหลักสูตร ม.ปลาย (ม.4-6)
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 text-center min-w-[180px]">
              <span className="text-[11px] text-slate-400 block">ชั่วโมงสะสมรวม</span>
              <div className="flex items-baseline justify-center gap-1 mt-1">
                <span className="text-3xl font-black text-emerald-400">{totalVolunteerHours}</span>
                <span className="text-xs text-slate-400">/ {requiredVolunteerHours} ชม.</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 mt-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-full rounded-full" 
                  style={{ width: `${Math.min(100, (totalVolunteerHours / requiredVolunteerHours) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Volunteer Records List */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <HeartHandshake className="w-4 h-4 text-emerald-400" />
              บันทึกกิจกรรมจิตอาสาที่ได้รับการรับรอง
            </h4>

            <div className="space-y-3">
              {volunteers.map((vol) => (
                <div
                  key={vol.id}
                  className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{vol.activityName}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                        +{vol.hours} ชั่วโมง
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{vol.organization} • วันที่ {vol.date}</p>
                    <p className="text-[11px] text-slate-300">{vol.description}</p>
                  </div>

                  <div className="text-right shrink-0 text-[11px] text-emerald-400 font-medium">
                    ✓ ผู้รับรอง: {vol.verifierTeacher}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tcas10' && (
        <div className="space-y-6">
          {/* TCAS Exporter Header & Controller */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold">
                  TCAS 69 Portfolio Standard
                </span>
                <span className="text-xs text-slate-400">10 หน้าสมบูรณ์แบบพร้อมส่งทปอ.</span>
              </div>
              <h3 className="text-base font-bold text-white">
                แฟ้มสะสมผลงานดิจิทัล 10 หน้ามาตรฐาน (10-Page TCAS Portfolio)
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <button
                  onClick={() => setTcasCurrentPage(Math.max(1, tcasCurrentPage - 1))}
                  disabled={tcasCurrentPage === 1}
                  className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-white px-2">
                  หน้า {tcasCurrentPage} / 10
                </span>
                <button
                  onClick={() => setTcasCurrentPage(Math.min(10, tcasCurrentPage + 1))}
                  disabled={tcasCurrentPage === 10}
                  className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => alert('กำลังส่งออกไฟล์ 10-Page Portfolio (PDF ความละเอียดสูง 300 DPI สำหรับพิมพ์และส่ง TCAS)...')}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดทั้งเล่ม (10 หน้า PDF)</span>
              </button>
            </div>
          </div>

          {/* 10-Page Interactive Book Viewer */}
          <div className="bg-slate-950 p-4 sm:p-8 rounded-3xl border border-slate-800 flex justify-center">
            {/* Page Canvas (A4 Aspect Ratio: 1:1.414) */}
            <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden min-h-[640px] flex flex-col justify-between p-8 sm:p-12 relative border border-slate-200">
              
              {/* PAGE 1: COVER PAGE */}
              {tcasCurrentPage === 1 && (
                <div className="h-full flex flex-col justify-between text-center space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] tracking-widest uppercase text-indigo-900 font-bold">
                      PORTFOLIO • แฟ้มสะสมผลงานรอบที่ 1
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      TCAS 2569 PORTFOLIO
                    </h1>
                    <p className="text-xs text-indigo-700 font-bold">{targetFaculty}</p>
                  </div>

                  <div className="my-auto flex flex-col items-center">
                    <div className="w-44 h-44 rounded-3xl overflow-hidden border-4 border-indigo-600 shadow-xl mb-4 bg-slate-100">
                      <img 
                        src={student.photoUrl || student.avatar} 
                        alt={student.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h2 className="text-xl font-black text-slate-900">{student.name}</h2>
                    <p className="text-xs text-slate-600">รหัสนักเรียน {student.studentId} • โรงเรียนสมาร์ทแคร์วิทยาลัย</p>
                    <div className="mt-3 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold">
                      GPAX 5 ภาคเรียน: 3.88
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
                    <span>โรงเรียนสมาร์ทแคร์วิทยาลัย สพม.</span>
                    <span>หน้า 1 จาก 10</span>
                  </div>
                </div>
              )}

              {/* PAGE 2: STATEMENT OF PURPOSE & PROFILE */}
              {tcasCurrentPage === 2 && (
                <div className="space-y-6">
                  <div className="border-b-2 border-indigo-600 pb-2 flex justify-between items-center">
                    <h2 className="text-lg font-black text-indigo-950">ประวัติส่วนตัว & เหตุผลความสนใจ (Statement of Purpose)</h2>
                    <span className="text-xs font-bold text-slate-400">PAGE 02</span>
                  </div>

                  <div className="space-y-4 text-xs text-slate-700 leading-relaxed text-justify">
                    <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                      <h3 className="font-bold text-indigo-900 mb-1">ความมุ่งมั่นและแรงบันดาลใจในการศึกษาต่อ:</h3>
                      <p>
                        ข้าพเจ้ามีความหลงใหลในด้านเทคโนโลยีคอมพิวเตอร์และปัญญาประดิษฐ์มาโดยตลอด ตั้งแต่ระดับชั้นมัธยมศึกษาตอนต้น ได้เริ่มศึกษาการเขียนโปรแกรม Python และการสร้างโมเดล Machine Learning เพื่อแก้ไขปัญหาจริงในชุมชน เช่น โครงงานระบบคัดกรองขยะอัจฉริยะ และระบบตรวจสอบคุณภาพน้ำอัตโนมัติ ข้าพเจ้าเชื่อมั่นว่าการได้ศึกษาต่อในหลักสูตรนี้ จะช่วยพัฒนาศักยภาพเพื่อนำความรู้มาขับเคลื่อนนวัตกรรมที่เป็นประโยชน์ต่อประเทศชาติ
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <h4 className="font-bold text-slate-900 mb-2">ข้อมูลส่วนตัว:</h4>
                        <ul className="space-y-1 text-slate-600">
                          <li>• ชื่อ: {student.name}</li>
                          <li>• แผนการเรียน: วิทยาศาสตร์-คณิตศาสตร์ (AI Focus)</li>
                          <li>• วันเกิด: 15 มิถุนายน 2552 (อายุ 17 ปี)</li>
                          <li>• อีเมล: {student.studentId}@smartschool.ac.th</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 mb-2">ทักษะความสามารถ (Core Skills):</h4>
                        <ul className="space-y-1 text-slate-600">
                          <li>• Programming: Python, TypeScript, C++</li>
                          <li>• AI & Data: PyTorch, OpenCV, Pandas</li>
                          <li>• Languages: Thai (Native), English (IELTS 6.5)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
                    <span>TCAS 2569 PORTFOLIO</span>
                    <span>หน้า 2 จาก 10</span>
                  </div>
                </div>
              )}

              {/* PAGE 3: ACADEMIC TRANSCRIPTS & GPAX */}
              {tcasCurrentPage === 3 && (
                <div className="space-y-6">
                  <div className="border-b-2 border-indigo-600 pb-2 flex justify-between items-center">
                    <h2 className="text-lg font-black text-indigo-950">ผลการเรียนเฉลี่ยสะสม 5 ภาคเรียน (Academic Transcripts)</h2>
                    <span className="text-xs font-bold text-slate-400">PAGE 03</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      <span className="text-[10px] text-slate-500">GPAX สะสม</span>
                      <p className="text-2xl font-black text-indigo-700">3.88</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <span className="text-[10px] text-slate-500">กลุ่มวิชาคณิตศาสตร์</span>
                      <p className="text-2xl font-black text-emerald-700">4.00</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <span className="text-[10px] text-slate-500">กลุ่มวิชาวิทยาศาสตร์</span>
                      <p className="text-2xl font-black text-blue-700">3.92</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                          <th className="p-2">ภาคเรียน</th>
                          <th className="p-2">หน่วยกิต</th>
                          <th className="p-2">GPA ภาคเรียน</th>
                          <th className="p-2 text-right">อันดับในสายชั้น</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-600">
                        <tr><td className="p-2 font-bold">ม.4 เทอม 1</td><td className="p-2">16.5</td><td className="p-2 font-bold text-indigo-700">3.85</td><td className="p-2 text-right">Top 5%</td></tr>
                        <tr><td className="p-2 font-bold">ม.4 เทอม 2</td><td className="p-2">16.5</td><td className="p-2 font-bold text-indigo-700">3.90</td><td className="p-2 text-right">Top 3%</td></tr>
                        <tr><td className="p-2 font-bold">ม.5 เทอม 1</td><td className="p-2">17.0</td><td className="p-2 font-bold text-indigo-700">3.88</td><td className="p-2 text-right">Top 4%</td></tr>
                        <tr><td className="p-2 font-bold">ม.5 เทอม 2</td><td className="p-2">17.0</td><td className="p-2 font-bold text-indigo-700">3.92</td><td className="p-2 text-right">Top 2%</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
                    <span>TCAS 2569 PORTFOLIO</span>
                    <span>หน้า 3 จาก 10</span>
                  </div>
                </div>
              )}

              {/* PAGE 4 & 5: COMPETITIONS */}
              {(tcasCurrentPage === 4 || tcasCurrentPage === 5) && (
                <div className="space-y-6">
                  <div className="border-b-2 border-indigo-600 pb-2 flex justify-between items-center">
                    <h2 className="text-lg font-black text-indigo-950">
                      ผลงานและนวัตกรรมดีเด่น {tcasCurrentPage === 4 ? '(Part 1)' : '(Part 2)'}
                    </h2>
                    <span className="text-xs font-bold text-slate-400">PAGE 0{tcasCurrentPage}</span>
                  </div>

                  <div className="space-y-4">
                    {items.slice((tcasCurrentPage - 4) * 2, (tcasCurrentPage - 4) * 2 + 2).map((proj, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-900 text-sm">{proj.title}</h4>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                            {proj.awardLevel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{proj.description}</p>
                        <div className="text-[10px] text-indigo-700 font-medium">
                          ทักษะ: {proj.skills.join(', ')} • รับรองโดย: {proj.teacherVerifier}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
                    <span>TCAS 2569 PORTFOLIO</span>
                    <span>หน้า {tcasCurrentPage} จาก 10</span>
                  </div>
                </div>
              )}

              {/* PAGE 6 & 7: LEADERSHIP */}
              {(tcasCurrentPage === 6 || tcasCurrentPage === 7) && (
                <div className="space-y-6">
                  <div className="border-b-2 border-indigo-600 pb-2 flex justify-between items-center">
                    <h2 className="text-lg font-black text-indigo-950">
                      กิจกรรมความเป็นผู้นำ & สภานักเรียน {tcasCurrentPage === 6 ? '(Part 1)' : '(Part 2)'}
                    </h2>
                    <span className="text-xs font-bold text-slate-400">PAGE 0{tcasCurrentPage}</span>
                  </div>

                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3 text-xs">
                    <h4 className="font-bold text-indigo-900 text-sm">ประธานชมรมคอมพิวเตอร์และนวัตกรรม AI โรงเรียน</h4>
                    <p className="text-slate-700 leading-relaxed">
                      ทำหน้าที่บริหารจัดการชมรมที่มีสมาชิกกว่า 120 คน จัดอบรมเชิงปฏิบัติการ Python & Micro:bit ให้แก่น้องๆ ม.ต้น และเป็นตัวแทนนักเรียนประสานงานกับคณะผู้บริหารโรงเรียน
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-600">
                      <div>• ระยะเวลา: 2 ภาคเรียน (ปีการศึกษา 2568-2569)</div>
                      <div>• ผลงาน: จัดแข่งขัน School Hackathon 2026</div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
                    <span>TCAS 2569 PORTFOLIO</span>
                    <span>หน้า {tcasCurrentPage} จาก 10</span>
                  </div>
                </div>
              )}

              {/* PAGE 8 & 9: VOLUNTEER */}
              {(tcasCurrentPage === 8 || tcasCurrentPage === 9) && (
                <div className="space-y-6">
                  <div className="border-b-2 border-indigo-600 pb-2 flex justify-between items-center">
                    <h2 className="text-lg font-black text-indigo-950">
                      กิจกรรมจิตอาสาและบำเพ็ญประโยชน์ {tcasCurrentPage === 8 ? '(Part 1)' : '(Part 2)'}
                    </h2>
                    <span className="text-xs font-bold text-slate-400">PAGE 0{tcasCurrentPage}</span>
                  </div>

                  <div className="space-y-3">
                    {volunteers.map((vol, idx) => (
                      <div key={idx} className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-emerald-950">{vol.activityName}</h4>
                          <span className="font-bold text-emerald-700">+{vol.hours} ชม.</span>
                        </div>
                        <p className="text-slate-600">หน่วยงาน: {vol.organization} (ผู้รับรอง: {vol.verifierTeacher})</p>
                        <p className="text-[10px] text-slate-500">วันที่ทำกิจกรรม: {vol.date}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
                    <span>TCAS 2569 PORTFOLIO</span>
                    <span>หน้า {tcasCurrentPage} จาก 10</span>
                  </div>
                </div>
              )}

              {/* PAGE 10: CERTIFICATES & BACK COVER */}
              {tcasCurrentPage === 10 && (
                <div className="h-full flex flex-col justify-between space-y-6">
                  <div className="border-b-2 border-indigo-600 pb-2 flex justify-between items-center">
                    <h2 className="text-lg font-black text-indigo-950">เกียรติบัตรและคำขอบคุณ (Certificates Gallery)</h2>
                    <span className="text-xs font-bold text-slate-400">PAGE 10</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {certs.slice(0, 3).map((c, i) => (
                      <div key={i} className="p-2 border border-slate-200 rounded-lg text-center bg-slate-50 text-[10px]">
                        <img src={c.certificateUrl} alt={c.title} className="h-16 w-full object-cover rounded mb-1" />
                        <span className="font-bold truncate block">{c.title}</span>
                      </div>
                    ))}
                  </div>

                  <div className="my-auto text-center p-6 bg-indigo-900 text-white rounded-2xl space-y-2">
                    <h3 className="text-base font-bold">THANK YOU</h3>
                    <p className="text-xs text-indigo-200">
                      กราบขอบพระคุณคณะกรรมการผู้ทรงคุณวุฒิทุกท่าน ที่ให้เกียรติพิจารณาแฟ้มสะสมผลงานฉบับนี้
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
                    <span>TCAS 2569 PORTFOLIO • COMPLETE</span>
                    <span>หน้า 10 จาก 10</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
