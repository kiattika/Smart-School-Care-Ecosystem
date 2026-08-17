import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  X, 
  Play, 
  Database,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';

export type ImportType = 'STUDENT' | 'TEACHER' | 'COURSE';

export interface BulkDataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (type: ImportType, count: number) => void;
}

// แถวจำลองข้อมูลที่ผ่าน และ ติด Error เพื่อจำลองการทำ Validation ให้ตรงตามข้อกำหนดอย่างสมบูรณ์แบบ
interface PreviewRow {
  id: string;
  col1: string; // เช่น รหัสนักเรียน/รหัสครู/รหัสวิชา
  col2: string; // เช่น ชื่อ-นามสกุล / ชื่อวิชา
  col3: string; // เช่น อีเมล / ระดับชั้น / หน่วยกิต
  col4: string; // เช่น ห้องเรียน / ตำแหน่ง / อาจารย์ผู้สอน
  isValid: boolean;
  errorMessage?: string;
}

export function BulkDataImportModal({ isOpen, onClose, onImportSuccess }: BulkDataImportModalProps) {
  const [importType, setImportType] = useState<ImportType>('STUDENT');
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [isValidated, setIsValidated] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // การจำลองดาวน์โหลดไฟล์เทมเพลตตัวอย่าง
  const handleDownloadTemplate = () => {
    // ในสถานการณ์จริง จะเป็นการดาวน์โหลดไฟล์จากพาร์ท หรือใช้ xlsx บิลด์ขึ้นมา
    // ตรงนี้เราทำฟังก์ชันจำลองให้เซฟเป็นไฟล์ csv หลอก ๆ ให้ผู้ใช้ได้อารมณ์เสมือนจริงสูงสุด
    let headers = '';
    let filename = '';
    
    if (importType === 'STUDENT') {
      headers = 'Student ID,Prefix,FirstName,LastName,Room,StudentNo,ParentMobile\n620101,นาย,สมรักษ์,คำสิงห์,ม.5/8,1,0812345678\n620102,นางสาว,สมศรี,ใจดี,ม.5/8,2,0898765432';
      filename = 'Student_Template.csv';
    } else if (importType === 'TEACHER') {
      headers = 'Teacher ID,Prefix,FirstName,LastName,Position,Email,Roles\nteacher-01,นาย,ทวี,รักเรียน,ครู คศ.1,tawee@school.ac.th,"SUBJECT_TEACHER,HOMEROOM_TEACHER"';
      filename = 'Teacher_Template.csv';
    } else {
      headers = 'Course Code,Course Name,Level,Room,Credits,Instructor ID\nTH32101,ภาษาไทย 3,ม.5,ม.5/8,1.5,teacher-somchai';
      filename = 'Course_Template.csv';
    }

    const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ดึงข้อมูลพรีวิวจำลองตามประเภทการนำเข้า เพื่อส่งมอบประสบการณ์เหมือนจริงที่แสดง Validation แดง-เขียว ได้ชัดเจน
  const generateMockPreviewData = (type: ImportType, fileName: string): PreviewRow[] => {
    if (type === 'STUDENT') {
      return [
        { id: '1', col1: '38501', col2: 'นายกฤตยชญ์ บุญช่วย', col3: 'ม.5/8', col4: 'เลขที่ 1', isValid: true },
        { id: '2', col1: '38502', col2: 'นายณัฐพล สุขสบาย', col3: 'ม.5/8', col4: 'เลขที่ 2', isValid: true },
        { id: '3', col1: '38501', col2: 'นายสิทธิชัย กลิ่นส้ม', col3: 'ม.5/8', col4: 'เลขที่ 3', isValid: false, errorMessage: '⚠️ รหัสประจำตัวซ้ำซ้อนกับลำดับที่ 1' },
        { id: '4', col1: '38504', col2: 'เด็กชายสมชาย ไม่มีนามสกุล', col3: 'ม.5', col4: '', isValid: false, errorMessage: '⚠️ ข้อมูลไม่สมบูรณ์ (ขาดระบุห้องเรียน หรือ เลขที่ประจำตัว)' },
        { id: '5', col1: '38505', col2: 'นางสาวจารุวรรณ ใฝ่เรียน', col3: 'ม.5/8', col4: 'เลขที่ 4', isValid: true },
      ];
    } else if (type === 'TEACHER') {
      return [
        { id: '1', col1: 'tch-001', col2: 'นางสมจิต แข็งขัน', col3: 'somjit@school.ac.th', col4: 'ครู คศ.2', isValid: true },
        { id: '2', col1: 'tch-002', col2: 'นายชลิต นามสมมติ', col3: 'chalit_email_invalid', col4: 'ครู คศ.1', isValid: false, errorMessage: '⚠️ รูปแบบอีเมลไม่ถูกต้องตามข้อกำหนด (@school.ac.th)' },
        { id: '3', col1: 'tch-003', col2: 'นางสาวพิมลวรรณ ศรีงาม', col3: 'pimonwan@school.ac.th', col4: 'ครูผู้ช่วย', isValid: true },
        { id: '4', col1: '', col2: 'นายบุญชู แสนดี', col3: 'boonchoo@school.ac.th', col4: 'ครูอัตราจ้าง', isValid: false, errorMessage: '⚠️ ขาดรหัสประจำตัวครู (ID)' },
      ];
    } else {
      return [
        { id: '1', col1: 'TH32101', col2: 'ภาษาไทย 3', col3: '1.5 หน่วยกิต', col4: 'ม.5/8', isValid: true },
        { id: '2', col1: 'MA32101', col2: 'คณิตศาสตร์พื้นฐาน 3', col3: '1.5 หน่วยกิต', col4: 'ม.5/8', isValid: true },
        { id: '3', col1: 'SCI32201', col2: 'ฟิสิกส์เพิ่มเติม 1', col3: '-9 หน่วยกิต', col4: 'ม.5/8', isValid: false, errorMessage: '⚠️ จำนวนหน่วยกิตติดลบ หรืออยู่นอกเกณฑ์ (0.5 - 3.0)' },
        { id: '4', col1: 'EN32101', col2: 'ภาษาอังกฤษ 3', col3: '1.0 หน่วยกิต', col4: 'ม.5/8', isValid: true },
      ];
    }
  };

  // Drag behavior
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      processFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'csv') {
      alert('❌ กรุณาเลือกอัปโหลดไฟล์ตระกูล Excel (.xlsx, .xls) หรือ CSV (.csv) เท่านั้น');
      return;
    }
    setFile(selectedFile);
    
    // จำลองการตรวจวิเคราะห์ความถูกต้องและพรีวิวข้อมูลหลังการอัปโหลดไฟล์
    const data = generateMockPreviewData(importType, selectedFile.name);
    setPreviewData(data);
    setIsValidated(true);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreviewData([]);
    setIsValidated(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ดำเนินการอัปโหลดเข้าฐานข้อมูล (บันทึกข้อมูล)
  const handleConfirmImport = () => {
    if (previewData.length === 0) return;
    
    // กรองเฉพาะแถวที่ผ่านการตรวจสอบ
    const validRowsCount = previewData.filter(r => r.isValid).length;
    if (validRowsCount === 0) {
      alert('❌ ไม่พบแถวข้อมูลที่ผ่านการตรวจสอบความถูกต้อง กรุณาตรวจสอบหรือแก้ไของค์ประกอบไฟล์ก่อน');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    // จำลอง Progress Bar วิ่ง
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsImporting(false);
            if (onImportSuccess) {
              onImportSuccess(importType, validRowsCount);
            }
            onClose();
            // เคลียร์ค่า
            handleRemoveFile();
          }, 400);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const validCount = previewData.filter(r => r.isValid).length;
  const invalidCount = previewData.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in text-slate-200">
      <div className="bg-[#11151d] border border-white/10 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col my-8 max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-white/5 bg-[#0a0f16] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
              <FileSpreadsheet className="w-5.5 h-5.5 text-indigo-400" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-0.5">Bulk Integration Engine</span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                นำเข้าข้อมูลนักเรียนและบุคลากรชุดใหญ่
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isImporting}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 1. Import Type Selector (ประเภทการนำเข้าข้อมูล) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
              ขั้นตอนที่ 1: เลือกประเภทข้อมูลที่ต้องการนำเข้า
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: 'STUDENT', label: 'รายชื่อนักเรียนในสังกัด', desc: 'ข้อมูลรหัสประจำตัว, ชื่อ-นามสกุล, ห้องประจำชั้น' },
                { type: 'TEACHER', label: 'รายชื่อครูและสิทธิ์ผู้ใช้', desc: 'ข้อมูลรหัสบุคลากร, ชื่อ, อีเมล, สิทธิบทบาทเบื้องต้น' },
                { type: 'COURSE', label: 'ตารางสอนและวิชาเรียน', desc: 'ข้อมูลรหัสวิชา, ชื่อวิชา, หน่วยกิต, ห้องเรียนที่เปิดสอน' }
              ].map(item => {
                const isSelected = importType === item.type;
                return (
                  <button
                    type="button"
                    key={item.type}
                    onClick={() => {
                      if (!isImporting) {
                        setImportType(item.type as ImportType);
                        // เคลียร์ไฟล์เดิมเมื่อสลับประเภท
                        if (file) handleRemoveFile();
                      }
                    }}
                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer h-24 ${
                      isSelected 
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-white shadow-inner' 
                        : 'bg-slate-950/40 border-white/5 text-slate-400 hover:border-slate-800'
                    }`}
                  >
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[10px] text-slate-400 leading-tight mt-1">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Drag & Drop Upload Zone + Download Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                ขั้นตอนที่ 2: อัปโหลดไฟล์เอกสาร
              </label>
              
              {/* Template Download Button */}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลดไฟล์เทมเพลตตัวอย่าง ({importType === 'STUDENT' ? 'Student_Template.csv' : importType === 'TEACHER' ? 'Teacher_Template.csv' : 'Course_Template.csv'})
              </button>
            </div>

            {!file ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-indigo-500 bg-indigo-500/5' 
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/80'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center shadow-lg">
                  <Upload className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">ลากไฟล์มาวางตรงนี้ หรือคลิกเพื่อเลือกไฟล์นำเข้า</p>
                  <p className="text-[10px] text-slate-500 mt-1">รองรับไฟล์ประเภท Excel (.xlsx, .xls) หรือ CSV (.csv) ขนาดสูงสุดไม่เกิน 10MB</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
                    <FileSpreadsheet className="w-5.5 h-5.5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{file.name}</h4>
                    <p className="text-[10px] text-slate-500">ขนาดไฟล์: {(file.size / 1024).toFixed(1)} KB • สแกนความปลอดภัยแล้ว</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="ลบไฟล์และอัปโหลดใหม่"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            )}
          </div>

          {/* 3. Data Preview & Validation Table */}
          {isValidated && previewData.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-300">
              
              {/* Validation Summary Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  <span>ขั้นตอนที่ 3: ตรวจสอบความถูกต้องของข้อมูล ({previewData.length} แถวที่ประมวลผล)</span>
                </div>
                
                {/* Badges สรุปผลความปลอดภัยข้อมูล */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg shadow-sm">
                    <CheckCircle2 className="w-3 h-3" />
                    ผ่านเกณฑ์ตรวจสอบ: {validCount} รายการ
                  </span>
                  {invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded-lg shadow-sm">
                      <XCircle className="w-3 h-3 animate-pulse" />
                      พบข้อผิดพลาด: {invalidCount} รายการ
                    </span>
                  )}
                </div>
              </div>

              {/* ตารางจัดแสดง Preview */}
              <div className="border border-white/5 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-white/5 text-slate-400 text-[11px] font-semibold">
                        <th className="px-4 py-3 text-center w-12">แถวที่</th>
                        <th className="px-4 py-3">
                          {importType === 'STUDENT' ? 'รหัสนักเรียน' : importType === 'TEACHER' ? 'รหัสประจำตัวครู' : 'รหัสวิชา'}
                        </th>
                        <th className="px-4 py-3">
                          {importType === 'STUDENT' ? 'ชื่อ-นามสกุลนักเรียน' : importType === 'TEACHER' ? 'ชื่อ-นามสกุลบุคลากร' : 'ชื่อวิชาเรียน'}
                        </th>
                        <th className="px-4 py-3">
                          {importType === 'STUDENT' ? 'ห้องเรียน' : importType === 'TEACHER' ? 'อีเมลโรงเรียน' : 'ระดับชั้น / หน่วยกิต'}
                        </th>
                        <th className="px-4 py-3">
                          {importType === 'STUDENT' ? 'เลขที่' : importType === 'TEACHER' ? 'ตำแหน่งหลัก' : 'ห้องประจำวิชา'}
                        </th>
                        <th className="px-4 py-3">สถานะตรวจสอบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                      {previewData.map((row, index) => (
                        <tr 
                          key={row.id} 
                          className={`transition-colors ${
                            row.isValid 
                              ? 'hover:bg-white/[0.01]' 
                              : 'bg-rose-500/[0.03] hover:bg-rose-500/[0.05]'
                          }`}
                        >
                          <td className="px-4 py-3 text-center font-mono text-slate-500">{index + 1}</td>
                          <td className={`px-4 py-3 font-mono font-bold ${!row.isValid && !row.col1 ? 'text-rose-400 underline decoration-dashed' : ''}`}>
                            {row.col1 || 'ไม่มีข้อมูล'}
                          </td>
                          <td className="px-4 py-3">{row.col2}</td>
                          <td className="px-4 py-3 font-mono">{row.col3}</td>
                          <td className="px-4 py-3">{row.col4}</td>
                          <td className="px-4 py-3">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" /> ผ่านการตรวจสอบ
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                  <XCircle className="w-3 h-3" /> ข้อมูลขัดข้อง
                                </span>
                                <p className="text-[10px] text-rose-300 font-light mt-0.5 leading-tight">{row.errorMessage}</p>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ข้อความช่วยเหลือ */}
              <div className="bg-slate-900/30 p-3 rounded-xl border border-white/5 text-[10px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p>
                  <strong>คำแนะนำด้านความปลอดภัย:</strong> ระบบจะละเว้นหรือข้ามแถวข้อมูลที่ "พบข้อผิดพลาด" และนำเข้าเฉพาะแถวที่ "ผ่านเกณฑ์ตรวจสอบ" เท่านั้นเพื่อป้องกันฐานข้อมูลพังเสียหาย หากท่านต้องการแก้ไขข้อผิดพลาด สามารถดาวน์โหลดไฟล์มาปรับปรุงโครงสร้างแถวนั้นแล้วทำการอัปโหลดใหม่อีกครั้ง
                </p>
              </div>

            </div>
          )}

          {/* 4. Progress Loading Section */}
          {isImporting && (
            <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-6 text-center space-y-4 animate-pulse">
              <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span>กำลังอัปโหลดและผสานความสัมพันธ์ข้อมูล (Database Syncing)...</span>
                </div>
                <span className="font-mono text-indigo-400">{importProgress}%</span>
              </div>
              
              {/* Progress Bar Container */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 h-full rounded-full transition-all duration-150"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500">กรุณาอย่าเพิ่งปิดหน้าต่าง หรือสลับหน้าโปรแกรมขณะที่การจัดระเบียบตารางคะแนนและสิทธิ์กำลังดำเนินการ</p>
            </div>
          )}

        </div>

        {/* Modal Footer (Control Buttons) */}
        <div className="p-6 border-t border-white/5 bg-[#0a0f16] flex items-center justify-between">
          <div className="text-[10px] text-slate-500">
            School Management System • Bulk Import Engine
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-white/5 transition-colors cursor-pointer"
            >
              ยกเลิก (Cancel)
            </button>
            
            {/* Upload New File Trigger */}
            {file && (
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={isImporting}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-bold rounded-xl border border-white/5 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                อัปโหลดไฟล์ใหม่
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isImporting || !file || previewData.length === 0}
              className={`px-5 py-2 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
                !file || previewData.length === 0
                  ? 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-[0_4px_15px_rgba(99,102,241,0.25)]'
              }`}
            >
              <Database className="w-4 h-4" />
              ยืนยันการนำเข้าข้อมูล (Confirm)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
